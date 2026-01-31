
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { doc, getDoc, collection, onSnapshot, setDoc, deleteDoc, serverTimestamp, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Box, Subscription, Pickup } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { format, formatDistanceToNow } from 'date-fns';
import { ChevronRight, Search, Users, CheckCircle, XCircle, UserCheck, Package } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

type SubscriberCheckin = Subscription & {
  collected: boolean;
  collectedAt: Date | null;
};

export default function PickupCheckinPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const fromDashboard = searchParams.get('from') === 'dashboard';
    const boxId = params.boxId as string;
    const pickupId = params.pickupId as string;

    const [box, setBox] = useState<Box | null>(null);
    const [pickup, setPickup] = useState<Pickup | null>(null);
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [collectionStatuses, setCollectionStatuses] = useState<Map<string, {collected: boolean, collectedAt: Date | null}>>(new Map());
    const [isLoading, setIsLoading] = useState(true);

    const [filter, setFilter] = useState('all'); // 'all', 'collected', 'uncollected'
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (!boxId || !pickupId) return;

        const boxRef = doc(db, 'boxes', boxId);
        const unsubBox = onSnapshot(boxRef, (docSnap) => {
            if (docSnap.exists()) {
                setBox({ id: docSnap.id, ...docSnap.data() } as Box);
            }
        });

        const pickupRef = doc(db, 'boxes', boxId, 'pickups', pickupId);
        const unsubPickup = onSnapshot(pickupRef, (docSnap) => {
            if (docSnap.exists()) {
                setPickup({ id: docSnap.id, ...docSnap.data() } as Pickup);
            }
        });

        const subsQuery = query(collection(db, 'subscriptions'), where('boxId', '==', boxId), where('status', '==', 'Active'));
        const unsubSubs = onSnapshot(subsQuery, async (snapshot) => {
            const subsData = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as Subscription);
            
            const enrichedSubs = await Promise.all(subsData.map(async (sub) => {
                if (sub.customerEmail) return sub;
                if (!sub.stripeCustomerId) return sub;
                try {
                    const customerRef = doc(db, 'customers', sub.stripeCustomerId);
                    const customerSnap = await getDoc(customerRef);
                    if (customerSnap.exists()) {
                        return { ...sub, customerEmail: customerSnap.data().email };
                    }
                } catch (error) {
                    console.error(`Failed to fetch customer data for sub ${sub.id}`, error);
                }
                return sub;
            }));

            setSubscriptions(enrichedSubs);
            setIsLoading(false);
        });

        const collectionsRef = collection(db, 'boxes', boxId, 'pickups', pickupId, 'collections');
        const unsubCollections = onSnapshot(collectionsRef, (snapshot) => {
            const statuses = new Map<string, {collected: boolean, collectedAt: Date | null}>();
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                statuses.set(doc.id, { collected: data.collected, collectedAt: (data.collectedAt as Timestamp)?.toDate() || null });
            });
            setCollectionStatuses(statuses);
        });

        return () => {
            unsubBox();
            unsubPickup();
            unsubSubs();
            unsubCollections();
        };
    }, [boxId, pickupId]);

    const handleToggleCollection = useCallback(async (subscription: SubscriberCheckin) => {
        const { id: subscriptionId, customerName, collected } = subscription;
        const collectionRef = doc(db, 'boxes', boxId, 'pickups', pickupId, 'collections', subscriptionId);
        
        try {
            if (collected) {
                await deleteDoc(collectionRef);
            } else {
                await setDoc(collectionRef, {
                    collected: true,
                    collectedAt: serverTimestamp(),
                    customerName: customerName,
                    subscriptionId: subscriptionId
                });
            }
        } catch (error) {
            console.error("Failed to update collection status:", error);
        }
    }, [boxId, pickupId]);

    const subscribersWithStatus: SubscriberCheckin[] = useMemo(() => {
        return subscriptions.map(sub => {
            return {
                ...sub,
                collected: collectionStatuses.has(sub.id),
                collectedAt: collectionStatuses.get(sub.id)?.collectedAt || null,
            };
        }).sort((a,b) => (a.customerName || '').localeCompare(b.customerName || ''));
    }, [subscriptions, collectionStatuses]);
    
    const filteredSubscribers = useMemo(() => {
        return subscribersWithStatus.filter(sub => {
            const matchesFilter = filter === 'all' || (filter === 'collected' && sub.collected) || (filter === 'uncollected' && !sub.collected);
            const matchesSearch = searchTerm === '' || sub.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) || sub.customerEmail?.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesFilter && matchesSearch;
        });
    }, [subscribersWithStatus, filter, searchTerm]);

    const collectedCount = useMemo(() => {
        return Array.from(collectionStatuses.values()).filter(s => s.collected).length;
    }, [collectionStatuses]);
    
    const progressPercentage = subscriptions.length > 0 ? (collectedCount / subscriptions.length) * 100 : 0;

    if (isLoading) {
        return <div className="p-6"><Skeleton className="h-96 w-full" /></div>;
    }

    if (!box || !pickup) {
        return <div className="p-6">Pickup not found.</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center text-sm text-muted-foreground">
                {fromDashboard ? (
                    <>
                        <Link href="/admin/dashboard" className="hover:text-primary">Dashboard</Link>
                        <ChevronRight className="h-4 w-4 mx-1" />
                    </>
                ) : (
                    <>
                        <Link href="/admin/boxes" className="hover:text-primary">Veggie Box Plans</Link>
                        <ChevronRight className="h-4 w-4 mx-1" />
                        <Link href={`/admin/boxes/${boxId}`} className="hover:text-primary truncate max-w-48">{box.name}</Link>
                        <ChevronRight className="h-4 w-4 mx-1" />
                    </>
                )}
                <span className="font-medium text-foreground">Check-in</span>
            </div>

            <div>
                <h1 className="text-2xl font-headline">Pickup Check-in</h1>
                <p className="text-muted-foreground">
                    For {box.name} on {format(new Date(pickup.pickupDate.replace(/-/g, '/')), 'PPPP')}
                </p>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Collection Progress</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    <Progress value={progressPercentage} />
                    <p className="text-sm text-muted-foreground font-medium">
                        {collectedCount} of {subscriptions.length} subscribers have collected their box.
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Subscriber List</CardTitle>
                    <CardDescription>Check off subscribers as they collect their veggie box.</CardDescription>
                     <div className="flex flex-col md:flex-row gap-4 pt-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search by name or email..."
                                className="pl-8"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <ToggleGroup type="single" value={filter} onValueChange={(value) => { if(value) setFilter(value) }} defaultValue="all">
                            <ToggleGroupItem value="all" aria-label="All subscribers">All</ToggleGroupItem>
                            <ToggleGroupItem value="uncollected" aria-label="Uncollected"><XCircle className="mr-2 h-4 w-4" />Not Collected</ToggleGroupItem>
                            <ToggleGroupItem value="collected" aria-label="Collected"><CheckCircle className="mr-2 h-4 w-4" />Collected</ToggleGroupItem>
                        </ToggleGroup>
                    </div>
                </CardHeader>
                <CardContent>
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]"></TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead className="hidden md:table-cell">Email</TableHead>
                                <TableHead className="hidden sm:table-cell">Status</TableHead>
                                <TableHead className="text-right">Collected At</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredSubscribers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        No matching subscribers found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredSubscribers.map((sub) => (
                                    <TableRow key={sub.id} className={cn(sub.collected && "bg-secondary/40 hover:bg-secondary/60")}>
                                        <TableCell>
                                            <Checkbox
                                                checked={sub.collected}
                                                onCheckedChange={() => handleToggleCollection(sub)}
                                                id={`check-${sub.id}`}
                                                aria-label={`Mark ${sub.customerName} as collected`}
                                            />
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            <div className="flex flex-col">
                                                <span>{sub.customerName}</span>
                                                {sub.notes && (
                                                    <p className="text-xs text-muted-foreground font-normal pt-1">{sub.notes}</p>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell">{sub.customerEmail}</TableCell>
                                        <TableCell className="hidden sm:table-cell">
                                            <div className="flex items-center gap-2">
                                                {sub.collected ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}
                                                <span className="font-medium">{sub.collected ? 'Collected' : 'Not Collected'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {sub.collectedAt ? formatDistanceToNow(sub.collectedAt, { addSuffix: true }) : 'N/A'}
                                        </TableCell>
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
