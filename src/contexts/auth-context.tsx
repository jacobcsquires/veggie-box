'use client';

import type { User } from 'firebase/auth';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, Unsubscribe } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, onSnapshot } from "firebase/firestore";

export type AppUser = User & {
  isAdmin?: boolean;
  phone?: string | null;
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
    let unsubSnapshot: Unsubscribe | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (authUser) => {
      // First, unsubscribe from any previous snapshot listener
      if (unsubSnapshot) {
        unsubSnapshot();
      }

      if (authUser) {
         const userDocRef = doc(db, 'users', authUser.uid);
         // Assign the new unsubscribe function
         unsubSnapshot = onSnapshot(userDocRef, 
            (docSnap) => {
                const userWithAdminFlag: AppUser = authUser;
                
                if (docSnap.exists()) {
                    const userData = docSnap.data();
                    userWithAdminFlag.isAdmin = userData.isAdmin || false;
                    userWithAdminFlag.phone = userData.phone || null;
                } else {
                    // Handle case where user exists in Auth but not Firestore
                    userWithAdminFlag.isAdmin = false;
                    userWithAdminFlag.phone = null;
                }
                
                setUser(userWithAdminFlag);
                setLoading(false);
            },
            (error) => {
                console.error("Error fetching user data:", error);
                // Set user without admin flag and stop loading
                const partialUser: AppUser = authUser;
                partialUser.phone = null;
                setUser(partialUser); 
                setLoading(false);
            }
         );
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    // Return a cleanup function that unsubscribes from both listeners
    return () => {
        unsubscribeAuth();
        if (unsubSnapshot) {
            unsubSnapshot();
        }
    };
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
