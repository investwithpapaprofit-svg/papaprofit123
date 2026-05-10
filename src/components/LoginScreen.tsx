import React from 'react';

interface LoginScreenProps {
  onLogin: () => void;
  error: string;
}

export function LoginScreen({ onLogin, error }: LoginScreenProps) {
  return (
    <div id="loginScreen">
      <canvas id="blob-canvas" className="absolute inset-0 pointer-events-none z-0"></canvas>
      <div className="flex z-10 w-full max-w-[900px] px-6 gap-[64px] items-center">
        <div className="flex-1 flex flex-col gap-[22px] hidden md:flex">
            <div className="inline-flex items-center gap-[7px] px-[14px] py-[5px] bg-xmint border-[1.5px] border-lmint rounded-full text-[0.68rem] font-bold text-deep tracking-[0.08em] uppercase w-fit">
              <span className="w-[6px] h-[6px] rounded-full bg-lime shadow-[0_0_8px_var(--color-lime)] animate-pulse"></span>
              Live AI — Powered by PapaProfit
            </div>
            <div className="logo-wrap !static !block pb-0 pt-0">
              <h1>Papa<span className="logo-wrap-accent">Profit.</span></h1>
              <p>The <strong>smartest financial OS</strong> for every Indian who wants to build real wealth — not just track expenses.</p>
            </div>
            <div className="flex flex-col gap-[9px]">
              <div className="flex items-center gap-[10px] text-[0.78rem] font-medium text-muted"><span className="w-[6px] h-[6px] rounded-full bg-lime shrink-0"></span>AI-powered financial health score</div>
              <div className="flex items-center gap-[10px] text-[0.78rem] font-medium text-muted"><span className="w-[6px] h-[6px] rounded-full bg-lime shrink-0"></span>Real-time net worth dashboard</div>
              <div className="flex items-center gap-[10px] text-[0.78rem] font-medium text-muted"><span className="w-[6px] h-[6px] rounded-full bg-lime shrink-0"></span>Smart goal tracking & SIP planner</div>
            </div>
        </div>
        <div className="login-card mx-auto md:mx-0 shrink-0">
          <h2>Sign in</h2>
          <p>Access your personal AI financial advisor — all your money in one intelligent place.</p>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-xs p-3 rounded-lg mb-4 text-left">
              <strong>Login Error:</strong> {error}
            </div>
          )}
          <button className="google-btn" onClick={onLogin}>
            <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Continue with Google
          </button>
          <div className="flex items-center gap-[12px] my-[20px] text-ghost text-[0.72rem] font-medium before:flex-1 before:h-[1px] before:bg-faint after:flex-1 after:h-[1px] after:bg-faint">or</div>
          <div className="grid grid-cols-2 gap-2 mt-[22px] pt-[20px] border-t-[1.5px] border-faint">
            <div className="flex items-center gap-2 text-[0.72rem] font-medium text-muted"><div className="w-[28px] h-[28px] rounded-[8px] bg-ultramint border border-faint flex items-center justify-center shrink-0">🤖</div>AI Advisor</div>
            <div className="flex items-center gap-2 text-[0.72rem] font-medium text-muted"><div className="w-[28px] h-[28px] rounded-[8px] bg-ultramint border border-faint flex items-center justify-center shrink-0">📊</div>Dashboard</div>
          </div>
        </div>
      </div>
    </div>
  );
}
