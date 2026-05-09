import { UserProfile } from '../types';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { useState } from 'react';

interface DashboardProps {
  profile: UserProfile;
}

export function Dashboard({ profile }: DashboardProps) {
  const COLORS = ['#22c55e', '#0891b2', '#f59e0b', '#7c3aed', '#6b7280'];
  const [isExporting, setIsExporting] = useState(false);

  const exportPDF = async () => {
    const dashboardElement = document.getElementById('dashboard-export-area');
    if (!dashboardElement) return;

    setIsExporting(true);
    try {
      const canvas = await html2canvas(dashboardElement, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('PapaProfit_Financial_Report.pdf');
    } catch (err) {
      console.error("Export PDF failed:", err);
      alert("Failed to export PDF.");
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
      <div className="absolute top-4 right-4 z-10">
        <button 
          onClick={exportPDF}
          disabled={isExporting}
          className="bg-forest text-white px-4 py-2 rounded-[10px] text-[0.85rem] font-bold shadow hover:bg-deep disabled:opacity-50 transition"
        >
          {isExporting ? 'Exporting...' : 'Export Report'}
        </button>
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
          <h4 className="text-sm font-semibold text-gray-700 mb-4">Goals Progress</h4>
          <div className="space-y-4">
            {profile.goals.map((g, i) => {
              const pct = g.target > 0 ? Math.min(100, Math.round((g.saved / g.target) * 100)) : 0;
              return (
                <div key={i} className="flex flex-col gap-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold text-gray-800">{g.name}</span>
                    <span className="text-gray-500">{fmtShort(g.saved)} / {fmtShort(g.target)} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="bg-[#1a7a4a] h-2 rounded-full transition-all duration-1000 ease-out" style={{ width: `${pct}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
