
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import type { Subscription } from '@/lib/types';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export async function POST(request: Request) {
  const { stripeSubscriptionId, newStatus } = (await request.json()) as { 
    stripeSubscriptionId: string, 
    newStatus: Subscription['status'] 
  };

  if (!stripeSubscriptionId || !newStatus) {
    return NextResponse.json({ message: 'Missing stripeSubscriptionId or newStatus' }, { status: 400 });
  }

  try {
    let updatedStripeSub;

    if (newStatus === 'Cancelled') {
      // This cancels the subscription at the end of the current billing period.
      // Stripe's status will remain 'active' until then.
      updatedStripeSub = await stripe.subscriptions.update(stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
    } else if (newStatus === 'Active') {
        // This can be used to reactivate a subscription that was set to cancel.
        updatedStripeSub = await stripe.subscriptions.update(stripeSubscriptionId, {
            cancel_at_period_end: false,
        });
    } else {
        // For statuses like 'Past Due', these are typically set automatically by Stripe's billing engine.
        // Manually changing to these states is not a standard operation via the API.
        // We will just log this and not make a change in Stripe.
        console.log(`Status update to "${newStatus}" is a Stripe-managed state. No API call made.`);
    }

    return NextResponse.json({ success: true, subscription: updatedStripeSub });

  } catch (error: any) {
    console.error('Failed to update Stripe subscription status:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
