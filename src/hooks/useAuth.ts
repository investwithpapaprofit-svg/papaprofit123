import { useState, useEffect } from 'react';
import { User, signInWithPopup, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = async () => {
    try {
      setLoginError(null);
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Login failed:", error);
      if (error.code === 'auth/popup-blocked') {
        setLoginError("Popup blocked. Please allow popups or open in a new tab.");
      } else if (error.code === 'auth/unauthorized-domain') {
        setLoginError("Domain not authorized. Add this URL to 'Authorized domains' in Firebase Console.");
      } else {
        setLoginError("Login failed: " + (error.message || "Unknown error"));
      }
    }
  };

  const logout = async () => {
    await firebaseSignOut(auth);
  };

  return { user, loginError, isLoading, login, logout, setLoginError };
}
