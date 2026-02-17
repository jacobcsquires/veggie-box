'use client';

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { updateProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider, signOut, updateEmail } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogOut } from "lucide-react";

export default function ProfilePage() {
    const { user } = useAuth();
    const { toast } = useToast();

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [isInfoSaving, setIsInfoSaving] = useState(false);
    const [isPasswordSaving, setIsPasswordSaving] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    useEffect(() => {
        if (user) {
            setName(user.displayName || '');
            setEmail(user.email || '');
            setPhone(user.phone || '');
        }
    }, [user]);

    const handleSaveChanges = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setIsInfoSaving(true);
        try {
            if (user.displayName !== name) {
                await updateProfile(user, { displayName: name });
            }
            if (user.email !== email) {
                await updateEmail(user, email);
            }

            const userDocRef = doc(db, 'users', user.uid);
            await updateDoc(userDocRef, { 
                displayName: name,
                phone: phone,
                email: email,
            });
            
            toast({ title: "Success", description: "Profile updated successfully." });
            
            if (user.email !== email) {
                toast({ title: "Verify Email", description: "A verification link has been sent to your new email address." });
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Error", description: error.message });
        } finally {
            setIsInfoSaving(false);
        }
    };

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !user.email) return;

        if (newPassword !== confirmPassword) {
            toast({ variant: 'destructive', title: "Error", description: "New passwords do not match." });
            return;
        }
        if (newPassword.length < 6) {
             toast({ variant: 'destructive', title: "Error", description: "Password must be at least 6 characters." });
            return;
        }

        setIsPasswordSaving(true);
        try {
            const credential = EmailAuthProvider.credential(user.email, currentPassword);
            await reauthenticateWithCredential(user, credential);
            await updatePassword(user, newPassword);
            toast({ title: "Success", description: "Password updated successfully. You have been logged out for security." });
            
            await signOut(auth);

        } catch (error: any) => {
            toast({ variant: 'destructive', title: "Error", description: error.message });
        } finally {
            setIsPasswordSaving(false);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        }
    };
    
    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await signOut(auth);
            toast({ title: "Logged Out", description: "You have been successfully logged out." });
        } catch (error: any) => {
            toast({ variant: 'destructive', title: "Error", description: error.message });
        } finally {
            setIsLoggingOut(false);
        }
    };

  return (
    <div>
       <h1 className="text-lg font-semibold md:text-2xl font-headline mb-4">Your Profile</h1>
        <div className="grid gap-6">
          <Card>
            <form onSubmit={handleSaveChanges}>
                <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>Update your name and contact information.</CardDescription>
                </CardHeader>
                <CardContent>
                <div className="grid gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} disabled={isInfoSaving} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="phone">Phone</Label>
                        <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={isInfoSaving} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isInfoSaving} />
                    </div>
                </div>
                </CardContent>
                <CardFooter className="border-t px-6 py-4">
                <Button type="submit" disabled={isInfoSaving}>{isInfoSaving ? 'Saving...' : 'Save Changes'}</Button>
                </CardFooter>
            </form>
          </Card>
          <Card>
            <form onSubmit={handleUpdatePassword}>
                <CardHeader>
                <CardTitle>Password</CardTitle>
                <CardDescription>
                    Change your password here. After saving, you'll be logged out.
                </CardDescription>
                </CardHeader>
                <CardContent>
                <div className="grid gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="current-password">Current Password</Label>
                        <Input id="current-password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} disabled={isPasswordSaving}/>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="new-password">New Password</Label>
                        <Input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={isPasswordSaving}/>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="confirm-password">Confirm New Password</Label>
                        <Input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={isPasswordSaving}/>
                    </div>
                </div>
                </CardContent>
                <CardFooter className="border-t px-6 py-4">
                    <Button type="submit" disabled={isPasswordSaving}>{isPasswordSaving ? 'Updating...' : 'Update Password'}</Button>
                </CardFooter>
            </form>
          </Card>
           <Card>
            <CardHeader>
              <CardTitle>Log Out</CardTitle>
              <CardDescription>
                Clicking this button will log you out of your account.
              </CardDescription>
            </CardHeader>
            <CardFooter className="border-t px-6 py-4">
              <Button variant="destructive" onClick={handleLogout} disabled={isLoggingOut}>
                <LogOut className="mr-2 h-4 w-4" />
                {isLoggingOut ? 'Logging out...' : 'Log Out'}
              </Button>
            </CardFooter>
          </Card>
        </div>
    </div>
  )
}
