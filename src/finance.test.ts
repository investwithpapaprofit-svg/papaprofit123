import { finance } from './finance';
import { UserProfile } from './types';

function assertEqual(actual: any, expected: any, msg: string) {
  if (actual !== expected) {
    throw new Error(`TEST FAILED: ${msg}. Expected ${expected}, got ${actual}`);
  }
}

function runTests() {
  console.log("Running finance tests...");
  const mockProfile: UserProfile = {
    personal: {},
    income: [{ name: 'Salary', value: 100000 }],
    expenses: [{ name: 'Rent', value: 30000 }],
    subscriptions: [{ name: 'Netflix', cost: 500, billingCycle: 'monthly' }],
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

  assertEqual(finance.totalIncome(mockProfile), 100000, "Total Income");
  assertEqual(finance.totalExpenses(mockProfile), 30500, "Total Expenses");
  assertEqual(finance.totalEMI(mockProfile), 10000, "Total EMI");
  assertEqual(finance.surplus(mockProfile), 100000 - 30500 - 10000, "Surplus");
  assertEqual(finance.totalAssets(mockProfile), 200000 + 20000, "Total Assets");
  assertEqual(finance.totalLiabilities(mockProfile), 500000, "Total Liabilities");
  assertEqual(finance.netWorth(mockProfile), 220000 - 500000, "Net Worth");

  finance.recalculateMetrics(mockProfile);
  assertEqual(mockProfile.metrics.netWorth, 220000 - 500000, "Recalculated Net Worth");

  console.log("All finance tests passed!");
}

runTests();
