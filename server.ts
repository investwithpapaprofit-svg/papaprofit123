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
import { GoogleGenAI, Type, Schema } from '@google/genai';
import { z } from 'zod';

dotenv.config();

const yahooFinance = new YahooFinance();

const appUrl = process.env.APP_URL || 'http://localhost:3000/';
console.log('APP_URL:', appUrl);

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || '' });

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

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Security Middlewares
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));
  
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // limit each IP to 200 requests per windowMs
  });
  app.use(limiter);

  app.use(express.json());

  // API routes
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/api/premium/upgrade', requireAuth, async (req, res) => {
    try {
      const uid = (req as any).user.uid;
      await firestore.collection('users').doc(uid).set({
        profile: {
          isPremium: true
        }
      }, { merge: true });

      res.json({ success: true });
    } catch (error) {
      console.error('Premium upgrade error:', error);
      res.status(500).json({ error: 'Failed to upgrade' });
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

  app.post('/api/ai/parse', requireAuth, async (req, res) => {
    try {
      const parseSchema = z.object({ msg: z.string().min(1) });
      const parsedReq = parseSchema.safeParse(req.body);
      
      if (!parsedReq.success) {
        return res.status(400).json({ error: 'Message is required and must be a string' });
      }
      
      const { msg } = parsedReq.data;

      const schema: Schema = {
        type: Type.OBJECT,
        properties: {
          intent: { type: Type.STRING, description: "Primary intent: income, expense, asset, loan, goal, portfolio, personal, clarification, or general." },
          confidenceScore: { type: Type.NUMBER, description: "Confidence score from 0.0 to 1.0. Lower it if inputs are ambiguous or missing key info." },
          clarificationNeeded: { type: Type.BOOLEAN, description: "Set to true if you cannot confidently extract an exact number (e.g. they provided a huge range or entirely ambiguous text like 'I have money')." },
          clarificationMessage: { type: Type.STRING, description: "If clarification is needed, write a short question asking the user to specify (e.g., 'Do you have an exact estimate for your gold assets?')." },
          extracted_data: {
            type: Type.OBJECT,
            properties: {
              personal: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, age: { type: Type.NUMBER }, riskProfile: { type: Type.STRING, enum: ['conservative', 'moderate', 'aggressive'] } } },
              incomeSources: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, value: { type: Type.NUMBER } } } },
              expenses: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, value: { type: Type.NUMBER }, category: { type: Type.STRING } } } },
              subscriptions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, cost: { type: Type.NUMBER }, billingCycle: { type: Type.STRING, enum: ['monthly', 'yearly'] } } } },
              loans: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, amount: { type: Type.NUMBER }, rate: { type: Type.NUMBER }, emi: { type: Type.NUMBER } } } },
              assets: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, type: { type: Type.STRING, enum: ['property', 'gold', 'cash', 'vehicle', 'other'] }, value: { type: Type.NUMBER }, mortgageable: { type: Type.BOOLEAN } } } },
              portfolio: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { symbol: { type: Type.STRING }, name: { type: Type.STRING }, assetType: { type: Type.STRING, enum: ['stock', 'etf', 'mutual_fund', 'crypto', 'bond', 'other'] }, quantity: { type: Type.NUMBER }, averageBuyPrice: { type: Type.NUMBER } } } },
              goals: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, target: { type: Type.NUMBER }, months: { type: Type.NUMBER }, type: { type: Type.STRING } } } }
            }
          }
        }
      };

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `You are an advanced financial data extraction engine. Analyze the user message and extract all explicit and implied financial entities.
        
        RULES:
        - Income/Expenses are ALWAYS MONTHLY. Average out variable incomes.
        - Handle ranges properly: If a user says "40-50k", extract 45000 as the average. If the range is too broad, set clarificationNeeded to true.
        - Assets/Loans are ALWAYS TOTAL CURRENT BALANCE.
        - Handle numerical shorthands: 'k' -> 1000, 'lakh' -> 100000, 'cr' -> 10000000.
        - Parse Multiple Entities: Extract EVERY entity mentioned. 
        - If the message is completely ambiguous or missing critical amounts for their main point, set clarificationNeeded to true and write a clarificationMessage.
        - Use confidence score to indicate how sure you are about the extracted numbers and intents.
        - Only output valid JSON matching the schema.
        
        Message: "${msg}"`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: schema,
          temperature: 0.1
        }
      });
      
      const data = JSON.parse(response.text || '{}');
      res.json({ data });
    } catch (error: any) {
      console.error('AI Parse error:', error.message || error);
      res.status(500).json({ error: 'Failed to parse message' });
    }
  });

  app.post('/api/ai/respond', requireAuth, async (req, res) => {
    try {
      const respondSchema = z.object({
        messages: z.array(z.any()).min(1),
        systemCtx: z.string().min(1)
      });
      const parsedReq = respondSchema.safeParse(req.body);
      
      if (!parsedReq.success) {
        return res.status(400).json({ error: 'Messages array and systemCtx are required' });
      }

      const { messages, systemCtx } = parsedReq.data;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: messages,
        config: {
          systemInstruction: systemCtx,
          temperature: 0.7,
          maxOutputTokens: 600
        }
      });
      
      const text = response.text || 'Sorry, I had trouble generating a response.';
      res.json({ text });
    } catch (error: any) {
      console.error('AI Respond error:', error.message || error);
      res.status(500).json({ error: 'Failed to generate response' });
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
