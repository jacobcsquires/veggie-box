
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Subscription } from '@/lib/types';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export async function POST(request: Request) {
  try {
    const subscriptionsRef = collection(db, 'subscriptions');
    const q = query(subscriptionsRef, where('status', '==', 'Active'));
    const querySnapshot = await getDocs(q);

    const activeSubscriptions = querySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Subscription));

    if (activeSubscriptions.length === 0) {
      return NextResponse.json({ message: 'No active subscriptions to update.', updatedCount: 0 });
    }

    let updatedCount = 0;

    for (const sub of activeSubscriptions) {
        if (!sub.stripeSubscriptionId) {
            console.warn(`Subscription ${sub.id} is missing a Stripe Subscription ID, skipping.`);
            continue;
        }

        try {
            // Retrieve the subscription from Stripe
            const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);

            // There should be only one item for our use case
            if (stripeSub.items.data.length > 0) {
                const subItem = stripeSub.items.data[0];
                // Update the subscription item to disable proration
                await stripe.subscriptionItems.update(subItem.id, {
                    proration_behavior: 'none',
                });
                updatedCount++;
            }
        } catch (error: any) {
             console.error(`Failed to update Stripe subscription ${sub.stripeSubscriptionId}:`, error.message);
             // Continue to the next subscription even if one fails
        }
    }

    return NextResponse.json({ message: 'Successfully updated subscriptions to disable proration.', updatedCount });

  } catch (error: any) {
    console.error('Failed to adjust proration settings:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
