import { UserProfile } from './types';

export const finance = {
  totalAssets(profile: UserProfile): number {
    const p = profile.assets.property.reduce((s, a) => s + (a.value || 0), 0);
    const o = profile.assets.other.reduce((s, a) => s + (a.value || 0), 0);
    const c = profile.assets.crypto?.reduce((s, a) => s + (a.value || 0), 0) || 0;
    const st = profile.assets.stocks?.reduce((s, a) => s + ((a.currentPrice || a.buyPrice || 0) * (a.quantity || 0)), 0) || 0;
    return p + o + c + st + (profile.assets.gold || 0) + (profile.assets.cash || 0);
  },

  totalLiabilities(profile: UserProfile): number {
    return profile.loans.reduce((s, l) => s + (l.amount || 0), 0);
  },

  totalEMI(profile: UserProfile): number {
    return profile.loans.reduce((s, l) => s + (l.emi || 0), 0);
  },

  netWorth(profile: UserProfile): number {
    return this.totalAssets(profile) - this.totalLiabilities(profile);
  },

  surplus(profile: UserProfile): number {
    return profile.income - profile.expenses - this.totalEMI(profile);
  },

  savingsRate(profile: UserProfile): number {
    if (!profile.income) return 0;
    return (this.surplus(profile) / profile.income) * 100;
  },

  debtRatio(profile: UserProfile): number {
    if (!profile.income) return 0;
    return this.totalLiabilities(profile) / profile.income;
  },

  fhs(profile: UserProfile): number | null {
    if (!profile.income) return null;
    let score = 0;

    // 1. Savings Rate (Max 25 points)
    const sr = this.savingsRate(profile);
    if (sr >= 30) score += 25;
    else if (sr >= 20) score += 20;
    else if (sr >= 10) score += 12;
    else if (sr > 0) score += 5;
    else score += 0;

    // 2. Debt-to-Income Ratio (Max 20 points)
    const dr = this.debtRatio(profile);
    if (dr === 0) score += 20;
    else if (dr <= 2) score += 16;
    else if (dr <= 5) score += 10;
    else if (dr <= 8) score += 4;
    else score += 0;

    // 3. Emergency Fund (Max 15 points)
    const emergencyNeeded = (profile.expenses || 0) * 6;
    if (emergencyNeeded > 0) {
      const efRatio = (profile.assets.cash || 0) / emergencyNeeded;
      if (efRatio >= 1) score += 15;
      else if (efRatio >= 0.5) score += 10;
      else if (efRatio >= 0.25) score += 5;
    } else if (profile.assets.cash > 0) {
      score += 15;
    }

    // 4. Net Worth to Income Ratio (Max 15 points)
    const nw = this.netWorth(profile);
    const nwRatio = nw / (profile.income * 12); // Years of income
    if (nwRatio >= 5) score += 15;
    else if (nwRatio >= 2) score += 10;
    else if (nwRatio >= 0.5) score += 5;
    else if (nwRatio > 0) score += 2;

    // 5. Investment Diversification (Max 10 points)
    let assetClasses = 0;
    if (profile.assets.property.length > 0) assetClasses++;
    if ((profile.assets.gold || 0) > 0) assetClasses++;
    if ((profile.assets.stocks?.length || 0) > 0) assetClasses++;
    if ((profile.assets.crypto?.length || 0) > 0) assetClasses++;
    if (profile.assets.other.length > 0) assetClasses++;
    
    if (assetClasses >= 3) score += 10;
    else if (assetClasses === 2) score += 6;
    else if (assetClasses === 1) score += 3;

    // 6. Goal Progress (Max 10 points)
    if (profile.goals.length > 0) {
      const avgProgress = profile.goals.reduce((acc, g) => acc + (g.target > 0 ? Math.min(1, g.saved / g.target) : 0), 0) / profile.goals.length;
      if (avgProgress >= 0.8) score += 10;
      else if (avgProgress >= 0.5) score += 7;
      else if (avgProgress >= 0.2) score += 4;
      else score += 2; // Bonus for just having goals
    }

    // 7. Spending Habits (Expenses to Income) (Max 5 points)
    const expenseRatio = profile.expenses / profile.income;
    if (expenseRatio <= 0.5) score += 5;
    else if (expenseRatio <= 0.7) score += 3;
    else if (expenseRatio <= 0.85) score += 1;

    return Math.max(0, Math.min(100, Math.round(score)));
  },

  fhsLabel(score: number | null): { label: string; cls: string } {
    if (score === null) return { label: 'No data yet', cls: '' };
    if (score >= 80) return { label: 'Excellent', cls: 'good' };
    if (score >= 60) return { label: 'Good', cls: 'good' };
    if (score >= 40) return { label: 'Average', cls: 'ok' };
    if (score >= 20) return { label: 'Needs work', cls: 'bad' };
    return { label: 'Critical', cls: 'bad' };
  },

  goalMonthlyNeeded(goal: { target: number; saved: number; months: number }): number {
    if (!goal.months || goal.months <= 0) return 0;
    const remaining = (goal.target || 0) - (goal.saved || 0);
    // at 10% annual return
    const r = 0.10 / 12;
    if (r === 0) return remaining / goal.months;
    return remaining * r / (Math.pow(1 + r, goal.months) - 1);
  },

  generateNudges(profile: UserProfile): string[] {
    const nudges: string[] = [];
    const sr = this.savingsRate(profile);
    const dr = this.debtRatio(profile);
    const nw = this.netWorth(profile);
    const surplus = this.surplus(profile);
    const collateral = profile.assets.property.find(a => a.mortgageable);
    const highDebt = [...profile.loans].sort((a, b) => b.rate - a.rate)[0];

    const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

    if (sr < 10 && profile.income > 0) nudges.push('⚠️ Your savings rate is below 10%. Target is 20%+. Try reducing lifestyle expenses.');
    if (sr >= 20) nudges.push('✅ Great savings rate! Make sure this money is being invested, not just sitting in cash.');
    if (dr > 6) nudges.push('🚨 Your debt is ' + dr.toFixed(1) + 'x your monthly income — this is high. Focus on paying off high-interest loans.');
    if (profile.assets.cash < (profile.expenses * 3) && profile.income > 0) nudges.push('⚠️ Emergency fund is low. Build up 6 months of expenses (' + fmt(profile.expenses * 6) + ') in a liquid account.');
    if (surplus > 5000 && profile.assets.cash < profile.expenses * 6) nudges.push('💡 You have surplus of ' + fmt(surplus) + '/month — prioritise emergency fund first.');
    if (collateral && profile.loans.length > 0 && highDebt && highDebt.rate > 11) nudges.push('💡 Your ' + collateral.name + ' can be used for a Loan Against Property at 8–10%, cheaper than your current debt.');
    if (nw < 0) nudges.push('🚨 Net worth is negative. Debts exceed assets — focus on debt reduction.');
    if (profile.goals.length === 0 && profile.income > 0) nudges.push('💡 No goals set. Define a financial goal (e.g., "Save for a car") to get a savings roadmap.');
    if (!profile.riskProfile && profile.income > 0) nudges.push('💡 Tell me your risk appetite (conservative / moderate / aggressive) for investment advice.');

    return nudges.slice(0, 4);
  }
};
