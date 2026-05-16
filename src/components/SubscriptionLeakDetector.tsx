import { UserProfile } from '../types';

export function SubscriptionLeakDetector({ profile }: { profile: UserProfile }) {
    const subs = profile.subscriptions || [];
    if (subs.length === 0) return null;

    const yearlyTotal = subs.reduce((acc, sub) => acc + (sub.billingCycle === 'monthly' ? sub.cost * 12 : sub.cost), 0);
    const monthlyEquivalent = yearlyTotal / 12;
    
    // Simplistic categorizations
    const unusedOrWasteful = subs.filter(s => s.name.toLowerCase().includes('gym') && s.cost > 2000 || s.name.toLowerCase().includes('pro') || s.name.toLowerCase().includes('premium'));

    return (
        <div className="bg-white rounded-[14px] p-5 shadow-[0_4px_14px_rgba(0,0,0,.03)] border-[1.5px] border-gray-100">
            <h4 className="text-[0.7rem] font-bold tracking-[0.1em] uppercase text-gray-400 mb-3">Subscription Leak Detector</h4>
            <div className="flex gap-4 items-center">
                <div className="text-3xl font-serif text-rose-500">₹{yearlyTotal.toLocaleString('en-IN')} <span className="text-xs text-gray-400 font-sans tracking-normal uppercase">/ yr</span></div>
                <div className="text-sm text-gray-500 border-l border-gray-200 pl-4">
                    That's around ₹{Math.round(monthlyEquivalent).toLocaleString('en-IN')} leaking every month.
                </div>
            </div>
            {unusedOrWasteful.length > 0 && (
                <div className="mt-3 text-xs bg-rose-50 text-rose-700 p-2 rounded-lg border border-rose-100">
                    <span className="font-semibold">Potential waste detected:</span> Check {unusedOrWasteful.map(s => s.name).join(', ')}.
                </div>
            )}
        </div>
    );
}
