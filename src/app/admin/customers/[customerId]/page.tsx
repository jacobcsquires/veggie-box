
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { doc, onSnapshot, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Customer, Box, Subscription, PricingOption } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { format, formatDistanceToNow } from 'date-fns';
import { ExternalLink, Home, Mail, ChevronRight, Phone, RefreshCw, PlusCircle, Copy, Check } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type Stripe from 'stripe';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

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
  const [boxes, setBoxes] = useState<Box[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isStripeLoading, setIsStripeLoading] = useState(true);

  // State for manual subscription dialog
  const [isSubDialogOpen, setIsSubDialogOpen] = useState(false);
  const [isCreatingSub, setIsCreatingSub] = useState(false);
  const [selectedBoxId, setSelectedBoxId] = useState('');
  const [selectedPriceId, setSelectedPriceId] = useState('');
  const [checkoutUrl, setCheckoutUrl] = useState('');
  const [hasCopied, setHasCopied] = useState(false);


  useEffect(() => {
    if (!customerId) return;

    const custRef = doc(db, 'customers', customerId);
    const unsubscribeCustomer = onSnapshot(custRef, (docSnap) => {
      if (docSnap.exists()) {
        const subData = { id: docSnap.id, ...docSnap.data() } as Customer;
        setCustomer(subData);
      } else {
        toast({ variant: 'destructive', title: 'Error', description: 'Customer not found.' });
      }
      setIsLoading(false);
    });

     const unsubscribeBoxes = onSnapshot(collection(db, 'boxes'), (snapshot) => {
        const boxesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Box));
        setBoxes(boxesData);
    });


    return () => {
        unsubscribeCustomer();
        unsubscribeBoxes();
    }
  }, [customerId, toast]);

  const fetchStripeData = useCallback(async () => {
        if (!customer) return;
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
            toast({ title: "Sync Complete", description: "Customer data has been refreshed from Stripe."})
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Stripe Error', description: error.message });
        } finally {
            setIsStripeLoading(false);
        }
    }, [customer, toast]);

  useEffect(() => {
    if (customer) {
        fetchStripeData();
    }
  }, [customer, fetchStripeData]);

  const handleCreateSubscription = async () => {
    if (!customer || !selectedBoxId || !selectedPriceId) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please select a plan and a pricing option.'});
        return;
    }
    setIsCreatingSub(true);
    const box = boxes.find(b => b.id === selectedBoxId);
    const price = box?.pricingOptions.find(p => p.id === selectedPriceId);
    
    if (!box || !price) {
         toast({ variant: 'destructive', title: 'Error', description: 'Could not find selected plan or price.'});
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
        setSelectedBoxId('');
        setSelectedPriceId('');
    }

    const selectedBoxOptions = useMemo(() => {
        return boxes.find(b => b.id === selectedBoxId)?.pricingOptions || [];
    }, [selectedBoxId, boxes]);


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
         <div className="flex items-center gap-2">
            <Button onClick={fetchStripeData} disabled={isStripeLoading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isStripeLoading ? 'animate-spin' : ''}`} />
                Sync with Stripe
            </Button>
            <Button asChild>
                <a href={`https://dashboard.stripe.com/test/customers/${customer.id}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View in Stripe
                </a>
            </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Active Subscriptions</CardTitle>
                 <Dialog open={isSubDialogOpen} onOpenChange={(isOpen) => { if(!isOpen) resetSubDialog(); else setIsSubDialogOpen(true); }}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
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
                                    : `Select a plan for ${customer.name} to generate a Stripe checkout link.`
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
                                            <TableCell>{sub.current_period_end ? format(new Date(sub.current_period_end * 1000), 'PPP') : 'N/A'}</TableCell>
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
                <CardTitle>Payment History</CardTitle>
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
                                    <TableHead className="text-right">Receipt</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {stripeData.charges.map(charge => (
                                    <TableRow key={charge.id}>
                                        <TableCell>{format(new Date(charge.created * 1000), 'PPP')}</TableCell>
                                        <TableCell>${(charge.amount / 100).toFixed(2)}</TableCell>
                                        <TableCell><Badge variant={getChargeStatusBadgeVariant(charge.status)}>{charge.status}</Badge></TableCell>
                                        <TableCell className="text-right">
                                            {charge.receipt_url &&
                                                <Button variant="ghost" size="icon" asChild>
                                                    <a href={charge.receipt_url} target="_blank" rel="noopener noreferrer">
                                                        <ExternalLink className="h-4 w-4" />
                                                    </a>
                                                </Button>
                                            }
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
    </div>
  );
}

    

    