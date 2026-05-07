import { useState, useRef, useEffect, useCallback } from 'react';
import { parser } from '../parser';
import { insights } from '../insights';
import { UserProfile } from '../types';

export const ONBOARDING_QUESTIONS = [
  "**[Step 1/9]** Hi! I'm your PapaProfit AI. Let's get your profile set up. First, what's your **monthly income**?",
  "**[Step 2/9]** Is your income **fixed or variable**?",
  "**[Step 3/9]** How much do you **spend** monthly on expenses?",
  "**[Step 4/9]** How much **savings** do you currently have?",
  "**[Step 5/9]** Do you have any **loans**? If yes, how much?",
  "**[Step 6/9]** How much **EMI** do you pay monthly?",
  "**[Step 7/9]** Do you **invest** in stocks or gold? If so, roughly how much?",
  "**[Step 8/9]** What is your main **financial goal**? (e.g. buy a house, retire early)",
  "**[Step 9/9]** Finally, do you currently track your expenses and invest regularly?"
];

export function useChat(profile: UserProfile, setProfile: (p: UserProfile) => void, saveProfile: (newP: UserProfile) => Promise<void>) {
  const [chatHistory, setChatHistory] = useState<{ role: string; content: string; updates?: string[] }[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [chatHistory, isTyping]);

  const initChat = useCallback((userName: string) => {
    setChatHistory(prev => {
      if (prev.length > 0) return prev;
      if (!profile.onboardingCompleted) {
        setOnboardingStep(1);
        return [{ role: 'ai', content: ONBOARDING_QUESTIONS[0] }];
      } else {
        const welcomeMsg = `**Welcome back to PapaProfit, ${userName.split(' ')[0]}! 👋**\n\nI'm ready to help you manage your finances. Your current net worth is **₹${profile.metrics.netWorth.toLocaleString('en-IN')}**.\n\nWhat would you like to focus on today?`;
        return [{ role: 'ai', content: welcomeMsg }];
      }
    });
  }, [profile.onboardingCompleted, profile.metrics.netWorth]);

  const clearChat = useCallback(() => {
    setChatHistory([]);
  }, []);

  const handleSend = async (userMsg: string) => {
    if (!userMsg.trim()) return;
    
    // 1. Add user message
    const newHistory = [...chatHistory, { role: 'user', content: userMsg }];
    setChatHistory(newHistory);
    
    // 2. Parse message & update profile
    const parsed = await parser.parse(userMsg, profile);
    
    if (parsed.clarificationMsg) {
        setIsTyping(false);
        setChatHistory(prev => [...prev, { role: 'ai', content: parsed.clarificationMsg! }]);
        return;
    }

    let updatedProfile = profile;
    if (parsed && parsed.updates && parsed.updates.length > 0) {
      updatedProfile = parsed.newProfile;
      setProfile(updatedProfile);
      await saveProfile(updatedProfile);
    }
    
    // 3. Show typing indicator
    setIsTyping(true);
    
    // 4. Generate AI response or next onboarding question
    let reply = '';
    const isFrustrated = /beat|shit|fuck|stupid|dumb|annoying|wrong|random|niga|bs|listening/i.test(userMsg);
    const isSkipRequest = /skip|stop|don't ask|dont ask|just chat/i.test(userMsg);

    if ((isSkipRequest || isFrustrated) && !profile.onboardingCompleted) {
      const finalProfile = { ...updatedProfile, onboardingCompleted: true };
      setProfile(finalProfile);
      await saveProfile(finalProfile);
      reply = isFrustrated 
        ? "I'm really sorry for being repetitive. I've stopped the guided setup. I'm listening now—tell me exactly what you want to fix or update in your finances."
        : "Understood! I'll stop the guided setup. We can just chat naturally now. What's on your mind regarding your finances?";
      setOnboardingStep(0);
    } else {
      reply = await insights.generateResponse(userMsg, parsed, updatedProfile, newHistory, onboardingStep, ONBOARDING_QUESTIONS);
      
      if (parsed.updates.length > 0 && !profile.onboardingCompleted) {
        if (onboardingStep < ONBOARDING_QUESTIONS.length) {
          setOnboardingStep(onboardingStep + 1);
        } else {
          const finalProfile = { ...updatedProfile, onboardingCompleted: true };
          setProfile(finalProfile);
          await saveProfile(finalProfile);
          setOnboardingStep(0);
        }
      }
    }
    
    // 5. Add AI response
    setIsTyping(false);
    setChatHistory(prev => [...prev, { role: 'ai', content: reply, updates: parsed.updates }]);
  };

  return { chatHistory, isTyping, onboardingStep, chatEndRef, initChat, clearChat, handleSend };
}
