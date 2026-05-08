import { useState, useEffect, useRef } from 'react';
import { signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from './firebase';
import { UserProfile } from './types';
import { parser } from './parser';
import { finance } from './finance';
import { insights } from './insights';
import { Portfolio } from './components/Portfolio';
import DOMPurify from 'dompurify';
import { Suspense, lazy } from 'react';

import { FinancialSourceEditor } from './components/FinancialSourceEditor';
const Dashboard = lazy(() => import('./components/Dashboard').then(module => ({ default: module.Dashboard })));
const Sidebar = lazy(() => import('./components/Sidebar').then(module => ({ default: module.Sidebar })));
const PremiumModal = lazy(() => import('./components/PremiumModal').then(module => ({ default: module.PremiumModal })));

const DEFAULT_PROFILE: UserProfile = {
  personal: {},
  income: [],
  expenses: [],
  loans: [],
  assets: [],
  subscriptions: [],
  portfolio: [],
  goals: [],
  metrics: {
    netWorth: 0,
    monthlyCashFlow: 0,
    savingsRate: 0,
    debtToIncomeRatio: 0,
    emergencyFundRunwayMonths: 0,
    financialHealthScore: 0
  },
  insights: [],
  history: [],
  preferences: {
    currency: 'INR'
  },
  onboardingCompleted: false,
  lastUpdated: ''
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [chatHistory, setChatHistory] = useState<{ role: string; content: string; updates?: string[] }[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const ONBOARDING_QUESTIONS = [
    "**[Step 1/9]** Hi! I'm your PapaProfit AI. Let's get your profile set up. First, what's your **monthly income**?",
    "**[Step 2/9]** Is your income **fixed or variable**?",
    "**[Step 3/9]** How much do you **spend** monthly on expenses?",
    "**[Step 4/9]** How much **savings** do you currently have?",
    "**[Step 5/9]** Do you have any **loans**? If yes, how much?",
    "**[Step 6/9]** How much **EMI** do you pay monthly?",
    "**[Step 7/9]** Do you **invest** in stocks or gold? If so, roughly how much?",
    "**[Step 8/9]** What is your main **financial goal**? (e.g. buy a house, retire early)",
    "**[Step 9/9]** Finally, do you currently track your expenses and invest regularly?"
  ];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setLoginError(null);
        await loadProfile(currentUser.uid);
      } else {
        setChatHistory([]);
        setProfile(DEFAULT_PROFILE);
      }
    });
    return () => unsubscribe();
  }, []);

  // Add welcome message or start onboarding
  useEffect(() => {
    if (user && chatHistory.length === 0) {
      setChatHistory(prev => {
        if (prev.length > 0) return prev;
        if (!profile.onboardingCompleted) {
          setOnboardingStep(1);
          return [{ role: 'ai', content: ONBOARDING_QUESTIONS[0] }];
        } else {
          const welcomeMsg = `**Welcome back to PapaProfit, ${user.displayName?.split(' ')[0]}! 👋**\n\nI'm ready to help you manage your finances. Your current net worth is **₹${profile.metrics.netWorth.toLocaleString('en-IN')}**.\n\nWhat would you like to focus on today?`;
          return [{ role: 'ai', content: welcomeMsg }];
        }
      });
    }
  }, [user, profile.onboardingCompleted]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [chatHistory, isTyping]);

  const loadProfile = async (uid: string) => {
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.profile) {
          const loadedProfile = data.profile as UserProfile;
          let safeAssets = Array.isArray(loadedProfile.assets) ? loadedProfile.assets : [];
          if (!Array.isArray(loadedProfile.assets) && typeof loadedProfile.assets === 'object') {
             const old = loadedProfile.assets as any;
             if (old.property) old.property.forEach((p:any) => safeAssets.push({type: 'property', name: p.name, value: p.value, mortgageable: p.mortgageable}));
             if (old.gold) safeAssets.push({type: 'gold', name: 'Gold', value: old.gold});
             if (old.cash) safeAssets.push({type: 'cash', name: 'Cash', value: old.cash});
             if (old.other) old.other.forEach((p:any) => safeAssets.push({type: 'other', name: p.name, value: p.value}));
             
             if (old.stocks) {
               loadedProfile.portfolio = loadedProfile.portfolio || [];
               old.stocks.forEach((s:any) => {
                 loadedProfile.portfolio.push({
                   symbol: s.symbol,
                   name: s.name,
                   assetType: 'stock',
                   quantity: s.quantity,
                   averageBuyPrice: s.buyPrice,
                   currentPrice: s.currentPrice
                 });
               });
             }
             if (old.crypto) {
               loadedProfile.portfolio = loadedProfile.portfolio || [];
               old.crypto.forEach((s:any) => {
                 loadedProfile.portfolio.push({
                   symbol: s.name,
                   name: s.name,
                   assetType: 'crypto',
                   quantity: 1,
                   averageBuyPrice: s.value,
                   currentPrice: s.value
                 });
               });
             }
          }

          let safePersonal: any = loadedProfile.personal || DEFAULT_PROFILE.personal;
          if (!loadedProfile.personal && (loadedProfile as any).riskProfile) {
            safePersonal.riskProfile = (loadedProfile as any).riskProfile;
          }

          const safeProfile = {
            ...DEFAULT_PROFILE,
            ...loadedProfile,
            personal: safePersonal,
            income: Array.isArray(loadedProfile.income) ? loadedProfile.income : (loadedProfile as any).incomeSources || [],
            expenses: Array.isArray(loadedProfile.expenses) ? loadedProfile.expenses : (loadedProfile as any).expenseCategories || [],
            loans: loadedProfile.loans || [],
            assets: safeAssets,
            subscriptions: loadedProfile.subscriptions || [],
            portfolio: loadedProfile.portfolio || [],
            goals: loadedProfile.goals || [],
            metrics: loadedProfile.metrics || DEFAULT_PROFILE.metrics,
            insights: loadedProfile.insights || []
          };
          finance.recalculateMetrics(safeProfile);

          // Fetch live prices for stocks
          if (safeProfile.portfolio && safeProfile.portfolio.length > 0) {
            const token = await auth.currentUser?.getIdToken();
            const updatedStocks = await Promise.all(safeProfile.portfolio.map(async (holding) => {
              try {
                if (holding.assetType === 'stock') {
                  const res = await fetch(`/api/stock/quote?symbol=${holding.symbol}`, {
                    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                  });
                  if (res.ok) {
                    const quote = await res.json();
                    if (quote && quote.regularMarketPrice) {
                      return { ...holding, currentPrice: quote.regularMarketPrice };
                    }
                  }
                }
              } catch (e) {
                console.error("Failed to fetch price for", holding.symbol);
              }
              return holding;
            }));
            safeProfile.portfolio = updatedStocks;
            finance.recalculateMetrics(safeProfile);
          }
          setProfile(safeProfile);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `users/${uid}`);
    }
  };

  const saveProfile = async (newProfile: UserProfile) => {
    if (!user) return;
    try {
      // Filter out isPremium from client-side save to prevent abuse
      const { isPremium, ...profileToSave } = newProfile;
      await setDoc(doc(db, 'users', user.uid), {
        name: user.displayName,
        email: user.email,
        profile: profileToSave,
        lastUpdated: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  const handleLogin = async () => {
    try {
      setLoginError(null);
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Login failed:", error);
      if (error.code === 'auth/popup-blocked') {
        setLoginError("Popup blocked. Please allow popups or open in a new tab.");
      } else if (error.code === 'auth/unauthorized-domain') {
        setLoginError("Domain not authorized. Add this URL to 'Authorized domains' in Firebase Console.");
      } else {
        setLoginError("Login failed: " + (error.message || "Unknown error"));
      }
    }
  };

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

  const handleSend = async (text: string = input) => {
    if (!text.trim()) return;
    
    const userMsg = text.trim();
    setInput('');
    setShowSuggestions(false);
    
    // 1. Add user message
    const newHistory = [...chatHistory, { role: 'user', content: userMsg }];
    setChatHistory(newHistory);
    
    // 2. Parse message & update profile
    const parsed = await parser.parse(userMsg, profile);
    
    if (parsed.clarificationMsg) {
        setIsTyping(false);
        setChatHistory(prev => [...prev, { role: 'ai', content: parsed.clarificationMsg! }]);
        return;
    }

    let updatedProfile = profile;
    if (parsed && parsed.updates && parsed.updates.length > 0) {
      updatedProfile = parsed.newProfile;
      setProfile(updatedProfile);
      await saveProfile(updatedProfile);
    }
    
    // 3. Show typing indicator
    setIsTyping(true);
    
    // 4. Generate AI response or next onboarding question
    let reply = '';
    const isFrustrated = /beat|shit|fuck|stupid|dumb|annoying|wrong|random|niga|bs|listening/i.test(userMsg);
    const isSkipRequest = /skip|stop|don't ask|dont ask|just chat/i.test(userMsg);

    if ((isSkipRequest || isFrustrated) && !profile.onboardingCompleted) {
      const finalProfile = { ...updatedProfile, onboardingCompleted: true };
      setProfile(finalProfile);
      await saveProfile(finalProfile);
      reply = isFrustrated 
        ? "I'm really sorry for being repetitive. I've stopped the guided setup. I'm listening now—tell me exactly what you want to fix or update in your finances."
        : "Understood! I'll stop the guided setup. We can just chat naturally now. What's on your mind regarding your finances?";
      setOnboardingStep(0);
    } else {
      // Use AI for everything now
      reply = await insights.generateResponse(userMsg, parsed, updatedProfile, newHistory, onboardingStep);
      
      // If the user provided data that matched the current onboarding step, we increment it
      if (parsed.updates.length > 0 && !profile.onboardingCompleted) {
        if (onboardingStep < ONBOARDING_QUESTIONS.length) {
          setOnboardingStep(onboardingStep + 1);
        } else {
          const finalProfile = { ...updatedProfile, onboardingCompleted: true };
          setProfile(finalProfile);
          await saveProfile(finalProfile);
          setOnboardingStep(0);
        }
      }
    }
    
    // 5. Add AI response
    setIsTyping(false);
    setChatHistory(prev => [...prev, { role: 'ai', content: reply, updates: parsed.updates }]);
  };

  if (!user) {
    return (
      <div id="loginScreen">
        <div className="logo-wrap">
          <h1>PapaProfit</h1>
          <p>Your AI-powered financial operating system</p>
        </div>
        <div className="login-card">
          <h2>Welcome back</h2>
          <p>Sign in to access your financial dashboard and AI advisor.</p>
          {loginError && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-xs p-3 rounded-lg mb-4 text-left">
              <strong>Login Error:</strong> {loginError}
            </div>
          )}
          <button className="google-btn" onClick={handleLogin}>
            <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Continue with Google
          </button>
        </div>
      </div>
    );
  }

  const fhsScore = profile.metrics.financialHealthScore;
  const fhsInfo = finance.fhsLabel(fhsScore);

  return (
    <div id="appShell">
      <div className="topbar">
        <div className="topbar-logo">PapaProfit</div>
        <div className="topbar-right">
          <button 
            onClick={() => { setShowDashboard(!showDashboard); setShowProfile(false); }}
            className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-full text-sm font-semibold transition"
          >
            📊 {showDashboard ? 'Back to Chat' : 'Dashboard'}
          </button>
          
          <div className="fhs-badge" onClick={() => { setShowProfile(!showProfile); setShowDashboard(false); }}>
            <div className="fhs-dot" style={{ background: fhsInfo.cls === 'good' ? '#1a7a4a' : fhsInfo.cls === 'ok' ? '#d4851a' : '#c0392b' }}></div>
            <span>FHS: <strong>{fhsScore !== null ? fhsScore : '--'}</strong></span>
          </div>
          <div className="topbar-user">
            <span>{user.displayName}</span>
            <div className="avatar">{user.displayName?.charAt(0).toUpperCase()}</div>
          </div>
        </div>
      </div>

      <div className="app-layout">
        {/* SIDEBAR */}
        <Suspense fallback={<div className="sidebar animate-pulse bg-gray-100"></div>}>
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
                  <div className="sug" onClick={() => handleSend('I earn ₹60,000/month')}>I earn ₹60,000/month</div>
                  <div className="sug" onClick={() => handleSend('I have a home loan of ₹20 lakh')}>I have a home loan of ₹20 lakh</div>
                  <div className="sug" onClick={() => handleSend('I want to buy a house in 5 years')}>I want to buy a house in 5 years</div>
                  <div className="sug" onClick={() => handleSend('Should I start a business?')}>Should I start a business?</div>
                  <div className="sug" onClick={() => handleSend('How is my financial health?')}>How is my financial health?</div>
                </div>
              )}

              {chatHistory.length > 0 && !profile.onboardingCompleted && (
                <div className="px-6 py-2 flex justify-end">
                  <button 
                    onClick={() => handleSend("skip setup")}
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
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
                    disabled={isTyping}
                  />
                  <button className="send-btn" onClick={() => handleSend()} disabled={isTyping || !input.trim()}>➤</button>
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
