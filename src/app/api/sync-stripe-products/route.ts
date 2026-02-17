
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { collection, getDocs, doc, writeBatch, serverTimestamp, query, where, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Box, PricingOption, Subscription } from '@/lib/types';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

function getFrequencyFromInterval(interval: Stripe.Price.Recurring.Interval, intervalCount: number): Box['frequency'] {
    if (interval === 'month' && intervalCount === 1) return 'monthly';
    if (interval === 'week' && intervalCount === 2) return 'bi-weekly';
    return 'weekly';
}

export async function POST() {
  try {
    let createdCount = 0;
    let updatedCount = 0;
    let deletedCount = 0;

    // 1. Fetch all active products from Stripe
    const allStripeProducts: Stripe.Product[] = [];
    for await (const product of stripe.products.list({ active: true, limit: 100 })) {
        allStripeProducts.push(product);
    }
    
    // 2. Filter out add-ons, keeping only veggie boxes
    const veggieBoxStripeProducts = allStripeProducts.filter(p => p.metadata.product_type !== 'add_on');

    // 3. Fetch all boxes from Firestore
    const boxesSnapshot = await getDocs(collection(db, 'boxes'));
    const firestoreBoxMap = new Map(boxesSnapshot.docs.map(doc => [doc.data().stripeProductId, { id: doc.id, ...doc.data() } as Box]));

    const syncBatch = writeBatch(db);

    // 4. Sync from Stripe to Firestore
    for (const product of veggieBoxStripeProducts) {
        const existingBox = firestoreBoxMap.get(product.id);
        const prices = await stripe.prices.list({ product: product.id, active: true });

        if (prices.data.length === 0) {
            console.log(`Stripe product ${product.id} has no active prices, skipping.`);
            continue; // Don't sync products without prices
        }

        const pricingOptions: PricingOption[] = prices.data.map(p => ({
            id: p.id,
            name: p.nickname || 'Standard',
            price: (p.unit_amount || 0) / 100,
        }));
        
        const firstPrice = prices.data[0];

        if (existingBox) {
            // Product exists in both, check for updates
            const updates: Partial<Box> = {};
            if (existingBox.name !== product.name) updates.name = product.name;
            if (existingBox.description !== product.description) updates.description = product.description;
            
            const sortedExistingPrices = [...existingBox.pricingOptions].sort((a,b) => a.id.localeCompare(b.id));
            const sortedNewPrices = [...pricingOptions].sort((a,b) => a.id.localeCompare(b.id));

            if (JSON.stringify(sortedExistingPrices) !== JSON.stringify(sortedNewPrices)) {
                 updates.pricingOptions = pricingOptions;
            }
            
            if (Object.keys(updates).length > 0) {
                const boxRef = doc(db, 'boxes', existingBox.id);
                syncBatch.update(boxRef, updates);
                updatedCount++;
            }
            
            firestoreBoxMap.delete(product.id);
        } else {
            // Product exists in Stripe but not in Firestore -> Create it
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
            
            const newBoxRef = doc(collection(db, 'boxes'));
            syncBatch.set(newBoxRef, newBoxData);
            createdCount++;
        }
    }

    // 5. Any boxes remaining in firestoreBoxMap are not active in Stripe, so delete them from Firestore.
    for (const [stripeProductId, boxToDelete] of firestoreBoxMap.entries()) {
        if (stripeProductId) { // Only delete if it was a synced product
            const boxRef = doc(db, 'boxes', boxToDelete.id);
            syncBatch.delete(boxRef);
            deletedCount++;
        }
    }

    await syncBatch.commit();

    // 6. Recalculate and sync subscriber counts for all boxes
    const boxesSnapshotAfterSync = await getDocs(collection(db, 'boxes'));
    const allBoxes = boxesSnapshotAfterSync.docs.map(doc => ({ id: doc.id, ...doc.data() } as Box));
    
    const subscriptionsSnapshot = await getDocs(query(collection(db, 'subscriptions'), where('status', 'in', ['Active', 'Trialing', 'Past Due', 'Unpaid'])));
    const countableSubscriptions = subscriptionsSnapshot.docs.map(doc => doc.data() as Subscription);

    const subscriptionCounts = countableSubscriptions.reduce((acc, sub) => {
        if(sub.boxId) {
            acc[sub.boxId] = (acc[sub.boxId] || 0) + 1;
        }
        return acc;
    }, {} as Record<string, number>);
    
    const countUpdateBatch = writeBatch(db);
    let countsUpdated = 0;
    
    for (const box of allBoxes) {
        const correctCount = subscriptionCounts[box.id] || 0;
        if ((box.subscribedCount || 0) !== correctCount) {
            const boxRef = doc(db, 'boxes', box.id);
            countUpdateBatch.update(boxRef, { subscribedCount: correctCount });
            countsUpdated++;
        }
    }

    await countUpdateBatch.commit();

    return NextResponse.json({
        message: `Sync complete. ${createdCount} created, ${updatedCount} updated, ${deletedCount} archived.`,
        createdCount,
        updatedCount,
        deletedCount,
        countsUpdated,
    });

  } catch (error: any) {
    console.error('Failed to sync Stripe products:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
