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
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        let profileUnsubscribe: (() => void) | undefined;

        firebaseUser.getIdTokenResult(true).then(idTokenResult => {
            const isAdmin = idTokenResult.claims.isAdmin === true;

            const userDocRef = doc(firestore, 'users', firebaseUser.uid);
            profileUnsubscribe = onSnapshot(userDocRef, (docSnap: DocumentSnapshot) => {
                if (docSnap.exists()) {
                    const userProfileData = { id: docSnap.id, ...docSnap.data() } as UserProfile;
                    userProfileData.isAdmin = isAdmin;
                    setProfile(userProfileData);
                } else {
                    setProfile(null);
                }
                setAuthLoading(false);
                if (!pathname.startsWith('/app')) {
                    router.push('/app');
                }
            }, (error) => {
                console.error("Error fetching user profile:", error);
                setProfile(null);
                setAuthLoading(false);
            });
        }).catch(error => {
            console.error("Error getting ID token result:", error);
            setUser(null);
            setProfile(null);
            setAuthLoading(false);
        });

        // Cleanup function for profile listener
        return () => {
          if (profileUnsubscribe) {
            profileUnsubscribe();
          }
        };
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
