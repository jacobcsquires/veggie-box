
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

    // Archiving a product is done by setting active to false
    const archivedProduct = await stripe.products.update(stripeProductId, {
        active: false,
    });

    return NextResponse.json({ success: true, product: archivedProduct });
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
