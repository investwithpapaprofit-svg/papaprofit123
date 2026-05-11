import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import yahooFinance from 'yahoo-finance2';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import Stripe from 'stripe';
import { ONBOARDING_QUESTIONS, GEMINI_MODEL } from './src/constants.js';
import { GoogleGenAI, Type } from '@google/genai';
import { finance } from './src/finance.js';

dotenv.config();

if (!process.env.GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY is missing');
}

console.log(
  'Gemini key loaded:',
  process.env.GEMINI_API_KEY
    ? `YES (${process.env.GEMINI_API_KEY.slice(0, 8)}...)`
    : 'NO'
);

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || ''
});

const stripe: Stripe | null = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

const appUrl = process.env.APP_URL || 'http://localhost:3000/';
console.log('APP_URL:', appUrl);

let firestore: any;

// Initialize Firebase Admin
const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
if (fs.existsSync(firebaseConfigPath)) {
  const config = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8'));
  const adminApp = admin.initializeApp({
    projectId: config.projectId,
  });
  firestore = getFirestore(adminApp, config.firestoreDatabaseId);
} else {
  try {
    firestore = admin.firestore();
  } catch (e) {
    console.error("Firebase admin init error", e);
  }
}

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
          await firestore.collection('users').doc(uid).set({
            profile: {
              isPremium: true
            }
          }, { merge: true });
          console.log(`Premium activated via webhook for user: ${uid}`);
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
      const quotes = results.quotes.filter((q: any) => q.isYahooFinance || q.quoteType === 'EQUITY');
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

  app.get('/api/test-gemini', requireAuth, async (_, res) => {
    try {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [
          {
            role: 'user',
            parts: [{ text: 'Say hello' }]
          }
        ]
      });

      res.json({
        success: true,
        text: response.text
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
    try {
      const { msg, chatHistory = [] } = parseSchema.parse(req.body);
      const previousAssistantMsg = chatHistory.filter((m: any) => m.role === 'ai').at(-1)?.content;

      const systemCtx = `Parse financial input.
      
CRITICAL CONTEXT RULE:
The user's latest message must be interpreted in the context of the assistant's previous question. 

Examples:

Assistant: "What's your monthly expense roughly?"
User: "around 80000"

Interpretation:
{
  "expenses": [{ "name": "Monthly Expenses", "value": 80000 }],
  "clarificationNeeded": false
}

Assistant: "How much do you have invested?"
User: "5 lakhs"

Interpretation:
{
  "assets": [{ "name": "Investments", "value": 500000 }]
}

Assistant: "Any loans?"
User: "2 lakh car loan"

Interpretation:
{
  "loans": [{ "name": "Car Loan", "amount": 200000 }]
}

Do NOT ask for clarification if the assistant's previous message already clearly establishes the category being discussed.
Short numeric replies like "80k", "around 50k", "2 lakh", "yes", "no" must inherit context from the previous assistant message.

Current profile limits clarification: If unclear whether user means per month or year, add clarificationNeeded: true and provide clarificationMessage. Extract numeric values completely. Map intents to: ['income', 'expense', 'subscription', 'loan', 'asset', 'portfolio', 'goal', 'general']. If multiple apply, pick the primary one or general. Output strict JSON fitting the schema.`;

      const contents: any[] = [];
      if (previousAssistantMsg) {
        contents.push({ role: 'model', parts: [{ text: previousAssistantMsg }] });
      }
      contents.push({ role: 'user', parts: [{ text: msg }] });

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents,
        config: {
          systemInstruction: systemCtx,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              intent: { type: Type.STRING },
              confidenceScore: { type: Type.NUMBER },
              clarificationNeeded: { type: Type.BOOLEAN },
              clarificationMessage: { type: Type.STRING },
              extracted_data: {
                type: Type.OBJECT,
                properties: {
                  personal: {
                    type: Type.OBJECT,
                    properties: { name: { type: Type.STRING }, age: { type: Type.NUMBER }, riskProfile: { type: Type.STRING } }
                  },
                  incomeSources: {
                    type: Type.ARRAY,
                    items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, value: { type: Type.NUMBER } } }
                  },
                  expenses: {
                    type: Type.ARRAY,
                    items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, value: { type: Type.NUMBER }, category: { type: Type.STRING } } }
                  },
                  subscriptions: {
                    type: Type.ARRAY,
                    items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, cost: { type: Type.NUMBER }, billingCycle: { type: Type.STRING } } }
                  },
                  loans: {
                    type: Type.ARRAY,
                    items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, amount: { type: Type.NUMBER }, rate: { type: Type.NUMBER }, emi: { type: Type.NUMBER } } }
                  },
                  assets: {
                    type: Type.ARRAY,
                    items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, value: { type: Type.NUMBER }, type: { type: Type.STRING }, mortgageable: { type: Type.BOOLEAN } } }
                  },
                  portfolio: {
                    type: Type.ARRAY,
                    items: { type: Type.OBJECT, properties: { symbol: { type: Type.STRING }, name: { type: Type.STRING }, quantity: { type: Type.NUMBER }, averageBuyPrice: { type: Type.NUMBER }, assetType: { type: Type.STRING } } }
                  },
                  goals: {
                    type: Type.ARRAY,
                    items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, target: { type: Type.NUMBER }, months: { type: Type.NUMBER }, type: { type: Type.STRING }, saved: { type: Type.NUMBER } } }
                  }
                }
              }
            }
          }
        }
      });
      const data = JSON.parse(response.text || "{}");
      res.json(data);
    } catch (error: any) {
      console.error('Gemini API Error:', {
        message: error?.message,
        status: error?.status,
        stack: error?.stack
      });
      if (error?.message?.includes('API_KEY_INVALID') || error?.message?.includes('API key not valid')) {
        res.status(500).json({ error: 'Gemini API key invalid' });
      } else {
        res.status(500).json({ error: 'AI request failed' });
      }
    }
  });

  const respondSchema = z.object({
    userMsg: z.string().max(2000).optional(),
    parsedData: z.any(),
    chatHistory: z.array(z.object({ role: z.string(), content: z.string() })).max(10),
    onboardingStep: z.number().min(0).max(8).optional()
  });

  app.post('/api/ai/respond', requireAuth, aiLimiter, async (req, res) => {
    try {
      const { parsedData, chatHistory, onboardingStep } = respondSchema.parse(req.body);
      
      const uid = (req as any).user.uid;
      const docSnap = await firestore.collection('users').doc(uid).get();
      const profile = docSnap.exists ? (docSnap.data()?.profile || {}) : {};
      const fmt = (n: number) => `₹${(n||0).toLocaleString('en-IN')}`;
      const fhsScore = profile.metrics?.financialHealthScore || 0;

      let formattedMessages = chatHistory.slice(-6).map((h: any) => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.content }]
      }));
      if (formattedMessages.length > 0 && formattedMessages[0].role === 'model') {
        formattedMessages.shift();
      }

      const onboardingCtx = onboardingStep !== undefined && onboardingStep >= 0 && onboardingStep < ONBOARDING_QUESTIONS.length
        ? `\nONBOARDING STATUS: The user is currently in a guided setup at step ${onboardingStep}. The current question being evaluated is: "${ONBOARDING_QUESTIONS[onboardingStep]}". DO NOT give a full financial plan yet. Prioritize: 1. expenses, 2. loans, 3. savings, 4. investments, 5. goals. If data is missing, casually ask for it step-by-step.`
        : "";

      const systemCtx = `You are PapaProfit — a smart, modern financial copilot for Indian users.

Your personality:
* Talk like a real human, not a finance article.
* Be conversational, short, warm, intelligent, and slightly playful.
* Sound premium and confident.
* NEVER sound robotic, corporate, or overly motivational.
* NEVER flood the user with long paragraphs.
* NEVER dump huge summaries unless explicitly asked.
* NEVER give more than 3 short paragraphs at once.
* Keep most replies under 80 words.
* Ask only ONE important question at a time.
* React naturally before asking the next thing.

VERY IMPORTANT:
This is a chat app, not a report generator.
BAD: Long essays, huge bullet lists, multiple sections like "Summary", "Insights", "Next Action", too much financial jargon, giving complete financial plans too early.

GOOD EXAMPLES:
User: "I earn 1.4 lakh"
Assistant: "Nice. What's your monthly spend roughly?"
User: "Around 60k"
Assistant: "That's actually strong. You're saving more than most people already. Any loans or EMIs?"

Conversation style rules:
* Use short responses.
* Use occasional emojis naturally, but not excessively.
* Avoid repeating known information.
* Do not explain obvious things.
* Do not overpraise the user.
* Do not mention percentages like "top 95% of India" unless specifically relevant.
* Avoid giant calculations unless the user asks.
* Be emotionally intelligent and curious.

Advice behavior:
* Give actionable advice in 1-3 lines.
* Prefer simple practical suggestions over theory.
* Be direct and useful.

Formatting rules:
* No markdown headings.
* No "Summary:" sections.
* No giant bullet dumps.
* No more than 3 bullets at once.
* Prefer plain chat-style text.
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

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: formattedMessages,
        config: {
          systemInstruction: systemCtx
        }
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error('Gemini API Error:', {
        message: error?.message,
        status: error?.status,
        stack: error?.stack
      });
      if (error?.message?.includes('API_KEY_INVALID') || error?.message?.includes('API key not valid')) {
        res.status(500).json({ error: 'Gemini API key invalid' });
      } else {
        res.status(500).json({ error: 'AI request failed' });
      }
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
