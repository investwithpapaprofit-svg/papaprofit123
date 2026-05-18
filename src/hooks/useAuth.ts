import { useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signInWithRedirect, 
  getRedirectResult,
  setPersistence,
  browserLocalPersistence,
  User 
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from '../firebase';
import { DEFAULT_PROFILE } from './useProfile';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    // Enable local persistence
    setPersistence(auth, browserLocalPersistence).catch(console.error);

    // Handle redirect login recovery
    const checkRedirect = async () => {
      try {
        setIsLoggingIn(true);
        const result = await getRedirectResult(auth);
        if (result?.user) {
          await ensureUserDocument(result.user);
        }
      } catch (e: any) {
        console.error("Redirect auth error:", e);
        setLoginError(mapAuthError(e.code));
      } finally {
        setIsLoggingIn(false);
      }
    };
    checkRedirect();

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u && !isLoggingIn) {
        // If they just logged in not through active handleLogin process, ensure doc 
        await ensureUserDocument(u);
      }
      setUser(u);
    });

    return unsubscribe;
  }, []);

  const ensureUserDocument = async (u: User) => {
    try {
      const userRef = doc(db, 'users', u.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, {
           email: u.email,
           profile: {
             ...DEFAULT_PROFILE,
             personal: {
                ...DEFAULT_PROFILE.personal,
                name: u.displayName || '',
                email: u.email || '',
             }
           }
        });
      }
    } catch (err) {
      console.error('Error ensuring user doc:', err);
    }
  };

  const mapAuthError = (code: string) => {
    switch (code) {
      case 'auth/popup-blocked':
        return 'Your browser blocked the login popup.';
      case 'auth/network-request-failed':
        return 'Network issue. Please check your connection.';
      case 'auth/too-many-requests':
        return 'Too many login attempts. Try again later.';
      case 'auth/internal-error':
        return 'Authentication temporarily unavailable.';
      case 'auth/popup-closed-by-user':
      case 'auth/cancelled-popup-request':
        return 'Login popup was closed before completion.';
      default:
        return 'Something went wrong during login. Please try again.';
    }
  }

  const handleLogin = async () => {
    try {
      setIsLoggingIn(true);
      setLoginError('');
      
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      
      if (isStandalone) {
        await signInWithRedirect(auth, googleProvider);
      } else {
        try {
          const result = await signInWithPopup(auth, googleProvider);
          if (result.user) {
            await ensureUserDocument(result.user);
          }
        } catch (popupErr: any) {
          if (
            popupErr.code === 'auth/popup-blocked' ||
            popupErr.code === 'auth/popup-closed-by-user' ||
            popupErr.code === 'auth/cancelled-popup-request'
          ) {
            await signInWithRedirect(auth, googleProvider);
            return;
          }
          throw popupErr;
        }
      }
    } catch (e: any) {
      setLoginError(mapAuthError(e.code));
      setIsLoggingIn(false);
    }
  };

  return { user, loginError, handleLogin, isLoggingIn };
}

