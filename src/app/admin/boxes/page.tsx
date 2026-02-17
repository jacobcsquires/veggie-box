
'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { collection, onSnapshot, addDoc, serverTimestamp, getDocs, query, where, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, FilePen, Calendar as CalendarIcon, Package, Archive, Users, ListTree, CalendarDays, RefreshCw, Eye, Code, EyeOff, Trash2, Clock, ListChecks } from 'lucide-react';
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
import type { Box, Pickup, PricingOption } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

type BoxWithSchedule = Box & { nextPickup?: string; totalPickups: number };
type PickupInternal = Omit<Pickup, 'boxId' | 'boxName'>;

const isValidDate = (d: any) => d instanceof Date && !isNaN(d.getTime());

const BoxGrid = ({ boxes, isLoading }: { boxes: BoxWithSchedule[], isLoading: boolean }) => {
    
    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                    <Card key={i} className="flex flex-col">
                        <CardHeader className="p-0">
                            <Skeleton className="rounded-t-lg aspect-video" />
                        </CardHeader>
                        <CardContent className="p-4 space-y-3 flex-1">
                             <Skeleton className="h-7 w-48 mt-4" />
                            <div className="space-y-4">
                                <div className="flex justify-between items-center"><Skeleton className="h-4 w-20" /><Skeleton className="h-4 w-16" /></div>
                                <div className="flex justify-between items-center"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-12" /></div>
                                <div className="flex justify-between items-center"><Skeleton className="h-4 w-28" /><Skeleton className="h-4 w-10" /></div>
                            </div>
                        </CardContent>
                         <CardFooter className="flex-col gap-2 items-stretch p-4">
                            <div className="flex items-center justify-between pt-2">
                                <Skeleton className="h-7 w-20" />
                                <Skeleton className="h-6 w-20" />
                            </div>
                            <Skeleton className="h-9 w-full mt-2" />
                        </CardFooter>
                    </Card>
                ))}
            </div>
        )
    }

    if (boxes.length === 0) {
        return (
            <div className="text-center text-muted-foreground py-10">
                <p>No Veggie Box Plans to display in this category.</p>
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
                 const basePrice = box.pricingOptions?.[0]?.price ?? 0;
                return (
                     <Card key={box.id} className="flex flex-col">
                        <CardHeader className="p-0">
                          <Image src={box.image} alt={box.name} width={400} height={200} className="rounded-t-lg object-cover aspect-video w-full" />
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
                                    <FilePen className="mr-2 h-4 w-4" /> Edit Plan
                                </Link>
                            </Button>
                        </CardFooter>
                     </Card>
                )
            })}
        </div>
    )
}

const EmbedCodeDialog = () => {
    const { toast } = useToast();
    const [embedCode, setEmbedCode] = useState('');

    useEffect(() => {
        const url = new URL('/embed', window.location.origin);
        setEmbedCode(`<iframe src="${url.href}" width="100%" height="600" style="border:none;"></iframe>`);
    }, []);

    const copyToClipboard = () => {
        navigator.clipboard.writeText(embedCode).then(() => {
            toast({ title: 'Success', description: 'Embed code copied to clipboard.' });
        }, () => {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to copy embed code.' });
        });
    };
    
    return (
         <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" size="lg">
                  <Code className="mr-2 h-4 w-4" />
                  Embed Plans
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Embed Active Veggie Box Plans</DialogTitle>
                    <DialogDescription>
                        Copy and paste this code into your website (e.g., a Wix HTML block) to display a live list of your available Veggie Box Plans.
                    </DialogDescription>
                </DialogHeader>
                 <div className="bg-muted rounded-md p-4 font-mono text-sm text-muted-foreground overflow-x-auto">
                    <pre><code>{embedCode}</code></pre>
                </div>
                 <DialogFooter>
                    <Button onClick={copyToClipboard}>Copy Code</Button>
                 </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default function AdminBoxesPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [boxes, setBoxes] = useState<BoxWithSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Form state
  const defaultPricingOptions = [
    { name: 'Single Family Veggie Box', price: 25 },
    { name: 'Single Family Veggie Box Bi-Weekly + Support Another Family', price: 50 },
  ];
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('');
  const [frequency, setFrequency] = useState<'weekly' | 'bi-weekly' | 'monthly'>('weekly');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [displayOnWebsite, setDisplayOnWebsite] = useState(true);
  const [manualSignupCutoff, setManualSignupCutoff] = useState(false);
  const [pricingOptions, setPricingOptions] = useState<Array<Partial<PricingOption>>>(defaultPricingOptions);


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
  
  const { activePublicBoxes, activeUnlistedBoxes, pastBoxes } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activePublic: BoxWithSchedule[] = [];
    const activeUnlisted: BoxWithSchedule[] = [];
    const past: BoxWithSchedule[] = [];

    boxes.forEach(box => {
        const endDateObj = box.endDate ? new Date(box.endDate.replace(/-/g, '\/')) : null;

        if (endDateObj && isValidDate(endDateObj) && endDateObj < today) {
            past.push(box);
        } else {
            if (box.displayOnWebsite) {
                activePublic.push(box);
            } else {
                activeUnlisted.push(box);
            }
        }
    });
    return { activePublicBoxes: activePublic, activeUnlistedBoxes: activeUnlisted, pastBoxes: past };
  }, [boxes]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setQuantity('');
    setFrequency('weekly');
    setImageFile(null);
    setImagePreview(null);
    setDisplayOnWebsite(true);
    setManualSignupCutoff(false);
    setPricingOptions(defaultPricingOptions);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
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
    if (!name || !description || !quantity || validPricingOptions.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please fill out all required fields, including at least one valid pricing option.',
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
            body: JSON.stringify({ 
                name, 
                description, 
                frequency,
                pricingOptions: validPricingOptions.map(p => ({name: p.name, price: p.price}))
            }),
        });

        if (!stripeResponse.ok) {
            const error = await stripeResponse.json();
            throw new Error(error.message || 'Failed to create Stripe product.');
        }

        const { stripeProductId, newPricingOptions } = await stripeResponse.json();

        const boxData = {
          name,
          description,
          quantity: parseInt(quantity, 10),
          image: imageUrlToSave || 'https://placehold.co/600x400.png',
          frequency,
          startDate: null,
          endDate: null,
          stripeProductId,
          pricingOptions: newPricingOptions,
          displayOnWebsite,
          manualSignupCutoff,
        };

        const fullData = {
          ...boxData,
          subscribedCount: 0,
          waitlistCount: 0,
          hint: 'vegetable box',
          createdAt: serverTimestamp(),
        }
        await addDoc(collection(db, 'boxes'), fullData);
        toast({ title: 'Success', description: 'New Veggie Box Plan added and Stripe product created.' });
      
        resetForm();
        setIsDialogOpen(false);
    } catch (error: any) {
      console.error('Error saving plan: ', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Could not save the Veggie Box Plan. Please try again.',
      });
    } finally {
      setIsSaving(false);
    }
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
          Manage Veggie Box Plans
        </h1>
        <div className="flex items-center gap-2">
            <EmbedCodeDialog />
            <Button onClick={handleSync} disabled={isSyncing} variant="outline" size="lg">
                <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync with Stripe'}
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={(isOpen) => {
                setIsDialogOpen(isOpen);
                if (!isOpen) {
                    resetForm();
                }
            }}>
              <DialogTrigger asChild>
                <Button size="lg">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Plan
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <form onSubmit={handleSaveBox}>
                  <DialogHeader>
                    <DialogTitle>Add New Veggie Box Plan</DialogTitle>
                    <DialogDescription>
                      Fill out the details for the new Veggie Box Plan. This will also create a new product and price in Stripe.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Plan Name</Label>
                      <Input id="name" value={name} onChange={(e) => setName(e.target.value)} disabled={isSaving}/>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="image">Image</Label>
                        <div className="flex items-center gap-4">
                            {imagePreview && <Image src={imagePreview} alt="Image Preview" width={80} height={80} className="rounded-md object-cover" />}
                            <Input id="image" type="file" accept="image/*" onChange={handleImageChange} disabled={isSaving} className="max-w-xs"/>
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                        <Label>Pricing Options</Label>
                        <div className="space-y-3 rounded-md border p-4">
                            {pricingOptions.map((option, index) => (
                                <div key={index} className="grid grid-cols-12 gap-2 items-center">
                                    <div className="col-span-5 space-y-1">
                                        <Label htmlFor={`price-name-${index}`} className="text-xs text-muted-foreground">Option Name</Label>
                                        <Input id={`price-name-${index}`} placeholder="e.g. Single Share" value={option.name} onChange={(e) => handlePricingOptionChange(index, 'name', e.target.value)} disabled={isSaving} />
                                    </div>
                                    <div className="col-span-5 space-y-1">
                                        <Label htmlFor={`price-value-${index}`} className="text-xs text-muted-foreground">Price ($)</Label>
                                        <Input id={`price-value-${index}`} type="number" placeholder="25.00" value={option.price} onChange={(e) => handlePricingOptionChange(index, 'price', parseFloat(e.target.value))} disabled={isSaving} />
                                    </div>
                                    <div className="col-span-2 pt-5">
                                        <Button type="button" variant="ghost" size="icon" onClick={() => removePricingOption(index)} disabled={pricingOptions.length <= 1 || isSaving}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                            <Button type="button" variant="outline" size="sm" onClick={addPricingOption} disabled={isSaving}>
                                <PlusCircle className="mr-2 h-4 w-4"/> Add Option
                            </Button>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2">
                            <Label htmlFor="frequency">Frequency</Label>
                            <Select value={frequency} onValueChange={(value) => setFrequency(value as any)} disabled={isSaving}>
                                <SelectTrigger><SelectValue placeholder="Select frequency" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="weekly">Weekly</SelectItem>
                                    <SelectItem value="bi-weekly">Bi-weekly (every 2 weeks)</SelectItem>
                                    <SelectItem value="monthly">Monthly</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="quantity">Quantity Available</Label>
                            <Input id="quantity" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} disabled={isSaving}/>
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} disabled={isSaving} />
                    </div>

                    <div className="space-y-4 rounded-md border p-4">
                        <Label className="text-base">Settings</Label>
                        <div className="space-y-2">
                           <Label>Display on public website</Label>
                            <RadioGroup
                                value={displayOnWebsite ? "true" : "false"}
                                onValueChange={(value) => setDisplayOnWebsite(value === "true")}
                                className="flex items-center space-x-4"
                                disabled={isSaving}
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
                            <Checkbox id="manualSignupCutoff" checked={manualSignupCutoff} onCheckedChange={(checked) => setManualSignupCutoff(Boolean(checked))} disabled={isSaving} />
                            <Label htmlFor="manualSignupCutoff" className="font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                Manually turn off new sign-ups for this plan.
                            </Label>
                        </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={isSaving}>
                      {isSaving ? 'Saving...' : 'Save Veggie Box Plan'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
        </div>
      </div>
      <Tabs defaultValue="active">
        <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="active"><Package className="mr-2 h-4 w-4" />Active Plans ({activePublicBoxes.length})</TabsTrigger>
            <TabsTrigger value="unlisted"><EyeOff className="mr-2 h-4 w-4" />Unlisted Plans ({activeUnlistedBoxes.length})</TabsTrigger>
            <TabsTrigger value="past"><Archive className="mr-2 h-4 w-4" />Past Plans ({pastBoxes.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="mt-4">
           <BoxGrid boxes={activePublicBoxes} isLoading={isLoading} />
        </TabsContent>
         <TabsContent value="unlisted" className="mt-4">
           <BoxGrid boxes={activeUnlistedBoxes} isLoading={isLoading} />
        </TabsContent>
        <TabsContent value="past" className="mt-4">
            <BoxGrid boxes={pastBoxes} isLoading={isLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
