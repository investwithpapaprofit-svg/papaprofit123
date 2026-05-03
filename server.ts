import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import YahooFinance from 'yahoo-finance2';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

dotenv.config();

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

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/api/premium/upgrade', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const uid = decodedToken.uid;

      // Update user profile in Firestore to set isPremium: true
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

  app.get('/api/stock/search', async (req, res) => {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Query parameter q is required' });
    }
    try {
      console.log('Searching stock:', q);
      const results = await yahooFinance.search(q);
      const quotes = results.quotes.filter((q: any) => q.isYahooFinance || q.quoteType === 'EQUITY');
      res.json(quotes.slice(0, 5));
    } catch (error: any) {
      console.error('Stock search error:', error.message || error);
      res.status(500).json({ error: 'Failed to search stock', details: error.message });
    }
  });

  app.get('/api/stock/quote', async (req, res) => {
    const { symbol } = req.query;
    if (!symbol || typeof symbol !== 'string') {
      return res.status(400).json({ error: 'Query parameter symbol is required' });
    }
    try {
      console.log('Fetching quote for:', symbol);
      const quote = await yahooFinance.quote(symbol);
      res.json(quote);
    } catch (error: any) {
      console.error('Stock quote error:', error.message || error);
      res.status(500).json({ error: 'Failed to fetch stock quote', details: error.message });
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
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
