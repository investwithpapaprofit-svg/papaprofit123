import { UserProfile } from './types';
import { GoogleGenAI, Type, Schema } from '@google/genai';
import { finance } from './finance';

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || '' });

export const parser = {
  async parse(msg: string, currentProfile: UserProfile): Promise<{ intent: string; confidence: number; updates: string[]; newProfile: UserProfile, clarificationMsg?: string }> {
    const newProfile = JSON.parse(JSON.stringify(currentProfile)) as UserProfile;
    const updates: string[] = [];
    let intent = 'general';
    let confidence = 0.5;

    const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

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

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `You are an advanced financial data extraction engine. Analyze the user message and extract all explicit and implied financial entities.
        
        RULES:
        - Income/Expenses are ALWAYS MONTHLY. Average out variable incomes.
        - Handle ranges properly: If a user says "40-50k", extract 45000 as the average. If the range is too broad, set clarificationNeeded to true.
        - Assets/Loans are ALWAYS TOTAL CURRENT BALANCE.
        - Handle numerical shorthands: 'k' -> 1000, 'lakh' -> 100000, 'cr' -> 10000000.
        - Detect multiple entities (e.g. "I have gold and 2 lakhs in stocks" -> 2 different assets/portfolio).
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
      intent = data.intent || 'general';
      confidence = data.confidenceScore || 0.5;
      const extracted = data.extracted_data || {};
      const clarificationMsg = data.clarificationNeeded || confidence < 0.6 ? data.clarificationMessage || "Could you clarify the exact amounts you're referring to?" : undefined;

      if (clarificationMsg) {
         return { intent: 'clarification', confidence, updates: [], newProfile: currentProfile, clarificationMsg };
      }

      if (extracted.personal) {
          newProfile.personal = newProfile.personal || {};
          if(extracted.personal.name) newProfile.personal.name = extracted.personal.name;
          if(extracted.personal.age) newProfile.personal.age = extracted.personal.age;
          if(extracted.personal.riskProfile) newProfile.personal.riskProfile = extracted.personal.riskProfile;
          updates.push("Personal details updated");
      }

      if (extracted.incomeSources?.length > 0) {
        extracted.incomeSources.forEach((source: any) => {
          const existing = newProfile.income.find(s => s.name.toLowerCase() === source.name.toLowerCase());
          if (existing) existing.value = source.value;
          else newProfile.income.push(source);
          updates.push(`Income source '${source.name}' recorded as ${fmt(source.value)}/mo`);
        });
      }

      if (extracted.expenses?.length > 0) {
        extracted.expenses.forEach((expense: any) => {
          const existing = newProfile.expenses.find(e => e.name.toLowerCase() === expense.name.toLowerCase());
          if (existing) {
              existing.value = expense.value;
              if (expense.category) existing.category = expense.category;
          }
          else newProfile.expenses.push(expense);
          updates.push(`Expense '${expense.name}' recorded as ${fmt(expense.value)}/mo`);
        });
      }

      if (extracted.subscriptions?.length > 0) {
          extracted.subscriptions.forEach((sub: any) => {
             const existing = newProfile.subscriptions.find(s => s.name.toLowerCase() === sub.name.toLowerCase());
             if (existing) {
                 existing.cost = sub.cost;
                 existing.billingCycle = sub.billingCycle;
             } else newProfile.subscriptions.push(sub);
             updates.push(`Subscription '${sub.name}' recorded at ${fmt(sub.cost)}/${sub.billingCycle}`);
          });
      }

      if (extracted.loans?.length > 0) {
        extracted.loans.forEach((loan: any) => {
          const existing = newProfile.loans.find(l => l.name.toLowerCase() === loan.name.toLowerCase());
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

      if (extracted.assets?.length > 0) {
          extracted.assets.forEach((asset: any) => {
             const existing = newProfile.assets.find(a => a.name.toLowerCase() === asset.name.toLowerCase());
             if (existing) {
                 existing.value = asset.value;
                 if(asset.mortgageable !== undefined) existing.mortgageable = asset.mortgageable;
             } else {
                 newProfile.assets.push({ name: asset.name, type: asset.type || 'other', value: asset.value, mortgageable: asset.mortgageable });
             }
             updates.push(`Asset '${asset.name}' recorded worth ${fmt(asset.value)}`);
          });
      }

      if (extracted.portfolio?.length > 0) {
          extracted.portfolio.forEach((holding: any) => {
              const existing = newProfile.portfolio.find(p => p.symbol.toLowerCase() === holding.symbol?.toLowerCase() || p.name.toLowerCase() === holding.name.toLowerCase());
              if (existing) {
                  existing.quantity = holding.quantity;
                  existing.averageBuyPrice = holding.averageBuyPrice;
              } else {
                  newProfile.portfolio.push({
                      symbol: holding.symbol || holding.name?.substring(0,4).toUpperCase(),
                      name: holding.name,
                      assetType: holding.assetType || 'other',
                      quantity: holding.quantity || 1,
                      averageBuyPrice: holding.averageBuyPrice || 0,
                      currentPrice: holding.averageBuyPrice || 0
                  });
              }
              updates.push(`Portfolio updated with ${holding.quantity}x ${holding.name}`);
          });
      }
      
      if (extracted.goals?.length > 0) {
          extracted.goals.forEach((goal: any) => {
             const existing = newProfile.goals.find(g => g.name.toLowerCase() === goal.name.toLowerCase());
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
        });
    }

    newProfile.lastUpdated = new Date().toISOString();
    return { intent, confidence, updates, newProfile };
  }
};
