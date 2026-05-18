import { useState, useCallback, useEffect, useRef } from 'react';
import { UserProfile } from '../types';
import { parser } from '../parser';
import { insights } from '../insights';
import { User } from 'firebase/auth';
import { mapChatError } from '../utils/mapChatError';

export function useChat(
  profile: UserProfile,
  saveProfile: (p: UserProfile) => Promise<void>,
  user: User | null,
  loadedChatHistory: any[] = []
) {
  const [chatHistory, setChatHistory] = useState<{ id?: string, role: string; content: string; updates?: string[] }[]>(() => {
    try {
      const stored = sessionStorage.getItem('papa_chat_history');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch(e) {}
    return [];
  });
  const [isTyping, setIsTyping] = useState(false);
  const [input, setInput] = useState('');

  // Hydrate chat history from firestore once it's available and we have nothing or less in local storage.
  const hasHydratedHistory = useRef(false);
  useEffect(() => {
    if (loadedChatHistory && loadedChatHistory.length > 0 && !hasHydratedHistory.current) {
      setChatHistory(prev => {
        if (prev.length <= loadedChatHistory.length) {
          hasHydratedHistory.current = true;
          return loadedChatHistory;
        }
        return prev;
      });
    }
  }, [loadedChatHistory]);

  const hasInitialized = useRef(false);

  useEffect(() => {
    try {
      sessionStorage.setItem('papa_chat_history', JSON.stringify(chatHistory.slice(-15)));
    } catch(e) {}

    if (!user || chatHistory.length === 0) return;

    const timer = setTimeout(() => {
      import('firebase/firestore').then(({ doc, setDoc }) => {
        import('../firebase').then(({ db }) => {
          setDoc(
            doc(db, 'users', user.uid),
            {
              chatHistory: chatHistory.slice(-15)
            },
            { merge: true }
          ).catch((e) => console.log('Chat sync error', e));
        });
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, [chatHistory, user]);

  // Add welcome message
  useEffect(() => {
    if (hasInitialized.current) return;
    if (!user) return;
    if (!profile.lastUpdated) return;

    hasInitialized.current = true;

    if (chatHistory.length === 0 && profile.onboardingCompleted) {
      const welcomeMsg = `**Welcome back to PapaProfit, ${user.displayName?.split(' ')[0]}! 👋**\n\nI'm ready to help you manage your finances.\n\nWhat would you like to focus on today?`;
      setChatHistory([{ id: crypto.randomUUID(), role: 'ai', content: welcomeMsg }]);
    }
  }, [profile.onboardingCompleted, profile.lastUpdated, user]);

  const handleSend = useCallback(async (text?: string) => {
    const userMsg = (text ?? input).trim();
    if (!userMsg) return;
    setInput('');
    setChatHistory(h => [...h, { id: crypto.randomUUID(), role: 'user', content: userMsg }]);
    setIsTyping(true);

    try {
      const parsed = await parser.parse(userMsg, profile, chatHistory);

      if (parsed.clarificationMsg) {
        setChatHistory(prev => [...prev, { id: crypto.randomUUID(), role: 'ai', content: parsed.clarificationMsg! }]);
        setIsTyping(false);
        return;
      }

      let updatedProfile = profile;
      if (parsed && parsed.updates && parsed.updates.length > 0) {
        updatedProfile = parsed.newProfile;
        await saveProfile(updatedProfile);
      }

      const reply = await insights.generateResponse(userMsg, parsed, updatedProfile, [...chatHistory, {role: 'user', content: userMsg}], 0);

      setChatHistory(h => [...h, { id: crypto.randomUUID(), role: 'ai', content: reply, updates: parsed.updates }]);
    } catch (error: any) {
      console.error('Handle send error:', error);
      const errMsg = mapChatError(error);
      setChatHistory(prev => [...prev, { id: crypto.randomUUID(), role: 'ai', content: errMsg }]);
    } finally {
      setIsTyping(false);
    }
  }, [input, profile, chatHistory, saveProfile]);

  return { chatHistory, isTyping, input, setInput, handleSend, setChatHistory };
}
