"use client"

import Image from "next/image"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { boxes } from "@/lib/placeholder-data"

export default function Dashboard() {
  const [date, setDate] = useState<Date | undefined>(new Date())

  return (
    <>
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl font-headline">Browse Our Boxes</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {boxes.map((box) => (
          <Card key={box.id}>
            <CardHeader>
              <Image
                src={box.image}
                alt={box.name}
                width={600}
                height={400}
                data-ai-hint={box.hint}
                className="rounded-lg aspect-video object-cover"
              />
              <CardTitle className="pt-4 font-headline">{box.name}</CardTitle>
              <CardDescription>{box.description}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex justify-between items-center">
                    <p className="text-2xl font-bold">${box.price}<span className="text-sm font-normal text-muted-foreground">/week</span></p>
                    <div className="flex -space-x-2">
                      {box.items.map(item => (
                        <div key={item.name} className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 border-2 border-background" title={item.name}>
                          <item.icon className="h-4 w-4 text-primary" />
                        </div>
                      ))}
                    </div>
                </div>
            </CardContent>
            <CardFooter>
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="w-full">Subscribe</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Schedule Your First Delivery</DialogTitle>
                    <DialogDescription>
                      Select a start date for your '{box.name}' subscription. You can change this later.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex justify-center">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={setDate}
                      className="rounded-md border"
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit">Confirm Subscription</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardFooter>
          </Card>
        ))}
      </div>
    </>
  )
}
