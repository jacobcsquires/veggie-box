
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { doc, getDoc, updateDoc, collection, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Subscription, Box } from '@/lib/types';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

/**
 * Helper function to find the next scheduled pickup date after a given date.
 */
async function getNextScheduledPickup(boxId: string, afterDate: string): Promise<string | null> {
    if (!boxId || !afterDate) return null;

    const pickupsRef = collection(db, 'boxes', boxId, 'pickups');
    const q = query(pickupsRef, where('pickupDate', '>', afterDate), orderBy('pickupDate', 'asc'), limit(1));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        return null;
    }
    return querySnapshot.docs[0].data().pickupDate;
}

export async function POST(request: Request) {
    const { subscriptionId } = await request.json();

    if (!subscriptionId) {
        return NextResponse.json({ message: 'Missing subscriptionId' }, { status: 400 });
    }

    try {
        const subRef = doc(db, 'subscriptions', subscriptionId);
        const subDoc = await getDoc(subRef);
        if (!subDoc.exists()) {
            throw new Error("Subscription not found.");
        }
        const subscriptionData = subDoc.data() as Subscription;

        if (!subscriptionData.stripeSubscriptionId) {
            throw new Error("Stripe subscription ID not found. Cannot skip pickup for this subscription.");
        }

        const stripeSub = await stripe.subscriptions.retrieve(subscriptionData.stripeSubscriptionId);

        // We use the nextPickup field from our database as the baseline for what to skip.
        // For new subscriptions with a future start date, this is the first pickup.
        const currentNextPickup = subscriptionData.nextPickup;
        const newNextPickup = await getNextScheduledPickup(subscriptionData.boxId, currentNextPickup);

        if (!newNextPickup) {
            throw new Error("There are no more scheduled pickups available to skip to.");
        }

        // Convert the next pickup date string (YYYY-MM-DD) to a Unix timestamp for Stripe.
        // We append the T00:00:00Z to ensure it's interpreted as midnight UTC.
        const newTrialEndTimestamp = Math.floor(new Date(`${newNextPickup}T00:00:00.000Z`).getTime() / 1000);

        await stripe.subscriptions.update(stripeSub.id, {
            trial_end: newTrialEndTimestamp,
            proration_behavior: 'none',
        });
        
        // Sync our local record. We push the nextPickup date forward and update the status
        // to 'Trialing' which the UI displays as 'Scheduled' or 'Skipped'.
        await updateDoc(subRef, {
            trialEnd: newTrialEndTimestamp,
            nextPickup: newNextPickup,
            status: 'Trialing',
        });

        return NextResponse.json({ success: true, message: 'Successfully skipped the next pickup.' });

    } catch (error: any) {
        console.error('Failed to skip pickup:', error);
        return NextResponse.json({ message: error.message }, { status: 500 });
    }
}
