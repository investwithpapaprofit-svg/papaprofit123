import { UserProfile } from '../types';

export function compareWithLast(profile: UserProfile): string[] {
    if (!profile.history) return [];
    
    const snapshots = profile.history.filter(h => h.metricsSnapshot != null);
    if (snapshots.length < 2) return [];

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
}
