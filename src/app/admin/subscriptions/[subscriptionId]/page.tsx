
'use client';

import { useState, useEffect } from 'react';
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
import { Loader2 } from 'lucide-react';

export default function SubscriptionDetailPage() {
  const params = useParams();
  const subscriptionId = params.subscriptionId as string;
  const router = useRouter();
  const { toast } = useToast();

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [status, setStatus] = useState<Subscription['status']>('Pending');
  
  useEffect(() => {
    if (!subscriptionId) return;

    const subRef = doc(db, 'subscriptions', subscriptionId);
    const unsubscribe = onSnapshot(subRef, (docSnap) => {
      if (docSnap.exists()) {
        const subData = { id: docSnap.id, ...docSnap.data() } as Subscription;
        setSubscription(subData);
        setStatus(subData.status);
      } else {
        toast({ variant: 'destructive', title: 'Error', description: 'Subscription not found.' });
        router.push('/admin/subscriptions');
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [subscriptionId, router, toast]);

  const handleSaveChanges = async () => {
    if (!subscription) return;
    setIsSaving(true);
    try {
      const subRef = doc(db, 'subscriptions', subscriptionId);
      await updateDoc(subRef, { status });
      toast({ title: 'Success', description: 'Subscription updated successfully.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-headline">Subscription Details</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Manage Subscription</CardTitle>
          <CardDescription>View and edit the details for this subscription.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Customer</Label>
              <p className="text-sm font-medium">{subscription.customerName}</p>
            </div>
            <div>
              <Label>Box</Label>
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
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
             <Select value={status} onValueChange={(value) => setStatus(value as any)} disabled={isSaving}>
                <SelectTrigger id="status">
                    <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                    <SelectItem value="Past Due">Past Due</SelectItem>
                </SelectContent>
            </Select>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSaveChanges} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
