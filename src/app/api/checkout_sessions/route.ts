
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { doc, runTransaction, serverTimestamp, collection, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Box } from '@/lib/types';

// Make sure to set the STRIPE_SECRET_KEY environment variable
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export async function POST(request: Request) {
  try {
    const { boxId, userId, customerName, email, startDate } = await request.json();

    if (!boxId || !userId || !email || !startDate) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    const boxRef = doc(db, 'boxes', boxId);
    const boxDoc = await getDoc(boxRef);

    if (!boxDoc.exists()) {
        throw new Error("Box does not exist!");
    }
    const boxData = boxDoc.data() as Box;
    const { name: boxName, price, stripePriceId } = boxData;

    if (!stripePriceId) {
        throw new Error("This box is not configured for payments. Please contact support.");
    }

    // Create a new subscription document ID in advance
    const subscriptionRef = doc(collection(db, 'subscriptions'));

    // Check if a customer already exists in Stripe
    const customerSearch = await stripe.customers.list({ email: email, limit: 1 });
    let customer;
    if (customerSearch.data.length > 0) {
        customer = customerSearch.data[0];
    } else {
        customer = await stripe.customers.create({ email: email, name: customerName });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/subscriptions?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard`,
      customer: customer.id,
      metadata: {
        userId,
        boxId,
        boxName,
        customerName,
        price,
        startDate,
        subscriptionId: subscriptionRef.id,
      },
    });
    
    // Pre-create the subscription document with a 'pending' status
    await runTransaction(db, async (transaction) => {
        const freshBoxDoc = await transaction.get(boxRef);
        if (!freshBoxDoc.exists()) {
            throw new Error("Box does not exist!");
        }

        const currentBoxData = freshBoxDoc.data() as Omit<Box, 'id'>;
        const newSubscribedCount = (currentBoxData.subscribedCount || 0) + 1;

        if (newSubscribedCount > currentBoxData.quantity) {
            throw new Error("Sorry, this box is now sold out.");
        }

        transaction.update(boxRef, { subscribedCount: newSubscribedCount });
        
        const subscriptionData = {
            id: subscriptionRef.id,
            userId,
            customerName,
            boxId,
            boxName,
            price,
            status: 'Active', // We will assume payment is successful, can be updated via webhooks
            startDate,
            nextPickup: startDate,
            createdAt: serverTimestamp(),
            stripeSessionId: session.id,
            stripeCustomerId: customer.id,
        };
        transaction.set(subscriptionRef, subscriptionData);
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Stripe session creation failed:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
