'use client';

import { useEffect, useState, Suspense, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter, useSearchParams } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';
import { collection, doc, onSnapshot, query, where, orderBy, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
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
import type { Box, PricingOption, AddOn } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Sprout } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';


type PickupInternal = {
  id: string;
  pickupDate: string; // YYYY-MM-DD
  note: string;
};

function SubscribeFromQuery({ boxes, onSubscribe }: { boxes: Box[], onSubscribe: (box: Box) => void }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const subscribeToId = searchParams.get('subscribe_to');
    if (subscribeToId && boxes.length > 0) {
      const boxToSubscribe = boxes.find(b => b.id === subscribeToId);
      if (boxToSubscribe) {
        onSubscribe(boxToSubscribe);
      }
    }
  }, [searchParams, boxes, onSubscribe]);

  return null;
}


export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedBox, setSelectedBox] = useState<Box | null>(null);
  const [selectedPriceId, setSelectedPriceId] = useState<string | null>(null);
  const [upcomingPickups, setUpcomingPickups] = useState<PickupInternal[]>([]);
  const [isLoadingPickups, setIsLoadingPickups] = useState(false);
  const [isJoiningWaitlist, setIsJoiningWaitlist] = useState(false);
  const [waitlistedBoxes, setWaitlistedBoxes] = useState<string[]>([]);
  
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [isLoadingAddOns, setIsLoadingAddOns] = useState(false);
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);

  useEffect(() => {
    if (!authLoading && user) {
      router.replace(user.isAdmin ? '/admin/dashboard' : '/dashboard');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const q = query(collection(db, 'boxes'), where('displayOnWebsite', '==', true));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const boxesData = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Box)
      );
      setBoxes(boxesData);
      setIsLoading(false);
    });
    
    setIsLoadingAddOns(true);
    const unsubscribeAddOns = onSnapshot(collection(db, 'addOns'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AddOn));
      setAddOns(data);
      setIsLoadingAddOns(false);
    });
    
    return () => {
        unsubscribe();
        unsubscribeAddOns();
    };
  }, []);

  useEffect(() => {
    if (user && boxes.length > 0) {
        const unsubs = boxes.map(box => {
            if (!user) return () => {};
            const waitlistRef = doc(db, 'boxes', box.id, 'waitlist', user.uid);
            return onSnapshot(waitlistRef, (docSnap) => {
                setWaitlistedBoxes(prev => {
                    const newWaitlisted = new Set(prev);
                    if (docSnap.exists()) {
                        newWaitlisted.add(box.id);
                    } else {
                        newWaitlisted.delete(box.id);
                    }
                    return Array.from(newWaitlisted);
                });
            });
        });
        return () => unsubs.forEach(unsub => unsub());
    } else {
        setWaitlistedBoxes([]);
    }
  }, [user, boxes]);


  const handleSubscribeClick = useCallback((box: Box) => {
    if (!user) {
        const redirectToUrl = new URL('/dashboard/boxes', window.location.origin);
        redirectToUrl.searchParams.set('subscribe_to', box.id);
        
        const loginUrl = new URL('/login', window.location.origin);
        loginUrl.searchParams.set('redirect_to', redirectToUrl.pathname + redirectToUrl.search);
        
        router.push(loginUrl.toString());
        return;
    }
    setSelectedBox(box);
    setIsDialogOpen(true);
  }, [user, router]);
  
  const handleJoinWaitlist = async (box: Box) => {
    if (!user) {
        handleSubscribeClick(box); // Will redirect to login
        return;
    }

    setIsJoiningWaitlist(true);
    setSelectedBox(box); // To disable the correct button
    try {
        const waitlistRef = doc(db, 'boxes', box.id, 'waitlist', user.uid);
        const boxRef = doc(db, 'boxes', box.id);

        await runTransaction(db, async (transaction) => {
            const boxDoc = await transaction.get(boxRef);
            if (!boxDoc.exists()) {
                throw new Error("This veggie box plan does not exist.");
            }
            const waitlistDoc = await transaction.get(waitlistRef);

            if (waitlistDoc.exists()) {
                throw new Error("You are already on the waitlist for this plan.");
            }
            
            const boxData = boxDoc.data() as Box;
            const newWaitlistCount = (boxData.waitlistCount || 0) + 1;
            
            transaction.set(waitlistRef, {
                userName: user.displayName,
                userEmail: user.email,
                joinedAt: serverTimestamp(),
            });
            transaction.update(boxRef, { waitlistCount: newWaitlistCount });
        });

        toast({
            title: 'Success!',
            description: `You've been added to the waitlist for ${box.name}.`,
        });
    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: error.message || 'Could not join the waitlist.',
        });
    } finally {
        setIsJoiningWaitlist(false);
        setSelectedBox(null);
    }
};

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
      
      if (selectedBox.pricingOptions && selectedBox.pricingOptions.length > 0) {
        setSelectedPriceId(selectedBox.pricingOptions[0].id);
      }
      return () => unsubscribe();
    } else {
      setUpcomingPickups([]);
      setSelectedPriceId(null);
      setSelectedAddOns([]);
    }
  }, [selectedBox, isDialogOpen]);

  const handleConfirmSubscription = async () => {
    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Not Logged In',
        description: 'You need to be logged in to subscribe.',
      });
      return;
    }
    if (!selectedBox || !selectedPriceId) {
        toast({ variant: 'destructive', title: 'Error', description: 'No Veggie Box Plan or pricing option selected.' });
        return;
    }
    
    const firstPickup = upcomingPickups[0];

    if (!firstPickup) {
        toast({
            variant: 'destructive',
            title: 'No Pickups Available',
            description: 'There are no upcoming pickups for this Veggie Box Plan.',
        });
        return;
    }

    const selectedPricingOption = selectedBox.pricingOptions.find(p => p.id === selectedPriceId);
    if (!selectedPricingOption) {
        toast({ variant: 'destructive', title: 'Error', description: 'Selected pricing option not found.' });
        return;
    }

    setIsSubscribing(true);
    try {
        const response = await fetch('/api/checkout_sessions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                boxId: selectedBox.id,
                userId: user.uid,
                customerName: user.displayName,
                email: user.email,
                startDate: firstPickup.pickupDate,
                priceId: selectedPricingOption.id,
                price: selectedPricingOption.price,
                priceName: selectedPricingOption.name,
                addOns: selectedAddOns,
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to create checkout session');
        }

        const { url } = await response.json();
        window.location.href = url;

    } catch (error: any) {
        console.error('Subscription failed:', error);
        toast({
            variant: 'destructive',
            title: 'Subscription Failed',
            description: error.message || 'There was an error processing your subscription. Please try again.',
        });
    } finally {
        setIsSubscribing(false);
    }
  };

  if (authLoading || user) {
    return (
        <div className="flex items-center justify-center min-h-screen">
            <Icons.Loader2 className="h-8 w-8 animate-spin" />
        </div>
    )
  }
  
  return (
    <div className="flex flex-col min-h-screen">
      <Suspense fallback={null}>
          <SubscribeFromQuery boxes={boxes} onSubscribe={handleSubscribeClick} />
      </Suspense>
      <header className="px-4 lg:px-6 h-14 flex items-center bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 border-b">
        <Link href="#" className="flex items-center justify-center" prefetch={false}>
          <Sprout className="h-6 w-6 text-primary" />
          <span className="sr-only">Veggie Box Customer Portal</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6">
          {authLoading ? (
            <Skeleton className="h-8 w-20" />
          ) : user ? (
            <Button asChild>
                <Link href={user.isAdmin ? '/admin/dashboard' : '/dashboard'}>Dashboard</Link>
            </Button>
          ) : (
            <Button asChild>
                <Link href="/login">Login</Link>
            </Button>
          )}
        </nav>
      </header>
      <main className="flex-1">
        <section id="boxes" className="w-full py-12 md:py-24 lg:py-32">
             <div className="grid grid-flow-col auto-cols-max justify-center gap-6 px-4 py-4 overflow-x-auto md:px-6">
                {isLoading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <Card key={i} className="flex w-full max-w-sm flex-col">
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
                    const isWaitlisted = waitlistedBoxes.includes(box.id);
                    const hasSchedule = box.startDate && box.endDate;
                    const startDateObj = box.startDate ? new Date(box.startDate.replace(/-/g, '\/')) : null;
                    const endDateObj = box.endDate ? new Date(box.endDate.replace(/-/g, '\/')) : null;
                    const basePrice = box.pricingOptions?.[0]?.price ?? 0;

                    return (
                        <Card key={box.id} className="flex w-full max-w-sm flex-col shrink-0">
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
                            <Button 
                                className="w-full mt-2" 
                                variant={isSoldOut && !isWaitlisted ? "accent" : "default"}
                                onClick={() => isSoldOut ? handleJoinWaitlist(box) : handleSubscribeClick(box)} 
                                disabled={ (isJoiningWaitlist && selectedBox?.id === box.id) || (isSoldOut && isWaitlisted) || box.manualSignupCutoff || (!isSoldOut && (!box.pricingOptions || box.pricingOptions.length === 0)) }
                            >
                                {box.manualSignupCutoff ? 'Sign-ups Closed'
                                    : isSoldOut 
                                        ? (isWaitlisted ? 'On Waitlist' : 'Join Waitlist')
                                        : (!box.pricingOptions || box.pricingOptions.length === 0) ? 'Not Available'
                                        : 'Subscribe'}
                            </Button>
                        </CardFooter>
                        </Card>
                    );
                    })}
            </div>
        </section>
      </main>
      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
        <p className="text-xs text-muted-foreground">&copy; 2024 Veggie Box. All rights reserved.</p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <Link href="#" className="text-xs hover:underline underline-offset-4" prefetch={false}>
            Terms of Service
          </Link>
          <Link href="#" className="text-xs hover:underline underline-offset-4" prefetch={false}>
            Privacy
          </Link>
        </nav>
      </footer>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Subscribe to {selectedBox?.name}</DialogTitle>
              <DialogDescription>
                Confirm your subscription. Your first pickup will be on the next available date.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              <div>
                <h3 className="font-semibold text-sm mb-2">Pricing Options</h3>
                <RadioGroup value={selectedPriceId ?? ''} onValueChange={setSelectedPriceId}>
                    {selectedBox?.pricingOptions.map(option => (
                        <div key={option.id} className="flex items-center space-x-2 rounded-md border p-3">
                            <RadioGroupItem value={option.id} id={`page-${option.id}`} />
                            <Label htmlFor={`page-${option.id}`} className="flex flex-col w-full cursor-pointer">
                                <div className="flex justify-between items-center">
                                    <span className="font-medium">{option.name}</span>
                                    <span className="font-bold">${option.price.toFixed(2)}</span>
                                </div>
                                {option.description && <p className="text-xs text-muted-foreground">{option.description}</p>}
                            </Label>
                        </div>
                    ))}
                </RadioGroup>
              </div>
              <Separator />
               <div>
                <h3 className="font-semibold text-sm mb-2">Upcoming Pickup Dates</h3>
                {isLoadingPickups ? (
                    <div className="flex items-center justify-center h-24">
                        <Icons.Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : upcomingPickups.length > 0 ? (
                    <ScrollArea className="h-40 rounded-md border">
                        <div className="p-4 text-sm">
                           {upcomingPickups.map(pickup => (
                            <div key={pickup.id} className="mb-2">
                              <p className="font-medium">{format(parseISO(pickup.pickupDate), 'PPP')}</p>
                              {pickup.note && <p className="text-muted-foreground text-xs pl-2">- {pickup.note}</p>}
                            </div>
                           ))}
                        </div>
                    </ScrollArea>
                ) : (
                    <div className="flex flex-col items-center justify-center h-24 text-center p-4 rounded-md border">
                        <Icons.CalendarX className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">No upcoming pickups scheduled.</p>
                    </div>
                )}
               </div>
                <Separator />
                 <div>
                    <h3 className="font-semibold text-sm mb-2">Available Add-ons</h3>
                    {isLoadingAddOns ? (
                        <div className="flex items-center justify-center h-24">
                            <Icons.Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : addOns.length > 0 ? (
                        <ScrollArea className="h-40 rounded-md border">
                            <div className="p-4 space-y-4">
                            {addOns.map(addOn => (
                                <div key={addOn.id} className="flex items-start space-x-3">
                                    <Checkbox
                                        id={`addon-page-${addOn.id}`}
                                        onCheckedChange={(checked) => {
                                            setSelectedAddOns(prev => 
                                                checked 
                                                ? [...prev, addOn.stripePriceId] 
                                                : prev.filter(id => id !== addOn.stripePriceId)
                                            );
                                        }}
                                    />
                                    <div className="grid gap-1.5 leading-none">
                                    <Label htmlFor={`addon-page-${addOn.id}`} className="font-medium cursor-pointer">
                                        {addOn.name}
                                    </Label>
                                    <p className="text-sm text-muted-foreground">{addOn.description}</p>
                                    <p className="text-sm font-bold">${addOn.price.toFixed(2)} / {addOn.frequency.replace('-weekly','wk').replace('bi-weekly', '2wk').replace('monthly', 'mo')}</p>
                                    </div>
                                </div>
                            ))}
                            </div>
                        </ScrollArea>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">No add-ons available.</p>
                    )}
                </div>
            </div>
            <DialogFooter className="pt-4">
              <Button onClick={handleConfirmSubscription} disabled={isSubscribing || isLoadingPickups || upcomingPickups.length === 0} className="w-full">
                {isSubscribing ? 'Redirecting to payment...' : `Confirm Subscription`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
}
