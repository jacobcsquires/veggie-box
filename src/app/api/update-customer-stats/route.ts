import { NextResponse } from 'next/server';
import { collection, getDocs, writeBatch, doc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Customer, Subscription } from '@/lib/types';

export async function POST() {
  try {
    const customersRef = collection(db, 'customers');
    const subscriptionsRef = collection(db, 'subscriptions');

    const [customersSnapshot, subscriptionsSnapshot] = await Promise.all([
      getDocs(customersRef),
      getDocs(query(subscriptionsRef, where('status', '==', 'Active'))),
    ]);

    const allCustomers = customersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
    const activeSubscriptions = subscriptionsSnapshot.docs.map(doc => doc.data() as Subscription);

    const subscriptionCounts = activeSubscriptions.reduce((acc, sub) => {
      const customerId = sub.stripeCustomerId;
      if (customerId) {
        acc[customerId] = (acc[customerId] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const batch = writeBatch(db);
    let updatedCount = 0;

    for (const customer of allCustomers) {
      const activeSubscriptionCount = subscriptionCounts[customer.id] || 0;
      const newStatus = activeSubscriptionCount > 0 ? 'active' : 'inactive';

      const customerRef = doc(db, 'customers', customer.id);
      batch.update(customerRef, {
        activeSubscriptionCount,
        status: newStatus,
      });
      updatedCount++;
    }

    await batch.commit();

    return NextResponse.json({ message: `Successfully updated ${updatedCount} customers.`, updatedCount });

  } catch (error: any) {
    console.error('Failed to update customer stats:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
