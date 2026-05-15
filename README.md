<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# PapaProfit AI Finance App

A production-grade, AI-powered personal finance application built for Indian users, designed to provide comprehensive financial insights, track net worth, manage debts, and offer AI copilot assistance.
Built with React, Vite, Express, Firebase, and Groq.

## Features

- **Authentication:** Google OAuth via Firebase with secure cross-origin helmet configurations.
- **AI Copilot:** Conversational AI powered by Groq LLaMA models, allowing users to naturally chat to update their portfolio and ask for financial advice.
- **Dashboard & Reporting:** Clean visual metrics, Financial Health Score, goals progress, and asset allocation pie charts. Exporter for PDF reports.
- **Smart Planners:** Debt Payoff Planner, Goal Simulators, and automated AI insights.
- **Secure Data Storage:** User data is saved in Cloud Firestore, protected with strict row-level security rules.

## Getting Started

### Prerequisites
- Node.js (v18+)
- Firebase Project (with Authentication and Firestore enabled)
- Groq API Key

### Installation

1. **Clone the repository and install dependencies:**
   ```bash
   npm install
   ```

2. **Environment Configuration:**
   Copy `.env.example` to `.env.local` and add your keys:
   ```env
   GROQ_API_KEY=your_groq_llama_key_here

   VITE_FIREBASE_API_KEY=your_firebase_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
   VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
   VITE_FIREBASE_APP_ID=your_firebase_app_id
   ```

3. **Firebase Setup:**
   Ensure you add `localhost:3000` (or your domain) to the Authorized Domains in the Firebase Console so Google popup login works.

4. **Firestore Rules:**
   Deploy the `firestore.rules` provided in this repository to secure user data. They strictly limit access to correct UID owners.

### Running the App

```bash
# Start the full-stack development server
npm run dev
```

The application will bind to `0.0.0.0:3000`. 
API requests to `/api/*` are handled by Express, while all other routes fallback to the Vite SPA.

## Project Structure

- `server.ts`: Express backend handling AI inference and secure endpoints.
- `src/App.tsx`: Main React component and routing.
- `src/finance.ts`: Core deterministic logic engine for financial metrics.
- `src/parser.ts`: AI intention parser mapping AI responses to UI state changes.
- `src/components/`: Reusable, heavily styled Tailwind UI components.

## Testing & Build

```bash
# Run unit tests
npm run test

# Type-check, lint, and build for production
npm run build
```

## Known Limitations & Future Work

- **Payments:** The Stripe Pro tier is mocked. Real subscription billing should be wired up by handling stripe webhooks in `server.ts`.
- **Mobile Responsiveness:** The UI is currently optimized for desktop views.
- **Multiple Currencies:** App is heavily biased toward INR by default. It can be extended via preferences.
