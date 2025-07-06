'use client';

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { updateProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
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

export default function ProfilePage() {
    const { user } = useAuth();
    const { toast } = useToast();

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [isInfoSaving, setIsInfoSaving] = useState(false);
    const [isPasswordSaving, setIsPasswordSaving] = useState(false);

    useEffect(() => {
        if (user) {
            setName(user.displayName || '');
            setEmail(user.email || '');
        }
    }, [user]);

    const handleSaveChanges = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setIsInfoSaving(true);
        try {
            await updateProfile(user, { displayName: name });
            const userDocRef = doc(db, 'users', user.uid);
            await updateDoc(userDocRef, { displayName: name });
            toast({ title: "Success", description: "Profile updated successfully." });
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
            
            await auth.signOut();

        } catch (error: any) {
            toast({ variant: 'destructive', title: "Error", description: error.message });
        } finally {
            setIsPasswordSaving(false);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
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
                <CardDescription>Update your name and email address.</CardDescription>
                </CardHeader>
                <CardContent>
                <div className="grid gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} disabled={isInfoSaving} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" value={email} disabled />
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
        </div>
    </div>
  )
}
