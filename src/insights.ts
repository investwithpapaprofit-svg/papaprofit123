import { UserProfile } from './types';
import { finance } from './finance';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || '' });

export const insights = {
  async generateResponse(userMsg: string, parsedData: any, profile: UserProfile, chatHistory: { role: string; content: string }[], onboardingStep?: number, onboardingQuestions?: string[]): Promise<string> {
    const fhsScore = profile.metrics.financialHealthScore || 0;
    const fhsInfo = finance.fhsLabel(fhsScore);
    const collateral = profile.assets.find(a => a.type === 'property' && a.mortgageable);
    const highDebt = [...profile.loans].sort((a, b) => b.rate - a.rate)[0];

    const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

    const onboardingCtx = onboardingStep && onboardingQuestions && onboardingStep < onboardingQuestions.length
      ? `\nONBOARDING STATUS: The user is currently in a guided setup. The next thing we need to know is: "${onboardingQuestions[onboardingStep]}". 
         If the user is just chatting or being casual (like saying "hi"), acknowledge them warmly and then naturally ask the next onboarding question. 
         DO NOT be a robot. Be a real advisor.`
      : "";

    const systemCtx = `You are PapaProfit — a sharp, warm, and direct personal financial advisor for Indian users. 
    You act as a world-class AI financial copilot.

CRITICAL: 
- Proactive, not just reactive. Give insight based on the numbers, do not just parrot data back to them.
- If the user gave you data, confirm what you updated in their profile, and what the impact is.
- If they are frustrated or just chatting, be empathetic and conversational.
${onboardingCtx}

FORMATTING RULES:
- Use clear sections with bold headers like **📊 The Numbers** or **💡 My Thoughts**
- Use line breaks between sections
- Keep responses focused — 150 to 250 words
- Always end with a follow-up question OR a clear next action
- Use ₹ symbol and Indian number format (lakh, crore)
- Be hyper-specific and actionable (e.g. "Increase saving by 5000 to reach your goal 3 months faster" instead of "increase savings").

CLIENT PROFILE:
Name: ${profile.personal?.name || 'Unknown'}
Age: ${profile.personal?.age || 'Unknown'}
Risk Profile: ${profile.personal?.riskProfile || 'Unknown'}

METRICS (Total/Monthly balances processed by calculation engine):
Monthly Income: ${fmt(finance.totalIncome(profile))}
Monthly Expenses: ${fmt(finance.totalExpenses(profile))} (including subscriptions)
EMI: ${fmt(finance.totalEMI(profile))}
Total Loans: ${fmt(finance.totalLiabilities(profile))} ${profile.loans.length > 0 ? '(' + profile.loans.map(l => l.name + ' at ' + l.rate + '%').join(', ') + ')' : ''}
Total Assets: ${fmt(finance.totalAssets(profile))}
Goals: ${profile.goals.map(g => `${g.name}: ${fmt(g.saved)} / ${fmt(g.target)} (prob: ${(g.probabilityOfSuccess||0)*100}%)`).join(', ') || 'None set'}

ADVANCED METRICS:
Net worth: ${fmt(profile.metrics.netWorth)}
Monthly surplus: ${fmt(profile.metrics.monthlyCashFlow)}
Savings rate: ${profile.metrics.savingsRate.toFixed(1)}%
Emergency Runway: ${profile.metrics.emergencyFundRunwayMonths.toFixed(1)} months
Financial Health Score: ${fhsScore > 0 ? fhsScore + '/100 (' + fhsInfo.label + ')' : 'Not enough data yet'}

SYSTEM INSIGHTS (Address the HIGH priority ones if relevant):
${profile.insights.map(i => `[${i.priority.toUpperCase()}] ${i.title}: ${i.description}`).join('\n')}

EXTRACTED IN THIS TURN: ${parsedData.updates.length > 0 ? parsedData.updates.join(', ') : 'No new hard data found.'}

Premium Status: ${profile.isPremium ? 'PRO USER - Give advanced investment, AI portfolio intelligence, and tax advice' : 'FREE USER - Do NOT give specific stock or advanced investment advice. Tell them to upgrade to Pro for personalized investment strategies.'}`;

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
