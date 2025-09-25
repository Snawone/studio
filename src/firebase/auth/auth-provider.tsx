'use client';
import { useRouter } from 'next/navigation';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { User, onAuthStateChanged, signOut, IdTokenResult } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

import { useAuth, useFirestore } from '@/firebase/provider';
import { type UserProfile } from '@/lib/data';
import { Loader2 } from 'lucide-react';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  isAuthLoading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAuthLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthLoading(true);
      if (firebaseUser) {
        setUser(firebaseUser);
      } else {
        setUser(null);
        setProfile(null);
        setAuthLoading(false);
        // If on a protected route, redirect to login
        if (typeof window !== 'undefined' && window.location.pathname.startsWith('/app')) {
            router.push('/');
        }
      }
    });
    return () => unsubscribe();
  }, [auth, router]);

  useEffect(() => {
    if (user) {
      const userDocRef = doc(firestore, 'users', user.uid);
      const unsubscribe = onSnapshot(userDocRef, async (doc) => {
        if (doc.exists()) {
          const token: IdTokenResult = await user.getIdTokenResult();
          const userProfile: UserProfile = { 
            id: doc.id,
            ...doc.data(),
          } as UserProfile;

          // Hardcoded admin check
          if (user.email === 'santiagowyka@gmail.com') {
            userProfile.isAdmin = true;
          }
          
          setProfile(userProfile);
          
          if (typeof window !== 'undefined' && window.location.pathname !== '/app') {
            router.push('/app');
          }
        } else {
          // This case can happen briefly during signup.
          // Or if the user document was deleted.
          setProfile(null);
        }
        setAuthLoading(false);
      });
      return () => unsubscribe();
    } else {
      // If there's no user, we are not loading auth data anymore.
      setAuthLoading(false);
    }
  }, [user, firestore, router]);

  const logout = async () => {
    await signOut(auth);
    router.push('/');
  };

  const value = { user, profile, isAuthLoading, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};
