'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export function HomeComponent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Wait until the authentication status is determined.
    if (authLoading) {
      return;
    }

    // If a user is logged in, redirect to their dashboard.
    // Otherwise, redirect to the login page.
    if (user) {
      router.replace(user.isAdmin ? '/admin/dashboard' : '/dashboard');
    } else {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  // Render a loading spinner while the redirection is in progress.
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  );
}
