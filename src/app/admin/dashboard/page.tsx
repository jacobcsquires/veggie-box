'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, onSnapshot, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Subscription, Customer, Box } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Users, ShoppingCart, Package, ArrowRight, Calendar, UserCheck, AlertTriangle } from 'lucide-react';


type UpcomingPickup = {
  id: string;
  boxId: string;
  boxName: string;
  pickupDate: string;
};


export default function AdminDashboardPage() {
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [allSubscriptions, setAllSubscriptions] = useState<Subscription[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [boxes, setBoxes] = useState<Box[]>([]);
    const [upcomingPickups, setUpcomingPickups] = useState<UpcomingPickup[]>([]);
    const [todaysPickups, setTodaysPickups] = useState<UpcomingPickup[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPickupsLoading, setIsPickupsLoading] = useState(true);

    useEffect(() => {
        setIsLoading(true);

        const subsQuery = query(collection(db, 'subscriptions'), orderBy('createdAt', 'desc'), limit(5));
        const unsubSubs = onSnapshot(subsQuery, (snapshot) => {
            setSubscriptions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subscription)));
        });

        const allSubsQuery = query(collection(db, 'subscriptions'));
        const unsubAllSubs = onSnapshot(allSubsQuery, (snapshot) => {
            setAllSubscriptions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subscription)));
        });

        const customersQuery = query(collection(db, 'customers'));
        const unsubCustomers = onSnapshot(customersQuery, (snapshot) => {
            setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
        });

        const boxesQuery = query(collection(db, 'boxes'));
        const unsubBoxes = onSnapshot(boxesQuery, async (snapshot) => {
            const boxesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Box));
            setBoxes(boxesData);
            
            setIsPickupsLoading(true);
            const today = new Date();
            const todayString = format(today, 'yyyy-MM-dd');

            let allTodaysPickups: UpcomingPickup[] = [];
            let allUpcomingPickups: UpcomingPickup[] = [];

            for (const box of boxesData) {
                if (box.id) {
                    const pickupsRef = collection(db, 'boxes', box.id, 'pickups');
                    
                    // Query for today's pickups
                    const todayQuery = query(pickupsRef, where('pickupDate', '==', todayString));
                    const todaySnapshot = await getDocs(todayQuery);
                    const boxTodaysPickups: UpcomingPickup[] = todaySnapshot.docs.map(doc => {
                        const data = doc.data();
                        return { id: doc.id, pickupDate: data.pickupDate, boxId: box.id, boxName: box.name };
                    });
                    allTodaysPickups.push(...boxTodaysPickups);
                    
                    // Query for future pickups
                    const upcomingQuery = query(pickupsRef, where('pickupDate', '>', todayString), orderBy('pickupDate'));
                    const upcomingSnapshot = await getDocs(upcomingQuery);
                    const boxUpcomingPickups: UpcomingPickup[] = upcomingSnapshot.docs.map(doc => {
                        const data = doc.data();
                        return { id: doc.id, pickupDate: data.pickupDate, boxId: box.id, boxName: box.name };
                    });
                    allUpcomingPickups.push(...boxUpcomingPickups);
                }
            }

            setTodaysPickups(allTodaysPickups.sort((a, b) => a.boxName.localeCompare(b.boxName)));

            const uniquePickups = allUpcomingPickups.filter((pickup, index, self) =>
                index === self.findIndex((p) => (
                    p.pickupDate === pickup.pickupDate && p.boxId === pickup.boxId
                ))
            );

            const sortedPickups = uniquePickups
                .sort((a, b) => new Date(a.pickupDate.replace(/-/g, '\/')).getTime() - new Date(b.pickupDate.replace(/-/g, '\/')).getTime());

            if (sortedPickups.length > 0) {
                const nextPickupDate = sortedPickups[0].pickupDate;
                const nextUpcomingPickups = sortedPickups.filter(p => p.pickupDate === nextPickupDate);
                setUpcomingPickups(nextUpcomingPickups);
            } else {
                setUpcomingPickups([]);
            }
            
            setIsPickupsLoading(false);
            setIsLoading(false);
        });

        return () => {
            unsubSubs();
            unsubAllSubs();
            unsubCustomers();
            unsubBoxes();
        };
    }, []);

    const stats = {
        totalSubscriptions: allSubscriptions.filter(s => s.status === 'Active').length,
        totalCustomers: customers.length,
        activePlans: boxes.filter(b => b.displayOnWebsite).length,
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-headline">Dashboard</h1>
            </div>

            {todaysPickups.length > 0 && (
                <Card className="bg-primary/5 border-primary shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center text-primary">
                            <AlertTriangle className="mr-2 h-5 w-5" />
                            Pickup Day!
                        </CardTitle>
                        <CardDescription>The following boxes are scheduled for pickup today. Click the check-in button to start tracking collections.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {todaysPickups.map(pickup => (
                            <div key={`today-${pickup.id}`} className="flex items-center justify-between p-4 rounded-lg bg-background border">
                                <div>
                                    <p className="font-semibold">{pickup.boxName}</p>
                                    <p className="text-sm text-muted-foreground">Ready for collection</p>
                                </div>
                                <Button asChild size="lg">
                                    <Link href={`/admin/boxes/${pickup.boxId}/pickups/${pickup.id}`}>
                                        <UserCheck className="mr-2 h-4 w-4" /> Go to Check-in
                                    </Link>
                                </Button>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

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
                {/* Upcoming Pickups */}
                <Card>
                    <CardHeader>
                        <CardTitle>Upcoming Pickups Check-in</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isPickupsLoading ? <Skeleton className="h-40 w-full" /> : (
                             <div className="space-y-4">
                                {upcomingPickups.length > 0 ? upcomingPickups.map(pickup => (
                                    <div key={`${pickup.boxId}-${pickup.id}`} className="rounded-lg border p-4 space-y-3">
                                        <div className="flex items-center">
                                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                                                <Calendar className="h-5 w-5 text-primary" />
                                            </div>
                                            <div className="ml-4 space-y-1">
                                                <p className="text-sm font-medium leading-none">{pickup.boxName}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {format(new Date(pickup.pickupDate.replace(/-/g, '\/')), 'PPP')}
                                                </p>
                                            </div>
                                        </div>
                                        <Button asChild variant="secondary" size="sm" className="w-full">
                                            <Link href={`/admin/boxes/${pickup.boxId}/pickups/${pickup.id}`}>
                                                <UserCheck className="mr-2 h-4 w-4" /> Check-in
                                            </Link>
                                        </Button>
                                    </div>
                                )) : <p className="text-sm text-muted-foreground text-center py-10">No upcoming pickups scheduled.</p>}
                            </div>
                        )}
                    </CardContent>
                </Card>

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
            </div>
        </div>
    );
}
