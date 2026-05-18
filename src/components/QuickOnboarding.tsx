import { useState, useMemo } from 'react';
import { UserProfile } from '../types';
import { finance } from '../finance';

interface QuickOnboardingProps {
  profile: UserProfile;
  onComplete: (profile: UserProfile) => Promise<void>;
  userName: string;
}

export function QuickOnboarding({ profile, onComplete, userName }: QuickOnboardingProps) {
  const [incomes, setIncomes] = useState([{ id: crypto.randomUUID(), type: 'Salary', amount: '' }]);
  const [expenses, setExpenses] = useState([{ id: crypto.randomUUID(), category: 'Rent', amount: '' }]);
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalTimeline, setGoalTimeline] = useState('3');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalIncome = useMemo(() => incomes.reduce((acc, curr) => acc + (parseFloat(curr.amount as string) || 0), 0), [incomes]);
  const totalExpenses = useMemo(() => expenses.reduce((acc, curr) => acc + (parseFloat(curr.amount as string) || 0), 0), [expenses]);
  const estimatedSavings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? (estimatedSavings / totalIncome) * 100 : 0;

  const handleAddIncome = () => setIncomes([...incomes, { id: crypto.randomUUID(), type: 'Other', amount: '' }]);
  const handleRemoveIncome = (id: string) => setIncomes(incomes.filter(i => i.id !== id));
  
  const handleAddExpense = () => setExpenses([...expenses, { id: crypto.randomUUID(), category: 'Other', amount: '' }]);
  const handleRemoveExpense = (id: string) => setExpenses(expenses.filter(e => e.id !== id));

  const handleComplete = async () => {
    setIsSubmitting(true);
    try {
      const newProfile = { ...profile };
      
      const mappedIncomes = incomes
        .filter(i => parseFloat(i.amount as string) > 0)
        .map(i => ({ name: i.type, value: parseFloat(i.amount as string) }));
      
      if (mappedIncomes.length > 0) {
        newProfile.income = mappedIncomes;
      }

      const mappedExpenses = expenses
        .filter(e => parseFloat(e.amount as string) > 0)
        .map(e => ({ name: e.category, value: parseFloat(e.amount as string), category: e.category }));

      if (mappedExpenses.length > 0) {
        newProfile.expenses = mappedExpenses;
      }

      if (goalName && parseFloat(goalTarget) > 0) {
        newProfile.goals = [{ 
          id: crypto.randomUUID(), 
          name: goalName, 
          target: parseFloat(goalTarget), 
          saved: 0, 
          months: parseInt(goalTimeline) * 12,
          type: 'custom'
        }];
      }

      newProfile.personal = { ...newProfile.personal, name: userName };
      newProfile.onboardingCompleted = true;
      finance.recalculateMetrics(newProfile);
      
      await onComplete(newProfile);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = totalIncome > 0 && totalExpenses > 0;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8 pl-2">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">{profile.preferences?.language === 'hi' ? `PapaProfit में आपका स्वागत है, ${userName.split(' ')[0]} 🚀` : `Welcome to PapaProfit, ${userName.split(' ')[0]} 🚀`}</h2>
        <p className="text-gray-500 text-sm">{profile.preferences?.language === 'hi' ? `आइए एक नज़र डालें कि आप आर्थिक रूप से कहाँ खड़े हैं।` : `Let's get a quick snapshot of where you stand.`}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-8">
        
        {/* LEFT COLUMN - FORM */}
        <div className="space-y-8">
          
          {/* INCOMES */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-bold text-gray-800">{profile.preferences?.language === 'hi' ? 'आय के स्रोत (Income Sources)' : 'Income Sources'}</h3>
                <p className="text-xs text-gray-400 mt-1">{profile.preferences?.language === 'hi' ? 'हम इसका उपयोग बचत क्षमता का अनुमान लगाने के लिए करेंगे।' : 'We’ll use this to estimate savings potential.'}</p>
              </div>
            </div>
            
            <div className="space-y-3">
              {incomes.map((inc) => (
                <div key={inc.id} className="flex gap-2">
                  <select 
                    value={inc.type} 
                    onChange={e => setIncomes(incomes.map(i => i.id === inc.id ? { ...i, type: e.target.value } : i))}
                    className="w-1/3 bg-gray-50 border border-gray-200 rounded-lg py-2.5 px-3 text-sm text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-lime"
                  >
                    <option value="Salary">Salary</option>
                    <option value="Freelance">Freelance</option>
                    <option value="Business">Business</option>
                    <option value="Rental">Rental</option>
                    <option value="Dividends">Dividends</option>
                    <option value="Side Hustle">Side Hustle</option>
                    <option value="Other">Other</option>
                  </select>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm">₹</span>
                    <input 
                      type="number" 
                      value={inc.amount}
                      onChange={e => setIncomes(incomes.map(i => i.id === inc.id ? { ...i, amount: e.target.value } : i))}
                      placeholder="Amount"
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 pl-8 pr-3 text-sm text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-lime"
                    />
                  </div>
                  {incomes.length > 1 && (
                    <button onClick={() => handleRemoveIncome(inc.id)} className="w-10 h-[42px] flex items-center justify-center text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={handleAddIncome} className="text-xs font-bold text-lime-700 mt-4 hover:opacity-80 transition">+ Add Income Source</button>
          </div>

          {/* EXPENSES */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-bold text-gray-800">{profile.preferences?.language === 'hi' ? 'प्रमुख मासिक खर्च (Major Monthly Expenses)' : 'Major Monthly Expenses'}</h3>
                <p className="text-xs text-gray-400 mt-1">{profile.preferences?.language === 'hi' ? 'अनुमानित संख्याएँ बिल्कुल ठीक हैं।' : 'Approximate numbers are completely fine.'}</p>
              </div>
            </div>
            
            <div className="space-y-3">
              {expenses.map((exp) => (
                <div key={exp.id} className="flex gap-2">
                  <select 
                    value={exp.category} 
                    onChange={e => setExpenses(expenses.map(x => x.id === exp.id ? { ...x, category: e.target.value } : x))}
                    className="w-1/3 bg-gray-50 border border-gray-200 rounded-lg py-2.5 px-3 text-sm text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-lime"
                  >
                    <option value="Rent">Rent</option>
                    <option value="EMI">EMI</option>
                    <option value="Food">Food</option>
                    <option value="Transport">Transport</option>
                    <option value="Utilities">Utilities</option>
                    <option value="Insurance">Insurance</option>
                    <option value="Subscriptions">Subscriptions</option>
                    <option value="Shopping">Shopping</option>
                    <option value="Family">Family</option>
                    <option value="Other">Other</option>
                  </select>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm">₹</span>
                    <input 
                      type="number" 
                      value={exp.amount}
                      onChange={e => setExpenses(expenses.map(x => x.id === exp.id ? { ...x, amount: e.target.value } : x))}
                      placeholder="Amount"
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 pl-8 pr-3 text-sm text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-lime"
                    />
                  </div>
                  {expenses.length > 1 && (
                    <button onClick={() => handleRemoveExpense(exp.id)} className="w-10 h-[42px] flex items-center justify-center text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={handleAddExpense} className="text-xs font-bold text-lime-700 mt-4 hover:opacity-80 transition">+ Add Expense</button>
          </div>

          {/* GOALS */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="mb-4">
              <h3 className="font-bold text-gray-800">Biggest Financial Goal (Optional)</h3>
              <p className="text-xs text-gray-400 mt-1">This helps personalize your financial plan.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <input 
                type="text" 
                value={goalName}
                onChange={e => setGoalName(e.target.value)}
                placeholder="e.g. Buy a Car"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 px-4 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-lime"
              />
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm">₹</span>
                <input 
                  type="number" 
                  value={goalTarget}
                  onChange={e => setGoalTarget(e.target.value)}
                  placeholder="Target Amount"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 pl-8 pr-4 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-lime"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">Timeline:</span>
              <select 
                value={goalTimeline} 
                onChange={e => setGoalTimeline(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-lg py-1 px-2 text-xs text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-lime"
              >
                <option value="1">1 year</option>
                <option value="3">3 years</option>
                <option value="5">5 years</option>
                <option value="10">10 years</option>
                <option value="20">20 years</option>
              </select>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN - SNAPSHOT */}
        <div>
          <div className="sticky top-6">
            <div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100 flex flex-col gap-6">
              <div className="text-center pb-4 border-b border-gray-50">
                <div className="w-12 h-12 bg-lime/20 text-deep rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">📸</span>
                </div>
                <h3 className="font-bold text-gray-900">Your Snapshot</h3>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 font-medium">Monthly Income</span>
                  <span className="font-bold text-gray-900">₹{totalIncome.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 font-medium">Monthly Expenses</span>
                  <span className="font-bold text-gray-900">₹{totalExpenses.toLocaleString('en-IN')}</span>
                </div>
                
                <div className="h-px w-full bg-gray-100 my-2"></div>
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 font-semibold text-sm">Est. Savings</span>
                  <span className={`font-bold text-lg ${estimatedSavings >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {estimatedSavings >= 0 ? '+' : ''}₹{estimatedSavings.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-600 font-semibold text-sm">Savings Rate</span>
                  <span className={`font-bold ${savingsRate >= 20 ? 'text-green-600' : savingsRate > 0 ? 'text-orange-500' : 'text-red-500'}`}>
                    {savingsRate.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Smart Warnings */}
              {totalIncome > 0 && totalExpenses > 0 && (
                <div className="mt-2 text-xs font-medium">
                  {estimatedSavings < 0 ? (
                    <div className="bg-red-50 text-red-700 p-3 rounded-lg border border-red-100">
                      You're spending more than you earn. We'll help you get this back on track.
                    </div>
                  ) : savingsRate < 10 ? (
                    <div className="bg-orange-50 text-orange-700 p-3 rounded-lg border border-orange-100">
                      Your savings rate is a bit tight. Small optimizations will help.
                    </div>
                  ) : savingsRate >= 30 ? (
                    <div className="bg-green-50 text-green-700 p-3 rounded-lg border border-green-100">
                       Excellent savings rate! You're in a great position to build wealth.
                    </div>
                  ) : null}
                </div>
              )}

              <button 
                onClick={handleComplete}
                disabled={!isFormValid || isSubmitting}
                className="w-full bg-deep text-white py-3.5 rounded-xl font-bold text-[0.95rem] tracking-wide hover:bg-gray-800 transition-colors shadow-md disabled:opacity-50 mt-2 flex justify-center items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Generating...
                  </>
                ) : 'Generate My Financial Snapshot ➔'}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
