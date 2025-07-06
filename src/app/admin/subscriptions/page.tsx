import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
                <CardDescription>
                    A list of all customer subscriptions.
                </CardDescription>
            </CardHeader>
            <CardContent>
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead>Box Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Next Delivery</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {subscriptions.map(sub => (
                    <TableRow key={sub.id}>
                        <TableCell className="font-medium">{sub.boxName}</TableCell>
                        <TableCell>
                            <Badge variant={sub.status === 'Active' ? 'default' : 'secondary'} 
                            className={cn(sub.status === 'Active' ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-800', 'dark:bg-transparent dark:text-foreground')}>
                                {sub.status}
                            </Badge>
                        </TableCell>
                        <TableCell>{sub.nextDelivery}</TableCell>
                        <TableCell className="text-right">${sub.price.toFixed(2)}</TableCell>
                    </TableRow>
                ))}
                </TableBody>
            </Table>
            </CardContent>
        </Card>
    </div>
  )
}
