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
      setLoginError(`Login failed: ${e.message}`);
    }
  };

  return { user, loginError, handleLogin };
}
