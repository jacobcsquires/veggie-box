
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

    // 2. Archive old prices that are no longer in the list
    if (oldPricingOptions && oldPricingOptions.length > 0) {
        const newPriceIds = new Set(pricingOptions.map((p: any) => p.id).filter(Boolean));
        for (const oldPrice of oldPricingOptions) {
            if (oldPrice.id && !newPriceIds.has(oldPrice.id)) {
                try {
                    await stripe.prices.update(oldPrice.id, { active: false });
                } catch (error) {
                    console.warn(`Could not archive old price ${oldPrice.id}`, error);
                }
            }
        }
    }

    const { interval, interval_count } = getStripeInterval(frequency);
    const newPricingOptionsResult: PricingOption[] = [];

    // 3. Create or update prices
    for (const option of pricingOptions) {
        if (option.id) { // This is an existing price, check if it needs updating
            const existingPrice = await stripe.prices.retrieve(option.id);
            if (existingPrice.unit_amount !== option.price * 100) {
                 // Prices are immutable, so we must archive the old one and create a new one.
                 await stripe.prices.update(existingPrice.id, { active: false });
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
