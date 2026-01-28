
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { HomeComponent } from '@/app/home-component';

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    }>
        <HomeComponent />
    </Suspense>
  );
}
