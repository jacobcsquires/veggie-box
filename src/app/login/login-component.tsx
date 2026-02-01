'use client';

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, getAdditionalUserInfo } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
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
import { useAuth } from "@/contexts/auth-context";

function Redirecter() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        if (!loading && user) {
            const redirectTo = searchParams.get('redirect_to');
            router.replace(redirectTo || '/dashboard');
        }
    }, [user, loading, router, searchParams]);

    return null;
}

function SignupLink() {
    const searchParams = useSearchParams();
    const redirectTo = searchParams.get('redirect_to');
    
    const signupUrl = redirectTo ? `/signup?redirect_to=${encodeURIComponent(redirectTo)}` : "/signup";

    return (
        <div className="mt-4 text-center text-sm">
            Don&apos;t have an account?{" "}
            <Link href={signupUrl} className="underline">
              Sign up
            </Link>
        </div>
    );
}

export function LoginComponent() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Let the Redirecter handle redirection
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        const additionalInfo = getAdditionalUserInfo(result);

        // If it's a new user, create their document in Firestore
        if (additionalInfo?.isNewUser) {
            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                displayName: user.displayName,
                email: user.email,
                createdAt: serverTimestamp(),
                isAdmin: false,
            });
        }
        // Let the Redirecter handle redirection
    } catch (error: any) {
        toast({
            variant: "destructive",
            title: "Login Failed",
            description: error.message,
        });
    } finally {
        setIsGoogleLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/40">
        <Suspense fallback={null}>
            <Redirecter />
        </Suspense>
      <Card className="mx-auto max-w-sm w-full">
        <CardHeader>
          <div className="flex justify-center mb-4">
             <Link href="/" className="flex items-center gap-2 font-semibold">
                <Sprout className="h-6 w-6 text-primary" />
                <span className="font-headline text-lg">Veggie Box</span>
            </Link>
          </div>
          <CardTitle className="text-2xl text-center font-headline">Login</CardTitle>
          <CardDescription className="text-center">
            Enter your email below to login to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
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
              <div className="flex items-center">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="#"
                  className="ml-auto inline-block text-sm underline"
                >
                  Forgot your password?
                </Link>
              </div>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} disabled={isLoading || isGoogleLoading} />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading || isGoogleLoading}>
              {isLoading ? "Logging in..." : "Login"}
            </Button>
            <Button variant="outline" className="w-full" onClick={handleGoogleLogin} type="button" disabled={isLoading || isGoogleLoading}>
                {isGoogleLoading ? "Logging in..." : "Login with Google"}
            </Button>
          </form>
           <Suspense fallback={<div className="mt-4 text-center text-sm h-5" />}>
             <SignupLink />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
