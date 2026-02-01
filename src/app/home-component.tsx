'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export function HomeComponent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) {
      return; // Wait for the auth state to be determined
    }

    if (user) {
      router.replace(user.isAdmin ? '/admin/dashboard' : '/dashboard');
    } else {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  // Only show the spinner while auth is loading. After that, the redirect
  // has been initiated and we can render nothing.
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return null;
}
