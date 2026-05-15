import { UserProfile } from './types';
import { auth } from './firebase';
import { getNextBestAction } from './utils/nextBestAction';
import { generateWeeklyReport } from './utils/weeklyReport';
import { compareWithLast } from './utils/recentChanges';

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
        const errorObj = new Error(errText) as any;
        errorObj.status = response.status;
        throw errorObj;
      }
      const data = await response.json();
      const text = data.text || 'Sorry, I had trouble generating a response.';
      let finalResponse = text;
      
      // Memory Engine & Report Injection (Deterministic)
      const changes = compareWithLast(profile);
      let report: any = null;
      
      if (profile.history && profile.history.length > 2 && (profile.history.length % 5 === 0 || userMsg.toLowerCase().includes('report'))) {
         report = generateWeeklyReport(profile);
      }
      
      const attachments = [];
      if (changes.length > 0) {
          attachments.push(`📈 **Trend Update**\n${changes.join('\n')}`);
      }
      if (report && report.isAvailable) {
          attachments.push(`Weekly Report:\nNet Worth Change: ${report.netWorthChange}`);
      }
      
      if (attachments.length > 0) {
          finalResponse += '\n\n---\n\n' + attachments.join('\n\n');
      }

      if (parsedData?.intent === 'portfolio' || userMsg.toLowerCase().includes('report')) {
         const score = profile.metrics?.financialHealthScore || 0;
         const advice = getNextBestAction(profile);
         finalResponse += `\n\n**Quick Pulse:** Score is ${score}/100. ${advice.title}: ${advice.action}`;
      }

      return finalResponse;
    } catch (e: any) {
      console.error('AI Insights error:', e);
      throw e;
    }
  }
};
