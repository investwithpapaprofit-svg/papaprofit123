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
import Stripe from 'stripe';
import { ONBOARDING_QUESTIONS } from './src/constants.js';
import { finance } from './src/finance.js';
import { AIParseResponseSchema } from './src/schemas.js';
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
  const projectId = process.env.FIREBASE_PROJECT_ID || 'papaprofit-7aa7e';
  const dbId = process.env.FIREBASE_DATABASE_ID || '(default)';
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
  const PORT = 3000;

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
        connectSrc: ["'self'", "https://*.googleapis.com", "https://*.firebaseio.com", "wss://*.firebaseio.com"],
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

  // Webhook for premium checkout (MUST be before express.json() for raw body verification)
  app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
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
    chatHistory: z.array(z.object({ role: z.string(), content: z.string() })).max(10).optional()
  });

  app.post('/api/ai/parse', requireAuth, aiLimiter, async (req, res) => {
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
            content: `You are a financial data extraction engine. Extract financial entities from the user message and return ONLY a valid JSON object with these fields: intent (string), confidenceScore (number 0-1), clarificationNeeded (boolean), clarificationMessage (string), extracted_data (object containing any of: personal, incomeSources, expenses, subscriptions, loans, assets, portfolio, goals). Use the assistant's previous message as context to interpret short replies like "80k" or "yes". No markdown, no explanation, just JSON.
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
      res.status(500).json({ error: 'AI request failed. Please try again.' });
    }
  });

  const respondSchema = z.object({
    userMsg: z.string().max(2000).optional(),
    parsedData: z.any(),
    chatHistory: z.array(z.object({ role: z.string(), content: z.string() })).max(10),
    onboardingStep: z.number().min(0).max(8).optional()
  });

  app.post('/api/ai/respond', requireAuth, aiLimiter, async (req, res) => {
    const activeKey = process.env.GROQ_API_KEY || '';
    if (!activeKey || activeKey === 'YOUR_GROQ_KEY') {
      return res.status(500).json({ error: 'Groq API key not configured' });
    }
    try {
      const { parsedData, chatHistory, onboardingStep } = respondSchema.parse(req.body);
      
      const uid = (req as any).user.uid;
      let profile: any = {};
      try {
        const docSnap = await firestore.collection('users').doc(uid).get();
        profile = docSnap.exists ? (docSnap.data()?.profile || {}) : {};
      } catch (err: any) {
        console.error("Firestore get error:", err.message);
      }
      const fmt = (n: number) => `₹${(n||0).toLocaleString('en-IN')}`;
      const fhsScore = profile.metrics?.financialHealthScore || 0;

      let formattedMessages: Array<{ role: 'user' | 'assistant'; content: string }> = chatHistory.slice(-6).map((h: { role: string; content: string }) => ({
        role: h.role === 'user' ? 'user' : 'assistant',
        content: h.content
      }));
      if (formattedMessages.length > 0 && formattedMessages[0].role === 'assistant') {
        formattedMessages.shift();
      }

      const onboardingCtx = onboardingStep !== undefined && onboardingStep >= 0 && onboardingStep < ONBOARDING_QUESTIONS.length
        ? `\nONBOARDING STATUS: The user is currently in a guided setup at step ${onboardingStep}. The current question being evaluated is: "${ONBOARDING_QUESTIONS[onboardingStep]}". DO NOT give a full financial plan yet. Prioritize: 1. expenses, 2. loans, 3. savings, 4. investments, 5. goals. If data is missing, casually ask for it step-by-step.`
        : "";

      const systemCtx = `You are PapaProfit AI — an elite AI financial strategist for Indian users.

You behave like:
- a personal CFO
- a financial planner
- a wealth advisor
- a debt strategist
- a budgeting coach

Your job is to deeply understand the user's finances BEFORE giving advice.

Rules:
- Ask follow-up questions when context is missing
- Ask only 1–2 questions at a time
- Be conversational and intelligent
- Use short clean formatting
- Explain concepts simply
- Think step-by-step
- Prioritize emergency funds first
- Reduce high-interest debt aggressively
- Give practical actionable advice
- Detect risky spending patterns
- Adapt to beginner vs advanced users
- Never sound robotic
- Never give generic motivational fluff
- Never overwhelm users with jargon
- Never hallucinate financial facts

If information is missing:
ASK QUESTIONS FIRST.

If the user gives partial answers like:
"80k"
"yes"
"monthly"
"fixed"
Use previous conversation context intelligently.

Your tone:
- premium
- calm
- sharp
- trustworthy
- modern
- intelligent

You should feel like a ₹50,000/month financial advisor.
${onboardingCtx}

CLIENT PROFILE:
Name: ${profile.personal?.name || 'Unknown'}
Age: ${profile.personal?.age || 'Unknown'}
Risk Profile: ${profile.personal?.riskProfile || 'Unknown'}

METRICS:
Monthly Income: ${fmt(finance.totalIncome(profile))}
Monthly Expenses: ${fmt(finance.totalExpenses(profile))}
EMI: ${fmt(finance.totalEMI(profile))}
Total Loans: ${fmt(finance.totalLiabilities(profile))}
Total Assets: ${fmt(finance.totalAssets(profile))}

ADVANCED METRICS:
Net worth: ${fmt(profile.metrics?.netWorth || 0)}
Monthly surplus: ${fmt(profile.metrics?.monthlyCashFlow || 0)}
Savings rate: ${(profile.metrics?.savingsRate || 0).toFixed(1)}%
Financial Health Score: ${fhsScore > 0 ? fhsScore + '/100' : 'Not enough data yet'}

CURRENT COPILOT ANALYSIS:
- Extracted: ${parsedData?.updates?.length > 0 ? parsedData.updates.join(', ') : 'No new hard data found.'}
- Parsing Intent: ${parsedData?.intent || 'general'}
- Recommended Action: ${finance.getNextBestAction(profile)}`;

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
      res.status(500).json({ error: 'AI request failed. Please try again.' });
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
