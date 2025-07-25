'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format, startOfMonth } from 'date-fns';
import * as Icons from 'lucide-react';

import { Calendar } from '@/components/ui/calendar';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { Box, Delivery, BoxItem } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

export default function UserDeliveryCalendarPage({
  params: { boxId },
}: {
  params: { boxId: string };
}) {

  const [box, setBox] = useState<Box | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [isLoading, setIsLoading] = useState(true);

  // Fetch box details
  useEffect(() => {
    if (boxId) {
      const boxRef = doc(db, 'boxes', boxId);
      getDoc(boxRef).then((docSnap) => {
        if (docSnap.exists()) {
          setBox({ id: docSnap.id, ...docSnap.data() } as Box);
        }
        setIsLoading(false);
      });
    }
  }, [boxId]);

  // Fetch deliveries
  useEffect(() => {
    if (!boxId) return;
    
    const q = query(
      collection(db, 'deliveries'),
      where('boxId', '==', boxId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const deliveriesData = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Delivery)
      );
      setDeliveries(deliveriesData);
    });

    return () => unsubscribe();
  }, [boxId, currentMonth]);

  const deliveryDates = deliveries.map(d => new Date(d.deliveryDate + 'T00:00:00'));

  const selectedDeliveryItems: BoxItem[] | null = selectedDate
    ? deliveries.find(d => d.deliveryDate === format(selectedDate, 'yyyy-MM-dd'))?.items ?? box?.items ?? null
    : null;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Skeleton className="h-96" />
            <Skeleton className="h-80 md:col-span-2" />
        </div>
      </div>
    );
  }

  if (!box) {
     return <p>Box not found.</p>
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-headline">Delivery Calendar for {box.name}</h1>
      <p className="text-muted-foreground">Select a highlighted date to see what's coming in your box.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
            <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                onMonthChange={setCurrentMonth}
                className="rounded-md border"
                modifiers={{
                    available: deliveryDates,
                }}
                modifiersClassNames={{
                    available: 'bg-primary/20',
                }}
                disabled={(date) => !deliveryDates.some(d => d.getTime() === date.getTime())}
            />
        </div>
        <div className="md:col-span-2">
            <Card>
                <CardHeader>
                    <CardTitle>
                        {selectedDate ? `Items for ${format(selectedDate, 'PPP')}` : 'Select a Delivery Date'}
                    </CardTitle>
                    <CardDescription>
                        {selectedDate ? "Here's what you can expect in your box." : "Choose a highlighted date from the calendar to see the items for that delivery."}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {selectedDeliveryItems ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {selectedDeliveryItems.map(item => {
                                const ItemIcon = Icons[item.icon as keyof typeof Icons] || Icons.HelpCircle;
                                return (
                                    <div key={item.name} className="flex flex-col items-center gap-2 p-4 rounded-md border bg-muted/20">
                                        <ItemIcon className="h-8 w-8 text-primary" />
                                        <span className="text-sm font-medium text-center">{item.name}</span>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <p className="text-muted-foreground">
                           {selectedDate ? "No specific items have been set for this date yet. Check back later!" : "No date selected."}
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
