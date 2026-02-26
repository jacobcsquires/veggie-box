
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Box, AppUser } from '@/lib/types';

// Make sure to set the STRIPE_SECRET_KEY environment variable
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export async function POST(request: Request) {
  const { boxId, userId, customerName, email, startDate, priceId, price, priceName, addOns } = await request.json();

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

    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    const phone = userDoc.exists() ? (userDoc.data() as AppUser).phone : null;


    // Check if a customer already exists in Stripe
    const customerSearch = await stripe.customers.list({ email: email, limit: 1 });
    let customer;
    if (customerSearch.data.length > 0) {
        customer = customerSearch.data[0];
        const updatePayload: Stripe.CustomerUpdateParams = {};
        // If the existing customer doesn't have a name, but we do, update them.
        if (!customer.name && customerName) {
            updatePayload.name = customerName;
        }
        if (!customer.phone && phone) {
            updatePayload.phone = phone;
        }

        if (Object.keys(updatePayload).length > 0) {
            customer = await stripe.customers.update(customer.id, updatePayload);
        }
    } else {
        customer = await stripe.customers.create({ email: email, name: customerName, phone });
    }

    // startDate is YYYY-MM-DD. Convert to midnight UTC.
    const startTimestamp = Math.floor(new Date(`${startDate}T00:00:00.000Z`).getTime() / 1000);
    const nowTimestamp = Math.floor(Date.now() / 1000);

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
        {
          price: priceId,
          quantity: 1,
        },
    ];

    if (addOns && Array.isArray(addOns) && addOns.length > 0) {
        for (const addOnPriceId of addOns) {
            lineItems.push({
            price: addOnPriceId,
            quantity: 1,
            });
        }
    }

    const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
        proration_behavior: 'none',
    };

    // If the start date is in the future, we use trial_end to delay the first payment.
    // This avoids the "billing_cycle_anchor cannot be later than next natural billing date" error
    // which occurs when the anchor is beyond the first cycle's duration.
    // We add a buffer to ensure trial_end is strictly in the future.
    if (startTimestamp > nowTimestamp + 3600) {
        subscriptionData.trial_end = startTimestamp;
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'subscription',
      subscription_data: subscriptionData,
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
        addOnPriceIds: addOns?.join(',') || '',
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Stripe session creation failed:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
