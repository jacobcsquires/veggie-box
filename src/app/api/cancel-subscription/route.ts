
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { doc, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Subscription, Box } from '@/lib/types';

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
    await runTransaction(db, async (transaction) => {
        const subDoc = await transaction.get(subscriptionRef);
        if (!subDoc.exists()) {
            throw new Error("Subscription not found.");
        }
        const subscriptionData = subDoc.data() as Subscription;

        if (!subscriptionData.stripeSubscriptionId) {
            throw new Error("Stripe subscription ID not found.");
        }
        
        const boxRef = doc(db, 'boxes', subscriptionData.boxId);
        const boxDoc = await transaction.get(boxRef);
        if (!boxDoc.exists()) {
            // This case should ideally not happen if data is consistent
            throw new Error("Associated Veggie Box Plan not found.");
        }

        // This will cancel the subscription at the end of the current billing period.
        await stripe.subscriptions.update(subscriptionData.stripeSubscriptionId, {
            cancel_at_period_end: true,
        });

        // It's often better to listen for the `customer.subscription.updated` webhook 
        // to update your database. But for immediate feedback, we can update it here.
        // The status will change to 'Cancelled' in Stripe's webhook event later.
        // For now, we can just update our DB to reflect it will be cancelled.
        transaction.update(subscriptionRef, { status: 'Cancelled' });
        
        // Decrement the subscribed count on the box
        const currentBoxData = boxDoc.data() as Omit<Box, 'id'>;
        const newSubscribedCount = Math.max(0, (currentBoxData.subscribedCount || 0) - 1);
        transaction.update(boxRef, { subscribedCount: newSubscribedCount });
    });

    return NextResponse.json({ success: true, message: 'Subscription scheduled for cancellation.' });

  } catch (error: any) {
    console.error('Failed to cancel subscription:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
