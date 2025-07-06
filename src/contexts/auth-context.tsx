'use client';

import type { User } from 'firebase/auth';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, onSnapshot } from "firebase/firestore";

export type AppUser = User & {
  isAdmin?: boolean;
};

type AuthContextType = {
  user: AppUser | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      if (authUser) {
         const userDocRef = doc(db, 'users', authUser.uid);
         const unsubSnapshot = onSnapshot(userDocRef, (docSnap) => {
            // Start with the authentic Firebase User object
            const userWithAdminFlag: AppUser = authUser;
            
            if (docSnap.exists()) {
                // Augment it with custom data from Firestore without destroying the original object
                const userData = docSnap.data();
                userWithAdminFlag.isAdmin = userData.isAdmin || false;
            }
            
            setUser(userWithAdminFlag);
            setLoading(false);
         });
         return () => unsubSnapshot();
      } else {
        setUser(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const value = { user, loading };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
