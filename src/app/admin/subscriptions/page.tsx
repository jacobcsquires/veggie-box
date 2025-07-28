

'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { collection, onSnapshot, query, where, getDocs, doc, setDoc, serverTimestamp, orderBy as firestoreOrderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Subscription, Box, AppUser, Customer } from '@/lib/types';
import { Search, RefreshCw, PlusCircle, Copy, Check, ChevronsUpDown } from 'lucide-react';
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

type SortDescriptor = {
    column: keyof Subscription;
    direction: 'asc' | 'desc';
};

export default function AdminSubscriptionsPage() {
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [boxes, setBoxes] = useState<Box[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('active');
    const [selectedBoxFilter, setSelectedBoxFilter] = useState('all');
    const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({ column: 'createdAt', direction: 'desc' });
    const router = useRouter();
    const { toast } = useToast();

    // State for manual subscription dialog
    const [isSubDialogOpen, setIsSubDialogOpen] = useState(false);
    const [isCreatingSub, setIsCreatingSub] = useState(false);
    const [selectedCustomerId, setSelectedCustomerId] = useState('');
    const [selectedBoxId, setSelectedBoxId] = useState('');
    const [selectedPriceId, setSelectedPriceId] = useState('');
    const [checkoutUrl, setCheckoutUrl] = useState('');
    const [hasCopied, setHasCopied] = useState(false);

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
        
        const unsubscribeCustomers = onSnapshot(query(collection(db, 'customers'), firestoreOrderBy('name')), (snapshot) => {
            const customersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
            setCustomers(customersData);
        });

        return () => {
            unsubscribeSubs();
            unsubscribeBoxes();
            unsubscribeCustomers();
        };
    }, []);

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            const response = await fetch('/api/sync-stripe-subscriptions', {
                method: 'POST',
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.message || 'Failed to sync with Stripe.');
            }
            toast({
                title: 'Sync Complete',
                description: `${result.createdCount} new subscription(s) created, ${result.updatedCount} updated.`,
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Sync Error',
                description: error.message,
            });
        } finally {
            setIsSyncing(false);
        }
    };
    
    const handleCreateSubscription = async () => {
        if (!selectedCustomerId || !selectedBoxId || !selectedPriceId) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please select a customer, a plan, and a pricing option.'});
            return;
        }
        setIsCreatingSub(true);
        const customer = customers.find(c => c.id === selectedCustomerId);
        const box = boxes.find(b => b.id === selectedBoxId);
        const price = box?.pricingOptions.find(p => p.id === selectedPriceId);
        
        if (!customer || !box || !price) {
             toast({ variant: 'destructive', title: 'Error', description: 'Could not find selected customer, plan, or price.'});
             setIsCreatingSub(false);
             return;
        }

        try {
            const response = await fetch('/api/checkout_sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    boxId: box.id,
                    userId: customer.id, // Use Stripe Customer ID as the reference
                    customerName: customer.name,
                    email: customer.email,
                    startDate: box.startDate,
                    priceId: price.id,
                    price: price.price,
                    priceName: price.name
                }),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to create checkout session.');
            }
            const { url } = await response.json();
            setCheckoutUrl(url);

        } catch(error: any) {
             toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
             setIsCreatingSub(false);
        }

    }
    
    const copyToClipboard = () => {
        navigator.clipboard.writeText(checkoutUrl);
        setHasCopied(true);
        setTimeout(() => setHasCopied(false), 2000);
    };

    const resetSubDialog = () => {
        setIsSubDialogOpen(false);
        setCheckoutUrl('');
        setSelectedCustomerId('');
        setSelectedBoxId('');
        setSelectedPriceId('');
    }

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
    
    const selectedBoxOptions = useMemo(() => {
        return boxes.find(b => b.id === selectedBoxId)?.pricingOptions || [];
    }, [selectedBoxId, boxes]);


    const getStatusVariant = (status?: string) => {
        switch (status?.toLowerCase()) {
            case 'active': return 'default';
            case 'pending': return 'secondary';
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
                <div className="flex items-center gap-2">
                     <Dialog open={isSubDialogOpen} onOpenChange={(isOpen) => { if(!isOpen) resetSubDialog(); else setIsSubDialogOpen(true); }}>
                        <DialogTrigger asChild>
                            <Button>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                New Subscription
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Create New Subscription</DialogTitle>
                                <DialogDescription>
                                    {checkoutUrl 
                                        ? "Share this checkout link with the customer to complete payment."
                                        : "Select a customer and a plan to generate a Stripe checkout link."
                                    }
                                </DialogDescription>
                            </DialogHeader>
                            {checkoutUrl ? (
                                <div className="space-y-4 pt-4">
                                    <div className="relative">
                                        <Input value={checkoutUrl} readOnly className="pr-10" />
                                        <Button size="icon" variant="ghost" className="absolute top-1/2 right-1 -translate-y-1/2 h-8 w-8" onClick={copyToClipboard}>
                                            {hasCopied ? <Check className="h-4 w-4 text-green-500"/> : <Copy className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                    <p className="text-xs text-muted-foreground">The subscription will remain 'Pending' until the customer completes the payment.</p>
                                </div>
                            ) : (
                                <div className="space-y-4 pt-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="user-select">Customer</Label>
                                    <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                                        <SelectTrigger id="user-select"><SelectValue placeholder="Select a customer" /></SelectTrigger>
                                        <SelectContent>
                                            {customers.map(customer => <SelectItem key={customer.id} value={customer.id}>{customer.name} ({customer.email})</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                 <div className="grid gap-2">
                                    <Label htmlFor="box-select">Veggie Box Plan</Label>
                                    <Select value={selectedBoxId} onValueChange={(value) => { setSelectedBoxId(value); setSelectedPriceId(''); }}>
                                        <SelectTrigger id="box-select"><SelectValue placeholder="Select a plan" /></SelectTrigger>
                                        <SelectContent>
                                            {boxes.filter(b => b.displayOnWebsite && !b.manualSignupCutoff).map(box => <SelectItem key={box.id} value={box.id}>{box.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                {selectedBoxId && (
                                     <div className="grid gap-2">
                                        <Label htmlFor="price-select">Pricing Option</Label>
                                        <Select value={selectedPriceId} onValueChange={setSelectedPriceId} disabled={selectedBoxOptions.length === 0}>
                                            <SelectTrigger id="price-select"><SelectValue placeholder="Select a pricing option" /></SelectTrigger>
                                            <SelectContent>
                                                {selectedBoxOptions.map(opt => <SelectItem key={opt.id} value={opt.id}>{opt.name} (${opt.price.toFixed(2)})</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>
                            )}
                            <DialogFooter>
                                {checkoutUrl ? (
                                    <Button onClick={resetSubDialog}>Done</Button>
                                ) : (
                                    <Button onClick={handleCreateSubscription} disabled={isCreatingSub}>
                                        {isCreatingSub && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                                        Generate Link
                                    </Button>
                                )}
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    <Button onClick={handleSync} disabled={isSyncing} variant="outline">
                        <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                        {isSyncing ? 'Syncing...' : 'Sync with Stripe'}
                    </Button>
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
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>
                                    <Button variant="ghost" onClick={() => handleSort('customerName')}>
                                        Customer {renderSortIcon('customerName')}
                                    </Button>
                                </TableHead>
                                <TableHead>
                                     <Button variant="ghost" onClick={() => handleSort('boxName')}>
                                        Plan {renderSortIcon('boxName')}
                                    </Button>
                                </TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>
                                     <Button variant="ghost" onClick={() => handleSort('nextPickup')}>
                                        Next Billing {renderSortIcon('nextPickup')}
                                    </Button>
                                </TableHead>
                                <TableHead>Last Charged</TableHead>
                                <TableHead className="text-right">Price</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                        <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-5 w-12 ml-auto" /></TableCell>
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
                                    <TableRow key={sub.id} className="group">
                                        <TableCell className="font-medium">
                                            <Link href={`/admin/customers/${sub.stripeCustomerId}`} className="hover:underline">
                                                {sub.customerName || sub.userId}
                                            </Link>
                                        </TableCell>
                                        <TableCell>{sub.boxName}</TableCell>
                                        <TableCell>
                                            <Badge variant={getStatusVariant(sub.status)} className="capitalize">
                                                {sub.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {sub.nextPickup ? format(parseISO(sub.nextPickup), 'PPP') : 'N/A'}
                                        </TableCell>
                                        <TableCell>
                                            {sub.lastCharged ? format(parseISO(sub.lastCharged), 'PPP') : 'N/A'}
                                        </TableCell>
                                        <TableCell className="text-right">${sub.price.toFixed(2)}</TableCell>
                                        <TableCell className="opacity-0 group-hover:opacity-100 text-right">
                                            <Button variant="outline" size="sm" onClick={() => router.push(`/admin/subscriptions/${sub.id}`)}>
                                                View
                                            </Button>
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
