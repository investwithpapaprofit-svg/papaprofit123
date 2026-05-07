import { UserProfile, Insight, FinancialGoal } from './types';

export const finance = {
  totalAssets(profile: UserProfile): number {
    const assetsTotal = (profile.assets || []).reduce((sum, a) => sum + (a.value || 0), 0);
    const portfolioTotal = (profile.portfolio || []).reduce((sum, p) => {
      const val = p.marketValue !== undefined ? p.marketValue : (p.currentPrice || p.averageBuyPrice || 0) * (p.quantity || 1);
      return sum + val;
    }, 0);
    return assetsTotal + portfolioTotal;
  },

  totalLiabilities(profile: UserProfile): number {
    return (profile.loans || []).reduce((sum, l) => sum + (l.amount || 0), 0);
  },

  totalEMI(profile: UserProfile): number {
    return (profile.loans || []).reduce((sum, l) => sum + (l.emi || 0), 0);
  },

  totalIncome(profile: UserProfile): number {
    return (profile.income || []).reduce((sum, i) => sum + (i.value || 0), 0);
  },

  totalExpenses(profile: UserProfile): number {
    const defaultExpenses = (profile.expenses || []).reduce((sum, e) => sum + (e.value || 0), 0);
    const subscriptionExpenses = (profile.subscriptions || []).reduce((sum, s) => {
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
    const liquidCash = (profile.assets || []).filter(a => a.type === 'cash').reduce((sum, a) => sum + a.value, 0);
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
    const portfolioTotal = (profile.portfolio || []).reduce((sum, p) => {
      const val = p.marketValue !== undefined ? p.marketValue : (p.currentPrice || p.averageBuyPrice || 0) * (p.quantity || 1);
      return sum + val;
    }, 0);
    if (portfolioTotal > income * 12) score += 15;
    else if (portfolioTotal > income * 6) score += 10;
    else if (portfolioTotal > income) score += 5;

    // 5. Goal Progress (Max 15 points)
    if (profile.goals && profile.goals.length > 0) {
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
    const assetTypes = new Set<string>((profile.assets || []).map(a => a.type));
    (profile.portfolio || []).forEach(p => assetTypes.add(p.assetType));
    
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

    // 1. Analyze changes vs last snapshot (Memory Engine)
    if (profile.history && profile.history.length > 0) {
      const pastMetrics = profile.history.filter(h => h.metricsSnapshot).sort((a,b) => b.timestamp - a.timestamp)[0]?.metricsSnapshot;
      if (pastMetrics) {
        const nwDiff = this.netWorth(profile) - pastMetrics.netWorth;
        if (nwDiff > 5000) {
            insights.push({ id: 'nw_up', type: 'trend', title: 'Net Worth Growing', description: `Your net worth increased by ${fmt(nwDiff)} recently. Keep it up!`, priority: 'medium' });
        } else if (nwDiff < -5000) {
            insights.push({ id: 'nw_down', type: 'warning', title: 'Net Worth Dropping', description: `Your net worth decreased by ${fmt(Math.abs(nwDiff))}. Let's review your recent expenses.`, priority: 'medium' });
        }
        
        const srDiff = sr - pastMetrics.savingsRate;
        if (srDiff > 5) {
            insights.push({ id: 'sr_up', type: 'trend', title: 'Savings Improved', description: `Your savings rate improved by ${srDiff.toFixed(1)}%. This accelerates your goals!`, priority: 'low' });
        }
      }
    }

    if (sr < 10 && income > 0) insights.push({ id: 'sr_low', type: 'warning', title: 'Low Savings Rate', description: `Your savings rate is below 10%. Target is 20%+. With a savings rate of ${sr.toFixed(1)}%, building long-term wealth will be difficult. Try reducing lifestyle expenses.`, priority: 'high' });
    if (sr >= 20) insights.push({ id: 'sr_good', type: 'trend', title: 'Good Savings Habit', description: `Great savings rate! Make sure this ${fmt(surplus)} monthly surplus is being invested, not just sitting in cash.`, priority: 'medium' });
    if (mDTI > 0.4) insights.push({ id: 'debt_high', type: 'warning', title: 'High Debt Burden', description: `Your EMI commitments take up ${(mDTI*100).toFixed(1)}% of your monthly income. Aim to bring this below 35% to reduce financial stress.`, priority: 'high' });
    if (rw < 3 && income > 0) insights.push({ id: 'ef_low', type: 'opportunity', title: 'Emergency Fund Risk', description: `You have less than 3 months of runway. Build up 6 months of expenses (${fmt(expenses * 6)}) in a liquid account.`, priority: 'high' });
    
    const collateral = (profile.assets || []).find(a => a.type === 'property' && a.mortgageable);
    const highDebt = [...(profile.loans || [])].sort((a, b) => b.rate - a.rate)[0];
    if (collateral && (profile.loans || []).length > 0 && highDebt && highDebt.rate > 11) {
        insights.push({ id: 'lap_opportunity', type: 'recommendation', title: 'Refinance Debt', description: `Your ${collateral.name} can be used for a Loan Against Property at 8–10%, which is cheaper than your ${highDebt.rate}% loan. This could save you significant interest.`, priority: 'medium' });
    }
    
    if (this.netWorth(profile) < 0) insights.push({ id: 'nw_negative', type: 'warning', title: 'Negative Net Worth', description: 'Your debts exceed your assets. Focus heavily on debt reduction and avoid taking on new loans.', priority: 'high' });
    
    const subExpenses = (profile.subscriptions || []).reduce((s, sub) => s + (sub.billingCycle === 'yearly' ? sub.cost / 12 : sub.cost), 0);
    if(subExpenses > income * 0.05 && income > 0) {
        insights.push({ id: 'sub_warning', type: 'anomaly', title: 'High Subscription Costs', description: `You are spending ${fmt(subExpenses)} monthly on subscriptions, which is >5% of your income. Review your active subscriptions.`, priority: 'medium' });
    }

    if (!profile.personal?.riskProfile && income > 0) insights.push({ id: 'risk_missing', type: 'recommendation', title: 'Investment Strategy', description: 'Tell me your risk appetite (conservative / moderate / aggressive) so I can tailor investment advice.', priority: 'low' });

    // Deduplicate and sort by priority
    const priorityScore = { high: 3, medium: 2, low: 1 };
    return insights.sort((a, b) => priorityScore[b.priority] - priorityScore[a.priority]);
  },
  
  getNextBestAction(profile: UserProfile): string {
    const totalLoans = this.totalLiabilities(profile);
    const income = this.totalIncome(profile);
    const savingsRate = this.savingsRate(profile);
    const stockAssets = (profile.portfolio || []).filter(p => ['stock', 'etf', 'mutual_fund'].includes(p.assetType));

    if (income === 0 && !profile.onboardingCompleted) {
        return "Complete your profile setup to get personalized advice.";
    }
    if (income === 0) {
        return "Provide your monthly income so I can give accurate recommendations.";
    }

    if (income > 0 && totalLoans > (income * 12)) {
      return "Focus on reducing your debt aggressively before investing.";
    }

    if (income > 0 && savingsRate < 20) {
      return "Increase your savings rate to at least 20% of your income.";
    }

    if (stockAssets.length === 0) {
      return "Start investing in diversified equity like index funds.";
    }

    return "Optimize your portfolio allocation for better long-term growth.";
  },

  compareWithLast(profile: UserProfile): string[] {
    if (!profile.history) return [];
    
    const snapshots = profile.history.filter(h => h.metricsSnapshot != null);
    if (snapshots.length < 2) return [];

    // The most recent snapshot is snapshots[length-1], previous is snapshots[length-2]
    const last = snapshots[snapshots.length - 2].metricsSnapshot;
    const current = snapshots[snapshots.length - 1].metricsSnapshot;
    
    if (!last || !current) return [];

    const changes = [];

    if (last.totalExpenses !== undefined && current.totalExpenses !== undefined && last.totalExpenses > 0) {
      const diff = ((current.totalExpenses - last.totalExpenses) / last.totalExpenses) * 100;
      if (Math.abs(diff) > 5) {
        changes.push(`Your expenses changed by ${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`);
      }
    }

    if (last.totalIncome !== undefined && current.totalIncome !== undefined && last.totalIncome > 0) {
      const diff = ((current.totalIncome - last.totalIncome) / last.totalIncome) * 100;
      if (Math.abs(diff) > 5) {
        changes.push(`Your income changed by ${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`);
      }
    }

    return changes;
  },

  generateWeeklyReport(profile: UserProfile): string {
    if (!profile.history) return "Not enough data for a weekly report yet.";
    
    const snapshots = profile.history.filter(h => h.metricsSnapshot != null);
    if (snapshots.length < 2) return "Not enough data for a weekly report yet.";

    const first = snapshots[0].metricsSnapshot;
    const last = profile.metrics;

    if (!first || !last) return "Not enough metrics for a report.";

    const netWorthChange = last.netWorth - first.netWorth;
    const fhsChange = last.financialHealthScore - first.financialHealthScore;

    return `Weekly Report:\n\nNet Worth Change: ${netWorthChange >= 0 ? '+' : ''}₹${netWorthChange.toLocaleString('en-IN')}\nFinancial Score Change: ${fhsChange >= 0 ? '+' : ''}${fhsChange}\n\nWeekly insight: You're building financial consistency. Keep going.`;
  },

  recalculateMetrics(profile: UserProfile): void {
      const fhs = this.fhs(profile);
      const metrics = {
          netWorth: this.netWorth(profile),
          monthlyCashFlow: this.surplus(profile),
          savingsRate: this.savingsRate(profile),
          debtToIncomeRatio: this.monthlyDebtToIncomeRatio(profile),
          emergencyFundRunwayMonths: this.emergencyFundRunwayMonths(profile),
          financialHealthScore: fhs,
          totalIncome: this.totalIncome(profile),
          totalExpenses: this.totalExpenses(profile),
          totalLiabilities: this.totalLiabilities(profile)
      };
      
      // Store a snapshot if meaningful change or day has passed
      if (!profile.history) profile.history = [];
      const lastSnapshot = profile.history.filter(h => h.metricsSnapshot).sort((a,b) => b.timestamp - a.timestamp)[0];
      const now = Date.now();
      
      // If no snapshot, or last snapshot was > 24 hours ago, or net worth changed by >1%
      if (!lastSnapshot || 
          (now - lastSnapshot.timestamp > 86400000) ||
          (Math.abs(metrics.netWorth - lastSnapshot.metricsSnapshot!.netWorth) > Math.abs(metrics.netWorth * 0.01))) {
          
          profile.history.push({
              date: new Date().toISOString(),
              timestamp: now,
              type: 'snapshot',
              description: 'Profile snapshot updated',
              metricsSnapshot: Object.assign({}, metrics)
          });
      }

      // Limit history to last 20 entries
      if (profile.history.length > 20) {
          profile.history = profile.history.slice(-20);
      }

      profile.metrics = metrics;
      profile.insights = this.generateInsights(profile);
      
      // Update goal probabilities and monthly needed
      if (profile.goals) {
          profile.goals.forEach(goal => {
              goal.monthlyNeeded = this.goalMonthlyNeeded(goal);
              goal.probabilityOfSuccess = this.goalProbabilityOfSuccess(goal, profile);
          });
      }
  }
};

