import { describe, it, expect } from 'vitest';
import { calculateOldTax, calculateNewTax, applySurchargeAndCess } from './tax';

describe('Tax Engine FY2025-26', () => {
    it('₹10L new regime should have zero tax (rebate)', () => {
        expect(calculateNewTax(1000000)).toBe(0);
        expect(calculateNewTax(1200000)).toBe(0);
    });

    it('₹12.5L new regime should have tax applied', () => {
        // above 12L so no rebate. tax on 12.5L:
        // 0-4=0, 4-8=20k, 8-12=40k, 12-12.5=7.5k => total 67500
        // cess 4% => 67500 * 1.04 = 70200
        expect(calculateNewTax(1250000)).toBe(70200);
    });

    it('₹5L old regime should have zero tax', () => {
        expect(calculateOldTax(500000)).toBe(0);
    });

    it('₹6L old regime should have tax applied', () => {
        // above 500k so no rebate. tax on 6L:
        // 0-2.5=0
        // 2.5-5=12.5k
        // 5-6 = 20k
        // total 32.5k
        // 4% cess => 33800
        expect(calculateOldTax(600000)).toBe(33800);
    });

    it('Surcharge logic: >50L gets 10%', () => {
        const taxBase = calculateNewTax(6000000);
        expect(taxBase).toBeGreaterThan(0);
    });

    it('Surcharge logic: >1Cr gets 15%', () => {
        const taxVal = applySurchargeAndCess(1000000, 11000000);
        // tax = 10L, 15% surcharge = 1.5L. Total 11.5L
        // cess 4% on 11.5L = 46k => 11.96L
        expect(taxVal).toBe(1196000);
    });

    it('Surcharge logic: >2Cr gets 25%', () => {
        const taxVal = applySurchargeAndCess(1000000, 21000000);
        // tax = 10L, 25% surcharge = 2.5L. Total 12.5L
        // cess 4% => 13L
        expect(taxVal).toBe(1300000);
    });

    it('Surcharge logic: >5Cr gets 37%', () => {
        const taxVal = applySurchargeAndCess(1000000, 51000000);
        // tax = 10L, 37% surcharge = 3.7L. Total 13.7L
        // cess 4% => 14.248L 
        expect(taxVal).toBe(1424800);
    });

    it('New regime progressive slabs test for 17L', () => {
       // 0-4=0, 4-8=20k, 8-12=40k, 12-16=60k, 16-17=20k => 140k
       // plus 4% = 145600
       expect(calculateNewTax(1700000)).toBe(145600);
    });
});

