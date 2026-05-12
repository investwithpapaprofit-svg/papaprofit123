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

  const fmt = (n: number) => {
    if (!n || isNaN(n)) return '₹0';
    const abs = Math.round(Math.abs(n));
    const sign = n < 0 ? '-' : '';
    if (abs >= 10000000) return sign + '₹' + (abs / 10000000).toFixed(2) + 'Cr';
    if (abs >= 100000) return sign + '₹' + (abs / 100000).toFixed(1) + 'L';
    if (abs >= 1000) return sign + '₹' + (abs / 1000).toFixed(0) + 'K';
    return sign + '₹' + abs.toLocaleString('en-IN');
  };

  const fhsPct = fhsScore || 0;
  const dashoffset = 314 - ((fhsPct / 100) * 314);

  return (
    <div className="sidebar" id="sb2">
      <div className="sidebar-section">
        <div className="sidebar-title">Financial Health Score</div>
        <div className="fhs-circle-wrap group">
          <div className="fhs-circle">
            <svg width="120" height="120" viewBox="0 0 120 120" className="overflow-visible block">
              <defs>
                <linearGradient id="greenGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#22c55e"/><stop offset="100%" stopColor="#00e064"/>
                </linearGradient>
              </defs>
              <circle cx="60" cy="60" r="50" className="fill-none stroke-faint stroke-[7px]" />
              <circle cx="60" cy="60" r="50" className="fill-none stroke-[7px] stroke-[url(#greenGrad)] drop-shadow-[0_0_8px_rgba(34,197,78,.5)] transition-all duration-[1.8s] ease-[cubic-bezier(0.34,1.2,0.64,1)] stroke-linecap-round" strokeDasharray="314.16" strokeDashoffset={dashoffset} transform="rotate(-90 60 60)" />
            </svg>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center mt-[2px]">
              <span className="fhs-num">{fhsScore !== null ? fhsScore : '--'}</span>
              <span className="fhs-label block mt-[-4px]">/ 100</span>
            </div>
          </div>
          <div className="fhs-desc group-hover:text-forest transition-colors">{fhsInfo.label || 'Good Standing'}</div>
        </div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-title">Key Metrics</div>
        <div className="grid grid-cols-2 gap-[7px]">
          <div className="metric-card">
            <div className="metric-label">Net Worth</div>
            <div className={`metric-value ${nw >= 0 ? 'green' : 'red'}`} title={fmt(nw)}>{fhsScore !== null ? fmt(nw) : '--'}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Surplus</div>
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
      </div>

      {(profile.goals || []).length > 0 && (
        <div className="sidebar-section border-0">
          <div className="sidebar-title">Goals</div>
          <div className="flex flex-col gap-[11px]">
            {(profile.goals || []).map((g, i) => {
              const pct = g.target > 0 ? Math.round((g.saved / g.target) * 100) : 0;
              return (
                <div key={i} className="goal-card">
                  <div className="goal-card-top"><span className="goal-name">{g.name}</span><span className="text-[0.65rem] font-bold text-mid">{pct}%</span></div>
                  <div className="goal-progress"><div className="goal-progress-fill" style={{ width: `${pct}%` }}></div></div>
                  <div className="goal-detail">{fmt(g.saved)} saved · {fmt(g.target)} target</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(profile.insights || []).length > 0 && (
        <div className="sidebar-section pt-0 border-0">
          <div className="sidebar-title">AI Insights</div>
          <div>
            {(profile.insights || []).map((n, i) => <div key={i} className="nudge"><span className="nudge-icon font-emoji">💡</span> <span dangerouslySetInnerHTML={{ __html: n.title }} /></div>)}
          </div>
        </div>
      )}

      <div className="premium-lock">
        <p>🔒 Unlock tax AI, unlimited advisor & portfolio X-ray</p>
        <button className="premium-btn text-center flex items-center justify-center gap-2" onClick={() => setShowPremiumModal(true)}>⚡ Go Pro — ₹499/mo</button>
      </div>
    </div>
  );
}
