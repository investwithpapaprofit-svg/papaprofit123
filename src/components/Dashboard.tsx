import { UserProfile } from '../types';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

interface DashboardProps {
  profile: UserProfile;
}

export function Dashboard({ profile }: DashboardProps) {
  const COLORS = ['#1a7a4a', '#29a365', '#d4851a', '#e6a845', '#c0392b'];

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
    <div className="p-4 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-6">
      
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="text-sm text-gray-500 mb-1">Total Net Worth</div>
          <div className="text-3xl font-bold text-gray-900">{fmt(nw)}</div>
        </div>
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="text-sm text-gray-500 mb-1">Monthly Cash Flow</div>
          <div className={`text-3xl font-bold ${surplus >= 0 ? 'text-[#1a7a4a]' : 'text-[#c0392b]'}`}>
            {surplus >= 0 ? '+' : ''}{fmt(surplus)}
          </div>
        </div>
      </div>

      {historyData.length > 1 && (
        <div className="h-48 mt-2">
          <h4 className="text-sm font-semibold text-gray-700 mb-4">Net Worth Journey</h4>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={historyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorNw" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1a7a4a" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#1a7a4a" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
              <YAxis axisLine={false} tickLine={false} tickFormatter={fmtShort} tick={{ fontSize: 12, fill: '#6B7280' }} />
              <RechartsTooltip formatter={(value: any) => [fmt(Number(value) || 0), 'Net Worth']} labelStyle={{ color: '#111827', fontWeight: 600 }} />
              <Area type="monotone" dataKey="netWorth" stroke="#1a7a4a" fillOpacity={1} fill="url(#colorNw)" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {assetData.length > 0 && (
        <div className="mt-4 border-t border-gray-100 pt-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-4">Asset Allocation</h4>
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
