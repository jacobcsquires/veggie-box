
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { collection, onSnapshot, addDoc, serverTimestamp, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, FilePen, Calendar as CalendarIcon } from 'lucide-react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

type BoxWithSchedule = Box & { nextPickup?: string; totalPickups: number };
type PickupInternal = Omit<Pickup, 'boxId' | 'boxName'>;

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
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

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
          nextPickup = format(new Date(nextPickupDoc.pickupDate.replace(/-/g, '\/')), 'PPP');
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

  const resetForm = () => {
    setName('');
    setPrice('');
    setDescription('');
    setQuantity('');
    setImageFile(null);
    setImagePreview(null);
    setStartDate(undefined);
    setEndDate(undefined);
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

    let imageUrlToSave: string | undefined;
    
    if (imageFile) {
        try {
            const storageRef = ref(storage, `boxes/${Date.now()}_${imageFile.name}`);
            await uploadBytes(storageRef, imageFile);
            imageUrlToSave = await getDownloadURL(storageRef);
        } catch (error) {
            console.error('Error uploading image: ', error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not upload the image. Please try again.' });
            setIsSaving(false);
            return;
        }
    }

    const boxData = {
      name,
      price: parseFloat(price),
      description,
      quantity: parseInt(quantity, 10),
      image: imageUrlToSave || 'https://placehold.co/600x400.png',
      startDate: startDate ? format(startDate, 'yyyy-MM-dd') : undefined,
      endDate: endDate ? format(endDate, 'yyyy-MM-dd') : undefined,
    };

    try {
        const fullData = {
          ...boxData,
          subscribedCount: 0,
          hint: 'vegetable box',
          createdAt: serverTimestamp(),
        }
        await addDoc(collection(db, 'boxes'), fullData);
        toast({ title: 'Success', description: 'New box added successfully.' });
      
      resetForm();
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error saving document: ', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not save the box. Please try again.',
      });
    } finally {
      setIsSaving(false);
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
                      Fill out the details for the new veggie box.
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
                        <Label htmlFor="start-date" className="text-right">Start Date</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                            <Button variant={"outline"} className={cn("col-span-3 justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {startDate ? format(startDate, "PPP") : <span>Pick a date (optional)</span>}
                            </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus /></PopoverContent>
                        </Popover>
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="end-date" className="text-right">End Date</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                            <Button variant={"outline"} className={cn("col-span-3 justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {endDate ? format(endDate, "PPP") : <span>Pick an end date (optional)</span>}
                            </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={endDate} onSelect={setEndDate} disabled={(date) => startDate ? date < startDate : false} initialFocus /></PopoverContent>
                        </Popover>
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
      <Card>
        <CardHeader>
          <CardTitle>Veggie Boxes</CardTitle>
          <CardDescription>
            A list of all available veggie boxes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Next Pickup</TableHead>
                <TableHead>Total # of Pickups</TableHead>
                <TableHead className="hidden md:table-cell">
                  Subscribers
                </TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-10" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-12 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : boxes.map((box) => (
                <TableRow key={box.id} onClick={() => router.push(`/admin/boxes/${box.id}`)} className="cursor-pointer">
                  <TableCell className="font-medium">{box.name}</TableCell>
                  <TableCell>{box.startDate ? format(new Date(box.startDate.replace(/-/g, '/')), 'PPP') : 'N/A'}</TableCell>
                  <TableCell>{box.endDate ? format(new Date(box.endDate.replace(/-/g, '/')), 'PPP') : 'N/A'}</TableCell>
                  <TableCell>{box.nextPickup || "Not scheduled"}</TableCell>
                  <TableCell>{box.totalPickups}</TableCell>
                  <TableCell className="hidden md:table-cell">{box.subscribedCount} / {box.quantity}</TableCell>
                  <TableCell className="text-right">${box.price.toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="outline" onClick={(e) => e.stopPropagation()}>
                        <Link href={`/admin/boxes/${box.id}`}>
                            <FilePen className="h-4 w-4 mr-2" />
                            Edit Box
                        </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter>
          <div className="text-xs text-muted-foreground">
            Showing <strong>1-{boxes.length}</strong> of{' '}
            <strong>{boxes.length}</strong> boxes
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
