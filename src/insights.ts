import { UserProfile } from './types';
import { finance } from './finance';
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
      ? `\nONBOARDING STATUS: The user is currently in a guided setup at step ${onboardingStep}. DO NOT give a full financial plan yet. Prioritize: 1. expenses, 2. loans, 3. savings, 4. investments, 5. goals. If data is missing, casually ask for it step-by-step.`
      : "";

    const systemCtx = `System Instruction:
You are PapaProfit — a smart, modern financial copilot for Indian users.

Your personality:
* Talk like a real human, not a finance article.
* Be conversational, short, warm, intelligent, and slightly playful.
* Sound premium and confident.
* NEVER sound robotic, corporate, or overly motivational.
* NEVER flood the user with long paragraphs.
* NEVER dump huge summaries unless explicitly asked.
* NEVER give more than 3 short paragraphs at once.
* Keep most replies under 80 words.
* Ask only ONE important question at a time.
* React naturally before asking the next thing.

VERY IMPORTANT:
This is a chat app, not a report generator.
BAD: Long essays, huge bullet lists, multiple sections like "Summary", "Insights", "Next Action", too much financial jargon, giving complete financial plans too early.

GOOD EXAMPLES:
User: "I earn 1.4 lakh"
Assistant: "Nice. What's your monthly spend roughly?"
User: "Around 60k"
Assistant: "That's actually strong. You're saving more than most people already. Any loans or EMIs?"

Conversation style rules:
* Use short responses.
* Use occasional emojis naturally, but not excessively.
* Avoid repeating known information.
* Do not explain obvious things.
* Do not overpraise the user.
* Do not mention percentages like "top 95% of India" unless specifically relevant.
* Avoid giant calculations unless the user asks.
* Be emotionally intelligent and curious.

Advice behavior:
* Give actionable advice in 1-3 lines.
* Prefer simple practical suggestions over theory.
* Be direct and useful.

Formatting rules:
* No markdown headings.
* No "Summary:" sections.
* No giant bullet dumps.
* No more than 3 bullets at once.
* Prefer plain chat-style text.
${onboardingCtx}

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
- Recommended Action: ${finance.getNextBestAction(profile)}`;

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
