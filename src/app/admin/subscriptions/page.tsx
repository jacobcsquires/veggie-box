
'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MoreHorizontal, Trash2 } from 'lucide-react';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Subscription } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';


export default function AdminSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCleanupButton, setShowCleanupButton] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const q = query(collection(db, 'subscriptions'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const subscriptionsData = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Subscription)
      );
      setSubscriptions(subscriptionsData);
      setIsLoading(false);
    });
    
    // Check if orders collection exists to determine if cleanup button should be shown
    const checkOrdersCollection = async () => {
        const ordersSnapshot = await getDocs(collection(db, 'orders'));
        if (!ordersSnapshot.empty) {
            setShowCleanupButton(true);
        }
    };
    checkOrdersCollection();


    return () => unsubscribe();
  }, []);
  
  const handleCleanup = async () => {
    setIsCleaning(true);
    try {
        const ordersCollectionRef = collection(db, 'orders');
        const ordersSnapshot = await getDocs(ordersCollectionRef);
        
        if (ordersSnapshot.empty) {
            toast({ title: "Already Clean", description: "The orders collection is already empty." });
            setShowCleanupButton(false);
            return;
        }

        const batch = writeBatch(db);
        ordersSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();

        toast({ title: 'Success', description: 'The redundant "orders" collection has been deleted.' });
        setShowCleanupButton(false);
    } catch (error) {
        console.error("Error during cleanup: ", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not perform cleanup.' });
    } finally {
        setIsCleaning(false);
    }
  };


  const getStatusVariant = (
    status: string
  ): 'default' | 'secondary' | 'outline' => {
    switch (status) {
      case 'Active':
        return 'default';
      case 'Cancelled':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold md:text-2xl font-headline">
            Manage Subscriptions
        </h1>
        {showCleanupButton && (
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Cleanup Orders
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the entire 'orders' collection from your database.
                            This action is recommended as 'orders' are redundant. This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleCleanup} disabled={isCleaning}>
                            {isCleaning ? 'Cleaning...' : 'Yes, cleanup'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        )}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>All Subscriptions</CardTitle>
          <CardDescription>A list of all customer subscriptions.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Box Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Start Date</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-12 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : subscriptions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24">
                    No subscriptions found.
                  </TableCell>
                </TableRow>
              ) : (
                subscriptions.map((subscription) => (
                  <TableRow key={subscription.id}>
                    <TableCell className="font-medium">
                      {subscription.customerName || subscription.userId}
                    </TableCell>
                    <TableCell>{subscription.boxName}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(subscription.status)}>
                        {subscription.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {subscription.startDate}
                    </TableCell>
                    <TableCell className="text-right">
                      ${subscription.price.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            aria-haspopup="true"
                            size="icon"
                            variant="ghost"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Toggle menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem>View Details</DropdownMenuItem>
                          <DropdownMenuItem>Update Status</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter>
          <div className="text-xs text-muted-foreground">
            Showing <strong>1-{subscriptions.length}</strong> of{' '}
            <strong>{subscriptions.length}</strong> subscriptions
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
