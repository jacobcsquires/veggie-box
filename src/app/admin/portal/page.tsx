
'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, ExternalLink } from 'lucide-react';

export default function PortalSettingsPage() {
    const { toast } = useToast();
    const [portalUrl, setPortalUrl] = useState('');

    useEffect(() => {
        // This ensures the window object is available before constructing the URL.
        setPortalUrl(window.location.origin);
    }, []);

    const copyToClipboard = () => {
        navigator.clipboard.writeText(portalUrl).then(() => {
            toast({ title: 'Success', description: 'Portal URL copied to clipboard.' });
        }, () => {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to copy URL.' });
        });
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-lg font-semibold md:text-2xl font-headline">Customer Portal</h1>
                <p className="text-muted-foreground mt-1">View and manage your customer-facing portal.</p>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Portal Access</CardTitle>
                    <CardDescription>
                        This is the main URL for your customer portal. Share this link with your customers.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex w-full max-w-md items-center space-x-2">
                        <Input type="text" value={portalUrl} readOnly />
                        <Button variant="secondary" size="icon" onClick={copyToClipboard}>
                            <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="secondary" size="icon" asChild>
                            <a href={portalUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                            </a>
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Portal Settings</CardTitle>
                    <CardDescription>
                        Configure the appearance and behavior of your customer portal. (Coming soon)
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="portal-title">Portal Title</Label>
                            <Input id="portal-title" defaultValue="Veggie Box Customer Portal" disabled />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="welcome-message">Welcome Message</Label>
                            <Input id="welcome-message" defaultValue="Discover the best seasonal produce, sourced from local farms and delivered straight to your door." disabled />
                        </div>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button disabled>Save Settings</Button>
                </CardFooter>
            </Card>
        </div>
    );
}
