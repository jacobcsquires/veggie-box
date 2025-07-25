
'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc, collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import * as Icons from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Box, Pickup } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

export default function UserSchedulePage({ params }: { params: { boxId: string } }) {
  const boxId = params.boxId;

  const [box, setBox] = useState<Box | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [selectedPickupItems, setSelectedPickupItems] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    if (!boxId) return;

    // Fetch box details
    const boxRef = doc(db, 'boxes', boxId);
    getDoc(boxRef).then((docSnap) => {
      if (docSnap.exists()) {
        setBox({ id: docSnap.id, ...docSnap.data() } as Box);
      }
      setIsLoading(false);
    });

    // Listen for pickup updates
    const q = query(collection(db, 'pickups'), where('boxId', '==', boxId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pickupsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pickup));
      setPickups(pickupsData);
    });

    return () => unsubscribe();
  }, [boxId]);

  useEffect(() => {
    if (selectedDate) {
      const dateString = format(selectedDate, 'yyyy-MM-dd');
      const pickupForDate = pickups.find(d => d.pickupDate === dateString);
      setSelectedPickupItems(pickupForDate?.items || []);
    } else {
        setSelectedPickupItems([]);
    }
  }, [selectedDate, pickups]);

  const pickupDates = pickups.map(d => new Date(d.pickupDate.replace(/-/g, '\/')));

  if (isLoading) {
    return (
        <div>
            <Skeleton className="h-8 w-64 mb-4" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                    <Card>
                        <CardHeader>
                            <Skeleton className="h-6 w-48" />
                            <Skeleton className="h-4 w-full mt-2" />
                        </CardHeader>
                        <CardContent>
                             <Skeleton className="w-full h-80 rounded-md border" />
                        </CardContent>
                    </Card>
                </div>
                <div>
                     <Card>
                        <CardHeader>
                            <Skeleton className="h-6 w-40" />
                            <Skeleton className="h-4 w-32 mt-2" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-48 w-full" />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
  }

  if (!box) {
    return <div>Subscription not found.</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-headline mb-4">Pick Up Schedule for {box.name}</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        <div className="md:col-span-2">
          <Card>
             <CardHeader>
                <CardTitle>Pick Up Calendar</CardTitle>
                <CardDescription>Select a date to see what's planned for your pick up. Dates with scheduled pickups are highlighted.</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                modifiers={{ scheduled: pickupDates }}
                modifiersClassNames={{ scheduled: 'bg-primary/20' }}
                className="rounded-md border"
              />
            </CardContent>
          </Card>
        </div>
        <div>
          <Card>
            <CardHeader>
              <CardTitle>What's in the box?</CardTitle>
               <CardDescription>Items for {selectedDate ? format(selectedDate, 'PPP') : '...'}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {selectedPickupItems.length > 0 ? (
                        selectedPickupItems.map((item, index) => {
                            const ItemIcon = Icons[item.icon as keyof typeof Icons] || Icons.HelpCircle;
                            return (
                                <div key={index} className="flex items-center gap-3 p-3 rounded-md border bg-muted/20">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
                                        <ItemIcon className="h-5 w-5 text-primary" />
                                    </div>
                                    <span className="font-medium">{item.name}</span>
                                </div>
                            )
                        })
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-8">
                            {selectedDate && pickupDates.some(d => format(d, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd'))
                                ? "Items for this pickup haven't been announced yet. Check back soon!"
                                : "No pick up scheduled for this date."
                            }
                        </p>
                    )}
                </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
