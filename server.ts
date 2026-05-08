import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import YahooFinance from 'yahoo-finance2';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import Stripe from 'stripe';
import { finance } from './src/finance';

dotenv.config();

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null as unknown as Stripe;
const yahooFinance = new YahooFinance();

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
  firestore = admin.firestore();
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

async function startServer() {
  const app = express();
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
  });
  app.use(limiter);

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
           await firestore.collection('users').doc(uid).set({ profile: { isPremium: true } }, { merge: true });
           return res.json({ url: '/?mock_success=true' });
        }
        return res.status(500).json({ error: 'Stripe is not configured' });
      }

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



  // AI Parse and AI Respond endpoints have been moved to the client (src/parser.ts and src/insights.ts)
  



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
