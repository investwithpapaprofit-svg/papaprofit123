import { UserProfile } from './types';
import { finance } from './finance';
import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const parser = {
  async parse(msg: string, currentProfile: UserProfile, previousAssistantMsg?: string): Promise<{ intent: string; confidence: number; updates: string[]; newProfile: UserProfile, clarificationMsg?: string }> {
    const newProfile = JSON.parse(JSON.stringify(currentProfile)) as UserProfile;
    const updates: string[] = [];
    let intent = 'general';
    let confidence = 0.5;

    const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

    try {
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

Current profile limits clarification: If unclear whether user means per month or year, add clarificationNeeded: true and provide clarificationMessage. Extract numeric values completely. Map intents to: ['income', 'expense', 'subscription', 'loan', 'asset', 'portfolio', 'goal', 'general']. If multiple apply, pick the primary one or general. Output strict JSON fitting the schema.` + (previousAssistantMsg ? `\n\nPrevious Assistant Message: "${previousAssistantMsg}"` : "");

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ role: 'user', parts: [{ text: msg }] }],
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
                    items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, target: { type: Type.NUMBER }, months: { type: Type.NUMBER }, type: { type: Type.STRING } } }
                  }
                }
              }
            }
          }
        }
      });
      
      const rawText = response.text || "{}";
      const data = JSON.parse(rawText);
      
      intent = data.intent || 'general';
      confidence = data.confidenceScore || 0.5;
      const extracted = data.extracted_data || {};
      const clarificationMsg = data.clarificationNeeded && data.clarificationMessage ? data.clarificationMessage : undefined;

      if (clarificationMsg) {
         return { intent: 'clarification', confidence, updates: [], newProfile: currentProfile, clarificationMsg };
      }

      if (extracted.personal && typeof extracted.personal === 'object') {
          newProfile.personal = newProfile.personal || {};
          if(extracted.personal.name) newProfile.personal.name = extracted.personal.name;
          if(extracted.personal.age) newProfile.personal.age = extracted.personal.age;
          if(extracted.personal.riskProfile) newProfile.personal.riskProfile = extracted.personal.riskProfile;
          updates.push("Personal details updated");
      }

      if (Array.isArray(extracted.incomeSources) && extracted.incomeSources.length > 0) {
        extracted.incomeSources.forEach((source: any) => {
          if (!source || typeof source.name !== 'string' || typeof source.value !== 'number') return;
          const existing = newProfile.income.find(s => s.name?.toLowerCase() === source.name?.toLowerCase());
          if (existing) existing.value = source.value;
          else newProfile.income.push(source);
          updates.push(`Income source '${source.name}' recorded as ${fmt(source.value)}/mo`);
        });
      }

      if (Array.isArray(extracted.expenses) && extracted.expenses.length > 0) {
        extracted.expenses.forEach((expense: any) => {
          if (!expense || typeof expense.name !== 'string' || typeof expense.value !== 'number') return;
          const existing = newProfile.expenses.find(e => e.name?.toLowerCase() === expense.name?.toLowerCase());
          if (existing) {
              existing.value = expense.value;
              if (expense.category) existing.category = expense.category;
          }
          else newProfile.expenses.push(expense);
          updates.push(`Expense '${expense.name}' recorded as ${fmt(expense.value)}/mo`);
        });
      }

      if (Array.isArray(extracted.subscriptions) && extracted.subscriptions.length > 0) {
          extracted.subscriptions.forEach((sub: any) => {
             if (!sub || typeof sub.name !== 'string' || typeof sub.cost !== 'number') return;
             const existing = newProfile.subscriptions.find(s => s.name?.toLowerCase() === sub.name?.toLowerCase());
             if (existing) {
                 existing.cost = sub.cost;
                 if (sub.billingCycle) existing.billingCycle = sub.billingCycle;
             } else newProfile.subscriptions.push(sub);
             updates.push(`Subscription '${sub.name}' recorded at ${fmt(sub.cost)}/${sub.billingCycle || 'mo'}`);
          });
      }

      if (Array.isArray(extracted.loans) && extracted.loans.length > 0) {
        extracted.loans.forEach((loan: any) => {
          if (!loan || typeof loan.name !== 'string' || typeof loan.amount !== 'number') return;
          const existing = newProfile.loans.find(l => l.name?.toLowerCase() === loan.name?.toLowerCase());
          if (existing) {
            if(loan.amount) existing.amount = loan.amount;
            if(loan.rate) existing.rate = loan.rate;
            if(loan.emi) existing.emi = loan.emi;
          } else {
            newProfile.loans.push({ name: loan.name || 'Debt', amount: loan.amount || 0, rate: loan.rate || 0, emi: loan.emi || 0 });
          }
          updates.push(`Loan '${loan.name}' recorded with outstanding ${fmt(loan.amount)}`);
        });
      }

      if (Array.isArray(extracted.assets) && extracted.assets.length > 0) {
          extracted.assets.forEach((asset: any) => {
             if (!asset || typeof asset.name !== 'string' || typeof asset.value !== 'number') return;
             const existing = newProfile.assets.find(a => a.name?.toLowerCase() === asset.name?.toLowerCase());
             if (existing) {
                 existing.value = asset.value;
                 if(asset.mortgageable !== undefined) existing.mortgageable = asset.mortgageable;
             } else {
                 newProfile.assets.push({ name: asset.name, type: asset.type || 'other', value: asset.value, mortgageable: asset.mortgageable });
             }
             updates.push(`Asset '${asset.name}' recorded worth ${fmt(asset.value)}`);
          });
      }

      if (Array.isArray(extracted.portfolio) && extracted.portfolio.length > 0) {
          extracted.portfolio.forEach((holding: any) => {
              if (!holding || (typeof holding.symbol !== 'string' && typeof holding.name !== 'string')) return;
              const symbolToMatch = holding.symbol || holding.name?.substring(0,4).toUpperCase();
              const existing = newProfile.portfolio.find(p => p.symbol?.toLowerCase() === symbolToMatch?.toLowerCase() || p.name?.toLowerCase() === holding.name?.toLowerCase());
              if (existing) {
                  if (holding.quantity) existing.quantity = holding.quantity;
                  if (holding.averageBuyPrice) existing.averageBuyPrice = holding.averageBuyPrice;
              } else {
                  newProfile.portfolio.push({
                      symbol: symbolToMatch,
                      name: holding.name || holding.symbol,
                      assetType: holding.assetType || 'other',
                      quantity: holding.quantity || 1,
                      averageBuyPrice: holding.averageBuyPrice || 0,
                      currentPrice: holding.averageBuyPrice || 0
                  });
              }
              updates.push(`Portfolio updated with ${holding.quantity || 1}x ${holding.name || holding.symbol}`);
          });
      }
      
      if (Array.isArray(extracted.goals) && extracted.goals.length > 0) {
          extracted.goals.forEach((goal: any) => {
             if (!goal || typeof goal.name !== 'string' || typeof goal.target !== 'number') return;
             const existing = newProfile.goals.find(g => g.name?.toLowerCase() === goal.name?.toLowerCase());
             if (existing) {
                 if (goal.target) existing.target = goal.target;
                 if (goal.months) existing.months = goal.months;
             } else {
                 newProfile.goals.push({
                     name: goal.name, target: goal.target, months: goal.months || 60, saved: 0, type: goal.type || 'custom'
                 });
             }
             updates.push(`Goal '${goal.name}' set for ${fmt(goal.target)}`);
          });
      }

    } catch (e) {
      console.error("Server parsing failed", e);
      intent = 'general';
    }

    finance.recalculateMetrics(newProfile);
    
    // Log history
    if (updates.length > 0) {
        newProfile.history.push({
            date: new Date().toISOString(),
            timestamp: Date.now(),
            type: 'system_update',
            description: `Extracted data from message: ${msg.substring(0, 50)}...`,
            metricsSnapshot: newProfile.metrics
        });
    }

    newProfile.lastUpdated = new Date().toISOString();
    return { intent, confidence, updates, newProfile };
  }
};
