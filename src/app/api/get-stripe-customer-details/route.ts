
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export async function POST(request: Request) {
  try {
    const { customerId } = await request.json();

    if (!customerId) {
      return NextResponse.json({ message: 'Customer ID is required' }, { status: 400 });
    }
    
    // Retrieve the customer object
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) {
        return NextResponse.json({ message: 'Customer has been deleted in Stripe.' }, { status: 404 });
    }


    // Retrieve active subscriptions for the customer
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      expand: ['data.plan.product'],
      limit: 10,
    });

    // Get the associated charges for transaction history
    const charges = await stripe.charges.list({
        customer: customerId,
        limit: 20, // Get the last 20 transactions
    });

    return NextResponse.json({ 
        customer,
        subscriptions: subscriptions.data,
        charges: charges.data,
    });

  } catch (error: any) {
    console.error('Stripe API Error:', error);
    if (error.type === 'invalid_request_error' && error.code === 'resource_missing') {
       return NextResponse.json({ message: 'Customer not found in Stripe.' }, { status: 404 });
    }
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

    

    