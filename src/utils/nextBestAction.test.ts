import { expect, test, describe } from 'vitest';
import { getNextBestAction } from './nextBestAction';

describe('getNextBestAction', () => {
  test('recommends completing profile when no income', () => {
    const profile = { metrics: {}, income: [] } as any;
    const res = getNextBestAction(profile);
    expect(res.title).toBe('Complete profile setup');
  });

  test('recommends building emergency fund when low', () => {
    const profile = {
      income: [{ name: 'Salary', value: 10000 }],
      metrics: {
        savingsRate: 20,
        emergencyFundRunwayMonths: 1
      }
    } as any;
    const res = getNextBestAction(profile);
    expect(res.title).toBe('Build Emergency Fund');
  });
});
