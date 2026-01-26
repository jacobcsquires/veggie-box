

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { collection, query, where, onSnapshot, getDocs, doc, updateDoc } from 'firebase/firestore';
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
import { Loader2, Pencil } from 'lucide-react';
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';


type PickupInternal = Omit<Pickup, 'boxId' | 'boxName'>;

export default function SubscriptionsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [scheduleRanges, setScheduleRanges] = useState<{[boxId: string]: {start: string, end: string} | null}>({});
  const [isManaging, setIsManaging] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);

  // State for the notes dialog
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [selectedSubForNote, setSelectedSubForNote] = useState<Subscription | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);


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
  
  const handleCancelActiveSubscription = async (sub: Subscription) => {
    setIsActionLoading(sub.id);
    try {
      const response = await fetch('/api/cancel-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId: sub.id }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to cancel subscription.');
      }

      toast({
        title: 'Success',
        description: 'Your subscription has been cancelled.',
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
  };

  const handleOpenNoteDialog = (sub: Subscription) => {
    setSelectedSubForNote(sub);
    setNoteContent(sub.notes || '');
    setIsNoteDialogOpen(true);
  };

  const handleSaveNote = async () => {
      if (!selectedSubForNote) return;
      setIsSavingNote(true);
      try {
          const subRef = doc(db, 'subscriptions', selectedSubForNote.id);
          await updateDoc(subRef, {
              notes: noteContent
          });
          toast({ title: 'Success', description: 'Your note has been saved.' });
          setIsNoteDialogOpen(false);
      } catch (error: any) {
          toast({ variant: 'destructive', title: 'Error', description: 'Could not save your note.' });
      } finally {
          setIsSavingNote(false);
      }
  };


  const renderSubscriptionActions = (sub: Subscription) => {
    const isLoadingThis = isActionLoading === sub.id;

    if (sub.status === 'Active') {
        return (
            <>
                <Button variant="outline" size="sm" onClick={() => handleOpenNoteDialog(sub)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Note
                </Button>
                <Button asChild variant="outline" size="sm">
                    <Link href={`/dashboard/schedule/${sub.boxId}`}>View Schedule</Link>
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleManageSubscription(sub.stripeCustomerId)} disabled={isManaging}>
                    {isManaging ? 'Redirecting...' : 'Manage'}
                </Button>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" disabled={isLoadingThis}>
                            {isLoadingThis ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                            Cancel
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will cancel your subscription for the {sub.boxName} at the end of your current billing period. This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Back</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleCancelActiveSubscription(sub)}>
                                Yes, cancel my subscription
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold md:text-2xl font-headline">
            My Subscriptions
          </h1>
          <p className="text-muted-foreground mb-4">
            Manage your active and view past subscriptions.
          </p>
        </div>
        <Button asChild>
            <Link href="/dashboard/boxes">Explore Veggie Boxes</Link>
        </Button>
      </div>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Veggie Box Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Schedule Dates</TableHead>
                <TableHead className="hidden sm:table-cell text-right">Price</TableHead>
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
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell className="hidden sm:table-cell text-right"><Skeleton className="h-5 w-12 ml-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-32 ml-auto" /></TableCell>
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
                    <TableCell className="hidden md:table-cell">
                        {scheduleRanges[sub.boxId] 
                            ? `${scheduleRanges[sub.boxId]?.start} - ${scheduleRanges[sub.boxId]?.end}`
                            : 'Schedule TBD'
                        }
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-right">
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

        <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add a note for {selectedSubForNote?.boxName}</DialogTitle>
                    <DialogDescription>
                        Add a note for the farmer. For example, any preferences or allergies.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Label htmlFor="note-content" className="sr-only">Note</Label>
                    <Textarea
                        id="note-content"
                        value={noteContent}
                        onChange={(e) => setNoteContent(e.target.value)}
                        placeholder="e.g. I'm allergic to tomatoes."
                    />
                </div>
                <DialogFooter>
                    <Button onClick={handleSaveNote} disabled={isSavingNote}>
                        {isSavingNote ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Save Note
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
  );
}
