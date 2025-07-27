
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Subscription, Pickup } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';


type PickupInternal = Omit<Pickup, 'boxId' | 'boxName'>;

export default function SubscriptionsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [scheduleRanges, setScheduleRanges] = useState<{[boxId: string]: {start: string, end: string} | null}>({});
  const [isManaging, setIsManaging] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const q = query(
      collection(db, 'subscriptions'),
      where('userId', '==', user.uid)
    );

    const unsubscribeSubs = onSnapshot(q, async (snapshot) => {
      const subsData = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Subscription)
      ).sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());

      setSubscriptions(subsData);

      if (subsData.length > 0) {
        const ranges: {[boxId: string]: {start: string, end: string} | null} = {};
        for (const sub of subsData) {
          const pickupsRef = collection(db, 'boxes', sub.boxId, 'pickups');
          const pickupsSnapshot = await getDocs(pickupsRef);
          const relevantPickups = pickupsSnapshot.docs
            .map(doc => doc.data() as PickupInternal)
            .sort((a, b) => new Date(a.pickupDate).getTime() - new Date(b.pickupDate).getTime());
          
          if (relevantPickups.length > 0) {
            const startDate = format(new Date(relevantPickups[0].pickupDate.replace(/-/g, '\/')), 'PPP');
            const endDate = format(new Date(relevantPickups[relevantPickups.length - 1].pickupDate.replace(/-/g, '\/')), 'PPP');
            ranges[sub.boxId] = { start: startDate, end: endDate };
          } else {
            ranges[sub.boxId] = null;
          }
        }
        setScheduleRanges(ranges);
      }
      setIsLoading(false);
    });

    return () => {
        unsubscribeSubs();
    };
  }, [user, toast]);
  
  const handleManageSubscription = async (customerId?: string) => {
    if (!customerId) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Stripe Customer ID not found for this subscription.'
        });
        return;
    }
    setIsManaging(true);
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
        window.location.href = url;
    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Could not redirect to Stripe. Please try again later.'
        });
    } finally {
        setIsManaging(false);
    }
  };

   const handleCompletePayment = async (sub: Subscription) => {
    if (!user) return;
    setIsActionLoading(sub.id);
    try {
        // This is a simplified retry. A more robust implementation might re-verify box availability.
        const response = await fetch('/api/checkout_sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                boxId: sub.boxId,
                userId: user.uid,
                customerName: user.displayName,
                email: user.email,
                startDate: sub.startDate,
                subscriptionId: sub.id, // Pass existing subscription ID to reuse it
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to create checkout session');
        }

        const { url } = await response.json();
        window.location.href = url;

    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: error.message,
        });
    } finally {
        setIsActionLoading(null);
    }
  };

  const handleCancelPending = async (sub: Subscription) => {
    setIsActionLoading(sub.id);
    try {
        const response = await fetch('/api/cancel-pending-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscriptionId: sub.id, boxId: sub.boxId }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to cancel subscription.');
        }
        
        toast({
            title: 'Success',
            description: 'Your pending subscription has been cancelled.',
        });

    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: error.message,
        });
    } finally {
        setIsActionLoading(null);
    }
  }


  const renderSubscriptionActions = (sub: Subscription) => {
    const isLoadingThis = isActionLoading === sub.id;

    if (sub.status === 'Active') {
        return (
            <>
                <Button asChild variant="outline" size="sm">
                    <Link href={`/dashboard/schedule/${sub.boxId}`}>View Schedule</Link>
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleManageSubscription(sub.stripeCustomerId)} disabled={isManaging}>
                    {isManaging ? 'Redirecting...' : 'Manage'}
                </Button>
            </>
        )
    }
    if (sub.status === 'Pending') {
        return (
             <>
                <Button variant="default" size="sm" onClick={() => handleCompletePayment(sub)} disabled={isLoadingThis}>
                    {isLoadingThis ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                    Complete Payment
                </Button>
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" disabled={isLoadingThis}>
                            Cancel
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will cancel your pending subscription for the {sub.boxName}. This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Back</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleCancelPending(sub)}>
                                Yes, cancel
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </>
        )
    }
    return null;
  }

  return (
    <div>
      <h1 className="text-lg font-semibold md:text-2xl font-headline mb-4">
        My Subscriptions
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>Your Subscription History</CardTitle>
          <CardDescription>
            Manage your active and view past subscriptions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Box Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Schedule Dates</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">
                    Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-12 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-32 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : subscriptions.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                        You have no subscriptions yet.
                    </TableCell>
                </TableRow>
              ) : (
                subscriptions.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium">{sub.boxName}</TableCell>
                    <TableCell>
                      <Badge
                        variant={sub.status === 'Active' ? 'default' : sub.status === 'Pending' ? 'secondary' : 'outline'}
                      >
                        {sub.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                        {scheduleRanges[sub.boxId] 
                            ? `${scheduleRanges[sub.boxId]?.start} - ${scheduleRanges[sub.boxId]?.end}`
                            : 'Schedule TBD'
                        }
                    </TableCell>
                    <TableCell className="text-right">
                      ${sub.price.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                        {renderSubscriptionActions(sub)}
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
