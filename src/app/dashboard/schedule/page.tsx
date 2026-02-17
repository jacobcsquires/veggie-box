
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { collection, onSnapshot, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Subscription, Pickup } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

export default function AllSchedulesPage() {
    const { user, loading: authLoading } = useAuth();
    const [upcomingPickups, setUpcomingPickups] = useState<Pickup[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setIsLoading(false);
            return;
        }

        const subsQuery = query(collection(db, 'subscriptions'), where('userId', '==', user.uid), where('status', 'in', ['Active', 'Trialing']));
        
        const unsubSubs = onSnapshot(subsQuery, async (snapshot) => {
            const subsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subscription));
            
            if (subsData.length > 0) {
                const today = format(new Date(), 'yyyy-MM-dd');
                let allPickups: Pickup[] = [];

                for (const sub of subsData) {
                    const pickupsRef = collection(db, 'boxes', sub.boxId, 'pickups');
                    const q = query(pickupsRef, where('pickupDate', '>=', today), orderBy('pickupDate'));
                    const pickupsSnapshot = await getDocs(q);

                    const subPickups: Pickup[] = pickupsSnapshot.docs.map(doc => {
                        const data = doc.data();
                        return {
                            id: doc.id,
                            pickupDate: data.pickupDate,
                            note: data.note,
                            boxId: sub.boxId,
                            boxName: sub.boxName
                        };
                    });
                    allPickups.push(...subPickups);
                }

                // Remove duplicates and sort
                const uniquePickups = allPickups.filter((pickup, index, self) =>
                    index === self.findIndex((p) => (
                        p.pickupDate === pickup.pickupDate && p.boxId === pickup.boxId
                    ))
                );

                const sortedPickups = uniquePickups
                    .sort((a, b) => new Date(a.pickupDate.replace(/-/g, '\/')).getTime() - new Date(b.pickupDate.replace(/-/g, '\/')).getTime());
                
                setUpcomingPickups(sortedPickups);
            } else {
                setUpcomingPickups([]);
            }
            
            setIsLoading(false);
        });

        return () => unsubSubs();
    }, [user]);

    return (
        <div>
            <div className="mb-4">
                <h1 className="text-lg font-semibold md:text-2xl font-headline">
                    Upcoming Pickups
                </h1>
                <p className="text-muted-foreground text-sm">
                    Here is a list of all your scheduled pickups across all subscriptions.
                </p>
            </div>
            <Card>
                <CardContent className="pt-6">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Veggie Box Plan</TableHead>
                                <TableHead>Note from the farm</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading || authLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                                    </TableRow>
                                ))
                            ) : upcomingPickups.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-24 text-center">
                                        No upcoming pickups scheduled.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                upcomingPickups.map((pickup) => (
                                    <TableRow key={pickup.id + pickup.boxId}>
                                        <TableCell className="font-medium">{format(new Date(pickup.pickupDate.replace(/-/g, '\/')), 'PPP')}</TableCell>
                                        <TableCell>{pickup.boxName}</TableCell>
                                        <TableCell>{pickup.note || 'No note for this date.'}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
