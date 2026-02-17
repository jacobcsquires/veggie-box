'use client';

import Link from "next/link";
import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
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

export function ForgotPasswordComponent() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handlePasswordReset = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setEmailSent(true);
      toast({
        title: "Check your email",
        description: "A password reset link has been sent to your email address.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
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
          <CardTitle className="text-2xl text-center font-headline">Forgot Password</CardTitle>
          <CardDescription className="text-center">
            {emailSent 
              ? "You can now close this page."
              : "Enter your email to receive a password reset link."
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {emailSent ? (
             <div className="text-center text-sm text-muted-foreground">
                <p>If you don't see the email, please check your spam folder.</p>
                <Button variant="link" asChild className="mt-4">
                    <Link href="/login">Back to Login</Link>
                </Button>
            </div>
          ) : (
            <form onSubmit={handlePasswordReset} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
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
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Sending..." : "Send Reset Link"}
              </Button>
            </form>
          )}
           <div className="mt-4 text-center text-sm">
                Remember your password?{" "}
                <Link href="/login" className="underline">
                    Login
                </Link>
            </div>
        </CardContent>
      </Card>
    </div>
  )
}
