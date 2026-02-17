'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { collection, onSnapshot, getDocs, doc, runTransaction, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import type { Box } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';

type WaitlistedBox = Box & { joinedAt: Date };

export default function WaitlistPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [waitlistedBoxes, setWaitlistedBoxes] = useState<WaitlistedBox[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [boxToRemove, setBoxToRemove] = useState<WaitlistedBox | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
        router.push('/login');
        return;
    }

    setIsLoading(true);

    const boxesRef = collection(db, 'boxes');
    const unsubscribe = onSnapshot(boxesRef, async (snapshot) => {
        const boxesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Box));
        
        const waitlistChecks = boxesData.map(async (box) => {
            const waitlistRef = doc(db, 'boxes', box.id, 'waitlist', user.uid);
            const waitlistSnap = await getDoc(waitlistRef);
            if (waitlistSnap.exists()) {
                return { ...box, joinedAt: waitlistSnap.data().joinedAt.toDate() };
            }
            return null;
        });

        const results = await Promise.all(waitlistChecks);
        const userWaitlistedBoxes = results.filter((b): b is WaitlistedBox => b !== null);
        
        userWaitlistedBoxes.sort((a, b) => b.joinedAt.getTime() - a.joinedAt.getTime());

        setWaitlistedBoxes(userWaitlistedBoxes);
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, authLoading, router]);

  const handleLeaveWaitlistClick = (box: WaitlistedBox) => {
    setBoxToRemove(box);
  };

  const confirmLeaveWaitlist = async () => {
    if (!boxToRemove || !user) return;

    setIsLeaving(true);
    const boxRef = doc(db, 'boxes', boxToRemove.id);
    const waitlistRef = doc(db, 'boxes', boxToRemove.id, 'waitlist', user.uid);
    
    try {
        await runTransaction(db, async (transaction) => {
            const waitlistDoc = await transaction.get(waitlistRef);
            if (!waitlistDoc.exists()) {
                // Already removed, do nothing.
                return;
            }

            transaction.delete(waitlistRef);

            const boxDoc = await transaction.get(boxRef);
            if (boxDoc.exists()) {
                const boxData = boxDoc.data() as Box;
                const newWaitlistCount = Math.max(0, (boxData.waitlistCount || 0) - 1);
                transaction.update(boxRef, { waitlistCount: newWaitlistCount });
            }
        });
        toast({ title: 'Success', description: `You have been removed from the waitlist for ${boxToRemove.name}.` });
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message || 'Could not leave the waitlist.' });
    } finally {
        setIsLeaving(false);
        setBoxToRemove(null);
    }
  };

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-lg font-semibold md:text-2xl font-headline">
          Your Waitlists
        </h1>
        <p className="text-muted-foreground text-sm">
          Here are the Veggie Box Plans you are currently on the waitlist for.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-48 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : waitlistedBoxes.length === 0 ? (
         <Card>
            <CardContent className="p-10 text-center text-muted-foreground">
                You are not on any waitlists.
            </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {waitlistedBoxes.map(box => (
                <Card key={box.id} className="flex flex-col">
                    <CardHeader className="p-0">
                        <Image
                            src={box.image}
                            alt={box.name}
                            width={600}
                            height={400}
                            data-ai-hint={box.hint}
                            className="rounded-t-lg aspect-video object-cover"
                        />
                    </CardHeader>
                    <CardContent className="p-6 flex-1">
                        <CardTitle className="font-headline">{box.name}</CardTitle>
                        <CardDescription className="mt-2 text-xs">Joined {formatDistanceToNow(box.joinedAt, { addSuffix: true })}</CardDescription>
                    </CardContent>
                    <CardFooter className="p-6 pt-0">
                         <Button variant="outline" className="w-full" onClick={() => handleLeaveWaitlistClick(box)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Leave Waitlist
                        </Button>
                    </CardFooter>
                </Card>
            ))}
        </div>
      )}

      <AlertDialog open={!!boxToRemove} onOpenChange={(open) => !open && setBoxToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove you from the waitlist for the "{boxToRemove?.name}". You will lose your spot. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLeaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLeaveWaitlist} disabled={isLeaving} className="bg-destructive hover:bg-destructive/90">
              {isLeaving ? 'Leaving...' : 'Yes, Leave Waitlist'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
