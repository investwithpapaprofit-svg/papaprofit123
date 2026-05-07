import { useState, useEffect, useRef } from 'react';
import { signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from './firebase';
import { UserProfile } from './types';
import { parser } from './parser';
import { finance } from './finance';
import { insights } from './insights';
import { Portfolio } from './components/Portfolio';
import { Dashboard } from './components/Dashboard';

import DOMPurify from 'dompurify';

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
            const updatedStocks = await Promise.all(safeProfile.portfolio.map(async (holding) => {
              try {
                if (holding.assetType === 'stock') {
                  const res = await fetch(`/api/stock/quote?symbol=${holding.symbol}`);
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
      reply = await insights.generateResponse(userMsg, parsed, updatedProfile, newHistory, onboardingStep, ONBOARDING_QUESTIONS);
      
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
  const nw = profile.metrics.netWorth;
  const surplus = profile.metrics.monthlyCashFlow;
  const sr = profile.metrics.savingsRate;
  const dr = profile.metrics.debtToIncomeRatio;
  const metricsInsights = profile.insights || [];

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
        <div className="sidebar">
          <div className="sidebar-section">
            <div className="sidebar-title">Financial Health Score</div>
            <div className="fhs-circle-wrap">
              <div className={`fhs-circle ${fhsInfo.cls}`}>
                <div className="fhs-num">{fhsScore !== null ? fhsScore : '--'}</div>
                <div className="fhs-label">/ 100</div>
              </div>
              <div className="fhs-desc">{fhsInfo.label || 'Chat to get your score'}</div>
            </div>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-title">Key Metrics</div>
            <div className="metric-card">
              <div className="metric-label">Net Worth</div>
              <div className={`metric-value ${nw >= 0 ? 'green' : 'red'}`} title={fmt(nw)}>{fhsScore !== null ? fmt(nw) : '--'}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Monthly Surplus</div>
              <div className={`metric-value ${surplus >= 0 ? 'green' : 'red'}`} title={fmt(surplus)}>{finance.totalIncome(profile) > 0 ? fmt(surplus) : '--'}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Savings Rate</div>
              <div className={`metric-value ${sr >= 20 ? 'green' : sr >= 10 ? 'amber' : 'red'}`} title={`${sr.toFixed(2)}%`}>{finance.totalIncome(profile) > 0 ? `${sr.toFixed(1)}%` : '--'}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Debt Ratio</div>
              <div className={`metric-value ${(dr * 100) <= 30 ? 'green' : (dr * 100) <= 50 ? 'amber' : 'red'}`} title={`${(dr * 100).toFixed(2)}%`}>{finance.totalIncome(profile) > 0 ? `${(dr * 100).toFixed(1)}%` : '--'}</div>
            </div>
          </div>

          {(profile.goals || []).length > 0 && (
            <div className="sidebar-section">
              <div className="sidebar-title">Goals</div>
              {(profile.goals || []).map((g, i) => {
                const monthly = finance.goalMonthlyNeeded(g);
                const pct = g.target > 0 ? Math.round((g.saved / g.target) * 100) : 0;
                return (
                  <div key={i} className="goal-card">
                    <div className="goal-name">{g.name}</div>
                    <div className="goal-progress"><div className="goal-progress-fill" style={{ width: `${pct}%` }}></div></div>
                    <div className="goal-detail">{g.target > 0 ? `${fmt(g.target)} target` : 'Set a target amount'} {monthly > 0 ? `· Save ${fmt(monthly)}/mo` : ''}</div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="sidebar-section">
            <div className="sidebar-title">Insights</div>
            <div>
              {metricsInsights.length > 0 ? metricsInsights.map((n, i) => <div key={i} className="nudge"><span className="nudge-icon">💡</span> {n.title}</div>) : <div style={{ fontSize: '13px', color: '#aaa', padding: '4px' }}>Chat to unlock insights</div>}
            </div>
          </div>

          <div className="premium-lock">
            <p>🔒 Advanced analytics, tax optimisation & investment tracking</p>
            <button className="premium-btn" onClick={() => setShowPremiumModal(true)}>Upgrade to Pro</button>
          </div>
        </div>

        {/* MAIN AREA */}
        <div className="main-area flex-1 flex flex-col h-[calc(100dvh-62px)] relative">
          
          {showDashboard ? (
            <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#f4f6f4]">
               <Dashboard profile={profile} />
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
            <div className="profile-section">
              <h4>Income</h4>
              {profile.income.map((inc, i) => <div key={i} className="profile-row"><span className="key">{inc.name}</span><span className="val">{fmt((inc as any).value || (inc as any).amount)}</span></div>)}
              <div className="profile-row mt-2 font-bold"><span className="key">Total Monthly Income</span><span className="val">{fmt(finance.totalIncome(profile))}</span></div>
            </div>
            
            <div className="profile-section">
              <h4>Expenses</h4>
              {profile.expenses.map((exp, i) => <div key={i} className="profile-row"><span className="key">{exp.name}</span><span className="val">{fmt((exp as any).value || (exp as any).amount)}</span></div>)}
              <div className="profile-row mt-2 font-bold"><span className="key">Total Monthly Expenses</span><span className="val">{fmt(finance.totalExpenses(profile))}</span></div>
            </div>
            
            <div className="profile-section">
              <div className="profile-row"><span className="key">Monthly Savings (Surplus)</span><span className="val">{fmt(profile.metrics.monthlyCashFlow)}</span></div>
            </div>
            
            <div className="profile-section">
              <h4>Assets ({fmt(finance.totalAssets(profile))})</h4>
              {profile.assets.map((a, i) => <div key={i} className="profile-row"><span className="key">{a.name} ({a.type})</span><span className="val">{fmt(a.value)}</span></div>)}
              {finance.totalAssets(profile) === 0 && profile.portfolio.length === 0 && <div className="profile-row"><span className="key" style={{ color: '#ccc' }}>None added yet</span></div>}
              
              <div className="mt-4">
                <Portfolio profile={profile} onUpdate={(newProfile) => {
                  finance.recalculateMetrics(newProfile);
                  setProfile(newProfile);
                  saveProfile(newProfile);
                }} />
              </div>
            </div>
            <div className="profile-section">
              <h4>Liabilities ({fmt(finance.totalLiabilities(profile))})</h4>
              {profile.loans.map((l, i) => <div key={i} className="profile-row"><span className="key">{l.name}</span><span className="val" style={{ color: '#c0392b' }}>{fmt(l.amount)}{l.rate ? ` @ ${l.rate}%` : ''}</span></div>)}
              {profile.loans.length === 0 && <div className="profile-row"><span className="key" style={{ color: '#ccc' }}>None added yet</span></div>}
            </div>
            <div className="profile-section">
              <h4>Goals</h4>
              {(profile.goals || []).map((g, i) => <div key={i} className="profile-row"><span className="key">{g.name}</span><span className="val">{g.target > 0 ? fmt(g.target) : 'No target set'}</span></div>)}
              {(profile.goals || []).length === 0 && <div className="profile-row"><span className="key" style={{ color: '#ccc' }}>No goals yet</span></div>}
            </div>
            <div className="profile-section">
              <h4>Risk Profile</h4>
              <div className="profile-row"><span className="key">Appetite</span><span className="val">{profile.personal?.riskProfile ? profile.personal.riskProfile.charAt(0).toUpperCase() + profile.personal.riskProfile.slice(1) : 'Not set'}</span></div>
            </div>
          </div>
        </div>
      )}
      {/* PREMIUM MODAL */}
      {showPremiumModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">PapaProfit Pro</h3>
              <button onClick={() => setShowPremiumModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            
            <div className="space-y-4 mb-8">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#e8f5ee] text-[#1a7a4a] flex items-center justify-center shrink-0 mt-0.5">✓</div>
                <div>
                  <h4 className="font-semibold text-gray-900">Personalized Investment Strategies</h4>
                  <p className="text-sm text-gray-500">Get AI-driven recommendations based on your risk profile and goals.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#e8f5ee] text-[#1a7a4a] flex items-center justify-center shrink-0 mt-0.5">✓</div>
                <div>
                  <h4 className="font-semibold text-gray-900">Advanced Tax Optimization</h4>
                  <p className="text-sm text-gray-500">Discover ways to save on taxes legally and efficiently.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#e8f5ee] text-[#1a7a4a] flex items-center justify-center shrink-0 mt-0.5">✓</div>
                <div>
                  <h4 className="font-semibold text-gray-900">Live Portfolio Tracking</h4>
                  <p className="text-sm text-gray-500">Monitor your stocks and assets in real-time.</p>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-100">
              <div className="flex justify-between items-center mb-2">
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
                    setProfile(prev => ({ ...prev, isPremium: true }));
                    setShowPremiumModal(false);
                    setChatHistory(prev => [...prev, { role: 'ai', content: '🎉 **Welcome to PapaProfit Pro!** You now have access to personalized investment recommendations and advanced analytics. Let me know if you want to explore your new features!' }]);
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
              Upgrade Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
