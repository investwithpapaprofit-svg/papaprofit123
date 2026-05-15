import { getNextBestAction } from './nextBestAction';

export interface WeeklyReport {
  netWorthChange: string;
  savingsRateChange: string;
  biggestExpenseIssue: string;
  debtChange: string;
  topImprovement: string;
  recommendedNextStep: string;
  isAvailable: boolean;
}

export function generateWeeklyReport(profile: import('../types').UserProfile): WeeklyReport {
  const result: WeeklyReport = {
    netWorthChange: 'N/A',
    savingsRateChange: 'N/A',
    biggestExpenseIssue: 'None found',
    debtChange: 'N/A',
    topImprovement: 'Keep organizing your finances',
    recommendedNextStep: 'Add more details to your profile.',
    isAvailable: false,
  };

  if (!profile.history) return result;
  const snapshots = profile.history.filter(h => h.metricsSnapshot != null);
  if (snapshots.length < 2) return result;

  result.isAvailable = true;

  const first = snapshots[0].metricsSnapshot;
  const last = profile.metrics;

  if (!first || !last) return result;

  const fmtDiff = (n: number) => n >= 0 ? '+₹' + n.toLocaleString('en-IN') : '-₹' + Math.abs(n).toLocaleString('en-IN');

  const nwDiff = last.netWorth - first.netWorth;
  result.netWorthChange = fmtDiff(nwDiff);

  const srDiff = last.savingsRate - first.savingsRate;
  result.savingsRateChange = `${srDiff >= 0 ? '+' : ''}${srDiff.toFixed(1)}%`;

  const debtDiff = (last.totalLiabilities || 0) - (first.totalLiabilities || 0);
  result.debtChange = fmtDiff(debtDiff);

  const subExpenses = (profile.subscriptions || []).reduce((s, sub) => s + (sub.billingCycle === 'yearly' ? sub.cost / 12 : sub.cost), 0);
  if (subExpenses > (last.totalIncome || 0) * 0.05) {
    result.biggestExpenseIssue = 'High subscription spending';
  } else if ((last.totalExpenses || 0) > (last.totalIncome || 0) * 0.7) {
    result.biggestExpenseIssue = 'Overall expenses are very high';
  } else {
    result.biggestExpenseIssue = 'Expenses look healthy';
  }

  if (nwDiff > 0) result.topImprovement = 'Growing your Net Worth';
  else if (debtDiff < 0) result.topImprovement = 'Paying down debt';
  else if (srDiff > 0) result.topImprovement = 'Improving your Savings Rate';
  else result.topImprovement = 'Consistency in tracking';

  const nextAction = getNextBestAction(profile);
  result.recommendedNextStep = nextAction && typeof nextAction === 'string' ? nextAction : nextAction?.title || 'Review your goals';

  return result;
}
