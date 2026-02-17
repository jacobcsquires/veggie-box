
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { PricingOption } from '@/lib/types';

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
    const { name, description, frequency, pricingOptions, existingProductId, oldPricingOptions } = await request.json();

    if (!name || !description || !frequency || !pricingOptions || pricingOptions.length === 0) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    let productId = existingProductId;
    // 1. Create or Update Stripe Product
    if (productId) {
        await stripe.products.update(productId, { name, description });
    } else {
        const product = await stripe.products.create({ name, description });
        productId = product.id;
    }

    // 2. Archive old prices that are no longer in the list and cancel their subscriptions.
    if (oldPricingOptions && oldPricingOptions.length > 0) {
        const newPriceIds = new Set(pricingOptions.map((p: any) => p.id).filter(Boolean));
        for (const oldPrice of oldPricingOptions) {
            if (oldPrice.id && !newPriceIds.has(oldPrice.id)) {
                try {
                    const subscriptions = await stripe.subscriptions.list({ price: oldPrice.id, status: 'active' });
                    for (const sub of subscriptions.data) {
                        await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true });
                    }
                    await stripe.prices.update(oldPrice.id, { active: false });
                } catch (error) {
                    console.warn(`Could not archive old price ${oldPrice.id} and cancel its subscriptions.`, error);
                }
            }
        }
    }

    const { interval, interval_count } = getStripeInterval(frequency);
    const newPricingOptionsResult: PricingOption[] = [];

    // 3. Create or update prices
    for (const option of pricingOptions) {
        if (option.id) { // This is an existing price, check if it needs updating
            try {
                const existingPrice = await stripe.prices.retrieve(option.id);
                if (existingPrice.unit_amount !== option.price * 100 || !existingPrice.active) {
                     // Prices are immutable, so we must archive the old one and create a new one.
                     // First, cancel subscriptions on the old price if it was active.
                     if (existingPrice.active) {
                        const subscriptions = await stripe.subscriptions.list({ price: existingPrice.id, status: 'active' });
                        for (const sub of subscriptions.data) {
                            await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true });
                        }
                        await stripe.prices.update(existingPrice.id, { active: false });
                     }

                     // Create the new price
                     const newStripePrice = await stripe.prices.create({
                        product: productId,
                        unit_amount: option.price * 100,
                        currency: 'usd',
                        recurring: { interval, interval_count },
                        nickname: option.name,
                    });
                    newPricingOptionsResult.push({
                        id: newStripePrice.id,
                        name: option.name,
                        price: option.price,
                    });
                } else {
                    // Price is the same, just keep it.
                    newPricingOptionsResult.push(option);
                }
            } catch (error) {
                // Price might not exist anymore (e.g. deleted in Stripe dashboard), treat as new.
                console.warn(`Could not retrieve price ${option.id}, treating as new.`, error);
                const newStripePrice = await stripe.prices.create({
                    product: productId,
                    unit_amount: option.price * 100,
                    currency: 'usd',
                    recurring: { interval, interval_count },
                    nickname: option.name,
                });
                newPricingOptionsResult.push({
                    id: newStripePrice.id,
                    name: option.name,
                    price: option.price,
                });
            }
        } else { // This is a new price, create it
            const newStripePrice = await stripe.prices.create({
                product: productId,
                unit_amount: option.price * 100,
                currency: 'usd',
                recurring: { interval, interval_count },
                nickname: option.name,
            });
             newPricingOptionsResult.push({
                id: newStripePrice.id,
                name: option.name,
                price: option.price,
            });
        }
    }

    return NextResponse.json({ stripeProductId: productId, newPricingOptions: newPricingOptionsResult });
  } catch (error: any) {
    console.error('Stripe product/price modification failed:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
