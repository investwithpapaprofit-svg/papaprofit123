<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# PapaProfit – AI Financial Copilot

A premium, AI-powered personal finance dashboard designed for Indian users. PapaProfit merges deterministic financial reasoning (savings rates, EMI burden calculations, debt payoffs) with a conversational AI copilot to act as a personal wealth advisor.

This project has been upgraded to a **production-grade prototype**.

## Current Features

- **Authentication:** Google OAuth via Firebase with secure cross-origin handling.
- **Deterministic Financial Engine:**
  - **Financial Health Score (FHS):** Hard-coded, accurate 0-100 scoring based on savings rate, debt-to-income, emergency fund runway, and investment size.
  - **Debt Payoff Planner:** Snowball/Avalanche strategies based on your actual loan data.
  - **Goal Simulator:** Monthly SIP recommendations, inflation-adjusted, and goal affordability checks.
  - **Subscription Leak Detector:** Identifies potential wasteful recurring subscriptions.
  - **Emergency Fund Planner:** Specific actionable runway planning.
  - **SIP Growth Simulator:** Compound interest wealth visualizer.
- **AI Copilot (Groq / LLaMA 3):**
  - Directed to act as a premium Indian financial advisor (₹50k/month tier) rather than a generic chatbot. 
  - Capable of parsing conversational inputs and automatically updating the user's dashboard (e.g. "I got a new car loan for 5L at 8% EMI 12k").
  - Asks strategic follow-up questions when critical info is missing.
- **Premium Model Protection:** The profile data sanitizes `isPremium` and `role` to prevent client-side spoofing to the database.
- **Exporting:** PDF reports of the dashboard.

## Known Limitations & Production Caveats

- **Mocked Stripe Integration:** The "Papa Premium" Stripe flow is a UI mock. The application does not currently process real payments or handle webhooks.
- **Firebase Transitive Audit Warnings:** `npm audit` will show 8 low-severity warnings originating from `@google-cloud/firestore` dependencies (e.g. `teeny-request`, `@tootallnate/once`). These are deep transitive dependencies of `firebase-admin` and are safe to ignore for this deployment, but they exist.
- **AI Limitations:** While the AI is instructed to sound premium, it is not a certified financial planner. Calculations inside chat may occasionally hallucinate; rely on the Dashboard tools for deterministic calculations.
- **Desktop/Mobile:** Mobile polish has been applied (touch targets, fixed 100dvh for iOS, responsive stacked grids), but complex charts and dense data are still easiest to consume on Desktop.

## Getting Started

### Prerequisites
- Node.js (v18+)
- Firebase Project (Authentication & Firestore enabled)
- Groq API Key

### Installation & Set Up

1. **Clone & Install:**
   ```bash
   npm install
   ```
   *(Note: Run `npm audit --omit=dev` to verify dependency safety, keeping the documented Firebase warnings in mind.)*

2. **Environment Variables:**
   Copy `.env.example` to `.env.local` and add real keys.
   ```env
   GROQ_API_KEY=your_groq_llama_key_here

   # Firebase Client Config
   VITE_FIREBASE_API_KEY=your_firebase_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
   VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
   VITE_FIREBASE_APP_ID=your_firebase_app_id
   ```

3. **Firebase Setup:**
   - In the Firebase Console, go to **Authentication > Settings > Authorized domains** and add your hosted URLs (e.g. `localhost` or your vercel/cloud-run domain) to enable Google pop-up login.
   - Deploy `firestore.rules`. The database is locked down so users can only read/write their own document in the `users` collection.

4. **Run Server:**
   ```bash
   npm run dev
   ```
   The application runs on `0.0.0.0:3000`. The Vite frontend is served through Express (`server.ts`).

## Testing

This project prioritizes testing the *actual* business logic utilities.

```bash
npm run test
```
*(Tests cover: FHS breakdown, Goal Simulator, API Error Mappers, Profile Sanitization, Debt Planners, Validation schemas).*
