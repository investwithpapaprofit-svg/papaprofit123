import { UserProfile } from '../types';
import { finance } from '../finance';

export interface NextBestAction {
  title: string;
  reason: string;
  action: string;
  severity: 'high' | 'medium' | 'low';
}

export function getNextBestAction(profile: UserProfile): NextBestAction {
  const totalLoans = finance.totalLiabilities(profile);
  const income = finance.totalIncome(profile);
  const savingsRate = finance.savingsRate(profile);
  const stockAssets = (profile.portfolio || []).filter(p => ['stock', 'etf', 'mutual_fund'].includes(p.assetType));
  const efRunway = finance.emergencyFundRunwayMonths(profile);

  if (income === 0 && !profile.onboardingCompleted) {
      return { title: 'Complete profile setup', reason: 'I need basic data to give accurate recommendations.', action: 'Chat with me to add your income and expenses.', severity: 'medium' };
  }
  if (income === 0) {
      return { title: 'Add Monthly Income', reason: 'Savings rate and health score depend on income.', action: 'Tell me your take-home pay.', severity: 'high' };
  }

  if (efRunway < 3) {
    return { title: 'Build Emergency Fund', reason: `You have less than 3 months of runway (${efRunway.toFixed(1)} months).`, action: 'Keep cash aside before investing.', severity: 'high' };
  }

  if (totalLoans > (income * 12)) {
    return { title: 'Reduce Debt Burden', reason: 'High debt is eating into your future wealth.', action: 'Focus on reducing your debt aggressively before investing.', severity: 'high' };
  }

  if (savingsRate < 20) {
    return { title: 'Improve Savings Rate', reason: `Your savings rate is ${savingsRate.toFixed(1)}%. Aim for 20%+.`, action: 'Review your subscriptions and lifestyle expenses.', severity: 'medium' };
  }

  if (stockAssets.length === 0) {
    return { title: 'Start Investing', reason: 'You have a healthy surplus but no equity investments.', action: 'Start investing in diversified equity like index funds.', severity: 'medium' };
  }

  return { title: 'Optimize Portfolio', reason: 'You are on track!', action: 'Optimize your portfolio allocation for better long-term growth.', severity: 'low' };
}
