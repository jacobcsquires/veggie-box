
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { collection, onSnapshot, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Subscription, Box, Pickup } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ShoppingCart, Package, ArrowRight, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function DashboardPage() {
    const { user, loading: authLoading } = useAuth();
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [recentSubscriptions, setRecentSubscriptions] = useState<Subscription[]>([]);
    const [upcomingPickups, setUpcomingPickups] = useState<Pickup[]>([]);
    const [boxes, setBoxes] = useState<Box[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setIsLoading(false);
            return;
        }

        const subsQuery = query(collection(db, 'subscriptions'), where('userId', '==', user.uid));
        const boxesQuery = query(collection(db, 'boxes'), where('displayOnWebsite', '==', true));

        const unsubSubs = onSnapshot(subsQuery, async (snapshot) => {
            setIsLoading(true);
            const subsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subscription));
            setSubscriptions(subsData);
            
            const recentSubs = [...subsData].sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()).slice(0, 5);
            setRecentSubscriptions(recentSubs);

            const activeSubs = subsData.filter(s => s.status === 'Active');
            if (activeSubs.length > 0) {
                const today = format(new Date(), 'yyyy-MM-dd');
                let allPickups: Pickup[] = [];

                for (const sub of activeSubs) {
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

                const sortedAndLimitedPickups = allPickups
                    .sort((a, b) => new Date(a.pickupDate.replace(/-/g, '\/')).getTime() - new Date(b.pickupDate.replace(/-/g, '\/')).getTime())
                    .slice(0, 5);
                
                setUpcomingPickups(sortedAndLimitedPickups);
            } else {
                setUpcomingPickups([]);
            }
            
            setIsLoading(false);
        });

        const unsubBoxes = onSnapshot(boxesQuery, (snapshot) => {
            setBoxes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Box)));
        });

        return () => {
            unsubSubs();
            unsubBoxes();
        };
    }, [user]);

    const stats = {
        totalSubscriptions: subscriptions.length,
        activePlans: boxes.length,
    };
    
    if (authLoading || isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-64"/>
                <div className="grid gap-4 md:grid-cols-2">
                    <Skeleton className="h-28"/>
                    <Skeleton className="h-28"/>
                </div>
                 <div className="grid gap-6 md:grid-cols-2">
                    <Skeleton className="h-64"/>
                    <Skeleton className="h-64"/>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-headline">Welcome, {user?.displayName || 'Veggie Lover'}!</h1>
                <Button asChild variant="outline">
                    <Link href="/dashboard/subscriptions">Manage Subscriptions <ArrowRight className="ml-2 h-4 w-4"/></Link>
                </Button>
            </div>

            {/* Stat Cards */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Your Subscriptions</CardTitle>
                        <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalSubscriptions}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Available Plans</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                         <div className="flex items-center justify-between">
                            <span className="text-2xl font-bold">{stats.activePlans}</span>
                            <Button asChild size="sm">
                                <Link href="/dashboard/boxes">Explore</Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                 {/* Upcoming Pickups */}
                <Card>
                    <CardHeader>
                        <CardTitle>Upcoming Pickups</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {upcomingPickups.length > 0 ? upcomingPickups.map(pickup => (
                                <div key={pickup.id} className="flex items-center">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                                        <Calendar className="h-5 w-5 text-primary" />
                                    </div>
                                    <div className="ml-4 space-y-1">
                                        <p className="text-sm font-medium leading-none">{pickup.boxName}</p>
                                        <p className="text-sm text-muted-foreground">{format(new Date(pickup.pickupDate.replace(/-/g, '\/')), 'PPPP')}</p>
                                    </div>
                                    <Button asChild variant="ghost" size="sm" className="ml-auto">
                                        <Link href={`/dashboard/schedule/${pickup.boxId}`}>View</Link>
                                    </Button>
                                </div>
                            )) : <p className="text-sm text-muted-foreground text-center py-10">No upcoming pickups scheduled.</p>}
                        </div>
                    </CardContent>
                </Card>
                
                {/* Recent Subscriptions */}
                <Card>
                    <CardHeader>
                        <CardTitle>Recent Subscription Activity</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Veggie Box Plan</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Start Date</TableHead>
                                    <TableHead className="text-right">Price</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {recentSubscriptions.length > 0 ? recentSubscriptions.map(sub => (
                                    <TableRow key={sub.id}>
                                        <TableCell className="font-medium">{sub.boxName}</TableCell>
                                        <TableCell><Badge variant={sub.status === 'Active' ? 'default' : 'secondary'}>{sub.status}</Badge></TableCell>
                                        <TableCell>{format(new Date(sub.startDate.replace(/-/g, '\/')), 'PPP')}</TableCell>
                                        <TableCell className="text-right">${sub.price.toFixed(2)}</TableCell>
                                    </TableRow>
                                )) : <TableRow><TableCell colSpan={4} className="text-center h-24">You haven't subscribed to any boxes yet.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
