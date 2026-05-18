import { useMemo } from 'react';
import { UserProfile } from '../types';

export function MilestoneCelebration({ profile }: { profile: UserProfile }) {
  const milestones = useMemo(() => {
    const alerts: { icon: string; text: string; color: string }[] = [];
    
    // Streaks
    const history = profile.history || [];
    let consecutiveSavings = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].metricsSnapshot && history[i].metricsSnapshot!.savingsRate > 0) {
        consecutiveSavings++;
      } else {
        break;
      }
    }

    if (consecutiveSavings >= 3) {
      alerts.push({
        icon: '🔥',
        text: `${consecutiveSavings}-month savings streak!`,
        color: 'from-orange-400 to-red-500'
      });
    }

    // Net Worth Milestone
    const nw = profile.metrics?.netWorth || 0;
    if (nw >= 10000000) alerts.push({ icon: '🎯', text: '₹1Cr+ Net Worth Club!', color: 'from-blue-500 to-indigo-600' });
    else if (nw >= 5000000) alerts.push({ icon: '🎯', text: 'Half Crore Net Worth!', color: 'from-blue-500 to-indigo-600' });
    else if (nw >= 1000000) alerts.push({ icon: '🎯', text: '₹10L Net Worth milestone!', color: 'from-blue-500 to-indigo-600' });
    else if (nw >= 100000) alerts.push({ icon: '🎯', text: 'First ₹1L Net Worth!', color: 'from-blue-500 to-indigo-600' });

    // Portfolio Milestone
    const portfolioVal = (profile.portfolio || []).reduce((s, a) => s + ((a.currentPrice || a.averageBuyPrice) * a.quantity), 0);
    if (portfolioVal > 100000 && portfolioVal < 500000) alerts.push({ icon: '📈', text: 'First ₹1L invested!', color: 'from-emerald-400 to-emerald-600' });
    else if (portfolioVal >= 500000) alerts.push({ icon: '📈', text: '₹5L+ invested!', color: 'from-emerald-400 to-emerald-600' });

    // Emergency Fund
    const efRunway = profile.metrics?.emergencyFundRunwayMonths || 0;
    if (efRunway >= 6) {
      alerts.push({
        icon: '🛡️',
        text: 'Emergency fund crossed 6 months',
        color: 'from-slate-600 to-slate-800'
      });
    }

    // Return top 3 milestones only to avoid clutter
    return alerts.slice(0, 3);
  }, [profile]);

  if (milestones.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {milestones.map((m, i) => (
        <div key={i} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r text-white text-[10px] font-bold tracking-wide uppercase shadow-sm ${m.color}`}>
          <span className="text-sm">{m.icon}</span>
          <span>{m.text}</span>
        </div>
      ))}
    </div>
  );
}
