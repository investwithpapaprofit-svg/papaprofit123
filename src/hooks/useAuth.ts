import { useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithPopup, User } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    return onAuthStateChanged(auth, setUser);
  }, []);

  const handleLogin = async () => {
    try {
      setLoginError('');
      await signInWithPopup(auth, googleProvider);
    } catch (e: any) {
      let msg = 'An unexpected error occurred. Please try again.';
      if (e.code === 'auth/popup-closed-by-user') {
        msg = 'Login was cancelled.';
      } else if (e.code === 'auth/network-request-failed') {
        msg = 'Network issue. Check your connection.';
      } else if (e.code === 'auth/too-many-requests') {
        msg = 'Too many attempts. Try again later.';
      } else if (e.code === 'auth/popup-blocked') {
        msg = 'Popup blocked by your browser. Please allow popups for this site.';
      } else {
        console.error("Auth error:", e);
        msg = 'Something went wrong during login. Please try again.';
      }
      setLoginError(msg);
    }
  };

  return { user, loginError, handleLogin };
}
