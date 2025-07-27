
'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { collection, onSnapshot, addDoc, serverTimestamp, getDocs, query, where, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, FilePen, Calendar as CalendarIcon, Package, Archive, Users, ListTree, CalendarDays, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { Box, Pickup } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type BoxWithSchedule = Box & { nextPickup?: string; totalPickups: number };
type PickupInternal = Omit<Pickup, 'boxId' | 'boxName'>;

const isValidDate = (d: any) => d instanceof Date && !isNaN(d.getTime());

const BoxGrid = ({ boxes, isLoading, onSync }: { boxes: BoxWithSchedule[], isLoading: boolean, onSync: (box: Box) => void }) => {
    const [syncingBoxId, setSyncingBoxId] = useState<string | null>(null);

    const handleSyncClick = async (box: Box) => {
        setSyncingBoxId(box.id);
        await onSync(box);
        setSyncingBoxId(null);
    }
    
    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                    <Card key={i}>
                        <CardHeader>
                            <Skeleton className="rounded-lg aspect-video" />
                            <Skeleton className="h-7 w-48 mt-4" />
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center"><Skeleton className="h-4 w-20" /><Skeleton className="h-4 w-16" /></div>
                                <div className="flex justify-between items-center"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-12" /></div>
                                <div className="flex justify-between items-center"><Skeleton className="h-4 w-28" /><Skeleton className="h-4 w-10" /></div>
                                <div className="flex justify-between items-center"><Skeleton className="h-4 w-20" /><Skeleton className="h-4 w-16" /></div>
                            </div>
                        </CardContent>
                         <CardFooter>
                            <Skeleton className="h-9 w-full" />
                        </CardFooter>
                    </Card>
                ))}
            </div>
        )
    }

    if (boxes.length === 0) {
        return (
            <div className="text-center text-muted-foreground py-10">
                <p>No boxes to display in this category.</p>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {boxes.map(box => {
                 const startDateObj = box.startDate ? new Date(box.startDate.replace(/-/g, '\/')) : null;
                 const endDateObj = box.endDate ? new Date(box.endDate.replace(/-/g, '\/')) : null;
                 const formattedStartDate = startDateObj && isValidDate(startDateObj) ? format(startDateObj, 'MM/dd/yy') : 'N/A';
                 const formattedEndDate = endDateObj && isValidDate(endDateObj) ? format(endDateObj, 'MM/dd/yy') : 'N/A';
                 const isSoldOut = (box.subscribedCount || 0) >= box.quantity;
                 const isSyncing = syncingBoxId === box.id;
                return (
                     <Card key={box.id}>
                        <CardHeader className="p-0">
                            <Image src={box.image} alt={box.name} width={400} height={200} className="rounded-t-lg object-cover aspect-video" />
                        </CardHeader>
                        <CardContent className="p-4 space-y-3">
                            <CardTitle className="text-xl font-headline">{box.name}</CardTitle>
                            <div className="text-sm text-muted-foreground space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="font-medium flex items-center"><CalendarDays className="mr-2 h-4 w-4"/>Schedule</span>
                                    <span>{formattedStartDate} - {formattedEndDate}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="font-medium flex items-center"><ListTree className="mr-2 h-4 w-4" />Pickups</span>
                                    <span>{box.totalPickups} total</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="font-medium flex items-center"><Users className="mr-2 h-4 w-4" />Subscribers</span>
                                    <Badge variant={isSoldOut ? 'destructive' : 'secondary'}>{box.subscribedCount} / {box.quantity}</Badge>
                                </div>
                                <div className="flex items-center justify-between pt-2">
                                    <span className="text-lg font-bold">${box.price.toFixed(2)}</span>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="flex-col gap-2 items-stretch">
                            <Button asChild className="w-full">
                                <Link href={`/admin/boxes/${box.id}`}>
                                    <FilePen className="mr-2 h-4 w-4" /> Edit Box
                                </Link>
                            </Button>
                            {!box.stripePriceId && (
                                <Button variant="outline" className="w-full" onClick={() => handleSyncClick(box)} disabled={isSyncing}>
                                    {isSyncing ? (
                                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <RefreshCw className="mr-2 h-4 w-4" />
                                    )}
                                    {isSyncing ? 'Syncing...' : 'Sync with Stripe'}
                                </Button>
                            )}
                        </CardFooter>
                     </Card>
                )
            })}
        </div>
    )
}

export default function AdminBoxesPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [boxes, setBoxes] = useState<BoxWithSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'boxes'), async (snapshot) => {
      const boxesData = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Box)
      );
      
      const boxesWithSchedule: BoxWithSchedule[] = await Promise.all(boxesData.map(async (box) => {
        const today = format(new Date(), 'yyyy-MM-dd');
        const pickupsRef = collection(db, 'boxes', box.id, 'pickups');
        
        // Query for next pickup
        const nextPickupQuery = query(pickupsRef, where('pickupDate', '>=', today), orderBy('pickupDate'), limit(1));
        const nextPickupSnapshot = await getDocs(nextPickupQuery);
        
        let nextPickup;
        if (!nextPickupSnapshot.empty) {
          const nextPickupDoc = nextPickupSnapshot.docs[0].data() as PickupInternal;
          const pickupDate = new Date(nextPickupDoc.pickupDate.replace(/-/g, '\/'));
          if (isValidDate(pickupDate)) {
            nextPickup = format(pickupDate, 'PPP');
          }
        }

        // Query for total pickups count
        const allPickupsSnapshot = await getDocs(pickupsRef);
        const totalPickups = allPickupsSnapshot.size;
        
        return { ...box, nextPickup, totalPickups };
      }));
      
      setBoxes(boxesWithSchedule);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);
  
  const { activeBoxes, pastBoxes } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const active: BoxWithSchedule[] = [];
    const past: BoxWithSchedule[] = [];

    boxes.forEach(box => {
        const endDateObj = box.endDate ? new Date(box.endDate.replace(/-/g, '\/')) : null;

        if (endDateObj && isValidDate(endDateObj) && endDateObj < today) {
            past.push(box);
        } else {
            active.push(box);
        }
    });
    return { activeBoxes: active, pastBoxes: past };
  }, [boxes]);

  const resetForm = () => {
    setName('');
    setPrice('');
    setDescription('');
    setQuantity('');
    setImageFile(null);
    setImagePreview(null);
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
    if (!name || !price || !description || !quantity) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please fill out name, price, quantity, and description.',
      });
      return;
    }
    setIsSaving(true);

    try {
        let imageUrlToSave: string | undefined;
        
        if (imageFile) {
            const storageRef = ref(storage, `boxes/${Date.now()}_${imageFile.name}`);
            await uploadBytes(storageRef, imageFile);
            imageUrlToSave = await getDownloadURL(storageRef);
        }
        
        const stripeResponse = await fetch('/api/create-stripe-product', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description, price: parseFloat(price) }),
        });

        if (!stripeResponse.ok) {
            const error = await stripeResponse.json();
            throw new Error(error.message || 'Failed to create Stripe product.');
        }

        const { stripeProductId, stripePriceId } = await stripeResponse.json();

        const boxData = {
          name,
          price: parseFloat(price),
          description,
          quantity: parseInt(quantity, 10),
          image: imageUrlToSave || 'https://placehold.co/600x400.png',
          startDate: null,
          endDate: null,
          stripeProductId,
          stripePriceId,
        };

        const fullData = {
          ...boxData,
          subscribedCount: 0,
          hint: 'vegetable box',
          createdAt: serverTimestamp(),
        }
        await addDoc(collection(db, 'boxes'), fullData);
        toast({ title: 'Success', description: 'New box added and Stripe product created.' });
      
        resetForm();
        setIsDialogOpen(false);
    } catch (error: any) {
      console.error('Error saving box: ', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Could not save the box. Please try again.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSyncWithStripe = async (box: Box) => {
    try {
        const { name, description, price } = box;
        const stripeResponse = await fetch('/api/create-stripe-product', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description, price }),
        });

        if (!stripeResponse.ok) {
            const error = await stripeResponse.json();
            throw new Error(error.message || 'Failed to create Stripe product.');
        }
        
        const { stripeProductId, stripePriceId } = await stripeResponse.json();

        const boxRef = doc(db, 'boxes', box.id);
        await updateDoc(boxRef, { stripeProductId, stripePriceId });

        toast({ title: 'Success', description: `Box "${box.name}" has been synced with Stripe.` });

    } catch (error: any) {
        console.error('Error syncing box with Stripe: ', error);
        toast({
            variant: 'destructive',
            title: 'Stripe Sync Failed',
            description: error.message || 'Could not sync the box with Stripe. Please try again.',
        });
    }
  };


  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-2">
        <h1 className="text-lg font-semibold md:text-2xl font-headline">
          Manage Boxes
        </h1>
        <div className="flex items-center gap-2">
            <Dialog open={isDialogOpen} onOpenChange={(isOpen) => {
                setIsDialogOpen(isOpen);
                if (!isOpen) {
                    resetForm();
                }
            }}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-8 gap-1">
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                    Add Box
                  </span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <form onSubmit={handleSaveBox}>
                  <DialogHeader>
                    <DialogTitle>Add New Box</DialogTitle>
                    <DialogDescription>
                      Fill out the details for the new veggie box. This will also create a new product and price in Stripe.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="name" className="text-right">
                        Name
                      </Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="col-span-3"
                        disabled={isSaving}
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="image" className="text-right">
                        Image
                      </Label>
                      <div className="col-span-3">
                        <Input
                          id="image"
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          disabled={isSaving}
                        />
                        {imagePreview && (
                          <Image src={imagePreview} alt="Image Preview" width={100} height={100} className="mt-2 rounded-md object-cover" />
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="price" className="text-right">
                        Price
                      </Label>
                      <Input
                        id="price"
                        type="number"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="col-span-3"
                        disabled={isSaving}
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="quantity" className="text-right">
                        Quantity
                      </Label>
                      <Input
                        id="quantity"
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        className="col-span-3"
                        disabled={isSaving}
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="description" className="text-right">
                        Description
                      </Label>
                      <Textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="col-span-3"
                        disabled={isSaving}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={isSaving}>
                      {isSaving ? 'Saving...' : 'Save box'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
        </div>
      </div>
      <Tabs defaultValue="active">
        <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="active"><Package className="mr-2 h-4 w-4" />Active Boxes ({activeBoxes.length})</TabsTrigger>
            <TabsTrigger value="past"><Archive className="mr-2 h-4 w-4" />Past Boxes ({pastBoxes.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="mt-4">
           <BoxGrid boxes={activeBoxes} isLoading={isLoading} onSync={handleSyncWithStripe} />
        </TabsContent>
        <TabsContent value="past" className="mt-4">
            <BoxGrid boxes={pastBoxes} isLoading={isLoading} onSync={handleSyncWithStripe} />
        </TabsContent>
      </Tabs>
    </div>
  );

    