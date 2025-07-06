'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Subscription } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
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
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export default function SubscriptionsPage() {
  const { user } = useAuth();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const q = query(
      collection(db, 'subscriptions'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const subsData = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Subscription)
      );
      setSubscriptions(subsData);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

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
                <TableHead>Next Delivery</TableHead>
                <TableHead className="text-right">Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-12 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : subscriptions.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
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
                        className={cn(
                          sub.status === 'Active'
                            ? 'bg-green-200 text-green-800'
                            : 'bg-gray-200 text-gray-800',
                          'dark:bg-transparent dark:text-foreground'
                        )}
                      >
                        {sub.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{sub.nextDelivery}</TableCell>
                    <TableCell className="text-right">
                      ${sub.price.toFixed(2)}
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
