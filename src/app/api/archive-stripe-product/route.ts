
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export async function POST(request: Request) {
  try {
    const { stripeProductId } = await request.json();

    if (!stripeProductId) {
      return NextResponse.json({ message: 'Stripe Product ID is required' }, { status: 400 });
    }

    // 1. Find all prices associated with the product.
    const prices = await stripe.prices.list({
        product: stripeProductId,
        active: true,
    });

    let cancelledSubscriptionsCount = 0;

    // 2. For each price, find and cancel all active subscriptions.
    for (const price of prices.data) {
        const subscriptions = await stripe.subscriptions.list({
            price: price.id,
            status: 'active',
        });

        for (const sub of subscriptions.data) {
            await stripe.subscriptions.update(sub.id, {
                cancel_at_period_end: true,
            });
            cancelledSubscriptionsCount++;
        }
    }

    // 3. After cancelling subscriptions, archive the product.
    const archivedProduct = await stripe.products.update(stripeProductId, {
        active: false,
    });

    return NextResponse.json({ 
        success: true, 
        product: archivedProduct,
        message: `Product archived. ${cancelledSubscriptionsCount} subscription(s) are scheduled for cancellation.`
    });

  } catch (error: any) {
    console.error('Stripe product archival failed:', error);
    // It's possible the product is already archived or doesn't exist,
    // which might not be a critical failure depending on desired behavior.
    if (error.code === 'resource_missing') {
        return NextResponse.json({ success: true, message: 'Product not found in Stripe, assumed already deleted.' });
    }
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
