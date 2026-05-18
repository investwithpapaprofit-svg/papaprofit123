import { useState } from 'react';

export function TaxHelper() {
  const [salary, setSalary] = useState(1200000);
  const [rent, setRent] = useState(25000);
  const [isMetro, setIsMetro] = useState(true);
  const [pf, setPf] = useState(60000);
  const [elss, setElss] = useState(0);
  const [insurance, setInsurance] = useState(0);

  // 80C Limit is 1.5L
  const total80C = pf + elss;
  const remaining80c = Math.max(0, 150000 - total80C);

  // HRA Exemption simplified
  // 1. Actual HRA received (Assume 50% of Basic, Basic = 40% of salary roughly)
  const basic = salary * 0.4;
  const hraReceived = basic * 0.5;
  const rentMinus10PercentBasic = Math.max(0, (rent * 12) - (basic * 0.10));
  const percentBasic = isMetro ? basic * 0.5 : basic * 0.4;
  const hraExemption = Math.min(hraReceived, rentMinus10PercentBasic, percentBasic);

  // Standard deduction
  const standardDeduction = 50000;
  
  // Section 80D (health insurance)
  const deduction80D = Math.min(25000, insurance);

  // Gross taxable for Old Regime
  const oldRegimeTaxable = Math.max(0, salary - hraExemption - standardDeduction - Math.min(150000, total80C) - deduction80D);
  
  // New Regime Taxable (only standard deduction allowed up to FY24/25)
  const newRegimeTaxable = Math.max(0, salary - standardDeduction);

  const calculateOldTax = (inc: number) => {
    if (inc <= 500000) return 0; // Rebate
    let tax = 0;
    if (inc > 1000000) {
      tax += (inc - 1000000) * 0.3 + 112500;
    } else if (inc > 500000) {
      tax += (inc - 500000) * 0.2 + 12500;
    }
    return tax;
  };

  const calculateNewTax = (inc: number) => {
    if (inc <= 700000) return 0; // Rebate
    let tax = 0;
    if (inc > 1500000) tax += (inc - 1500000) * 0.3 + 150000;
    else if (inc > 1200000) tax += (inc - 1200000) * 0.2 + 90000;
    else if (inc > 900000) tax += (inc - 900000) * 0.15 + 45000;
    else if (inc > 600000) tax += (inc - 600000) * 0.1 + 15000;
    else if (inc > 300000) tax += (inc - 300000) * 0.05;
    return tax;
  };

  const oldTax = calculateOldTax(oldRegimeTaxable);
  const newTax = calculateNewTax(newRegimeTaxable);

  return (
    <div className="bg-w rounded-[14px] shadow-[0_2px_20px_rgba(6,61,30,.08)] border-[1.5px] border-faint p-6 mb-6">
      <h3 className="text-lg font-bold text-gray-900 mb-2 font-serif">India Tax Helper</h3>
      <p className="text-gray-500 text-sm mb-6">Estimate your tax liability under the Old vs New regime.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Annual Salary (₹)</label>
            <input type="number" value={salary} onChange={e => setSalary(Number(e.target.value))} className="w-full border border-gray-200 rounded-lg p-2 bg-gray-50 text-sm focus:ring-2 focus:ring-lime" />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Monthly Rent (₹)</label>
              <input type="number" value={rent} onChange={e => setRent(Number(e.target.value))} className="w-full border border-gray-200 rounded-lg p-2 bg-gray-50 text-sm focus:ring-2 focus:ring-lime" />
            </div>
            <div className="mt-6 flex items-center gap-2">
              <input type="checkbox" checked={isMetro} onChange={e => setIsMetro(e.target.checked)} id="metro" />
              <label htmlFor="metro" className="text-sm text-gray-700 font-medium">Metro City</label>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">PF (₹)</label>
              <input type="number" value={pf} onChange={e => setPf(Number(e.target.value))} className="w-full border border-gray-200 rounded-lg p-2 bg-gray-50 text-sm focus:ring-2 focus:ring-lime" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">ELSS (₹)</label>
              <input type="number" value={elss} onChange={e => setElss(Number(e.target.value))} className="w-full border border-gray-200 rounded-lg p-2 bg-gray-50 text-sm focus:ring-2 focus:ring-lime" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Health (₹)</label>
              <input type="number" value={insurance} onChange={e => setInsurance(Number(e.target.value))} className="w-full border border-gray-200 rounded-lg p-2 bg-gray-50 text-sm focus:ring-2 focus:ring-lime" />
            </div>
          </div>
          {remaining80c > 0 && (
            <div className="bg-lime/20 text-forest p-3 rounded-lg text-xs font-medium border border-[#d1e8d7]">
              💡 You have ₹{remaining80c.toLocaleString('en-IN')} remaining in your 80C limit. Consider adding more to ELSS or PPF.
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex-1 bg-gray-50 border border-gray-100 rounded-xl p-5 relative overflow-hidden">
             <div className="flex justify-between items-center mb-4">
                <span className="text-gray-500 font-bold text-xs uppercase tracking-widest">New Regime</span>
                {newTax <= oldTax && <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full">Winner</span>}
             </div>
             <p className="text-3xl font-black text-gray-900 border-b border-gray-200 pb-4 mb-4">₹{newTax.toLocaleString('en-IN')}</p>
             <p className="text-xs text-gray-500">Taxable Income: ₹{newRegimeTaxable.toLocaleString('en-IN')}</p>
          </div>
          <div className="flex-1 bg-[#1a7a4a] text-white rounded-xl p-5 relative overflow-hidden shadow-md">
             <div className="flex justify-between items-center mb-4">
                <span className="opacity-80 font-bold text-xs uppercase tracking-widest">Old Regime</span>
                {oldTax < newTax && <span className="bg-lime text-deep text-[10px] font-bold px-2 py-0.5 rounded-full">Winner</span>}
             </div>
             <p className="text-3xl font-black border-b border-white/20 pb-4 mb-4">₹{oldTax.toLocaleString('en-IN')}</p>
             <p className="text-xs opacity-80 mb-1">Taxable Income: ₹{oldRegimeTaxable.toLocaleString('en-IN')}</p>
             <p className="text-[10px] opacity-60">HRA Exemption: ₹{Math.round(hraExemption).toLocaleString('en-IN')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
