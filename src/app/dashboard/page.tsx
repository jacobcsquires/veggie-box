'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { collection, onSnapshot, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Subscription, Pickup } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ShoppingCart, ArrowRight, Calendar } from 'lucide-react';

export default function DashboardPage() {
    const { user, loading: authLoading } = useAuth();
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [upcomingPickups, setUpcomingPickups] = useState<Pickup[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setIsLoading(false);
            return;
        }

        // Query by userId only and filter status in memory to avoid composite index requirement
        const subsQuery = query(collection(db, 'subscriptions'), where('userId', '==', user.uid));
        
        const unsubSubs = onSnapshot(subsQuery, async (snapshot) => {
            setIsLoading(true);
            const statusFilter = ['Active', 'Pending', 'Past Due', 'Unpaid', 'Trialing', 'Unknown'];
            const subsData = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as Subscription))
                .filter(sub => statusFilter.includes(sub.status));
                
            setSubscriptions(subsData);
            
            const activeSubs = subsData.filter(s => ['Active', 'Trialing'].includes(s.status));
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

        return () => {
            unsubSubs();
        };
    }, [user]);

    const stats = {
        totalSubscriptions: subscriptions.length,
    };
    
    if (authLoading || isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-64"/>
                <div className="grid gap-4">
                    <Skeleton className="h-28"/>
                </div>
                 <div className="grid gap-6">
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
            <div className="grid gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Your Subscriptions</CardTitle>
                        <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalSubscriptions}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6">
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
            </div>
        </div>
    );
}
