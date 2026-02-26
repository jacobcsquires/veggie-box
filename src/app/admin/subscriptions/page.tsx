
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { collection, onSnapshot, query, where, getDocs, doc, setDoc, serverTimestamp, orderBy as firestoreOrderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Subscription, Box, AppUser, Customer } from '@/lib/types';
import { Search, ChevronsUpDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type Stripe from 'stripe';
import Link from 'next/link';

type SortDescriptor = {
    column: keyof Subscription;
    direction: 'asc' | 'desc';
};

export default function AdminSubscriptionsPage() {
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [boxes, setBoxes] = useState<Box[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [selectedBoxFilter, setSelectedBoxFilter] = useState('all');
    const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({ column: 'createdAt', direction: 'desc' });
    const router = useRouter();
    const { toast } = useToast();

    useEffect(() => {
        const unsubscribeSubs = onSnapshot(collection(db, 'subscriptions'), (snapshot) => {
            const subsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subscription));
            setSubscriptions(subsData);
            setIsLoading(false);
        });

        const unsubscribeBoxes = onSnapshot(collection(db, 'boxes'), (snapshot) => {
            const boxesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Box));
            setBoxes(boxesData);
        });

        return () => {
            unsubscribeSubs();
            unsubscribeBoxes();
        };
    }, []);
    
    const handleSort = (column: keyof Subscription) => {
        if (sortDescriptor.column === column) {
            setSortDescriptor({ ...sortDescriptor, direction: sortDescriptor.direction === 'asc' ? 'desc' : 'asc' });
        } else {
            setSortDescriptor({ column, direction: 'asc' });
        }
    };


    const filteredAndSortedSubscriptions = useMemo(() => {
        return subscriptions
            .filter(sub => {
                const status = sub.status?.toLowerCase() || 'pending';
                const matchesStatus = selectedStatus === 'all' || status === selectedStatus;
                const matchesBox = selectedBoxFilter === 'all' || sub.boxId === selectedBoxFilter;
                const matchesSearch = sub.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) || sub.boxName.toLowerCase().includes(searchTerm.toLowerCase());
                return matchesStatus && matchesBox && matchesSearch;
            })
            .sort((a, b) => {
                const aValue = a[sortDescriptor.column];
                const bValue = b[sortDescriptor.column];
                
                let cmp = 0;
                if (aValue > bValue) cmp = 1;
                if (aValue < bValue) cmp = -1;

                return sortDescriptor.direction === 'asc' ? cmp : -cmp;
            });
    }, [subscriptions, searchTerm, selectedStatus, selectedBoxFilter, sortDescriptor]);


    const getStatusVariant = (status?: string) => {
        switch (status?.toLowerCase()) {
            case 'active': return 'default';
            case 'pending': return 'secondary';
            case 'trialing': return 'secondary';
            case 'past due':
            case 'unpaid': return 'destructive';
            case 'localonly': return 'outline';
            case 'unknown': return 'outline';
            default: return 'secondary';
        }
    }

    const renderSortIcon = (column: keyof Subscription) => {
        if (sortDescriptor.column !== column) return <ChevronsUpDown className="ml-2 h-4 w-4" />;
        return sortDescriptor.direction === 'asc' ? <ChevronsUpDown className="ml-2 h-4 w-4" /> : <ChevronsUpDown className="ml-2 h-4 w-4" />; // Icons could be different for asc/desc
    };


    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <div className="space-y-1">
                    <h1 className="text-lg font-semibold md:text-2xl font-headline">
                        Subscriptions
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        A list of all subscriptions for your Veggie Box Plans.
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search by name or plan..."
                                className="pl-8"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Select value={selectedBoxFilter} onValueChange={setSelectedBoxFilter}>
                            <SelectTrigger className="w-full md:w-[280px]">
                                <SelectValue placeholder="Filter by plan" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Veggie Box Plans</SelectItem>
                                {boxes.map(box => <SelectItem key={box.id} value={box.id}>{box.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                            <SelectTrigger className="w-full md:w-[200px]">
                                <SelectValue placeholder="Filter by status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="trialing">Skipped/Scheduled</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="past due">Past Due</SelectItem>
                                <SelectItem value="unpaid">Unpaid</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                                <SelectItem value="unknown">Unknown</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Mobile View */}
                    <div className="md:hidden space-y-4">
                        {isLoading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <Card key={i} className="p-4">
                                    <div className="space-y-2">
                                        <Skeleton className="h-5 w-3/4" />
                                        <Skeleton className="h-4 w-1/2" />
                                        <Skeleton className="h-6 w-20 rounded-full" />
                                    </div>
                                </Card>
                            ))
                        ) : filteredAndSortedSubscriptions.length === 0 ? (
                            <div className="text-center text-muted-foreground py-10">
                                No matching subscriptions found.
                            </div>
                        ) : (
                            filteredAndSortedSubscriptions.map((sub) => (
                                <Card key={sub.id} onClick={() => router.push(`/admin/subscriptions/${sub.id}`)} className="cursor-pointer">
                                    <CardContent className="p-4 grid gap-2">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-semibold">{sub.customerName || sub.userId}</p>
                                                <p className="text-sm text-muted-foreground">{sub.boxName}</p>
                                            </div>
                                            <p className="font-bold">${sub.price.toFixed(2)}</p>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <Badge variant={getStatusVariant(sub.status)} className="capitalize">
                                                {sub.status === 'Trialing' ? (sub.lastCharged ? 'Skipped' : 'Scheduled') : sub.status}
                                            </Badge>
                                            <div className="text-muted-foreground">
                                                {sub.nextPickup ? (
                                                    <span>Next: {format(parseISO(sub.nextPickup), 'MMM d')}</span>
                                                ) : 'N/A'}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>
                    {/* Desktop View */}
                    <div className="hidden md:block">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>
                                        <Button variant="ghost" onClick={() => handleSort('customerName')}>
                                            Customer {renderSortIcon('customerName')}
                                        </Button>
                                    </TableHead>
                                    <TableHead className="hidden sm:table-cell">
                                        <Button variant="ghost" onClick={() => handleSort('boxName')}>
                                            Plan {renderSortIcon('boxName')}
                                        </Button>
                                    </TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="hidden md:table-cell">
                                        <Button variant="ghost" onClick={() => handleSort('nextPickup')}>
                                            Next Billing {renderSortIcon('nextPickup')}
                                        </Button>
                                    </TableHead>
                                    <TableHead className="hidden lg:table-cell">
                                        <Button variant="ghost" onClick={() => handleSort('lastCharged')}>
                                            Last Charged {renderSortIcon('lastCharged')}
                                        </Button>
                                    </TableHead>
                                    <TableHead className="hidden sm:table-cell text-right">Price</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                            <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-32" /></TableCell>
                                            <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                                            <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-24" /></TableCell>
                                            <TableCell className="hidden lg:table-cell"><Skeleton className="h-5 w-24" /></TableCell>
                                            <TableCell className="hidden sm:table-cell text-right"><Skeleton className="h-5 w-12 ml-auto" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : filteredAndSortedSubscriptions.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">
                                            No matching subscriptions found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredAndSortedSubscriptions.map((sub) => (
                                        <TableRow key={sub.id} onClick={() => router.push(`/admin/subscriptions/${sub.id}`)} className="cursor-pointer">
                                            <TableCell className="font-medium">
                                                <Link href={`/admin/customers/${sub.stripeCustomerId}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
                                                    {sub.customerName || sub.userId}
                                                </Link>
                                            </TableCell>
                                            <TableCell className="hidden sm:table-cell">{sub.boxName}</TableCell>
                                            <TableCell>
                                                <Badge variant={getStatusVariant(sub.status)} className="capitalize">
                                                    {sub.status === 'Trialing' ? (sub.lastCharged ? 'Skipped' : 'Scheduled') : sub.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell">
                                                {sub.nextPickup ? format(parseISO(sub.nextPickup), 'PPP') : 'N/A'}
                                            </TableCell>
                                            <TableCell className="hidden lg:table-cell">
                                                {sub.lastCharged ? format(parseISO(sub.lastCharged), 'PPP') : 'N/A'}
                                            </TableCell>
                                            <TableCell className="hidden sm:table-cell text-right">${sub.price.toFixed(2)}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
