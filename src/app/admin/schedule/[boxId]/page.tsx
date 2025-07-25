
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
  const boxId = params.boxId;

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

    // Fetch box details
    const boxRef = doc(db, 'boxes', boxId);
    getDoc(boxRef).then((docSnap) => {
      if (docSnap.exists()) {
        setBox({ id: docSnap.id, ...docSnap.data() } as Box);
      }
      setIsLoading(false);
    });

    // Listen for delivery updates
    const q = query(collection(db, 'deliveries'), where('boxId', '==', boxId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const deliveriesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Delivery));
      setDeliveries(deliveriesData);
    });

    return () => unsubscribe();
  }, [boxId]);

  useEffect(() => {
    if (selectedDate) {
      const dateString = format(selectedDate, 'yyyy-MM-dd');
      const deliveryForDate = deliveries.find(d => d.deliveryDate === dateString);
      setSelectedDeliveryItems(deliveryForDate?.items || []);
    } else {
      setSelectedDeliveryItems([]);
    }
  }, [selectedDate, deliveries]);

  const handleAddItem = () => {
    if (newItemName && newItemIcon) {
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
    setSelectedDeliveryItems(selectedDeliveryItems.filter((_, i) => i !== index));
  };

  const handleSaveDelivery = async () => {
    if (!selectedDate) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please select a date.' });
        return;
    }
    
    setIsSaving(true);
    const dateString = format(selectedDate, 'yyyy-MM-dd');
    const docId = `${boxId}_${dateString}`;
    const deliveryRef = doc(db, 'deliveries', docId);

    try {
        if (selectedDeliveryItems.length > 0) {
            const deliveryData = {
                boxId,
                boxName: box?.name || '',
                deliveryDate: dateString,
                items: selectedDeliveryItems,
            };
            await setDoc(deliveryRef, deliveryData, { merge: true });
            toast({ title: 'Success', description: `Delivery for ${dateString} saved.` });
        } else {
            // If no items, delete the delivery doc if it exists
            const docSnap = await getDoc(deliveryRef);
            if (docSnap.exists()) {
                await deleteDoc(deliveryRef);
                toast({ title: 'Success', description: `Delivery for ${dateString} cleared.` });
            }
        }
    } catch (error) {
        console.error("Error saving delivery: ", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not save delivery.' });
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
              <CardDescription>Add or remove items for the selected date.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Current Items</Label>
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
                    {isSaving ? 'Saving...' : 'Save Delivery Plan'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
