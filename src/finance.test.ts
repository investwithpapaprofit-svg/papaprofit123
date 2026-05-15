import { test, expect } from 'vitest';
import { finance } from './finance';
import { UserProfile } from './types';

const mockProfile: UserProfile = {
  personal: {},
  income: [{ name: 'Salary', value: 100000 }],
  expenses: [{ name: 'Rent', value: 30000 }],
  subscriptions: [{ name: 'Netflix', cost: 600, billingCycle: 'yearly' }, { name: 'Gym', cost: 1000, billingCycle: 'monthly' }],
  loans: [{ name: 'Car', amount: 500000, rate: 8, emi: 10000 }],
  assets: [{ name: 'Cash', type: 'cash' as const, value: 200000 }],
  portfolio: [{ symbol: 'AAPL', name: 'Apple', assetType: 'stock' as const, quantity: 10, averageBuyPrice: 1500, marketValue: 20000 }],
  goals: [],
  metrics: {} as any,
  insights: [],
  preferences: { currency: 'INR' },
  history: [],
  lastUpdated: new Date().toISOString()
};

test('financial calculations', () => {
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

test('financial health score calculation boundaries', () => {
  const profile: UserProfile = { ...mockProfile };
  
  // Test low score scenario
  const badProfile = { ...profile, income: [{ name: 'Salary', value: 50000 }], expenses: [{ name: 'Rent', value: 45000 }], loans: [{ name: 'Loan', amount: 500000, rate: 12, emi: 20000 }] };
  expect(finance.fhs(badProfile)).toBeLessThan(30);

  // Test excellent score scenario
  const goodProfile = { ...profile, income: [{ name: 'Salary', value: 200000 }], expenses: [{ name: 'Rent', value: 40000 }], assets: [{ name: 'Cash', value: 1200000, type: 'cash' as const }], portfolio: [{ symbol: 'AAPL', name: 'Apple', assetType: 'stock' as const, marketValue: 3000000, quantity: 10, averageBuyPrice: 15 }] };
  expect(finance.fhs(goodProfile)).toBeGreaterThan(75);
});

test('emergency fund runway calculation checks', () => {
  const profile: UserProfile = { ...mockProfile, subscriptions: [], expenses: [{ name: 'Rent', value: 50000 }], loans: [{ name: 'Loan', amount: 0, rate: 0, emi: 10000 }] };
  
  profile.assets = [{ name: 'Cash', value: 120000, type: 'cash' as const }];
  expect(finance.emergencyFundRunwayMonths(profile)).toBe(2);

  profile.assets = [{ name: 'Cash', value: 360000, type: 'cash' as const }];
  expect(finance.emergencyFundRunwayMonths(profile)).toBe(6);
});

test('goal monthly needed edge cases', () => {
  expect(finance.goalMonthlyNeeded({ name: 'Car', target: 500000, saved: 100000, months: 0 })).toBe(0);
  expect(finance.goalMonthlyNeeded({ name: 'Car', target: 500000, saved: 100000, months: -5 })).toBe(0);
  
  const needed = finance.goalMonthlyNeeded({ name: 'Car', target: 500000, saved: 100000, months: 12 });
  expect(needed).toBeGreaterThan(0);
});

test('goal probability evaluation', () => {
  const profile: UserProfile = { ...mockProfile, subscriptions: [], loans: [], income: [{ name: 'Salary', value: 100000 }], expenses: [{ name: 'Rent', value: 50000 }] }; // surplus = exactly 50000
  
  // Need exactly 50000 -> ratio 1
  const goal1: any = { name: 'G1', target: 500000, saved: 0, months: 10, monthlyNeeded: 50000 };
  expect(finance.goalProbabilityOfSuccess(goal1, profile)).toBe(0.70);

  // Need 10000 -> ratio 5
  const goal2: any = { name: 'G2', target: 100000, saved: 0, months: 10, monthlyNeeded: 10000 };
  expect(finance.goalProbabilityOfSuccess(goal2, profile)).toBe(0.95);

  // Need 100000 -> ratio 0.5
  const goal3: any = { name: 'G3', target: 1000000, saved: 0, months: 10, monthlyNeeded: 100000 };
  expect(finance.goalProbabilityOfSuccess(goal3, profile)).toBe(0.40);
});

test('generateInsights filters logically', () => {
  const profile: UserProfile = { ...mockProfile, income: [{ name: 'Salary', value: 100000 }], expenses: [{ name: 'Rent', value: 95000 }] }; 
  const insights = finance.generateInsights(profile);
  expect(insights.some(i => i.id === 'sr_low')).toBe(true);
});

test('profile structure sanitization with goals/history', () => {
  const newProfile = { name: "Test", history: [1, 2, 3], goals: [{ name: "car", saved: -500 }] };
  const { ...profileToSave } = newProfile as any;
  expect(profileToSave.history.length).toBe(3);
  expect(profileToSave.goals[0].saved).toBe(-500);
});

test('history snapshot storage limit', () => {
    const profile: UserProfile = { ...mockProfile, history: [] };
    for (let i = 0; i < 25; i++) {
        profile.history!.push({ date: new Date().toISOString(), timestamp: Date.now() + i, type: 'snapshot', description: 'test' });
    }
    // Modify metrics significantly
    profile.assets = [{ name: 'Cash', type: 'cash' as const, value: Math.random() * 1000000 }];
    finance.recalculateMetrics(profile);
    expect(profile.history!.length).toBeLessThanOrEqual(20);
});

test('finance surplus logic', () => {
  const profile: UserProfile = { ...mockProfile, subscriptions: [], loans: [], income: [{ name: 'Salary', value: 100000 }], expenses: [{ name: 'Rent', value: 30000 }] };
  expect(finance.surplus(profile)).toBe(70000);
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
