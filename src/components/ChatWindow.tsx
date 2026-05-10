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
  chatEndRef: React.RefObject<HTMLDivElement>;
  userName?: string;
}

export function ChatWindow({ chatHistory, isTyping, formatMessage, chatEndRef, userName }: ChatWindowProps) {
  return (
    <div className="chat-messages p-4 flex-1 overflow-y-auto flex flex-col gap-4">
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
      <div ref={chatEndRef} />
    </div>
  );
}
