
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export async function POST(request: Request) {
  try {
    const { stripeSubscriptionId } = await request.json();

    if (!stripeSubscriptionId) {
      return NextResponse.json({ message: 'Stripe Subscription ID is required' }, { status: 400 });
    }

    // Retrieve the subscription
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);

    // Get the upcoming invoice for the next billing date
    let nextBillingDate = null;
    try {
        const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
            subscription: stripeSubscriptionId,
        });
        nextBillingDate = upcomingInvoice.next_payment_attempt;
    } catch (error) {
        // This can happen if the subscription is canceled or has no upcoming payments
        console.log(`No upcoming invoice found for subscription ${stripeSubscriptionId}`);
    }


    // Get the associated charges for transaction history
    const charges = await stripe.charges.list({
        customer: subscription.customer as string,
        limit: 10, // Get the last 10 transactions
    });
    
    // Filter charges related to this subscription's invoices
    const subscriptionInvoiceIds = (await stripe.invoices.list({ subscription: stripeSubscriptionId })).data.map(inv => inv.id);
    const relatedCharges = charges.data.filter(charge => charge.invoice && subscriptionInvoiceIds.includes(charge.invoice as string));


    const customer = await stripe.customers.retrieve(subscription.customer as string);


    return NextResponse.json({ 
        subscription,
        nextBillingDate: nextBillingDate ? new Date(nextBillingDate * 1000) : subscription.current_period_end * 1000,
        transactions: relatedCharges,
        customer,
    });

  } catch (error: any) {
    console.error('Stripe API Error:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
