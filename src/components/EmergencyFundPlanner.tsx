import { UserProfile } from '../types';
import { finance } from '../finance';

export function EmergencyFundPlanner({ profile }: { profile: UserProfile }) {
    const expenses = finance.totalExpenses(profile) + finance.totalEMI(profile);
    const liquidCash = (profile.assets || []).filter(a => a.type === 'cash').reduce((sum, a) => sum + a.value, 0);

    const target3Months = expenses * 3;
    const target6Months = expenses * 6;

    const runway = expenses > 0 ? (liquidCash / expenses).toFixed(1) : 0;
    
    if (expenses === 0) return null;

    return (
        <div className="bg-white rounded-[14px] p-5 shadow-[0_4px_14px_rgba(0,0,0,.03)] border-[1.5px] border-gray-100">
            <h4 className="text-[0.7rem] font-bold tracking-[0.1em] uppercase text-gray-400 mb-3">Emergency Fund Planner</h4>
            <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col border-r border-gray-100 pr-4">
                        <span className="text-xs text-gray-500 font-semibold mb-1">Current Cash</span>
                        <span className="text-xl font-mono text-gray-800">₹{liquidCash.toLocaleString('en-IN')}</span>
                        <span className="text-xs text-gray-400 mt-1">{runway} months of runway</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs text-gray-500 font-semibold mb-1">6-Month Target</span>
                        <span className="text-xl font-mono text-gray-800">₹{target6Months.toLocaleString('en-IN')}</span>
                        <span className="text-xs text-gray-400 mt-1">Highly recommended buffer</span>
                    </div>
                </div>
                
                {liquidCash < target3Months && (
                    <div className="text-xs bg-yellow-50 p-3 rounded-lg border border-yellow-100 text-yellow-800 leading-relaxed">
                        <span className="font-semibold block mb-1">High Priority:</span> 
                        Your emergency fund covers less than 3 months of expenses (₹{target3Months.toLocaleString('en-IN')}). Redirect all surplus cash here before investing in equities.
                    </div>
                )}
            </div>
        </div>
    );
}
