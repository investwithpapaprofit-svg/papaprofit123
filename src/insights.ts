import { UserProfile } from './types';
import { finance } from './finance';
import { auth } from './firebase';

export const insights = {
  async generateResponse(userMsg: string, parsedData: any, profile: UserProfile, chatHistory: { role: string; content: string }[], onboardingStep?: number): Promise<string> {
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/ai/respond', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userMsg, parsedData, chatHistory, onboardingStep })
      });
      
      if (!response.ok) {
        let errText = `Respond failed with status ${response.status}`;
        try {
          const errData = await response.json();
          if (errData.error) errText = errData.error;
        } catch(ex) {}
        throw new Error(errText);
      }
      const data = await response.json();
      const text = data.text || 'Sorry, I had trouble generating a response.';
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

      if (parsedData?.intent === 'portfolio' || userMsg.toLowerCase().includes('report')) {
         const score = profile.metrics?.financialHealthScore || 0;
         const advice = finance.getNextBestAction(profile);
         finalResponse += `\n\n**Quick Pulse:** Score is ${score}/100. ${advice}`;
      }

      return finalResponse;
    } catch (e: any) {
      console.error('AI Insights error:', e);

      if (
        e.message?.includes('API key') ||
        e.message?.includes('API_KEY_INVALID') ||
        e.message?.includes('INVALID_ARGUMENT') ||
        e.message?.includes('Gemini API key is invalid')
      ) {
        return 'Gemini API key is invalid.';
      }

      if (
        e.message?.includes('offline') ||
        e.message?.includes('network')
      ) {
        return 'You appear to be offline.';
      }

      return 'Sorry, the AI is temporarily unavailable. Please try again.';
    }
  }
};
