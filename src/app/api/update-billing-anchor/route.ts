
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { collection, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Subscription } from '@/lib/types';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export async function POST(request: Request) {
  try {
    const { boxId, newStartDate } = await request.json();

    if (!boxId || !newStartDate) {
      return NextResponse.json({ message: 'Box ID and new start date are required' }, { status: 400 });
    }

    const subscriptionsRef = collection(db, 'subscriptions');
    const q = query(subscriptionsRef, where('boxId', '==', boxId), where('status', '==', 'Active'));
    const querySnapshot = await getDocs(q);

    const activeSubscriptions = querySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Subscription));

    if (activeSubscriptions.length === 0) {
      return NextResponse.json({ message: 'No active subscriptions to update.', updatedCount: 0 });
    }
    
    // We need to parse the date as UTC to avoid timezone issues.
    // '2024-08-15' becomes '2024-08-15T00:00:00.000Z'
    const newBillingCycleAnchor = new Date(`${newStartDate}T00:00:00.000Z`).getTime() / 1000;

    let updatedCount = 0;
    const batch = writeBatch(db);

    for (const sub of activeSubscriptions) {
        if (!sub.stripeSubscriptionId) {
            console.warn(`Subscription ${sub.id} is missing a Stripe Subscription ID, skipping.`);
            continue;
        }

        try {
            await stripe.subscriptions.update(sub.stripeSubscriptionId, {
                billing_cycle_anchor: newBillingCycleAnchor,
                proration_behavior: 'none',
            });

            // Also update the subscription in Firestore
            const subDocRef = collection(db, 'subscriptions').doc(sub.id);
            batch.update(subDocRef, { 
                startDate: newStartDate,
                nextPickup: newStartDate 
            });

            updatedCount++;
        } catch (error: any) {
             console.error(`Failed to update Stripe subscription ${sub.stripeSubscriptionId}:`, error.message);
             // Continue to the next subscription even if one fails
        }
    }

    await batch.commit();

    return NextResponse.json({ message: 'Successfully updated billing cycle anchor for subscriptions.', updatedCount });

  } catch (error: any) {
    console.error('Failed to update billing anchor:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
