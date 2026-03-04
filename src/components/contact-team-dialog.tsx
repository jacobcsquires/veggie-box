'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Mail, Phone } from "lucide-react"

export function ContactTeamDialog({ trigger }: { trigger: React.ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="font-headline text-xl">Contact Our Team</DialogTitle>
          <DialogDescription>
            Let us know if you have questions
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium leading-none">Email</p>
              <a 
                href="mailto:angela@ovfocf.org" 
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                angela@ovfocf.org
              </a>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Phone className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium leading-none">Call/Text</p>
              <a 
                href="tel:6129637030" 
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                612-963-7030
              </a>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
