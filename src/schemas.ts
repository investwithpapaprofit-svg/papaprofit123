import { z } from 'zod';

export const AIParseResponseSchema = z.object({
  intent: z.string().optional().default('general'),
  confidenceScore: z.number().min(0).max(1).optional().default(0.5),
  clarificationNeeded: z.boolean().optional(),
  clarificationMessage: z.string().optional(),
  extracted_data: z.object({
    personal: z.object({ name: z.string().optional(), age: z.number().optional(), riskProfile: z.enum(['conservative', 'moderate', 'aggressive']).optional() }).optional(),
    incomeSources: z.array(z.object({ name: z.string(), value: z.number() })).optional(),
    expenses: z.array(z.object({ name: z.string(), value: z.number(), category: z.string().optional() })).optional(),
    subscriptions: z.array(z.object({ name: z.string(), cost: z.number(), billingCycle: z.enum(['monthly', 'yearly']).optional() })).optional(),
    loans: z.array(z.object({ name: z.string(), amount: z.number().optional(), rate: z.number().optional(), emi: z.number().optional() })).optional(),
    assets: z.array(z.object({ name: z.string(), type: z.string().optional(), value: z.number(), mortgageable: z.boolean().optional() })).optional(),
    portfolio: z.array(z.object({ symbol: z.string().optional(), name: z.string().optional(), assetType: z.string().optional(), quantity: z.number().optional(), averageBuyPrice: z.number().optional() })).optional(),
    goals: z.array(z.object({ name: z.string(), target: z.number(), months: z.number().optional(), type: z.string().optional() })).optional()
  }).optional()
});

export const StockQuoteSchema = z.object({
  regularMarketPrice: z.number().optional(),
  symbol: z.string().optional(),
  shortName: z.string().optional()
}).passthrough();

export const StockSearchResponseSchema = z.array(z.object({
  symbol: z.string(),
  shortName: z.string().optional(),
  quoteType: z.string().optional(),
  exchDisp: z.string().optional()
}).passthrough());
