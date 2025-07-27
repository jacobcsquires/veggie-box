
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { doc, getDoc, collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Box, Pickup } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

type PickupInternal = Omit<Pickup, 'boxId' | 'boxName'>;


export default function UserSchedulePage() {
  const params = useParams();
  const boxId = params.boxId as string;

  const [box, setBox] = useState<Box | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [pickups, setPickups] = useState<PickupInternal[]>([]);
  const [selectedPickupNote, setSelectedPickupNote] = useState('');

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
    const pickupsRef = collection(db, 'boxes', boxId, 'pickups');
    const q = query(pickupsRef);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pickupsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PickupInternal));
      setPickups(pickupsData);
    });

    return () => unsubscribe();
  }, [boxId]);

  useEffect(() => {
    if (selectedDate) {
      const dateString = format(selectedDate, 'yyyy-MM-dd');
      const pickupForDate = pickups.find(d => d.pickupDate === dateString);
      setSelectedPickupNote(pickupForDate?.note || '');
    } else {
        setSelectedPickupNote('');
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
               <CardDescription>Note for {selectedDate ? format(selectedDate, 'PPP') : '...'}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-3 p-3 rounded-md border bg-muted/20 min-h-[150px]">
                    {selectedPickupNote ? (
                        <p className="text-sm text-muted-foreground">{selectedPickupNote}</p>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-8">
                            {selectedDate && pickupDates.some(d => format(d, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd'))
                                ? "The note for this pickup hasn't been announced yet. Check back soon!"
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

    