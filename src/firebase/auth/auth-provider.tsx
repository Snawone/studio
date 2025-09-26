'use client';
import { useRouter, usePathname } from 'next/navigation';
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
  const pathname = usePathname();

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAuthLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthLoading(true);
      if (firebaseUser) {
        setUser(firebaseUser);
        // Profile fetching will be handled by the next useEffect
      } else {
        setUser(null);
        setProfile(null);
        setAuthLoading(false);
        // If on an app page, redirect to home
        if (pathname.startsWith('/app')) {
            router.push('/');
        }
      }
    });
    return () => unsubscribe();
  }, [auth, router, pathname]);

  useEffect(() => {
    if (user) {
      const userDocRef = doc(firestore, 'users', user.uid);
      const unsubscribe = onSnapshot(userDocRef, (doc) => {
        if (doc.exists()) {
          const userProfileData = { id: doc.id, ...doc.data() } as UserProfile;
          
          // Hardcoded admin check
          if (user.email === 'santiagowyka@gmail.com') {
            userProfileData.isAdmin = true;
          }

          setProfile(userProfileData);

          // If not on an app page, redirect to app
          if (!pathname.startsWith('/app')) {
            router.push('/app');
          }
        } else {
            // This can happen briefly on signup. If it persists, there's an issue.
            // For now, we clear the profile and let the UI decide what to do.
            setProfile(null);
        }
        setAuthLoading(false);
      }, (error) => {
          console.error("Error fetching user profile:", error);
          setAuthLoading(false);
          setProfile(null);
          // Optional: Force logout if profile can't be fetched
          // signOut(auth);
      });
      return () => unsubscribe();
    } else {
        // No user, no profile fetching needed.
        setAuthLoading(false);
    }
  }, [user, firestore, router, pathname, auth]);

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
