'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { doc, getDoc, collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Box, Pickup } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { format, startOfToday } from 'date-fns';
import { Calendar as CalendarIcon, Package, Info, ChevronRight, List } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

type PickupInternal = Omit<Pickup, 'boxId' | 'boxName'>;

export default function UserSchedulePage() {
  const params = useParams();
  const boxId = params.boxId as string;

  const [box, setBox] = useState<Box | null>(null);
  const [pickups, setPickups] = useState<PickupInternal[]>([]);
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

    // Listen for upcoming pickup updates
    const todayStr = format(startOfToday(), 'yyyy-MM-dd');
    const pickupsRef = collection(db, 'boxes', boxId, 'pickups');
    const q = query(pickupsRef, where('pickupDate', '>=', todayStr), orderBy('pickupDate', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pickupsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PickupInternal));
      setPickups(pickupsData);
    });

    return () => unsubscribe();
  }, [boxId]);

  if (isLoading) {
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-8 w-64" />
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-48 mb-2" />
                    <Skeleton className="h-4 w-full" />
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </div>
                </CardContent>
            </Card>
        </div>
    )
  }

  if (!box) {
    return (
        <div className="text-center py-20 space-y-4">
            <h2 className="text-xl font-semibold">Veggie Box Plan not found</h2>
            <p className="text-muted-foreground">The plan you're looking for may have been archived or deleted.</p>
            <Button asChild>
                <Link href="/dashboard/subscriptions">Back to Subscriptions</Link>
            </Button>
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center text-sm text-muted-foreground">
        <Link href="/dashboard/subscriptions" className="hover:text-primary transition-colors">Subscriptions</Link>
        <ChevronRight className="h-4 w-4 mx-1" />
        <span className="font-medium text-foreground">Pickup Schedule</span>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="text-2xl font-headline font-bold flex items-center gap-2">
                <List className="h-6 w-6 text-primary" />
                Upcoming Pickups
            </h1>
            <p className="text-muted-foreground">Schedule for your {box.name} subscription</p>
        </div>
        <Badge variant="secondary" className="capitalize w-fit px-3 py-1">{box.frequency}</Badge>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Delivery Calendar</CardTitle>
          <CardDescription>A list of upcoming collection dates and what you can expect in your box.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="rounded-md border overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="w-[240px]">Pickup Date</TableHead>
                            <TableHead>Planned Contents</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {pickups.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={2} className="text-center py-16 text-muted-foreground">
                                    <CalendarIcon className="h-10 w-10 mx-auto mb-3 opacity-20" />
                                    <p className="font-medium">No upcoming pickups scheduled.</p>
                                    <p className="text-xs">Check back soon for the next season's schedule!</p>
                                </TableCell>
                            </TableRow>
                        ) : (
                            pickups.map((pickup) => (
                                <TableRow key={pickup.id} className="hover:bg-muted/30 transition-colors">
                                    <TableCell className="font-semibold align-top pt-4">
                                        <div className="flex items-center gap-2">
                                            <CalendarIcon className="h-4 w-4 text-primary" />
                                            {format(new Date(pickup.pickupDate.replace(/-/g, '/')), 'PPPP')}
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-4">
                                        {pickup.note ? (
                                            <div className="flex items-start gap-3">
                                                <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                                <p className="text-sm leading-relaxed whitespace-pre-wrap">{pickup.note}</p>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-muted-foreground italic flex items-center gap-2">
                                                <Info className="h-4 w-4 shrink-0" />
                                                Farm notes are usually posted a few days before pickup.
                                            </p>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </CardContent>
      </Card>
      
      <div className="rounded-lg bg-primary/5 border border-primary/20 p-5 shadow-sm">
          <div className="flex gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 shrink-0">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-1">
                  <p className="font-bold text-primary">Need to skip a pickup?</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                      Away for the weekend? No problem! You can skip your next delivery directly from the 
                      <Link href="/dashboard/subscriptions" className="mx-1 font-bold text-foreground hover:text-primary underline transition-colors">Manage Subscriptions</Link> 
                      page. Simply click "Skip Next Pickup" and your billing will be automatically adjusted.
                  </p>
              </div>
          </div>
      </div>
    </div>
  );
}
