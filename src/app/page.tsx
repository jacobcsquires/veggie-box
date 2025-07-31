
'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { collection, onSnapshot, query, orderBy, limit, getDocs, where, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Box, Subscription, Customer } from '@/lib/types';
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUpRight, DollarSign, Users, Package, ShoppingCart, Clock, Calendar, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

function AdminDashboard() {
    const [stats, setStats] = useState({
        totalRevenue: 0,
        activeSubscriptions: 0,
        totalCustomers: 0,
        activePlans: 0
    });
    const [recentSubscriptions, setRecentSubscriptions] = useState<Subscription[]>([]);
    const [popularPlans, setPopularPlans] = useState<(Box & {subscribedCount: number})[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'subscriptions'), (subsSnapshot) => {
            const subscriptions = subsSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as Subscription);
            
            const activeSubscriptions = subscriptions.filter(s => s.status === 'Active');
            const totalRevenue = activeSubscriptions.reduce((acc, sub) => acc + sub.price, 0);
            const recent = [...subscriptions]
                .sort((a,b) => b.createdAt.toMillis() - a.createdAt.toMillis())
                .slice(0, 5);

            setRecentSubscriptions(recent);
            
            const activeCustomerIds = new Set(activeSubscriptions.map(s => s.stripeCustomerId));
            
            setStats(prev => ({...prev, totalRevenue, activeSubscriptions: activeSubscriptions.length, totalCustomers: activeCustomerIds.size }));

            onSnapshot(query(collection(db, 'boxes'), where('displayOnWebsite', '==', true)), (boxesSnapshot) => {
                 const boxes = boxesSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as Box);
                 const activePlans = boxes.filter(b => {
                     const endDate = b.endDate ? new Date(b.endDate.replace(/-/g, '\/')) : null;
                     return !endDate || endDate >= new Date();
                 });
                 
                 const popular = activePlans.sort((a,b) => (b.subscribedCount || 0) - (a.subscribedCount || 0)).slice(0, 5);
                 setPopularPlans(popular as (Box & {subscribedCount: number})[]);
                 setStats(prev => ({...prev, activePlans: activePlans.length}));
                 setIsLoading(false);
            });
        });

        return () => unsubscribe();
    }, []);
    
    const chartData = useMemo(() => {
        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - i);
            return format(d, 'yyyy-MM-dd');
        }).reverse();

        const data = last7Days.map(day => ({
            date: format(new Date(day), 'MMM d'),
            subscriptions: recentSubscriptions.filter(s => s.createdAt && format(s.createdAt.toDate(), 'yyyy-MM-dd') === day).length,
        }));
        
        return data;
    }, [recentSubscriptions]);


    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Revenue (Monthly)</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Skeleton className="h-8 w-24" /> : (
                            <>
                                <div className="text-2xl font-bold">${stats.totalRevenue.toFixed(2)}</div>
                                <p className="text-xs text-muted-foreground">Based on active subscriptions</p>
                            </>
                        )}
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
                        <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                         {isLoading ? <Skeleton className="h-8 w-16" /> : (
                             <>
                                <div className="text-2xl font-bold">{stats.activeSubscriptions}</div>
                                <p className="text-xs text-muted-foreground">Across all plans</p>
                             </>
                         )}
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Skeleton className="h-8 w-16" /> : (
                            <>
                                <div className="text-2xl font-bold">{stats.totalCustomers}</div>
                                <p className="text-xs text-muted-foreground">With at least one active subscription</p>
                            </>
                        )}
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Veggie Box Plans</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Skeleton className="h-8 w-16" /> : (
                            <>
                                <div className="text-2xl font-bold">{stats.activePlans}</div>
                                <p className="text-xs text-muted-foreground">Currently available for subscription</p>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="lg:col-span-4">
                    <CardHeader>
                        <CardTitle>New Subscriptions Overview</CardTitle>
                        <CardDescription>New subscriptions in the last 7 days.</CardDescription>
                    </CardHeader>
                    <CardContent className="pl-2">
                         {isLoading ? <Skeleton className="h-[350px] w-full" /> : (
                            <ChartContainer config={{
                                subscriptions: {
                                    label: "Subscriptions",
                                    color: "hsl(var(--chart-1))",
                                },
                            }} className="h-[350px] w-full">
                                <BarChart data={chartData}>
                                    <CartesianGrid vertical={false} />
                                    <XAxis dataKey="date" tickLine={false} tickMargin={10} axisLine={false} />
                                    <ChartTooltip content={<ChartTooltipContent />} />
                                    <Bar dataKey="subscriptions" fill="var(--color-subscriptions)" radius={4} />
                                </BarChart>
                            </ChartContainer>
                         )}
                    </CardContent>
                </Card>
                <Card className="lg:col-span-3">
                    <CardHeader>
                        <CardTitle>Recent Subscriptions</CardTitle>
                        <CardDescription>The 5 most recent subscriptions.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         {isLoading ? <Skeleton className="h-[350px] w-full" /> : (
                            <div className="space-y-6">
                                {recentSubscriptions.map(sub => (
                                    <div key={sub.id} className="flex items-center">
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium leading-none">{sub.customerName}</p>
                                            <p className="text-sm text-muted-foreground">{sub.boxName}</p>
                                        </div>
                                        <div className="ml-auto font-medium">+${sub.price.toFixed(2)}</div>
                                    </div>
                                ))}
                            </div>
                         )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

type SubscriptionWithBoxDetails = Subscription & {
  boxImage?: string;
  boxDescription?: string;
  frequency?: string;
  nextPickupDate?: string | null;
};

function CustomerDashboard() {
  const { user } = useAuth();
  const [subscriptions, setSubscriptions] = useState<SubscriptionWithBoxDetails[]>([]);
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

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const subsData = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Subscription)
      );

      const subsWithDetails = await Promise.all(
        subsData.map(async (sub) => {
          const boxRef = doc(db, 'boxes', sub.boxId);
          const boxSnap = await getDocs(query(collection(db, 'boxes'), where('__name__', '==', sub.boxId)));
          
          let boxImage, boxDescription, frequency, nextPickupDate = null;
          if (!boxSnap.empty) {
            const boxData = boxSnap.docs[0].data();
            boxImage = boxData.image;
            boxDescription = boxData.description;
            frequency = boxData.frequency;

            const pickupsRef = collection(db, 'boxes', sub.boxId, 'pickups');
            const today = format(new Date(), 'yyyy-MM-dd');
            const pickupQuery = query(pickupsRef, where('pickupDate', '>=', today), orderBy('pickupDate'), limit(1));
            const pickupSnapshot = await getDocs(pickupQuery);

            if (!pickupSnapshot.empty) {
                nextPickupDate = format(new Date(pickupSnapshot.docs[0].data().pickupDate.replace(/-/g, '\/')), 'PPP');
            }
          }
          
          return { ...sub, boxImage, boxDescription, frequency, nextPickupDate };
        })
      );
      
      setSubscriptions(subsWithDetails);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-5/6" />
            </CardContent>
            <CardFooter><Skeleton className="h-8 w-24" /></CardFooter>
          </Card>
        ))}
      </div>
    );
  }

  if (subscriptions.length === 0) {
    return (
      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-tight">Welcome, {user?.displayName || 'Veggie Lover'}!</h2>
        <p className="text-muted-foreground mt-2">
          You don't have any active subscriptions yet.
        </p>
        <Button asChild className="mt-4">
          <Link href="/dashboard/subscriptions">Explore Veggie Boxes</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
       <h1 className="text-lg font-semibold md:text-2xl font-headline">Your Dashboard</h1>
       <div className="grid gap-6 md:grid-cols-2">
            {subscriptions.map(sub => (
                <Card key={sub.id}>
                    <CardHeader>
                        <div className="flex justify-between items-start">
                             <div>
                                <CardTitle>{sub.boxName}</CardTitle>
                                <CardDescription>Status: <Badge variant={sub.status === 'Active' ? 'default' : 'secondary'}>{sub.status}</Badge></CardDescription>
                            </div>
                            {sub.boxImage && <Image src={sub.boxImage} alt={sub.boxName} width={80} height={80} className="rounded-md" />}
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                        <div className="flex items-center text-muted-foreground">
                            <Package className="mr-2 h-4 w-4" />
                            <span>{sub.priceName || 'Standard'} - ${sub.price.toFixed(2)} / {sub.frequency}</span>
                        </div>
                        <div className="flex items-center text-muted-foreground">
                             <Clock className="mr-2 h-4 w-4" />
                             <span>Next pickup: {sub.nextPickupDate || 'TBD'}</span>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button asChild variant="outline">
                            <Link href="/dashboard/subscriptions">Manage Subscription</Link>
                        </Button>
                    </CardFooter>
                </Card>
            ))}
       </div>
    </div>
  );
}


export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) {
      return; // Wait until authentication state is resolved
    }
    if (!user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (user.isAdmin) {
    return <AdminDashboard />;
  }

  return <CustomerDashboard />;
}
