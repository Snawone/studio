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
import { setAdminClaim } from '@/ai/flows/set-admin-claim';

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

        const isHardcodedAdminEmail = firebaseUser.email === 'santiagowyka@gmail.com';
        
        // This is the critical fix. If the user is the hardcoded admin, we ensure
        // the custom claim is set on their auth token. This only needs to run once,
        // but running it on each login is a safe way to ensure it's set.
        if (isHardcodedAdminEmail) {
            await setAdminClaim({ uid: firebaseUser.uid, isAdmin: true });
        }

        // Force refresh the token to get the latest custom claims.
        const idTokenResult = await firebaseUser.getIdTokenResult(true);
        const isAdminClaim = !!idTokenResult.claims.isAdmin;
        
        setUser(firebaseUser);

        const userDocRef = doc(firestore, 'users', firebaseUser.uid);
        const unsubscribeProfile = onSnapshot(userDocRef, (docSnap: DocumentSnapshot) => {
          let userProfileData: UserProfile | null = null;
          if (docSnap.exists()) {
            userProfileData = { id: docSnap.id, ...docSnap.data() } as UserProfile;
          }
          
          setProfile(userProfileData ? { ...userProfileData, isAdmin: isAdminClaim } : {
             id: firebaseUser.uid,
             email: firebaseUser.email || '',
             name: firebaseUser.displayName || 'Usuario',
             searchList: [],
             isAdmin: isAdminClaim
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
