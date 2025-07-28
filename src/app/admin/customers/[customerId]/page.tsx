
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Customer } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { format, formatDistanceToNow } from 'date-fns';
import { ExternalLink, Home, Mail, ChevronRight, Phone } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type Stripe from 'stripe';

type StripeData = {
    customer: Stripe.Customer;
    subscriptions: Stripe.Subscription[];
    charges: Stripe.Charge[];
} | null;

export default function CustomerDetailPage() {
  const params = useParams();
  const customerId = params.customerId as string;
  const { toast } = useToast();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [stripeData, setStripeData] = useState<StripeData>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isStripeLoading, setIsStripeLoading] = useState(true);

  useEffect(() => {
    if (!customerId) return;

    const subRef = doc(db, 'customers', customerId);
    const unsubscribe = onSnapshot(subRef, (docSnap) => {
      if (docSnap.exists()) {
        const subData = { id: docSnap.id, ...docSnap.data() } as Customer;
        setCustomer(subData);
      } else {
        toast({ variant: 'destructive', title: 'Error', description: 'Customer not found.' });
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [customerId, toast]);

  useEffect(() => {
    if (customer) {
        const fetchStripeData = async () => {
            setIsStripeLoading(true);
            try {
                const response = await fetch('/api/get-stripe-customer-details', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ customerId: customer.id }),
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
        fetchStripeData();
    }
  }, [customer, toast]);


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
        </Card>
      </div>
    );
  }

  if (!customer) {
    return null; // Or a 'not found' component
  }

  const getStripeStatusBadgeVariant = (status: Stripe.Subscription.Status) => {
    switch (status) {
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

  const getChargeStatusBadgeVariant = (status: Stripe.Charge.Status) => {
    switch(status) {
        case 'succeeded': return 'default';
        case 'pending': return 'secondary';
        case 'failed': return 'destructive';
        default: return 'outline';
    }
  }
  
  const stripeCustomer = stripeData?.customer;


  return (
    <div className="space-y-6">
       <div className="flex items-center text-sm text-muted-foreground">
        <Link href="/admin/customers" className="hover:text-primary">Customers</Link>
        <ChevronRight className="h-4 w-4 mx-1" />
        <span className="font-medium text-foreground">{customer.name}</span>
      </div>
      <div className="flex justify-between items-start">
        <div>
            <h1 className="text-2xl font-headline">{customer.name}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2"><Mail className="h-4 w-4"/><span>{customer.email}</span></div>
                {stripeCustomer?.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4"/><span>{stripeCustomer.phone}</span></div>}
                {stripeCustomer?.created && <div className="flex items-center gap-2"><Home className="h-4 w-4"/><span>Joined {formatDistanceToNow(new Date(stripeCustomer.created * 1000), { addSuffix: true })}</span></div>}
            </div>
        </div>
        <Button asChild>
           <a href={`https://dashboard.stripe.com/test/customers/${customer.id}`} target="_blank" rel="noopener noreferrer">
             <ExternalLink className="mr-2 h-4 w-4" />
             View in Stripe
            </a>
        </Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
            <CardHeader>
                <CardTitle>Active Subscriptions</CardTitle>
            </CardHeader>
            <CardContent>
                {isStripeLoading ? <Skeleton className="h-40 w-full" /> : (
                    stripeData && stripeData.subscriptions.length > 0 ? (
                            <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Plan</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Next Billing</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {stripeData.subscriptions.map(sub => {
                                    const product = sub.plan?.product;
                                    const productName = typeof product === 'string' ? product : product?.name;
                                    return (
                                        <TableRow key={sub.id}>
                                            <TableCell>{sub.items.data[0]?.price.nickname || productName || 'N/A'}</TableCell>
                                            <TableCell><Badge variant={getStripeStatusBadgeVariant(sub.status)} className="capitalize">{sub.status.replace(/_/g, ' ')}</Badge></TableCell>
                                            <TableCell>{format(new Date(sub.current_period_end * 1000), 'PPP')}</TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    ) : <p className="text-sm text-muted-foreground text-center py-4">No active subscriptions found in Stripe.</p>
                )}
            </CardContent>
        </Card>
        
        <Card>
            <CardHeader>
                <CardTitle>Transaction History</CardTitle>
            </CardHeader>
            <CardContent>
                {isStripeLoading ? <Skeleton className="h-40 w-full" /> : (
                    stripeData && stripeData.charges.length > 0 ? (
                            <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {stripeData.charges.map(charge => (
                                    <TableRow key={charge.id}>
                                        <TableCell>{format(new Date(charge.created * 1000), 'PPP')}</TableCell>
                                        <TableCell>${(charge.amount / 100).toFixed(2)}</TableCell>
                                        <TableCell><Badge variant={getChargeStatusBadgeVariant(charge.status)}>{charge.status}</Badge></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : <p className="text-sm text-muted-foreground text-center py-4">No transaction history found.</p>
                )}
            </CardContent>
        </Card>

      </div>
    </div>
  );

    