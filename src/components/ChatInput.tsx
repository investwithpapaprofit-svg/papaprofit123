 

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
          <div className="sug" onClick={() => onSend('What if I increase SIP by ₹5k?')}>What if I increase SIP by ₹5k?</div>
          <div className="sug" onClick={() => onSend('What if I pay off debt first?')}>What if I pay off debt first?</div>
          <div className="sug" onClick={() => onSend('How long until I hit my goal?')}>How long until I hit my goal?</div>
          <div className="sug" onClick={() => onSend('Can I afford a car loan?')}>Can I afford a car loan?</div>
          <div className="sug" onClick={() => onSend('Analyze my current cash flow')}>Analyze my cash flow</div>
          <div className="sug" onClick={() => onSend('How do I improve my Financial Health Score?')}>Improve my FHS</div>
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
