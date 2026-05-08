import { UserProfile } from './types';
import { finance } from './finance';
import { auth } from './firebase';

export const insights = {
  async generateResponse(userMsg: string, parsedData: any, profile: UserProfile, chatHistory: { role: string; content: string }[], onboardingStep?: number): Promise<string> {
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
        body: JSON.stringify({ messages, parsedData, onboardingStep })
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          return "It seems your session has expired. Please refresh the page and log in again to continue.";
        }
        const errText = await response.text();
        throw new Error(`API Error ${response.status}: ${errText}`);
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
