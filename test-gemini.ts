import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;
console.log('Key length:', apiKey ? apiKey.length : 0);

const ai = new GoogleGenAI();
ai.models.generateContent({ model: 'gemini-2.0-flash', contents: 'Hi' })
  .then(res => console.log('SUCCESS:', res.text))
  .catch(err => console.error('ERROR:', err.message));
