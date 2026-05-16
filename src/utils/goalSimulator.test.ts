import { describe, it, expect } from 'vitest';
import { simulateGoal } from './goalSimulator';
import { UserProfile, FinancialGoal } from '../types';

describe('goalSimulator', () => {
    const dummyProfile: Partial<UserProfile> = {
        metrics: {
            monthlyCashFlow: 30000,
            netWorth: 0,
            savingsRate: 0,
            debtToIncomeRatio: 0,
            emergencyFundRunwayMonths: 0,
            financialHealthScore: 0
        },
        income: [{ name: 'salary', value: 100000 }],
        expenses: [{ name: 'housing', value: 70000 }],
        loans: [],
        assets: [],
        portfolio: []
    };

    it('calculates goal completion dynamically', () => {
        const goal: FinancialGoal = {
            name: 'Home',
            target: 1000000,
            saved: 200000,
            months: 60,
            monthlyNeeded: 20000
        };
        
        const sim = simulateGoal(goal, dummyProfile as UserProfile, 0.06, 0.12);
        expect(sim.monthsToComplete).toBeGreaterThan(0);
        expect(sim.projectedTotal).toBeGreaterThanOrEqual(1000000);
        expect(sim.status).toBeDefined();
    });

    it('handles goals that can never be completed due to 0 sip', () => {
        const goal: FinancialGoal = {
            name: 'Home',
            target: 2000000,
            saved: 100000,
            months: 120,
            monthlyNeeded: 0
        };

        const sim = simulateGoal(goal, dummyProfile as UserProfile, 0.06, 0.12);
        expect(sim.monthsToComplete).toBe(-1); // Indicator for never completing
        expect(sim.status).toBe('behind');
    });
});
