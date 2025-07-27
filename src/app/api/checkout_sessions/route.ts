
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { doc, runTransaction, serverTimestamp, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Box } from '@/lib/types';

// Make sure to set the STRIPE_SECRET_KEY environment variable
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export async function POST(request: Request) {
  try {
    const { boxId, boxName, price, userId, customerName, email, startDate } = await request.json();

    if (!boxId || !boxName || !price || !userId || !email || !startDate) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    // Create a new subscription document ID in advance
    const subscriptionRef = doc(collection(db, 'subscriptions'));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: boxName,
              description: `Subscription to ${boxName}`,
            },
            unit_amount: Math.round(price * 100), // Price in cents
            recurring: {
              interval: 'week',
            },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/subscriptions?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard`,
      customer_email: email,
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
    const boxRef = doc(db, 'boxes', boxId);
    await runTransaction(db, async (transaction) => {
        const boxDoc = await transaction.get(boxRef);
        if (!boxDoc.exists()) {
            throw new Error("Box does not exist!");
        }

        const boxData = boxDoc.data() as Omit<Box, 'id'>;
        const newSubscribedCount = (boxData.subscribedCount || 0) + 1;

        if (newSubscribedCount > boxData.quantity) {
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
        };
        transaction.set(subscriptionRef, subscriptionData);
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Stripe session creation failed:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
