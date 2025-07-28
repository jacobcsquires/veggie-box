
'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { collection, doc, onSnapshot, query, where, orderBy } from 'firebase/firestore';
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
import type { Box, PricingOption } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

type PickupInternal = {
  id: string;
  pickupDate: string; // YYYY-MM-DD
  note: string;
};


export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedBox, setSelectedBox] = useState<Box | null>(null);
  const [selectedPriceId, setSelectedPriceId] = useState<string | null>(null);
  const [upcomingPickups, setUpcomingPickups] = useState<PickupInternal[]>([]);
  const [isLoadingPickups, setIsLoadingPickups] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'boxes'), where('displayOnWebsite', '==', true));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const boxesData = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Box)
      );
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
      // Set default price selection
      if (selectedBox.pricingOptions.length > 0) {
        setSelectedPriceId(selectedBox.pricingOptions[0].id);
      }
    } else {
      setUpcomingPickups([]);
      setSelectedPriceId(null);
    }
  }, [selectedBox, isDialogOpen]);

  const handleSubscribeClick = (box: Box) => {
    setSelectedBox(box);
    setIsDialogOpen(true);
  };

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
  
  return (
    <>
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl font-headline">
          Browse Our Veggie Box Plans
        </h1>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                    <Button className="w-full mt-2" onClick={() => handleSubscribeClick(box)} disabled={isSoldOut || box.pricingOptions.length === 0 || box.manualSignupCutoff}>
                        {isSoldOut ? 'Sold Out' : box.pricingOptions.length === 0 ? 'Not Available' : box.manualSignupCutoff ? 'Sign-ups Closed' : 'Subscribe'}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
      </div>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Subscribe to {selectedBox?.name}</DialogTitle>
              <DialogDescription>
                Select your pricing option and confirm your subscription.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
               <div>
                <h3 className="font-semibold text-sm mb-2">Pricing Options</h3>
                <RadioGroup value={selectedPriceId ?? ''} onValueChange={setSelectedPriceId}>
                    {selectedBox?.pricingOptions.map(option => (
                        <div key={option.id} className="flex items-center space-x-2 rounded-md border p-3">
                            <RadioGroupItem value={option.id} id={option.id} />
                            <Label htmlFor={option.id} className="flex flex-col w-full cursor-pointer">
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
            </div>
            <DialogFooter className="pt-4">
              <Button onClick={handleConfirmSubscription} disabled={isSubscribing || isLoadingPickups || upcomingPickups.length === 0} className="w-full">
                {isSubscribing ? 'Redirecting to payment...' : `Confirm Subscription`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </>
  );
}
