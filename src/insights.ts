import { UserProfile } from './types';
import { finance } from './finance';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const insights = {
  async generateResponse(userMsg: string, parsedData: any, profile: UserProfile, chatHistory: { role: string; content: string }[], onboardingStep?: number, onboardingQuestions?: string[]): Promise<string> {
    const fhsScore = finance.fhs(profile);
    const fhsInfo = finance.fhsLabel(fhsScore);
    const collateral = profile.assets.property.find(a => a.mortgageable);
    const highDebt = [...profile.loans].sort((a, b) => b.rate - a.rate)[0];

    const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

    const onboardingCtx = onboardingStep && onboardingQuestions && onboardingStep < onboardingQuestions.length
      ? `\nONBOARDING STATUS: The user is currently in a guided setup. The next thing we need to know is: "${onboardingQuestions[onboardingStep]}". 
         If the user is just chatting or being casual (like saying "hi"), acknowledge them warmly and then naturally ask the next onboarding question. 
         DO NOT be a robot. Be a real advisor.`
      : "";

    const systemCtx = `You are PapaProfit — a sharp, warm, and direct personal financial advisor for Indian users. 

CRITICAL: 
- If the user just gave you data (like a salary, loan, or asset), FIRST confirm exactly what you updated in their profile.
- If they are frustrated or just chatting, be empathetic and conversational.
- Income/Expenses are MONTHLY. Assets/Loans are TOTAL BALANCES.
${onboardingCtx}

FORMATTING RULES:
- Use clear sections with bold headers like **📊 Your Numbers** 
- Use line breaks between sections
- Use bullet points for lists
- Keep responses focused — 150 to 250 words
- Always end with a follow-up question OR a clear next action
- Use ₹ symbol and Indian number format (lakh, crore)
- Reference real Indian products: SIP, PPF, NPS, ELSS, LAP, KCC, HDFC/SBI/Bajaj

CLIENT PROFILE (always use these numbers):
Monthly income: ${fmt(profile.income)}
Monthly expenses: ${fmt(profile.expenses)}
Savings (Total): ${fmt(profile.savings)}
Loans (Total): ${profile.loans.map(l => l.name + ': ' + fmt(l.amount) + (l.rate ? ' at ' + l.rate + '%' : '')).join(', ') || 'None'}
Assets (Total): Property: ${profile.assets.property.map(p => p.name + ' (' + fmt(p.value) + ')').join(', ') || 'None'} | Gold: ${fmt(profile.assets.gold)} | Cash: ${fmt(profile.assets.cash)} | Other: ${profile.assets.other.map(p => p.name + ' (' + fmt(p.value) + ')').join(', ') || 'None'}
Goals: ${profile.goals.map(g => g.name + (g.target ? ' (' + fmt(g.target) + ')' : '')).join(', ') || 'None set'}
Risk profile: ${profile.riskProfile || 'Unknown'}

CALCULATED METRICS:
Net worth (Total): ${fmt(finance.netWorth(profile))}
Monthly surplus: ${fmt(finance.surplus(profile))}
Savings rate (Monthly): ${finance.savingsRate(profile).toFixed(1)}%
Debt ratio: ${finance.debtRatio(profile).toFixed(1)}x monthly income
Financial Health Score: ${fhsScore !== null ? fhsScore + '/100 (' + fhsInfo.label + ')' : 'Not enough data yet'}
${collateral ? 'Collateral available: ' + collateral.name + ' worth ' + fmt(collateral.value) : ''}
${highDebt ? 'Highest interest debt: ' + highDebt.name + ' at ' + highDebt.rate + '%' : ''}

UPDATES JUST MADE: ${parsedData.updates.length > 0 ? parsedData.updates.join(', ') : 'none'}

Premium Status: ${profile.isPremium ? 'PRO USER - Give advanced investment and tax advice' : 'FREE USER - Do NOT give specific stock or advanced investment advice. Tell them to upgrade to Pro for personalized investment strategies if they ask.'}`;

    let messages = chatHistory.slice(-6).map((h: any) => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.content }]
    }));

    if (messages.length > 0 && messages[0].role === 'model') {
      messages.shift();
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: messages,
        config: {
          systemInstruction: systemCtx,
          temperature: 0.7,
          maxOutputTokens: 600
        }
      });
      return response.text || 'Sorry, I had trouble with that. Please try again.';
    } catch (error) {
      console.error('AI Insights error:', error);
      return 'Sorry, I had trouble connecting to my brain. Please try again.';
    }
  }
};
