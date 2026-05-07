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

  expect(finance.totalIncome(mockProfile)).toBe(100000);
  expect(finance.totalExpenses(mockProfile)).toBe(31050); // 30000 (rent) + 1000 (gym) + 50 (netflix monthly)
  expect(finance.totalEMI(mockProfile)).toBe(10000);
  expect(finance.surplus(mockProfile)).toBe(100000 - 31050 - 10000);
  expect(finance.totalAssets(mockProfile)).toBe(200000 + 20000);
  expect(finance.totalLiabilities(mockProfile)).toBe(500000);
  expect(finance.netWorth(mockProfile)).toBe(220000 - 500000);

  finance.recalculateMetrics(mockProfile);
  expect(mockProfile.metrics.netWorth).toBe(220000 - 500000);
});
