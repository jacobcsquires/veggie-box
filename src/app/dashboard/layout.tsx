
'use client';

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Home,
  ShoppingCart,
  User,
  Sprout,
  Package,
  Calendar,
  ListChecks,
} from "lucide-react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

import { useAuth } from "@/contexts/auth-context";
import { UserNav } from "@/components/user-nav";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarTrigger,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
  SidebarInset,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";

function DashboardPageContent({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const { state } = useSidebar();
    const [subscriptionsCount, setSubscriptionsCount] = useState(0);

    useEffect(() => {
        if (user) {
        const q = query(collection(db, 'subscriptions'), where('userId', '==', user.uid), where('status', 'in', ['Active', 'Pending', 'Past Due', 'Unpaid', 'Trialing', 'Unknown']));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setSubscriptionsCount(snapshot.size);
        });
        return () => unsubscribe();
        }
    }, [user]);

    const navItems = [
        { href: "/dashboard", icon: Home, label: "Dashboard" },
        { href: "/dashboard/subscriptions", icon: ShoppingCart, label: "Manage Subscriptions", badge: subscriptionsCount > 0 ? subscriptionsCount : undefined },
        { href: "/dashboard/waitlist", icon: ListChecks, label: "Your Waitlists" },
        { href: "/dashboard/schedule", icon: Calendar, label: "Upcoming Pickups" },
        { href: "/dashboard/boxes", icon: Package, label: "Explore Boxes" },
    ];
    return (
        <>
            <Sidebar collapsible="icon">
                <SidebarHeader className="group-data-[collapsible=icon]:justify-center">
                <Link href="/" className="flex items-center gap-2 font-semibold">
                    <Sprout className="h-6 w-6 text-primary" />
                    <span className="font-headline group-data-[collapsible=icon]:hidden">Veggie Box</span>
                </Link>
                </SidebarHeader>
                <SidebarContent>
                <SidebarMenu className="pl-2">
                    {navItems.map(item => (
                    <SidebarMenuItem key={item.label}>
                        <SidebarMenuButton asChild tooltip={item.label}>
                        <Link href={item.href}>
                            <item.icon />
                            <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                            {item.badge && <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>}
                        </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    ))}
                </SidebarMenu>
                </SidebarContent>
                <SidebarRail />
            </Sidebar>
            <SidebarInset>
                <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
                <SidebarTrigger className="md:hidden h-12 w-12" />
                <div className="w-full flex-1">
                    {/* Can add a search bar here if needed */}
                </div>
                <UserNav />
                </header>
                <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 bg-background">
                {children}
                </main>
            </SidebarInset>
        </>
    )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/login');
      return;
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
        <div className="hidden border-r bg-muted/40 md:block">
          <div className="flex h-full max-h-screen flex-col gap-2">
            <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
              <Skeleton className="h-6 w-32" />
            </div>
            <div className="flex-1 p-4">
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col">
          <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
            <div className="w-full flex-1">
            </div>
             <Skeleton className="h-9 w-9 rounded-full" />
          </header>
          <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 bg-background">
             <Skeleton className="h-64 w-full" />
             <Skeleton className="h-32 w-full" />
          </main>
        </div>
      </div>
    );
  }

  // A non-admin user should see this layout.
  // An admin user will be redirected by the /admin layout if they land here.
  if (user.isAdmin) {
    router.replace('/admin/dashboard');
    return null; // Render nothing while redirecting
  }

  return <SidebarProvider><DashboardPageContent>{children}</DashboardPageContent></SidebarProvider>
}
