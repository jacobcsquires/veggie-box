
'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { useRouter, useParams } from 'next/navigation';
import { doc, getDoc, collection, onSnapshot, setDoc, deleteDoc, writeBatch, updateDoc, addDoc, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Calendar as CalendarIcon, Bot, Trash2, List, LayoutGrid, FilePen, Search, PlusCircle, ChevronsUpDown, ExternalLink } from 'lucide-react';
import type { Box, Pickup, Subscription, PricingOption } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { format, addDays, isBefore, startOfToday, addMonths, subDays, subMonths } from 'date-fns';
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';


type PickupInternal = Omit<Pickup, 'boxId' | 'boxName'>;

function getNextPickupDate(lastDate: Date, frequency: Box['frequency']): Date {
    switch (frequency) {
        case 'weekly':
            return addDays(lastDate, 7);
        case 'bi-weekly':
            return addDays(lastDate, 14);
        case 'monthly':
            return addMonths(lastDate, 1);
        default:
            return addDays(lastDate, 7);
    }
}

function getPreviousPickupDate(firstDate: Date, frequency: Box['frequency']): Date {
    switch (frequency) {
        case 'weekly':
            return subDays(firstDate, 7);
        case 'bi-weekly':
            return subDays(firstDate, 14);
        case 'monthly':
            return subMonths(firstDate, 1);
        default:
            return subDays(firstDate, 7);
    }
}

export default function AdminBoxDetailPage() {
  const params = useParams();
  const boxId = params.boxId as string;
  const { toast } = useToast();
  const router = useRouter();

  const [box, setBox] = useState<Box | null>(null);
  const [pickups, setPickups] = useState<PickupInternal[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  
  // States for editing the box
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('');
  const [frequency, setFrequency] = useState<'weekly' | 'bi-weekly' | 'monthly'>('weekly');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSavingBox, setIsSavingBox] = useState(false);
  const [displayOnWebsite, setDisplayOnWebsite] = useState(true);
  const [manualSignupCutoff, setManualSignupCutoff] = useState(false);
  const [pricingOptions, setPricingOptions] = useState<Array<Partial<PricingOption>>>([]);

  // States for the calendar and pickup notes
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [pickupNote, setPickupNote] = useState('');
  const [isSavingPickup, setIsSavingPickup] = useState(false);
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);

  // State for the generation dialog
  const [isAddPickupDialogOpen, setIsAddPickupDialogOpen] = useState(false);
  const [isAddingPickup, setIsAddingPickup] = useState(false);
  const [addStartDate, setAddStartDate] = useState<Date | undefined>();
  const [addEndDate, setAddEndDate] = useState<Date | undefined>();
  const [addNote, setAddNote] = useState('');
  
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
        setDescription(boxData.description);
        setQuantity(boxData.quantity.toString());
        setFrequency(boxData.frequency || 'weekly');
        setImagePreview(boxData.image);
        setDisplayOnWebsite(boxData.displayOnWebsite ?? true);
        setManualSignupCutoff(boxData.manualSignupCutoff ?? false);
        setPricingOptions(boxData.pricingOptions || [{name: '', price: 0}]);
      }
      setIsLoading(false);
    });

    // Listen for real-time pickup updates from Firestore
    const pickupsRef = collection(db, 'boxes', boxId, 'pickups');
    const unsubPickups = onSnapshot(query(pickupsRef, orderBy('pickupDate')), (snapshot) => {
      const pickupsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PickupInternal));
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

  const subscriptionCountsByPrice = useMemo(() => {
    const counts: { [priceId: string]: number } = {};
    subscriptions.forEach(sub => {
      if (sub.status === 'Active' && sub.priceId) {
        counts[sub.priceId] = (counts[sub.priceId] || 0) + 1;
      }
    });
    return counts;
  }, [subscriptions]);
  
  const openNoteDialog = (date: Date) => {
    setSelectedDate(date);
    const dateString = format(date, 'yyyy-MM-dd');
    const pickupForDate = pickups.find(d => d.pickupDate === dateString);
    setPickupNote(pickupForDate?.note || '');
    setIsNoteDialogOpen(true);
  }

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    const isScheduled = pickups.some(p => p.pickupDate === format(date, 'yyyy-MM-dd'));
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

  const updateBoxDates = async () => {
        if (!boxId) return;
        const pickupsRef = collection(db, 'boxes', boxId, 'pickups');
        const firstPickupQuery = query(pickupsRef, orderBy('pickupDate', 'asc'), limit(1));
        const lastPickupQuery = query(pickupsRef, orderBy('pickupDate', 'desc'), limit(1));

        const [firstSnapshot, lastSnapshot] = await Promise.all([getDocs(firstPickupQuery), getDocs(lastPickupQuery)]);
        
        const startDate = firstSnapshot.docs.length > 0 ? firstSnapshot.docs[0].data().pickupDate : null;
        const endDate = lastSnapshot.docs.length > 0 ? lastSnapshot.docs[0].data().pickupDate : null;

        const boxRef = doc(db, 'boxes', boxId);
        await updateDoc(boxRef, { startDate, endDate });
    };

    const handlePricingOptionChange = (index: number, field: keyof PricingOption, value: string | number) => {
        const newOptions = [...pricingOptions];
        (newOptions[index] as any)[field] = value;
        setPricingOptions(newOptions);
    };

    const addPricingOption = () => {
        setPricingOptions([...pricingOptions, { name: '', price: 0 }]);
    };

    const removePricingOption = (index: number) => {
        if (pricingOptions.length <= 1) return; // Must have at least one
        const newOptions = pricingOptions.filter((_, i) => i !== index);
        setPricingOptions(newOptions);
    };

  const handleSaveBox = async (e: React.FormEvent) => {
    e.preventDefault();
    const validPricingOptions = pricingOptions.filter(opt => opt.name && (opt.price ?? 0) > 0);
    if (!name || !description || !quantity || !box || validPricingOptions.length === 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please fill out all required fields and have at least one valid pricing option.' });
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

    try {
        const stripeResponse = await fetch('/api/create-stripe-product', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                name, 
                description, 
                frequency, // frequency is not editable, so this is safe
                existingProductId: box.stripeProductId,
                pricingOptions: validPricingOptions,
                oldPricingOptions: box.pricingOptions
            }),
        });
        if (!stripeResponse.ok) {
            const error = await stripeResponse.json();
            throw new Error(error.message || 'Failed to update Stripe product.');
        }
        const { newPricingOptions } = await stripeResponse.json();

        const boxData: Partial<Box> = {
          name,
          description,
          quantity: parseInt(quantity, 10),
          image: imageUrlToSave,
          pricingOptions: newPricingOptions,
          displayOnWebsite,
          manualSignupCutoff,
        };

        const boxRef = doc(db, 'boxes', boxId);
        await updateDoc(boxRef, boxData as any);
        toast({ title: 'Success', description: 'Veggie Box Plan details updated successfully.' });
    } catch (error: any) {
      console.error('Error updating document: ', error);
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Could not update the Veggie Box Plan. Please try again.' });
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
      
      await updateBoxDates();

      setIsNoteDialogOpen(false);
    } catch (error) {
      console.error("Error saving pickup: ", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not save pickup.' });
    } finally {
      setIsSavingPickup(false);
    }
  };

  const handleAddPickups = async () => {
    if (!addStartDate || !addEndDate || !box) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please provide a start and end date.' });
        return;
    }
    if (isBefore(addEndDate, addStartDate)) {
        toast({ variant: 'destructive', title: 'Error', description: 'End date cannot be before start date.' });
        return;
    }

    setIsAddingPickup(true);
    const batch = writeBatch(db);
    
    let currentDate = addStartDate;
    const existingPickupDatesStrings = new Set(pickups.map(p => p.pickupDate));

    while (currentDate <= addEndDate) {
        const dateString = format(currentDate, 'yyyy-MM-dd');
        if (!existingPickupDatesStrings.has(dateString)) {
            const pickupRef = doc(collection(db, 'boxes', boxId, 'pickups'));
            const pickupData = { pickupDate: dateString, note: addNote };
            batch.set(pickupRef, pickupData);
        }
        currentDate = getNextPickupDate(currentDate, box.frequency);
    }

    try {
        await batch.commit();
        toast({ title: 'Success', description: 'Pickup(s) added successfully.' });
        
        await updateBoxDates();

        setIsAddPickupDialogOpen(false);
        setAddStartDate(undefined);
        setAddEndDate(undefined);
        setAddNote('');
    } catch (error) {
        console.error("Error adding pickups:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not add pickups.' });
    } finally {
        setIsAddingPickup(false);
    }
  };
  
  const handleAddSinglePickup = async (date: Date) => {
    if (!box) return;
    const dateString = format(date, 'yyyy-MM-dd');
    
    try {
      const pickupData = { pickupDate: dateString, note: '' };
      await addDoc(collection(db, 'boxes', boxId, 'pickups'), pickupData);
      toast({ title: 'Success', description: `Pickup for ${dateString} added.` });
      await updateBoxDates();
    } catch (error: any) {
      console.error('Error adding single pickup:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not add the pickup.' });
    }
  };

  const handleDeletePickupClick = (pickup: PickupInternal) => {
    setPickupToDelete(pickup);
    setIsPickupDeleteDialogOpen(true);
  };
  
  const confirmDeletePickup = async () => {
    if (!pickupToDelete || !box) return;

    try {
        await deleteDoc(doc(db, 'boxes', boxId, 'pickups', pickupToDelete.id));
        toast({ title: 'Success', description: `Pickup for ${pickupToDelete.pickupDate} has been deleted.` });
        await updateBoxDates();
    } catch (error: any) {
        console.error('Error during pickup deletion process: ', error);
        toast({ variant: 'destructive', title: 'Error', description: error.message || 'Could not complete the deletion process.' });
    } finally {
        setIsPickupDeleteDialogOpen(false);
        setPickupToDelete(null);
    }
  };
  
  const confirmDeleteBox = async () => {
    if (!box) return;
    setIsDeleting(true);
    try {
      // 1. Archive Stripe Product if it exists
      if (box.stripeProductId) {
        const response = await fetch('/api/archive-stripe-product', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stripeProductId: box.stripeProductId }),
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to archive Stripe product.');
        }
      }

      // 2. Delete all pickups in a batch
      const pickupsCollectionRef = collection(db, 'boxes', box.id, 'pickups');
      const pickupsSnapshot = await getDocs(pickupsCollectionRef);
      const deletePickupsBatch = writeBatch(db);
      pickupsSnapshot.docs.forEach(doc => {
        deletePickupsBatch.delete(doc.ref);
      });
      await deletePickupsBatch.commit();
      
      // 3. Delete the box itself
      await deleteDoc(doc(db, 'boxes', box.id));
      
      toast({
        title: 'Success',
        description: `Veggie Box Plan "${box.name}" and all its data have been deleted.`,
      });
      router.push('/admin/boxes');
    } catch (error: any) {
      console.error('Error deleting plan: ', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Could not delete the Veggie Box Plan. Please try again.',
      });
    } finally {
      setIsDeleting(false);
      setIsBoxDeleteDialogOpen(false);
    }
  };
  
  const pickupDates = useMemo(() => pickups.map(d => new Date(d.pickupDate.replace(/-/g, '\/'))), [pickups]);

  const filteredAndSortedSubscriptions = useMemo(() => {
    return subscriptions
      .filter(sub => 
        sub.customerName?.toLowerCase().includes(subscriptionSearch.toLowerCase()) ||
        sub.userId.toLowerCase().includes(subscriptionSearch.toLowerCase())
      )
      .sort((a, b) => (a.customerName || '').localeCompare(b.customerName || ''));
  }, [subscriptions, subscriptionSearch]);
  
  const nextPossiblePickupDate = useMemo(() => {
    if (!box || pickups.length === 0) return null;

    const lastPickupDateStr = pickups[pickups.length - 1].pickupDate;
    const lastDate = new Date(lastPickupDateStr.replace(/-/g, '\/'));
    
    return getNextPickupDate(lastDate, box.frequency);
  }, [box, pickups]);

  const previousPossiblePickupDate = useMemo(() => {
    if (!box || pickups.length === 0) return null;

    const firstPickupDateStr = pickups[0].pickupDate;
    const firstDate = new Date(firstPickupDateStr.replace(/-/g, '\/'));
    const prevDate = getPreviousPickupDate(firstDate, box.frequency);
    
    // Only allow adding a previous date if it's today or in the future
    if (isBefore(prevDate, startOfToday())) {
        return null;
    }
    
    return prevDate;
  }, [box, pickups]);

  if (isLoading) {
    return (
        <div>
            <Skeleton className="h-8 w-64 mb-4" />
            <Skeleton className="h-96 w-full" />
        </div>
    )
  }

  if (!box) {
    return <div>Veggie Box Plan not found.</div>;
  }
  
  const renderAddButton = () => {
    if (pickups.length === 0) {
        return (
             <Dialog open={isAddPickupDialogOpen} onOpenChange={setIsAddPickupDialogOpen}>
                <DialogTrigger asChild>
                    <Button>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add Pickups
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Add Pickups</DialogTitle>
                        <DialogDescription>
                            Generate pickup dates based on the plan's frequency ({box.frequency}).
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="start-date" className="text-right">Start Date</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                <Button variant={"outline"} className={cn("col-span-3 justify-start text-left font-normal", !addStartDate && "text-muted-foreground")}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {addStartDate ? format(addStartDate, "PPP") : <span>Pick a date</span>}
                                </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar 
                                        mode="single" 
                                        selected={addStartDate} 
                                        onSelect={setAddStartDate} 
                                        disabled={(date) => isBefore(date, startOfToday())}
                                        initialFocus 
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                        
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="end-date" className="text-right">End Date</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                <Button variant={"outline"} className={cn("col-span-3 justify-start text-left font-normal", !addEndDate && "text-muted-foreground")}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {addEndDate ? format(addEndDate, "PPP") : <span>Pick an end date</span>}
                                </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar 
                                        mode="single" 
                                        selected={addEndDate} 
                                        onSelect={setAddEndDate} 
                                        disabled={(date) => addStartDate ? isBefore(date, addStartDate) : isBefore(date, startOfToday())} 
                                        initialFocus 
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                        
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="note" className="text-right">Note</Label>
                            <Textarea id="note" value={addNote} onChange={(e) => setAddNote(e.target.value)} className="col-span-3" placeholder="Optional: e.g. This week's box includes..." />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" onClick={handleAddPickups} disabled={isAddingPickup}>
                            {isAddingPickup && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isAddingPickup ? 'Adding...' : 'Add Pickup(s)'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    } else {
        return (
             <Popover>
                <PopoverTrigger asChild>
                    <Button>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                    <div className="flex flex-col gap-1 p-2">
                        {previousPossiblePickupDate && (
                             <Button
                                variant="ghost"
                                className="justify-start"
                                onClick={() => handleAddSinglePickup(previousPossiblePickupDate)}
                            >
                                Add previous: {format(previousPossiblePickupDate, 'PPP')}
                            </Button>
                        )}
                        {nextPossiblePickupDate && (
                             <Button
                                variant="ghost"
                                className="justify-start"
                                onClick={() => handleAddSinglePickup(nextPossiblePickupDate)}
                            >
                                Add next: {format(nextPossiblePickupDate, 'PPP')}
                            </Button>
                        )}
                        <Dialog open={isAddPickupDialogOpen} onOpenChange={setIsAddPickupDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="ghost" className="justify-start">Generate Multiple...</Button>
                            </DialogTrigger>
                             <DialogContent className="sm:max-w-[425px]">
                                <DialogHeader>
                                    <DialogTitle>Add Multiple Pickups</DialogTitle>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                     <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="start-date" className="text-right">Start Date</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                            <Button variant={"outline"} className={cn("col-span-3 justify-start text-left font-normal", !addStartDate && "text-muted-foreground")}>
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {addStartDate ? format(addStartDate, "PPP") : <span>Pick a date</span>}
                                            </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
                                                <Calendar mode="single" selected={addStartDate} onSelect={setAddStartDate} initialFocus />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="end-date" className="text-right">End Date</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                            <Button variant={"outline"} className={cn("col-span-3 justify-start text-left font-normal", !addEndDate && "text-muted-foreground")}>
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {addEndDate ? format(addEndDate, "PPP") : <span>Pick an end date</span>}
                                            </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
                                                <Calendar mode="single" selected={addEndDate} onSelect={setAddEndDate} disabled={(date) => addStartDate ? isBefore(date, addStartDate) : false} initialFocus />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="note" className="text-right">Note</Label>
                                        <Textarea id="note" value={addNote} onChange={(e) => setAddNote(e.target.value)} className="col-span-3" placeholder="Optional: e.g. This week's box includes..." />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button type="button" onClick={handleAddPickups} disabled={isAddingPickup}>
                                        {isAddingPickup && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        {isAddingPickup ? 'Adding...' : 'Add Pickups'}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </PopoverContent>
            </Popover>
        )
    }
  }

  const renderScheduleView = () => {
    const today = startOfToday();
    
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
                        pickups.map(pickup => {
                            const pickupDateObj = new Date(pickup.pickupDate.replace(/-/g, '\/'));
                            const isPast = isBefore(pickupDateObj, today);
                            return (
                                <Card key={pickup.id}>
                                    <CardHeader>
                                        <CardTitle>{format(pickupDateObj, 'PPPP')}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm text-muted-foreground truncate">{pickup.note || 'No note for this date.'}</p>
                                    </CardContent>
                                    <CardFooter className="gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => openNoteDialog(pickupDateObj)}>
                                            <FilePen className="h-4 w-4"/>
                                            <span className="sr-only">Edit Note</span>
                                        </Button>
                                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleDeletePickupClick(pickup);}}>
                                            <Trash2 className="h-4 w-4" />
                                            <span className="sr-only">Delete</span>
                                        </Button>
                                    </CardFooter>
                                </Card>
                            )
                        })
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
                            <TableHead>Pickup Notes</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {pickups.length === 0 ? (
                            <TableRow><TableCell colSpan={3} className="text-center h-24">No pickups scheduled yet.</TableCell></TableRow>
                        ) : (
                            pickups.map(pickup => {
                                const pickupDateObj = new Date(pickup.pickupDate.replace(/-/g, '\/'));
                                return (
                                    <TableRow key={pickup.id}>
                                        <TableCell>{format(pickupDateObj, 'PPPP')}</TableCell>
                                        <TableCell className="max-w-[300px] truncate">{pickup.note}</TableCell>
                                        <TableCell className="text-right space-x-2">
                                            <Button variant="ghost" size="icon" onClick={() => openNoteDialog(pickupDateObj)}>
                                                <FilePen className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDeletePickupClick(pickup)}}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                )
                            })
                        )}
                    </TableBody>
                </Table>
            );
    }
  }


  return (
    <div className="space-y-6">
        <h1 className="text-2xl font-headline">Edit Plan: {box.name}</h1>
        
         <Accordion type="single" collapsible className="w-full" defaultValue='item-1'>
            <AccordionItem value="item-1">
                <Card>
                    <AccordionTrigger className="px-6">
                        <div className="flex flex-col items-start">
                             <CardTitle>Veggie Box Details</CardTitle>
                             <CardDescription className="mt-1">Update the information for this Veggie Box Plan.</CardDescription>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent>
                        <form onSubmit={handleSaveBox}>
                            <CardContent className="space-y-4 pt-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Plan Name</Label>
                                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} disabled={isSavingBox} />
                                </div>
                                {box.stripeProductId && (
                                    <div className="space-y-2">
                                        <Label>Stripe Product ID</Label>
                                        <Input value={box.stripeProductId} readOnly disabled className="font-mono text-xs" />
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center mb-2">
                                        <Label>Pricing Options</Label>
                                        <Button type="button" variant="outline" size="sm" onClick={addPricingOption} disabled={isSavingBox}>
                                            <PlusCircle className="mr-2 h-4 w-4"/> Add Option
                                        </Button>
                                    </div>
                                    <div className="space-y-3 rounded-md border p-4">
                                        {pricingOptions.map((option, index) => (
                                            <div key={option.id || index} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                                                <div className="col-span-12 md:col-span-4 space-y-1">
                                                    <Label htmlFor={`price-name-${index}`} className="text-xs text-muted-foreground">Option Name</Label>
                                                    <Input id={`price-name-${index}`} placeholder="e.g. Single Share" value={option.name} onChange={(e) => handlePricingOptionChange(index, 'name', e.target.value)} disabled={isSavingBox || !!option.id} />
                                                </div>
                                                <div className="col-span-6 md:col-span-2 space-y-1">
                                                    <Label htmlFor={`price-value-${index}`} className="text-xs text-muted-foreground">Price ($)</Label>
                                                    <Input id={`price-value-${index}`} type="number" placeholder="25.00" value={option.price} onChange={(e) => handlePricingOptionChange(index, 'price', parseFloat(e.target.value))} disabled={isSavingBox || !!option.id} />
                                                </div>
                                                <div className="col-span-6 md:col-span-2 space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Active Subs</Label>
                                                    <Input value={subscriptionCountsByPrice[option.id!] || 0} readOnly disabled className="font-mono text-xs" />
                                                </div>
                                                 <div className="col-span-10 md:col-span-3 space-y-1">
                                                    <Label htmlFor={`price-id-${index}`} className="text-xs text-muted-foreground">Stripe Price ID</Label>
                                                    <Input id={`price-id-${index}`} value={option.id || 'Will be generated'} readOnly disabled className="font-mono text-xs" />
                                                </div>
                                                <div className="col-span-2 md:col-span-1 flex items-end justify-end">
                                                    {option.id ? (
                                                        <Button type="button" variant="ghost" size="icon" asChild>
                                                            <a href={`https://dashboard.stripe.com/test/prices/${option.id}`} target="_blank" rel="noopener noreferrer">
                                                                <ExternalLink className="h-4 w-4" />
                                                            </a>
                                                        </Button>
                                                    ) : (
                                                        <Button type="button" variant="ghost" size="icon" onClick={() => removePricingOption(index)} disabled={isSavingBox}>
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="frequency">Frequency</Label>
                                        <Select value={frequency} onValueChange={(value) => setFrequency(value as any)} disabled>
                                            <SelectTrigger><SelectValue placeholder="Select frequency" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="weekly">Weekly</SelectItem>
                                                <SelectItem value="bi-weekly">Bi-weekly (every 2 weeks)</SelectItem>
                                                <SelectItem value="monthly">Monthly</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="quantity">Quantity</Label>
                                        <Input id="quantity" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} disabled={isSavingBox} />
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
                                <div className="space-y-4">
                                    <Label>Settings</Label>
                                    <div className="space-y-2">
                                        <Label>Display on public website</Label>
                                        <RadioGroup
                                            value={displayOnWebsite ? "true" : "false"}
                                            onValueChange={(value) => setDisplayOnWebsite(value === "true")}
                                            className="flex items-center space-x-4"
                                            disabled={isSavingBox}
                                        >
                                            <div className="flex items-center space-x-2">
                                                <RadioGroupItem value="true" id="display-on" />
                                                <Label htmlFor="display-on" className="font-normal">On</Label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <RadioGroupItem value="false" id="display-off" />
                                                <Label htmlFor="display-off" className="font-normal">Off</Label>
                                            </div>
                                        </RadioGroup>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox id="manualSignupCutoff" checked={manualSignupCutoff} onCheckedChange={(checked) => setManualSignupCutoff(Boolean(checked))} disabled={isSavingBox} />
                                        <Label htmlFor="manualSignupCutoff" className="font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                            Manually turn off new sign-ups for this plan.
                                        </Label>
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="justify-start">
                                <Button type="submit" disabled={isSavingBox}>
                                    {isSavingBox ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save Plan Details'}
                                </Button>
                            </CardFooter>
                        </form>
                    </AccordionContent>
                </Card>
            </AccordionItem>
        </Accordion>

        <Tabs defaultValue="schedule" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="schedule">Schedule ({pickups.length})</TabsTrigger>
                <TabsTrigger value="subscriptions">Subscriptions ({subscriptions.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="schedule" className="mt-6">
                 <Card>
                    <CardHeader className="flex-row items-center justify-between">
                        <div>
                            <CardTitle>Scheduled Pickup List</CardTitle>
                            <CardDescription>A list of all upcoming pickup dates for this plan.</CardDescription>
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
                            {renderAddButton()}
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
                        <CardDescription>A list of all users subscribed to this Veggie Box Plan.</CardDescription>
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
                                            {subscriptionSearch ? "No matching subscribers found." : "No one has subscribed to this plan yet."}
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
                <DialogDescription>Describe what's in the box for this date.</DialogDescription>
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
            <AlertDialogDescription>
              {pickupToDelete && isBefore(new Date(pickupToDelete.pickupDate.replace(/-/g, '\/')), startOfToday()) && (
                <span className="font-bold text-destructive">Warning: You are deleting a pickup from the past. </span> 
              )}
              This action cannot be undone. This will permanently delete the pickup scheduled for "{pickupToDelete?.pickupDate}".
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

      <AlertDialog open={isBoxDeleteDialogOpen} onOpenChange={setIsBoxDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this Veggie Box Plan?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the 
              "{box?.name}" plan and all associated data, including its Stripe product.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsBoxDeleteDialogOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteBox} className="bg-destructive hover:bg-destructive/90" disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Yes, delete plan'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
    

    
