import { useState, useCallback } from 'react';
import { UserProfile } from '../types';
import { User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, auth, OperationType } from '../firebase';
import { finance } from '../finance';

export const DEFAULT_PROFILE: UserProfile = {
  personal: {},
  income: [],
  expenses: [],
  loans: [],
  assets: [],
  subscriptions: [],
  portfolio: [],
  goals: [],
  metrics: {
    netWorth: 0,
    monthlyCashFlow: 0,
    savingsRate: 0,
    debtToIncomeRatio: 0,
    emergencyFundRunwayMonths: 0,
    financialHealthScore: 0
  },
  insights: [],
  history: [],
  preferences: {
    currency: 'INR'
  },
  onboardingCompleted: false,
  lastUpdated: ''
};

export function useProfile() {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  const loadProfile = useCallback(async (user: User) => {
    setIsLoadingProfile(true);
    try {
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.profile) {
          const loadedProfile = data.profile as UserProfile;
          let safeAssets = Array.isArray(loadedProfile.assets) ? loadedProfile.assets : [];
          if (!Array.isArray(loadedProfile.assets) && typeof loadedProfile.assets === 'object') {
             const old = loadedProfile.assets as any;
             if (old.property) old.property.forEach((p:any) => safeAssets.push({type: 'property', name: p.name, value: p.value, mortgageable: p.mortgageable}));
             if (old.gold) safeAssets.push({type: 'gold', name: 'Gold', value: old.gold});
             if (old.cash) safeAssets.push({type: 'cash', name: 'Cash', value: old.cash});
             if (old.other) old.other.forEach((p:any) => safeAssets.push({type: 'other', name: p.name, value: p.value}));
             
             if (old.stocks) {
               loadedProfile.portfolio = loadedProfile.portfolio || [];
               old.stocks.forEach((s:any) => {
                 loadedProfile.portfolio.push({
                   symbol: s.symbol,
                   name: s.name,
                   assetType: 'stock',
                   quantity: s.quantity,
                   averageBuyPrice: s.buyPrice,
                   currentPrice: s.currentPrice
                 });
               });
             }
             if (old.crypto) {
               loadedProfile.portfolio = loadedProfile.portfolio || [];
               old.crypto.forEach((s:any) => {
                 loadedProfile.portfolio.push({
                   symbol: s.name,
                   name: s.name,
                   assetType: 'crypto',
                   quantity: 1,
                   averageBuyPrice: s.value,
                   currentPrice: s.value
                 });
               });
             }
          }

          let safePersonal: any = loadedProfile.personal || DEFAULT_PROFILE.personal;
          if (!loadedProfile.personal && (loadedProfile as any).riskProfile) {
            safePersonal.riskProfile = (loadedProfile as any).riskProfile;
          }

          const safeProfile = {
            ...DEFAULT_PROFILE,
            ...loadedProfile,
            personal: safePersonal,
            income: Array.isArray(loadedProfile.income) ? loadedProfile.income : (loadedProfile as any).incomeSources || [],
            expenses: Array.isArray(loadedProfile.expenses) ? loadedProfile.expenses : (loadedProfile as any).expenseCategories || [],
            loans: loadedProfile.loans || [],
            assets: safeAssets,
            subscriptions: loadedProfile.subscriptions || [],
            portfolio: loadedProfile.portfolio || [],
            goals: loadedProfile.goals || [],
            metrics: loadedProfile.metrics || DEFAULT_PROFILE.metrics,
            insights: loadedProfile.insights || []
          };
          finance.recalculateMetrics(safeProfile);

          // Fetch live prices for stocks
          if (safeProfile.portfolio && safeProfile.portfolio.length > 0) {
            const token = await auth.currentUser?.getIdToken();
            const updatedStocks = await Promise.all(safeProfile.portfolio.map(async (holding) => {
              try {
                if (holding.assetType === 'stock') {
                  const res = await fetch(`/api/stock/quote?symbol=${holding.symbol}`, {
                    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                  });
                  if (res.ok) {
                    const quote = await res.json();
                    if (quote && quote.regularMarketPrice) {
                      return { ...holding, currentPrice: quote.regularMarketPrice };
                    }
                  }
                }
              } catch (e) {
                console.error("Failed to fetch price for", holding.symbol);
              }
              return holding;
            }));
            safeProfile.portfolio = updatedStocks;
            finance.recalculateMetrics(safeProfile);
          }
          setProfile(safeProfile);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
    } finally {
      setIsLoadingProfile(false);
    }
  }, []);

  const saveProfile = useCallback(async (user: User, newProfile: UserProfile) => {
    try {
      // Filter out isPremium and role from client-side save to prevent abuse
      const { isPremium, ...profileToSave } = newProfile;
      if ('role' in profileToSave) {
        delete (profileToSave as any).role;
      }
      
      await setDoc(doc(db, 'users', user.uid), {
        name: user.displayName,
        email: user.email,
        profile: profileToSave,
        lastUpdated: new Date().toISOString()
      }, { merge: true });
      
      setProfile({ ...newProfile, isPremium }); // keep locally if it existed
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    }
  }, []);

  return { profile, setProfile, loadProfile, saveProfile, isLoadingProfile };
}
