"use client"

import { useEffect, useState, useMemo } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Subscription, Box } from '@/lib/types';
import { DollarSign, Package, ShoppingCart, Users } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton";
import type { AppUser } from "@/contexts/auth-context";

export default function AdminDashboard() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubSubscriptions = onSnapshot(collection(db, 'subscriptions'), (snapshot) => {
      setSubscriptions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subscription)));
      setIsLoading(false);
    });
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as AppUser)));
    });
    const unsubBoxes = onSnapshot(collection(db, 'boxes'), (snapshot) => {
      setBoxes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Box)));
    });

    return () => {
      unsubSubscriptions();
      unsubUsers();
      unsubBoxes();
    }
  }, []);

  const totalRevenue = useMemo(() => subscriptions.reduce((sum, sub) => sum + sub.price, 0), [subscriptions]);
  const subscriptionsCount = useMemo(() => subscriptions.length, [subscriptions]);
  const newUsersCount = useMemo(() => users.length, [users]);
  const boxesAvailableCount = useMemo(() => boxes.length, [boxes]);

  const monthlyRevenue = useMemo(() => {
    if (subscriptions.length === 0) return [];
    
    const revenueByMonth: { [key: number]: number } = {};
    subscriptions.forEach(sub => {
      const monthIndex = new Date(sub.startDate).getMonth();
      revenueByMonth[monthIndex] = (revenueByMonth[monthIndex] || 0) + sub.price;
    });

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    return monthNames.map((month, index) => ({
      month,
      revenue: revenueByMonth[index] || 0
    }));
  }, [subscriptions]);

  const popularBoxes = useMemo(() => {
    if (subscriptions.length === 0) return [];

    const boxesCount: { [key: string]: number } = {};
    subscriptions.forEach(sub => {
      boxesCount[sub.boxName] = (boxesCount[sub.boxName] || 0) + 1;
    });

    const chartColors = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)"];
    return Object.entries(boxesCount).map(([name, value], index) => ({
      name,
      value,
      fill: chartColors[index % chartColors.length]
    }));
  }, [subscriptions]);
  
  return (
    <div className="flex flex-col gap-4">
        <h1 className="text-lg font-semibold md:text-2xl font-headline">Admin Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
          <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                  Total Revenue
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-7 w-24" /> : <div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div>}
              </CardContent>
          </Card>
          <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                  Subscriptions
              </CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-7 w-16" /> : <div className="text-2xl font-bold">{subscriptionsCount}</div>}
              </CardContent>
          </Card>
          <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">New Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-7 w-16" /> : <div className="text-2xl font-bold">{newUsersCount}</div>}
              </CardContent>
          </Card>
          <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Boxes Available</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-7 w-10" /> : <div className="text-2xl font-bold">{boxesAvailableCount}</div>}
              </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="lg:col-span-4">
            <CardHeader>
              <CardTitle>Monthly Revenue</CardTitle>
            </CardHeader>
            <CardContent className="pl-2">
              {isLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : monthlyRevenue.filter(m => m.revenue > 0).length > 0 ? (
                  <ChartContainer config={{revenue: { label: "Revenue", color: "hsl(var(--chart-1))" }}} className="h-[300px] w-full">
                    <BarChart data={monthlyRevenue}>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="month" tickLine={false} tickMargin={10} axisLine={false} />
                        <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                        <Tooltip content={<ChartTooltipContent indicator="dot" />} />
                        <Bar dataKey="revenue" fill="var(--color-primary)" radius={4} />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                    No revenue data to display.
                  </div>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
             <CardHeader>
              <CardTitle>Popular Boxes</CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <Skeleton className="h-[300px] w-full" />
                ) : popularBoxes.length > 0 ? (
                    <ChartContainer config={popularBoxes.reduce((acc, cur) => ({...acc, [cur.name]: {label: cur.name, color: cur.fill}}), {})} className="h-[300px] w-full">
                        <PieChart>
                            <Tooltip content={<ChartTooltipContent />} />
                            <Pie data={popularBoxes} dataKey="value" nameKey="name" />
                        </PieChart>
                    </ChartContainer>
                ) : (
                  <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                    No subscription data to display.
                  </div>
                )}
            </CardContent>
          </Card>
        </div>
    </div>
  )
}
