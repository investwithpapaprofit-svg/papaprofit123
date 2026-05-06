import { UserProfile, Insight, FinancialGoal } from './types';

export const finance = {
  totalAssets(profile: UserProfile): number {
    const assetsTotal = profile.assets.reduce((sum, a) => sum + (a.value || 0), 0);
    const portfolioTotal = profile.portfolio.reduce((sum, p) => sum + (p.marketValue || p.currentPrice || p.averageBuyPrice || 0) * p.quantity, 0);
    return assetsTotal + portfolioTotal;
  },

  totalLiabilities(profile: UserProfile): number {
    return profile.loans.reduce((sum, l) => sum + (l.amount || 0), 0);
  },

  totalEMI(profile: UserProfile): number {
    return profile.loans.reduce((sum, l) => sum + (l.emi || 0), 0);
  },

  totalIncome(profile: UserProfile): number {
    return profile.income.reduce((sum, i) => sum + (i.value || 0), 0);
  },

  totalExpenses(profile: UserProfile): number {
    const defaultExpenses = profile.expenses.reduce((sum, e) => sum + (e.value || 0), 0);
    const subscriptionExpenses = profile.subscriptions.reduce((sum, s) => {
      let monthly = s.cost;
      if (s.billingCycle === 'yearly') monthly /= 12;
      return sum + (monthly || 0);
    }, 0);
    return defaultExpenses + subscriptionExpenses;
  },

  netWorth(profile: UserProfile): number {
    return this.totalAssets(profile) - this.totalLiabilities(profile);
  },

  surplus(profile: UserProfile): number {
    return this.totalIncome(profile) - this.totalExpenses(profile) - this.totalEMI(profile);
  },

  savingsRate(profile: UserProfile): number {
    const income = this.totalIncome(profile);
    if (!income) return 0;
    return (this.surplus(profile) / income) * 100;
  },

  debtRatio(profile: UserProfile): number {
    const income = this.totalIncome(profile);
    if (!income) return 0;
    return this.totalLiabilities(profile) / (income * 12); // Total debt to annual income
  },

  monthlyDebtToIncomeRatio(profile: UserProfile): number {
    const income = this.totalIncome(profile);
    if (!income) return 0;
    return this.totalEMI(profile) / income; // EMI to monthly income
  },

  emergencyFundRunwayMonths(profile: UserProfile): number {
    const monthlyBurnRate = this.totalExpenses(profile) + this.totalEMI(profile);
    if (!monthlyBurnRate) return 0;
    const liquidCash = profile.assets.filter(a => a.type === 'cash').reduce((sum, a) => sum + a.value, 0);
    return liquidCash / monthlyBurnRate;
  },

  fhs(profile: UserProfile): number {
    const income = this.totalIncome(profile);
    if (!income) return 0;
    let score = 0;

    // 1. Savings Rate (Max 20 points)
    const sr = this.savingsRate(profile);
    if (sr >= 30) score += 20;
    else if (sr >= 20) score += 16;
    else if (sr >= 10) score += 10;
    else if (sr > 0) score += 5;

    // 2. Debt Management (Debt to Income ratio) (Max 20 points)
    const mDTI = this.monthlyDebtToIncomeRatio(profile);
    if (mDTI === 0) score += 20;
    else if (mDTI <= 0.20) score += 16;
    else if (mDTI <= 0.35) score += 10;
    else if (mDTI <= 0.50) score += 4;

    // 3. Emergency Fund (Max 15 points)
    const eFund = this.emergencyFundRunwayMonths(profile);
    if (eFund >= 6) score += 15;
    else if (eFund >= 3) score += 10;
    else if (eFund >= 1) score += 5;

    // 4. Investment Consistency (Max 15 points)
    const portfolioTotal = profile.portfolio.reduce((sum, p) => sum + (p.marketValue || p.currentPrice || p.averageBuyPrice || 0) * p.quantity, 0);
    if (portfolioTotal > income * 12) score += 15;
    else if (portfolioTotal > income * 6) score += 10;
    else if (portfolioTotal > income) score += 5;

    // 5. Goal Progress (Max 15 points)
    if (profile.goals.length > 0) {
      const avgProgress = profile.goals.reduce((acc, g) => acc + (g.target > 0 ? Math.min(1, g.saved / g.target) : 0), 0) / profile.goals.length;
      if (avgProgress >= 0.8) score += 15;
      else if (avgProgress >= 0.5) score += 10;
      else if (avgProgress >= 0.2) score += 5;
    }

    // 6. Cash Flow Stability (Expense Ratio) (Max 10 points)
    const expenseRatio = this.totalExpenses(profile) / income;
    if (expenseRatio <= 0.5) score += 10;
    else if (expenseRatio <= 0.7) score += 6;
    else if (expenseRatio <= 0.85) score += 3;

    // 7. Diversification (Max 5 points)
    const assetTypes = new Set(profile.assets.map(a => a.type));
    profile.portfolio.forEach(p => assetTypes.add(p.assetType));
    
    if (assetTypes.size >= 4) score += 5;
    else if (assetTypes.size >= 2) score += 3;
    else if (assetTypes.size === 1) score += 1;

    return Math.max(0, Math.min(100, Math.round(score)));
  },

  fhsLabel(score: number | null): { label: string; cls: string } {
    if (score === null || score === 0) return { label: 'No data yet', cls: '' };
    if (score >= 80) return { label: 'Excellent', cls: 'good' };
    if (score >= 60) return { label: 'Good', cls: 'good' };
    if (score >= 40) return { label: 'Average', cls: 'ok' };
    if (score >= 20) return { label: 'Needs work', cls: 'bad' };
    return { label: 'Critical', cls: 'bad' };
  },

  goalMonthlyNeeded(goal: FinancialGoal): number {
    if (!goal.months || goal.months <= 0) return 0;
    const remaining = (goal.target || 0) - (goal.saved || 0);
    // at 8% annual return conservative
    const r = 0.08 / 12;
    if (r === 0) return remaining / goal.months;
    return remaining * r / (Math.pow(1 + r, goal.months) - 1);
  },
  
  goalProbabilityOfSuccess(goal: FinancialGoal, profile: UserProfile): number {
    const monthlyNeeded = this.goalMonthlyNeeded(goal);
    if(monthlyNeeded <= 0) return 1.0;
    
    const surplus = this.surplus(profile);
    const ratio = surplus / monthlyNeeded;
    
    if (ratio >= 2) return 0.95;
    if (ratio >= 1.5) return 0.85;
    if (ratio >= 1) return 0.70;
    if (ratio >= 0.5) return 0.40;
    return 0.10;
  },

  generateInsights(profile: UserProfile): Insight[] {
    const insights: Insight[] = [];
    const sr = this.savingsRate(profile);
    const mDTI = this.monthlyDebtToIncomeRatio(profile);
    const rw = this.emergencyFundRunwayMonths(profile);
    const surplus = this.surplus(profile);
    const income = this.totalIncome(profile);
    const expenses = this.totalExpenses(profile);

    const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

    if (sr < 10 && income > 0) insights.push({ id: 'sr_low', type: 'warning', title: 'Low Savings Rate', description: `Your savings rate is below 10%. Target is 20%+. With a savings rate of ${sr.toFixed(1)}%, building long-term wealth will be difficult. Try reducing lifestyle expenses.`, priority: 'high' });
    if (sr >= 20) insights.push({ id: 'sr_good', type: 'trend', title: 'Good Savings Habit', description: `Great savings rate! Make sure this ${fmt(surplus)} monthly surplus is being invested, not just sitting in cash.`, priority: 'medium' });
    if (mDTI > 0.4) insights.push({ id: 'debt_high', type: 'warning', title: 'High Debt Burden', description: `Your EMI commitments take up ${(mDTI*100).toFixed(1)}% of your monthly income. Aim to bring this below 35% to reduce financial stress.`, priority: 'high' });
    if (rw < 3 && income > 0) insights.push({ id: 'ef_low', type: 'opportunity', title: 'Emergency Fund Risk', description: `You have less than 3 months of runway. Build up 6 months of expenses (${fmt(expenses * 6)}) in a liquid account.`, priority: 'high' });
    
    const collateral = profile.assets.find(a => a.type === 'property' && a.mortgageable);
    const highDebt = [...profile.loans].sort((a, b) => b.rate - a.rate)[0];
    if (collateral && profile.loans.length > 0 && highDebt && highDebt.rate > 11) {
        insights.push({ id: 'lap_opportunity', type: 'recommendation', title: 'Refinance Debt', description: `Your ${collateral.name} can be used for a Loan Against Property at 8–10%, which is cheaper than your ${highDebt.rate}% loan. This could save you significant interest.`, priority: 'medium' });
    }
    
    if (this.netWorth(profile) < 0) insights.push({ id: 'nw_negative', type: 'warning', title: 'Negative Net Worth', description: 'Your debts exceed your assets. Focus heavily on debt reduction and avoid taking on new loans.', priority: 'high' });
    
    const subExpenses = profile.subscriptions.reduce((s, sub) => s + (sub.billingCycle === 'yearly' ? sub.cost / 12 : sub.cost), 0);
    if(subExpenses > income * 0.05 && income > 0) {
        insights.push({ id: 'sub_warning', type: 'anomaly', title: 'High Subscription Costs', description: `You are spending ${fmt(subExpenses)} monthly on subscriptions, which is >5% of your income. Review your active subscriptions.`, priority: 'medium' });
    }

    if (!profile.personal.riskProfile && income > 0) insights.push({ id: 'risk_missing', type: 'recommendation', title: 'Investment Strategy', description: 'Tell me your risk appetite (conservative / moderate / aggressive) so I can tailor investment advice.', priority: 'low' });

    return insights;
  },
  
  recalculateMetrics(profile: UserProfile): void {
      profile.metrics = {
          netWorth: this.netWorth(profile),
          monthlyCashFlow: this.surplus(profile),
          savingsRate: this.savingsRate(profile),
          debtToIncomeRatio: this.monthlyDebtToIncomeRatio(profile),
          emergencyFundRunwayMonths: this.emergencyFundRunwayMonths(profile),
          financialHealthScore: this.fhs(profile)
      };
      profile.insights = this.generateInsights(profile);
      
      // Update goal probabilities and monthly needed
      profile.goals.forEach(goal => {
          goal.monthlyNeeded = this.goalMonthlyNeeded(goal);
          goal.probabilityOfSuccess = this.goalProbabilityOfSuccess(goal, profile);
      });
  }
};

