import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { doc, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Subscription } from '@/lib/types';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export async function POST(request: Request) {
  const { subscriptionId } = await request.json();

  if (!subscriptionId) {
    return NextResponse.json({ message: 'Missing subscriptionId' }, { status: 400 });
  }

  const subscriptionRef = doc(db, 'subscriptions', subscriptionId);

  try {
    const subDoc = await getDoc(subscriptionRef);
    if (!subDoc.exists()) {
      throw new Error("Subscription not found.");
    }
    const subscriptionData = subDoc.data() as Subscription;

    if (!subscriptionData.stripeSubscriptionId) {
        throw new Error("Stripe subscription ID not found.");
    }

    // This will cancel the subscription at the end of the current billing period.
    await stripe.subscriptions.update(subscriptionData.stripeSubscriptionId, {
        cancel_at_period_end: true,
    });
    
    // It's often better to listen for the `customer.subscription.updated` webhook 
    // to update your database. But for immediate feedback, we can update it here.
    // The status will change to 'Cancelled' in Stripe's webhook event later.
    // For now, we can just update our DB to reflect it will be cancelled.
    const batch = writeBatch(db);
    batch.update(subscriptionRef, { status: 'Cancelled' });
    await batch.commit();

    return NextResponse.json({ success: true, message: 'Subscription scheduled for cancellation.' });

  } catch (error: any) {
    console.error('Failed to cancel subscription:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
