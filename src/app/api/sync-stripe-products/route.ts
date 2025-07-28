
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { collection, getDocs, doc, writeBatch, serverTimestamp, query, where, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Box, PricingOption } from '@/lib/types';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

function getFrequencyFromInterval(interval: Stripe.Price.Recurring.Interval, intervalCount: number): Box['frequency'] {
    if (interval === 'month' && intervalCount === 1) return 'monthly';
    if (interval === 'week' && intervalCount === 2) return 'bi-weekly';
    return 'weekly';
}

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

export async function POST() {
  try {
    const batch = writeBatch(db);
    let createdCount = 0;
    let updatedCount = 0;

    // 1. Fetch all products from Stripe
    const stripeProducts: Stripe.Product[] = [];
    for await (const product of stripe.products.list({ active: true, limit: 100 })) {
        stripeProducts.push(product);
    }

    // 2. Fetch all boxes from Firestore
    const boxesSnapshot = await getDocs(collection(db, 'boxes'));
    const firestoreBoxes = boxesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Box));
    const firestoreBoxMap = new Map(firestoreBoxes.map(box => [box.stripeProductId, box]));

    // 3. Sync from Stripe to Firestore
    for (const product of stripeProducts) {
        if (!firestoreBoxMap.has(product.id)) {
            // Product exists in Stripe but not in Firestore -> Create it
            const prices = await stripe.prices.list({ product: product.id, active: true });
            if (prices.data.length === 0) continue; // Skip products with no active prices

            const firstPrice = prices.data[0];
            const pricingOptions: PricingOption[] = prices.data.map(p => ({
                id: p.id,
                name: p.nickname || 'Standard',
                price: (p.unit_amount || 0) / 100,
            }));
            
            const newBoxData: Omit<Box, 'id'> = {
                name: product.name,
                description: product.description || 'Imported from Stripe.',
                image: product.images?.[0] || 'https://placehold.co/600x400.png',
                hint: 'vegetable box',
                quantity: 999, // Default quantity
                subscribedCount: 0,
                stripeProductId: product.id,
                pricingOptions,
                frequency: getFrequencyFromInterval(firstPrice.recurring!.interval, firstPrice.recurring!.interval_count),
                displayOnWebsite: true,
                manualSignupCutoff: false,
                createdAt: serverTimestamp(),
            };
            
            await addDoc(collection(db, 'boxes'), newBoxData);
            createdCount++;
        } else {
            // Product exists in both, mark it as processed
            firestoreBoxMap.delete(product.id);
        }
    }
    
    // 4. Sync from Firestore to Stripe
    for (const box of firestoreBoxes) {
         if (!box.stripeProductId) {
            // Box exists in Firestore but not in Stripe -> Create it
             const { interval, interval_count } = getStripeInterval(box.frequency);

            const newStripeProduct = await stripe.products.create({
                name: box.name,
                description: box.description,
                images: [box.image],
            });

            const newPricingOptions: PricingOption[] = [];
            for (const option of box.pricingOptions) {
                const newStripePrice = await stripe.prices.create({
                    product: newStripeProduct.id,
                    unit_amount: option.price * 100,
                    currency: 'usd',
                    recurring: { interval, interval_count },
                    nickname: option.name,
                });
                newPricingOptions.push({
                    id: newStripePrice.id,
                    name: option.name,
                    price: option.price
                });
            }
            
            const boxRef = doc(db, 'boxes', box.id);
            batch.update(boxRef, {
                stripeProductId: newStripeProduct.id,
                pricingOptions: newPricingOptions
            });
            updatedCount++;
         }
    }

    await batch.commit();

    return NextResponse.json({
        message: 'Sync complete.',
        createdCount,
        updatedCount,
    });

  } catch (error: any) {
    console.error('Failed to sync Stripe products:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
