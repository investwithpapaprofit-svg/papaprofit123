import { UserProfile } from '../types';

export function compareWithLast(profile: UserProfile): string[] {
    if (!profile.history) return [];
    
    const snapshots = profile.history.filter(h => h.metricsSnapshot != null);
    if (snapshots.length < 2) return [];

    const last = snapshots[snapshots.length - 2].metricsSnapshot;
    const current = snapshots[snapshots.length - 1].metricsSnapshot;
    
    if (!last || !current) return [];

    const changes = [];

    // Milestone: Savings Rate Improvement
    if (last.savingsRate !== undefined && current.savingsRate !== undefined) {
      if (current.savingsRate - last.savingsRate >= 5) {
        changes.push(`🎉 **Milestone**: You improved your savings rate by ${(current.savingsRate - last.savingsRate).toFixed(1)}%!`);
      }
    }

    // Milestone: Net Worth
    if (last.netWorth !== undefined && current.netWorth !== undefined) {
      if (current.netWorth > last.netWorth && Math.floor(current.netWorth / 500000) > Math.floor(last.netWorth / 500000)) {
         changes.push(`🎉 **Milestone**: Your net worth crossed ₹${((Math.floor(current.netWorth / 500000)*500000)/100000).toFixed(1)}L! Keep it up.`);
      }
    }

    // Debt reduction
    if (last.totalLiabilities !== undefined && current.totalLiabilities !== undefined && last.totalLiabilities > 0) {
      if (current.totalLiabilities < last.totalLiabilities) {
         const paidOff = last.totalLiabilities - current.totalLiabilities;
         changes.push(`👏 **Progress**: You've paid off ₹${paidOff.toLocaleString('en-IN')} in debt.`);
      }
    }

    // Goal close to completion
    if (profile.goals && profile.goals.length > 0) {
        for (const goal of profile.goals) {
            if (goal.target > 0 && goal.saved > 0) {
                const pct = goal.saved / goal.target;
                if (pct >= 0.75 && pct < 1) { // We can't really compare properly with history for individual goals easily without complex logic, so we just check static state
                    // We only want to notify once, but we can just add a nudge
                }
            }
        }
    }

    return changes;
}
