
'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc, collection, onSnapshot, setDoc, query, where, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { X, Plus, Loader2 } from 'lucide-react';
import type { Box, BoxItem, Delivery } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

export default function AdminSchedulePage({ params }: { params: { boxId: string } }) {
  const { toast } = useToast();
  const { boxId } = params;

  const [box, setBox] = useState<Box | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [selectedDeliveryItems, setSelectedDeliveryItems] = useState<BoxItem[]>([]);
  
  const [newItemName, setNewItemName] = useState('');
  const [newItemIcon, setNewItemIcon] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

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

    // Listen for real-time delivery updates from Firestore
    const deliveriesQuery = query(collection(db, 'deliveries'), where('boxId', '==', boxId));
    const unsubscribe = onSnapshot(deliveriesQuery, (snapshot) => {
      const deliveriesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Delivery));
      setDeliveries(deliveriesData);
      console.log('Fetched schedule data from Firestore:', deliveriesData);
    });

    return () => unsubscribe();
  }, [boxId]);

  // This effect runs when the user selects a new date or when the deliveries data from Firestore changes.
  // It ensures the local state for items (selectedDeliveryItems) is always in sync with what's in Firestore for the chosen date.
  useEffect(() => {
    if (selectedDate) {
      const dateString = format(selectedDate, 'yyyy-MM-dd');
      const deliveryForDate = deliveries.find(d => d.deliveryDate === dateString);
      // If a delivery is saved in Firestore for this date, use its items. Otherwise, start with an empty array.
      setSelectedDeliveryItems(deliveryForDate?.items || []);
    } else {
      setSelectedDeliveryItems([]);
    }
  }, [selectedDate, deliveries]);

  const handleAddItem = () => {
    if (newItemName && newItemIcon) {
      // Update local state. The changes will be sent to Firestore upon saving.
      setSelectedDeliveryItems([...selectedDeliveryItems, { name: newItemName, icon: newItemIcon }]);
      setNewItemName('');
      setNewItemIcon('');
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please provide both an item name and an icon name.',
      });
    }
  };

  const handleRemoveItem = (index: number) => {
    // Update local state. The changes will be sent to Firestore upon saving.
    setSelectedDeliveryItems(selectedDeliveryItems.filter((_, i) => i !== index));
  };

  // This function handles all interactions with Firestore for saving or deleting delivery data.
  const handleSaveDelivery = async () => {
    if (!selectedDate) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please select a date.' });
        return;
    }
    
    setIsSaving(true);
    const dateString = format(selectedDate, 'yyyy-MM-dd');
    // Use a consistent ID for the document to easily find and update it later.
    const docId = `${boxId}_${dateString}`;
    const deliveryRef = doc(db, 'deliveries', docId);

    try {
        // If there are items, we create or update the document in Firestore.
        if (selectedDeliveryItems.length > 0) {
            const deliveryData: Delivery = {
                id: docId,
                boxId,
                boxName: box?.name || '',
                deliveryDate: dateString,
                items: selectedDeliveryItems,
            };
            // setDoc with merge:true will create the document if it doesn't exist, or update it if it does.
            await setDoc(deliveryRef, deliveryData, { merge: true });
            toast({ title: 'Success', description: `Delivery for ${dateString} saved to Firestore.` });
        } else {
            // If there are no items, it means we should remove the delivery plan for this date.
            // We check if the document exists in Firestore before trying to delete it.
            const docSnap = await getDoc(deliveryRef);
            if (docSnap.exists()) {
                await deleteDoc(deliveryRef);
                toast({ title: 'Success', description: `Delivery for ${dateString} cleared from Firestore.` });
            }
        }
    } catch (error) {
        console.error("Error saving delivery to Firestore: ", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not save delivery to Firestore.' });
    } finally {
        setIsSaving(false);
    }
  };
  
  const deliveryDates = deliveries.map(d => new Date(d.deliveryDate.replace(/-/g, '\/')));

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
      <h1 className="text-2xl font-headline mb-4">Manage Schedule for {box.name}</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
                <CardTitle>Delivery Calendar</CardTitle>
                <CardDescription>Select a date to plan the items for that delivery. Dates with scheduled deliveries are highlighted.</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                modifiers={{ scheduled: deliveryDates }}
                modifiersClassNames={{ scheduled: 'bg-primary/20' }}
                className="rounded-md border"
              />
            </CardContent>
          </Card>
        </div>
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Items for {selectedDate ? format(selectedDate, 'PPP') : '...'}</CardTitle>
              <CardDescription>Add or remove items for the selected date's box.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Current Items in Box</Label>
                   {selectedDeliveryItems.length > 0 ? (
                        <div className="space-y-2">
                            {selectedDeliveryItems.map((item, index) => (
                                <div key={index} className="flex items-center gap-2 p-2 rounded-md border text-sm">
                                    <span className="flex-1 font-medium">{item.name}</span>
                                    <span className="flex-1 text-muted-foreground">{item.icon}</span>
                                    <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveItem(index)} disabled={isSaving}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground py-2 text-center">No items scheduled for this date.</p>
                    )}
                </div>
                <div className="space-y-2">
                    <Label>Add New Item</Label>
                    <div className="flex items-center gap-2">
                        <Input placeholder="Item Name" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} disabled={isSaving} />
                        <Input placeholder="Icon Name" value={newItemIcon} onChange={(e) => setNewItemIcon(e.target.value)} disabled={isSaving}/>
                        <Button type="button" variant="outline" size="icon" onClick={handleAddItem} disabled={isSaving}><Plus className="h-4 w-4"/></Button>
                    </div>
                </div>
                 <Button onClick={handleSaveDelivery} disabled={isSaving || !selectedDate} className="w-full">
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isSaving ? 'Saving to Firestore...' : 'Save Delivery Plan'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
