'use client';

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { updateProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { auth, db, storage } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
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
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

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

    const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
    const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);

    useEffect(() => {
        if (user) {
            setName(user.displayName || '');
            setEmail(user.email || '');
        }
    }, [user]);

    const getInitials = (name: string | null | undefined) => {
        if (!name) return 'U';
        const names = name.split(' ');
        if (names.length > 1) {
            return names[0].charAt(0) + names[names.length - 1].charAt(0);
        }
        return name.charAt(0).toUpperCase();
    };

    const handleProfileImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setProfileImageFile(file);
            setProfileImagePreview(URL.createObjectURL(file));
        }
    };

    const handleSaveChanges = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setIsInfoSaving(true);
        try {
            let newPhotoURL = user.photoURL;

            if (profileImageFile) {
                const storageRef = ref(storage, `profile_pictures/${user.uid}`);
                await uploadBytes(storageRef, profileImageFile);
                newPhotoURL = await getDownloadURL(storageRef);
            }

            await updateProfile(user, { displayName: name, photoURL: newPhotoURL || null });
            const userDocRef = doc(db, 'users', user.uid);
            await updateDoc(userDocRef, { displayName: name, photoURL: newPhotoURL || null });
            
            toast({ title: "Success", description: "Profile updated successfully." });
            setProfileImageFile(null);
            setProfileImagePreview(null);
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
                        <Label htmlFor="picture">Profile Picture</Label>
                        <div className="flex items-center gap-4">
                            <Avatar className="h-20 w-20">
                                <AvatarImage src={profileImagePreview || user?.photoURL || ''} alt={user?.displayName || ''} />
                                <AvatarFallback>{getInitials(user?.displayName)}</AvatarFallback>
                            </Avatar>
                            <Input
                                id="picture"
                                type="file"
                                accept="image/*"
                                onChange={handleProfileImageChange}
                                disabled={isInfoSaving}
                                className="max-w-xs"
                            />
                        </div>
                    </div>
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
