import { expect, test, describe } from 'vitest';
import { generateDebtPlan } from './debtPlanner';

describe('debtPlanner', () => {
  test('prioritizes high interest debt', () => {
    const profile = {
      loans: [
        { name: 'Car Loan', amount: 500000, rate: 9, emi: 10000 },
        { name: 'Credit Card', amount: 50000, rate: 36, emi: 5000 }
      ],
      metrics: { monthlyCashFlow: 20000 }
    } as any;
    const plan = generateDebtPlan(profile);
    expect(plan.payoffPriority[0].name).toBe('Credit Card');
  });

  test('handles zero debt gracefully', () => {
    const profile = { loans: [], metrics: { monthlyCashFlow: 20000 } } as any;
    const plan = generateDebtPlan(profile);
    expect(plan.payoffPriority.length).toBe(0);
  });
});
