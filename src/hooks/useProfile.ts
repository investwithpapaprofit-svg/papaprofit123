import { useState, useCallback } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile } from '../types';
import { finance } from '../finance';
import { auth } from '../firebase';

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

const defaultProfile = (): UserProfile => (JSON.parse(JSON.stringify(DEFAULT_PROFILE)));

export function useProfile(user: User | null) {
  const [profile, setProfile] = useState<UserProfile>(defaultProfile());

  const loadProfile = useCallback(async () => {
    if (!user) return;
    try {
      const ref = doc(db, 'users', user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        let loadedProfile = data?.profile || {};
        
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
          const updatedStocks = await Promise.all(safeProfile.portfolio.map(async (holding: any) => {
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
    } catch (e: any) {
      if (e?.message?.includes('client is offline')) {
         console.warn("Firestore client is offline, unable to load profile");
      } else {
         handleFirestoreError(e, OperationType.GET, `users/${user.uid}`);
      }
    }
  }, [user]);

  const saveProfile = useCallback(async (newProfile: UserProfile) => {
    if (!user) return;
    const { isPremium, role, ...profileToSave } = newProfile as any;
    finance.recalculateMetrics(profileToSave);
    try {
      await setDoc(doc(db, 'users', user.uid), { profile: profileToSave }, { merge: true });
      setProfile(profileToSave);
    } catch (e: any) {
      if (e?.message?.includes('client is offline')) {
         console.warn("Firestore client is offline, unable to save profile");
      } else {
         handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}`);
      }
    }
  }, [user]);

  return { profile, setProfile, loadProfile, saveProfile };
}
