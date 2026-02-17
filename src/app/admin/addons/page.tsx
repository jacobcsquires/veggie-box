
'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { collection, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Trash2 } from 'lucide-react';
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
import type { AddOn } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function AdminAddOnsPage() {
  const { toast } = useToast();
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [frequency, setFrequency] = useState<'weekly' | 'bi-weekly' | 'monthly'>('weekly');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // Delete state
  const [isDeleting, setIsDeleting] = useState(false);
  const [addOnToDelete, setAddOnToDelete] = useState<AddOn | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'addOns'), (snapshot) => {
      const data = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as AddOn)
      );
      setAddOns(data);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const resetForm = () => {
    setName('');
    setDescription('');
    setPrice('');
    setFrequency('weekly');
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
  
  const handleSaveAddOn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !description || !price) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please fill out all required fields.',
      });
      return;
    }
    setIsSaving(true);

    try {
        let imageUrlToSave: string | undefined;
        
        if (imageFile) {
            const storageRef = ref(storage, `addOns/${Date.now()}_${imageFile.name}`);
            await uploadBytes(storageRef, imageFile);
            imageUrlToSave = await getDownloadURL(storageRef);
        }
        
        const stripeResponse = await fetch('/api/create-stripe-addon', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                name, 
                description, 
                frequency,
                price: parseFloat(price),
                image: imageUrlToSave,
            }),
        });

        if (!stripeResponse.ok) {
            const error = await stripeResponse.json();
            throw new Error(error.message || 'Failed to create Stripe product for add-on.');
        }

        const { stripeProductId, stripePriceId } = await stripeResponse.json();

        const addOnData = {
          name,
          description,
          price: parseFloat(price),
          image: imageUrlToSave || 'https://placehold.co/400x300.png',
          frequency,
          stripeProductId,
          stripePriceId,
          createdAt: serverTimestamp(),
        };

        await addDoc(collection(db, 'addOns'), addOnData);
        toast({ title: 'Success', description: 'New add-on created.' });
      
        resetForm();
        setIsDialogOpen(false);
    } catch (error: any) {
      console.error('Error saving add-on: ', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Could not save the add-on. Please try again.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDeleteAddOn = async () => {
    if (!addOnToDelete) return;
    setIsDeleting(true);
    try {
        const stripeResponse = await fetch('/api/archive-stripe-product', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stripeProductId: addOnToDelete.stripeProductId }),
        });

        const result = await stripeResponse.json();
        if (!stripeResponse.ok) {
            throw new Error(result.message || 'Failed to archive Stripe product.');
        }

        // Then, delete the document from Firestore
        await deleteDoc(doc(db, 'addOns', addOnToDelete.id));

        toast({ title: 'Success', description: result.message || `Add-on "${addOnToDelete.name}" has been deleted.` });
    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'Deletion Failed',
            description: error.message || 'Could not delete the add-on.',
        });
    } finally {
        setAddOnToDelete(null);
        setIsDeleting(false);
    }
  };


  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-2">
        <h1 className="text-lg font-semibold md:text-2xl font-headline">
          Manage Add-ons
        </h1>
        <Dialog open={isDialogOpen} onOpenChange={(isOpen) => {
            setIsDialogOpen(isOpen);
            if (!isOpen) {
                resetForm();
            }
        }}>
            <DialogTrigger asChild>
            <Button size="lg">
                <PlusCircle className="mr-2 h-4 w-4" />
                New Add-on
            </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
            <form onSubmit={handleSaveAddOn}>
                <DialogHeader>
                <DialogTitle>Add New Add-on</DialogTitle>
                <DialogDescription>
                    Fill out the details for the new add-on product.
                </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Add-on Name</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} disabled={isSaving}/>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="image">Image</Label>
                    <div className="flex items-center gap-4">
                        {imagePreview && <Image src={imagePreview} alt="Image Preview" width={80} height={80} className="rounded-md object-cover" />}
                        <Input id="image" type="file" accept="image/*" onChange={handleImageChange} disabled={isSaving} className="max-w-xs"/>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                        <Label htmlFor="price">Price ($)</Label>
                        <Input id="price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} disabled={isSaving}/>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="frequency">Billing Frequency</Label>
                        <Select value={frequency} onValueChange={(value) => setFrequency(value as any)} disabled={isSaving}>
                            <SelectTrigger><SelectValue placeholder="Select frequency" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="weekly">Weekly</SelectItem>
                                <SelectItem value="bi-weekly">Bi-weekly (every 2 weeks)</SelectItem>
                                <SelectItem value="monthly">Monthly</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                
                <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} disabled={isSaving} />
                </div>
                </div>
                <DialogFooter>
                <Button type="submit" disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save Add-on'}
                </Button>
                </DialogFooter>
            </form>
            </DialogContent>
        </Dialog>
      </div>

        {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-80 w-full" />)}
            </div>
        ) : addOns.length === 0 ? (
            <div className="text-center text-muted-foreground py-10 border rounded-lg">
                <p>No add-ons created yet. Click "New Add-on" to get started.</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {addOns.map(addon => (
                    <Card key={addon.id} className="flex flex-col">
                        <CardHeader className="p-0">
                            <Image src={addon.image || 'https://placehold.co/400x300.png'} alt={addon.name} width={400} height={300} className="rounded-t-lg object-cover aspect-[4/3] w-full" />
                        </CardHeader>
                        <CardContent className="p-4 space-y-2 flex-1">
                            <CardTitle className="text-lg font-headline pt-0">{addon.name}</CardTitle>
                            <CardDescription className="text-sm">{addon.description}</CardDescription>
                        </CardContent>
                        <CardFooter className="flex-col gap-2 items-stretch p-4">
                            <div className="flex items-center justify-between pt-2">
                            <span className="text-lg font-bold">${addon.price.toFixed(2)}</span>
                            <Badge variant="outline" className="capitalize">{addon.frequency}</Badge>
                            </div>
                            <Button variant="ghost" size="sm" className="w-full mt-2 text-destructive hover:text-destructive" onClick={() => setAddOnToDelete(addon)}>
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>
        )}

      <AlertDialog open={!!addOnToDelete} onOpenChange={(open) => !open && setAddOnToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will delete the add-on and archive the product in Stripe, preventing new customers from adding it. Any existing subscriptions with this add-on will have it removed at the end of their current billing cycle.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteAddOn} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
              {isDeleting ? 'Deleting...' : 'Yes, delete it'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
