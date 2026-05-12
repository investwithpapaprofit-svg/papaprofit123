import { useState, useEffect, useRef } from 'react';
import { auth, db } from './firebase';
import { finance } from './finance';
import { Portfolio } from './components/Portfolio';
import DOMPurify from 'dompurify';
import { Suspense, lazy } from 'react';
import { useAuth } from './hooks/useAuth';
import { useProfile } from './hooks/useProfile';
import { useChat } from './hooks/useChat';
import { LoginScreen } from './components/LoginScreen';
import { ChatWindow } from './components/ChatWindow';
import { ChatInput } from './components/ChatInput';

import { FinancialSourceEditor } from './components/FinancialSourceEditor';
const Dashboard = lazy(() => import('./components/Dashboard').then(module => ({ default: module.Dashboard })));
const Sidebar = lazy(() => import('./components/Sidebar').then(module => ({ default: module.Sidebar })));
const PremiumModal = lazy(() => import('./components/PremiumModal').then(module => ({ default: module.PremiumModal })));

export default function App() {
  const { user, loginError, handleLogin } = useAuth();
  const { profile, setProfile, loadProfile, saveProfile } = useProfile(user);
  const { chatHistory, setChatHistory, isTyping, input, setInput, handleSend } = useChat(profile, saveProfile);

  const [showProfile, setShowProfile] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user, loadProfile]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [chatHistory, isTyping]);

  const formatAIResponse = (text: string) => {
    if (!text) return '';
    
    // 1. Escape HTML to prevent XSS
    const escapeHTML = (str: string) => {
      const p = document.createElement('p');
      p.textContent = str;
      return p.innerHTML;
    };

    const escapedText = escapeHTML(text);

    // 2. Apply custom formatting
    const html = escapedText
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '<br/><br/>')
      .replace(/\n/g, '<br/>')
      .replace(/### (.*?)/g, '<span class="section-head">$1</span>')
      .replace(/## (.*?)/g, '<span class="section-head">$1</span>')
      .replace(/# (.*?)/g, '<span class="section-head">$1</span>')
      .replace(/• (.*?)/g, '&bull; $1')
      .replace(/- (.*?)/g, '&bull; $1');
    
    // 3. Sanitize the final HTML
    return DOMPurify.sanitize(html);
  };

  const fmt = (n: number) => {
    if (!n || isNaN(n)) return '₹0';
    const abs = Math.round(Math.abs(n));
    const sign = n < 0 ? '-' : '';
    if (abs >= 10000000) return sign + '₹' + (abs / 10000000).toFixed(2) + ' Cr';
    if (abs >= 100000) return sign + '₹' + (abs / 100000).toFixed(2) + ' L';
    return sign + '₹' + abs.toLocaleString('en-IN');
  };

  const onSendWrapper = async (text: string = input) => {
    setShowSuggestions(false);
    await handleSend(text);
  };

  if (!user) {
    return <LoginScreen onLogin={handleLogin} error={loginError || ""} />;
  }

  const fhsScore = profile.metrics.financialHealthScore;
  const fhsInfo = finance.fhsLabel(fhsScore);

  return (
    <div id="appShell">
      {import.meta.env.DEV && (
        <div className="fixed bottom-4 left-4 bg-gray-900 text-white text-[10px] p-2 rounded z-[100] flex flex-col gap-1 shadow-lg opacity-80 hover:opacity-100 transition-opacity">
          <div className="font-bold border-b border-gray-700 pb-1 mb-1">PapaProfit Config</div>
          <div>{import.meta.env.VITE_FIREBASE_API_KEY ? '✅ VITE_FIREBASE_API_KEY' : '❌ VITE_FIREBASE_API_KEY Missing'}</div>
          <div>{auth && auth.app ? '✅ Firebase loaded' : '❌ Firebase failed'}</div>
          <div>{navigator.onLine ? '✅ Network online' : '❌ Network offline'}</div>
        </div>
      )}
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-black text-center text-sm py-2 z-50">
          You are offline. Changes will sync automatically when reconnected.
        </div>
      )}
      <div className="topbar">
        <div className="topbar-logo"><span className="w-2 h-2 rounded-full bg-lime shadow-[0_0_8px_var(--color-lime)] animate-pulse"></span> PapaProfit</div>
        <div className="topbar-right">
          <button 
            onClick={() => { setShowDashboard(!showDashboard); setShowProfile(false); }}
            className={`flex items-center gap-[6px] px-[14px] py-[6px] rounded-full border-[1.5px] transition-all text-[0.73rem] font-semibold cursor-pointer ${showDashboard ? 'bg-xmint border-lime text-deep shadow-[0_0_0_3px_rgba(34,197,78,.1)]' : 'bg-ultramint border-faint text-muted hover:border-lime hover:text-deep'}`}
          >
            📊 {showDashboard ? 'Back to Chat' : 'Dashboard'}
          </button>
          
          <div className="fhs-badge" onClick={() => { setShowProfile(!showProfile); setShowDashboard(false); }}>
            <span className="w-1.5 h-1.5 rounded-full bg-lime shadow-[0_0_6px_var(--color-lime)] animate-pulse"></span>
            <span>FHS <strong>{fhsScore !== null ? fhsScore : '--'}</strong></span>
          </div>
          
          {profile.isPremium && (
            <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded border border-amber-200 uppercase tracking-wider">
              PRO
            </span>
          )}

          <div className="relative">
            <div 
              className="avatar cursor-pointer" 
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              {user.displayName?.charAt(0).toUpperCase()}
            </div>
            {showUserMenu && (
              <div className="absolute right-0 top-10 bg-white rounded-xl shadow-lg border border-gray-100 py-2 w-44 z-50">
                <div className="px-4 py-2 text-sm text-gray-500 border-b">{user.email}</div>
                <button
                  onClick={() => { setShowProfile(true); setShowUserMenu(false); }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                >
                  My Profile
                </button>
                <button
                  onClick={() => auth.signOut()}
                  className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50"
                >
                  Log Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="app-layout">
        {/* SIDEBAR */}
        <Suspense fallback={<div className="sidebar animate-pulse bg-off"></div>}>
          <Sidebar profile={profile} setShowPremiumModal={setShowPremiumModal} />
        </Suspense>

        {/* MAIN AREA */}
        <div className="main-area flex-1 flex flex-col h-[calc(100dvh-62px)] relative">
          
          {showDashboard ? (
            <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#f4f6f4]">
               <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading Dashboard...</div>}>
                 <Dashboard profile={profile} />
               </Suspense>
            </div>
          ) : (
            <div className="chat-area flex-1 flex flex-col h-full bg-[#f4f6f4]">
              <div className="chat-header">
                <h2>Your AI Financial Advisor</h2>
                <p>Tell me about your finances — income, expenses, loans, goals, anything.</p>
              </div>

              <ChatWindow
                chatHistory={chatHistory}
                isTyping={isTyping}
                formatMessage={formatAIResponse}
                chatEndRef={chatEndRef}
                userName={user.displayName || undefined}
              />

              <ChatInput
                input={input}
                onInput={setInput}
                onSend={onSendWrapper}
                isTyping={isTyping}
                showSuggestions={showSuggestions}
                onSkipSetup={() => onSendWrapper("skip setup")}
                showSkipButton={chatHistory.length > 0 && !profile.onboardingCompleted}
                setShowPrivacyPolicy={setShowPrivacyPolicy}
              />
            </div>
          )}
        </div>
      </div>

      {/* PROFILE PANEL */}
      {showProfile && (
        <>
          {/* Mobile Overlay */}
          <div 
            className="fixed inset-0 bg-black/20 z-30 md:hidden"
            onClick={() => setShowProfile(false)}
          />
          <div id="profilePanel" style={{ display: 'block' }}>
            <h3>Financial Profile <button className="close-btn" onClick={() => setShowProfile(false)}>✕</button></h3>
            <div>
            <div className="profile-section">
              <h4>Personal Info</h4>
              <div className="profile-row">
                <span className="key">Name</span>
                <input
                  defaultValue={profile.personal?.name || ''}
                  onBlur={async (e) => {
                    const newProfile = { ...profile, personal: { ...profile.personal, name: e.target.value }};
                    await saveProfile(newProfile);
                    showToast('✓ Saved');
                  }}
                  className="val border-b border-gray-200 bg-transparent text-right outline-none"
                />
              </div>
              <div className="profile-row">
                <span className="key">Age</span>
                <input type="number" defaultValue={profile.personal?.age || ''}
                  onBlur={async (e) => {
                    const newProfile = { ...profile, personal: { ...profile.personal, age: Number(e.target.value) }};
                    await saveProfile(newProfile);
                    showToast('✓ Saved');
                  }}
                  className="val border-b border-gray-200 bg-transparent text-right outline-none w-16"
                />
              </div>
              <div className="profile-row">
                <span className="key">Risk Profile</span>
                <select defaultValue={profile.personal?.riskProfile || 'moderate'}
                  onChange={async (e) => {
                    const newProfile = { ...profile, personal: { ...profile.personal, riskProfile: e.target.value as any }};
                    await saveProfile(newProfile);
                    showToast('✓ Saved');
                  }}
                  className="val bg-transparent text-right outline-none"
                >
                  <option value="conservative">Conservative</option>
                  <option value="moderate">Moderate</option>
                  <option value="aggressive">Aggressive</option>
                </select>
              </div>
            </div>

            <FinancialSourceEditor 
              title="Income"
              type="income"
              sources={profile.income.map(i => ({ name: i.name, value: (i as any).value || (i as any).amount }))}
              onUpdate={async (sources) => {
                const newProfile = { ...profile, income: sources };
                finance.recalculateMetrics(newProfile);
                setProfile(newProfile);
                await saveProfile(newProfile);
                showToast('✓ Saved');
              }}
            />
            <div className="profile-row font-bold mb-4 px-3"><span className="key">Total Monthly</span><span className="val">{fmt(finance.totalIncome(profile))}</span></div>
            
            <FinancialSourceEditor 
              title="Expenses"
              type="expense"
              sources={profile.expenses.map(i => ({ name: i.name, value: (i as any).value || (i as any).amount }))}
              onUpdate={async (sources) => {
                const newProfile = { ...profile, expenses: sources };
                finance.recalculateMetrics(newProfile);
                setProfile(newProfile);
                await saveProfile(newProfile);
                showToast('✓ Saved');
              }}
            />
            <div className="profile-row font-bold mb-4 px-3"><span className="key">Total Monthly</span><span className="val">{fmt(finance.totalExpenses(profile))}</span></div>
            
            <div className="profile-section">
              <div className="profile-row"><span className="key">Monthly Savings (Surplus)</span><span className="val">{fmt(profile.metrics.monthlyCashFlow)}</span></div>
            </div>
            
            <FinancialSourceEditor 
              title={`Assets (${fmt(finance.totalAssets(profile))})`}
              type="assets"
              sources={profile.assets.map(a => ({ name: `${a.name} (${a.type})`, value: a.value }))}
              onUpdate={async (sources) => {
                const newAssets = sources.map(s => {
                  const existing = profile.assets.find(a => `${a.name} (${a.type})` === s.name);
                  if (existing) return { ...existing, value: s.value };
                  return { name: s.name, type: 'other' as const, value: s.value };
                });
                const newProfile = { ...profile, assets: newAssets };
                finance.recalculateMetrics(newProfile);
                setProfile(newProfile);
                await saveProfile(newProfile);
                showToast('✓ Saved');
              }}
            />
            {finance.totalAssets(profile) === 0 && profile.portfolio.length === 0 && <div className="profile-row mb-4"><span className="key" style={{ color: '#ccc' }}>None added yet</span></div>}
            
            <div className="profile-section">
              <div className="mt-4">
                <Portfolio profile={profile} onUpdate={(newProfile) => {
                  finance.recalculateMetrics(newProfile);
                  setProfile(newProfile);
                  saveProfile(newProfile);
                  showToast('✓ Saved');
                }} />
              </div>
            </div>
            <FinancialSourceEditor 
              title={`Liabilities (${fmt(finance.totalLiabilities(profile))})`}
              type="loans"
              sources={profile.loans.map(l => ({ name: l.name, value: l.amount }))}
              onUpdate={async (sources) => {
                const newLoans = sources.map(s => {
                  const existing = profile.loans.find(l => l.name === s.name);
                  if (existing) return { ...existing, amount: s.value };
                  return { name: s.name, amount: s.value, emi: 0, rate: 0 }; // Assume 0 EMI for newly added via quick editor
                });
                const newProfile = { ...profile, loans: newLoans };
                finance.recalculateMetrics(newProfile);
                setProfile(newProfile);
                await saveProfile(newProfile);
                showToast('✓ Saved');
              }}
            />
            <div className="profile-section">
              <h4>Goals</h4>
              {(profile.goals || []).map((g, i) => {
                const progress = g.target > 0 ? Math.min(100, Math.round(((g.saved || 0) / g.target) * 100)) : 0;
                return (
                  <div key={i} className="mb-4">
                    <div className="profile-row mb-1">
                      <span className="key font-semibold">{g.name}</span>
                      <span className="val text-sm">
                        {fmt(g.saved || 0)} / {g.target > 0 ? fmt(g.target) : 'No target set'}
                      </span>
                    </div>
                    {g.target > 0 && (
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                        <div className="bg-lime h-2 rounded-full" style={{ width: `${progress}%` }}></div>
                      </div>
                    )}
                  </div>
                );
              })}
              {(profile.goals || []).length === 0 && <div className="profile-row"><span className="key" style={{ color: '#ccc' }}>No goals yet</span></div>}
            </div>

            <FinancialSourceEditor 
              title={`Subscriptions`}
              type="expense"
              sources={(profile.subscriptions || []).map(s => ({ name: `${s.name} (${s.billingCycle})`, value: s.cost }))}
              onUpdate={async (sources) => {
                const newSubs = sources.map(s => {
                  const existing = (profile.subscriptions || []).find(sub => `${sub.name} (${sub.billingCycle})` === s.name);
                  if (existing) return { ...existing, cost: s.value };
                  return { name: s.name, cost: s.value, billingCycle: 'monthly' as const };
                });
                const newProfile = { ...profile, subscriptions: newSubs };
                finance.recalculateMetrics(newProfile);
                setProfile(newProfile);
                await saveProfile(newProfile);
                showToast('✓ Saved');
              }}
            />
            <div className="profile-section mt-6 pt-4 border-t border-gray-100">
              <h4 className="text-red-600">Account Settings</h4>
              <button 
                onClick={async () => {
                  if (confirm("Are you sure you want to permanently delete your account and all financial data? This action cannot be undone.")) {
                    try {
                      if (user) {
                        const { deleteUser } = await import('firebase/auth');
                        const { deleteDoc, doc } = await import('firebase/firestore');
                        await deleteDoc(doc(db, 'users', user.uid));
                        await deleteUser(user);
                        alert("Account deleted.");
                      }
                    } catch(err) {
                      console.error(err);
                      alert("Please log out and log back in to delete your account.");
                    }
                  }
                }}
                className="w-full text-center py-2 text-sm text-red-600 font-semibold border border-red-200 bg-red-50 rounded-lg hover:bg-red-100 transition"
              >
                Delete Account & Data
              </button>
            </div>
          </div>
        </div>
        </>
      )}
      {/* PREMIUM MODAL */}
      {showPremiumModal && (
        <Suspense fallback={null}>
          <PremiumModal 
            onClose={() => setShowPremiumModal(false)}
            user={user}
            onUpgrade={() => {
              setProfile(prev => ({ ...prev, isPremium: true }));
              setShowPremiumModal(false);
              setChatHistory(prev => [...prev, { role: 'ai', content: '🎉 **Welcome to PapaProfit Pro!** You now have access to personalized investment recommendations and advanced analytics. Let me know if you want to explore your new features!' }]);
            }}
          />
        </Suspense>
      )}
      {/* PRIVACY POLICY MODAL */}
      {showPrivacyPolicy && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Privacy Policy</h3>
              <button onClick={() => setShowPrivacyPolicy(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="prose prose-sm text-gray-600">
              <p><strong>1. Data Collection:</strong> We collect financial data you explicitly provide during chats or onboarding to provide personalized insights.</p>
              <p><strong>2. AI Processing:</strong> Your data is processed securely through AI engines. We do not use your financial data to train public AI models.</p>
              <p><strong>3. Storage & Security:</strong> Data is stored securely on Google Cloud Platform (Firestore).</p>
              <p><strong>4. Deletion:</strong> You may permanently delete your account and all associated data at any time via the Account Settings panel.</p>
              <p><strong>5. Third-Party Integrations:</strong> Stock search uses Yahoo Finance. Real-time metrics are synced only with authorized APIs.</p>
              <p className="font-bold text-red-600 mt-4">Disclaimer: PapaProfit is an AI tool and does not provide certified financial advice. Calculations may be inaccurate. Always verify with a certified financial planner.</p>
            </div>
            <button 
              onClick={() => setShowPrivacyPolicy(false)}
              className="mt-6 w-full bg-gray-100 text-gray-800 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
            >
              I Understand
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white text-sm px-4 py-2 rounded-xl shadow-lg z-50 animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  );
}
