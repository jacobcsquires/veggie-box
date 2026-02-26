'use client';

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, updateProfile, getAdditionalUserInfo } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sprout } from "lucide-react";
import { sanitizePhoneNumber } from "@/lib/utils";

function SignupForm({ redirectTo }: { redirectTo: string | null }) {
    const router = useRouter();
    const { toast } = useToast();
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [phone, setPhone] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);

    const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);

        const sanitizedPhone = sanitizePhoneNumber(phone);
        if (sanitizedPhone.length < 10) {
            toast({
                variant: "destructive",
                title: "Signup Failed",
                description: "Please enter a valid 10-digit phone number.",
            });
            setIsLoading(false);
            return;
        }

        if (password.length < 6) {
            toast({
                variant: "destructive",
                title: "Signup Failed",
                description: "Password must be at least 6 characters long.",
            });
            setIsLoading(false);
            return;
        }

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            await updateProfile(user, { displayName: fullName });

            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                displayName: fullName,
                email: user.email,
                phone: sanitizedPhone,
                createdAt: serverTimestamp(),
                isAdmin: false,
            });
            
            router.push(redirectTo || "/dashboard");
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Signup Failed",
                description: error.message,
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSignup = async () => {
        setIsGoogleLoading(true);
        const provider = new GoogleAuthProvider();
        try {
            const result = await signInWithPopup(auth, provider);
            const user = result.user;
            const additionalInfo = getAdditionalUserInfo(result);

            if (additionalInfo?.isNewUser) {
                await setDoc(doc(db, "users", user.uid), {
                    uid: user.uid,
                    displayName: user.displayName,
                    email: user.email,
                    phone: user.phoneNumber ? sanitizePhoneNumber(user.phoneNumber) : null,
                    createdAt: serverTimestamp(),
                    isAdmin: false,
                });
            } else {
                await setDoc(doc(db, "users", user.uid), {
                    displayName: user.displayName,
                }, { merge: true });
            }

            router.push(redirectTo || '/dashboard');
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Signup Failed",
                description: error.message,
            });
        } finally {
            setIsGoogleLoading(false);
        }
    };

  return (
     <div className="flex items-center justify-center min-h-screen bg-muted/40">
        <Card className="mx-auto max-w-sm w-full">
         <CardHeader>
            <div className="flex justify-center mb-4">
                <Link href="/" className="flex items-center gap-2 font-semibold">
                    <Sprout className="h-6 w-6 text-primary" />
                    <span className="font-headline text-lg">Veggie Box</span>
                </Link>
            </div>
            <CardTitle className="text-2xl text-center font-headline">Sign Up</CardTitle>
            <CardDescription className="text-center">
                Enter your information to create an account
            </CardDescription>
            </CardHeader>
            <CardContent>
            <form onSubmit={handleSignup} className="grid gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="full-name">Full name</Label>
                    <Input id="full-name" placeholder="Max Robinson" required value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={isLoading || isGoogleLoading}/>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                        id="email"
                        type="email"
                        placeholder="m@example.com"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isLoading || isGoogleLoading}
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input 
                        id="phone" 
                        type="tel" 
                        placeholder="1234567890" 
                        required 
                        value={phone} 
                        onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                            setPhone(val);
                        }} 
                        disabled={isLoading || isGoogleLoading}
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={isLoading || isGoogleLoading} required />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading || isGoogleLoading}>
                    {isLoading ? "Creating account..." : "Create an account"}
                </Button>
                 <Button variant="outline" type="button" className="w-full" onClick={handleGoogleSignup} disabled={isLoading || isGoogleLoading}>
                    {isGoogleLoading ? "Signing up..." : "Sign up with Google"}
                </Button>
            </form>
            <div className="mt-4 text-center text-sm">
                Already have an account?{" "}
                <Link href={redirectTo ? `/login?redirect_to=${encodeURIComponent(redirectTo)}` : "/login"} className="underline">
                    Login
                </Link>
            </div>
            </CardContent>
        </Card>
    </div>
  )
}

export function SignupComponent() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect_to');

  return <SignupForm redirectTo={redirectTo} />;
}
