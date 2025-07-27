
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { collection, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { MoreHorizontal, PlusCircle, X, Calendar as CalendarIcon, Trash2 } from 'lucide-react';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { Box } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';


export default function AdminBoxesPage() {
  const { toast } = useToast();
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [boxToDelete, setBoxToDelete] = useState<Box | null>(null);


  // Form state
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);


  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'boxes'), (snapshot) => {
      const boxesData = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Box)
      );
      setBoxes(boxesData);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const resetForm = () => {
    setName('');
    setPrice('');
    setDescription('');
    setQuantity('');
    setStartDate('');
    setEndDate('');
    setImageFile(null);
    setImagePreview(null);
  };
  
  const handleDeleteClick = (box: Box) => {
    setBoxToDelete(box);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!boxToDelete) return;
    try {
      await deleteDoc(doc(db, 'boxes', boxToDelete.id));
      toast({
        title: 'Success',
        description: `Box "${boxToDelete.name}" has been deleted.`,
      });
    } catch (error) {
      console.error('Error deleting box: ', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not delete the box. Please try again.',
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setBoxToDelete(null);
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
      startDate,
      endDate,
      image: imageUrlToSave || 'https://placehold.co/600x400.png',
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
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="startDate" className="text-right">
                        Start Date
                      </Label>
                      <Input
                        id="startDate"
                        type="text"
                        placeholder="e.g. Mid-June"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="col-span-3"
                        disabled={isSaving}
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="endDate" className="text-right">
                        End Date
                      </Label>
                      <Input
                        id="endDate"
                        type="text"
                        placeholder="e.g. Late August"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
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
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">
                  Inventory
                </TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-10" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-12 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : boxes.map((box) => (
                <TableRow key={box.id}>
                  <TableCell className="font-medium">{box.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">Active</Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{box.subscribedCount} / {box.quantity}</TableCell>
                  <TableCell className="text-right">${box.price}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          aria-haspopup="true"
                          size="icon"
                          variant="ghost"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Toggle menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem asChild>
                            <Link href={`/admin/boxes/${box.id}`} className="cursor-pointer">
                                Edit
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => handleDeleteClick(box)} className="text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" />
                          <span>Delete</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the 
              "{boxToDelete?.name}" box and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
              Yes, delete box
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
