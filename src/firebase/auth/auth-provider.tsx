'use client';
import { useRouter } from 'next/navigation';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
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
      if (firebaseUser) {
        setUser(firebaseUser);
      } else {
        setUser(null);
        setProfile(null);
        setAuthLoading(false);
        if (typeof window !== 'undefined' && window.location.pathname.startsWith('/app')) {
            router.push('/');
        }
      }
    });
    return () => unsubscribe();
  }, [auth, router]);

  useEffect(() => {
    if (user) {
      setAuthLoading(true);
      const userDocRef = doc(firestore, 'users', user.uid);
      const unsubscribe = onSnapshot(userDocRef, (doc) => {
        if (doc.exists()) {
          const userProfileData = { id: doc.id, ...doc.data() } as UserProfile;
          if (user.email === 'santiagowyka@gmail.com') {
            userProfileData.isAdmin = true;
          }
          setProfile(userProfileData);
          if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/app')) {
            router.push('/app');
          }
        }
        // If the doc doesn't exist, we wait. It might be in the process of being created.
        // The main page's loading state will handle showing a spinner.
        setAuthLoading(false);
      }, (error) => {
          console.error("Error fetching user profile:", error);
          setAuthLoading(false);
          setProfile(null);
          signOut(auth);
      });
      return () => unsubscribe();
    } else {
        setAuthLoading(false);
    }
  }, [user, firestore, router, auth]);

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
