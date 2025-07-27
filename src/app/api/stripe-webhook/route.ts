
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: Request) {
  const body = await req.text();
  const signature = headers().get('Stripe-Signature') as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error(`??  Webhook signature verification failed.`, err.message);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object as Stripe.Checkout.Session;

      // This is where we fulfill the order.
      // The subscriptionId was passed in the metadata from the checkout session creation.
      const subscriptionId = session.metadata?.subscriptionId;

      if (!subscriptionId) {
        console.error('Webhook Error: Missing subscriptionId in checkout session metadata.');
        // Return 200 to Stripe so it doesn't retry, as this is a permanent error on our side.
        return NextResponse.json({ received: true });
      }

      const subscriptionRef = doc(db, 'subscriptions', subscriptionId);

      try {
        await updateDoc(subscriptionRef, {
          status: 'Active',
          stripeSubscriptionId: session.subscription,
          stripeCustomerId: session.customer,
          stripeSessionId: session.id,
        });
      } catch (error) {
        console.error(`Webhook Error: Failed to update Firestore for subscriptionId: ${subscriptionId}`, error);
        // This is a server error, so we return a 500 to let Stripe know it should retry.
        return NextResponse.json({ error: 'Failed to update subscription in database.' }, { status: 500 });
      }

      break;
    
    case 'customer.subscription.updated':
        const subscriptionUpdated = event.data.object as Stripe.Subscription;
        // Handle subscription updates, e.g., status changes like 'past_due' or 'canceled'.
        // You would query your subscriptions collection for the subscription with stripeSubscriptionId.
        break;

    case 'customer.subscription.deleted':
        const subscriptionDeleted = event.data.object as Stripe.Subscription;
        // Handle subscription cancellations.
        break;
        
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
