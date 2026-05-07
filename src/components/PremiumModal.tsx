interface PremiumModalProps {
  onUpgrade: () => void;
  onClose: () => void;
  user: any; // Firebase user
}

export function PremiumModal({ onUpgrade, onClose, user }: PremiumModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 shadow-2xl">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
        <div className="text-center mb-6">
          <div className="mx-auto w-12 h-12 bg-[#1a7a4a]/10 rounded-full flex items-center justify-center mb-4">
            <span className="text-2xl">⚡️</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">Upgrade to Pro</h3>
          <p className="text-sm text-gray-600">Unlock your full financial potential with advanced tools and insights.</p>
        </div>
        
        <div className="space-y-4 mb-8">
          <div className="flex items-center gap-3">
            <span className="text-[#1a7a4a]">✓</span>
            <span className="text-sm text-gray-700">Real-time Stock Tracking</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[#1a7a4a]">✓</span>
            <span className="text-sm text-gray-700">Tax Optimization AI</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[#1a7a4a]">✓</span>
            <span className="text-sm text-gray-700">Custom Scenario Modeling</span>
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 mb-6">
          <div className="flex justify-between items-center mb-1">
            <span className="font-medium text-gray-900">Pro Plan</span>
            <span className="font-bold text-xl text-gray-900">₹499<span className="text-sm font-normal text-gray-500">/mo</span></span>
          </div>
          <p className="text-xs text-gray-500">Cancel anytime. Billed monthly.</p>
        </div>
        
        <button 
          onClick={async () => {
             if (!user) return;
             try {
               const idToken = await user.getIdToken();
               const res = await fetch('/api/premium/upgrade', {
                 method: 'POST',
                 headers: { 
                   'Content-Type': 'application/json',
                   'Authorization': `Bearer ${idToken}`
                 }
               });
               if (res.ok) {
                 onUpgrade();
               } else {
                 alert("Failed to upgrade. Please try again.");
               }
             } catch (e) {
               console.error("Upgrade failed:", e);
               alert("Upgrade failed. Please try again.");
             }
          }}
          className="w-full bg-[#1a7a4a] text-white py-3 rounded-xl font-semibold hover:bg-[#145c37] transition-colors"
        >
          Start Pro Trial
        </button>
      </div>
    </div>
  );
}
