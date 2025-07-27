
'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { collection, doc, runTransaction, serverTimestamp, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import * as Icons from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
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
import { format } from 'date-fns';
import { Separator } from '@/components/ui/separator';

type PickupInternal = {
  id: string;
  pickupDate: string;
  note: string;
};


export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [date, setDate] = useState<Date | undefined>(undefined);
  
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedBox, setSelectedBox] = useState<Box | null>(null);
  const [availablePickups, setAvailablePickups] = useState<PickupInternal[]>([]);
  const [selectedPickupNote, setSelectedPickupNote] = useState('');
  const [isLoadingPickups, setIsLoadingPickups] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'boxes'), (snapshot) => {
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
      const pickupsRef = collection(db, 'boxes', selectedBox.id, 'pickups');
      const unsubscribe = onSnapshot(pickupsRef, (snapshot) => {
        const pickupsData = snapshot.docs
          .map(doc => ({id: doc.id, ...doc.data()}) as PickupInternal)
          .filter(p => new Date(p.pickupDate.replace(/-/g, '\/')) >= new Date(new Date().setHours(0,0,0,0)));

        pickupsData.sort((a,b) => new Date(a.pickupDate).getTime() - new Date(b.pickupDate).getTime());
        setAvailablePickups(pickupsData);
        setIsLoadingPickups(false);
        
        if (pickupsData.length > 0) {
            const firstAvailableDate = new Date(pickupsData[0].pickupDate.replace(/-/g, '\/'));
            setDate(firstAvailableDate);
            setSelectedPickupNote(pickupsData[0].note);
        } else {
            setDate(undefined);
            setSelectedPickupNote('');
        }
      });
      return () => unsubscribe();
    } else {
      setAvailablePickups([]);
      setDate(undefined);
      setSelectedPickupNote('');
    }
  }, [selectedBox, isDialogOpen]);

  useEffect(() => {
    if (date) {
        const dateString = format(date, 'yyyy-MM-dd');
        const pickupForDate = availablePickups.find(p => p.pickupDate === dateString);
        setSelectedPickupNote(pickupForDate?.note || '');
    } else {
        setSelectedPickupNote('');
    }
  }, [date, availablePickups]);

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
    if (!selectedBox || !date) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Please select a box and a pick up date.',
        });
        return;
    }

    setIsSubscribing(true);
    try {
        const boxRef = doc(db, 'boxes', selectedBox.id);
        
        await runTransaction(db, async (transaction) => {
            const boxDoc = await transaction.get(boxRef);
            if (!boxDoc.exists()) {
                throw new Error("Box does not exist!");
            }

            const boxData = boxDoc.data() as Omit<Box, 'id'>;
            const newSubscribedCount = (boxData.subscribedCount || 0) + 1;

            if (newSubscribedCount > boxData.quantity) {
                throw new Error("Sorry, this box is now sold out.");
            }

            transaction.update(boxRef, { subscribedCount: newSubscribedCount });

            // Create new subscription document
            const subscriptionRef = doc(collection(db, 'subscriptions'));
            const subscriptionData = {
                userId: user.uid,
                customerName: user.displayName,
                boxId: selectedBox.id,
                boxName: selectedBox.name,
                price: selectedBox.price,
                status: 'Active',
                startDate: date.toISOString().split('T')[0],
                nextPickup: date.toISOString().split('T')[0],
                createdAt: serverTimestamp(),
            };
            transaction.set(subscriptionRef, subscriptionData);
        });

        toast({
            title: 'Subscribed!',
            description: `You've successfully subscribed to the ${selectedBox.name}.`,
        });
        
        setIsDialogOpen(false);
        setSelectedBox(null);

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
  
  const availablePickupDates = availablePickups.map(p => new Date(p.pickupDate.replace(/-/g, '\/')));

  return (
    <>
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl font-headline">
          Browse Our Boxes
        </h1>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="rounded-lg aspect-video" />
                  <Skeleton className="h-7 w-48 mt-4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-3/4 mt-2" />
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-8 w-24" />
                  </div>
                </CardContent>
                <CardFooter>
                  <Skeleton className="h-10 w-full" />
                </CardFooter>
              </Card>
            ))
          : boxes.map((box) => {
              const isSoldOut = (box.subscribedCount || 0) >= box.quantity;

              return (
                <Card key={box.id}>
                  <CardHeader>
                    <Image
                      src={box.image}
                      alt={box.name}
                      width={600}
                      height={400}
                      data-ai-hint={box.hint}
                      className="rounded-lg aspect-video object-cover"
                    />
                    <CardTitle className="pt-4 font-headline">{box.name}</CardTitle>
                    <CardDescription>{box.description}</CardDescription>
                    {box.startDate && box.endDate && (
                        <p className="text-xs text-muted-foreground pt-2">
                            Available from {box.startDate} to {box.endDate}
                        </p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center">
                      <p className="text-2xl font-bold">
                        ${box.price}
                        <span className="text-sm font-normal text-muted-foreground">
                          /week
                        </span>
                      </p>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button className="w-full" onClick={() => handleSubscribeClick(box)} disabled={isSoldOut}>
                        {isSoldOut ? 'Sold Out' : 'Subscribe'}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
      </div>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Schedule Your First Pick Up</DialogTitle>
              <DialogDescription>
                Select an available start date for your '{selectedBox?.name}' subscription.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div className="flex justify-center">
                    {isLoadingPickups ? (
                        <div className="flex flex-col items-center justify-center h-[290px]">
                            <Icons.Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-2" />
                            <p className="text-muted-foreground">Loading available dates...</p>
                        </div>
                    ) : availablePickupDates.length > 0 ? (
                        <Calendar
                            mode="single"
                            selected={date}
                            onSelect={setDate}
                            disabled={(currentDate) => {
                                const today = new Date();
                                today.setHours(0,0,0,0);
                                if (currentDate < today) return true;
                                return !availablePickupDates.some(
                                    (pickupDate) => format(pickupDate, 'yyyy-MM-dd') === format(currentDate, 'yyyy-MM-dd')
                                );
                            }}
                            className="rounded-md border"
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-[290px] text-center p-4">
                            <Icons.CalendarX className="h-8 w-8 text-muted-foreground mb-2" />
                            <p className="text-muted-foreground">No upcoming pickup dates have been scheduled for this box yet. Please check back later.</p>
                        </div>
                    )}
                </div>
                 <div className="space-y-4 ml-4">
                    <h3 className="font-semibold">What's in the box?</h3>
                    <div className="space-y-2 text-sm max-h-[220px] overflow-y-auto pr-2 text-muted-foreground">
                        {selectedPickupNote ? (
                           <p>{selectedPickupNote}</p>
                        ) : (
                            <p>Select a date to see the items.</p>
                        )}
                    </div>
                </div>
            </div>
            <Separator />
            <DialogFooter>
              <Button onClick={handleConfirmSubscription} disabled={isSubscribing || !date || isLoadingPickups} className="w-full">
                {isSubscribing ? 'Confirming...' : `Subscribe for $${selectedBox?.price}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </>
  );
}

    