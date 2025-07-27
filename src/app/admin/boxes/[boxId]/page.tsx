
'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { doc, getDoc, collection, onSnapshot, setDoc, deleteDoc, writeBatch, updateDoc, addDoc, query, where } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Calendar as CalendarIcon, Bot, Trash2 } from 'lucide-react';
import type { Box, Pickup, Subscription } from '@/lib/types';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

type PickupInternal = Omit<Pickup, 'boxId' | 'boxName'>;

export default function AdminBoxDetailPage({ params }: { params: { boxId: string } }) {
  const { boxId } = params;
  const { toast } = useToast();

  const [box, setBox] = useState<Box | null>(null);
  const [pickups, setPickups] = useState<PickupInternal[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  
  // States for editing the box
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSavingBox, setIsSavingBox] = useState(false);

  // States for the calendar and pickup notes
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [pickupNote, setPickupNote] = useState('');
  const [isSavingPickup, setIsSavingPickup] = useState(false);

  // State for the generation dialog
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateStartDate, setGenerateStartDate] = useState<Date | undefined>();
  const [generateEndDate, setGenerateEndDate] = useState<Date | undefined>();
  const [generateFrequency, setGenerateFrequency] = useState('weekly');
  const [generateNote, setGenerateNote] = useState('');

  // State for delete confirmation dialog
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [pickupToDelete, setPickupToDelete] = useState<PickupInternal | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!boxId) return;

    // Fetch box details and listen for updates
    const boxRef = doc(db, 'boxes', boxId);
    const unsubBox = onSnapshot(boxRef, (docSnap) => {
      if (docSnap.exists()) {
        const boxData = { id: docSnap.id, ...docSnap.data() } as Box;
        setBox(boxData);
        // Populate form fields with box data
        setName(boxData.name);
        setPrice(boxData.price.toString());
        setDescription(boxData.description);
        setQuantity(boxData.quantity.toString());
        setImagePreview(boxData.image);
      }
      setIsLoading(false);
    });

    // Listen for real-time pickup updates from Firestore
    const pickupsRef = collection(db, 'boxes', boxId, 'pickups');
    const unsubPickups = onSnapshot(pickupsRef, (snapshot) => {
      const pickupsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PickupInternal));
      pickupsData.sort((a, b) => new Date(a.pickupDate).getTime() - new Date(b.pickupDate).getTime());
      setPickups(pickupsData);
    });

    const subscriptionsQuery = query(collection(db, 'subscriptions'), where('boxId', '==', boxId));
    const unsubSubscriptions = onSnapshot(subscriptionsQuery, (snapshot) => {
        const subsData = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as Subscription);
        setSubscriptions(subsData);
    });

    return () => {
      unsubBox();
      unsubPickups();
      unsubSubscriptions();
    };
  }, [boxId]);
  
  useEffect(() => {
    if (selectedDate) {
      const dateString = format(selectedDate, 'yyyy-MM-dd');
      const pickupForDate = pickups.find(d => d.pickupDate === dateString);
      setPickupNote(pickupForDate?.note || '');
    } else {
      setPickupNote('');
    }
  }, [selectedDate, pickups]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSaveBox = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price || !description || !quantity || !box) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please fill out all required fields.' });
      return;
    }
    setIsSavingBox(true);

    let imageUrlToSave = box.image;

    if (imageFile) {
      try {
        const storageRef = ref(storage, `boxes/${Date.now()}_${imageFile.name}`);
        await uploadBytes(storageRef, imageFile);
        imageUrlToSave = await getDownloadURL(storageRef);
      } catch (error) {
        console.error('Error uploading image: ', error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not upload the image. Please try again.' });
        setIsSavingBox(false);
        return;
      }
    }

    const boxData = {
      name,
      price: parseFloat(price),
      description,
      quantity: parseInt(quantity, 10),
      image: imageUrlToSave,
    };

    try {
      const boxRef = doc(db, 'boxes', boxId);
      await updateDoc(boxRef, boxData);
      toast({ title: 'Success', description: 'Box details updated successfully.' });
    } catch (error) {
      console.error('Error updating document: ', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not update the box. Please try again.' });
    } finally {
      setIsSavingBox(false);
    }
  };
  
  const handleSavePickup = async () => {
    if (!selectedDate || !box) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please select a date.' });
        return;
    }
    
    setIsSavingPickup(true);
    const dateString = format(selectedDate, 'yyyy-MM-dd');
    const existingPickup = pickups.find(p => p.pickupDate === dateString);

    try {
        if (pickupNote.trim()) {
            const pickupData = {
                pickupDate: dateString,
                note: pickupNote,
            };
            
            if (existingPickup) {
                const pickupRef = doc(db, 'boxes', boxId, 'pickups', existingPickup.id);
                await setDoc(pickupRef, pickupData, { merge: true });
            } else {
                await addDoc(collection(db, 'boxes', boxId, 'pickups'), pickupData);
            }
            toast({ title: 'Success', description: `Pickup note for ${dateString} saved.` });

        } else if (existingPickup) {
            const pickupRef = doc(db, 'boxes', boxId, 'pickups', existingPickup.id);
            await deleteDoc(pickupRef);
            toast({ title: 'Success', description: `Pickup for ${dateString} cleared.` });
        }
    } catch (error) {
        console.error("Error saving pickup: ", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not save pickup.' });
    } finally {
        setIsSavingPickup(false);
    }
  };

  const handleGenerateSchedule = async () => {
    if (!generateStartDate || !generateEndDate || !generateNote || !box) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please fill out all fields.' });
        return;
    }
    if (generateEndDate < generateStartDate) {
        toast({ variant: 'destructive', title: 'Error', description: 'End date cannot be before start date.' });
        return;
    }

    setIsGenerating(true);
    const batch = writeBatch(db);
    const daysIncrement = generateFrequency === 'weekly' ? 7 : 14;
    let currentDate = generateStartDate;

    while (currentDate <= generateEndDate) {
        const dateString = format(currentDate, 'yyyy-MM-dd');
        const pickupRef = doc(collection(db, 'boxes', boxId, 'pickups'));
        const pickupData = { pickupDate: dateString, note: generateNote };
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
        toast({ variant: 'destructive', title: 'Error', description: 'Could not generate schedule.' });
    } finally {
        setIsGenerating(false);
    }
  };

  const handleDeleteClick = (pickup: PickupInternal) => {
    setPickupToDelete(pickup);
    setIsDeleteDialogOpen(true);
  };
  
  const confirmDeletePickup = async () => {
      if (!pickupToDelete) return;
      try {
          await deleteDoc(doc(db, 'boxes', boxId, 'pickups', pickupToDelete.id));
          toast({ title: 'Success', description: `Pickup for ${pickupToDelete.pickupDate} has been deleted.` });
      } catch (error) {
          console.error('Error deleting pickup: ', error);
          toast({ variant: 'destructive', title: 'Error', description: 'Could not delete pickup.' });
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
            <Skeleton className="h-96 w-full" />
        </div>
    )
  }

  if (!box) {
    return <div>Box not found.</div>;
  }

  return (
    <div className="space-y-6">
        <h1 className="text-2xl font-headline">Edit Box: {box.name}</h1>
        
        <Tabs defaultValue="edit" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="edit">Edit</TabsTrigger>
                <TabsTrigger value="schedule">Schedule</TabsTrigger>
                <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
            </TabsList>
            <TabsContent value="edit" className="mt-6">
                <Card>
                    <form onSubmit={handleSaveBox}>
                    <CardHeader>
                        <CardTitle>Box Details</CardTitle>
                        <CardDescription>Update the information for this veggie box.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Name</Label>
                            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} disabled={isSavingBox} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="price">Price</Label>
                            <Input id="price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} disabled={isSavingBox} />
                        </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="image">Image</Label>
                            <div className="flex items-center gap-4">
                                {imagePreview && <Image src={imagePreview} alt="Preview" width={80} height={80} className="rounded-md object-cover" />}
                                <Input id="image" type="file" accept="image/*" onChange={handleImageChange} disabled={isSavingBox} className="max-w-xs" />
                            </div>
                        </div>
                        <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} disabled={isSavingBox} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="quantity">Quantity</Label>
                            <Input id="quantity" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} disabled={isSavingBox} />
                        </div>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" disabled={isSavingBox}>
                            {isSavingBox ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save Box Details'}
                        </Button>
                    </CardFooter>
                    </form>
                </Card>
            </TabsContent>
            <TabsContent value="schedule" className="mt-6">
                 <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
                    <div className="lg:col-span-3 space-y-6">
                        <Card>
                            <CardHeader className="flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Schedule Pickups</CardTitle>
                                    <CardDescription>Add or remove pickup dates for this box.</CardDescription>
                                </div>
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
                                            <DialogDescription>Automatically create pickup dates for this box.</DialogDescription>
                                        </DialogHeader>
                                        <div className="grid gap-4 py-4">
                                            <div className="grid grid-cols-4 items-center gap-4">
                                                <Label htmlFor="start-date" className="text-right">Start Date</Label>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                    <Button variant={"outline"} className={cn("col-span-3 justify-start text-left font-normal", !generateStartDate && "text-muted-foreground")}>
                                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                                        {generateStartDate ? format(generateStartDate, "PPP") : <span>Pick a date</span>}
                                                    </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={generateStartDate} onSelect={setGenerateStartDate} initialFocus /></PopoverContent>
                                                </Popover>
                                            </div>
                                            <div className="grid grid-cols-4 items-center gap-4">
                                                <Label htmlFor="end-date" className="text-right">End Date</Label>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                    <Button variant={"outline"} className={cn("col-span-3 justify-start text-left font-normal", !generateEndDate && "text-muted-foreground")}>
                                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                                        {generateEndDate ? format(generateEndDate, "PPP") : <span>Pick a date</span>}
                                                    </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={generateEndDate} onSelect={setGenerateEndDate} disabled={(date) => generateStartDate ? date < generateStartDate : false} initialFocus /></PopoverContent>
                                                </Popover>
                                            </div>
                                            <div className="grid grid-cols-4 items-center gap-4">
                                                <Label htmlFor="frequency" className="text-right">Frequency</Label>
                                                <Select value={generateFrequency} onValueChange={setGenerateFrequency}>
                                                    <SelectTrigger className="col-span-3"><SelectValue placeholder="Select frequency" /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="weekly">Weekly</SelectItem>
                                                        <SelectItem value="bi-weekly">Bi-weekly (every 2 weeks)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="grid grid-cols-4 items-center gap-4">
                                                <Label htmlFor="note" className="text-right">Note</Label>
                                                <Textarea id="note" value={generateNote} onChange={(e) => setGenerateNote(e.target.value)} className="col-span-3" placeholder="e.g. This week's box includes..." />
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
                                <CardTitle>Scheduled Pickup List</CardTitle>
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
                                            <TableRow><TableCell colSpan={3} className="text-center h-24">No pickups scheduled yet.</TableCell></TableRow>
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

                    <div className="sticky top-4 lg:col-span-2">
                      <Card>
                          <CardHeader>
                              <CardTitle>Note for {selectedDate ? format(selectedDate, 'PPP') : '...'}</CardTitle>
                              <CardDescription>Describe what's in the box for the selected date. Clear note to remove pickup.</CardDescription>
                          </CardHeader>
                          <CardContent>
                              <div className="space-y-4">
                                  <div className="space-y-2">
                                      <Label htmlFor="pickup-note">Weekly Box Note</Label>
                                      <Textarea id="pickup-note" placeholder="e.g. Fresh carrots, kale, etc." value={pickupNote} onChange={(e) => setPickupNote(e.target.value)} rows={5} disabled={isSavingPickup} />
                                  </div>
                                  <Button onClick={handleSavePickup} disabled={isSavingPickup || !selectedDate} className="w-full">
                                      {isSavingPickup ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                      {isSavingPickup ? 'Saving...' : 'Save Pick Up Plan'}
                                  </Button>
                              </div>
                          </CardContent>
                      </Card>
                    </div>
                </div>
            </TabsContent>
             <TabsContent value="subscriptions" className="mt-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Subscribers</CardTitle>
                        <CardDescription>A list of all users subscribed to this box.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Start Date</TableHead>
                                    <TableHead className="text-right">Price</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {subscriptions.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center h-24">No one has subscribed to this box yet.</TableCell>
                                    </TableRow>
                                ) : (
                                    subscriptions.map(sub => (
                                        <TableRow key={sub.id}>
                                            <TableCell>{sub.customerName || sub.userId}</TableCell>
                                            <TableCell>
                                                <Badge variant={sub.status === 'Active' ? 'default' : 'secondary'}>{sub.status}</Badge>
                                            </TableCell>
                                            <TableCell>{format(new Date(sub.startDate.replace(/-/g, '\/')), 'PPP')}</TableCell>
                                            <TableCell className="text-right">${sub.price.toFixed(2)}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete the pickup scheduled for "{pickupToDelete?.pickupDate}".</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeletePickup} className="bg-destructive hover:bg-destructive/90">Yes, delete pickup</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

    