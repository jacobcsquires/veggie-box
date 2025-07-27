
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Subscription, Box } from '@/lib/types';
import { Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

export default function AdminSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBoxId, setSelectedBoxId] = useState('all');
  const router = useRouter();

  useEffect(() => {
    const subsQuery = query(collection(db, 'subscriptions'), where('status', 'in', ['Active', 'Pending']));
    const unsubscribeSubs = onSnapshot(subsQuery, (snapshot) => {
      const subsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subscription));
      setSubscriptions(subsData);
      setIsLoading(false);
    });

    const unsubscribeBoxes = onSnapshot(collection(db, 'boxes'), (snapshot) => {
      const boxesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Box));
      setBoxes(boxesData);
    });

    return () => {
      unsubscribeSubs();
      unsubscribeBoxes();
    };
  }, []);

  const filteredSubscriptions = useMemo(() => {
    return subscriptions
      .filter(sub => {
        const matchesBox = selectedBoxId === 'all' || sub.boxId === selectedBoxId;
        const matchesSearch = sub.customerName?.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesBox && matchesSearch;
      })
      .sort((a, b) => (a.customerName || '').localeCompare(b.customerName || ''));
  }, [subscriptions, searchTerm, selectedBoxId]);

  return (
    <div>
      <h1 className="text-lg font-semibold md:text-2xl font-headline">
        Subscriptions
      </h1>
      <p className="text-muted-foreground mb-4">
        A list of all active and pending subscriptions.
      </p>
      <div className="flex flex-col md:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by name..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={selectedBoxId} onValueChange={setSelectedBoxId}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder="Filter by box" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Boxes</SelectItem>
            {boxes.map(box => (
              <SelectItem key={box.id} value={box.id}>{box.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Box</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead className="text-right">Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-12 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredSubscriptions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    No matching subscriptions found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredSubscriptions.map((sub) => (
                  <TableRow key={sub.id} onClick={() => router.push(`/admin/subscriptions/${sub.id}`)} className="cursor-pointer">
                    <TableCell className="font-medium">{sub.customerName || 'N/A'}</TableCell>
                    <TableCell>{sub.boxName}</TableCell>
                    <TableCell>
                      <Badge variant={sub.status === 'Active' ? 'default' : sub.status === 'Pending' ? 'secondary' : 'outline'}>
                        {sub.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(sub.startDate.replace(/-/g, '/')), 'PPP')}</TableCell>
                    <TableCell className="text-right">${sub.price.toFixed(2)}</TableCell>
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
