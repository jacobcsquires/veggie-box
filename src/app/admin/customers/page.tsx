
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { collection, onSnapshot, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Customer, Subscription } from '@/lib/types';
import { Search, RefreshCw, PlusCircle, ExternalLink, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';


type CustomerWithSubCount = Customer & { activeSubscriptionCount: number };

export default function AdminCustomersPage() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState('all');
    const router = useRouter();
    const { toast } = useToast();

    // State for manual subscription dialog
    const [isNewCustomerDialogOpen, setIsNewCustomerDialogOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');


    useEffect(() => {
        const unsubscribeCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
            const subsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
            setCustomers(subsData);
            setIsLoading(false);
        });

        const unsubscribeSubscriptions = onSnapshot(
            query(collection(db, 'subscriptions'), where('status', '==', 'Active')),
            (snapshot) => {
                setSubscriptions(snapshot.docs.map(doc => doc.data() as Subscription));
            }
        );
        
        return () => {
            unsubscribeCustomers();
            unsubscribeSubscriptions();
        }
    }, []);

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            const response = await fetch('/api/sync-stripe-customers', {
                method: 'POST',
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.message || 'Failed to sync with Stripe.');
            }
            toast({
                title: 'Sync Complete',
                description: `${result.createdCount} new customer(s) created, ${result.updatedCount} updated.`,
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
    
    const handleCreateCustomer = async () => {
        if (!name || !email) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please fill out all fields.'});
            return;
        }
        setIsCreating(true);
      
        try {
            const response = await fetch('/api/create-stripe-customer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email }),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to create customer.');
            }
            toast({ title: 'Success', description: 'New customer created in Stripe and locally.'});
            resetDialog();

        } catch(error: any) {
             toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
             setIsCreating(false);
        }
    }
    
    const resetDialog = () => {
        setIsNewCustomerDialogOpen(false);
        setName('');
        setEmail('');
    }

    const customersWithSubCounts = useMemo(() => {
        const subscriptionCounts = subscriptions.reduce((acc, sub) => {
            const customerId = sub.stripeCustomerId;
            if (customerId) {
                acc[customerId] = (acc[customerId] || 0) + 1;
            }
            return acc;
        }, {} as Record<string, number>);

        return customers.map(customer => ({
            ...customer,
            activeSubscriptionCount: subscriptionCounts[customer.id] || 0
        }));
    }, [customers, subscriptions]);

    const filteredCustomers = useMemo(() => {
        return customersWithSubCounts
            .filter(customer => {
                const nameMatch = customer.name?.toLowerCase().includes(searchTerm.toLowerCase());
                const emailMatch = customer.email.toLowerCase().includes(searchTerm.toLowerCase());
                
                let filterMatch = true;
                if (filter === 'active') {
                    filterMatch = customer.activeSubscriptionCount > 0;
                } else if (filter === 'inactive') {
                    filterMatch = customer.activeSubscriptionCount === 0;
                }
                
                return (nameMatch || emailMatch) && filterMatch;
            })
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [customersWithSubCounts, searchTerm, filter]);

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <div className="space-y-1">
                    <h1 className="text-lg font-semibold md:text-2xl font-headline">
                        Customers
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        A list of all customers from Stripe.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                     <Dialog open={isNewCustomerDialogOpen} onOpenChange={(isOpen) => { if(!isOpen) resetDialog(); else setIsNewCustomerDialogOpen(true); }}>
                        <DialogTrigger asChild>
                            <Button>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                New Customer
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Create New Customer</DialogTitle>
                                <DialogDescription>
                                    This will create a new customer record in your database and in Stripe.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 pt-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="name">Full Name</Label>
                                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} disabled={isCreating}/>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="email">Email Address</Label>
                                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isCreating}/>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleCreateCustomer} disabled={isCreating}>
                                    {isCreating && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                                    Create Customer
                                </Button>
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
                    <div className="flex flex-col md:flex-row gap-4">
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
                            <ToggleGroupItem value="all" aria-label="All customers">All</ToggleGroupItem>
                            <ToggleGroupItem value="active" aria-label="With active subscriptions"><Users className="mr-2 h-4 w-4" />Active</ToggleGroupItem>
                            <ToggleGroupItem value="inactive" aria-label="Without active subscriptions">Inactive</ToggleGroupItem>
                        </ToggleGroup>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Active Subscriptions</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Stripe</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                                        <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : filteredCustomers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        No matching customers found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredCustomers.map((customer) => (
                                    <TableRow key={customer.id} onClick={() => router.push(`/admin/customers/${customer.id}`)} className="cursor-pointer">
                                        <TableCell className="font-medium">{customer.name || 'N/A'}</TableCell>
                                        <TableCell>{customer.email}</TableCell>
                                        <TableCell>{customer.activeSubscriptionCount}</TableCell>
                                        <TableCell>
                                            <Badge variant={customer.localOnly ? 'destructive' : 'default'} className="capitalize">
                                                {customer.localOnly ? 'Local Only' : 'Synced'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" asChild>
                                                <a href={`https://dashboard.stripe.com/test/customers/${customer.id}`} target="_blank" rel="noopener noreferrer">
                                                    <ExternalLink className="h-4 w-4" />
                                                </a>
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
    
