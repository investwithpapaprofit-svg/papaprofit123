import { UserProfile } from '../types';
import { finance } from '../finance';

interface SidebarProps {
  profile: UserProfile;
  setShowPremiumModal: (s: boolean) => void;
}

export function Sidebar({ profile, setShowPremiumModal }: SidebarProps) {
  const fhsScore = profile.metrics.financialHealthScore;
  const fhsInfo = finance.fhsLabel(fhsScore);
  const nw = profile.metrics.netWorth;
  const surplus = profile.metrics.monthlyCashFlow;
  const sr = profile.metrics.savingsRate;
  const dr = profile.metrics.debtToIncomeRatio;
  const metricsInsights = profile.insights || [];

  const fmt = (n: number) => {
    if (!n || isNaN(n)) return '₹0';
    const abs = Math.round(Math.abs(n));
    const sign = n < 0 ? '-' : '';
    if (abs >= 10000000) return sign + '₹' + (abs / 10000000).toFixed(2) + ' Cr';
    if (abs >= 100000) return sign + '₹' + (abs / 100000).toFixed(2) + ' L';
    return sign + '₹' + abs.toLocaleString('en-IN');
  };

  return (
    <div className="sidebar">
      <div className="sidebar-section">
        <div className="sidebar-title">Financial Health Score</div>
        <div className="fhs-circle-wrap">
          <div className={`fhs-circle ${fhsInfo.cls}`}>
            <div className="fhs-num">{fhsScore !== null ? fhsScore : '--'}</div>
            <div className="fhs-label">/ 100</div>
          </div>
          <div className="fhs-desc">{fhsInfo.label || 'Chat to get your score'}</div>
        </div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-title">Key Metrics</div>
        <div className="metric-card">
          <div className="metric-label">Net Worth</div>
          <div className={`metric-value ${nw >= 0 ? 'green' : 'red'}`} title={fmt(nw)}>{fhsScore !== null ? fmt(nw) : '--'}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Monthly Surplus</div>
          <div className={`metric-value ${surplus >= 0 ? 'green' : 'red'}`} title={fmt(surplus)}>{finance.totalIncome(profile) > 0 ? fmt(surplus) : '--'}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Savings Rate</div>
          <div className={`metric-value ${sr >= 20 ? 'green' : sr >= 10 ? 'amber' : 'red'}`} title={`${sr.toFixed(2)}%`}>{finance.totalIncome(profile) > 0 ? `${sr.toFixed(1)}%` : '--'}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Debt Ratio</div>
          <div className={`metric-value ${(dr * 100) <= 30 ? 'green' : (dr * 100) <= 50 ? 'amber' : 'red'}`} title={`${(dr * 100).toFixed(2)}%`}>{finance.totalIncome(profile) > 0 ? `${(dr * 100).toFixed(1)}%` : '--'}</div>
        </div>
      </div>

      {(profile.goals || []).length > 0 && (
        <div className="sidebar-section">
          <div className="sidebar-title">Goals</div>
          {(profile.goals || []).map((g, i) => {
            const monthly = finance.goalMonthlyNeeded(g);
            const pct = g.target > 0 ? Math.round((g.saved / g.target) * 100) : 0;
            return (
              <div key={i} className="goal-card">
                <div className="goal-name">{g.name}</div>
                <div className="goal-progress"><div className="goal-progress-fill" style={{ width: `${pct}%` }}></div></div>
                <div className="goal-detail">{g.target > 0 ? `${fmt(g.target)} target` : 'Set a target amount'} {monthly > 0 ? `· Save ${fmt(monthly)}/mo` : ''}</div>
              </div>
            );
          })}
        </div>
      )}

      <div className="sidebar-section">
        <div className="sidebar-title">Insights</div>
        <div>
          {metricsInsights.length > 0 ? metricsInsights.map((n, i) => <div key={i} className="nudge"><span className="nudge-icon">💡</span> {n.title}</div>) : <div style={{ fontSize: '13px', color: '#aaa', padding: '4px' }}>Chat to unlock insights</div>}
        </div>
      </div>

      <div className="premium-lock">
        <p>🔒 Advanced analytics, tax optimisation & investment tracking</p>
        <button className="premium-btn" onClick={() => setShowPremiumModal(true)}>Upgrade to Pro</button>
      </div>
    </div>
  );
}
