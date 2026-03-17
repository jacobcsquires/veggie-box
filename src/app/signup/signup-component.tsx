'use client';

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
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
import { sanitizePhoneNumber, formatPhoneNumber } from "@/lib/utils";

function SignupForm({ redirectTo }: { redirectTo: string | null }) {
    const router = useRouter();
    const { toast } = useToast();
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [phone, setPhone] = useState("");
    const [isLoading, setIsLoading] = useState(false);

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
                    <Input id="full-name" placeholder="Max Robinson" required value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={isLoading}/>
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
                        disabled={isLoading}
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input 
                        id="phone" 
                        type="tel" 
                        placeholder="(123) 456-7890" 
                        required 
                        value={phone} 
                        onChange={(e) => setPhone(formatPhoneNumber(e.target.value))} 
                        disabled={isLoading}
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={isLoading} required />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Creating account..." : "Create an account"}
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
