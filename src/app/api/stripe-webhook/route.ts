
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import { doc, updateDoc, serverTimestamp, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Subscription } from '@/lib/types';


const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// Helper function to find a subscription by its Stripe ID
const findSubscriptionByStripeId = async (stripeSubscriptionId: string): Promise<Subscription | null> => {
    const subsRef = collection(db, 'subscriptions');
    const q = query(subsRef, where("stripeSubscriptionId", "==", stripeSubscriptionId));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
        return null;
    }
    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Subscription;
}

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
    
    case 'customer.subscription.updated': {
        const subscriptionUpdated = event.data.object as Stripe.Subscription;
        const localSub = await findSubscriptionByStripeId(subscriptionUpdated.id);
        
        if (localSub) {
            const newStatus = subscriptionUpdated.status.charAt(0).toUpperCase() + subscriptionUpdated.status.slice(1);
            try {
                 await updateDoc(doc(db, 'subscriptions', localSub.id), { status: newStatus });
            } catch(error) {
                console.error(`Webhook: Failed to update subscription status for ${localSub.id}`, error);
                return NextResponse.json({ error: 'Failed to update subscription in database.' }, { status: 500 });
            }
        }
        break;
    }

    case 'customer.subscription.deleted': {
        const subscriptionDeleted = event.data.object as Stripe.Subscription;
        const localSub = await findSubscriptionByStripeId(subscriptionDeleted.id);

        if (localSub) {
             try {
                //  Mark as cancelled, or whatever status makes sense for a hard delete from stripe
                 await updateDoc(doc(db, 'subscriptions', localSub.id), { status: 'Cancelled' });
            } catch(error) {
                console.error(`Webhook: Failed to mark subscription as cancelled for ${localSub.id}`, error);
                return NextResponse.json({ error: 'Failed to update subscription in database.' }, { status: 500 });
            }
        }
        break;
    }
        
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
