import { MoreHorizontal } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { subscriptions } from "@/lib/placeholder-data"
import { cn } from "@/lib/utils"

export default function AdminSubscriptionsPage() {
  return (
    <div>
        <h1 className="text-lg font-semibold md:text-2xl font-headline mb-4">Manage Subscriptions</h1>
        <Card>
            <CardHeader>
                <CardTitle>All Subscriptions</CardTitle>
                <CardDescription>A list of all customer subscriptions.</CardDescription>
            </CardHeader>
            <CardContent>
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Box Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Start Date</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead>
                    <span className="sr-only">Actions</span>
                    </TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                 {subscriptions.concat(subscriptions).map((sub, i) => (
                    <TableRow key={`${sub.id}-${i}`}>
                        <TableCell className="font-medium">{i % 2 === 0 ? "John Doe" : "Alice Smith"}</TableCell>
                        <TableCell>{sub.boxName}</TableCell>
                        <TableCell>
                            <Badge variant={sub.status === 'Active' ? 'default' : 'secondary'} 
                            className={cn(sub.status === 'Active' ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-800', 'dark:bg-transparent dark:text-foreground')}>
                                {sub.status}
                            </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{sub.startDate}</TableCell>
                        <TableCell className="text-right">${sub.price.toFixed(2)}</TableCell>
                        <TableCell>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                            <Button
                                aria-haspopup="true"
                                size="icon"
                                variant="ghost"
                            >
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Toggle menu</span>
                            </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem>View Details</DropdownMenuItem>
                            <DropdownMenuItem>Cancel Subscription</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        </TableCell>
                    </TableRow>
                 ))}
                </TableBody>
            </Table>
            </CardContent>
             <CardFooter>
                <div className="text-xs text-muted-foreground">
                    Showing <strong>1-6</strong> of <strong>6</strong> subscriptions
                </div>
            </CardFooter>
        </Card>
    </div>
  )
}
