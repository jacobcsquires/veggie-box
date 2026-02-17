
'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import * as Icons from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import type { Box } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

type PickupInternal = {
  id: string;
  pickupDate: string; // YYYY-MM-DD
  note: string;
};

export default function EmbedPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedBox, setSelectedBox] = useState<Box | null>(null);
  const [upcomingPickups, setUpcomingPickups] = useState<PickupInternal[]>([]);
  const [isLoadingPickups, setIsLoadingPickups] = useState(false);

  useEffect(() => {
    // Only show boxes that are available for signup
    const q = query(collection(db, 'boxes'), where('displayOnWebsite', '==', true));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const boxesData = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() } as Box));

      setBoxes(boxesData);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (selectedBox && isDialogOpen) {
      setIsLoadingPickups(true);
      const today = format(new Date(), 'yyyy-MM-dd');
      const pickupsRef = collection(db, 'boxes', selectedBox.id, 'pickups');
      const q = query(pickupsRef, where('pickupDate', '>=', today), orderBy('pickupDate'));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const pickupsData = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as PickupInternal);
        setUpcomingPickups(pickupsData);
        setIsLoadingPickups(false);
      });
      return () => unsubscribe();
    } else {
      setUpcomingPickups([]);
    }
  }, [selectedBox, isDialogOpen]);

  const handleSubscribeClick = (box: Box) => {
    // For embeds, we redirect to the main site's login page, with a final
    // destination of the boxes page with the correct subscription dialog open.
    const redirectToUrl = new URL('/dashboard/boxes', window.location.origin);
    redirectToUrl.searchParams.set('subscribe_to', box.id);
    
    const loginUrl = new URL('/login', window.location.origin);
    loginUrl.searchParams.set('redirect_to', redirectToUrl.pathname + redirectToUrl.search);

    window.open(loginUrl.href, '_blank');
  };
  
  return (
    <div className="p-4 bg-background min-h-screen">
       <div className="container px-4 md:px-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="flex flex-col">
                  <CardHeader className="p-0">
                  <Skeleton className="rounded-t-lg aspect-video" />
                  </CardHeader>
                  <CardContent className="p-6 flex-1">
                  <Skeleton className="h-7 w-48" />
                  <Skeleton className="h-4 w-full mt-2" />
                  <Skeleton className="h-4 w-2/3 mt-2" />
                  </CardContent>
                  <CardFooter className="p-6 pt-0 flex-col items-stretch gap-2">
                      <div className="flex justify-between items-center">
                          <Skeleton className="h-8 w-24" />
                          <Skeleton className="h-6 w-20" />
                      </div>
                      <Skeleton className="h-10 w-full mt-2" />
                  </CardFooter>
              </Card>
              ))
          : boxes.map((box) => {
              const isSoldOut = (box.subscribedCount || 0) >= box.quantity;
              const hasSchedule = box.startDate && box.endDate;
              const startDateObj = box.startDate ? new Date(box.startDate.replace(/-/g, '\/')) : null;
              const endDateObj = box.endDate ? new Date(box.endDate.replace(/-/g, '\/')) : null;
              const basePrice = box.pricingOptions?.[0]?.price ?? 0;

              return (
                  <Card key={box.id} className="flex flex-col">
                      <CardHeader className="p-0">
                          <Image
                          src={box.image}
                          alt={box.name}
                          width={600}
                          height={400}
                          data-ai-hint={box.hint}
                          className="rounded-t-lg aspect-video object-cover"
                          />
                      </CardHeader>
                  <CardContent className="p-6 flex-1">
                      <CardTitle className="font-headline">{box.name}</CardTitle>
                      <CardDescription className="mt-2">{box.description}</CardDescription>
                      {hasSchedule && startDateObj && endDateObj && (
                          <p className="text-xs text-muted-foreground pt-2">
                          Available from {format(startDateObj, 'PPP')} to {format(endDateObj, 'PPP')}
                          </p>
                      )}
                  </CardContent>
                  <CardFooter className="p-6 pt-0 flex-col items-stretch gap-2">
                      <div className="flex justify-between items-center">
                      <p className="text-2xl font-bold">
                          ${basePrice.toFixed(2)}{box.pricingOptions.length > 1 ? '+' : ''}
                      </p>
                      <Badge variant="outline" className="capitalize">{box.frequency}</Badge>
                      </div>
                      <Button className="w-full mt-2" onClick={() => handleSubscribeClick(box)} disabled={box.manualSignupCutoff || (!isSoldOut && (!box.pricingOptions || box.pricingOptions.length === 0))}>
                          {box.manualSignupCutoff ? 'Sign-ups Closed'
                              : isSoldOut ? 'Join Waitlist'
                              : (!box.pricingOptions || box.pricingOptions.length === 0) ? 'Not Available' 
                              : 'Subscribe'}
                      </Button>
                  </CardFooter>
                  </Card>
              );
              })}
      </div>
    </div>
  );
}
