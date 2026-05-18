import { test, expect } from 'vitest';
import { getNextBestAction } from './utils/nextBestAction';
import { getSmartAlerts } from './utils/smartAlerts';
import { generateDebtPlan } from './utils/debtPlanner';
import { generateWeeklyReport } from './utils/weeklyReport';
import { UserProfile } from './types';

const defaultProfile: UserProfile = {
  personal: {},
  income: [],
  expenses: [],
  subscriptions: [],
  loans: [],
  assets: [],
  portfolio: [],
  goals: [],
  metrics: {} as any,
  insights: [],
  preferences: { currency: 'INR' },
  history: [],
  lastUpdated: new Date().toISOString()
};

test('next best action logic', () => {
  const profile = { ...defaultProfile, onboardingCompleted: true, income: [{ name: 'Salary', value: 0 }] };
  expect(getNextBestAction(profile).title).toBe('Add Monthly Income');

  const p2 = { ...defaultProfile, income: [{ name: 'Salary', value: 100000 }], expenses: [{ name: 'Rent', value: 80000 }], assets: [{ name: 'Cash', value: 10000, type: 'cash' as const }]};
  expect(getNextBestAction(p2).title).toBe('Build Emergency Fund');

  const p3 = { ...defaultProfile, income: [{ name: 'Salary', value: 100000 }], expenses: [{ name: 'Rent', value: 40000 }], assets: [{ name: 'Cash', value: 500000, type: 'cash' as const }], loans: [{ name: 'Loan', amount: 2000000, rate: 10, emi: 20000 }] };
  expect(getNextBestAction(p3).title).toBe('Reduce Debt Burden');
});

test('smart alerts', () => {
  const p = { ...defaultProfile, income: [{ name: 'Salary', value: 100000 }], expenses: [{ name: 'Rent', value: 100000 }, { name: 'Food', value: 20000 }]};
  const alerts = getSmartAlerts(p);
  expect(alerts.some(a => a.explanation.includes('negative monthly cash flow'))).toBe(true);

  const p2 = { ...defaultProfile, income: [{ name: 'Salary', value: 100000 }], loans: [{ name: 'Loan', amount: 500000, rate: 10, emi: 50000 }] };
  const alerts2 = getSmartAlerts(p2);
  expect(alerts2.some(a => a.explanation.includes('50.0%'))).toBe(true);
});

test('debt planner', () => {
  const p = { ...defaultProfile, loans: [{ name: 'Car', amount: 500000, rate: 9, emi: 10000 }, { name: 'CC', amount: 50000, rate: 36, emi: 5000 }]};
  const plan = generateDebtPlan(p);
  expect(plan.totalDebt).toBe(550000);
  expect(plan.highestInterestLoan?.name).toBe('CC');
  expect(plan.payoffPriority[0].name).toBe('CC');
  expect(plan.payoffPriority[1].name).toBe('Car');
  expect(plan.estimatedPayoffGuidance).toContain('Avalanche Method');
});

test('weekly report', () => {
  const p = { ...defaultProfile };
  expect(generateWeeklyReport(p).isAvailable).toBe(false);

  p.history = [
    { type: 'snapshot', date: 'last', timestamp: 0, description: 'd', metricsSnapshot: { netWorth: 100000, savingsRate: 10, totalLiabilities: 50000 } as any },
    { type: 'snapshot', date: 'now', timestamp: 100, description: 'd', metricsSnapshot: {} as any }
  ];
  p.metrics = { netWorth: 110000, savingsRate: 15, totalLiabilities: 45000 } as any;

  const report = generateWeeklyReport(p);
  expect(report.isAvailable).toBe(true);
  expect(report.netWorthChange).toBe('+₹10,000');
  expect(report.savingsRateChange).toBe('+5.0%');
  expect(report.debtChange).toBe('+0.0% vs Income');
});
