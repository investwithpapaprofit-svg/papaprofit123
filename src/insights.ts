import { UserProfile } from './types';
import { finance } from './finance';
import { auth } from './firebase';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const insights = {
  async generateResponse(userMsg: string, parsedData: any, profile: UserProfile, chatHistory: { role: string; content: string }[], onboardingStep?: number): Promise<string> {
    const fmt = (n: number) => `₹${(n||0).toLocaleString('en-IN')}`;
    const fhsScore = profile.metrics?.financialHealthScore || 0;
    
    // Convert history to string formatted messages
    let formattedMessages = chatHistory.slice(-6).map((h: any) => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.content }]
    }));

    if (formattedMessages.length > 0 && formattedMessages[0].role === 'model') {
      formattedMessages.shift();
    }

    const onboardingCtx = onboardingStep !== undefined && onboardingStep >= 0 
      ? `\nONBOARDING STATUS: The user is currently in a guided setup at step ${onboardingStep}. DO NOT be a robot. Be a real advisor.`
      : "";

    const systemCtx = `You are PapaProfit — a sharp, warm, and direct personal financial advisor for Indian users. 
    You act as a world-class AI financial copilot.

  CRITICAL: 
  - Proactive, not just reactive. Give insight based on the numbers, do not just parrot data back to them.
  - If the user gave you data, confirm what you updated in their profile, and what the impact is.
  - If they are frustrated or just chatting, be empathetic and conversational.
  ${onboardingCtx}

  FORMATTING RULES:
  When providing a full financial breakdown, structure your response EXACTLY like this:
  **Summary:**
  (1-2 lines summarizing their overall financial stance)

  **Insights:**
  - (Point 1: highly specific, data-driven insight)
  - (Point 2: another sharp insight)

  **Next Action:**
  ${finance.getNextBestAction(profile)}

  - Keep responses focused.
  - Use ₹ symbol and Indian number format (lakh, crore).
  - Be hyper-specific and actionable.

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
  
  System instruction (treat as internal context): Always respect the context provided.
  User message: ${userMsg}`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          { role: 'user', parts: [{ text: systemCtx }] },
          ...formattedMessages
        ]
      });
      const text = response.text || 'Sorry, I had trouble generating a response.';
      let finalResponse = text;
      
      // Memory Engine & Report Injection (Deterministic)
      const changes = finance.compareWithLast(profile);
      let report = '';
      
      if (profile.history && profile.history.length > 2 && (profile.history.length % 5 === 0 || userMsg.toLowerCase().includes('report'))) {
         report = finance.generateWeeklyReport(profile);
      }
      
      const attachments = [];
      if (changes.length > 0) {
          attachments.push(`📈 **Trend Update**\n${changes.join('\n')}`);
      }
      if (report && !report.includes('Not enough data')) {
          attachments.push(report);
      }
      
      if (attachments.length > 0) {
          finalResponse += '\n\n---\n\n' + attachments.join('\n\n');
      }
      
      return finalResponse;
    } catch (error) {
      console.error('AI Insights error:', error);
      return 'Sorry, I had trouble connecting to my brain. Please try again.';
    }
  }
};
