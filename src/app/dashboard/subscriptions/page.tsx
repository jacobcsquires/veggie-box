

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { collection, query, where, onSnapshot, getDocs, doc, updateDoc, orderBy } from 'firebase/firestore';
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
import { format, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Pencil, CalendarX, Calendar as CalendarIcon, RefreshCw, MoreHorizontal } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';


type PickupInternal = Omit<Pickup, 'boxId' | 'boxName'>;

export default function SubscriptionsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [scheduleRanges, setScheduleRanges] = useState<{[boxId: string]: {start: string, end: string} | null}>({});
  const [isManaging, setIsManaging] = useState(false);

  // State for the notes dialog
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [selectedSubForNote, setSelectedSubForNote] = useState<Subscription | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);

  // State for skip pickup dialog
  const [isSkipDialogOpen, setIsSkipDialogOpen] = useState(false);
  const [subToSkip, setSubToSkip] = useState<Subscription | null>(null);
  const [isSkipping, setIsSkipping] = useState(false);
  const [upcomingPickups, setUpcomingPickups] = useState<PickupInternal[]>([]);
  const [isLoadingPickups, setIsLoadingPickups] = useState(false);

  // State for resuming subscription
  const [isResuming, setIsResuming] = useState(false);
  const [subToResume, setSubToResume] = useState<Subscription | null>(null);


  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const q = query(
      collection(db, 'subscriptions'),
      where('userId', '==', user.uid),
      where('status', 'in', ['Active', 'Pending', 'Past Due', 'Unpaid', 'Trialing', 'Unknown'])
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

    useEffect(() => {
        if (subToSkip && isSkipDialogOpen) {
            setIsLoadingPickups(true);
            const today = format(new Date(), 'yyyy-MM-dd');
            const pickupsRef = collection(db, 'boxes', subToSkip.boxId, 'pickups');
            const q = query(pickupsRef, where('pickupDate', '>=', today), orderBy('pickupDate'));

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const pickupsData = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as PickupInternal);
                setUpcomingPickups(pickupsData);
                setIsLoadingPickups(false);
            });

            return () => unsubscribe();
        }
    }, [subToSkip, isSkipDialogOpen]);
  
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

  const handleSkipClick = (sub: Subscription) => {
    setSubToSkip(sub);
    setIsSkipDialogOpen(true);
  };

  const confirmSkipPickup = async () => {
      if (!subToSkip) return;
      setIsSkipping(true);
      try {
          const response = await fetch('/api/skip-pickup', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ subscriptionId: subToSkip.id }),
          });
          if (!response.ok) {
              const error = await response.json();
              throw new Error(error.message || 'Failed to skip pickup.');
          }
          toast({ title: 'Success', description: 'Your next pickup has been skipped. Your subscription will resume automatically.' });
          setIsSkipDialogOpen(false);
      } catch (error: any) {
          toast({ variant: 'destructive', title: 'Error', description: error.message });
      } finally {
          setIsSkipping(false);
          setSubToSkip(null);
      }
  };

    const handleResumeSubscription = async (sub: Subscription) => {
        setSubToResume(sub);
        setIsResuming(true);
        try {
            const response = await fetch('/api/resume-subscription', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscriptionId: sub.id }),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to resume subscription.');
            }
            toast({ title: 'Success', description: 'Your subscription has been resumed.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsResuming(false);
            setSubToResume(null);
        }
    };


  const renderSubscriptionActions = (sub: Subscription) => {
    if (sub.status === 'Active' || sub.status === 'Trialing') {
        const hasActiveSkip = sub.trialEnd && sub.trialEnd > (Date.now() / 1000);
        return (
            <div className="flex items-center justify-end space-x-2">
                {hasActiveSkip ? (
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleResumeSubscription(sub)} 
                        disabled={isResuming && subToResume?.id === sub.id}
                    >
                        {isResuming && subToResume?.id === sub.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Resume
                    </Button>
                ) : (
                    <Button variant="outline" size="sm" onClick={() => handleSkipClick(sub)}>
                        <CalendarX className="mr-2 h-4 w-4" />
                        Skip
                    </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => handleManageSubscription(sub.stripeCustomerId)} disabled={isManaging}>
                    {isManaging ? 'Redirecting...' : 'Update Billing'}
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">More actions</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleOpenNoteDialog(sub)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            <span>Add/Edit Note</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <Link href={`/dashboard/schedule/${sub.boxId}`}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                <span>View Schedule</span>
                            </Link>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        )
    }
    return null;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold md:text-2xl font-headline">
            Manage Subscriptions
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
            {/* Mobile View */}
            <div className="md:hidden">
              {isLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <Card key={i} className="p-4 space-y-3">
                       <div className="flex justify-between items-start">
                          <div className="space-y-2">
                              <Skeleton className="h-5 w-32" />
                              <Skeleton className="h-6 w-20 rounded-full" />
                          </div>
                          <Skeleton className="h-6 w-16" />
                       </div>
                       <Separator />
                        <Skeleton className="h-4 w-48" />
                       <div className="flex items-center justify-end space-x-2 pt-2">
                          <Skeleton className="h-9 w-24 rounded-md" />
                          <Skeleton className="h-9 w-24 rounded-md" />
                       </div>
                    </Card>
                  ))}
                </div>
              ) : subscriptions.length === 0 ? (
                 <div className="h-24 text-center flex items-center justify-center">
                    <p className="text-muted-foreground">You have no subscriptions yet.</p>
                 </div>
              ) : (
                <div className="space-y-4">
                  {subscriptions.map((sub) => (
                    <Card key={sub.id} className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="space-y-1">
                          <p className="font-medium">{sub.boxName}</p>
                           <Badge
                            variant={
                              sub.status === 'Active' ? 'default'
                              : (sub.status === 'Pending' || sub.status === 'Trialing') ? 'secondary'
                              : 'outline'
                            }
                          >
                            {sub.status === 'Trialing' ? 'Skipped' : sub.status}
                          </Badge>
                        </div>
                        <p className="font-bold text-lg">${sub.price.toFixed(2)}</p>
                      </div>

                      <Separator className="my-3" />
                      
                      <div className="text-sm text-muted-foreground mb-4">
                        <strong>Schedule: </strong> 
                        {scheduleRanges[sub.boxId] 
                            ? `${scheduleRanges[sub.boxId]?.start} - ${scheduleRanges[sub.boxId]?.end}`
                            : 'Schedule TBD'
                        }
                      </div>

                      <div className="flex justify-end">
                          {renderSubscriptionActions(sub)}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
            
            {/* Desktop View */}
            <div className="hidden md:block">
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
                            variant={
                              sub.status === 'Active' ? 'default'
                              : (sub.status === 'Pending' || sub.status === 'Trialing') ? 'secondary'
                              : 'outline'
                            }
                          >
                            {sub.status === 'Trialing' ? 'Skipped' : sub.status}
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
                        <TableCell className="text-right">
                            {renderSubscriptionActions(sub)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
        </CardContent>
      </Card>

        <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add a note for {selectedSubForNote?.boxName}</DialogTitle>
                    <DialogDescription>
                        Add a note regarding this subscription's pickups.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Label htmlFor="note-content" className="sr-only">Note</Label>
                    <Textarea
                        id="note-content"
                        value={noteContent}
                        onChange={(e) => setNoteContent(e.target.value)}
                        placeholder=""
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

        <Dialog open={isSkipDialogOpen} onOpenChange={setIsSkipDialogOpen}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Skip Next Pickup for {subToSkip?.boxName}</DialogTitle>
                  <DialogDescription>
                      This will pause your subscription for one billing cycle. You won't be charged, and it will resume automatically. Below is your upcoming schedule for this plan.
                  </DialogDescription>
              </DialogHeader>
               <div className="space-y-4">
                    <h3 className="font-semibold text-sm mb-2">Upcoming Pickup Dates</h3>
                    {isLoadingPickups ? (
                        <div className="flex items-center justify-center h-24">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : upcomingPickups.length > 0 ? (
                        <ScrollArea className="h-40 rounded-md border">
                            <div className="p-4 text-sm">
                            {upcomingPickups.map(pickup => (
                                <div key={pickup.id} className="mb-2 flex items-center gap-3">
                                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                    <p className="font-medium">{format(parseISO(pickup.pickupDate), 'PPP')}</p>
                                </div>
                            ))}
                            </div>
                        </ScrollArea>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-24 text-center p-4 rounded-md border">
                            <CalendarX className="h-8 w-8 text-muted-foreground mb-2" />
                            <p className="text-sm text-muted-foreground">No upcoming pickups scheduled.</p>
                        </div>
                    )}
               </div>
              <DialogFooter>
                  <Button variant="outline" onClick={() => setIsSkipDialogOpen(false)}>Cancel</Button>
                  <Button onClick={confirmSkipPickup} disabled={isSkipping || isLoadingPickups || upcomingPickups.length === 0}>
                      {isSkipping ? 'Processing...' : 'Yes, Skip Next Pickup'}
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
}

