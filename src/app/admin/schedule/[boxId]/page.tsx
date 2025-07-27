
'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc, collection, onSnapshot, setDoc, query, where, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Calendar as CalendarIcon, Bot, Trash2 } from 'lucide-react';
import type { Box, Pickup } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { format, addDays } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';


export default function AdminSchedulePage({ params }: { params: { boxId: string } }) {
  const { toast } = useToast();
  const boxId = params.boxId;

  const [box, setBox] = useState<Box | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [pickupNote, setPickupNote] = useState('');
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // State for the generation dialog
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateStartDate, setGenerateStartDate] = useState<Date | undefined>();
  const [generateEndDate, setGenerateEndDate] = useState<Date | undefined>();
  const [generateFrequency, setGenerateFrequency] = useState('weekly');
  const [generateNote, setGenerateNote] = useState('');

  // State for delete confirmation dialog
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [pickupToDelete, setPickupToDelete] = useState<Pickup | null>(null);

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
      // Sort pickups by date
      pickupsData.sort((a, b) => new Date(a.pickupDate).getTime() - new Date(b.pickupDate).getTime());
      setPickups(pickupsData);
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

  const handleGenerateSchedule = async () => {
    if (!generateStartDate || !generateEndDate || !generateNote || !box) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please fill out all fields to generate the schedule.' });
        return;
    }

    if (generateEndDate < generateStartDate) {
        toast({ variant: 'destructive', title: 'Error', description: 'End date cannot be before the start date.' });
        return;
    }

    setIsGenerating(true);
    const batch = writeBatch(db);
    const daysIncrement = generateFrequency === 'weekly' ? 7 : 14;
    let currentDate = generateStartDate;

    while (currentDate <= generateEndDate) {
        const dateString = format(currentDate, 'yyyy-MM-dd');
        const docId = `${boxId}_${dateString}`;
        const pickupRef = doc(db, 'pickups', docId);

        const pickupData: Pickup = {
            id: docId,
            boxId,
            boxName: box.name,
            pickupDate: dateString,
            note: generateNote,
        };
        batch.set(pickupRef, pickupData);
        currentDate = addDays(currentDate, daysIncrement);
    }

    try {
        await batch.commit();
        toast({ title: 'Success', description: 'Schedule generated successfully.' });
        setIsGenerateDialogOpen(false);
        setGenerateStartDate(undefined);
        setGenerateEndDate(undefined);
        setGenerateNote('');
    } catch (error) {
        console.error("Error generating schedule:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not generate the schedule.' });
    } finally {
        setIsGenerating(false);
    }
  };

  const handleDeleteClick = (pickup: Pickup) => {
    setPickupToDelete(pickup);
    setIsDeleteDialogOpen(true);
  };
  
  const confirmDeletePickup = async () => {
      if (!pickupToDelete) return;
      try {
          await deleteDoc(doc(db, 'pickups', pickupToDelete.id));
          toast({
              title: 'Success',
              description: `Pickup for ${pickupToDelete.pickupDate} has been deleted.`,
          });
      } catch (error) {
          console.error('Error deleting pickup: ', error);
          toast({
              variant: 'destructive',
              title: 'Error',
              description: 'Could not delete the pickup. Please try again.',
          });
      } finally {
          setIsDeleteDialogOpen(false);
          setPickupToDelete(null);
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
        <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-headline">Manage Schedule for {box.name}</h1>
            <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
                <DialogTrigger asChild>
                    <Button>
                        <Bot className="mr-2 h-4 w-4" />
                        Generate Schedule
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Generate Recurring Schedule</DialogTitle>
                        <DialogDescription>
                            Automatically create pickup dates for this box.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="start-date" className="text-right">Start Date</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                    "col-span-3 justify-start text-left font-normal",
                                    !generateStartDate && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {generateStartDate ? format(generateStartDate, "PPP") : <span>Pick a date</span>}
                                </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                <Calendar
                                    mode="single"
                                    selected={generateStartDate}
                                    onSelect={setGenerateStartDate}
                                    initialFocus
                                />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="end-date" className="text-right">End Date</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                    "col-span-3 justify-start text-left font-normal",
                                    !generateEndDate && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {generateEndDate ? format(generateEndDate, "PPP") : <span>Pick a date</span>}
                                </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                <Calendar
                                    mode="single"
                                    selected={generateEndDate}
                                    onSelect={setGenerateEndDate}
                                    disabled={(date) =>
                                        generateStartDate ? date < generateStartDate : false
                                    }
                                    initialFocus
                                />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                             <Label htmlFor="frequency" className="text-right">Frequency</Label>
                             <Select value={generateFrequency} onValueChange={setGenerateFrequency}>
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Select frequency" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="weekly">Weekly</SelectItem>
                                    <SelectItem value="bi-weekly">Bi-weekly (every 2 weeks)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="note" className="text-right">Note</Label>
                            <Textarea 
                                id="note"
                                value={generateNote}
                                onChange={(e) => setGenerateNote(e.target.value)}
                                className="col-span-3"
                                placeholder="e.g. This week's box includes..."
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" onClick={handleGenerateSchedule} disabled={isGenerating}>
                            {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isGenerating ? 'Generating...' : 'Generate'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            <div className="md:col-span-2 space-y-6">
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
                <Card>
                    <CardHeader>
                        <CardTitle>Scheduled Pickups</CardTitle>
                        <CardDescription>A list of all upcoming pickup dates for this box.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Note</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pickups.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center h-24">No pickups scheduled yet.</TableCell>
                                    </TableRow>
                                ) : (
                                    pickups.map(pickup => (
                                        <TableRow key={pickup.id}>
                                            <TableCell>{format(new Date(pickup.pickupDate.replace(/-/g, '\/')), 'PPP')}</TableCell>
                                            <TableCell className="max-w-[300px] truncate">{pickup.note}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(pickup)}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                    <span className="sr-only">Delete</span>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
            <div>
            <Card>
                <CardHeader>
                <CardTitle>Note for {selectedDate ? format(selectedDate, 'PPP') : '...'}</CardTitle>
                <CardDescription>Describe what's in the box for the selected date. Clear the note to remove the pickup.</CardDescription>
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
                        {isSaving ? 'Saving...' : 'Save Pick Up Plan'}
                    </Button>
                </div>
                </CardContent>
            </Card>
            </div>
      </div>
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the pickup scheduled for
              "{pickupToDelete?.pickupDate}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeletePickup} className="bg-destructive hover:bg-destructive/90">
              Yes, delete pickup
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
    