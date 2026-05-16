import { FinancialGoal, UserProfile } from '../types';
import { finance } from '../finance';

export interface GoalSimulation {
    monthsToComplete: number;
    completionDate: Date;
    suggestedMonthlySIP: number;
    isAffordable: boolean;
    status: 'on-track' | 'behind' | 'aggressive' | 'completed';
    projectedTotal: number;
}

export function simulateGoal(goal: FinancialGoal, profile: UserProfile, inflationRate: number = 0.06, returnRate: number = 0.08): GoalSimulation {
    const saved = goal.saved || 0;
    let target = goal.target || 0;
    
    if (goal.target === 0 || saved >= target) {
        return {
            monthsToComplete: 0,
            completionDate: new Date(),
            suggestedMonthlySIP: 0,
            isAffordable: true,
            status: 'completed',
            projectedTotal: saved
        };
    }

    const currentMonthly = goal.monthlyNeeded || 0;
    const surplus = Math.max(0, finance.surplus(profile));
    
    // Calculate months required at current monthly rate
    let monthsToComplete = 0;
    let projectedTotal = saved;
    let limit = 600; // max 50 years to prevent infinite loop
    
    const monthlyReturnRate = returnRate / 12;
    const monthlyInflationRate = inflationRate / 12;
    
    if (currentMonthly > 0) {
       let m = 0;
       let bal = saved;
       let tgt = target;
       while (bal < tgt && m < limit) {
           bal = bal * (1 + monthlyReturnRate) + currentMonthly;
           tgt = tgt * (1 + monthlyInflationRate); // inflation adjusts target
           m++;
       }
       monthsToComplete = m;
       projectedTotal = bal;
    } else {
        monthsToComplete = -1; // Never completes
    }

    // Now calculate the ideal SIP for the user's explicit timeline goal (if they set months)
    let suggestedMonthlySIP = 0;
    if (goal.months && goal.months > 0) {
        let m = goal.months;
        let futureTarget = target * Math.pow(1 + monthlyInflationRate, m);
        let fvOfSaved = saved * Math.pow(1 + monthlyReturnRate, m);
        let shortfall = futureTarget - fvOfSaved;
        if (shortfall > 0) {
            // formula for SIP: PMT = FV * (r / ((1+r)^n - 1))
            suggestedMonthlySIP = shortfall * (monthlyReturnRate / (Math.pow(1 + monthlyReturnRate, m) - 1));
        }
    } else if (monthsToComplete > 0) {
        suggestedMonthlySIP = currentMonthly;
    }

    let status: GoalSimulation['status'] = 'behind';
    if (monthsToComplete > 0 && goal.months && monthsToComplete <= goal.months) {
        status = 'on-track';
    } else if (monthsToComplete > 0 && !goal.months) {
        status = 'on-track'; // If no deadline, any progress is on-track
    }
    if (suggestedMonthlySIP > surplus * 0.5) status = 'aggressive';

    const completionDate = new Date();
    if (monthsToComplete > 0) {
        completionDate.setMonth(completionDate.getMonth() + monthsToComplete);
    }

    return {
        monthsToComplete: monthsToComplete > 0 ? monthsToComplete : -1,
        completionDate,
        suggestedMonthlySIP: Math.round(suggestedMonthlySIP || 0),
        isAffordable: suggestedMonthlySIP <= surplus,
        status,
        projectedTotal: Math.round(projectedTotal || 0)
    };
}
