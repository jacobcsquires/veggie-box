
'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth } from 'date-fns';
import * as Icons from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

import type { Box, BoxItem, Delivery } from '@/lib/types';

export default function AdminDeliveryCalendarPage({
  params: { boxId },
}: {
  params: { boxId: string };
}) {
  const { toast } = useToast();

  const [box, setBox] = useState<Box | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date()
  );
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Item Management State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentItems, setCurrentItems] = useState<BoxItem[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemIcon, setNewItemIcon] = useState('');

  // Fetch box details
  useEffect(() => {
    if (boxId) {
      const boxRef = doc(db, 'boxes', boxId);
      getDoc(boxRef).then((docSnap) => {
        if (docSnap.exists()) {
          setBox({ id: docSnap.id, ...docSnap.data() } as Box);
        } else {
          toast({ variant: 'destructive', title: 'Error', description: 'Box not found.' });
        }
        setIsLoading(false);
      });
    }
  }, [boxId, toast]);

  // Fetch deliveries for the current month
  useEffect(() => {
    if (!boxId) return;
    
    const q = query(
      collection(db, 'deliveries'),
      where('boxId', '==', boxId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const deliveriesData = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Delivery)
      );
      setDeliveries(deliveriesData);
    });

    return () => unsubscribe();
  }, [boxId, currentMonth]);

  const deliveryDates = deliveries.map(d => new Date(d.deliveryDate + 'T00:00:00'));

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    setSelectedDate(date);
    const dateString = format(date, 'yyyy-MM-dd');
    const existingDelivery = deliveries.find(d => d.deliveryDate === dateString);
    setCurrentItems(existingDelivery?.items || box?.items || []);
    setIsDialogOpen(true);
  };
  
  const handleAddItem = () => {
    if (newItemName && newItemIcon) {
      setCurrentItems([...currentItems, { name: newItemName, icon: newItemIcon }]);
      setNewItemName('');
      setNewItemIcon('');
    }
  };

  const handleRemoveItem = (index: number) => {
    setCurrentItems(currentItems.filter((_, i) => i !== index));
  };

  const handleSaveDelivery = async () => {
    if (!selectedDate) return;
    setIsSaving(true);
    const dateString = format(selectedDate, 'yyyy-MM-dd');
    const deliveryId = `${boxId}_${dateString}`;
    
    try {
        const deliveryRef = doc(db, 'deliveries', deliveryId);
        await setDoc(deliveryRef, {
            boxId: boxId,
            deliveryDate: dateString,
            items: currentItems,
        });
        toast({ title: 'Success', description: `Delivery for ${dateString} saved.` });
        setIsDialogOpen(false);
    } catch (error) {
        console.error("Error saving delivery:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not save delivery.' });
    } finally {
        setIsSaving(false);
    }
  };

  const handleClearDelivery = async () => {
     if (!selectedDate) return;
    setIsSaving(true);
    const dateString = format(selectedDate, 'yyyy-MM-dd');
    const deliveryId = `${boxId}_${dateString}`;
     try {
        const deliveryRef = doc(db, 'deliveries', deliveryId);
        await deleteDoc(deliveryRef);
        toast({ title: 'Success', description: `Delivery for ${dateString} cleared.` });
        setIsDialogOpen(false);
    } catch (error) {
        console.error("Error clearing delivery:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not clear delivery.' });
    } finally {
        setIsSaving(false);
    }
  }


  if (isLoading || !box) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-96 md:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-headline">Manage Deliveries for {box.name}</h1>
      <Card>
        <CardContent className="p-4">
            <Calendar
                mode="multiple"
                selected={deliveryDates}
                onSelect={handleDateSelect}
                onMonthChange={setCurrentMonth}
                className="p-0"
                modifiersClassNames={{
                    selected: 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
                }}
            />
        </CardContent>
         <CardFooter>
            <p className="text-sm text-muted-foreground">Select a date to set the items for that specific delivery. Dates with custom items are highlighted.</p>
        </CardFooter>
      </Card>
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
                <DialogTitle>Edit Delivery for {selectedDate && format(selectedDate, 'PPP')}</DialogTitle>
                <DialogDescription>
                    Customize the items for this specific delivery date. If you don't set any items, the box's default items will be used.
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-4">
                <div className="space-y-2">
                    {currentItems.map((item, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 rounded-md border">
                            <span className="flex-1 font-medium">{item.name}</span>
                            <span className="flex-1 text-muted-foreground">{item.icon}</span>
                            <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveItem(index)} disabled={isSaving}>
                                <Icons.X className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                </div>
                 <div className="flex items-center gap-2">
                    <Input placeholder="Item Name" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} disabled={isSaving} />
                    <Input placeholder="Icon Name" value={newItemIcon} onChange={(e) => setNewItemIcon(e.target.value)} disabled={isSaving} />
                    <Button type="button" variant="outline" onClick={handleAddItem} disabled={isSaving}>Add</Button>
                </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row sm:justify-between w-full">
                <Button variant="destructive" onClick={handleClearDelivery} disabled={isSaving}>
                    {isSaving ? 'Clearing...' : 'Clear Delivery Items'}
                </Button>
                <Button onClick={handleSaveDelivery} disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save Delivery'}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
