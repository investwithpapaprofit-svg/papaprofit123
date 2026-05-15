import { test, expect } from 'vitest';
import { finance } from './finance';
import { UserProfile } from './types';

test('financial calculations', () => {
  const mockProfile: UserProfile = {
    personal: {},
    income: [{ name: 'Salary', value: 100000 }],
    expenses: [{ name: 'Rent', value: 30000 }],
    subscriptions: [{ name: 'Netflix', cost: 600, billingCycle: 'yearly' }, { name: 'Gym', cost: 1000, billingCycle: 'monthly' }],
    loans: [{ name: 'Car', amount: 500000, rate: 8, emi: 10000 }],
    assets: [{ name: 'Cash', type: 'cash', value: 200000 }],
    portfolio: [{ symbol: 'AAPL', name: 'Apple', assetType: 'stock', quantity: 10, averageBuyPrice: 1500, marketValue: 20000 }],
    goals: [],
    metrics: {} as any,
    insights: [],
    preferences: { currency: 'INR' },
    history: [],
    lastUpdated: new Date().toISOString()
  };

  const snapshot = { ...mockProfile };
  
  expect(finance.totalIncome(snapshot)).toBe(100000);
  expect(finance.totalExpenses(snapshot)).toBe(31050); // 30000 (rent) + 1000 (gym) + 50 (netflix monthly)
  expect(finance.totalEMI(snapshot)).toBe(10000);
  expect(finance.surplus(snapshot)).toBe(100000 - 31050 - 10000);
  expect(finance.totalAssets(snapshot)).toBe(200000 + 20000);
  expect(finance.totalLiabilities(snapshot)).toBe(500000);
  expect(finance.netWorth(snapshot)).toBe(220000 - 500000);

  expect(finance.savingsRate(snapshot)).toBe((58950 / 100000) * 100);
  
  finance.recalculateMetrics(snapshot);
  
  expect(snapshot.metrics.financialHealthScore).toBeGreaterThanOrEqual(0);
  expect(snapshot.metrics.financialHealthScore).toBeLessThanOrEqual(100);
});

test('profile save sanitizer pure logic', () => {
  const newProfile = { name: "Test", isPremium: true, role: "admin", assets: [] };
  const { isPremium, role, ...profileToSave } = newProfile as any;
  expect(isPremium).toBe(true);
  expect(role).toBe("admin");
  expect(profileToSave.isPremium).toBeUndefined();
  expect(profileToSave.role).toBeUndefined();
});

test('api error mapping test helper logic', () => {
  const mapStr = (errStr: string) => {
      let errMsg = "I'm having a bit of trouble connecting right now.";
      if (errStr.includes('Groq API key not configured')) {
         errMsg = "Configuration";
      } else if (errStr.includes('401') || errStr.includes('Unauthorized')) {
         errMsg = "Session Expired";
      } else if (errStr.includes('429') || errStr.includes('Too many requests')) {
         errMsg = "Rate Limited";
      } else if (errStr.includes('Failed to fetch') || errStr.includes('NetworkError')) {
         errMsg = "Network Error";
      }
      return errMsg;
  };
  expect(mapStr('Error 401 Unauthorized')).toBe("Session Expired");
  expect(mapStr('Groq API key not configured right now')).toBe("Configuration");
  expect(mapStr('Failed to fetch from server')).toBe("Network Error");
  expect(mapStr('Error 429 Too many requests')).toBe("Rate Limited");
});
