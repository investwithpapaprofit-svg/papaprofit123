import { useState } from 'react';

export function SIPGrowthSimulator() {
    const [monthlySip, setMonthlySip] = useState(10000);
    const [years, setYears] = useState(10);
    const [returnRate, setReturnRate] = useState(12);
    const [stepUp, setStepUp] = useState(10); // annual step up %

    let currentSip = monthlySip;
    let totalInvested = 0;
    let totalValue = 0;

    const monthlyReturnRate = returnRate / 100 / 12;

    for (let y = 1; y <= years; y++) {
        for (let m = 1; m <= 12; m++) {
            totalInvested += currentSip;
            totalValue = (totalValue + currentSip) * (1 + monthlyReturnRate);
        }
        currentSip = currentSip * (1 + (stepUp / 100)); // apply annual step up
    }

    const fmt = (n: number) => {
        if (n >= 10000000) return '₹' + (n / 10000000).toFixed(2) + 'Cr';
        if (n >= 100000) return '₹' + (n / 100000).toFixed(2) + 'L';
        return '₹' + Math.round(n).toLocaleString('en-IN');
    };

    return (
        <div className="bg-white rounded-[14px] p-5 shadow-[0_4px_14px_rgba(0,0,0,.03)] border-[1.5px] border-gray-100 flex flex-col h-full">
            <h4 className="text-[0.7rem] font-bold tracking-[0.1em] uppercase text-gray-400 mb-4">SIP Growth Simulator</h4>
            
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-6">
                <div className="flex flex-col gap-1">
                    <label className="text-[0.65rem] uppercase font-semibold text-gray-500">Monthly SIP (₹)</label>
                    <input type="range" min="1000" max="100000" step="1000" value={monthlySip} onChange={e => setMonthlySip(Number(e.target.value))} className="accent-forest" />
                    <div className="text-xs font-mono">{monthlySip.toLocaleString('en-IN')}</div>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[0.65rem] uppercase font-semibold text-gray-500">Years ({years}y)</label>
                    <input type="range" min="1" max="40" step="1" value={years} onChange={e => setYears(Number(e.target.value))} className="accent-forest" />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[0.65rem] uppercase font-semibold text-gray-500">Return % ({returnRate}%)</label>
                    <input type="range" min="5" max="25" step="1" value={returnRate} onChange={e => setReturnRate(Number(e.target.value))} className="accent-forest" />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[0.65rem] uppercase font-semibold text-gray-500">Annual Step-Up ({stepUp}%)</label>
                    <input type="range" min="0" max="50" step="1" value={stepUp} onChange={e => setStepUp(Number(e.target.value))} className="accent-forest" />
                </div>
            </div>

            <div className="mt-auto bg-gray-50 p-4 rounded-xl border border-gray-100 grid grid-cols-2 gap-4">
                <div className="flex flex-col">
                    <span className="text-[0.65rem] uppercase font-bold text-gray-400">Total Invested</span>
                    <span className="text-lg font-mono text-gray-700">{fmt(totalInvested)}</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-[0.65rem] uppercase font-bold text-gray-400">Final Corpus</span>
                    <span className="text-2xl font-serif text-forest">{fmt(totalValue)}</span>
                </div>
            </div>
        </div>
    );
}
