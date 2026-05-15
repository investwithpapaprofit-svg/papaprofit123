import { UserProfile } from '../types';
import { finance } from '../finance';

export interface SmartAlert {
  severity: 'high' | 'medium' | 'low';
  explanation: string;
  action: string;
}

export function getSmartAlerts(profile: UserProfile): SmartAlert[] {
  const alerts: SmartAlert[] = [];
  const income = finance.totalIncome(profile);
  if (income === 0) return alerts; // Don't alarm if onboarding

  const efRunway = finance.emergencyFundRunwayMonths(profile);
  const mDTI = finance.monthlyDebtToIncomeRatio(profile);
  const surplus = finance.surplus(profile);
  const savingsRate = finance.savingsRate(profile);
  const netWorth = finance.netWorth(profile);

  const subExpenses = (profile.subscriptions || []).reduce((s, sub) => s + (sub.billingCycle === 'yearly' ? sub.cost / 12 : sub.cost), 0);

  if (efRunway < 3) {
    alerts.push({ severity: 'high', explanation: `Your emergency fund only covers ${efRunway.toFixed(1)} months of expenses.`, action: 'Save 3-6 months of expenses in a liquid savings account.' });
  }

  if (mDTI > 0.4) {
    alerts.push({ severity: 'high', explanation: `Your EMI commitments are ${(mDTI * 100).toFixed(1)}% of your income.`, action: 'Avoid new loans and focus on the avalanche method to pay down debt.' });
  }

  if (surplus < 0) {
    alerts.push({ severity: 'high', explanation: 'You have a negative monthly cash flow. You are spending more than you earn.', action: 'Immediately review and cut non-essential expenses.' });
  } else if (savingsRate < 10) {
    alerts.push({ severity: 'medium', explanation: `Your savings rate is low (${savingsRate.toFixed(1)}%).`, action: 'Aim to save at least 20% of your income for future security.' });
  }

  if (subExpenses > income * 0.05) {
    alerts.push({ severity: 'medium', explanation: `You are spending >5% of your income on recurring subscriptions.`, action: 'Review your subscriptions and cancel unused ones.' });
  }

  if (netWorth < 0) {
    alerts.push({ severity: 'high', explanation: 'Your total debts exceed your total assets.', action: 'Focus all surplus on paying down high-interest liabilities.' });
  }

  return alerts;
}
