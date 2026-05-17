import { useState } from 'react';
import { UserProfile } from '../types';
import { finance } from '../finance';

interface QuickOnboardingProps {
  profile: UserProfile;
  onComplete: (profile: UserProfile) => Promise<void>;
  userName: string;
}

export function QuickOnboarding({ profile, onComplete, userName }: QuickOnboardingProps) {
  const [income, setIncome] = useState('');
  const [expenses, setExpenses] = useState('');
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [age, setAge] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(1);
  const [instantValue, setInstantValue] = useState<{
    savingsRate: number;
    surplus: number;
    fhsEstimate: number;
  } | null>(null);

  const handleNext = () => {
    if (step === 1 && (!income || !expenses)) {
      alert("Please enter income and expenses.");
      return;
    }
    
    if (step === 1) {
      // Calculate instant value
      const inc = parseFloat(income);
      const exp = parseFloat(expenses);
      const surplus = inc - exp;
      const savingsRate = inc > 0 ? (surplus / inc) * 100 : 0;
      
      let fhsEstimate = 50;
      if (savingsRate > 20) fhsEstimate += 15;
      if (savingsRate > 30) fhsEstimate += 10;
      if (surplus < 0) fhsEstimate -= 20;

      setInstantValue({
        savingsRate,
        surplus,
        fhsEstimate
      });
      setStep(2);
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    setIsSubmitting(true);
    try {
      const parsedIncome = parseFloat(income) || 0;
      const parsedExpenses = parseFloat(expenses) || 0;
      const parsedAge = parseInt(age) || undefined;
      const parsedGoalTarget = parseFloat(goalTarget) || 0;

      const newProfile = { ...profile };
      
      if (parsedIncome > 0) {
        newProfile.income = [{ name: 'Primary Income', value: parsedIncome }];
      }
      if (parsedExpenses > 0) {
        newProfile.expenses = [{ name: 'Living Expenses', value: parsedExpenses }];
      }
      if (goalName) {
        newProfile.goals = [{ 
          id: crypto.randomUUID(), 
          name: goalName, 
          target: parsedGoalTarget, 
          saved: 0, 
          months: 12,
          type: 'custom'
        }];
      }
      if (parsedAge) {
        newProfile.personal = { ...newProfile.personal, age: parsedAge, name: userName };
      }

      newProfile.onboardingCompleted = true;
      finance.recalculateMetrics(newProfile);
      
      await onComplete(newProfile);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === 2 && instantValue) {
    return (
      <div className="flex flex-col items-center justify-center p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto w-full">
        <div className="bg-white rounded-3xl shadow-xl w-full p-8 md:p-12 text-center border border-gray-100 relative overflow-hidden">
          
          {/* Subtle Progress Bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gray-100">
            <div className="h-full bg-lime transition-all duration-500 w-full"></div>
          </div>

          <div className="w-20 h-20 bg-lime/20 text-deep rounded-full flex items-center justify-center mx-auto mb-6 mt-2">
            <span className="text-4xl">🚀</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Great start, {userName.split(' ')[0]}!</h2>
          <p className="text-gray-500 mb-8">Here's a quick estimate based on your numbers:</p>
          
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
              <div className="text-sm font-semibold text-gray-500 mb-1">Monthly Surplus</div>
              <div className={`text-2xl md:text-3xl font-bold ${instantValue.surplus >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {instantValue.surplus >= 0 ? '+' : ''}₹{Math.abs(instantValue.surplus).toLocaleString('en-IN')}
              </div>
            </div>
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
              <div className="text-sm font-semibold text-gray-500 mb-1">Savings Rate</div>
              <div className={`text-2xl md:text-3xl font-bold ${instantValue.savingsRate >= 20 ? 'text-green-600' : 'text-orange-500'}`}>
                {instantValue.savingsRate.toFixed(0)}%
              </div>
            </div>
          </div>

          <div className="bg-blue-50 text-blue-800 p-6 rounded-2xl mb-8 text-left text-sm md:text-base border border-blue-100 flex gap-4">
             <div className="text-2xl">💡</div>
             <div>
               <p className="font-semibold mb-1">Quick Insight</p>
               <p className="opacity-90 leading-relaxed">
                 {instantValue.savingsRate >= 20 
                   ? "You're saving a healthy percentage of your income. The next step is optimizing where that money goes—like tax-saving instruments or high-growth SIPs."
                   : "Your savings rate is a bit tight. Let's work on reducing some discretionary expenses to build a stronger safety net."}
               </p>
             </div>
          </div>

          <button 
            onClick={handleComplete}
            disabled={isSubmitting}
            className="w-full bg-deep text-white py-4 rounded-xl font-semibold text-lg hover:bg-gray-800 transition-colors shadow-lg disabled:opacity-50 flex justify-center items-center gap-2"
          >
            {isSubmitting ? 'Setting up...' : 'Start Planning ➔'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-lg mx-auto w-full">
      <div className="bg-white rounded-3xl shadow-xl w-full p-8 md:p-10 border border-gray-100 relative overflow-hidden">
        
        {/* Subtle Progress Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gray-100">
          <div className="h-full bg-lime transition-all duration-500 w-1/2"></div>
        </div>

        <div className="mb-8 text-center mt-2">
          <div className="w-16 h-16 bg-gradient-to-br from-lime to-green-400 text-deep rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-lime/20 rotate-3">
             <span className="text-3xl">🤑</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Welcome to PapaProfit</h2>
          <p className="text-gray-500 text-sm">Let's get a quick snapshot of where you stand.</p>
        </div>

        <div className="space-y-6">
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Montly Income (After Tax)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">₹</span>
              <input 
                type="number" 
                value={income}
                onChange={e => setIncome(e.target.value)}
                placeholder="80000"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-10 pr-4 text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-lime focus:bg-white transition-all"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Monthly Expenses (Approx)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">₹</span>
              <input 
                type="number" 
                value={expenses}
                onChange={e => setExpenses(e.target.value)}
                placeholder="50000"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-10 pr-4 text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-lime focus:bg-white transition-all"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Biggest Financial Goal (Optional)</label>
            <div className="grid grid-cols-[1fr_120px] gap-2">
               <input 
                 type="text" 
                 value={goalName}
                 onChange={e => setGoalName(e.target.value)}
                 placeholder="e.g. Buy a Car, Emergency Fund"
                 className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-gray-900 focus:outline-none focus:ring-2 focus:ring-lime focus:bg-white transition-all"
               />
               <input 
                 type="number" 
                 value={goalTarget}
                 onChange={e => setGoalTarget(e.target.value)}
                 placeholder="Target (₹)"
                 className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-gray-900 focus:outline-none focus:ring-2 focus:ring-lime focus:bg-white transition-all"
               />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Age (Optional)</label>
            <input 
              type="number" 
              value={age}
              onChange={e => setAge(e.target.value)}
              placeholder="30"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-gray-900 focus:outline-none focus:ring-2 focus:ring-lime focus:bg-white transition-all"
            />
          </div>

          <button 
            onClick={handleNext}
            disabled={!income || !expenses}
            className="w-full bg-deep text-white py-4 rounded-xl font-semibold text-lg hover:bg-gray-800 transition-colors shadow-lg disabled:opacity-50 mt-4"
          >
            Calculate Snapshot ➔
          </button>
        </div>
      </div>
    </div>
  );
}
