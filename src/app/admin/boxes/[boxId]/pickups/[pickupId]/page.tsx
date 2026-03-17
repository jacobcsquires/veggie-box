'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { doc, getDoc, collection, onSnapshot, setDoc, deleteDoc, serverTimestamp, query, where, orderBy, Timestamp, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Box, Subscription, Pickup, EmailTemplate } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { format, formatDistanceToNow } from 'date-fns';
import { ChevronRight, Search, Users, CheckCircle, XCircle, UserCheck, Package, Mail, RefreshCw, AlertCircle } from 'lucide-react';
import { ToggleGroup as ShToggleGroup, ToggleGroupItem as ShToggleGroupItem } from '@/components/ui/toggle-group';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

type SubscriberCheckin = Subscription & {
  collected: boolean;
  collectedAt: Date | null;
  pickupSpecificNote?: string;
};

export default function PickupCheckinPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const fromDashboard = searchParams.get('from') === 'dashboard';
    const boxId = params.boxId as string;
    const pickupId = params.pickupId as string;

    const [box, setBox] = useState<Box | null>(null);
    const [pickup, setPickup] = useState<Pickup | null>(null);
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [collectionStatuses, setCollectionStatuses] = useState<Map<string, {collected: boolean, collectedAt: Date | null}>>(new Map());
    const [subscriberNotes, setSubscriberNotes] = useState<Map<string, string>>(new Map());
    const [isLoading, setIsLoading] = useState(true);

    const [filter, setFilter] = useState('all'); // 'all', 'collected', 'uncollected'
    const [searchTerm, setSearchTerm] = useState('');

    // Bulk Email State
    const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
    const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [isSendingEmails, setIsSendingEmails] = useState(false);

    useEffect(() => {
        if (!boxId || !pickupId) return;

        const boxRef = doc(db, 'boxes', boxId);
        const unsubBox = onSnapshot(boxRef, (docSnap) => {
            if (docSnap.exists()) {
                setBox({ id: docSnap.id, ...docSnap.data() } as Box);
            }
        });

        const pickupRef = doc(db, 'boxes', boxId, 'pickups', pickupId);
        const unsubPickup = onSnapshot(pickupRef, (docSnap) => {
            if (docSnap.exists()) {
                setPickup({ id: docSnap.id, ...docSnap.data() } as Pickup);
            }
        });

        // Fetch pickup-specific subscriber notes
        const notesRef = collection(db, 'boxes', boxId, 'pickups', pickupId, 'subscriberNotes');
        const unsubNotes = onSnapshot(notesRef, (snapshot) => {
            const notes = new Map<string, string>();
            snapshot.docs.forEach(doc => {
                notes.set(doc.id, doc.data().text || '');
            });
            setSubscriberNotes(notes);
        });

        const subsQuery = query(collection(db, 'subscriptions'), where('boxId', '==', boxId));
        const unsubSubs = onSnapshot(subsQuery, async (snapshot) => {
            const subsData = snapshot.docs
                .map(doc => ({id: doc.id, ...doc.data()}) as Subscription)
                .filter(sub => sub.status === 'Active' || sub.status === 'Trialing');
            
            const enrichedSubs = await Promise.all(subsData.map(async (sub) => {
                if (sub.customerEmail) return sub;
                if (!sub.stripeCustomerId) return sub;
                try {
                    const customerRef = doc(db, 'customers', sub.stripeCustomerId);
                    const customerSnap = await getDoc(customerRef);
                    if (customerSnap.exists()) {
                        const custData = customerSnap.data();
                        return { ...sub, customerEmail: custData.email, customerName: custData.name || sub.customerName };
                    }
                } catch (error) {
                    console.error(`Failed to fetch customer data for sub ${sub.id}`, error);
                }
                return sub;
            }));

            setSubscriptions(enrichedSubs);
            setIsLoading(false);
        });

        const collectionsRef = collection(db, 'boxes', boxId, 'pickups', pickupId, 'collections');
        const unsubCollections = onSnapshot(collectionsRef, (snapshot) => {
            const statuses = new Map<string, {collected: boolean, collectedAt: Date | null}>();
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                statuses.set(doc.id, { collected: data.collected, collectedAt: (data.collectedAt as Timestamp)?.toDate() || null });
            });
            setCollectionStatuses(statuses);
        });

        const templatesQuery = query(collection(db, 'emailTemplates'), orderBy('name'));
        const unsubTemplates = onSnapshot(templatesQuery, (snapshot) => {
            setEmailTemplates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EmailTemplate)));
        });

        return () => {
            unsubBox();
            unsubPickup();
            unsubSubs();
            unsubCollections();
            unsubTemplates();
            unsubNotes();
        };
    }, [boxId, pickupId]);

    const handleToggleCollection = useCallback(async (subscription: SubscriberCheckin) => {
        const { id: subscriptionId, customerName, collected } = subscription;
        const collectionRef = doc(db, 'boxes', boxId, 'pickups', pickupId, 'collections', subscriptionId);
        
        try {
            if (collected) {
                await deleteDoc(collectionRef);
            } else {
                await setDoc(collectionRef, {
                    collected: true,
                    collectedAt: serverTimestamp(),
                    customerName: customerName,
                    subscriptionId: subscriptionId
                });
            }
        } catch (error) {
            console.error("Failed to update collection status:", error);
        }
    }, [boxId, pickupId]);

    const subscribersWithStatus: SubscriberCheckin[] = useMemo(() => {
        return subscriptions.map(sub => {
            return {
                ...sub,
                collected: collectionStatuses.has(sub.id),
                collectedAt: collectionStatuses.get(sub.id)?.collectedAt || null,
                pickupSpecificNote: subscriberNotes.get(sub.id)
            };
        }).sort((a,b) => (a.customerName || '').localeCompare(b.customerName || ''));
    }, [subscriptions, collectionStatuses, subscriberNotes]);
    
    const filteredSubscribers = useMemo(() => {
        return subscribersWithStatus.filter(sub => {
            const matchesFilter = filter === 'all' || (filter === 'collected' && sub.collected) || (filter === 'uncollected' && !sub.collected);
            const matchesSearch = searchTerm === '' || sub.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) || sub.customerEmail?.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesFilter && matchesSearch;
        });
    }, [subscribersWithStatus, filter, searchTerm]);

    const uncollectedSubscribers = useMemo(() => {
        return subscribersWithStatus.filter(s => !s.collected);
    }, [subscribersWithStatus]);

    const collectedCount = useMemo(() => {
        return Array.from(collectionStatuses.values()).filter(s => s.collected).length;
    }, [collectionStatuses]);
    
    const progressPercentage = subscriptions.length > 0 ? (collectedCount / subscriptions.length) * 100 : 0;

    const handleSendBulkEmail = async () => {
        if (!selectedTemplateId || uncollectedSubscribers.length === 0) return;
        
        setIsSendingEmails(true);
        try {
            const template = emailTemplates.find(t => t.id === selectedTemplateId);
            if (!template) throw new Error("Template not found");

            const batchCount = uncollectedSubscribers.length;
            
            for (const sub of uncollectedSubscribers) {
                if (!sub.customerEmail) continue;

                let finalBody = template.body;
                let finalSubject = template.subject;

                if (sub.customerName) {
                    finalBody = finalBody.replace(/{{customerName}}/gi, sub.customerName);
                    finalSubject = finalSubject.replace(/{{customerName}}/gi, sub.customerName);
                }
                if (box) {
                    finalBody = finalBody.replace(/{{boxName}}/gi, box.name);
                    finalSubject = finalSubject.replace(/{{boxName}}/gi, box.name);
                }
                if (pickup) {
                    const formattedDate = format(new Date(pickup.pickupDate.replace(/-/g, '/')), 'PPPP');
                    finalBody = finalBody.replace(/{{pickupDate}}/gi, formattedDate);
                    finalSubject = finalSubject.replace(/{{pickupDate}}/gi, formattedDate);
                }

                let imageHtml = '';
                if (template.veggieListImageUrl) {
                    imageHtml += `<p><strong>This week's veggie list:</strong></p><img src="${template.veggieListImageUrl}" alt="Veggie List" style="max-width: 100%; height: auto; margin-bottom: 1rem;" />`;
                }
                if (template.recipeCardImageUrl) {
                    imageHtml += `<p><strong>Recipe suggestion:</strong></p><img src="${template.recipeCardImageUrl}" alt="Recipe Card" style="max-width: 100%; height: auto; margin-bottom: 1rem;" />`;
                }

                const fullHtmlBody = imageHtml + finalBody.replace(/\n/g, '<br>');

                await addDoc(collection(db, 'mail'), {
                    to: [sub.customerEmail],
                    message: {
                        subject: finalSubject,
                        html: fullHtmlBody,
                    },
                });
            }

            toast({
                title: 'Emails Queued',
                description: `Successfully queued reminder emails for ${batchCount} subscribers.`,
            });
            setIsEmailDialogOpen(false);
        } catch (error: any) {
            console.error("Failed to send bulk emails:", error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to send bulk reminder emails.',
            });
        } finally {
            setIsSendingEmails(false);
        }
    };

    if (isLoading) {
        return <div className="p-6"><Skeleton className="h-96 w-full" /></div>;
    }

    if (!box || !pickup) {
        return <div className="p-6">Pickup not found.</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center text-sm text-muted-foreground">
                {fromDashboard ? (
                    <>
                        <Link href="/admin/dashboard" className="hover:text-primary">Dashboard</Link>
                        <ChevronRight className="h-4 w-4 mx-1" />
                    </>
                ) : (
                    <>
                        <Link href="/admin/boxes" className="hover:text-primary">Veggie Box Plans</Link>
                        <ChevronRight className="h-4 w-4 mx-1" />
                        <Link href={`/admin/boxes/${boxId}`} className="hover:text-primary truncate max-w-48">{box.name}</Link>
                        <ChevronRight className="h-4 w-4 mx-1" />
                    </>
                )}
                <span className="font-medium text-foreground">Check-in</span>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-headline font-bold">Pickup Check-in</h1>
                    <p className="text-muted-foreground">
                        For {box.name} on {format(new Date(pickup.pickupDate.replace(/-/g, '/')), 'PPPP')}
                    </p>
                </div>
                {uncollectedSubscribers.length > 0 && (
                    <Button onClick={() => setIsEmailDialogOpen(true)} variant="outline">
                        <Mail className="mr-2 h-4 w-4" />
                        Email Uncollected ({uncollectedSubscribers.length})
                    </Button>
                )}
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Collection Progress</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    <Progress value={progressPercentage} />
                    <p className="text-sm text-muted-foreground font-medium">
                        {collectedCount} of {subscriptions.length} subscribers have collected their box.
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Subscriber List</CardTitle>
                    <CardDescription>Check off subscribers as they collect their veggie box.</CardDescription>
                     <div className="flex flex-col md:flex-row gap-4 pt-4">
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
                        <ShToggleGroup type="single" value={filter} onValueChange={(value) => { if(value) setFilter(value) }} defaultValue="all">
                            <ShToggleGroupItem value="all" aria-label="All subscribers">All</ShToggleGroupItem>
                            <ShToggleGroupItem value="uncollected" aria-label="Uncollected"><XCircle className="mr-2 h-4 w-4" />Not Collected</ShToggleGroupItem>
                            <ShToggleGroupItem value="collected" aria-label="Collected"><CheckCircle className="mr-2 h-4 w-4" />Collected</ShToggleGroupItem>
                        </ShToggleGroup>
                    </div>
                </CardHeader>
                <CardContent>
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]"></TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead className="hidden md:table-cell">Instructions</TableHead>
                                <TableHead className="hidden sm:table-cell">Status</TableHead>
                                <TableHead className="text-right">Collected At</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredSubscribers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        No matching subscribers found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredSubscribers.map((sub) => (
                                    <TableRow key={sub.id} className={cn(sub.collected ? "bg-secondary/40 hover:bg-secondary/60" : "bg-orange-50/30 hover:bg-orange-50/50")}>
                                        <TableCell>
                                            <Checkbox
                                                checked={sub.collected}
                                                onCheckedChange={() => handleToggleCollection(sub)}
                                                id={`check-${sub.id}`}
                                                aria-label={`Mark ${sub.customerName} as collected`}
                                            />
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            <div className="flex flex-col">
                                                <span>{sub.customerName}</span>
                                                <span className="text-xs text-muted-foreground font-normal">{sub.customerEmail}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell">
                                            {sub.pickupSpecificNote ? (
                                                <div className="bg-primary/10 border border-primary/20 rounded p-2 text-xs">
                                                    <span className="font-bold text-primary block mb-1">Instruction:</span>
                                                    {sub.pickupSpecificNote}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-muted-foreground italic">No instructions</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="hidden sm:table-cell">
                                            <div className="flex items-center gap-2">
                                                {sub.collected ? (
                                                    <Badge variant="default" className="bg-green-600 hover:bg-green-600">
                                                        <CheckCircle className="mr-1 h-3 w-3" /> Collected
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50">
                                                        <AlertCircle className="mr-1 h-3 w-3" /> Pending
                                                    </Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {sub.collectedAt ? formatDistanceToNow(sub.collectedAt, { addSuffix: true }) : 'N/A'}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Send Collection Reminder</DialogTitle>
                        <DialogDescription>
                            Send a reminder email to all {uncollectedSubscribers.length} subscribers who haven't collected their box today.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">Select Template</label>
                            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select an email template..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {emailTemplates.map(template => (
                                        <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEmailDialogOpen(false)} disabled={isSendingEmails}>Cancel</Button>
                        <Button onClick={handleSendBulkEmail} disabled={isSendingEmails || !selectedTemplateId}>
                            {isSendingEmails ? (
                                <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Sending...</>
                            ) : (
                                <><Mail className="mr-2 h-4 w-4" /> Send Reminders</>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
