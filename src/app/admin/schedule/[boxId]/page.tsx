
'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc, collection, onSnapshot, setDoc, query, where, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import type { Box, Pickup } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';

export default function AdminSchedulePage({ params }: { params: { boxId: string } }) {
  const { toast } = useToast();
  const { boxId } = params;

  const [box, setBox] = useState<Box | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [pickupNote, setPickupNote] = useState('');
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!boxId) return;

    // Fetch box details once
    const boxRef = doc(db, 'boxes', boxId);
    getDoc(boxRef).then((docSnap) => {
      if (docSnap.exists()) {
        const boxData = { id: docSnap.id, ...docSnap.data() } as Box;
        setBox(boxData);
      }
      setIsLoading(false);
    });

    // Listen for real-time pickup updates from Firestore
    const pickupsQuery = query(collection(db, 'pickups'), where('boxId', '==', boxId));
    const unsubscribe = onSnapshot(pickupsQuery, (snapshot) => {
      const pickupsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pickup));
      setPickups(pickupsData);
      console.log('Fetched schedule data from Firestore:', pickupsData);
    });

    return () => unsubscribe();
  }, [boxId]);

  // This effect runs when the user selects a new date or when the pickups data from Firestore changes.
  useEffect(() => {
    if (selectedDate) {
      const dateString = format(selectedDate, 'yyyy-MM-dd');
      const pickupForDate = pickups.find(d => d.pickupDate === dateString);
      setPickupNote(pickupForDate?.note || '');
    } else {
      setPickupNote('');
    }
  }, [selectedDate, pickups]);


  // This function handles all interactions with Firestore for saving or deleting pickup data.
  const handleSavePickup = async () => {
    if (!selectedDate) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please select a date.' });
        return;
    }
    
    setIsSaving(true);
    const dateString = format(selectedDate, 'yyyy-MM-dd');
    // Use a consistent ID for the document to easily find and update it later.
    const docId = `${boxId}_${dateString}`;
    const pickupRef = doc(db, 'pickups', docId);

    try {
        if (pickupNote.trim()) {
            const pickupData: Pickup = {
                id: docId,
                boxId,
                boxName: box?.name || '',
                pickupDate: dateString,
                note: pickupNote,
            };
            await setDoc(pickupRef, pickupData, { merge: true });
            toast({ title: 'Success', description: `Pickup note for ${dateString} saved to Firestore.` });
        } else {
            const docSnap = await getDoc(pickupRef);
            if (docSnap.exists()) {
                await deleteDoc(pickupRef);
                toast({ title: 'Success', description: `Pickup for ${dateString} cleared from Firestore.` });
            }
        }
    } catch (error) {
        console.error("Error saving pickup to Firestore: ", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not save pickup to Firestore.' });
    } finally {
        setIsSaving(false);
    }
  };
  
  const pickupDates = pickups.map(d => new Date(d.pickupDate.replace(/-/g, '\/')));

  if (isLoading) {
    return (
        <div>
            <Skeleton className="h-8 w-64 mb-4" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                    <Card>
                        <CardHeader>
                            <Skeleton className="h-6 w-48" />
                            <Skeleton className="h-4 w-full mt-2" />
                        </CardHeader>
                        <CardContent>
                             <Skeleton className="w-full h-80 rounded-md border" />
                        </CardContent>
                    </Card>
                </div>
                <div>
                     <Card>
                        <CardHeader>
                            <Skeleton className="h-6 w-40" />
                            <Skeleton className="h-4 w-32 mt-2" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-24 w-full" />
                            <Skeleton className="h-10 w-full mt-4" />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
  }

  if (!box) {
    return <div>Box not found.</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-headline mb-4">Manage Schedule for {box.name}</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
                <CardTitle>Pick Up Calendar</CardTitle>
                <CardDescription>Select a date to plan the note for that pick up. Dates with scheduled pickups are highlighted.</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                modifiers={{ scheduled: pickupDates }}
                modifiersClassNames={{ scheduled: 'bg-primary/20' }}
                className="rounded-md border"
              />
            </CardContent>
          </Card>
        </div>
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Note for {selectedDate ? format(selectedDate, 'PPP') : '...'}</CardTitle>
              <CardDescription>Describe what's in the box for the selected date.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                 <div className="space-y-2">
                    <Label htmlFor="pickup-note">Weekly Box Note</Label>
                    <Textarea 
                        id="pickup-note"
                        placeholder="e.g. This week's box includes fresh carrots, kale, and a special surprise from the farm!"
                        value={pickupNote}
                        onChange={(e) => setPickupNote(e.target.value)}
                        rows={5}
                        disabled={isSaving}
                    />
                </div>
                 <Button onClick={handleSavePickup} disabled={isSaving || !selectedDate} className="w-full">
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isSaving ? 'Saving to Firestore...' : 'Save Pick Up Plan'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
