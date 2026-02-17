
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
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

    try {
        const subRef = doc(db, 'subscriptions', subscriptionId);
        const subDoc = await getDoc(subRef);
        if (!subDoc.exists()) {
            throw new Error("Subscription not found.");
        }
        const subscriptionData = subDoc.data() as Subscription;

        if (!subscriptionData.stripeSubscriptionId) {
            throw new Error("Stripe subscription ID not found. Cannot resume this subscription.");
        }

        const stripeSub = await stripe.subscriptions.retrieve(subscriptionData.stripeSubscriptionId);

        if (!stripeSub.trial_end || stripeSub.trial_end <= (Date.now() / 1000)) {
            throw new Error("This subscription is not currently in a skipped (trial) period.");
        }

        // 'now' immediately ends the trial.
        await stripe.subscriptions.update(stripeSub.id, {
            trial_end: 'now',
        });
        
        // Also update our local record to remove the trialEnd
        await updateDoc(subRef, {
            trialEnd: null,
        });

        return NextResponse.json({ success: true, message: 'Subscription successfully resumed.' });

    } catch (error: any) {
        console.error('Failed to resume subscription:', error);
        return NextResponse.json({ message: error.message }, { status: 500 });
    }
}
