
'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { doc, getDoc, collection, onSnapshot, setDoc, deleteDoc, writeBatch, updateDoc, addDoc, query, where, getDocs } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Calendar as CalendarIcon, Bot, Trash2, List, LayoutGrid, FilePen, Search } from 'lucide-react';
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

type PickupInternal = Omit<Pickup, 'boxId' | 'boxName'>;

export default function AdminBoxDetailPage({ params }: { params: { boxId: string } }) {
  const { boxId } = params;
  const { toast } = useToast();
  const router = useRouter();

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
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [pickupNote, setPickupNote] = useState('');
  const [isSavingPickup, setIsSavingPickup] = useState(false);
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);

  // State for the generation dialog
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateStartDate, setGenerateStartDate] = useState<Date | undefined>();
  const [generateEndDate, setGenerateEndDate] = useState<Date | undefined>();
  const [generateFrequency, setGenerateFrequency] = useState('weekly');
  const [generateNote, setGenerateNote] = useState('');

  // State for delete confirmation dialog
  const [isPickupDeleteDialogOpen, setIsPickupDeleteDialogOpen] = useState(false);
  const [pickupToDelete, setPickupToDelete] = useState<PickupInternal | null>(null);
  const [isBoxDeleteDialogOpen, setIsBoxDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // State for schedule view
  const [scheduleView, setScheduleView] = useState<'list' | 'calendar' | 'card'>('list');

  // State for subscription filtering
  const [subscriptionSearch, setSubscriptionSearch] = useState('');


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
  
  const openNoteDialog = (date: Date) => {
    setSelectedDate(date);
    const dateString = format(date, 'yyyy-MM-dd');
    const pickupForDate = pickups.find(d => d.pickupDate === dateString);
    setPickupNote(pickupForDate?.note || '');
    setIsNoteDialogOpen(true);
  }

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    const dateString = format(date, 'yyyy-MM-dd');
    const isScheduled = pickups.some(p => p.pickupDate === dateString);
    // Open dialog only if a date is selected, and for calendar view, only if it's already scheduled
    if (date) {
        openNoteDialog(date);
    }
  };


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

      setIsNoteDialogOpen(false);
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

  const handleDeletePickupClick = (pickup: PickupInternal) => {
    setPickupToDelete(pickup);
    setIsPickupDeleteDialogOpen(true);
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
          setIsPickupDeleteDialogOpen(false);
          setPickupToDelete(null);
      }
  };
  
  const confirmDeleteBox = async () => {
    if (!box) return;
    setIsDeleting(true);
    try {
      const pickupsCollectionRef = collection(db, 'boxes', box.id, 'pickups');
      const pickupsSnapshot = await getDocs(pickupsCollectionRef);
      const deletePickupsBatch = writeBatch(db);
      pickupsSnapshot.docs.forEach(doc => {
        deletePickupsBatch.delete(doc.ref);
      });
      await deletePickupsBatch.commit();
      
      await deleteDoc(doc(db, 'boxes', box.id));
      
      toast({
        title: 'Success',
        description: `Box "${box.name}" and all its pickups have been deleted.`,
      });
      router.push('/admin/boxes');
    } catch (error) {
      console.error('Error deleting box: ', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not delete the box. Please try again.',
      });
    } finally {
      setIsDeleting(false);
      setIsBoxDeleteDialogOpen(false);
    }
  };
  
  const pickupDates = pickups.map(d => new Date(d.pickupDate.replace(/-/g, '\/')));

  const filteredAndSortedSubscriptions = useMemo(() => {
    return subscriptions
      .filter(sub => 
        sub.customerName?.toLowerCase().includes(subscriptionSearch.toLowerCase()) ||
        sub.userId.toLowerCase().includes(subscriptionSearch.toLowerCase())
      )
      .sort((a, b) => (a.customerName || '').localeCompare(b.customerName || ''));
  }, [subscriptions, subscriptionSearch]);

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

  const renderScheduleView = () => {
    switch (scheduleView) {
        case 'calendar':
            return (
                <div className="flex justify-center mt-4">
                    <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={handleDateSelect}
                        modifiers={{ scheduled: pickupDates }}
                        modifiersClassNames={{ scheduled: 'bg-primary/20' }}
                        className="rounded-md border"
                    />
                </div>
            );
        case 'card':
            return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                     {pickups.length === 0 ? (
                        <p className="text-muted-foreground col-span-full text-center">No pickups scheduled yet.</p>
                     ) : (
                        pickups.map(pickup => (
                            <Card key={pickup.id}>
                                <CardHeader>
                                    <CardTitle>{format(new Date(pickup.pickupDate.replace(/-/g, '\/')), 'PPP')}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-muted-foreground truncate">{pickup.note || 'No note for this date.'}</p>
                                </CardContent>
                                <CardFooter className="gap-2">
                                    <Button variant="outline" size="sm" onClick={() => openNoteDialog(new Date(pickup.pickupDate.replace(/-/g, '\/')))}>
                                        <FilePen className="h-4 w-4 mr-2"/> Edit Note
                                    </Button>
                                     <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleDeletePickupClick(pickup);}}>
                                        <Trash2 className="h-4 w-4" />
                                        <span className="sr-only">Delete</span>
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))
                     )}
                </div>
            )
        case 'list':
        default:
            return (
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
                                        <Button variant="outline" size="sm" onClick={() => openNoteDialog(new Date(pickup.pickupDate.replace(/-/g, '\/')))}>
                                            <FilePen className="h-4 w-4 mr-2" /> Edit Note
                                        </Button>
                                        <Button variant="ghost" size="icon" className="ml-2" onClick={(e) => { e.stopPropagation(); handleDeletePickupClick(pickup)}}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                            <span className="sr-only">Delete</span>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            );
    }
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
                    <CardFooter className="justify-between">
                        <Button type="submit" disabled={isSavingBox}>
                            {isSavingBox ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save Box Details'}
                        </Button>
                        <Button variant="destructive" type="button" onClick={() => setIsBoxDeleteDialogOpen(true)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Delete Box
                        </Button>
                    </CardFooter>
                    </form>
                </Card>
            </TabsContent>
            <TabsContent value="schedule" className="mt-6">
                 <Card>
                    <CardHeader className="flex-row items-center justify-between">
                        <div>
                            <CardTitle>Scheduled Pickup List</CardTitle>
                            <CardDescription>A list of all upcoming pickup dates for this box.</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                                <ToggleGroup type="single" value={scheduleView} onValueChange={(value) => { if (value) setScheduleView(value as any) }} aria-label="Schedule view">
                                <ToggleGroupItem value="list" aria-label="List view">
                                    <List className="h-4 w-4" />
                                </ToggleGroupItem>
                                <ToggleGroupItem value="card" aria-label="Card view">
                                    <LayoutGrid className="h-4 w-4" />
                                </ToggleGroupItem>
                                <ToggleGroupItem value="calendar" aria-label="Calendar view">
                                    <CalendarIcon className="h-4 w-4" />
                                </ToggleGroupItem>
                            </ToggleGroup>
                            <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button>
                                        <Bot className="mr-2 h-4 w-4" />
                                        Generate
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
                        </div>
                    </CardHeader>
                    <CardContent>
                        {renderScheduleView()}
                    </CardContent>
                </Card>
            </TabsContent>
             <TabsContent value="subscriptions" className="mt-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Subscribers</CardTitle>
                        <CardDescription>A list of all users subscribed to this box.</CardDescription>
                         <div className="relative mt-2">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search by name..."
                                className="pl-8"
                                value={subscriptionSearch}
                                onChange={(e) => setSubscriptionSearch(e.target.value)}
                            />
                        </div>
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
                                {filteredAndSortedSubscriptions.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center h-24">
                                            {subscriptionSearch ? "No matching subscribers found." : "No one has subscribed to this box yet."}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredAndSortedSubscriptions.map(sub => (
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

      <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Note for {selectedDate ? format(selectedDate, 'PPP') : '...'}</DialogTitle>
                <DialogDescription>Describe what's in the box for this date. An empty note is allowed.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
                <Label htmlFor="pickup-note" className="sr-only">Weekly Box Note</Label>
                <Textarea id="pickup-note" placeholder="e.g. Fresh carrots, kale, etc." value={pickupNote} onChange={(e) => setPickupNote(e.target.value)} rows={5} disabled={isSavingPickup} />
            </div>
            <DialogFooter>
                <Button onClick={handleSavePickup} disabled={isSavingPickup || !selectedDate} className="w-full">
                    {isSavingPickup ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isSavingPickup ? 'Saving...' : 'Save Pick Up Plan'}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isPickupDeleteDialogOpen} onOpenChange={setIsPickupDeleteDialogOpen}>
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

      <AlertDialog open={isBoxDeleteDialogOpen} onOpenChange={setIsBoxDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this box?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the 
              "{box?.name}" box and all associated data, including pickups and subscriptions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsBoxDeleteDialogOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteBox} className="bg-destructive hover:bg-destructive/90" disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Yes, delete box'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

    