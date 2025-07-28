
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { doc, runTransaction, serverTimestamp, collection, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Box, Subscription } from '@/lib/types';

// Make sure to set the STRIPE_SECRET_KEY environment variable
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export async function POST(request: Request) {
  const { boxId, userId, customerName, email, startDate, subscriptionId, priceId, price, priceName } = await request.json();

  if (!boxId || !userId || !email || !startDate || !priceId || !price) {
    return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
  }

  const boxRef = doc(db, 'boxes', boxId);
  const subscriptionRef = subscriptionId ? doc(db, 'subscriptions', subscriptionId) : doc(collection(db, 'subscriptions'));
  
  try {
    const boxDoc = await getDoc(boxRef);

    if (!boxDoc.exists()) {
        throw new Error("Veggie Box Plan does not exist!");
    }
    const boxData = boxDoc.data() as Box;
    const { name: boxName } = boxData;

    // Check if a customer already exists in Stripe
    const customerSearch = await stripe.customers.list({ email: email, limit: 1 });
    let customer;
    if (customerSearch.data.length > 0) {
        customer = customerSearch.data[0];
    } else {
        customer = await stripe.customers.create({ email: email, name: customerName });
    }

    if (!subscriptionId) {
        // Pre-create the subscription document with a 'pending' status only for new subscriptions
        await runTransaction(db, async (transaction) => {
            const freshBoxDoc = await transaction.get(boxRef);
            if (!freshBoxDoc.exists()) {
                throw new Error("Veggie Box Plan does not exist!");
            }

            const currentBoxData = freshBoxDoc.data() as Omit<Box, 'id'>;
            const newSubscribedCount = (currentBoxData.subscribedCount || 0) + 1;

            if (newSubscribedCount > currentBoxData.quantity) {
                throw new Error("Sorry, this Veggie Box Plan is now sold out.");
            }

            transaction.update(boxRef, { subscribedCount: newSubscribedCount });
            
            const subscriptionData: Omit<Subscription, 'id'> = {
                userId,
                customerName,
                boxId,
                boxName,
                price,
                priceId,
                priceName,
                status: 'Pending', // Will be updated by webhook
                startDate,
                nextPickup: startDate,
                createdAt: serverTimestamp(),
                stripeCustomerId: customer.id,
            };
            transaction.set(subscriptionRef, subscriptionData);
        });
    } else {
        // For retries, just ensure the customer ID is up to date in Firestore.
        const batch = writeBatch(db);
        batch.update(subscriptionRef, { stripeCustomerId: customer.id });
        await batch.commit();
    }


    // We need to parse the date as UTC to avoid timezone issues.
    // '2024-08-15' becomes '2024-08-15T00:00:00.000Z'
    const billingCycleAnchor = new Date(`${startDate}T00:00:00.000Z`).getTime() / 1000;


    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      subscription_data: {
        billing_cycle_anchor: billingCycleAnchor,
        proration_behavior: 'none',
      },
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/subscriptions?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/subscriptions`,
      customer: customer.id,
      metadata: {
        subscriptionId: subscriptionRef.id,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Stripe session creation failed:', error);
    // If transaction fails, we should ideally roll back the subscription count
    // but the transaction logic already handles this implicitly.
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
