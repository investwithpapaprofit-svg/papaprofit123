import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import yahooFinance from 'yahoo-finance2';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { Resend } from 'resend';
import { generateWeeklyReport } from './src/utils/weeklyReport';
import Stripe from 'stripe';
import { finance } from './src/finance.js';
import { AIParseResponseSchema } from './src/schemas.js';
import { getNextBestAction } from './src/utils/nextBestAction.js';
import Groq from 'groq-sdk';

const groqKey = process.env.GROQ_API_KEY || '';
if (!groqKey) {
  console.error('❌ FATAL: No Groq API key found in GROQ_API_KEY environment variable.');
}

console.log('Checking API key sources:');
console.log('  GROQ_API_KEY:', process.env.GROQ_API_KEY ? '✅' : '❌');

const MODEL = 'llama-3.3-70b-versatile';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || ''
});

const stripe: Stripe | null = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

const appUrl = process.env.APP_URL || 'http://localhost:3000/';
console.log('APP_URL:', appUrl);

let firestore: any;

try {
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'papaprofit-7aa7e';
  const dbId = process.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || '(default)';
  const adminApp = admin.initializeApp({ projectId });
  firestore = getFirestore(adminApp, dbId);
  console.log(`✅ Firebase Admin initialized. Project: ${projectId}, DB: ${dbId}`);
} catch (e: any) {
  console.error('❌ Firebase Admin init failed:', e.message);
}

// Startup diagnostics — shows in server logs
console.log('=== PapaProfit Server Startup ===');
console.log('Groq key:', groqKey ? `✅ Set (${groqKey.slice(0, 8)}...)` : '❌ MISSING');
console.log('Stripe:', process.env.STRIPE_SECRET_KEY ? '✅ Set' : '⚠️  Not set (payments disabled)');
console.log('Firestore:', firestore ? '✅ Initialized' : '❌ FAILED');
console.log('================================');

// Authentication Middleware
const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    (req as any).user = decodedToken;
    next();
  } catch (error) {
    console.error('Auth verification error:', error);
    res.status(401).json({ error: 'Unauthorized' });
  }
};

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  const PORT = Number(process.env.PORT) || 3000;

  // Security Middlewares
  app.use(helmet({
    crossOriginOpenerPolicy: false,
    crossOriginEmbedderPolicy: false,
    xFrameOptions: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'", "https://*.googleapis.com", "https://*.firebaseio.com", "wss://*.firebaseio.com"],
        scriptSrc: process.env.NODE_ENV === 'production' 
          ? ["'self'", "https://*.googleapis.com", "https://*.firebase.com", "https://*.firebaseapp.com"]
          : ["'self'", "'unsafe-inline'", "https://*.googleapis.com", "https://*.firebase.com", "https://*.firebaseapp.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "blob:", "https://*.google.com", "https://*.googleusercontent.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        connectSrc: ["'self'", "https://*.googleapis.com", "https://*.firebaseio.com", "wss://*.firebaseio.com", "https://identitytoolkit.googleapis.com", "https://securetoken.googleapis.com"],
        frameSrc: ["'self'", "https://*.firebaseapp.com", "https://accounts.google.com"],
        frameAncestors: ["'self'", "https://*.run.app", "https://*.google.com", "https://*.aistudio.google.com"],
      }
    }
  }));
  
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // limit each IP to 200 requests per windowMs
    validate: { trustProxy: false, xForwardedForHeader: false, forwardedHeader: false }
  });
  app.use(limiter);

  const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { error: 'Too many AI requests. Please wait a few minutes.' },
    validate: { trustProxy: false, xForwardedForHeader: false, forwardedHeader: false }
  });

  // Simple in-memory per-user AI rate limiter
  const userAiUsageMap = new Map<string, { count: number, resetAt: number }>();
  const USER_AI_LIMIT_MAX = 50;
  const USER_AI_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

  setInterval(() => {
    const now = Date.now();
    for (const [uid, usage] of userAiUsageMap.entries()) {
      if (now > usage.resetAt) {
        userAiUsageMap.delete(uid);
      }
    }
  }, 5 * 60 * 1000);

  const perUserAiLimiter = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const uid = (req as any).user?.uid;
    if (!uid) {
      return next(); // Unauthenticated won't reach here anyway due to requireAuth
    }
    const now = Date.now();
    let usage = userAiUsageMap.get(uid);

    if (!usage || now > usage.resetAt) {
      usage = { count: 0, resetAt: now + USER_AI_LIMIT_WINDOW_MS };
    }

    if (usage.count >= USER_AI_LIMIT_MAX) {
      return res.status(429).json({ error: 'Personal AI quota exceeded. Please wait 10 minutes.' });
    }

    usage.count++;
    userAiUsageMap.set(uid, usage);
    next();
  };

  // Webhook for premium checkout (MUST be before express.json() for raw body verification)
  app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    if (!firestore) return res.status(503).send("Database unavailable");
    const signature = req.headers['stripe-signature'] as string;
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!endpointSecret) {
      console.warn("Stripe webhook secret not configured.");
      return res.status(400).send("Webhook secret not configured.");
    }

    try {
      const payloadString = req.body.toString();
      if (!stripe) return res.status(500).send('Stripe is not configured on the server');
      const event = stripe.webhooks.constructEvent(payloadString, signature, endpointSecret);
      
      // Handle the checkout.session.completed event
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const uid = session.client_reference_id; // Pass firebase UID when creating checkout session

        if (uid) {
          try {
            await firestore.collection('users').doc(uid).set({
              profile: {
                isPremium: true
              }
            }, { merge: true });
            console.log(`Premium activated via webhook for user: ${uid}`);
          } catch (err: any) {
             console.error("Firestore set error in webhook:", err.message);
          }
        }
      }

      res.status(200).json({ received: true });
    } catch (err: any) {
      console.error("Webhook error:", err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  });

  app.use(express.json());

  // API routes
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/api/cron/weekly-digest', async (req, res) => {
    if (!process.env.CRON_SECRET) {
      return res.status(503).json({ error: 'CRON_SECRET not configured on server' });
    }
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).send('Unauthorized');
    }

    if (!firestore) return res.status(503).json({ error: 'Database unavailable' });

    try {
      const resendApiKey = process.env.RESEND_API_KEY;
      if (!resendApiKey) {
         console.warn('RESEND_API_KEY missing, skipping actual sends');
      }
      const resend = new Resend(resendApiKey || 'fake');
      let sentCount = 0;
      let lastDoc = null;
      const BATCH_SIZE = 100;
      let hasMore = true;

      while (hasMore) {
        let query = firestore.collection('users').limit(BATCH_SIZE);
        if (lastDoc) {
          query = query.startAfter(lastDoc);
        }
        
        const usersSnap = await query.get();
        if (usersSnap.empty) {
          hasMore = false;
          break;
        }

        lastDoc = usersSnap.docs[usersSnap.docs.length - 1];

        for (const doc of usersSnap.docs) {
          const userData = doc.data();
          const email = userData.email || (userData.profile?.personal?.email);
          const profile = userData.profile;
          
          if (!profile || !email) continue;
          if (profile.preferences?.emailDigest === false) continue; // Unsubscribed

          const report = generateWeeklyReport(profile);
          if (!report.isAvailable) continue;

          const unsubToken = Buffer.from(doc.id).toString('base64');
          const unsubUrl = `https://papaprofit.com/api/unsubscribe?token=${unsubToken}`; // Replace with actual domain in prod

          const html = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.6;">
              <div style="text-align: center; margin-bottom: 24px;">
                <h2 style="color: #1a7a4a; margin-bottom: 0;">Your PapaProfit Weekly Money Report 📈</h2>
                <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Consistent small wins build wealth.</p>
              </div>
              <p>Hi ${profile.personal?.name?.split(' ')[0] || 'there'}, here's your personalized financial summary for the week.</p>
              <div style="background: #f4f6f4; padding: 24px; border-radius: 16px; margin: 24px 0; border: 1px solid #d1e8d7;">
                <table style="width: 100%; text-align: left; border-collapse: collapse;">
                  <tr style="border-bottom: 1px solid rgba(0,0,0,0.05);">
                    <td style="padding: 12px 0; color: #475569; font-size: 14px;">Net Worth Change</td>
                    <td style="padding: 12px 0; font-weight: 800; text-align: right; color: #0f172a;">${report.netWorthChange}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid rgba(0,0,0,0.05);">
                    <td style="padding: 12px 0; color: #475569; font-size: 14px;">Savings Rate Change</td>
                    <td style="padding: 12px 0; font-weight: 800; text-align: right; color: #0f172a;">${report.savingsRateChange}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; color: #475569; font-size: 14px;">Debt vs Income Change</td>
                    <td style="padding: 12px 0; font-weight: 800; text-align: right; color: #0f172a;">${report.debtChange}</td>
                  </tr>
                </table>
              </div>
              <p style="margin-bottom: 8px;"><strong>🔥 Biggest Win:</strong> <span style="color: #0f172a;">${report.topImprovement}</span></p>
              <p><strong>💡 Next Best Action:</strong> <span style="color: #0f172a;">${report.recommendedNextStep}</span></p>
              <p style="margin-top: 40px; font-size: 12px; color: #94a3b8; text-align: center;">
                Keep building wealth steadily.<br> PapaProfit Team<br><br>
                <a href="${unsubUrl}" style="color: #64748b; text-decoration: underline;">Unsubscribe from weekly reports</a>
              </p>
            </div>
          `;

          if (resendApiKey) {
            try {
              await resend.emails.send({
                from: process.env.VERIFIED_SENDER_EMAIL || 'PapaProfit <update@papaprofit.com>',
                to: email,
                subject: `Your Weekly Money Status: ${report.netWorthChange}`,
                html
              });
              sentCount++;
            } catch (err: any) {
              console.error(`Error sending email to ${email}:`, err.message);
            }
          }
        }
      }

      res.json({ success: true, count: sentCount, message: 'Batch processed successfully' });
    } catch (err: any) {
      console.error('Digest error:', err.message);
      res.status(500).json({ error: 'Failed' });
    }
  });

  app.get('/api/unsubscribe', async (req, res) => {
    if (!firestore) return res.status(503).json({ error: 'Database unavailable' });
    try {
      const token = req.query.token as string;
      if (!token) return res.status(400).send('Missing token');
      const uid = Buffer.from(token, 'base64').toString('utf8');
      
      const userRef = firestore.collection('users').doc(uid);
      const docSnap = await userRef.get();
      if (docSnap.exists) {
        await userRef.set({ profile: { preferences: { emailDigest: false } } }, { merge: true });
        res.send('Successfully unsubscribed from weekly reports. You can change this in your profile settings.');
      } else {
        res.status(404).send('User not found.');
      }
    } catch (err) {
      res.status(500).send('Internal server error.');
    }
  });

  app.post('/api/premium/create-checkout-session', requireAuth, async (req, res) => {
    try {
      const uid = (req as any).user.uid;
      
      if (!process.env.STRIPE_SECRET_KEY) {
        // Fallback for mock if missing
        if (process.env.ENABLE_MOCK_PREMIUM === 'true') {
           return res.json({ url: '/?mock_success=true' });
        }
        return res.status(500).json({ error: 'Stripe is not configured' });
      }

      if (!stripe) return res.status(500).json({ error: 'Stripe is not configured' });
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'inr',
            unit_amount: 49900,
            product_data: {
              name: 'PapaProfit Pro Subscription',
            },
            recurring: { interval: 'month' }
          },
          quantity: 1,
        }],
        mode: 'subscription',
        client_reference_id: uid,
        success_url: `${appUrl}?checkout=success`,
        cancel_url: `${appUrl}?checkout=canceled`,
      });

      res.json({ url: session.url });
    } catch (error) {
      console.error('Checkout session error:', error);
      res.status(500).json({ error: 'Failed to create checkout session' });
    }
  });

  app.get('/api/stock/search', requireAuth, async (req, res) => {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Query parameter q is required' });
    }
    try {
      const results = await yahooFinance.search(q);
      const quotes = (results as any).quotes ? (results as any).quotes.filter((q: any) => q.isYahooFinance || q.quoteType === 'EQUITY') : [];
      res.json(quotes.slice(0, 5));
    } catch (error: any) {
      console.error('Stock search error:', error.message || error);
      res.status(500).json({ error: 'Failed to search stock' });
    }
  });

  app.get('/api/stock/quote', requireAuth, async (req, res) => {
    const { symbol } = req.query;
    if (!symbol || typeof symbol !== 'string') {
      return res.status(400).json({ error: 'Query parameter symbol is required' });
    }
    try {
      const quote = await yahooFinance.quote(symbol);
      res.json(quote);
    } catch (error: any) {
      console.error('Stock quote error:', error.message || error);
      res.status(500).json({ error: 'Failed to fetch stock quote' });
    }
  });

  app.get('/api/test-groq', requireAuth, async (_, res) => {
    try {
      const completion = await groq.chat.completions.create({
        model: MODEL,
        messages: [{ role: 'user', content: 'Say hello' }]
      });

      res.json({
        success: true,
        text: completion.choices[0]?.message?.content
      });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({
        success: false,
        error: error?.message
      });
    }
  });

  const parseSchema = z.object({
    msg: z.string().max(2000),
    chatHistory: z.array(z.object({ role: z.string(), content: z.string() })).max(20).optional()
  });

  app.post('/api/ai/parse', requireAuth, aiLimiter, perUserAiLimiter, async (req, res) => {
    const activeKey = process.env.GROQ_API_KEY || '';
    if (!activeKey || activeKey === 'YOUR_GROQ_KEY') {
      return res.status(500).json({ error: 'Groq API key not configured' });
    }
    try {
      const { msg, chatHistory = [] } = parseSchema.parse(req.body);
      const previousAssistantMsg = chatHistory.filter((m: { role: string; content: string }) => m.role === 'ai').at(-1)?.content;

      const completion = await groq.chat.completions.create({
        model: MODEL,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You are a financial data extraction engine. Extract financial entities and user concerns from the user message. Return ONLY a valid JSON object with these fields: intent (string), confidenceScore (number 0-1), clarificationNeeded (boolean), clarificationMessage (string), extracted_data (object containing any of: personal, incomeSources, expenses, subscriptions, loans, assets, portfolio, goals). Inside 'personal', you can include an array of strings 'majorConcerns' if the user expresses worries (e.g. ["High debt", "No emergency savings"]). Use the assistant's previous message as context to interpret replies. No markdown, no explanation, just JSON.
Example output format: {"intent":"general","confidenceScore":0.9,"clarificationNeeded":false,"clarificationMessage":"","extracted_data":{}}`
          },
          ...(previousAssistantMsg ? [{ role: 'assistant' as const, content: previousAssistantMsg }] : []),
          { role: 'user' as const, content: msg }
        ],
        max_tokens: 1000,
        temperature: 0.1
      });
      const rawText = completion.choices[0]?.message?.content || '{}';
      let data: any = {};
      try {
        const parsedJson = JSON.parse(rawText);
        data = AIParseResponseSchema.parse(parsedJson);
      } catch (parseError) {
        console.warn('AI Parsing failed schema validation:', parseError);
        data = {
          intent: 'general',
          confidenceScore: 0,
          clarificationNeeded: true,
          clarificationMessage: 'I could not confidently understand that. Can you rephrase with the amount and category?',
          extracted_data: {}
        };
      }
      res.json(data);
    } catch (error: any) {
      console.error('Groq API Error:', error?.message);
      const status = error.status || error.response?.status || 500;
      res.status(status).json({ error: error.message || 'AI request failed' });
    }
  });

  const respondSchema = z.object({
    parsedData: z.any(),
    chatHistory: z.array(z.object({ role: z.string(), content: z.string() })).max(20),
    onboardingStep: z.number().min(0).max(8).optional()
  });

  app.post('/api/ai/respond', requireAuth, aiLimiter, perUserAiLimiter, async (req, res) => {
    if (!firestore) return res.status(503).json({ error: 'Database unavailable' });
    const activeKey = process.env.GROQ_API_KEY || '';
    if (!activeKey || activeKey === 'YOUR_GROQ_KEY') {
      return res.status(500).json({ error: 'Groq API key not configured' });
    }
    try {
      const { parsedData, chatHistory } = respondSchema.parse(req.body);
      
      const uid = (req as any).user.uid;
      let profile: any = {};
      try {
        const docSnap = await firestore.collection('users').doc(uid).get();
        profile = docSnap.exists ? (docSnap.data()?.profile || {}) : {};
      } catch (err: any) {
        console.error("Firestore get error:", err.message);
      }
      const fmt = (n: number) => `₹${(n||0).toLocaleString('en-IN')}`;

      let formattedMessages: Array<{ role: 'user' | 'assistant'; content: string }> = chatHistory.slice(-12).map((h: { role: string; content: string }) => ({
        role: h.role === 'user' ? 'user' : 'assistant',
        content: h.content
      }));
      if (formattedMessages.length > 0 && formattedMessages[0].role === 'assistant') {
        formattedMessages.shift();
      }

      const systemCtx = `You are PapaProfit AI — a highly competent, elite AI financial planner for Indian users.

Your goal is to provide sharp, contextual, financially analytical, and actionable advice to your client. You MUST act like a highly disciplined human advisor (like a CFP, CA, or behavioral economist).

CRITICAL BEHAVIOR RULES (ADHERE STRICTLY):
1. ASK QUESTIONS FIRST (FOLLOW-UP CHAINING): Do NOT give generic advice if data is missing. If the user asks for help or says they are struggling financially, YOU MUST politely ask for specific numbers (e.g., income, biggest expense, debt) BEFORE recommending solutions. Ask ONLY 1 question at a time.
2. FINANCIAL REASONING ENGINE: Calculate cash flow, debt burden, and savings rate mentally. Detect risky behavior automatically (negative cash flow, high EMI stress, no emergency buffer, high-interest debt) and challenge bad decisions respectfully but firmly. Explain the "WHY" behind financial mechanics.
3. CHALLENGE RISKY DECISIONS: If the user wants to invest in equity but has 0 emergency fund and high credit card debt, explicitly state that stabilizing high-interest liabilities and safety nets comes first. Identify cash flow leaks and debt risks immediately.
4. STOP GENERIC MOTIVATIONAL FLUFF: Never use phrases like "You're doing great!", "Keep it up!", "Financial freedom is possible!", "That's awesome!". Use concise observations, direct calculations, tradeoffs, and next actions.
5. CONCISE, STRUCTURED FORMAT: Use short paragraphs and bullet points. Avoid massive walls of text. Make advice extremely scan-friendly.
   Every full analysis MUST loosely follow this format:
   - Observation: Fact-based takeaway.
   - Implication/Risk: What it means for them logically.
   - Recommendation/Question: The actionable next step or the next critical question you need answered.
6. INDIAN CONTEXT: Understand SIP, EMI, FD, PPF, ELSS, HRA, EPF, mutual funds, 80C, new regime vs old regime tax slabs (FY25-26), lakh/crore naming, and Indian taxation rules. Use ₹ symbol.
7. WHAT-IF ANALYSIS: Support hypothetical reasoning. If they ask "What if I invest 10k more?", estimate the long-term impact realistically using standard compounded returns (e.g., 10-12% for equity). If they ask about paying extra EMI, calculate the time saved.
8. TRUST & REALISM: ONLY give realistic estimates. Never guarantee returns. If data is completely missing, explicitly state you need it to model a precise plan. NEVER invent numbers. Do not pretend certainty.
9. MEMORY & CONTINUITY: Rely heavily on the CLIENT PROFILE section below. It contains their latest extracted data and insights. Do NOT re-ask questions if the number is already present in their profile.
10. PROACTIVE FOLLOW-UPS: Always end your response with a contextual follow-up question. "Do you want help reducing these expenses?", "Want a SIP plan for this goal?", "Should I calculate how long your emergency fund lasts?", "Want a tax optimization estimate?".

WHEN YOU LACK DATA, PRIORITIZE QUESTIONS IN THIS ORDER (Ask 1 max at a time):
1. Monthly Income (In-hand)
2. Monthly Expenses
3. Debt / EMIs
4. Emergency Fund Status
5. Core Financial Goals
6. Current Investments

CLIENT PROFILE OVERVIEW (Always reference these numbers first):
Name: ${profile.personal?.name || 'Unknown'}
Age: ${profile.personal?.age || 'Unknown'}
Major Concerns: ${(profile.personal?.majorConcerns || []).join(', ') || 'None identified yet'}

TOTAL REPORTED METRICS (Mental Model):
- Monthly Income: ${fmt(finance.totalIncome(profile))}
- Monthly Expenses: ${fmt(finance.totalExpenses(profile))}
- Monthly Surplus/Cash Flow: ${fmt(profile.metrics?.monthlyCashFlow || 0)}
- Total Assets: ${fmt(finance.totalAssets(profile))}
- Total Loans/Liabilities: ${fmt(finance.totalLiabilities(profile))}
- Active Goals: ${(profile.goals || []).map((g: any) => g.name).join(', ') || 'None detailed'}
- Debt Accounts: ${(profile.loans || []).map((l: any) => l.name).join(', ') || 'None detailed'}
- Savings Rate: ${(profile.metrics?.savingsRate || 0).toFixed(1)}%
- Emergency Fund Runway: ${(profile.metrics?.emergencyFundRunwayMonths || 0).toFixed(1)} months
- Financial Health Score: ${profile.metrics?.financialHealthScore || 0}/100

AI MEMORY / INSIGHTS:
- Prior recommendations & insights generated so far: ${(profile.insights || []).map((i: any) => i.title).join(', ') || 'None yet'}

CONTEXT FROM BACKEND: 
- Just extracted data: ${parsedData?.updates?.length > 0 ? parsedData.updates.join(', ') : 'None'}
- Parsing intent: ${parsedData?.intent || 'general'}
- Recommended Action by Backend Engine: ${getNextBestAction(profile).title || 'Complete profile'}

${profile?.preferences?.language === 'hi' ? 'CRITICAL: You MUST respond purely in Hindi (हिंदी), maintaining the elite financial advisor persona. Translate all your insights, tone, and financial advice exactly. DO NOT use English unless for standard financial terms (like SIP, EMI) if commonly understood.' : 'Respond in English.'}

Respond to the user with discipline, clarity, precision, and a calm, trustworthy demeanor. Do not apologize endlessly. Do not use filler intro text.`;

      const completion = await groq.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: systemCtx },
          ...formattedMessages
        ],
        max_tokens: 600,
        temperature: 0.7
      });
      const text = completion.choices[0]?.message?.content || 'Sorry, I had trouble responding. Please try again.';
      res.json({ text });
    } catch (error: any) {
      console.error('Groq API Error:', error?.message);
      const status = error.status || error.response?.status || 500;
      res.status(status).json({ error: error.message || 'AI request failed' });
    }
  });



  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
