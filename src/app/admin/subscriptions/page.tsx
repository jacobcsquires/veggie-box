

'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { collection, onSnapshot, query, where, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Subscription, Box, AppUser } from '@/lib/types';
import { Search, RefreshCw, PlusCircle, Copy, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type Stripe from 'stripe';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

type EnrichedSubscription = Subscription & {
    stripeSub?: Stripe.Subscription;
    localOnly?: boolean;
};

export default function AdminSubscriptionsPage() {
    const [subscriptions, setSubscriptions] = useState<EnrichedSubscription[]>([]);
    const [boxes, setBoxes] = useState<Box[]>([]);
    const [users, setUsers] = useState<AppUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('all');
    const router = useRouter();
    const { toast } = useToast();

    // State for manual subscription dialog
    const [isSubDialogOpen, setIsSubDialogOpen] = useState(false);
    const [isCreatingSub, setIsCreatingSub] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState('');
    const [selectedBoxId, setSelectedBoxId] = useState('');
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
        
        const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
            const usersData = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as AppUser));
            setUsers(usersData);
        });

        return () => {
            unsubscribeSubs();
            unsubscribeBoxes();
            unsubscribeUsers();
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
        if (!selectedUserId || !selectedBoxId) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please select a user and a Veggie Box Plan.'});
            return;
        }
        setIsCreatingSub(true);
        const user = users.find(u => u.uid === selectedUserId);
        const box = boxes.find(b => b.id === selectedBoxId);
        
        if (!user || !box) {
             toast({ variant: 'destructive', title: 'Error', description: 'Could not find selected user or plan.'});
             setIsCreatingSub(false);
             return;
        }

        try {
            const response = await fetch('/api/checkout_sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    boxId: box.id,
                    userId: user.uid,
                    customerName: user.displayName,
                    email: user.email,
                    startDate: box.startDate, // Assuming first available date
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
        setSelectedUserId('');
        setSelectedBoxId('');
    }

    const filteredSubscriptions = useMemo(() => {
        return subscriptions
            .filter(sub => {
                const matchesStatus = selectedStatus === 'all' || (sub.stripeSub?.status ?? 'local') === selectedStatus;
                const matchesSearch = sub.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) || sub.boxName.toLowerCase().includes(searchTerm.toLowerCase());
                return matchesStatus && matchesSearch;
            })
            .sort((a, b) => (a.customerName || '').localeCompare(b.customerName || ''));
    }, [subscriptions, searchTerm, selectedStatus]);

    const getStatusVariant = (status: string | undefined) => {
        switch (status) {
            case 'active': return 'default';
            case 'trialing': return 'secondary';
            case 'past_due':
            case 'unpaid': return 'destructive';
            case 'local': return 'outline';
            default: return 'secondary';
        }
    }

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
                                        : "Select a user and a plan to generate a Stripe checkout link."
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
                                    <Label htmlFor="user-select">User</Label>
                                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                                        <SelectTrigger id="user-select"><SelectValue placeholder="Select a user" /></SelectTrigger>
                                        <SelectContent>
                                            {users.map(user => <SelectItem key={user.uid} value={user.uid}>{user.displayName} ({user.email})</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                 <div className="grid gap-2">
                                    <Label htmlFor="box-select">Veggie Box Plan</Label>
                                    <Select value={selectedBoxId} onValueChange={setSelectedBoxId}>
                                        <SelectTrigger id="box-select"><SelectValue placeholder="Select a plan" /></SelectTrigger>
                                        <SelectContent>
                                            {boxes.filter(b => b.displayOnWebsite && !b.manualSignupCutoff).map(box => <SelectItem key={box.id} value={box.id}>{box.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
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
                        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                            <SelectTrigger className="w-full md:w-[200px]">
                                <SelectValue placeholder="Filter by status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="past_due">Past Due</SelectItem>
                                <SelectItem value="unpaid">Unpaid</SelectItem>
                                <SelectItem value="canceled">Canceled</SelectItem>
                                <SelectItem value="incomplete">Incomplete</SelectItem>
                                <SelectItem value="local">Local Only</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Customer</TableHead>
                                <TableHead>Plan</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Next Billing</TableHead>
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
                                        <TableCell className="text-right"><Skeleton className="h-5 w-12 ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : filteredSubscriptions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        No matching subscriptions found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredSubscriptions.map((sub) => (
                                    <TableRow key={sub.id} onClick={() => router.push(`/admin/subscriptions/${sub.id}`)} className="cursor-pointer">
                                        <TableCell className="font-medium">{sub.customerName || sub.userId}</TableCell>
                                        <TableCell>{sub.boxName}</TableCell>
                                        <TableCell>
                                            <Badge variant={getStatusVariant(sub.stripeSub?.status || (sub.localOnly ? 'local' : 'default'))} className="capitalize">
                                                {sub.localOnly ? 'Local Only' : (sub.stripeSub?.status ?? sub.status).replace('_', ' ')}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {sub.stripeSub?.current_period_end ? format(new Date(sub.stripeSub.current_period_end * 1000), 'PPP') : 'N/A'}
                                        </TableCell>
                                        <TableCell className="text-right">${sub.price.toFixed(2)}</TableCell>
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
