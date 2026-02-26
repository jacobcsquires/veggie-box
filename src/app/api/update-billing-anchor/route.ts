
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { collection, getDocs, query, where, writeBatch, doc } from 'firebase/firestore';
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
    // Find all subscribers who are currently "active" (including those on skipped pickups)
    const q = query(subscriptionsRef, where('boxId', '==', boxId), where('status', 'in', ['Active', 'Trialing', 'Past Due', 'Unpaid']));
    const querySnapshot = await getDocs(q);

    const activeSubscriptions = querySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Subscription));

    if (activeSubscriptions.length === 0) {
      return NextResponse.json({ message: 'No active subscriptions to pause.', updatedCount: 0 });
    }
    
    const trialEndTimestamp = new Date(`${newStartDate}T00:00:00.000Z`).getTime() / 1000;

    let updatedCount = 0;
    const batch = writeBatch(db);

    for (const sub of activeSubscriptions) {
        if (!sub.stripeSubscriptionId) {
            console.warn(`Subscription ${sub.id} is missing a Stripe Subscription ID, skipping pause.`);
            continue;
        }

        try {
            await stripe.subscriptions.update(sub.stripeSubscriptionId, {
                trial_end: trialEndTimestamp,
                proration_behavior: 'none',
            });

            const subDocRef = doc(db, 'subscriptions', sub.id);
            batch.update(subDocRef, { 
                status: 'Trialing',
                trialEnd: trialEndTimestamp,
                nextPickup: newStartDate 
            });

            updatedCount++;
        } catch (error: any) {
             console.error(`Failed to pause Stripe subscription ${sub.stripeSubscriptionId}:`, error.message);
        }
    }

    await batch.commit();

    return NextResponse.json({ message: 'Successfully paused subscriptions until the next pickup.', updatedCount });

  } catch (error: any) {
    console.error('Failed to pause subscriptions:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
