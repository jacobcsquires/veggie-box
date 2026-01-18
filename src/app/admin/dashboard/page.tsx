
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Subscription, Customer, Box } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { format, formatDistanceToNow } from 'date-fns';
import { Users, ShoppingCart, Package, PlusCircle, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function AdminDashboardPage() {
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [boxes, setBoxes] = useState<Box[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const subsQuery = query(collection(db, 'subscriptions'), orderBy('createdAt', 'desc'), limit(5));
        const customersQuery = query(collection(db, 'customers'), orderBy('createdAt', 'desc'), limit(5));
        const boxesQuery = query(collection(db, 'boxes'));

        const unsubSubs = onSnapshot(subsQuery, (snapshot) => {
            setSubscriptions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subscription)));
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
        totalSubscriptions: subscriptions.filter(s => s.status === 'Active').length,
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
                <div className="flex gap-2">
                    <Button asChild variant="outline">
                        <Link href="/admin/customers"><PlusCircle className="mr-2 h-4 w-4" />New Customer</Link>
                    </Button>
                </div>
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

            <div className="grid gap-6 md:grid-cols-2">
                {/* Recent Subscriptions */}
                <Card>
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

                {/* New Customers */}
                <Card>
                    <CardHeader>
                        <CardTitle>New Customers</CardTitle>
                    </CardHeader>
                    <CardContent>
                         {isLoading ? <Skeleton className="h-40 w-full" /> : (
                            <div className="space-y-4">
                               {customers.length > 0 ? customers.map(customer => (
                                   <div key={customer.id} className="flex items-center">
                                       <Avatar className="h-9 w-9">
                                            <AvatarFallback>{getInitials(customer.name)}</AvatarFallback>
                                       </Avatar>
                                       <div className="ml-4 space-y-1">
                                           <p className="text-sm font-medium leading-none">{customer.name}</p>
                                           <p className="text-sm text-muted-foreground">{customer.email}</p>
                                       </div>
                                       <div className="ml-auto font-medium text-xs text-muted-foreground">
                                           {formatDistanceToNow(customer.createdAt.toDate(), { addSuffix: true })}
                                       </div>
                                   </div>
                               )) : <p className="text-sm text-muted-foreground text-center py-10">No new customers yet</p>}
                           </div>
                         )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
