
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import type { Subscription } from '@/lib/types';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

// This route is deprecated as status changes are now managed in Stripe and synced via webhook.
// It remains to avoid breaking any old calls but should not be used for new development.
export async function POST(request: Request) {
  const { stripeSubscriptionId, newStatus } = (await request.json()) as { 
    stripeSubscriptionId: string, 
    newStatus: Subscription['status'] 
  };

  if (!stripeSubscriptionId || !newStatus) {
    return NextResponse.json({ message: 'Missing stripeSubscriptionId or newStatus' }, { status: 400 });
  }

  console.warn("This API route is deprecated. Subscription status should be managed directly in Stripe.");

  try {
    let updatedStripeSub;

    if (newStatus === 'Cancelled') {
      updatedStripeSub = await stripe.subscriptions.update(stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
    } else if (newStatus === 'Active') {
        updatedStripeSub = await stripe.subscriptions.update(stripeSubscriptionId, {
            cancel_at_period_end: false,
        });
    } else {
        console.log(`Status update to "${newStatus}" is a Stripe-managed state. No API call made.`);
    }

    return NextResponse.json({ success: true, subscription: updatedStripeSub });

  } catch (error: any) {
    console.error('Failed to update Stripe subscription status:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
