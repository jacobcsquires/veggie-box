

'use client';

import { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { AppUser } from '@/lib/types';
import { Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';

export default function AdminUsersPage() {
    const [users, setUsers] = useState<AppUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const { toast } = useToast();
    const { user: currentUser } = useAuth();

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
            const usersData = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as AppUser));
            setUsers(usersData);
            setIsLoading(false);
        });
        
        return () => unsubscribe();
    }, []);

    const handleAdminToggle = async (uid: string, isAdmin: boolean) => {
        const adminUsers = users.filter(u => u.isAdmin);
        const isLastAdmin = adminUsers.length === 1 && adminUsers[0].uid === uid;

        if (isLastAdmin && !isAdmin) {
             toast({
                variant: 'destructive',
                title: 'Action Not Allowed',
                description: 'Cannot remove the last admin.',
            });
            return;
        }

        const userRef = doc(db, 'users', uid);
        try {
            await updateDoc(userRef, { isAdmin: isAdmin });
            toast({
                title: 'Success',
                description: 'User admin status updated.',
            });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to update user status.',
            });
        }
    };

    const filteredUsers = useMemo(() => {
        return users
            .filter(user => {
                const nameMatch = user.displayName?.toLowerCase().includes(searchTerm.toLowerCase());
                const emailMatch = user.email?.toLowerCase().includes(searchTerm.toLowerCase());
                return nameMatch || emailMatch;
            })
            .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
    }, [users, searchTerm]);
    
    const adminCount = useMemo(() => users.filter(u => u.isAdmin).length, [users]);

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <div className="space-y-1">
                    <h1 className="text-lg font-semibold md:text-2xl font-headline">
                        User Management
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        A list of all registered users in your application.
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Search by name or email..."
                            className="pl-8"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead className="hidden md:table-cell">Email</TableHead>
                                <TableHead className="text-right">Admin</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                        <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-32" /></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-6 w-10 ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : filteredUsers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-24 text-center">
                                        No matching users found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredUsers.map((user) => {
                                    const isLastAdmin = adminCount === 1 && user.isAdmin;
                                    return (
                                        <TableRow key={user.uid}>
                                            <TableCell className="font-medium">{user.displayName || 'N/A'}</TableCell>
                                            <TableCell className="hidden md:table-cell">{user.email}</TableCell>
                                            <TableCell className="text-right">
                                                <Switch
                                                    checked={!!user.isAdmin}
                                                    onCheckedChange={(checked) => handleAdminToggle(user.uid, checked)}
                                                    disabled={isLastAdmin}
                                                    aria-readonly={isLastAdmin}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

