import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { doc, deleteDoc, collection, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export async function POST(request: Request) {
  const { customerId } = await request.json();

  if (!customerId) {
    return NextResponse.json({ message: 'Customer ID is required' }, { status: 400 });
  }

  try {
    // 1. Delete customer from Stripe. This should also cancel their active subscriptions.
    try {
        await stripe.customers.del(customerId);
    } catch (error: any) {
        if (error.code !== 'resource_missing') {
            throw error; // Re-throw if it's not a "not found" error, let the outer catch handle it.
        }
        // If resource is missing, that's fine. Log it and continue.
        console.log(`Customer ${customerId} not found in Stripe. Proceeding with Firestore deletion.`);
    }

    const batch = writeBatch(db);

    // 2. Delete the customer from Firestore.
    const customerRef = doc(db, 'customers', customerId);
    batch.delete(customerRef);

    // 3. Find and delete their subscriptions from Firestore.
    // While the Stripe webhook will eventually handle this, doing it here provides immediate consistency.
    const subsQuery = query(collection(db, 'subscriptions'), where('stripeCustomerId', '==', customerId));
    const subsSnapshot = await getDocs(subsQuery);
    if (!subsSnapshot.empty) {
        subsSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        console.log(`Queued deletion for ${subsSnapshot.size} subscriptions from Firestore for customer ${customerId}.`);
    }
    
    await batch.commit();
    
    // The webhook for customer.subscription.deleted should handle decrementing box counts.

    return NextResponse.json({ success: true, message: `Customer ${customerId} and their local data deleted successfully.` });
  } catch (error: any) {
    console.error(`Customer deletion process for ${customerId} failed:`, error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
