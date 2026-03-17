'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { collection, onSnapshot, query, where, orderBy, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Subscription, Pickup } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ShoppingCart, ArrowRight, Calendar, Pencil, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export default function DashboardPage() {
    const { user, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [upcomingPickups, setUpcomingPickups] = useState<Pickup[]>([]);
    const [isLoading, setIsLoading] = useState(true);

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

        // Query by userId only and filter status in memory to avoid composite index requirement
        const subsQuery = query(collection(db, 'subscriptions'), where('userId', '==', user.uid));
        
        const unsubSubs = onSnapshot(subsQuery, async (snapshot) => {
            setIsLoading(true);
            const statusFilter = ['Active', 'Pending', 'Past Due', 'Unpaid', 'Trialing', 'Unknown'];
            const subsData = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as Subscription))
                .filter(sub => statusFilter.includes(sub.status));
                
            setSubscriptions(subsData);
            
            const activeSubs = subsData.filter(s => ['Active', 'Trialing'].includes(s.status));
            if (activeSubs.length > 0) {
                const today = format(new Date(), 'yyyy-MM-dd');
                let allPickups: Pickup[] = [];

                for (const sub of activeSubs) {
                    const pickupsRef = collection(db, 'boxes', sub.boxId, 'pickups');
                    const q = query(pickupsRef, where('pickupDate', '>=', today), orderBy('pickupDate'));
                    const pickupsSnapshot = await getDocs(q);

                    const subPickups: Pickup[] = pickupsSnapshot.docs.map(doc => {
                        const data = doc.data();
                        return {
                            id: doc.id,
                            pickupDate: data.pickupDate,
                            note: data.note,
                            boxId: sub.boxId,
                            boxName: sub.boxName
                        };
                    });
                    allPickups.push(...subPickups);
                }

                const sortedAndLimitedPickups = allPickups
                    .sort((a, b) => new Date(a.pickupDate.replace(/-/g, '/')).getTime() - new Date(b.pickupDate.replace(/-/g, '/')).getTime())
                    .slice(0, 5);
                
                setUpcomingPickups(sortedAndLimitedPickups);
            } else {
                setUpcomingPickups([]);
            }
            
            setIsLoading(false);
        });

        return () => {
            unsubSubs();
        };
    }, [user]);

    const handleOpenNoteDialog = (pickup: Pickup) => {
        const sub = subscriptions.find(s => s.boxId === pickup.boxId);
        if (sub) {
            setSelectedSubForNote(sub);
            setNoteContent(sub.notes || '');
            setIsNoteDialogOpen(true);
        }
    };

    const handleSaveNote = async () => {
        if (!selectedSubForNote) return;
        setIsSavingNote(true);
        try {
            const subRef = doc(db, 'subscriptions', selectedSubForNote.id);
            await updateDoc(subRef, {
                notes: noteContent
            });
            toast({ title: 'Success', description: 'Your delivery note has been saved.' });
            setIsNoteDialogOpen(false);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not save your note.' });
        } finally {
            setIsSavingNote(false);
        }
    };

    const stats = {
        totalSubscriptions: subscriptions.length,
    };
    
    if (authLoading || isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-64"/>
                <div className="grid gap-4">
                    <Skeleton className="h-28"/>
                </div>
                 <div className="grid gap-6">
                    <Skeleton className="h-64"/>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-headline">Welcome, {user?.displayName || 'Veggie Lover'}!</h1>
                <Button asChild variant="outline">
                    <Link href="/dashboard/subscriptions">Manage Subscriptions <ArrowRight className="ml-2 h-4 w-4"/></Link>
                </Button>
            </div>

            {/* Stat Cards */}
            <div className="grid gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Your Subscriptions</CardTitle>
                        <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalSubscriptions}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6">
                 {/* Upcoming Pickups */}
                <Card>
                    <CardHeader>
                        <CardTitle>Upcoming Pickups</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {upcomingPickups.length > 0 ? upcomingPickups.map(pickup => (
                                <div key={pickup.id} className="flex items-center flex-wrap gap-4">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                                        <Calendar className="h-5 w-5 text-primary" />
                                    </div>
                                    <div className="flex-1 space-y-1 min-w-[200px]">
                                        <p className="text-sm font-medium leading-none">{pickup.boxName}</p>
                                        <p className="text-sm text-muted-foreground">{format(new Date(pickup.pickupDate.replace(/-/g, '/')), 'PPPP')}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button variant="outline" size="sm" onClick={() => handleOpenNoteDialog(pickup)}>
                                            <Pencil className="mr-2 h-4 w-4" />
                                            Add Note
                                        </Button>
                                        <Button asChild variant="ghost" size="sm">
                                            <Link href={`/dashboard/schedule/${pickup.boxId}`}>View</Link>
                                        </Button>
                                    </div>
                                </div>
                            )) : <p className="text-sm text-muted-foreground text-center py-10">No upcoming pickups scheduled.</p>}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delivery Note for {selectedSubForNote?.boxName}</DialogTitle>
                        <DialogDescription>
                            Add instructions for your pickup (e.g. "Leave on the porch", "Side gate is open").
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label htmlFor="dashboard-note-content" className="sr-only">Note</Label>
                        <Textarea
                            id="dashboard-note-content"
                            value={noteContent}
                            onChange={(e) => setNoteContent(e.target.value)}
                            placeholder="Type your instructions here..."
                            rows={4}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsNoteDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveNote} disabled={isSavingNote}>
                            {isSavingNote ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Save Instructions
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
