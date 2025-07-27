
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export async function POST(request: Request) {
  try {
    const { name, description, price } = await request.json();

    if (!name || !description || !price) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    // Create Stripe Product
    const product = await stripe.products.create({
        name,
        description,
    });

    // Create Stripe Price
    const stripePrice = await stripe.prices.create({
        product: product.id,
        unit_amount: price * 100,
        currency: 'usd',
        recurring: { interval: 'week' },
    });

    return NextResponse.json({ stripeProductId: product.id, stripePriceId: stripePrice.id });
  } catch (error: any) {
    console.error('Stripe product creation failed:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

    