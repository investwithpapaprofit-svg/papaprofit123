import { useState } from 'react';
import { oldSD, newSD, calculateOldTax, calculateNewTax } from '../utils/tax';

export function TaxHelper() {
  const [salary, setSalary] = useState(1200000);
  const [rent, setRent] = useState(25000);
  const [isMetro, setIsMetro] = useState(true);
  const [pf, setPf] = useState(60000);
  const [elss, setElss] = useState(0);
  const [insurance, setInsurance] = useState(0);
  const [nps, setNps] = useState(0);

  // 80C Limit is 1.5L
  const total80C = pf + elss;
  const remaining80c = Math.max(0, 150000 - total80C);

  // NPS 80CCD(1B) limit is 50k
  const deductionNps = Math.min(50000, nps);

  // HRA Exemption simplified
  const basic = salary * 0.4;
  const hraReceived = basic * 0.5;
  const rentMinus10PercentBasic = Math.max(0, (rent * 12) - (basic * 0.10));
  const percentBasic = isMetro ? basic * 0.5 : basic * 0.4;
  const hraExemption = Math.min(hraReceived, rentMinus10PercentBasic, percentBasic);

  // Section 80D (health insurance)
  const deduction80D = Math.min(25000, insurance);

  // Gross taxable for Old Regime
  const oldRegimeTaxable = Math.max(0, salary - hraExemption - oldSD - Math.min(150000, total80C) - deductionNps - deduction80D);
  
  // New Regime Taxable (only standard deduction allowed)
  const newRegimeTaxable = Math.max(0, salary - newSD);

  const oldTax = Math.round(calculateOldTax(oldRegimeTaxable));
  const newTax = Math.round(calculateNewTax(newRegimeTaxable));

  return (
    <div className="bg-w rounded-[14px] shadow-[0_2px_20px_rgba(6,61,30,.08)] border-[1.5px] border-faint p-6 mb-6">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-bold text-gray-900 font-serif">India Tax Helper</h3>
        <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded-md">FY 2025-26 Rules</span>
      </div>
      <p className="text-gray-500 text-sm mb-6">Estimate your tax liability. <span className="opacity-70 text-[10px]">*Consult a CA for official returns.</span></p>
      
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
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">PF (₹)</label>
              <input type="number" value={pf} onChange={e => setPf(Number(e.target.value))} className="w-full border border-gray-200 rounded-lg p-2 bg-gray-50 text-sm focus:ring-2 focus:ring-lime" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">ELSS (₹)</label>
              <input type="number" value={elss} onChange={e => setElss(Number(e.target.value))} className="w-full border border-gray-200 rounded-lg p-2 bg-gray-50 text-sm focus:ring-2 focus:ring-lime" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">NPS (₹)</label>
              <input type="number" value={nps} onChange={e => setNps(Number(e.target.value))} className="w-full border border-gray-200 rounded-lg p-2 bg-gray-50 text-sm focus:ring-2 focus:ring-lime text-[11px]" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Health (₹)</label>
              <input type="number" value={insurance} onChange={e => setInsurance(Number(e.target.value))} className="w-full border border-gray-200 rounded-lg p-2 bg-gray-50 text-sm focus:ring-2 focus:ring-lime" />
            </div>
          </div>
          {remaining80c > 0 && (
            <div className="bg-lime/20 text-forest p-3 rounded-lg text-xs font-medium border border-[#d1e8d7]">
              💡 You have ₹{remaining80c.toLocaleString('en-IN')} remaining limit in 80C. 
            </div>
          )}
          {newTax < oldTax && remaining80c > 0 && (
             <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-xs font-medium border border-blue-100">
               💡 With more 80C, 80D, and NPS investments, the Old Regime might become better.
             </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex-1 bg-gray-50 border border-gray-100 rounded-xl p-5 relative overflow-hidden">
             <div className="flex justify-between items-center mb-4">
                <span className="text-gray-500 font-bold text-xs uppercase tracking-widest">New Regime (FY25-26)</span>
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
             <p className="text-[10px] opacity-80 mb-1">Taxable Income: ₹{oldRegimeTaxable.toLocaleString('en-IN')}</p>
             <p className="text-[10px] opacity-60">HRA Exemption: ₹{Math.round(hraExemption).toLocaleString('en-IN')}</p>
             <p className="text-[10px] opacity-60">SD + 80C + 80D + 80CCD: ₹{(oldSD + Math.min(150000, total80C) + deductionNps + deduction80D).toLocaleString('en-IN')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
