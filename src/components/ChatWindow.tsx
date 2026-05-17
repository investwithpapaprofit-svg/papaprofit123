import React from 'react';

interface Message { 
  id?: string;
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
        <div className="flex flex-col items-center justify-center flex-1 h-full text-center p-6 text-gray-500 opacity-80 mt-10">
          <div className="w-16 h-16 bg-lime/20 text-deep rounded-full flex items-center justify-center mx-auto mb-4">
             <span className="text-3xl">👋</span>
          </div>
          <p className="text-lg font-bold text-gray-900 mb-1">Namaste, {userName || 'there'}. I'm PapaProfit.</p>
          <p className="text-sm max-w-sm mt-2">I'm your AI financial advisor. Ask me anything to optimize your wealth, from managing EMIs to planning your SIPs.</p>
        </div>
      )}
      {chatHistory.map((msg, i) => (
        <div key={msg.id || i} className={`msg ${msg.role}`}>
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
