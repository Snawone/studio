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
    let unsubscribeProfile: () => void = () => {};

    if (user) {
      // Get custom claims first
      user.getIdTokenResult(true).then(idTokenResult => {
        const isAdmin = idTokenResult.claims.isAdmin === true;

        // Now listen to profile changes
        const userDocRef = doc(firestore, 'users', user.uid);
        unsubscribeProfile = onSnapshot(userDocRef, (doc) => {
          if (doc.exists()) {
            const userProfileData = { id: doc.id, ...doc.data() } as UserProfile;
            userProfileData.isAdmin = isAdmin; // Set isAdmin from the token claim
            setProfile(userProfileData);

            if (!pathname.startsWith('/app')) {
              router.push('/app');
            }
          } else {
              setProfile(null);
          }
          setAuthLoading(false);
        }, (error) => {
            console.error("Error fetching user profile:", error);
            setAuthLoading(false);
            setProfile(null);
        });
      }).catch(error => {
        console.error("Error getting ID token result:", error);
        setAuthLoading(false);
      });
    } else {
        setAuthLoading(false);
    }
    
    return () => unsubscribeProfile();
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
