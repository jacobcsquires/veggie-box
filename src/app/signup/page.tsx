import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sprout } from "lucide-react"

export default function SignupPage() {
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
            <div className="grid gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="first-name">Full name</Label>
                    <Input id="first-name" placeholder="Max Robinson" required />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                        id="email"
                        type="email"
                        placeholder="m@example.com"
                        required
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" />
                </div>
                <Button type="submit" className="w-full" asChild>
                    <Link href="/dashboard">Create an account</Link>
                </Button>
                 <Button variant="outline" className="w-full" asChild>
                    <Link href="#">Sign up with Google</Link>
                </Button>
            </div>
            <div className="mt-4 text-center text-sm">
                Already have an account?{" "}
                <Link href="/login" className="underline">
                    Login
                </Link>
            </div>
            </CardContent>
        </Card>
    </div>
  )
}
