import React from 'react';

interface Message { 
  role: string; 
  content: string;
  updates?: string[];
}

interface ChatWindowProps {
  chatHistory: Message[];
  isTyping: boolean;
  formatMessage: (text: string) => string;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  userName?: string;
}

export function ChatWindow({ chatHistory, isTyping, formatMessage, chatEndRef, userName }: ChatWindowProps) {
  return (
    <div className="chat-messages p-4 flex-1 overflow-y-auto flex flex-col gap-4">
      {chatHistory.length === 0 && (
        <div className="flex flex-col items-center justify-center flex-1 h-full text-center p-6 text-gray-500 opacity-80 h-[200px] mt-10">
          <div className="text-4xl mb-3">👋</div>
          <p className="text-sm font-medium text-gray-700">Namaste, {userName || 'there'}. I'm PapaProfit.</p>
          <p className="text-xs max-w-sm mt-2">I'm your AI financial copilot. Tell me about your income, debts, or goals, and I'll help you organize and grow your wealth.</p>
          <div className="flex flex-wrap gap-2 justify-center mt-4 text-xs font-semibold">
            <span className="bg-gray-100 px-3 py-1.5 rounded-full text-forest">"My salary is 1 lakh."</span>
            <span className="bg-gray-100 px-3 py-1.5 rounded-full text-forest">"I pay 15k for rent."</span>
          </div>
        </div>
      )}
      {chatHistory.map((msg, i) => (
        <div key={i} className={`msg ${msg.role}`}>
          <div className="msg-avatar">{msg.role === 'user' ? (userName?.charAt(0).toUpperCase() || 'U') : 'AI'}</div>
          <div className="msg-bubble">
            <div dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }} />
            {msg.updates && msg.updates.length > 0 && (
              <div className="profile-update mt-2 inline-flex">✓ Profile updated: {msg.updates.join(' · ')}</div>
            )}
          </div>
        </div>
      ))}
      {isTyping && (
        <div className="msg ai">
          <div className="msg-avatar">AI</div>
          <div className="msg-bubble">
            <div className="typing-dots"><span></span><span></span><span></span></div>
          </div>
        </div>
      )}
      <div className="text-[0.65rem] text-center text-gray-500 mt-2 px-4 italic leading-relaxed">
        PapaProfit is an AI financial assistant, not certified financial advice. Verify major decisions with a professional.
      </div>
      <div ref={chatEndRef} />
    </div>
  );
}
