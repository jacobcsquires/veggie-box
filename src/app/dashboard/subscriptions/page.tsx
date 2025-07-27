
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Subscription, Pickup } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

export default function SubscriptionsPage() {
  const { user } = useAuth();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [scheduleRanges, setScheduleRanges] = useState<{[boxId: string]: {start: string, end: string} | null}>({});

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const q = query(
      collection(db, 'subscriptions'),
      where('userId', '==', user.uid)
    );

    const unsubscribeSubs = onSnapshot(q, (snapshot) => {
      const subsData = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Subscription)
      );
      setSubscriptions(subsData);
      if (pickups.length > 0 || snapshot.docs.length === 0) {
        setIsLoading(false);
      }
    });

    const unsubscribePickups = onSnapshot(collection(db, 'pickups'), (snapshot) => {
        const pickupsData = snapshot.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() } as Pickup)
        );
        setPickups(pickupsData);
        if (subscriptions.length > 0 || snapshot.docs.length === 0) {
          setIsLoading(false);
        }
    });

    return () => {
        unsubscribeSubs();
        unsubscribePickups();
    };
  }, [user]);

  useEffect(() => {
    if (subscriptions.length > 0 && pickups.length > 0) {
      const ranges: {[boxId: string]: {start: string, end: string} | null} = {};
      subscriptions.forEach(sub => {
        const relevantPickups = pickups
          .filter(p => p.boxId === sub.boxId)
          .sort((a, b) => new Date(a.pickupDate).getTime() - new Date(b.pickupDate).getTime());
        
        if (relevantPickups.length > 0) {
          const startDate = format(new Date(relevantPickups[0].pickupDate.replace(/-/g, '\/')), 'PPP');
          const endDate = format(new Date(relevantPickups[relevantPickups.length - 1].pickupDate.replace(/-/g, '\/')), 'PPP');
          ranges[sub.boxId] = { start: startDate, end: endDate };
        } else {
          ranges[sub.boxId] = null;
        }
      });
      setScheduleRanges(ranges);
    }
  }, [subscriptions, pickups]);


  return (
    <div>
      <h1 className="text-lg font-semibold md:text-2xl font-headline mb-4">
        My Subscriptions
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>Your Subscription History</CardTitle>
          <CardDescription>
            Manage your active and view past subscriptions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Box Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Schedule Dates</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead>
                    <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-12 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-32 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : subscriptions.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                        You have no subscriptions yet.
                    </TableCell>
                </TableRow>
              ) : (
                subscriptions.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium">{sub.boxName}</TableCell>
                    <TableCell>
                      <Badge
                        variant={sub.status === 'Active' ? 'default' : 'secondary'}
                      >
                        {sub.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                        {scheduleRanges[sub.boxId] 
                            ? `${scheduleRanges[sub.boxId]?.start} - ${scheduleRanges[sub.boxId]?.end}`
                            : 'Schedule TBD'
                        }
                    </TableCell>
                    <TableCell className="text-right">
                      ${sub.price.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm">
                            <Link href={`/dashboard/schedule/${sub.boxId}`}>View Schedule</Link>
                        </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
