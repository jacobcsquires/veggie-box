
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Subscription } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Loader2, ExternalLink, ChevronRight, RefreshCw } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type Stripe from 'stripe';

export default function SubscriptionDetailPage() {
  const params = useParams();
  const subscriptionId = params.subscriptionId as string;
  const router = useRouter();
  const { toast } = useToast();

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [stripeData, setStripeData] = useState<{
      subscription: Stripe.Subscription;
      nextBillingDate: string | number;
      transactions: Stripe.Charge[];
      customer: Stripe.Customer;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isStripeLoading, setIsStripeLoading] = useState(true);
  const [isManagingPortal, setIsManagingPortal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (!subscriptionId) return;

    const subRef = doc(db, 'subscriptions', subscriptionId);
    const unsubscribe = onSnapshot(subRef, (docSnap) => {
      if (docSnap.exists()) {
        const subData = { id: docSnap.id, ...docSnap.data() } as Subscription;
        setSubscription(subData);
      } else {
        toast({ variant: 'destructive', title: 'Error', description: 'Subscription not found.' });
        router.push('/admin/subscriptions');
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [subscriptionId, router, toast]);

  const fetchStripeData = async () => {
        if (!subscription?.stripeSubscriptionId) return;
        setIsStripeLoading(true);
        try {
            const response = await fetch('/api/get-stripe-subscription', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stripeSubscriptionId: subscription.stripeSubscriptionId }),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to fetch Stripe data.');
            }
            const data = await response.json();
            setStripeData(data);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Stripe Error', description: error.message });
        } finally {
            setIsStripeLoading(false);
        }
    };

  useEffect(() => {
    if (subscription?.stripeSubscriptionId) {
        fetchStripeData();
    } else if (subscription) {
        // If there's a subscription but no stripe ID, we're not loading stripe data.
        setIsStripeLoading(false);
    }
  }, [subscription]);


  const handleManageSubscription = async (customerId?: string) => {
    if (!customerId) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Stripe Customer ID not found.'
        });
        return;
    }
    setIsManagingPortal(true);
    try {
        const response = await fetch('/api/create-portal-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customerId }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to create portal session');
        }
        
        const { url } = await response.json();
        window.open(url, '_blank');
    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Could not open Stripe portal. Please try again later.'
        });
    } finally {
        setIsManagingPortal(false);
    }
  };

  const handleSync = async () => {
        setIsSyncing(true);
        await fetchStripeData();
        toast({ title: "Sync Complete", description: "Subscription data has been updated from Stripe."})
        setIsSyncing(false);
    }


  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/2" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-4 w-1/3" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
          <CardFooter>
            <Skeleton className="h-10 w-24" />
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (!subscription) {
    return null; // Or a 'not found' component
  }

  const getStripeStatusBadgeVariant = (status: Stripe.Subscription.Status | Subscription['status']) => {
    switch (status?.toLowerCase()) {
        case 'active': return 'default';
        case 'past_due':
        case 'unpaid':
             return 'destructive';
        case 'trialing':
        case 'incomplete':
             return 'secondary';
        default: return 'outline';
    }
  }


  return (
    <div className="space-y-6">
       <div className="flex items-center text-sm text-muted-foreground">
        <Link href="/admin/subscriptions" className="hover:text-primary">Subscriptions</Link>
        <ChevronRight className="h-4 w-4 mx-1" />
        <span className="font-medium text-foreground">{subscription.id}</span>
      </div>
      <div className="flex justify-between items-start">
        <div>
            <h1 className="text-2xl font-headline">Subscription Details</h1>
            <p className="text-muted-foreground mt-1">Manage subscription and view payment history.</p>
        </div>
        <div className="flex items-center gap-2">
            {subscription.stripeSubscriptionId && (
                <Button onClick={handleSync} disabled={isSyncing || isStripeLoading} variant="outline">
                    <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                    Sync with Stripe
                </Button>
            )}
            <Button onClick={() => handleManageSubscription(subscription.stripeCustomerId)} disabled={isManagingPortal || !subscription.stripeCustomerId}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Manage in Stripe
            </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
            <Card>
                <CardHeader>
                <CardTitle>Subscription Details</CardTitle>
                <CardDescription>View the details for this subscription. Manage in Stripe.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                    <Label>Customer</Label>
                    <p className="text-sm font-medium">{subscription.customerName}</p>
                    </div>
                    <div>
                    <Label>Veggie Box Plan</Label>
                    <p className="text-sm font-medium">{subscription.boxName}</p>
                    </div>
                    <div>
                    <Label>Start Date</Label>
                    <p className="text-sm font-medium">{format(new Date(subscription.startDate.replace(/-/g, '/')), 'PPP')}</p>
                    </div>
                    <div>
                    <Label>Price</Label>
                    <p className="text-sm font-medium">${subscription.price.toFixed(2)}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <p><Badge variant={getStripeStatusBadgeVariant(subscription.status)} className="capitalize">{subscription.status === 'Trialing' ? 'Paused' : subscription.status}</Badge></p>
                    </div>
                </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Transaction History</CardTitle>
                    <CardDescription>A list of recent payments for this subscription.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isStripeLoading ? <Skeleton className="h-40 w-full" /> : (
                        stripeData && stripeData.transactions.length > 0 ? (
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Receipt</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {stripeData.transactions.map(charge => (
                                        <TableRow key={charge.id}>
                                            <TableCell>{format(new Date(charge.created * 1000), 'PPP')}</TableCell>
                                            <TableCell>${(charge.amount / 100).toFixed(2)}</TableCell>
                                            <TableCell><Badge variant={charge.status === 'succeeded' ? 'default' : 'destructive'}>{charge.status}</Badge></TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" asChild>
                                                    <a href={charge.receipt_url || ''} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : <p className="text-sm text-muted-foreground text-center py-4">No transaction history found.</p>
                    )}
                </CardContent>
            </Card>

        </div>
        <div>
            <Card>
                <CardHeader>
                    <CardTitle>Stripe Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                    {isStripeLoading ? <Skeleton className="h-32 w-full" /> : stripeData ? (
                        <>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Stripe Status</span>
                                <Badge variant={getStripeStatusBadgeVariant(stripeData.subscription.status)} className="capitalize">{stripeData.subscription.status === 'trialing' ? 'Paused' : stripeData.subscription.status.replace('_', ' ')}</Badge>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Next Billing</span>
                                <span className="font-medium">{format(new Date(stripeData.nextBillingDate), 'PPP')}</span>
                            </div>
                             <div className="flex flex-col space-y-1">
                                <span className="text-muted-foreground">Subscription ID</span>
                                <span className="font-mono text-xs">{stripeData.subscription.id}</span>
                            </div>
                            <div className="flex flex-col space-y-1">
                                <span className="text-muted-foreground">Customer ID</span>
                                <span className="font-mono text-xs">{stripeData.customer.id}</span>
                            </div>
                        </>
                    ) : (
                        <p className="text-muted-foreground">No Stripe subscription linked. This might be a pending or manually created subscription.</p>
                    )}
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
