
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { collection, getDocs, query, where, writeBatch, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Subscription } from '@/lib/types';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

// This route is used to effectively 'pause' subscriptions until the next pickup date.
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
      return NextResponse.json({ message: 'No active subscriptions to pause.', updatedCount: 0 });
    }
    
    // The newStartDate is the next pickup date. We'll put the subscription on trial until then.
    const trialEndTimestamp = new Date(`${newStartDate}T00:00:00.000Z`).getTime() / 1000;

    let updatedCount = 0;
    const batch = writeBatch(db);

    for (const sub of activeSubscriptions) {
        if (!sub.stripeSubscriptionId) {
            console.warn(`Subscription ${sub.id} is missing a Stripe Subscription ID, skipping pause.`);
            continue;
        }

        try {
            // Put the subscription on a trial until the next pickup date.
            // This effectively skips the payment for the deleted pickup.
            await stripe.subscriptions.update(sub.stripeSubscriptionId, {
                trial_end: trialEndTimestamp,
                proration_behavior: 'none',
            });

            // Also update the subscription in Firestore to reflect the paused state.
            const subDocRef = doc(db, 'subscriptions', sub.id);
            batch.update(subDocRef, { 
                status: 'Trialing', // Using 'Trialing' status to represent the skipped/paused state.
                trialEnd: trialEndTimestamp,
                nextPickup: newStartDate 
            });

            updatedCount++;
        } catch (error: any) {
             console.error(`Failed to pause Stripe subscription ${sub.stripeSubscriptionId}:`, error.message);
             // Continue to the next subscription even if one fails
        }
    }

    await batch.commit();

    return NextResponse.json({ message: 'Successfully paused subscriptions until the next pickup.', updatedCount });

  } catch (error: any) {
    console.error('Failed to pause subscriptions:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
