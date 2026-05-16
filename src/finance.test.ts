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

import { sanitizeProfileForWrite } from './utils/sanitizeProfileForWrite';
import { mapChatError } from './utils/mapChatError';

test('profile structure sanitization with goals/history', () => {
  const newProfile = { name: "Test", history: [1, 2, 3], goals: [{ name: "car", saved: -500 }], isPremium: true, role: 'admin' };
  const currentTrustedState = { isPremium: false };
  const profileToSave = sanitizeProfileForWrite(newProfile, currentTrustedState);
  
  expect(profileToSave.history!.length).toBe(3);
  expect(profileToSave.goals![0].saved).toBe(-500);
  expect(profileToSave.isPremium).toBe(false); // Pulled from trusted state
  expect(profileToSave.role).toBeUndefined(); // Dropped from untrusted, not in trusted
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

import { calculateFHSBreakdown } from './utils/fhsBreakdown';

test('fhs breakdown categorization and scoring', () => {
    const profile: UserProfile = { ...mockProfile, income: [{ name: 'Salary', value: 100000 }], expenses: [{ name: 'Rent', value: 50000 }], loans: [{ name: 'Car', amount: 500000, rate: 8, emi: 40000 }], assets: [], portfolio: [], subscriptions: [] };
    const breakdown = calculateFHSBreakdown(profile);
    
    // Total income = 100k, Expenses = 50k, EMI = 40k. Total out = 90k. Surplus = 10k.
    // Savings Rate = 10% -> 50 score
    // mDTI = 40% -> 20 score
    // efRunway = 0 -> 0 score
    // Investments = 0 -> 0 score
    
    expect(breakdown.categories.find(c => c.name === 'Savings Rate')?.score).toBe(50);
    expect(breakdown.categories.find(c => c.name === 'Debt Burden')?.score).toBe(20);
    expect(breakdown.categories.find(c => c.name === 'Emergency Fund')?.score).toBe(0);
    expect(breakdown.topWeaknesses.length).toBeGreaterThan(0);
    expect(breakdown.fastestActions.length).toBeGreaterThan(0);
});

import { simulateGoal } from './utils/goalSimulator';

test('api error mapping test helper logic', () => {
  expect(mapChatError('Error 401 Unauthorized')).toBe("Your session seems to have expired. Please log in again.");
  expect(mapChatError('GROQ_API_KEY is not defined')).toBe("My AI systems are currently unconfigured. Please check the backend configuration.");
  expect(mapChatError('Failed to fetch from server')).toBe("It looks like you're offline or experiencing network issues. Please check your connection.");
  expect(mapChatError('Error 429 Too many requests')).toBe("I'm receiving too many requests right now. Please wait a moment and try again.");
});

test('goal simulator logic', () => {
    const profile: UserProfile = { ...mockProfile, income: [{ name: 'S', value: 100000 }], expenses: [{ name: 'E', value: 50000 }] }; // surplus 50k
    const goal = { name: 'House', target: 5000000, saved: 1000000, monthlyNeeded: 50000, months: 60 };
    
    const sim = simulateGoal(goal, profile, 0.06, 0.12); // 12% return, 6% inflation
    expect(sim.suggestedMonthlySIP).toBeGreaterThan(0);
    expect(sim.status).toBeDefined();
    
    // Auto completion when fully funded
    const doneGoal = { name: 'Done', target: 100000, saved: 100000, monthlyNeeded: 0, months: 12 };
    const doneSim = simulateGoal(doneGoal, profile);
    expect(doneSim.status).toBe('completed');
    expect(doneSim.monthsToComplete).toBe(0);
});
