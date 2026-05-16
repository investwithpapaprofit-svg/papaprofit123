import { UserProfile } from '../types';
import { finance } from '../finance';

export interface ScoreCategory {
    name: string;
    score: number;       // 0-100
    maxContribution: number; // how much it contributes to the final score
    explanation: string;
    improvementAction: string;
}

export interface FHSBreakdown {
    overallScore: number;
    categories: ScoreCategory[];
    topWeaknesses: ScoreCategory[];
    fastestActions: string[];
}

export function calculateFHSBreakdown(profile: UserProfile): FHSBreakdown {
    const income = finance.totalIncome(profile);
    
    // Default zero-state breakdown
    if (!income) {
        return {
            overallScore: 0,
            categories: [
                { name: 'Savings Rate', score: 0, maxContribution: 25, explanation: 'No income data available.', improvementAction: 'Add your income details.' },
                { name: 'Debt Burden', score: 0, maxContribution: 25, explanation: 'No income data available.', improvementAction: 'Add your income and debt details.' },
                { name: 'Emergency Fund', score: 0, maxContribution: 25, explanation: 'No data available.', improvementAction: 'Track your liquid assets and expenses.' },
                { name: 'Investments', score: 0, maxContribution: 25, explanation: 'No data available.', improvementAction: 'Start tracking your portfolio.' }
            ],
            topWeaknesses: [],
            fastestActions: ['Complete your profile by adding income and expenses.']
        };
    }

    const categories: ScoreCategory[] = [];
    
    // 1. Savings Score (25% weight)
    const sr = finance.savingsRate(profile);
    let srScore = 0;
    let srExplanation = '';
    let srAction = '';
    if (sr >= 30) { srScore = 100; srExplanation = `You are saving an excellent ${sr.toFixed(1)}% of your income.`; srAction = 'Maintain this great habit.'; }
    else if (sr >= 20) { srScore = 80; srExplanation = `You are saving a healthy ${sr.toFixed(1)}% of your income.`; srAction = 'Look for small optimizations to hit 30%.'; }
    else if (sr >= 10) { srScore = 50; srExplanation = `You are saving ${sr.toFixed(1)}% of your income.`; srAction = 'Review your discretionary expenses to boost savings.'; }
    else if (sr > 0) { srScore = 20; srExplanation = `Your savings rate is very low at ${sr.toFixed(1)}%.`; srAction = 'Identify one subscription or lifestyle cost to cut this month.'; }
    else { srScore = 0; srExplanation = `You are currently spending more than you earn.`; srAction = 'Urgently review expenses to stop cash burn.'; }

    categories.push({ name: 'Savings Rate', score: srScore, maxContribution: 25, explanation: srExplanation, improvementAction: srAction });

    // 2. Debt Burden (25% weight)
    const mDTI = finance.monthlyDebtToIncomeRatio(profile) * 100;
    let debtScore = 0;
    let debtExplanation = '';
    let debtAction = '';
    if (mDTI === 0) { debtScore = 100; debtExplanation = 'You have zero debt obligation.'; debtAction = 'Keep avoiding high-interest debt.'; }
    else if (mDTI <= 15) { debtScore = 80; debtExplanation = `Your EMI burden is low at ${mDTI.toFixed(1)}%.`; debtAction = 'Ensure your debt is in productive assets like a home.'; }
    else if (mDTI <= 35) { debtScore = 50; debtExplanation = `Your EMI burden is significant at ${mDTI.toFixed(1)}%.`; debtAction = 'Avoid taking on any new loans.'; }
    else if (mDTI < 50) { debtScore = 20; debtExplanation = `Your EMI burden is very high at ${mDTI.toFixed(1)}%.`; debtAction = 'Focus strictly on debt avalanche or snowball repayment.'; }
    else { debtScore = 0; debtExplanation = `Your EMI takes >50% of your income (${mDTI.toFixed(1)}%).`; debtAction = 'Urgently consolidate or restructure your debt.'; }

    categories.push({ name: 'Debt Burden', score: debtScore, maxContribution: 25, explanation: debtExplanation, improvementAction: debtAction });

    // 3. Emergency Fund (25% weight)
    const efRunway = finance.emergencyFundRunwayMonths(profile);
    let efScore = 0;
    let efExplanation = '';
    let efAction = '';
    if (efRunway >= 6) { efScore = 100; efExplanation = `Excellent. You have ${efRunway.toFixed(1)} months of emergency runway.`; efAction = 'You can now safely redirect cash to investments.'; }
    else if (efRunway >= 3) { efScore = 60; efExplanation = `You have ${efRunway.toFixed(1)} months of runway. Good, but aim for 6.`; efAction = 'Keep building liquid savings.'; }
    else if (efRunway >= 1) { efScore = 30; efExplanation = `You only have ${efRunway.toFixed(1)} months of runway.`; efAction = 'Prioritize cash savings before investing in stocks.'; }
    else { efScore = 0; efExplanation = `Your emergency fund covers less than 1 month of expenses.`; efAction = 'Build a 3-month buffer immediately.'; }

    categories.push({ name: 'Emergency Fund', score: efScore, maxContribution: 25, explanation: efExplanation, improvementAction: efAction });

    // 4. Investment Size (25% weight)
    const portfolioTotal = (profile.portfolio || []).reduce((sum, p) => {
      const val = p.marketValue !== undefined ? p.marketValue : (p.currentPrice || p.averageBuyPrice || 0) * (p.quantity || 1);
      return sum + val;
    }, 0);
    const annualIncome = income * 12;
    const invRatio = portfolioTotal / annualIncome;
    let invScore = 0;
    let invExplanation = '';
    let invAction = '';
    
    if (invRatio >= 3) { invScore = 100; invExplanation = 'Your investments exceed 3x your annual income.'; invAction = 'Review your asset allocation annually.'; }
    else if (invRatio >= 1) { invScore = 70; invExplanation = 'Your investments exceed 1x your annual income.'; invAction = 'Maintain your regular SIPs.'; }
    else if (invRatio >= 0.2) { invScore = 30; invExplanation = `Your investments are ${Math.round(invRatio * 100)}% of your annual income.`; invAction = 'Consider increasing your monthly investment amount.'; }
    else { invScore = 0; invExplanation = 'Your investment portfolio is very small relative to your income.'; invAction = 'Start a monthly SIP in a diversified index fund.'; }

    categories.push({ name: 'Investments', score: invScore, maxContribution: 25, explanation: invExplanation, improvementAction: invAction });

    // Calculate Overall
    const overallScore = Math.round(categories.reduce((sum, cat) => sum + (cat.score * (cat.maxContribution / 100)), 0));

    // Sort to find weaknesses (lowest scores first)
    const sortedWeaknesses = [...categories].sort((a, b) => a.score - b.score);
    const topWeaknesses = sortedWeaknesses.filter(c => c.score < 80).slice(0, 3);
    
    const fastestActions = topWeaknesses.map(w => w.improvementAction);
    if (fastestActions.length === 0) {
        fastestActions.push('Optimize your tax planning strategy.', 'Explore advanced portfolio diversification.');
    }

    return {
        overallScore,
        categories,
        topWeaknesses,
        fastestActions
    };
}
