
'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, orderBy, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ScheduledEmail, EmailTemplate, Box } from '@/lib/types';
import { PlusCircle, Trash2, Send, RefreshCw, Calendar as CalendarIcon, Clock, Mail } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { isBefore, startOfToday } from 'date-fns';
import { Badge } from '@/components/ui/badge';

export default function AdminMarketingPage() {
    const [scheduledEmails, setScheduledEmails] = useState<ScheduledEmail[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    // Dialog state
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [templates, setTemplates] = useState<EmailTemplate[]>([]);
    const [boxes, setBoxes] = useState<Box[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [selectedTargetGroup, setSelectedTargetGroup] = useState('');
    const [sendAtDate, setSendAtDate] = useState<Date | undefined>();

    // Delete confirmation state
    const [isDeleting, setIsDeleting] = useState(false);
    const [emailToDelete, setEmailToDelete] = useState<ScheduledEmail | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    useEffect(() => {
        const q = query(collection(db, 'scheduledEmails'), orderBy('sendAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const emailsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ScheduledEmail));
            setScheduledEmails(emailsData);
            setIsLoading(false);
        });
        
        return () => unsubscribe();
    }, []);
    
    useEffect(() => {
        if (isDialogOpen) {
            const unsubTemplates = onSnapshot(query(collection(db, 'emailTemplates'), orderBy('name')), (snapshot) => {
                setTemplates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EmailTemplate)));
            });
            const unsubBoxes = onSnapshot(query(collection(db, 'boxes'), orderBy('name')), (snapshot) => {
                setBoxes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Box)));
            });
            return () => {
                unsubTemplates();
                unsubBoxes();
            };
        }
    }, [isDialogOpen]);

    const resetDialog = () => {
        setIsDialogOpen(false);
        setSelectedTemplateId('');
        setSelectedTargetGroup('');
        setSendAtDate(undefined);
    };
    
    const handleNewScheduleClick = () => {
        resetDialog();
        setIsDialogOpen(true);
    };

    const handleSaveSchedule = async () => {
        if (!selectedTemplateId || !selectedTargetGroup || !sendAtDate) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please fill out all fields.'});
            return;
        }
        setIsSaving(true);
      
        try {
            const template = templates.find(t => t.id === selectedTemplateId);
            let targetGroupName = '';
            if (selectedTargetGroup === 'all_customers') {
                targetGroupName = 'All Customers';
            } else if (selectedTargetGroup === 'all_active_subscribers') {
                targetGroupName = 'All Active Subscribers';
            } else {
                const box = boxes.find(b => b.id === selectedTargetGroup);
                targetGroupName = `Subscribers: ${box?.name}`;
            }

            const scheduledEmailData = {
                templateId: selectedTemplateId,
                templateName: template?.name,
                sendAt: Timestamp.fromDate(sendAtDate),
                targetGroup: selectedTargetGroup,
                targetGroupName,
                status: 'scheduled' as const,
                createdAt: serverTimestamp(),
            };

            await addDoc(collection(db, 'scheduledEmails'), scheduledEmailData);
            toast({ title: 'Success', description: 'Email has been scheduled.'});
            resetDialog();
        } catch(error: any) {
             toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
             setIsSaving(false);
        }
    };
    
    const handleOpenDeleteDialog = (email: ScheduledEmail) => {
        setEmailToDelete(email);
        setIsDeleteDialogOpen(true);
    };

    const confirmDeleteSchedule = async () => {
        if (!emailToDelete) return;
        setIsDeleting(true);
        try {
            await deleteDoc(doc(db, 'scheduledEmails', emailToDelete.id));
            toast({ title: 'Success', description: `Scheduled email has been deleted.` });
            setIsDeleteDialogOpen(false);
            setEmailToDelete(null);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not delete the scheduled email.' });
        } finally {
            setIsDeleting(false);
        }
    };

    const getStatusBadgeVariant = (status: ScheduledEmail['status']) => {
        switch (status) {
            case 'scheduled': return 'secondary';
            case 'sent': return 'default';
            case 'error': return 'destructive';
            default: return 'outline';
        }
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <div className="space-y-1">
                    <h1 className="text-lg font-semibold md:text-2xl font-headline">
                        Marketing Campaigns
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        Schedule and manage email campaigns for your customers.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={handleNewScheduleClick}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Schedule Email
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Email Schedule</CardTitle>
                    <CardDescription>A list of all your scheduled, sent, and failed email campaigns.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Campaign</TableHead>
                                <TableHead>Target Group</TableHead>
                                <TableHead>Send Date</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-9 w-10 ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : scheduledEmails.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        You haven't scheduled any emails yet.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                scheduledEmails.map((email) => (
                                    <TableRow key={email.id}>
                                        <TableCell className="font-medium">{email.templateName}</TableCell>
                                        <TableCell>{email.targetGroupName}</TableCell>
                                        <TableCell>{format(email.sendAt.toDate(), 'PPP p')}</TableCell>
                                        <TableCell><Badge variant={getStatusBadgeVariant(email.status)} className="capitalize">{email.status}</Badge></TableCell>
                                        <TableCell className="text-right">
                                            {email.status === 'scheduled' && (
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon"
                                                    className="hover:bg-muted text-destructive hover:text-destructive"
                                                    onClick={() => handleOpenDeleteDialog(email)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                    <span className="sr-only">Delete Schedule</span>
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={(isOpen) => { if(!isOpen) resetDialog(); else setIsDialogOpen(true); }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Schedule a New Email Campaign</DialogTitle>
                        <DialogDescription>
                           Select a template, target audience, and a date to send the email.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="template">Email Template</Label>
                            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId} disabled={isSaving}>
                                <SelectTrigger id="template"><SelectValue placeholder="Select a template..." /></SelectTrigger>
                                <SelectContent>
                                    {templates.map(template => (
                                        <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="target-group">Target Group</Label>
                            <Select value={selectedTargetGroup} onValueChange={setSelectedTargetGroup} disabled={isSaving}>
                                <SelectTrigger id="target-group"><SelectValue placeholder="Select a group..." /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all_customers">All Customers</SelectItem>
                                    <SelectItem value="all_active_subscribers">All Active Subscribers</SelectItem>
                                    {boxes.map(box => (
                                        <SelectItem key={box.id} value={box.id}>Subscribers: {box.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                             <Label htmlFor="send-date">Send Date</Label>
                             <Popover>
                                <PopoverTrigger asChild>
                                <Button variant={"outline"} className={cn("justify-start text-left font-normal", !sendAtDate && "text-muted-foreground")}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {sendAtDate ? format(sendAtDate, "PPP") : <span>Pick a date</span>}
                                </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar 
                                        mode="single" 
                                        selected={sendAtDate} 
                                        onSelect={setSendAtDate} 
                                        disabled={(date) => isBefore(date, startOfToday())}
                                        initialFocus 
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleSaveSchedule} disabled={isSaving}>
                            {isSaving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Schedule Email
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will delete the scheduled email campaign "{emailToDelete?.templateName}". This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmDeleteSchedule} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                        {isDeleting && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                        Yes, delete schedule
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
