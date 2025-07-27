

'use client';

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  Home,
  Package,
  Users,
  Sprout,
  ShoppingCart,
} from "lucide-react";

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
  SidebarInset,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const { state, isMobile } = useSidebar();
  const navItems = [
    { href: "/admin/dashboard", icon: Home, label: "Dashboard" },
    { href: "/admin/boxes", icon: Package, label: "Boxes" },
    { href: "/admin/subscriptions", icon: ShoppingCart, label: "Subscriptions" },
    { href: "/admin/users", icon: Users, label: "Users" },
  ];
  return (
      <>
        <Sidebar collapsible="icon">
            <SidebarHeader>
            <Link href="/admin/dashboard" className="flex items-center gap-2 font-semibold">
                <Sprout className="h-6 w-6 text-primary" />
                <span className="font-headline group-data-[collapsible=icon]:hidden">Veggie Box Admin</span>
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
            <SidebarTrigger className="md:hidden" />
            <div className="w-full flex-1">
                {/* Can add a search bar here if needed */}
            </div>
            <UserNav />
            </header>
            <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 lg:pl-10 bg-background">
            {children}
            </main>
        </SidebarInset>
    </>
  )
}


export default function AdminLayout({
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
    if (!user.isAdmin) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  if (loading || !user || !user.isAdmin) {
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

  return <SidebarProvider><AdminLayoutContent>{children}</AdminLayoutContent></SidebarProvider>
}
