
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

function getStripeInterval(frequency: string): { interval: Stripe.PriceCreateParams.Recurring.Interval, interval_count: number } {
    switch (frequency) {
        case 'bi-weekly':
            return { interval: 'week', interval_count: 2 };
        case 'monthly':
            return { interval: 'month', interval_count: 1 };
        case 'weekly':
        default:
            return { interval: 'week', interval_count: 1 };
    }
}

export async function POST(request: Request) {
  try {
    const { name, description, price, frequency, image } = await request.json();

    if (!name || !description || !price || !frequency) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    const product = await stripe.products.create({ 
        name, 
        description,
        images: image ? [image] : [],
        metadata: { product_type: 'add_on' }
    });

    const { interval, interval_count } = getStripeInterval(frequency);

    const stripePrice = await stripe.prices.create({
        product: product.id,
        unit_amount: price * 100,
        currency: 'usd',
        recurring: { interval, interval_count },
        nickname: name,
    });

    return NextResponse.json({ stripeProductId: product.id, stripePriceId: stripePrice.id });
  } catch (error: any) {
    console.error('Stripe add-on creation failed:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
