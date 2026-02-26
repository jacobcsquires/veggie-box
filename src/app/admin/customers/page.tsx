'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { collection, onSnapshot, addDoc, serverTimestamp, query, where, getDocs, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Customer, AppUser, EmailTemplate } from '@/lib/types';
import { Search, RefreshCw, PlusCircle, ExternalLink, Users, Mail, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { sanitizePhoneNumber } from '@/lib/utils';


export default function AdminCustomersPage() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [users, setUsers] = useState<AppUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState('all');
    const router = useRouter();
    const { toast } = useToast();

    // State for manual subscription dialog
    const [isNewCustomerDialogOpen, setIsNewCustomerDialogOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    
    // State for sending email dialog
    const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
    const [customerToSendEmail, setCustomerToSendEmail] = useState<Customer | null>(null);
    const [emailSubject, setEmailSubject] = useState('');
    const [emailBody, setEmailBody] = useState('');
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState('');

    // State for delete confirmation
    const [isDeleting, setIsDeleting] = useState(false);
    const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);


    useEffect(() => {
        const unsubscribeCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
            const customersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
            setCustomers(customersData);
            setIsLoading(false);
        });

        // Fetch users to cross-reference display names
        const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
            const usersData = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as AppUser));
            setUsers(usersData);
        });

        const unsubscribeTemplates = onSnapshot(query(collection(db, 'emailTemplates'), orderBy('name')), (snapshot) => {
            const templatesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EmailTemplate));
            setEmailTemplates(templatesData);
        });
        
        return () => {
            unsubscribeCustomers();
            unsubscribeUsers();
            unsubscribeTemplates();
        }
    }, []);
    
    const handleCreateCustomer = async () => {
        if (!name || !email || !phone) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please fill out all fields.'});
            return;
        }
        
        const sanitizedPhone = sanitizePhoneNumber(phone);
        if (sanitizedPhone.length < 10) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please enter a valid 10-digit phone number.'});
            return;
        }

        setIsCreating(true);
      
        try {
            const response = await fetch('/api/create-stripe-customer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, phone: sanitizedPhone }),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to create customer.');
            }
            toast({ title: 'Success', description: 'New customer created in Stripe and locally.'});
            resetDialog();

        } catch(error: any) {
             toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
             setIsCreating(false);
        }
    }

    const resetDialog = () => {
        setIsNewCustomerDialogOpen(false);
        setName('');
        setEmail('');
        setPhone('');
    }

    const handleOpenEmailDialog = (customer: Customer) => {
        setCustomerToSendEmail(customer);
        setEmailSubject('');
        setEmailBody('');
        setSelectedTemplateId('');
        setIsEmailDialogOpen(true);
    };

    const handleSendEmail = async () => {
        if (!customerToSendEmail || !emailSubject || !emailBody) {
            toast({
                variant: 'destructive',
                title: 'Missing Fields',
                description: 'Please fill out both the subject and body of the email.',
            });
            return;
        }
        setIsSendingEmail(true);
        try {
            let finalBody = emailBody;
            let finalSubject = emailSubject;

            const template = emailTemplates.find(t => t.id === selectedTemplateId);

            let imageHtml = '';
            if (template?.veggieListImageUrl) {
                imageHtml += `<p><strong>This week's veggie list:</strong></p><img src="${template.veggieListImageUrl}" alt="Veggie List" style="max-width: 100%; height: auto; margin-bottom: 1rem;" />`;
            }
            if (template?.recipeCardImageUrl) {
                imageHtml += `<p><strong>Recipe suggestion:</strong></p><img src="${template.recipeCardImageUrl}" alt="Recipe Card" style="max-width: 100%; height: auto; margin-bottom: 1rem;" />`;
            }

            if (customerToSendEmail?.name) {
                const customerName = customerToSendEmail.name;
                finalBody = finalBody.replace(/{{customerName}}/gi, customerName);
                finalSubject = finalSubject.replace(/{{customerName}}/gi, customerName);
            }
            
            const fullHtmlBody = imageHtml + finalBody.replace(/\n/g, '<br>');

            await addDoc(collection(db, 'mail'), {
                to: [customerToSendEmail.email],
                message: {
                    subject: finalSubject,
                    html: fullHtmlBody,
                },
            });
            toast({
                title: 'Email Queued',
                description: `Your email to ${customerToSendEmail.email} is being sent.`,
            });
            setIsEmailDialogOpen(false);
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to send email.',
            });
            console.error('Failed to send email:', error);
        } finally {
            setIsSendingEmail(false);
        }
    };
    
    const handleOpenDeleteDialog = (customer: Customer) => {
        setCustomerToDelete(customer);
        setIsDeleteDialogOpen(true);
    };

    const confirmDeleteCustomer = async () => {
        if (!customerToDelete) return;

        setIsDeleting(true);
        try {
            const response = await fetch('/api/delete-stripe-customer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customerId: customerToDelete.id }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to delete customer.');
            }

            toast({ title: 'Success', description: `Customer "${customerToDelete.name}" has been deleted.` });
            setIsDeleteDialogOpen(false);
            setCustomerToDelete(null);
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.message || 'Could not delete the customer.',
            });
        } finally {
            setIsDeleting(false);
        }
    };

    const filteredCustomers = useMemo(() => {
        const usersMap = new Map(users.map(u => [u.uid, u]));

        const enrichedCustomers = customers.map(customer => {
            if (customer.userId) {
                const user = usersMap.get(customer.userId);
                if (user?.displayName) {
                    return { ...customer, name: user.displayName };
                }
            }
            return customer;
        });

        return enrichedCustomers
            .filter(customer => {
                const nameMatch = customer.name?.toLowerCase().includes(searchTerm.toLowerCase());
                const emailMatch = customer.email.toLowerCase().includes(searchTerm.toLowerCase());
                
                let filterMatch = true;
                if (filter === 'active') {
                    filterMatch = customer.status === 'active';
                } else if (filter === 'inactive') {
                    filterMatch = customer.status === 'inactive';
                }
                
                return (nameMatch || emailMatch) && filterMatch;
            })
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [customers, users, searchTerm, filter]);

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <div className="space-y-1">
                    <h1 className="text-lg font-semibold md:text-2xl font-headline">
                        Customers
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        A list of all customers from Stripe.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                     <Dialog open={isNewCustomerDialogOpen} onOpenChange={(isOpen) => { if(!isOpen) resetDialog(); else setIsNewCustomerDialogOpen(true); }}>
                        <DialogTrigger asChild>
                            <Button>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                New Customer
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Create New Customer</DialogTitle>
                                <DialogDescription>
                                    This will create a new customer record in your database and in Stripe.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 pt-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="name">Full Name</Label>
                                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} disabled={isCreating}/>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="email">Email Address</Label>
                                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isCreating}/>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="phone">Phone Number</Label>
                                    <Input 
                                        id="phone" 
                                        type="tel" 
                                        placeholder="1234567890" 
                                        value={phone} 
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                                            setPhone(val);
                                        }} 
                                        disabled={isCreating}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleCreateCustomer} disabled={isCreating}>
                                    {isCreating && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                                    Create Customer
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row gap-4">
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
                        <ToggleGroup type="single" value={filter} onValueChange={(value) => { if(value) setFilter(value) }} defaultValue="all">
                            <ToggleGroupItem value="all" aria-label="All customers">All</ToggleGroupItem>
                            <ToggleGroupItem value="active" aria-label="With active subscriptions"><Users className="mr-2 h-4 w-4" />Active</ToggleGroupItem>
                            <ToggleGroupItem value="inactive" aria-label="Without active subscriptions">Inactive</ToggleGroupItem>
                        </ToggleGroup>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead className="hidden md:table-cell">Email</TableHead>
                                <TableHead className="hidden sm:table-cell">Status</TableHead>
                                <TableHead className="hidden sm:table-cell">Active</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                        <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-32" /></TableCell>
                                        <TableCell className="hidden sm:table-cell"><Skeleton className="h-6 w-16" /></TableCell>
                                        <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-12" /></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-9 w-20 ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : filteredCustomers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        No matching customers found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredCustomers.map((customer) => (
                                    <TableRow key={customer.id} onClick={() => router.push(`/admin/customers/${customer.id}`)} className="cursor-pointer">
                                        <TableCell className="font-medium">{customer.name || ''}</TableCell>
                                        <TableCell className="hidden md:table-cell">{customer.email}</TableCell>
                                        <TableCell className="hidden sm:table-cell">
                                            <Badge variant={customer.status === 'active' ? 'default' : 'secondary'} className="capitalize">{customer.status?.charAt(0).toUpperCase() + customer.status?.slice(1) || 'Inactive'}</Badge>
                                        </TableCell>
                                        <TableCell className="hidden sm:table-cell">{customer.activeSubscriptionCount || 0}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end items-center space-x-1">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon"
                                                    className="hover:bg-muted"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleOpenEmailDialog(customer);
                                                    }}
                                                >
                                                    <Mail className="h-4 w-4" />
                                                    <span className="sr-only">Send Email</span>
                                                </Button>
                                                <Button variant="ghost" size="icon" className="hover:bg-muted" asChild onClick={(e) => e.stopPropagation()}>
                                                    <a href={`https://dashboard.stripe.com/test/customers/${customer.id}`} target="_blank" rel="noopener noreferrer">
                                                        <ExternalLink className="h-4 w-4" />
                                                        <span className="sr-only">View in Stripe</span>
                                                    </a>
                                                </Button>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon"
                                                    className="hover:bg-muted text-destructive hover:text-destructive"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleOpenDeleteDialog(customer);
                                                    }}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                    <span className="sr-only">Delete Customer</span>
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Send Email to {customerToSendEmail?.name}</DialogTitle>
                        <DialogDescription>
                            Compose and send an email directly to {customerToSendEmail?.email}. The email will be sent via the Trigger Email extension.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
                        <div className="grid gap-2">
                            <Label htmlFor="template">Use a Template (Optional)</Label>
                            <Select value={selectedTemplateId} onValueChange={(value) => {
                                const newSelectedId = value === 'none' ? '' : value;
                                setSelectedTemplateId(newSelectedId);
                                const template = emailTemplates.find(t => t.id === newSelectedId);
                                if (template) {
                                    setEmailSubject(template.subject);
                                    setEmailBody(template.body);
                                } else {
                                    setEmailSubject('');
                                    setEmailBody('');
                                }
                            }}
                            disabled={isSendingEmail}>
                                <SelectTrigger id="template">
                                    <SelectValue placeholder="Select a template" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">-- No Template --</SelectItem>
                                    {emailTemplates.map(template => (
                                        <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="subject">Subject</Label>
                            <Input id="subject" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} placeholder="Your message subject" disabled={isSendingEmail} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="body">Body</Label>
                            <Textarea id="body" value={emailBody} onChange={(e) => setEmailBody(e.target.value)} disabled={isSendingEmail} rows={10} placeholder="Write your message here... You can use {{customerName}} as a placeholder." />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleSendEmail} disabled={isSendingEmail}>
                            {isSendingEmail && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                            Send Email
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete the customer "{customerToDelete?.name}" and cancel all of their active subscriptions in Stripe.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmDeleteCustomer} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                        {isDeleting && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                        Yes, delete customer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
