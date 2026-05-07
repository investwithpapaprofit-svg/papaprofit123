import { UserProfile } from './types';
import { finance } from './finance';
import { auth } from './firebase';

export const insights = {
  async generateResponse(userMsg: string, parsedData: any, profile: UserProfile, chatHistory: { role: string; content: string }[], onboardingStep?: number, onboardingQuestions?: string[]): Promise<string> {
    const fhsScore = profile.metrics.financialHealthScore || 0;
    const fhsInfo = finance.fhsLabel(fhsScore);

    const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

    const onboardingCtx = onboardingStep !== undefined && onboardingQuestions && onboardingStep < onboardingQuestions.length
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
When providing a full financial breakdown, structure your response EXACTLY like this:
**Summary:**
(1-2 lines summarizing their overall financial stance - e.g. "You have moderate income with high expenses and existing debt.")

**Insights:**
- (Point 1: highly specific, data-driven insight)
- (Point 2: another sharp insight)

**Next Action:**
${finance.getNextBestAction(profile)}

- Keep responses focused.
- Use ₹ symbol and Indian number format (lakh, crore).
- Be hyper-specific and actionable (e.g. "Increase saving by 5000 to reach your goal 3 months faster" instead of "increase savings").

CLIENT PROFILE:
Name: ${profile.personal?.name || 'Unknown'}
Age: ${profile.personal?.age || 'Unknown'}
Risk Profile: ${profile.personal?.riskProfile || 'Unknown'}

METRICS (Total/Monthly balances processed by calculation engine):
Monthly Income: ${fmt(finance.totalIncome(profile))}
Monthly Expenses: ${fmt(finance.totalExpenses(profile))} (including subscriptions)
EMI: ${fmt(finance.totalEMI(profile))}
Total Loans: ${fmt(finance.totalLiabilities(profile))} ${(profile.loans || []).length > 0 ? '(' + (profile.loans || []).map(l => l.name + ' at ' + l.rate + '%').join(', ') + ')' : ''}
Total Assets: ${fmt(finance.totalAssets(profile))}
Goals: ${(profile.goals || []).map(g => `${g.name}: ${fmt(g.saved)} / ${fmt(g.target)} (prob: ${(g.probabilityOfSuccess||0)*100}%)`).join(', ') || 'None set'}

ADVANCED METRICS:
Net worth: ${fmt(profile.metrics.netWorth)}
Monthly surplus: ${fmt(profile.metrics.monthlyCashFlow)}
Savings rate: ${profile.metrics.savingsRate.toFixed(1)}%
Emergency Runway: ${profile.metrics.emergencyFundRunwayMonths.toFixed(1)} months
Financial Health Score: ${fhsScore > 0 ? fhsScore + '/100 (' + fhsInfo.label + ')' : 'Not enough data yet'}

SYSTEM INSIGHTS:
${(profile.insights || []).map(i => `[${i.priority.toUpperCase()}] ${i.title}: ${i.description}`).join('\n')}

CURRENT COPILOT ANALYSIS:
- Extracted: ${parsedData?.updates?.length > 0 ? parsedData.updates.join(', ') : 'No new hard data found.'}
- Parsing Intent: ${parsedData?.intent || 'general'}`;

    let messages = chatHistory.slice(-6).map((h: any) => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.content }]
    }));

    if (messages.length > 0 && messages[0].role === 'model') {
      messages.shift();
    }

    try {
      const token = await auth.currentUser?.getIdToken();

      const response = await fetch('/api/ai/respond', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ messages, systemCtx })
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();
      let finalResponse = data.text || 'Sorry, I had trouble with that. Please try again.';
      
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
