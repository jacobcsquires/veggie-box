'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, onSnapshot, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Subscription, Customer, Box, Pickup } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { format, formatDistanceToNow } from 'date-fns';
import { Users, ShoppingCart, Package, ArrowRight, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type AugmentedPickup = Pickup & { customerName: string | null };

export default function AdminDashboardPage() {
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [allSubscriptions, setAllSubscriptions] = useState<Subscription[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [boxes, setBoxes] = useState<Box[]>([]);
    const [upcomingPickups, setUpcomingPickups] = useState<AugmentedPickup[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const subsQuery = query(collection(db, 'subscriptions'), orderBy('createdAt', 'desc'));
        const customersQuery = query(collection(db, 'customers'), orderBy('createdAt', 'desc'));
        const boxesQuery = query(collection(db, 'boxes'));

        const unsubSubs = onSnapshot(subsQuery, async (snapshot) => {
            const allSubs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subscription));
            setSubscriptions(allSubs.slice(0, 5));
            setAllSubscriptions(allSubs);
            
            const activeSubs = allSubs.filter(s => s.status === 'Active');
            if (activeSubs.length > 0) {
                const today = format(new Date(), 'yyyy-MM-dd');
                let allPickups: AugmentedPickup[] = [];

                for (const sub of activeSubs) {
                    const pickupsRef = collection(db, 'boxes', sub.boxId, 'pickups');
                    const q = query(pickupsRef, where('pickupDate', '>=', today), orderBy('pickupDate'));
                    const pickupsSnapshot = await getDocs(q);

                    const subPickups: AugmentedPickup[] = pickupsSnapshot.docs.map(doc => {
                        const data = doc.data();
                        return {
                            id: doc.id,
                            pickupDate: data.pickupDate,
                            note: data.note,
                            boxId: sub.boxId,
                            boxName: sub.boxName,
                            customerName: sub.customerName
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

        const unsubCustomers = onSnapshot(customersQuery, (snapshot) => {
            setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
        });

        const unsubBoxes = onSnapshot(boxesQuery, (snapshot) => {
            setBoxes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Box)));
        });

        return () => {
            unsubSubs();
            unsubCustomers();
            unsubBoxes();
        };
    }, []);

    const stats = {
        totalSubscriptions: allSubscriptions.filter(s => s.status === 'Active').length,
        totalCustomers: customers.length,
        activePlans: boxes.filter(b => b.displayOnWebsite).length,
    };

    const getInitials = (name: string | null) => {
        if (!name) return '??';
        const names = name.split(' ');
        if (names.length > 1) {
            return names[0][0] + names[names.length - 1][0];
        }
        return name.substring(0, 2);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-headline">Dashboard</h1>
            </div>

            {/* Stat Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
                        <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Skeleton className="h-8 w-16"/> : <div className="text-2xl font-bold">{stats.totalSubscriptions}</div>}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Skeleton className="h-8 w-16"/> : <div className="text-2xl font-bold">{stats.totalCustomers}</div>}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Plans</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                         {isLoading ? <Skeleton className="h-8 w-16"/> : <div className="text-2xl font-bold">{stats.activePlans}</div>}
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                {/* Recent Subscriptions */}
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>Recent Subscriptions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Skeleton className="h-40 w-full" /> : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Customer</TableHead>
                                        <TableHead>Plan</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {subscriptions.length > 0 ? subscriptions.map(sub => (
                                        <TableRow key={sub.id}>
                                            <TableCell>{sub.customerName}</TableCell>
                                            <TableCell>{sub.boxName}</TableCell>
                                            <TableCell className="text-right">${sub.price.toFixed(2)}</TableCell>
                                        </TableRow>
                                    )) : <TableRow><TableCell colSpan={3} className="text-center h-24">No recent subscriptions</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>

                {/* Upcoming Pickups */}
                <Card>
                    <CardHeader>
                        <CardTitle>Upcoming Pickups</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Skeleton className="h-40 w-full" /> : (
                             <div className="space-y-4">
                                {upcomingPickups.length > 0 ? upcomingPickups.map(pickup => (
                                    <div key={pickup.id + (pickup.customerName || '')} className="flex items-center">
                                        <Avatar className="h-9 w-9">
                                            <AvatarFallback>{getInitials(pickup.customerName)}</AvatarFallback>
                                        </Avatar>
                                        <div className="ml-4 space-y-1">
                                            <p className="text-sm font-medium leading-none">{pickup.customerName}</p>
                                            <p className="text-sm text-muted-foreground">{pickup.boxName}</p>
                                        </div>
                                        <div className="ml-auto font-medium text-xs text-muted-foreground">
                                            {format(new Date(pickup.pickupDate.replace(/-/g, '\/')), 'MMM d')}
                                        </div>
                                    </div>
                                )) : <p className="text-sm text-muted-foreground text-center py-10">No upcoming pickups.</p>}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
