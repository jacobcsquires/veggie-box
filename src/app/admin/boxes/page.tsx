
'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { collection, onSnapshot, addDoc, serverTimestamp, getDocs, query, where, orderBy, limit, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, FilePen, Package, Users, ListTree, CalendarDays, RefreshCw, EyeOff, Trash2, Clock, ListChecks } from 'lucide-react';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import type { Box, Pickup, PricingOption, AddOn } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

type BoxWithSchedule = Box & { nextPickup?: string; totalPickups: number };
type PickupInternal = Omit<Pickup, 'boxId' | 'boxName'>;

const isValidDate = (d: any) => d instanceof Date && !isNaN(d.getTime());

type DisplayProduct = (BoxWithSchedule & { productType: 'box' }) | (AddOn & { productType: 'addon' });


const ProductGrid = ({ products, isLoading, onEditAddon, onDeleteAddon }: { products: DisplayProduct[], isLoading: boolean, onEditAddon: (addon: AddOn) => void, onDeleteAddon: (addon: AddOn) => void }) => {
    
    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                    <Card key={i} className="flex flex-col">
                        <CardHeader className="p-0">
                            <Skeleton className="rounded-t-lg aspect-video" />
                        </CardHeader>
                        <CardContent className="p-4 space-y-3 flex-1">
                             <Skeleton className="h-7 w-48 mt-4" />
                            <div className="space-y-4 pt-4">
                                <div className="flex justify-between items-center"><Skeleton className="h-4 w-20" /><Skeleton className="h-4 w-16" /></div>
                                <div className="flex justify-between items-center"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-12" /></div>
                            </div>
                        </CardContent>
                         <CardFooter className="flex-col gap-2 items-stretch p-4">
                            <Skeleton className="h-9 w-full mt-2" />
                        </CardFooter>
                    </Card>
                ))}
            </div>
        )
    }

    if (products.length === 0) {
        return (
            <div className="text-center text-muted-foreground py-10 border rounded-lg">
                <p>No products created yet. Click "Add Product" to get started.</p>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map(product => {
                if (product.productType === 'box') {
                    const box = product;
                    const startDateObj = box.startDate ? new Date(box.startDate.replace(/-/g, '\/')) : null;
                    const endDateObj = box.endDate ? new Date(box.endDate.replace(/-/g, '\/')) : null;
                    const formattedStartDate = startDateObj && isValidDate(startDateObj) ? format(startDateObj, 'MM/dd/yy') : 'N/A';
                    const formattedEndDate = endDateObj && isValidDate(endDateObj) ? format(endDateObj, 'MM/dd/yy') : 'N/A';
                    const isSoldOut = (box.subscribedCount || 0) >= box.quantity;
                    const basePrice = box.pricingOptions?.[0]?.price ?? 0;
                    return (
                         <Card key={box.id} className="flex flex-col">
                            <CardHeader className="p-0 relative">
                              <Image src={box.image} alt={box.name} width={400} height={200} className="rounded-t-lg object-cover aspect-video w-full" />
                               <Badge className="absolute top-2 right-2" variant="secondary">Veggie Box</Badge>
                            </CardHeader>
                            <CardContent className="p-4 space-y-3 flex-1">
                                <CardTitle className="text-xl font-headline pt-0">{box.name}</CardTitle>
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
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium flex items-center"><ListChecks className="mr-2 h-4 w-4"/>Waitlist</span>
                                        <span>{box.waitlistCount || 0}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium flex items-center"><Clock className="mr-2 h-4 w-4" />Next Pickup</span>
                                        <span>{box.nextPickup || 'N/A'}</span>
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="flex-col gap-2 items-stretch p-4">
                                 <div className="flex items-center justify-between pt-2">
                                    <span className="text-lg font-bold">${basePrice.toFixed(2)}{box.pricingOptions?.length > 1 ? '+' : ''}</span>
                                    <Badge variant="outline" className="capitalize">{box.frequency}</Badge>
                                </div>
                                <Button asChild className="w-full mt-2">
                                    <Link href={`/admin/boxes/${box.id}`}>
                                        <FilePen className="mr-2 h-4 w-4" /> Manage Plan
                                    </Link>
                                </Button>
                            </CardFooter>
                         </Card>
                    )
                } else {
                    const addon = product;
                    return (
                        <Card key={addon.id} className="flex flex-col">
                            <CardHeader className="p-0 relative">
                                <Image src={addon.image || 'https://placehold.co/400x300.png'} alt={addon.name} width={400} height={300} className="rounded-t-lg object-cover aspect-[4/3] w-full" />
                                <Badge className="absolute top-2 right-2" variant="secondary">Add-on</Badge>
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
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                    <Button variant="outline" size="sm" onClick={() => onEditAddon(addon)}>
                                        <FilePen className="mr-2 h-4 w-4" /> Edit
                                    </Button>
                                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => onDeleteAddon(addon)}>
                                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                                    </Button>
                                </div>
                            </CardFooter>
                        </Card>
                    );
                }
            })}
        </div>
    )
}

export default function AdminProductsPage() {
  const { toast } = useToast();
  const [boxes, setBoxes] = useState<BoxWithSchedule[]>([]);
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Box Dialog State
  const [isBoxDialogOpen, setIsBoxDialogOpen] = useState(false);
  const [isSavingBox, setIsSavingBox] = useState(false);
  const [boxName, setBoxName] = useState('');
  const [boxDescription, setBoxDescription] = useState('');
  const [boxQuantity, setBoxQuantity] = useState('');
  const [boxFrequency, setBoxFrequency] = useState<'weekly' | 'bi-weekly' | 'monthly'>('weekly');
  const [boxImageFile, setBoxImageFile] = useState<File | null>(null);
  const [boxImagePreview, setBoxImagePreview] = useState<string | null>(null);
  const [boxDisplayOnWebsite, setBoxDisplayOnWebsite] = useState(true);
  const [boxManualSignupCutoff, setBoxManualSignupCutoff] = useState(false);
  const [boxPricingOptions, setBoxPricingOptions] = useState<Array<Partial<PricingOption>>>([{ name: 'Single Family Veggie Box', price: 25 }]);

  // Add-on Dialog State
  const [isAddonDialogOpen, setIsAddonDialogOpen] = useState(false);
  const [isSavingAddon, setIsSavingAddon] = useState(false);
  const [editingAddon, setEditingAddon] = useState<AddOn | null>(null);
  const [addonName, setAddonName] = useState('');
  const [addonDescription, setAddonDescription] = useState('');
  const [addonPrice, setAddonPrice] = useState('');
  const [addonFrequency, setAddonFrequency] = useState<'weekly' | 'bi-weekly' | 'monthly'>('weekly');
  const [addonImageFile, setAddonImageFile] = useState<File | null>(null);
  const [addonImagePreview, setAddonImagePreview] = useState<string | null>(null);
  
  // Add-on Delete State
  const [isDeletingAddon, setIsDeletingAddon] = useState(false);
  const [addonToDelete, setAddonToDelete] = useState<AddOn | null>(null);


  useEffect(() => {
    const unsubBoxes = onSnapshot(collection(db, 'boxes'), async (snapshot) => {
      const boxesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Box));
      
      const boxesWithSchedule: BoxWithSchedule[] = await Promise.all(boxesData.map(async (box) => {
        const today = format(new Date(), 'yyyy-MM-dd');
        const pickupsRef = collection(db, 'boxes', box.id, 'pickups');
        
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

        const allPickupsSnapshot = await getDocs(pickupsRef);
        const totalPickups = allPickupsSnapshot.size;
        
        return { ...box, nextPickup, totalPickups };
      }));
      
      setBoxes(boxesWithSchedule);
      setIsLoading(false);
    });

    const unsubAddons = onSnapshot(collection(db, 'addOns'), (snapshot) => {
        setAddOns(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AddOn)));
        setIsLoading(false);
    });

    return () => {
        unsubBoxes();
        unsubAddons();
    };
  }, []);
  
  const allProducts = useMemo(() => {
    const combined: DisplayProduct[] = [
        ...boxes.map(b => ({ ...b, productType: 'box' as const })),
        ...addOns.map(a => ({ ...a, productType: 'addon' as const }))
    ];
    combined.sort((a,b) => (a.createdAt as any)?.seconds - (b.createdAt as any)?.seconds);
    return combined;
  }, [boxes, addOns]);


  const resetBoxForm = () => {
    setBoxName('');
    setBoxDescription('');
    setBoxQuantity('');
    setBoxFrequency('weekly');
    setBoxImageFile(null);
    setBoxImagePreview(null);
    setBoxDisplayOnWebsite(true);
    setBoxManualSignupCutoff(false);
    setBoxPricingOptions([{ name: 'Single Family Veggie Box', price: 25 }]);
  };

  const handleBoxImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setBoxImageFile(file);
      setBoxImagePreview(URL.createObjectURL(file));
    }
  };

  const handleBoxPricingOptionChange = (index: number, field: keyof PricingOption, value: string | number) => {
    const newOptions = [...boxPricingOptions];
    (newOptions[index] as any)[field] = value;
    setBoxPricingOptions(newOptions);
  };

  const addBoxPricingOption = () => {
    setBoxPricingOptions([...boxPricingOptions, { name: '', price: 0 }]);
  };

  const removeBoxPricingOption = (index: number) => {
    if (boxPricingOptions.length <= 1) return;
    const newOptions = boxPricingOptions.filter((_, i) => i !== index);
    setBoxPricingOptions(newOptions);
  };
  
  const handleSaveBox = async (e: React.FormEvent) => {
    e.preventDefault();
    const validPricingOptions = boxPricingOptions.filter(opt => opt.name && (opt.price ?? 0) > 0);
    if (!boxName || !boxDescription || !boxQuantity || validPricingOptions.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please fill out all required fields, including at least one valid pricing option.',
      });
      return;
    }
    setIsSavingBox(true);

    try {
        let imageUrlToSave: string | undefined;
        
        if (boxImageFile) {
            const storageRef = ref(storage, `boxes/${Date.now()}_${boxImageFile.name}`);
            await uploadBytes(storageRef, boxImageFile);
            imageUrlToSave = await getDownloadURL(storageRef);
        }
        
        const stripeResponse = await fetch('/api/create-stripe-product', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                name: boxName, 
                description: boxDescription, 
                frequency: boxFrequency,
                pricingOptions: validPricingOptions.map(p => ({name: p.name, price: p.price}))
            }),
        });

        if (!stripeResponse.ok) {
            const error = await stripeResponse.json();
            throw new Error(error.message || 'Failed to create Stripe product.');
        }

        const { stripeProductId, newPricingOptions } = await stripeResponse.json();

        const boxData = {
          name: boxName,
          description: boxDescription,
          quantity: parseInt(boxQuantity, 10),
          image: imageUrlToSave || 'https://placehold.co/600x400.png',
          frequency: boxFrequency,
          startDate: null,
          endDate: null,
          stripeProductId,
          pricingOptions: newPricingOptions,
          displayOnWebsite: boxDisplayOnWebsite,
          manualSignupCutoff: boxManualSignupCutoff,
          subscribedCount: 0,
          waitlistCount: 0,
          hint: 'vegetable box',
          createdAt: serverTimestamp(),
        }
        await addDoc(collection(db, 'boxes'), boxData);
        toast({ title: 'Success', description: 'New Veggie Box Plan added and Stripe product created.' });
      
        resetBoxForm();
        setIsBoxDialogOpen(false);
    } catch (error: any) {
      console.error('Error saving plan: ', error);
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Could not save the Veggie Box Plan. Please try again.' });
    } finally {
      setIsSavingBox(false);
    }
  };
  
  const resetAddonForm = () => {
    setAddonName('');
    setAddonDescription('');
    setAddonPrice('');
    setAddonFrequency('weekly');
    setAddonImageFile(null);
    setAddonImagePreview(null);
    setEditingAddon(null);
  };
  
  const handleAddonImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAddonImageFile(file);
      setAddonImagePreview(URL.createObjectURL(file));
    }
  };
  
  const handleSaveAddon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addonName || !addonDescription || !addonPrice) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please fill out all required fields.' });
      return;
    }
    setIsSavingAddon(true);

    try {
        let imageUrlToSave: string | undefined = editingAddon?.image;
        
        if (addonImageFile) {
            const storageRef = ref(storage, `addOns/${Date.now()}_${addonImageFile.name}`);
            await uploadBytes(storageRef, addonImageFile);
            imageUrlToSave = await getDownloadURL(storageRef);
        }
        
        // No Stripe creation here for editing, just updating local data for now.
        // A more robust solution would update the Stripe product.
        if (editingAddon) {
            const addonRef = doc(db, 'addOns', editingAddon.id);
            await updateDoc(addonRef, {
                name: addonName,
                description: addonDescription,
                price: parseFloat(addonPrice),
                frequency: addonFrequency,
                image: imageUrlToSave,
            });
            toast({ title: 'Success', description: 'Add-on updated.' });

        } else {
             const stripeResponse = await fetch('/api/create-stripe-addon', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    name: addonName, 
                    description: addonDescription, 
                    frequency: addonFrequency,
                    price: parseFloat(addonPrice),
                    image: imageUrlToSave,
                }),
            });

            if (!stripeResponse.ok) {
                const error = await stripeResponse.json();
                throw new Error(error.message || 'Failed to create Stripe product for add-on.');
            }
            const { stripeProductId, stripePriceId } = await stripeResponse.json();

            const addOnData = {
              name: addonName,
              description: addonDescription,
              price: parseFloat(addonPrice),
              image: imageUrlToSave || 'https://placehold.co/400x300.png',
              frequency: addonFrequency,
              stripeProductId,
              stripePriceId,
              createdAt: serverTimestamp(),
            };

            await addDoc(collection(db, 'addOns'), addOnData);
            toast({ title: 'Success', description: 'New add-on created.' });
        }
      
        resetAddonForm();
        setIsAddonDialogOpen(false);
    } catch (error: any) {
      console.error('Error saving add-on: ', error);
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Could not save the add-on. Please try again.' });
    } finally {
      setIsSavingAddon(false);
    }
  };

  const confirmDeleteAddon = async () => {
    if (!addonToDelete) return;
    setIsDeletingAddon(true);
    try {
        const stripeResponse = await fetch('/api/archive-stripe-product', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stripeProductId: addonToDelete.stripeProductId }),
        });

        const result = await stripeResponse.json();
        if (!stripeResponse.ok) {
            throw new Error(result.message || 'Failed to archive Stripe product.');
        }

        await deleteDoc(doc(db, 'addOns', addonToDelete.id));

        toast({ title: 'Success', description: result.message || `Add-on "${addonToDelete.name}" has been deleted.` });
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Deletion Failed', description: error.message || 'Could not delete the add-on.' });
    } finally {
        setAddonToDelete(null);
        setIsDeletingAddon(false);
    }
  };

    const handleEditAddonClick = (addon: AddOn) => {
        setEditingAddon(addon);
        setAddonName(addon.name);
        setAddonDescription(addon.description);
        setAddonPrice(addon.price.toString());
        setAddonFrequency(addon.frequency);
        setAddonImagePreview(addon.image || null);
        setIsAddonDialogOpen(true);
    };


  const handleSync = async () => {
        setIsSyncing(true);
        try {
            const response = await fetch('/api/sync-stripe-products', {
                method: 'POST',
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.message || 'Failed to sync with Stripe.');
            }
            toast({
                title: 'Sync Complete',
                description: `${result.createdCount} created, ${result.updatedCount} updated, ${result.deletedCount || 0} archived. Subscriber counts for ${result.countsUpdated} plan(s) were corrected.`,
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Sync Error',
                description: error.message,
            });
        } finally {
            setIsSyncing(false);
        }
    };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-2">
        <h1 className="text-lg font-semibold md:text-2xl font-headline">
          Manage Products
        </h1>
        <div className="flex items-center gap-2">
            <Button onClick={handleSync} disabled={isSyncing} variant="outline" size="lg">
                <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync with Stripe'}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="lg">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Product
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => {
                    resetBoxForm();
                    setIsBoxDialogOpen(true)
                }}>
                    <Package className="mr-2 h-4 w-4" /> Veggie Box Plan
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => {
                    resetAddonForm();
                    setIsAddonDialogOpen(true)
                }}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add-on
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </div>
      
      <ProductGrid products={allProducts} isLoading={isLoading} onEditAddon={handleEditAddonClick} onDeleteAddon={setAddonToDelete} />

      {/* Add/Edit Box Dialog */}
      <Dialog open={isBoxDialogOpen} onOpenChange={(isOpen) => {
          setIsBoxDialogOpen(isOpen);
          if (!isOpen) { resetBoxForm(); }
      }}>
        <DialogContent className="sm:max-w-[600px]">
          <form onSubmit={handleSaveBox}>
            <DialogHeader>
              <DialogTitle>Add New Veggie Box Plan</DialogTitle>
              <DialogDescription>
                Fill out the details for the new Veggie Box Plan.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
              <div className="space-y-2">
                <Label htmlFor="name">Plan Name</Label>
                <Input id="name" value={boxName} onChange={(e) => setBoxName(e.target.value)} disabled={isSavingBox}/>
              </div>
              <div className="space-y-2">
                  <Label htmlFor="image">Image</Label>
                  <div className="flex items-center gap-4">
                      {boxImagePreview && <Image src={boxImagePreview} alt="Image Preview" width={80} height={80} className="rounded-md object-cover" />}
                      <Input id="image" type="file" accept="image/*" onChange={handleBoxImageChange} disabled={isSavingBox} className="max-w-xs"/>
                  </div>
              </div>
              <div className="space-y-2">
                  <Label>Pricing Options</Label>
                  <div className="space-y-3 rounded-md border p-4">
                      {boxPricingOptions.map((option, index) => (
                          <div key={index} className="grid grid-cols-12 gap-2 items-center">
                              <div className="col-span-5 space-y-1">
                                  <Label htmlFor={`price-name-${index}`} className="text-xs text-muted-foreground">Option Name</Label>
                                  <Input id={`price-name-${index}`} placeholder="e.g. Single Share" value={option.name} onChange={(e) => handleBoxPricingOptionChange(index, 'name', e.target.value)} disabled={isSavingBox} />
                              </div>
                              <div className="col-span-5 space-y-1">
                                  <Label htmlFor={`price-value-${index}`} className="text-xs text-muted-foreground">Price ($)</Label>
                                  <Input id={`price-value-${index}`} type="number" placeholder="25.00" value={option.price} onChange={(e) => handleBoxPricingOptionChange(index, 'price', parseFloat(e.target.value))} disabled={isSavingBox} />
                              </div>
                              <div className="col-span-2 pt-5">
                                  <Button type="button" variant="ghost" size="icon" onClick={() => removeBoxPricingOption(index)} disabled={boxPricingOptions.length <= 1 || isSavingBox}>
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                              </div>
                          </div>
                      ))}
                      <Button type="button" variant="outline" size="sm" onClick={addBoxPricingOption} disabled={isSavingBox}>
                          <PlusCircle className="mr-2 h-4 w-4"/> Add Option
                      </Button>
                  </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <Label htmlFor="frequency">Frequency</Label>
                      <Select value={boxFrequency} onValueChange={(value) => setBoxFrequency(value as any)} disabled={isSavingBox}>
                          <SelectTrigger><SelectValue placeholder="Select frequency" /></SelectTrigger>
                          <SelectContent>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                          </SelectContent>
                      </Select>
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="quantity">Quantity Available</Label>
                      <Input id="quantity" type="number" value={boxQuantity} onChange={(e) => setBoxQuantity(e.target.value)} disabled={isSavingBox}/>
                  </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={boxDescription} onChange={(e) => setBoxDescription(e.target.value)} disabled={isSavingBox} />
              </div>
              <div className="space-y-4 rounded-md border p-4">
                  <Label className="text-base">Settings</Label>
                  <div className="space-y-2">
                     <Label>Display on public website</Label>
                      <RadioGroup
                          value={boxDisplayOnWebsite ? "true" : "false"}
                          onValueChange={(value) => setBoxDisplayOnWebsite(value === "true")}
                          className="flex items-center space-x-4"
                          disabled={isSavingBox}
                      >
                          <div className="flex items-center space-x-2">
                              <RadioGroupItem value="true" id="display-on-add" />
                              <Label htmlFor="display-on-add" className="font-normal">On</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                              <RadioGroupItem value="false" id="display-off-add" />
                              <Label htmlFor="display-off-add" className="font-normal">Off</Label>
                          </div>
                      </RadioGroup>
                  </div>
                  <div className="flex items-center space-x-2">
                      <Checkbox id="manualSignupCutoff" checked={boxManualSignupCutoff} onCheckedChange={(checked) => setBoxManualSignupCutoff(Boolean(checked))} disabled={isSavingBox} />
                      <Label htmlFor="manualSignupCutoff" className="font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                          Manually turn off new sign-ups for this plan.
                      </Label>
                  </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isSavingBox}>
                {isSavingBox ? 'Saving...' : 'Save Veggie Box Plan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Add/Edit Addon Dialog */}
      <Dialog open={isAddonDialogOpen} onOpenChange={(isOpen) => {
          setIsAddonDialogOpen(isOpen);
          if (!isOpen) { resetAddonForm(); }
      }}>
        <DialogContent className="sm:max-w-[600px]">
          <form onSubmit={handleSaveAddon}>
              <DialogHeader>
              <DialogTitle>{editingAddon ? 'Edit' : 'Add New'} Add-on</DialogTitle>
              <DialogDescription>
                  Fill out the details for the add-on product.
              </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
              <div className="space-y-2">
                  <Label htmlFor="addonName">Add-on Name</Label>
                  <Input id="addonName" value={addonName} onChange={(e) => setAddonName(e.target.value)} disabled={isSavingAddon}/>
              </div>
              <div className="space-y-2">
                  <Label htmlFor="addonImage">Image</Label>
                  <div className="flex items-center gap-4">
                      {addonImagePreview && <Image src={addonImagePreview} alt="Image Preview" width={80} height={80} className="rounded-md object-cover" />}
                      <Input id="addonImage" type="file" accept="image/*" onChange={handleAddonImageChange} disabled={isSavingAddon} className="max-w-xs"/>
                  </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                      <Label htmlFor="addonPrice">Price ($)</Label>
                      <Input id="addonPrice" type="number" value={addonPrice} onChange={(e) => setAddonPrice(e.target.value)} disabled={isSavingAddon || !!editingAddon}/>
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="addonFrequency">Billing Frequency</Label>
                      <Select value={addonFrequency} onValueChange={(value) => setAddonFrequency(value as any)} disabled={isSavingAddon || !!editingAddon}>
                          <SelectTrigger><SelectValue placeholder="Select frequency" /></SelectTrigger>
                          <SelectContent>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                          </SelectContent>
                      </Select>
                  </div>
              </div>
              <div className="space-y-2">
                  <Label htmlFor="addonDescription">Description</Label>
                  <Textarea id="addonDescription" value={addonDescription} onChange={(e) => setAddonDescription(e.target.value)} disabled={isSavingAddon} />
              </div>
              </div>
              <DialogFooter>
              <Button type="submit" disabled={isSavingAddon}>
                  {isSavingAddon ? 'Saving...' : 'Save Add-on'}
              </Button>
              </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Delete Addon Dialog */}
       <AlertDialog open={!!addonToDelete} onOpenChange={(open) => !open && setAddonToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will delete the add-on and archive the product in Stripe, preventing new customers from adding it. Any existing subscriptions with this add-on will have it removed at the end of their current billing cycle.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingAddon}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteAddon} disabled={isDeletingAddon} className="bg-destructive hover:bg-destructive/90">
              {isDeletingAddon ? 'Deleting...' : 'Yes, delete it'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
