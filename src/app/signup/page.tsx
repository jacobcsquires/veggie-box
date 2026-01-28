import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { SignupComponent } from './signup-component';

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    }>
      <SignupComponent />
    </Suspense>
  );
}
