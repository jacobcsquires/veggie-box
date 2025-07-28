
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { doc, getDoc, collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Box, Pickup } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Calendar as CalendarIcon, LayoutGrid, List } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';


type PickupInternal = Omit<Pickup, 'boxId' | 'boxName'>;


export default function UserSchedulePage() {
  const params = useParams();
  const boxId = params.boxId as string;

  const [box, setBox] = useState<Box | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [pickups, setPickups] = useState<PickupInternal[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [scheduleView, setScheduleView] = useState<'list' | 'calendar' | 'card'>('calendar');

  
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

    // Listen for pickup updates
    const pickupsRef = collection(db, 'boxes', boxId, 'pickups');
    const q = query(pickupsRef);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pickupsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PickupInternal));
      pickupsData.sort((a, b) => new Date(a.pickupDate).getTime() - new Date(b.pickupDate).getTime());
      setPickups(pickupsData);
    });

    return () => unsubscribe();
  }, [boxId]);

  const selectedPickupNote = useMemo(() => {
    if (selectedDate) {
      const dateString = format(selectedDate, 'yyyy-MM-dd');
      const pickupForDate = pickups.find(d => d.pickupDate === dateString);
      return pickupForDate?.note || '';
    }
    return '';
  }, [selectedDate, pickups]);

  const pickupDates = useMemo(() => pickups.map(d => new Date(d.pickupDate.replace(/-/g, '\/'))), [pickups]);
  
  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
  };
  
  const renderScheduleView = () => {
    switch (scheduleView) {
        case 'calendar':
            return (
                <div className="flex justify-center">
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
                 <ScrollArea className="h-[400px] w-full">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-4">
                        {pickups.length === 0 ? (
                            <p className="text-muted-foreground col-span-full text-center py-10">No pickups scheduled yet.</p>
                        ) : (
                            pickups.map(pickup => {
                                const pickupDateObj = new Date(pickup.pickupDate.replace(/-/g, '\/'));
                                const isSelected = selectedDate && format(pickupDateObj, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
                                return (
                                    <Card 
                                        key={pickup.id} 
                                        onClick={() => handleDateSelect(pickupDateObj)}
                                        className={cn("cursor-pointer hover:bg-muted/50", isSelected && "border-primary")}
                                    >
                                        <CardHeader>
                                            <CardTitle className="text-base">{format(pickupDateObj, 'PPP')}</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-sm text-muted-foreground truncate h-10">{pickup.note || 'No note for this date.'}</p>
                                        </CardContent>
                                    </Card>
                                )
                            })
                        )}
                    </div>
                </ScrollArea>
            )
        case 'list':
        default:
            return (
                 <ScrollArea className="h-[400px] w-full">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Note</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {pickups.length === 0 ? (
                                <TableRow><TableCell colSpan={2} className="text-center h-24">No pickups scheduled yet.</TableCell></TableRow>
                            ) : (
                                pickups.map(pickup => {
                                     const pickupDateObj = new Date(pickup.pickupDate.replace(/-/g, '\/'));
                                     const isSelected = selectedDate && format(pickupDateObj, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
                                     return (
                                        <TableRow 
                                            key={pickup.id} 
                                            onClick={() => handleDateSelect(pickupDateObj)}
                                            className={cn("cursor-pointer", isSelected && "bg-muted")}
                                        >
                                            <TableCell>{format(pickupDateObj, 'PPP')}</TableCell>
                                            <TableCell className="max-w-[300px] truncate">{pickup.note || 'No note yet.'}</TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </ScrollArea>
            );
    }
  }


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
                            <Skeleton className="h-48 w-full" />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
  }

  if (!box) {
    return <div>Subscription not found.</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-headline mb-4">Pick Up Schedule for {box.name}</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2">
          <Card>
             <CardHeader className="flex-row items-center justify-between">
                <div>
                    <CardTitle>Pick Up Calendar</CardTitle>
                    <CardDescription>Select a date to see what's planned for your pick up.</CardDescription>
                </div>
                 <ToggleGroup type="single" value={scheduleView} onValueChange={(value) => { if (value) setScheduleView(value as any) }} aria-label="Schedule view">
                    <ToggleGroupItem value="list" aria-label="List view"><List className="h-4 w-4" /></ToggleGroupItem>
                    <ToggleGroupItem value="card" aria-label="Card view"><LayoutGrid className="h-4 w-4" /></ToggleGroupItem>
                    <ToggleGroupItem value="calendar" aria-label="Calendar view"><CalendarIcon className="h-4 w-4" /></ToggleGroupItem>
                </ToggleGroup>
            </CardHeader>
            <CardContent className="flex justify-center">
                {renderScheduleView()}
            </CardContent>
          </Card>
        </div>
        <div className="lg:sticky lg:top-20">
          <Card>
            <CardHeader>
              <CardTitle>What's in the Veggie Box?</CardTitle>
               <CardDescription>Note for {selectedDate ? format(selectedDate, 'PPP') : '...'}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-3 p-3 rounded-md border bg-muted/20 min-h-[150px]">
                    {selectedPickupNote ? (
                        <p className="text-sm text-muted-foreground">{selectedPickupNote}</p>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-8">
                            {selectedDate && pickupDates.some(d => format(d, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd'))
                                ? "The note for this pickup hasn't been announced yet. Check back soon!"
                                : "No pick up scheduled for this date."
                            }
                        </p>
                    )}
                </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
