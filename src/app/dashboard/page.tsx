
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { collection, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Subscription, Box } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ShoppingCart, Package, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function DashboardPage() {
    const { user, loading: authLoading } = useAuth();
    const [subscriptions, setSubscriptions] = useState<Subscription[] | null>(null);
    const [boxes, setBoxes] = useState<Box[]>([]);
    
    useEffect(() => {
        if (!user) return;

        const subsQuery = query(collection(db, 'subscriptions'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'), limit(5));
        const boxesQuery = query(collection(db, 'boxes'), where('displayOnWebsite', '==', true));

        const unsubSubs = onSnapshot(subsQuery, (snapshot) => {
            setSubscriptions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subscription)));
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
        totalSubscriptions: subscriptions?.length ?? 0,
        activePlans: boxes.length,
    };
    
    if (authLoading || subscriptions === null) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-64"/>
                <div className="grid gap-4 md:grid-cols-2">
                    <Skeleton className="h-28"/>
                    <Skeleton className="h-28"/>
                </div>
                 <Skeleton className="h-48 w-full"/>
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
                            {subscriptions.length > 0 ? subscriptions.map(sub => (
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
    );
}
