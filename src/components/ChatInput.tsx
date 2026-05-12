 

interface ChatInputProps {
  input: string;
  onInput: (val: string) => void;
  onSend: (text?: string) => void;
  isTyping: boolean;
  showSuggestions: boolean;
  onSkipSetup?: () => void;
  showSkipButton?: boolean;
  setShowPrivacyPolicy: (show: boolean) => void;
}

export function ChatInput({ 
  input, 
  onInput, 
  onSend, 
  isTyping, 
  showSuggestions, 
  onSkipSetup, 
  showSkipButton,
  setShowPrivacyPolicy 
}: ChatInputProps) {
  return (
    <>
      {showSuggestions && (
        <div className="suggestions">
          <div className="sug" onClick={() => onSend('I earn ₹60,000/month')}>I earn ₹60,000/month</div>
          <div className="sug" onClick={() => onSend('I have a home loan of ₹20 lakh')}>I have a home loan of ₹20 lakh</div>
          <div className="sug" onClick={() => onSend('I want to buy a house in 5 years')}>I want to buy a house in 5 years</div>
          <div className="sug" onClick={() => onSend('Should I start a business?')}>Should I start a business?</div>
          <div className="sug" onClick={() => onSend('How is my financial health?')}>How is my financial health?</div>
        </div>
      )}

      {showSkipButton && onSkipSetup && (
        <div className="px-6 py-2 flex justify-end">
          <button 
            onClick={onSkipSetup}
            className="text-[10px] text-gray-400 hover:text-gray-600 underline"
          >
            Skip guided setup
          </button>
        </div>
      )}
      <div className="chat-input-wrap">
        <div className="chat-input-row">
          <input 
            type="text" 
            value={input}
            onChange={(e) => onInput(e.target.value)}
            placeholder="Type anything about your finances..." 
            onKeyDown={(e) => { if (e.key === 'Enter') onSend(input); }}
            disabled={isTyping}
          />
          <button className="send-btn" onClick={() => onSend(input)} disabled={isTyping || !input.trim()}>➤</button>
        </div>
        <div className="text-center mt-2 px-4 pb-2">
          <p className="text-[10px] text-gray-400">
            PapaProfit AI can make mistakes. This is <span className="font-semibold text-gray-500">not certified financial advice</span>. Please verify calculations. <button onClick={() => setShowPrivacyPolicy(true)} className="underline hover:text-gray-600">Privacy Policy</button>
          </p>
        </div>
      </div>
    </>
  );
}
