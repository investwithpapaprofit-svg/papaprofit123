import { describe, it, expect } from 'vitest';
import { calculateFHSBreakdown } from './fhsBreakdown';
import { UserProfile } from '../types';

describe('fhsBreakdown', () => {
    it('calculates score correctly for good finances', () => {
        const profile: Partial<UserProfile> = {
            metrics: {
                monthlyCashFlow: 0,
                netWorth: 0,
                totalAssets: 0,
                totalLiabilities: 0
            } as any,
            income: [{ name: 'salary', value: 100000 }],
            expenses: [{ name: 'housing', value: 20000 }],
            loans: [],
            assets: [{ type: 'cash', value: 300000, name: 'Bank' }], // 3 months runway
            portfolio: []
        };
        const res = calculateFHSBreakdown(profile as UserProfile);
        
        expect(res.categories.find(c => c.name === 'Savings Rate')?.score).toBe(100);
        expect(res.categories.find(c => c.name === 'Emergency Fund')?.score).toBe(100);
        expect(res.categories.find(c => c.name === 'Debt Burden')?.score).toBe(100);
    });

    it('penalizes poor finances appropriately', () => {
        const profile: Partial<UserProfile> = {
            metrics: {
                monthlyCashFlow: 0,
                netWorth: 0,
                totalAssets: 0,
                totalLiabilities: 0
            } as any,
            income: [{ name: 'salary', value: 50000 }],
            expenses: [{ name: 'housing', value: 40000 }],
            loans: [{ name: 'Car Loan', amount: 500000, rate: 10, emi: 15000 }],
            assets: [{ type: 'cash', value: 10000, name: 'Bank' }], // ~0.2 months runway
            portfolio: []
        };
        const res = calculateFHSBreakdown(profile as UserProfile);
        
        expect(res.overallScore).toBeLessThan(50);
        expect(res.topWeaknesses.length).toBeGreaterThan(0);
    });
});

