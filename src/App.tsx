import { useState, useEffect, useRef } from 'react';
import { auth } from './firebase';
import { finance } from './finance';
import { Portfolio } from './components/Portfolio';
import DOMPurify from 'dompurify';
import { Suspense, lazy } from 'react';
import { useAuth } from './hooks/useAuth';
import { useProfile } from './hooks/useProfile';
import { useChat } from './hooks/useChat';

import { FinancialSourceEditor } from './components/FinancialSourceEditor';
const Dashboard = lazy(() => import('./components/Dashboard').then(module => ({ default: module.Dashboard })));
const Sidebar = lazy(() => import('./components/Sidebar').then(module => ({ default: module.Sidebar })));
const PremiumModal = lazy(() => import('./components/PremiumModal').then(module => ({ default: module.PremiumModal })));

export default function App() {
  const { user, loginError, handleLogin } = useAuth();
  const { profile, setProfile, loadProfile, saveProfile } = useProfile(user);
  const { chatHistory, isTyping, input, setInput, handleSend } = useChat(profile, saveProfile);

  const [showProfile, setShowProfile] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

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
    return (
      <div id="loginScreen">
        <canvas id="blob-canvas" className="absolute inset-0 pointer-events-none z-0"></canvas>
        <div className="flex z-10 w-full max-w-[900px] px-6 gap-[64px] items-center">
          <div className="flex-1 flex flex-col gap-[22px] hidden md:flex">
             <div className="inline-flex items-center gap-[7px] px-[14px] py-[5px] bg-xmint border-[1.5px] border-lmint rounded-full text-[0.68rem] font-bold text-deep tracking-[0.08em] uppercase w-fit">
                <span className="w-[6px] h-[6px] rounded-full bg-lime shadow-[0_0_8px_var(--color-lime)] animate-pulse"></span>
                Live AI — Powered by PapaProfit
             </div>
             <div className="logo-wrap !static !block pb-0 pt-0">
               <h1>Papa<span className="logo-wrap-accent">Profit.</span></h1>
               <p>The <strong>smartest financial OS</strong> for every Indian who wants to build real wealth — not just track expenses.</p>
             </div>
             <div className="flex flex-col gap-[9px]">
               <div className="flex items-center gap-[10px] text-[0.78rem] font-medium text-muted"><span className="w-[6px] h-[6px] rounded-full bg-lime shrink-0"></span>AI-powered financial health score</div>
               <div className="flex items-center gap-[10px] text-[0.78rem] font-medium text-muted"><span className="w-[6px] h-[6px] rounded-full bg-lime shrink-0"></span>Real-time net worth dashboard</div>
               <div className="flex items-center gap-[10px] text-[0.78rem] font-medium text-muted"><span className="w-[6px] h-[6px] rounded-full bg-lime shrink-0"></span>Smart goal tracking & SIP planner</div>
             </div>
          </div>
          <div className="login-card mx-auto md:mx-0 shrink-0">
            <h2>Sign in</h2>
            <p>Access your personal AI financial advisor — all your money in one intelligent place.</p>
            {loginError && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-xs p-3 rounded-lg mb-4 text-left">
                <strong>Login Error:</strong> {loginError}
              </div>
            )}
            <button className="google-btn" onClick={handleLogin}>
              <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Continue with Google
            </button>
            <div className="flex items-center gap-[12px] my-[20px] text-ghost text-[0.72rem] font-medium before:flex-1 before:h-[1px] before:bg-faint after:flex-1 after:h-[1px] after:bg-faint">or</div>
            <div className="grid grid-cols-2 gap-2 mt-[22px] pt-[20px] border-t-[1.5px] border-faint">
              <div className="flex items-center gap-2 text-[0.72rem] font-medium text-muted"><div className="w-[28px] h-[28px] rounded-[8px] bg-ultramint border border-faint flex items-center justify-center shrink-0">🤖</div>AI Advisor</div>
              <div className="flex items-center gap-2 text-[0.72rem] font-medium text-muted"><div className="w-[28px] h-[28px] rounded-[8px] bg-ultramint border border-faint flex items-center justify-center shrink-0">📊</div>Dashboard</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const fhsScore = profile.metrics.financialHealthScore;
  const fhsInfo = finance.fhsLabel(fhsScore);

  return (
    <div id="appShell">
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
          <div className="avatar" title={user.displayName || "User"} onClick={() => auth.signOut()}>{user.displayName?.charAt(0).toUpperCase()}</div>
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

              <div className="chat-messages p-4 flex-1 overflow-y-auto flex flex-col gap-4">
                {chatHistory.map((msg, i) => (
                  <div key={i} className={`msg ${msg.role}`}>
                    <div className="msg-avatar">{msg.role === 'user' ? user.displayName?.charAt(0).toUpperCase() : 'AI'}</div>
                    <div className="msg-bubble">
                      <div dangerouslySetInnerHTML={{ __html: formatAIResponse(msg.content) }} />
                      {msg.updates && msg.updates.length > 0 && (
                        <div className="profile-update mt-2 inline-flex">✓ Profile updated: {msg.updates.join(' · ')}</div>
                      )}
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="msg ai">
                    <div className="msg-avatar">AI</div>
                    <div className="msg-bubble">
                      <div className="typing-dots"><span></span><span></span><span></span></div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {showSuggestions && (
                <div className="suggestions">
                  <div className="sug" onClick={() => onSendWrapper('I earn ₹60,000/month')}>I earn ₹60,000/month</div>
                  <div className="sug" onClick={() => onSendWrapper('I have a home loan of ₹20 lakh')}>I have a home loan of ₹20 lakh</div>
                  <div className="sug" onClick={() => onSendWrapper('I want to buy a house in 5 years')}>I want to buy a house in 5 years</div>
                  <div className="sug" onClick={() => onSendWrapper('Should I start a business?')}>Should I start a business?</div>
                  <div className="sug" onClick={() => onSendWrapper('How is my financial health?')}>How is my financial health?</div>
                </div>
              )}

              {chatHistory.length > 0 && !profile.onboardingCompleted && (
                <div className="px-6 py-2 flex justify-end">
                  <button 
                    onClick={() => onSendWrapper("skip setup")}
                    className="text-[10px] text-gray-400 hover:text-gray-600 underline"
                  >
                    Skip guided setup
                  </button>
                </div>
              )}
              <div className="chat-input-wrap">
                <div className="chat-input-row">
                  <input 
                    type="text" 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type anything about your finances..." 
                    onKeyDown={(e) => { if (e.key === 'Enter') onSendWrapper(); }}
                    disabled={isTyping}
                  />
                  <button className="send-btn" onClick={() => onSendWrapper()} disabled={isTyping || !input.trim()}>➤</button>
                </div>
                <div className="text-center mt-2 px-4 pb-2">
                  <p className="text-[10px] text-gray-400">
                    PapaProfit AI can make mistakes. This is <span className="font-semibold text-gray-500">not certified financial advice</span>. Please verify calculations. <button onClick={() => setShowPrivacyPolicy(true)} className="underline hover:text-gray-600">Privacy Policy</button>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PROFILE PANEL */}
      {showProfile && (
        <div id="profilePanel" style={{ display: 'block' }}>
          <h3>Financial Profile <button className="close-btn" onClick={() => setShowProfile(false)}>✕</button></h3>
          <div>
            <FinancialSourceEditor 
              title="Income"
              type="income"
              sources={profile.income.map(i => ({ name: i.name, value: (i as any).value || (i as any).amount }))}
              onUpdate={async (sources) => {
                const newProfile = { ...profile, income: sources };
                finance.recalculateMetrics(newProfile);
                setProfile(newProfile);
                await saveProfile(newProfile);
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
              }}
            />
            {finance.totalAssets(profile) === 0 && profile.portfolio.length === 0 && <div className="profile-row mb-4"><span className="key" style={{ color: '#ccc' }}>None added yet</span></div>}
            
            <div className="profile-section">
              <div className="mt-4">
                <Portfolio profile={profile} onUpdate={(newProfile) => {
                  finance.recalculateMetrics(newProfile);
                  setProfile(newProfile);
                  saveProfile(newProfile);
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
              }}
            />
            <div className="profile-section">
              <h4>Goals</h4>
              {(profile.goals || []).map((g, i) => <div key={i} className="profile-row"><span className="key">{g.name}</span><span className="val">{g.target > 0 ? fmt(g.target) : 'No target set'}</span></div>)}
              {(profile.goals || []).length === 0 && <div className="profile-row"><span className="key" style={{ color: '#ccc' }}>No goals yet</span></div>}
            </div>
            <div className="profile-section">
              <h4>Risk Profile</h4>
              <div className="profile-row"><span className="key">Appetite</span><span className="val">{profile.personal?.riskProfile ? profile.personal.riskProfile.charAt(0).toUpperCase() + profile.personal.riskProfile.slice(1) : 'Not set'}</span></div>
            </div>
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
    </div>
  );
}
