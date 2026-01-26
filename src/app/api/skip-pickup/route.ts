
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Subscription, Box } from '@/lib/types';
import { addWeeks, addMonths } from 'date-fns';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

function getNextBillingDate(currentPeriodEnd: Date, frequency: Box['frequency']): Date {
    switch (frequency) {
        case 'weekly':
            return addWeeks(currentPeriodEnd, 1);
        case 'bi-weekly':
            return addWeeks(currentPeriodEnd, 2);
        case 'monthly':
            return addMonths(currentPeriodEnd, 1);
        default:
            return addWeeks(currentPeriodEnd, 1);
    }
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

        if (stripeSub.trial_end && stripeSub.trial_end > Date.now() / 1000) {
             throw new Error("This subscription already has an active trial/skip period.");
        }

        const boxRef = doc(db, 'boxes', subscriptionData.boxId);
        const boxDoc = await getDoc(boxRef);
        if (!boxDoc.exists()) {
            throw new Error("Associated Veggie Box Plan not found.");
        }
        const boxData = boxDoc.data() as Box;

        const currentPeriodEnd = new Date(stripeSub.current_period_end * 1000);
        const nextBillingDate = getNextBillingDate(currentPeriodEnd, boxData.frequency);
        const newTrialEndTimestamp = Math.floor(nextBillingDate.getTime() / 1000);

        await stripe.subscriptions.update(stripeSub.id, {
            trial_end: newTrialEndTimestamp,
            proration_behavior: 'none',
        });
        
        // Also update our local record
        await updateDoc(subRef, {
            trialEnd: newTrialEndTimestamp,
        });

        return NextResponse.json({ success: true, message: 'Subscription successfully scheduled to skip next payment.' });

    } catch (error: any) {
        console.error('Failed to skip pickup:', error);
        return NextResponse.json({ message: error.message }, { status: 500 });
    }
}
