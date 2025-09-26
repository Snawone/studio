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
import { doc, onSnapshot, DocumentSnapshot } from 'firebase/firestore';

import { useAuth, useFirestore } from '@/firebase/provider';
import { type UserProfile } from '@/lib/data';

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
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthLoading(true);
      if (firebaseUser) {
        // Force refresh the token to get the latest custom claims.
        const idTokenResult = await firebaseUser.getIdTokenResult(true);
        const isAdminClaim = !!idTokenResult.claims.isAdmin;
        const isHardcodedAdmin = firebaseUser.email === 'santiagowyka@gmail.com';
        const effectiveIsAdmin = isHardcodedAdmin || isAdminClaim;
        
        setUser(firebaseUser);

        const userDocRef = doc(firestore, 'users', firebaseUser.uid);
        const unsubscribeProfile = onSnapshot(userDocRef, (docSnap: DocumentSnapshot) => {
          let userProfileData: UserProfile | null = null;
          if (docSnap.exists()) {
            userProfileData = { id: docSnap.id, ...docSnap.data() } as UserProfile;
          }
          
          setProfile(userProfileData ? { ...userProfileData, isAdmin: effectiveIsAdmin } : {
             id: firebaseUser.uid,
             email: firebaseUser.email || '',
             name: firebaseUser.displayName || 'Usuario',
             searchList: [],
             isAdmin: effectiveIsAdmin
          });

          setAuthLoading(false);
          if (!pathname.startsWith('/app')) {
            router.push('/app');
          }
        }, (error) => {
            console.error("Error fetching user profile:", error);
            setUser(null);
            setProfile(null);
            setAuthLoading(false);
            if (pathname.startsWith('/app')) {
                router.push('/');
            }
        });
        
        return () => unsubscribeProfile();
      } else {
        setUser(null);
        setProfile(null);
        setAuthLoading(false);
        if (pathname.startsWith('/app')) {
          router.push('/');
        }
      }
    });

    return () => unsubscribeAuth();
  }, [auth, firestore, router, pathname]);

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
