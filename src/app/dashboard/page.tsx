'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { collection, doc, runTransaction, serverTimestamp, onSnapshot } from 'firebase/firestore';
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


export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [date, setDate] = useState<Date | undefined>(new Date());
  
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedBox, setSelectedBox] = useState<Box | null>(null);

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
            description: 'Please select a box and a delivery date.',
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

            // Create new subscription and order documents within the same transaction
            const subscriptionRef = doc(collection(db, 'subscriptions'));
            const orderRef = doc(collection(db, 'orders'));

            const subscriptionData = {
                userId: user.uid,
                boxId: selectedBox.id,
                boxName: selectedBox.name,
                price: selectedBox.price,
                status: 'Active',
                startDate: date.toISOString().split('T')[0],
                nextDelivery: date.toISOString().split('T')[0],
                createdAt: serverTimestamp(),
            };
            transaction.set(subscriptionRef, subscriptionData);
            
            const orderData = {
                userId: user.uid,
                customerName: user.displayName || 'No name',
                boxId: selectedBox.id,
                boxName: selectedBox.name,
                price: selectedBox.price,
                status: 'Processing',
                orderDate: new Date().toISOString().split('T')[0],
                deliveryDate: date.toISOString().split('T')[0],
                createdAt: serverTimestamp(),
            };
            transaction.set(orderRef, orderData);
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
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-8 w-24" />
                    <div className="flex -space-x-2">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <Skeleton className="h-8 w-8 rounded-full" />
                    </div>
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

                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center">
                      <p className="text-2xl font-bold">
                        ${box.price}
                        <span className="text-sm font-normal text-muted-foreground">
                          /week
                        </span>
                      </p>
                      <div className="flex -space-x-2">
                        {box.items?.map((item) => {
                          const ItemIcon = Icons[item.icon as keyof typeof Icons] || Icons.HelpCircle;
                          return (
                            <div
                              key={item.name}
                              className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 border-2 border-background"
                              title={item.name}
                            >
                              <ItemIcon className="h-4 w-4 text-primary" />
                            </div>
                          );
                        })}
                      </div>
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
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Schedule Your First Delivery</DialogTitle>
              <DialogDescription>
                Select a start date for your '{selectedBox?.name}' subscription. You can change this later.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                disabled={(d) => d < new Date(new Date().setDate(new Date().getDate() - 1))}
                className="rounded-md border"
              />
            </div>
            <DialogFooter>
              <Button onClick={handleConfirmSubscription} disabled={isSubscribing}>
                {isSubscribing ? 'Confirming...' : 'Confirm Subscription'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </>
  );
}
