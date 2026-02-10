
'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { EmailTemplate } from '@/lib/types';
import { PlusCircle, Trash2, FilePen, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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


export default function AdminEmailTemplatesPage() {
    const [templates, setTemplates] = useState<EmailTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    // Dialog state
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
    const [name, setName] = useState('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');

    // Delete confirmation state
    const [isDeleting, setIsDeleting] = useState(false);
    const [templateToDelete, setTemplateToDelete] = useState<EmailTemplate | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    useEffect(() => {
        const q = query(collection(db, 'emailTemplates'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const templatesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EmailTemplate));
            setTemplates(templatesData);
            setIsLoading(false);
        });
        
        return () => unsubscribe();
    }, []);

    const resetDialog = () => {
        setIsDialogOpen(false);
        setEditingTemplate(null);
        setName('');
        setSubject('');
        setBody('');
    };
    
    const handleNewTemplateClick = () => {
        resetDialog();
        setIsDialogOpen(true);
    };
    
    const handleEditTemplateClick = (template: EmailTemplate) => {
        setEditingTemplate(template);
        setName(template.name);
        setSubject(template.subject);
        setBody(template.body);
        setIsDialogOpen(true);
    };

    const handleSaveTemplate = async () => {
        if (!name || !subject || !body) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please fill out all fields.'});
            return;
        }
        setIsSaving(true);
      
        try {
            if (editingTemplate) {
                // Update existing template
                const templateRef = doc(db, 'emailTemplates', editingTemplate.id);
                await updateDoc(templateRef, { name, subject, body, createdAt: serverTimestamp() });
                toast({ title: 'Success', description: 'Template updated successfully.'});
            } else {
                // Create new template
                await addDoc(collection(db, 'emailTemplates'), {
                    name,
                    subject,
                    body,
                    createdAt: serverTimestamp(),
                });
                toast({ title: 'Success', description: 'New email template created.'});
            }
            resetDialog();
        } catch(error: any) {
             toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
             setIsSaving(false);
        }
    };
    
    const handleOpenDeleteDialog = (template: EmailTemplate) => {
        setTemplateToDelete(template);
        setIsDeleteDialogOpen(true);
    };

    const confirmDeleteTemplate = async () => {
        if (!templateToDelete) return;

        setIsDeleting(true);
        try {
            await deleteDoc(doc(db, 'emailTemplates', templateToDelete.id));
            toast({ title: 'Success', description: `Template "${templateToDelete.name}" has been deleted.` });
            setIsDeleteDialogOpen(false);
            setTemplateToDelete(null);
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Could not delete the template.',
            });
        } finally {
            setIsDeleting(false);
        }
    };


    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <div className="space-y-1">
                    <h1 className="text-lg font-semibold md:text-2xl font-headline">
                        Email Templates
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        Create and manage templates for sending emails to your customers.
                    </p>
                </div>
                <Button onClick={handleNewTemplateClick}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    New Template
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Your Templates</CardTitle>
                    <CardDescription>A list of all saved email templates.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead className="hidden md:table-cell">Subject</TableHead>
                                <TableHead className="hidden sm:table-cell">Last Updated</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                        <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-48" /></TableCell>
                                        <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-24" /></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-9 w-20 ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : templates.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        You haven't created any email templates yet.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                templates.map((template) => (
                                    <TableRow key={template.id}>
                                        <TableCell className="font-medium">{template.name}</TableCell>
                                        <TableCell className="hidden md:table-cell max-w-sm truncate">{template.subject}</TableCell>
                                        <TableCell className="hidden sm:table-cell">
                                            {template.createdAt ? format(template.createdAt.toDate(), 'PPP') : 'N/A'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end items-center space-x-1">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon"
                                                    className="hover:bg-muted"
                                                    onClick={() => handleEditTemplateClick(template)}
                                                >
                                                    <FilePen className="h-4 w-4" />
                                                    <span className="sr-only">Edit Template</span>
                                                </Button>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon"
                                                    className="hover:bg-muted text-destructive hover:text-destructive"
                                                    onClick={() => handleOpenDeleteDialog(template)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                    <span className="sr-only">Delete Template</span>
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

            <Dialog open={isDialogOpen} onOpenChange={(isOpen) => { if(!isOpen) resetDialog(); else setIsDialogOpen(true); }}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{editingTemplate ? 'Edit' : 'Create'} Email Template</DialogTitle>
                        <DialogDescription>
                            {editingTemplate ? 'Modify the details of your email template.' : 'Create a new reusable email template.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Template Name</Label>
                            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} disabled={isSaving} placeholder="e.g., Welcome Email" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="subject">Subject</Label>
                            <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} disabled={isSaving} placeholder="Your message subject" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="body">Body</Label>
                            <Textarea id="body" value={body} onChange={(e) => setBody(e.target.value)} disabled={isSaving} rows={12} placeholder="Write your message here..." />
                            <p className="text-xs text-muted-foreground">You can use placeholders like {"{{customerName}}"} which will be replaced automatically.</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleSaveTemplate} disabled={isSaving}>
                            {isSaving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Save Template
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete the template "{templateToDelete?.name}".
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmDeleteTemplate} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                        {isDeleting && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                        Yes, delete template
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
