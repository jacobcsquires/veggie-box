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
         const unsubSnapshot = onSnapshot(userDocRef, 
            (docSnap) => {
                const userWithAdminFlag: AppUser = authUser;
                
                if (docSnap.exists()) {
                    const userData = docSnap.data();
                    userWithAdminFlag.isAdmin = userData.isAdmin || false;
                } else {
                    // Handle case where user exists in Auth but not Firestore
                    userWithAdminFlag.isAdmin = false;
                }
                
                setUser(userWithAdminFlag);
                setLoading(false);
            },
            (error) => {
                // This is the crucial error handler
                console.error("Error fetching user data:", error);
                // Set user without admin flag and stop loading
                setUser(authUser); 
                setLoading(false);
            }
         );
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
