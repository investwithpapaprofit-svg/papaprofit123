import { useState, useCallback, useEffect } from 'react';
import { UserProfile } from '../types';
import { parser } from '../parser';
import { insights } from '../insights';
import { ONBOARDING_QUESTIONS } from '../constants';
import { auth } from '../firebase';
import { User } from 'firebase/auth';

export function useChat(
  profile: UserProfile,
  saveProfile: (p: UserProfile) => Promise<void>,
  user: User | null
) {
  const [chatHistory, setChatHistory] = useState<{ role: string; content: string; updates?: string[] }[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [input, setInput] = useState('');

  // Add welcome message or start onboarding
  useEffect(() => {
    if (user && chatHistory.length === 0 && profile.lastUpdated !== '') {
      if (!profile.onboardingCompleted) {
        setOnboardingStep(1);
        setChatHistory([{ role: 'ai', content: ONBOARDING_QUESTIONS[0] }]);
      } else {
        const welcomeMsg = `**Welcome back to PapaProfit, ${user.displayName?.split(' ')[0]}! 👋**\n\nI'm ready to help you manage your finances. Your current net worth is **₹${profile.metrics?.netWorth?.toLocaleString('en-IN') ?? '0'}**.\n\nWhat would you like to focus on today?`;
        setChatHistory([{ role: 'ai', content: welcomeMsg }]);
      }
    }
  }, [profile.onboardingCompleted, profile.lastUpdated, user, chatHistory.length]);

  const handleSend = useCallback(async (text?: string) => {
    const userMsg = (text ?? input).trim();
    if (!userMsg) return;
    setInput('');
    setChatHistory(h => [...h, { role: 'user', content: userMsg }]);
    setIsTyping(true);

    const isFrustrated = /\b(fuck|shit|stupid|dumb|bs)\b/i.test(userMsg);
    const isSkipRequest = /skip|stop|don't ask|dont ask|just chat/i.test(userMsg);

    try {
      const parsed = await parser.parse(userMsg, profile, chatHistory);

      if (parsed.clarificationMsg) {
        setChatHistory(prev => [...prev, { role: 'ai', content: parsed.clarificationMsg! }]);
        setIsTyping(false);
        return;
      }

      let updatedProfile = profile;
      if (parsed && parsed.updates && parsed.updates.length > 0) {
        updatedProfile = parsed.newProfile;
        await saveProfile(updatedProfile);
      }

      let reply = '';
      if ((isSkipRequest || isFrustrated) && !profile.onboardingCompleted) {
        const finalProfile = { ...updatedProfile, onboardingCompleted: true };
        await saveProfile(finalProfile);
        reply = isFrustrated 
          ? "I'm really sorry for being repetitive. I've stopped the guided setup. I'm listening now—tell me exactly what you want to fix or update in your finances."
          : "Understood! I'll stop the guided setup. We can just chat naturally now. What's on your mind regarding your finances?";
        setOnboardingStep(0);
      } else {
        reply = await insights.generateResponse(userMsg, parsed, updatedProfile, [...chatHistory, {role: 'user', content: userMsg}], onboardingStep);
        if (parsed.intent !== 'general' && parsed.updates.length > 0 && !profile.onboardingCompleted) {
            setOnboardingStep(s => Math.min(s + 1, ONBOARDING_QUESTIONS.length));
            if (onboardingStep >= ONBOARDING_QUESTIONS.length - 1) { // - 1 because we increment afterwards
               const finalProfile = { ...updatedProfile, onboardingCompleted: true };
               await saveProfile(finalProfile);
               setOnboardingStep(0);
            }
        }
      }

      setChatHistory(h => [...h, { role: 'ai', content: reply, updates: parsed.updates }]);
    } catch (error: any) {
      console.error('Handle send error:', error);
      let errMsg = "I'm having a bit of trouble connecting to my brain right now.";
      if (error.message && error.message.includes('API key not valid')) {
         errMsg = "⚠️ **Configuration Error**: Your Gemini API key is invalid or not provided. Please go to AI Studio Settings -> API Keys, and enter a valid Gemini API key to use PapaProfit.";
      } else if (error.message) {
         errMsg = "Error: " + error.message;
      }
      setChatHistory(prev => [...prev, { role: 'ai', content: errMsg }]);
    } finally {
      setIsTyping(false);
    }
  }, [input, profile, chatHistory, onboardingStep, saveProfile]);

  return { chatHistory, isTyping, onboardingStep, input, setInput, handleSend, setChatHistory };
}
