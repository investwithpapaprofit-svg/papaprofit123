import { useState, useCallback, useRef, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile } from '../types';
import { finance } from '../finance';
import { auth } from '../firebase';
import { sanitizeProfileForWrite } from '../utils/sanitizeProfileForWrite';

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
  const [loadedChatHistory, setLoadedChatHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const ref = doc(db, 'users', user.uid);
      
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        let loadedProfile = data?.profile || {};
        if (data?.chatHistory) {
          setLoadedChatHistory(data.chatHistory);
        }

        
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
        // Snapshot history logic
        const currentMonth = new Date().toISOString().slice(0, 7); // e.g. "2026-05"
        const lastSnapshotMonth = safeProfile.history && safeProfile.history.length > 0 
          ? safeProfile.history[safeProfile.history.length - 1].month 
          : null;

        if (lastSnapshotMonth !== currentMonth) {
          safeProfile.history = safeProfile.history || [];
          safeProfile.history.push({
            month: currentMonth,
            timestamp: Date.now(),
            metricsSnapshot: {
              netWorth: safeProfile.metrics.netWorth,
              savingsRate: safeProfile.metrics.savingsRate,
              cashFlow: safeProfile.metrics.monthlyCashFlow,
              debtToIncome: safeProfile.metrics.debtToIncomeRatio
            }
          });
          // Optimistically save the new history (fire and forget to not block load)
          import('firebase/firestore').then(({ setDoc }) => {
            setDoc(ref, { profile: { history: safeProfile.history } }, { merge: true }).catch(() => {});
          });
        }

        setProfile(safeProfile);
      } else {
        const dp = defaultProfile();
        dp.lastUpdated = new Date().toISOString();
        setProfile(dp);
      }
    } catch (e: any) {
      if (e?.message?.includes('client is offline')) {
         console.warn("Firestore client is offline, unable to load profile");
      } else {
         handleFirestoreError(e, OperationType.GET, `users/${user.uid}`);
      }
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const profileRef = useRef(profile);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const saveProfile = useCallback(async (newProfile: UserProfile) => {
    if (!user) return;
    // We use the ref to always get latest profile state and to not recreate saveProfile
    const profileToSave = sanitizeProfileForWrite(newProfile, profileRef.current) as UserProfile;
    finance.recalculateMetrics(profileToSave);
    try {
      await setDoc(doc(db, 'users', user.uid), { profile: profileToSave }, { merge: true });
      setProfile({ ...profileToSave, isPremium: profileRef.current.isPremium, role: profileRef.current.role } as any);
    } catch (e: any) {
      if (e?.message?.includes('client is offline')) {
         console.warn("Firestore client is offline, unable to save profile");
      } else {
         handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}`);
      }
    }
  }, [user]);

  return { profile, setProfile, loadProfile, saveProfile, isLoading, loadedChatHistory };
}
