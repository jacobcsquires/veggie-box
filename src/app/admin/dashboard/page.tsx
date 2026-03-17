'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, onSnapshot, query, orderBy, limit, getDocs, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Subscription, Customer, Box } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Users, Package, Calendar, UserCheck, AlertTriangle, Pencil, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';


type UpcomingPickup = {
  id: string;
  boxId: string;
  boxName: string;
  pickupDate: string;
  subscriberCount: number;
  note?: string;
};


export default function AdminDashboardPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [allSubscriptions, setAllSubscriptions] = useState<Subscription[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [boxes, setBoxes] = useState<Box[]>([]);
    const [upcomingPickups, setUpcomingPickups] = useState<UpcomingPickup[]>([]);
    const [todaysPickups, setTodaysPickups] = useState<UpcomingPickup[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPickupsLoading, setIsPickupsLoading] = useState(true);

    // Note Dialog State
    const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
    const [selectedPickup, setSelectedPickup] = useState<UpcomingPickup | null>(null);
    const [noteContent, setNoteContent] = useState('');
    const [isSavingNote, setIsSavingNote] = useState(false);

    // Effect for basic data loading
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
        const unsubBoxes = onSnapshot(boxesQuery, (snapshot) => {
            setBoxes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Box)));
            setIsLoading(false); // Stop general loading once all initial data streams are active
        });

        return () => {
            unsubSubs();
            unsubAllSubs();
            unsubCustomers();
            unsubBoxes();
        };
    }, []);

    // Effect for calculating pickups when boxes or subscriptions change
    useEffect(() => {
        if (isLoading) return; // Don't run until initial data is loaded

        const calculatePickups = async () => {
            setIsPickupsLoading(true);

            // For counting boxes needed for a pickup, we only count truly "Active" subs.
            // Trialing subs (skipped) do not receive a box for that period.
            const subscriberCounts = allSubscriptions
                .filter(s => ['Active', 'Trialing'].includes(s.status))
                .reduce((acc, sub) => {
                    acc[sub.boxId] = (acc[sub.boxId] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>);

            const today = new Date();
            const todayString = format(today, 'yyyy-MM-dd');

            let allTodaysPickups: UpcomingPickup[] = [];
            let allUpcomingPickups: UpcomingPickup[] = [];

            for (const box of boxes) {
                if (box.id) {
                    const subscriberCount = subscriberCounts[box.id] || 0;
                    if (subscriberCount === 0) continue;

                    const pickupsRef = collection(db, 'boxes', box.id, 'pickups');
                    
                    const todayQuery = query(pickupsRef, where('pickupDate', '==', todayString));
                    const todaySnapshot = await getDocs(todayQuery);
                    allTodaysPickups.push(...todaySnapshot.docs.map(doc => ({
                        id: doc.id,
                        pickupDate: doc.data().pickupDate,
                        boxId: box.id,
                        boxName: box.name,
                        subscriberCount,
                        note: doc.data().note || '',
                    })));
                    
                    const upcomingQuery = query(pickupsRef, where('pickupDate', '>', todayString), orderBy('pickupDate'));
                    const upcomingSnapshot = await getDocs(upcomingQuery);
                    allUpcomingPickups.push(...upcomingSnapshot.docs.map(doc => ({
                        id: doc.id,
                        pickupDate: doc.data().pickupDate,
                        boxId: box.id,
                        boxName: box.name,
                        subscriberCount,
                        note: doc.data().note || '',
                    })));
                }
            }

            setTodaysPickups(allTodaysPickups.sort((a, b) => a.boxName.localeCompare(b.boxName)));

            const uniquePickups = allUpcomingPickups.filter((pickup, index, self) =>
                index === self.findIndex((p) => p.pickupDate === pickup.pickupDate && p.boxId === pickup.boxId)
            );

            const sortedPickups = uniquePickups.sort((a, b) => new Date(a.pickupDate.replace(/-/g, '\/')).getTime() - new Date(b.pickupDate.replace(/-/g, '\/')).getTime());

            if (sortedPickups.length > 0) {
                const nextPickupDate = sortedPickups[0].pickupDate;
                const nextUpcomingPickups = sortedPickups.filter(p => p.pickupDate === nextPickupDate);
                setUpcomingPickups(nextUpcomingPickups);
            } else {
                setUpcomingPickups([]);
            }
            
            setIsPickupsLoading(false);
        };

        calculatePickups();

    }, [boxes, allSubscriptions, isLoading]);

    const handleOpenNoteDialog = (pickup: UpcomingPickup) => {
        setSelectedPickup(pickup);
        setNoteContent(pickup.note || '');
        setIsNoteDialogOpen(true);
    };

    const handleSaveNote = async () => {
        if (!selectedPickup) return;
        setIsSavingNote(true);
        try {
            const pickupRef = doc(db, 'boxes', selectedPickup.boxId, 'pickups', selectedPickup.id);
            await updateDoc(pickupRef, {
                note: noteContent
            });
            toast({ title: 'Success', description: 'Pickup note updated.' });
            setIsNoteDialogOpen(false);
            
            // Optimistically update local state if needed, or wait for next calculatePickups run
            // Given the complexity of the aggregate state, a full re-fetch or waiting for the listener is safer
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not update pickup note.' });
        } finally {
            setIsSavingNote(false);
        }
    };

    // Track active subscribers: includes 'Active' and 'Trialing' (skipped)
    const stats = {
        totalSubscriptions: allSubscriptions.filter(s => ['Active', 'Trialing'].includes(s.status)).length,
        totalCustomers: customers.length,
        activePlans: boxes.filter(b => b.displayOnWebsite).length,
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-headline font-bold">Dashboard</h1>
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
                            <div key={`today-${pickup.id}`} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg bg-background border gap-4">
                                <div>
                                    <p className="font-semibold">{pickup.boxName}</p>
                                    <p className="text-sm text-muted-foreground">Ready for collection ({pickup.subscriberCount} boxes)</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="lg" onClick={() => handleOpenNoteDialog(pickup)}>
                                        <Pencil className="mr-2 h-4 w-4" /> Edit Note
                                    </Button>
                                    <Button asChild size="lg">
                                        <Link href={`/admin/boxes/${pickup.boxId}/pickups/${pickup.id}?from=dashboard`}>
                                            <UserCheck className="mr-2 h-4 w-4" /> Go to Check-in
                                        </Link>
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Subscriptions</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalSubscriptions}</div>
                        <p className="text-xs text-muted-foreground">Active & Scheduled</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalCustomers}</div>
                        <p className="text-xs text-muted-foreground">In database</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Upcoming Pickups */}
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>Next Pickup</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isPickupsLoading ? <Skeleton className="h-40 w-full" /> : (
                             <div className="grid gap-4 grid-cols-1">
                                {upcomingPickups.length > 0 ? upcomingPickups.map(pickup => (
                                    <div key={`${pickup.boxId}-${pickup.id}`} className="rounded-lg border p-4 space-y-3 w-full">
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
                                            <div className="ml-auto flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                                                <Package className="h-4 w-4" />
                                                {pickup.subscriberCount}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button variant="outline" size="sm" className="flex-1" onClick={() => handleOpenNoteDialog(pickup)}>
                                                <Pencil className="mr-2 h-4 w-4" /> Edit Note
                                            </Button>
                                            <Button asChild variant="secondary" size="sm" className="flex-1">
                                                <Link href={`/admin/boxes/${pickup.boxId}/pickups/${pickup.id}?from=dashboard`}>
                                                    <UserCheck className="mr-2 h-4 w-4" /> Check-in
                                                </Link>
                                            </Button>
                                        </div>
                                    </div>
                                )) : <p className="text-sm text-muted-foreground text-center py-10 col-span-2">No upcoming pickups scheduled.</p>}
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
                                        <TableRow key={sub.id} className="cursor-pointer" onClick={() => router.push(`/admin/subscriptions/${sub.id}`)}>
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

            <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Pickup Note for {selectedPickup?.boxName}</DialogTitle>
                        <DialogDescription>
                            Update the notes for the pickup on {selectedPickup ? format(new Date(selectedPickup.pickupDate.replace(/-/g, '/')), 'PPP') : ''}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label htmlFor="admin-pickup-note" className="sr-only">Note</Label>
                        <Textarea
                            id="admin-pickup-note"
                            value={noteContent}
                            onChange={(e) => setNoteContent(e.target.value)}
                            placeholder="e.g. This week's box includes: Fresh carrots, kale, etc."
                            rows={6}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsNoteDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveNote} disabled={isSavingNote}>
                            {isSavingNote ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Save Note
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
