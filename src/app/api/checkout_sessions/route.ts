
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Box } from '@/lib/types';

// Make sure to set the STRIPE_SECRET_KEY environment variable
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export async function POST(request: Request) {
  const { boxId, userId, customerName, email, startDate, priceId, price, priceName } = await request.json();

  if (!boxId || !userId || !email || !startDate || !priceId || !price) {
    return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
  }

  try {
    const boxRef = doc(db, 'boxes', boxId);
    const boxDoc = await getDoc(boxRef);

    if (!boxDoc.exists()) {
        throw new Error("Veggie Box Plan does not exist!");
    }
    const boxData = boxDoc.data() as Box;
    const { name: boxName, quantity, subscribedCount, manualSignupCutoff } = boxData;

    // Check if the box is sold out or manually closed before creating a Stripe session
    if ((subscribedCount || 0) >= quantity) {
        throw new Error("Sorry, this Veggie Box Plan is now sold out.");
    }
    if (manualSignupCutoff) {
        throw new Error("Sorry, sign-ups for this Veggie Box Plan are currently closed.");
    }


    // Check if a customer already exists in Stripe
    const customerSearch = await stripe.customers.list({ email: email, limit: 1 });
    let customer;
    if (customerSearch.data.length > 0) {
        customer = customerSearch.data[0];
        // If the existing customer doesn't have a name, but we do, update them.
        if (!customer.name && customerName) {
            customer = await stripe.customers.update(customer.id, { name: customerName });
        }
    } else {
        customer = await stripe.customers.create({ email: email, name: customerName });
    }

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
        boxId,
        boxName,
        userId,
        customerName: customerName || '',
        price: price.toString(),
        priceId,
        priceName: priceName || '',
        startDate,
        stripeCustomerId: customer.id,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Stripe session creation failed:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
