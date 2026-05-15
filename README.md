<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/ddd477d6-76dc-4260-a7e0-eed58b7b28bb

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Set the `GROQ_API_KEY` in `.env.local` to your Groq API key, and configure Firebase Vite env vars.
3. Run the app:
   `npm run dev`

## Notes
- **Google Login**: Ensure you add your app's domain to Firebase Authorized Domains in the Firebase Console so Google popup login works.
- **Firestore Rules**: Deploy the rules in `firestore.rules` to your Firebase project.

## Scripts
- **Test**: `npm run test`
- **Build**: `npm run build`
