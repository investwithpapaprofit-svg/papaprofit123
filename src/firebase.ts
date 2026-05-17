import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';

const requiredEnv = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
] as const;

for (const key of requiredEnv) {
  if (!import.meta.env[key]) {
    console.error(`Missing Firebase env variable: ${key}`);
  }
}

const dbId = import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || '(default)';

if (!import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID) {
  console.warn('VITE_FIREBASE_FIRESTORE_DATABASE_ID is missing using "(default)" database.');
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app, dbId);
export const googleProvider = new GoogleAuthProvider();

export async function testFirestoreConnection() {
  try {
    // Attempt a simple read to check connectivity and DB validity
    await getDocFromServer(doc(db, '_system_', 'healthcheck'));
    console.log(`✅ Firestore connected successfully to DB: ${dbId}`);
    return { success: true, dbId };
  } catch (error: any) {
    if (error?.message?.includes('the client is offline')) {
      console.error("❌ Firestore connection failed: client is offline or database ID is incorrect.");
    } else if (error?.message?.includes('Missing or insufficient permissions')) {
      // This is actually a success for connectivity! It means the DB exists and we reached it.
      console.log(`✅ Firestore connected successfully to DB: ${dbId} (Permission denied is expected for healthcheck)`);
      return { success: true, dbId };
    } else {
      console.error("❌ Firestore connection error:", error?.message);
    }
    return { success: false, dbId, error: error?.message };
  }
}

// Fire the connection check without blocking
testFirestoreConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  _path: string | null
) {
  if (!navigator.onLine) {
    throw new Error('You are offline. Check your internet connection.');
  }

  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('the client is offline')) {
    throw new Error('Firestore connection failed. Please check your database configuration.');
  }

  if (message.includes('PERMISSION_DENIED') || message.includes('Missing or insufficient permissions')) {
    throw new Error('Firestore read/write failed: Insufficient permissions.');
  }

  throw new Error(`Firestore ${operationType} failed: ${message}`);
}

