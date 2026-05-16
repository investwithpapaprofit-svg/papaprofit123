import { UserProfile } from '../types';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { useState } from 'react';
import { generateDebtPlan } from '../utils/debtPlanner';
import { simulateGoal } from '../utils/goalSimulator';

import { calculateFHSBreakdown } from '../utils/fhsBreakdown';
import { SubscriptionLeakDetector } from './SubscriptionLeakDetector';
import { EmergencyFundPlanner } from './EmergencyFundPlanner';
import { SIPGrowthSimulator } from './SIPGrowthSimulator';

interface DashboardProps {
  profile: UserProfile;
}

export function Dashboard({ profile }: DashboardProps) {
  const COLORS = ['#22c55e', '#0891b2', '#f59e0b', '#7c3aed', '#6b7280'];
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  const fhsBreakdown = calculateFHSBreakdown(profile);

  const exportPDF = async () => {
    const dashboardElement = document.getElementById('dashboard-export-area');
    if (!dashboardElement) return;

    setIsExporting(true);
    setExportError('');
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf')
      ]);

      const canvas = await html2canvas(dashboardElement, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('PapaProfit_Financial_Report.pdf');
    } catch (err) {
      console.error("Export PDF failed:", err);
      setExportError("Failed to export PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  const nw = profile.metrics.netWorth;
  const surplus = profile.metrics.monthlyCashFlow;
  
  // Data for Net Worth history if available
  const historyData = (profile.history || []).slice(-6)
    .filter(h => h.metricsSnapshot)
    .map(h => ({
      name: new Date(h.timestamp || Date.now()).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
      netWorth: h.metricsSnapshot?.netWorth || 0
    }));
  
  if (historyData.length === 0 || historyData[historyData.length - 1].netWorth !== nw) {
      historyData.push({ name: 'Today', netWorth: nw });
  }

  // Prepare Asset Allocation Data
  const assetData = [];
  const propertyVal = (profile.assets || []).filter(a => a.type === 'property').reduce((s, a) => s + a.value, 0);
  const goldVal = (profile.assets || []).filter(a => a.type === 'gold').reduce((s, a) => s + a.value, 0);
  const cashVal = (profile.assets || []).filter(a => a.type === 'cash').reduce((s, a) => s + a.value, 0);
  const stockVal = (profile.portfolio || []).filter(p => p.assetType === 'stock' || p.assetType === 'mutual_fund' || p.assetType === 'etf')
                    .reduce((s, a) => s + ((a.currentPrice || a.averageBuyPrice) * a.quantity), 0);
  const cryptoVal = (profile.portfolio || []).filter(p => p.assetType === 'crypto')
                    .reduce((s, a) => s + ((a.currentPrice || a.averageBuyPrice) * a.quantity), 0);

  if (propertyVal > 0) assetData.push({ name: 'Real Estate', value: propertyVal });
  if (stockVal > 0) assetData.push({ name: 'Equities', value: stockVal });
  if (cashVal > 0) assetData.push({ name: 'Cash', value: cashVal });
  if (goldVal > 0) assetData.push({ name: 'Gold', value: goldVal });
  if (cryptoVal > 0) assetData.push({ name: 'Crypto', value: cryptoVal });

  const fmt = (n: number) => '₹' + n.toLocaleString('en-IN');
  const fmtShort = (n: number) => {
    if (n >= 10000000) return '₹' + (n / 10000000).toFixed(2) + 'Cr';
    if (n >= 100000) return '₹' + (n / 100000).toFixed(2) + 'L';
    if (n >= 1000) return '₹' + (n / 1000).toFixed(0) + 'K';
    return '₹' + n.toLocaleString('en-IN');
  };

  return (
    <div id="dashboard-export-area" className="p-6 bg-w rounded-[14px] shadow-[0_2px_20px_rgba(6,61,30,.08)] border-[1.5px] border-faint flex flex-col gap-6 relative">
      <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2">
        <button 
          onClick={exportPDF}
          disabled={isExporting}
          className="bg-forest text-white px-4 py-2 rounded-[10px] text-[0.85rem] font-bold shadow hover:bg-deep disabled:opacity-50 transition"
        >
          {isExporting ? 'Exporting...' : 'Export Report'}
        </button>
        {exportError && <div className="text-red-500 text-xs bg-red-50 px-2 py-1 rounded">{exportError}</div>}
      </div>
      
      <div className="grid grid-cols-2 gap-[14px] mt-8">
        <div className="bg-ultramint border-[1.5px] border-faint rounded-[14px] p-5 shadow-[0_4px_14px_rgba(34,197,78,.05)] hover:-translate-y-px transition">
          <div className="text-[0.62rem] font-bold tracking-[0.08em] uppercase text-ghost mb-2">Total Net Worth</div>
          <div className="text-3xl font-serif text-forest">{fmt(nw)}</div>
        </div>
        <div className="bg-ultramint border-[1.5px] border-faint rounded-[14px] p-5 shadow-[0_4px_14px_rgba(34,197,78,.05)] hover:-translate-y-px transition">
          <div className="text-[0.62rem] font-bold tracking-[0.08em] uppercase text-ghost mb-2">Monthly Cash Flow</div>
          <div className={`text-3xl font-serif ${surplus >= 0 ? 'text-[#0891b2]' : 'text-[#dc2626]'}`}>
            {surplus >= 0 ? '+' : ''}{fmt(surplus)}
          </div>
        </div>
      </div>

      <div className="mt-4 border-t-[1.5px] border-faint pt-6">
          <h4 className="text-[0.62rem] font-bold tracking-[0.1em] uppercase text-ghost mb-4">Financial Health Score</h4>
          
          {!profile.onboardingCompleted || !profile.lastUpdated ? (
             <div className="flex items-center gap-4 animate-pulse">
                <div className="w-16 h-16 rounded-full border-4 border-gray-200 border-t-gray-400 animate-spin"></div>
                <div className="flex-1 space-y-2">
                   <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                   <div className="h-3 bg-gray-100 rounded w-1/2"></div>
                </div>
             </div>
          ) : (
            <div className="animate-in fade-in duration-500">
              <div className="flex items-center gap-4">
                  <div className="text-4xl font-serif text-forest">{fhsBreakdown.overallScore} <span className="text-lg text-gray-400">/ 100</span></div>
                  <div className="flex-1 bg-gray-100 rounded-full h-3">
                      <div className={`h-3 rounded-full transition-all duration-1000 ${fhsBreakdown.overallScore >= 80 ? 'bg-green-500' : fhsBreakdown.overallScore >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${fhsBreakdown.overallScore}%` }}></div>
                  </div>
              </div>
              <div className="mt-4 text-sm text-gray-600 bg-gray-50 border border-gray-100 rounded-lg p-4 animate-in slide-in-from-bottom-2 fade-in duration-700">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   {fhsBreakdown.categories.map((cat, idx) => (
                     <div key={idx} className="flex flex-col gap-1">
                       <div className="flex justify-between text-xs font-semibold">
                         <span>{cat.name}</span>
                         <span className={cat.score >= 80 ? 'text-green-600' : cat.score >= 50 ? 'text-yellow-600' : 'text-red-500'}>{cat.score}/100</span>
                       </div>
                       <div className="w-full bg-gray-200 rounded-full h-1.5 opacity-60">
                         <div className={`h-1.5 rounded-full ${cat.score >= 80 ? 'bg-green-500' : cat.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${cat.score}%` }}></div>
                       </div>
                       <div className="text-[0.65rem] text-gray-500 italic leading-tight mt-1">{cat.explanation}</div>
                     </div>
                   ))}
                 </div>
                 {fhsBreakdown.topWeaknesses.length > 0 && (
                   <div className="mt-4 pt-3 border-t border-gray-200">
                     <div className="font-semibold text-gray-800 text-xs mb-2">Fastest paths to improve:</div>
                     <ul className="list-disc pl-4 text-xs space-y-1">
                       {fhsBreakdown.fastestActions.map((action, i) => (
                         <li key={i}>{action}</li>
                       ))}
                     </ul>
                   </div>
                 )}
              </div>
            </div>
          )}
      </div>

      {historyData.length > 1 && (
        <div className="h-[220px] mt-4">
          <h4 className="text-[0.62rem] font-bold tracking-[0.1em] uppercase text-ghost mb-[14px]">Net Worth Journey</h4>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={historyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorNw" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d1e8d7" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#8ab89a', fontFamily: 'Plus Jakarta Sans' }} />
              <YAxis axisLine={false} tickLine={false} tickFormatter={fmtShort} tick={{ fontSize: 12, fill: '#8ab89a', fontFamily: 'Plus Jakarta Sans' }} />
              <RechartsTooltip formatter={(value: any) => [fmt(Number(value) || 0), 'Net Worth']} labelStyle={{ color: '#063d1e', fontWeight: 600, fontFamily: 'Plus Jakarta Sans' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 20px rgba(6,61,30,.2)' }} />
              <Area type="monotone" dataKey="netWorth" stroke="#22c55e" fillOpacity={1} fill="url(#colorNw)" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {assetData.length > 0 && (
        <div className="mt-4 border-t-[1.5px] border-faint pt-6">
          <h4 className="text-[0.62rem] font-bold tracking-[0.1em] uppercase text-ghost mb-4">Asset Allocation</h4>
          <div className="flex items-center justify-center h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={assetData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {assetData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip formatter={(value: any) => fmt(Number(value) || 0)} />
                <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '12px' }}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {profile.goals && profile.goals.length > 0 && (
        <div className="mt-4 border-t border-gray-100 pt-6">
          <h4 className="text-[0.62rem] font-bold tracking-[0.1em] uppercase text-ghost mb-4">Goal Simulator</h4>
          <div className="space-y-4">
            {profile.goals.map((g, i) => {
              const sim = simulateGoal(g, profile);
              const pct = g.target > 0 ? Math.min(100, Math.round((g.saved / g.target) * 100)) : 0;
              return (
                <div key={i} className="flex flex-col gap-2 p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-800 text-sm">{g.name}</span>
                    <span className={`text-[0.65rem] uppercase font-bold tracking-wider px-2 py-1 rounded ${sim.status === 'on-track' || sim.status === 'completed' ? 'bg-green-100 text-green-700' : sim.status === 'aggressive' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>
                       {sim.status.replace('-', ' ')}
                    </span>
                  </div>
                  
                  <div className="flex justify-between text-xs text-gray-600 mt-1">
                    <span>{fmtShort(g.saved)} saved of {fmtShort(g.target)}</span>
                    <span className="font-semibold">{pct}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-[#1a7a4a] h-1.5 rounded-full transition-all duration-1000 ease-out" style={{ width: `${pct}%` }}></div>
                  </div>
                  
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                     <div className="bg-white p-2 rounded border border-gray-100 shadow-sm flex flex-col gap-0.5">
                        <span className="text-[0.6rem] uppercase text-gray-400 font-semibold tracking-wider">SIP Required</span>
                        <span className="font-mono font-medium text-gray-800">{fmt(sim.suggestedMonthlySIP)}/mo</span>
                     </div>
                     <div className="bg-white p-2 rounded border border-gray-100 shadow-sm flex flex-col gap-0.5">
                        <span className="text-[0.6rem] uppercase text-gray-400 font-semibold tracking-wider">Timeline</span>
                        <span className="font-mono font-medium text-gray-800">{sim.monthsToComplete >= 0 ? `${sim.monthsToComplete} months` : 'Stalled'}</span>
                     </div>
                  </div>
                  {sim.status === 'aggressive' && (
                      <div className="text-[0.65rem] text-orange-600 mt-1 italic">
                          Warning: The required SIP is more than 50% of your current monthly surplus.
                      </div>
                  )}
                  {sim.status === 'behind' && sim.monthsToComplete > 0 && g.months && (
                      <div className="text-[0.65rem] text-gray-500 mt-1 italic">
                          At your current stated contribution, this will take {sim.monthsToComplete} months.
                      </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {profile.loans && profile.loans.length > 0 && (() => {
        const debtPlan = generateDebtPlan(profile);
        return (
          <div className="mt-4 border-t border-gray-100 pt-6">
             <h4 className="text-sm font-semibold text-gray-700 mb-4">Debt Payoff Planner</h4>
             <div className="space-y-3">
             {debtPlan.payoffPriority.map((l, i) => (
                 <div key={i} className="p-3 bg-red-50 rounded border border-red-100 flex items-center justify-between">
                     <div>
                         <div className="font-semibold text-red-900 text-sm">{l.name}</div>
                         <div className="text-xs text-red-700 mt-0.5">Amount: {fmt(l.amount)} • Rate: {l.rate}% • EMI: {fmt(l.emi || 0)}</div>
                     </div>
                     {i === 0 && (
                         <div className="bg-red-600 text-white text-[0.65rem] px-2 py-1 rounded font-bold uppercase tracking-wider shadow-sm">Pay First</div>
                     )}
                 </div>
             ))}
             </div>
             <div className="mt-3 text-xs text-gray-500 italic">
                 * {debtPlan.estimatedPayoffGuidance}
             </div>
          </div>
        );
      })()}

      <div className="mt-8 pt-6 border-t-[1.5px] border-faint">
         <h4 className="text-[0.62rem] font-bold tracking-[0.1em] uppercase text-ghost mb-4">Financial Tools</h4>
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SubscriptionLeakDetector profile={profile} />
            <EmergencyFundPlanner profile={profile} />
            <div className="col-span-1 lg:col-span-2">
                <SIPGrowthSimulator />
            </div>
         </div>
      </div>

    </div>
  );
}
