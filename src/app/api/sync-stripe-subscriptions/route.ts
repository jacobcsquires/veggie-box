

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { collection, getDocs, doc, writeBatch, serverTimestamp, query, where, addDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Subscription, Box, AppUser, PricingOption, Customer } from '@/lib/types';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

// Helper function to find a user by email
const findUser = async (email: string): Promise<AppUser | null> => {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where("email", "==", email));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        return { uid: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as AppUser;
    }
    return null;
}

// Helper function to find or create a box by its Stripe Product and Price ID
const findOrCreateBoxAndPrice = async (priceId: string): Promise<{box: Box, priceOption: PricingOption} | null> => {
    const boxesRef = collection(db, 'boxes');
    const boxesSnapshot = await getDocs(boxesRef);
    
    // First, try to find the price in existing boxes
    for (const doc of boxesSnapshot.docs) {
        const box = { id: doc.id, ...doc.data() } as Box;
        const priceOption = box.pricingOptions?.find(p => p.id === priceId);
        if (priceOption) {
            return { box, priceOption };
        }
    }

    // If price is not found, it might be a new price for an existing product or a new product
    try {
        const stripePrice = await stripe.prices.retrieve(priceId, { expand: ['product'] });
        const stripeProduct = stripePrice.product as Stripe.Product;

        // Check if a box with this stripeProductId already exists
        const boxQuery = query(boxesRef, where("stripeProductId", "==", stripeProduct.id));
        const boxQuerySnapshot = await getDocs(boxQuery);

        if (!boxQuerySnapshot.empty) {
            // Product exists, but the price is new. Add the new price to the existing box.
            const boxDoc = boxQuerySnapshot.docs[0];
            const box = { id: boxDoc.id, ...boxDoc.data() } as Box;
            const newPriceOption: PricingOption = {
                id: stripePrice.id,
                name: stripePrice.nickname || 'Standard',
                price: (stripePrice.unit_amount || 0) / 100,
            };
            const updatedPricingOptions = [...box.pricingOptions, newPriceOption];
            await updateDoc(doc(db, 'boxes', box.id), { pricingOptions: updatedPricingOptions });
            
            // Return the updated box and the new price option
            return { box: { ...box, pricingOptions: updatedPricingOptions }, priceOption: newPriceOption };
        } else {
            // Product does not exist in Firestore. Create a new box.
            const newPriceOption: PricingOption = {
                id: stripePrice.id,
                name: stripePrice.nickname || 'Standard',
                price: (stripePrice.unit_amount || 0) / 100,
            };

            const getFrequencyFromInterval = (interval: Stripe.Price.Recurring.Interval, intervalCount: number): Box['frequency'] => {
                if (interval === 'month' && intervalCount === 1) return 'monthly';
                if (interval === 'week' && intervalCount === 2) return 'bi-weekly';
                return 'weekly';
            }

            const newBoxData: Omit<Box, 'id'> = {
                name: stripeProduct.name,
                description: stripeProduct.description || 'Imported from Stripe.',
                image: stripeProduct.images?.[0] || 'https://placehold.co/600x400.png',
                hint: 'vegetable box',
                quantity: 999,
                subscribedCount: 0,
                stripeProductId: stripeProduct.id,
                pricingOptions: [newPriceOption],
                frequency: getFrequencyFromInterval(stripePrice.recurring!.interval, stripePrice.recurring!.interval_count),
                displayOnWebsite: true,
                manualSignupCutoff: false,
                createdAt: serverTimestamp(),
            };
            const newBoxRef = await addDoc(collection(db, 'boxes'), newBoxData);
            const newBox = { id: newBoxRef.id, ...newBoxData } as Box;
            return { box: newBox, priceOption: newPriceOption };
        }
    } catch (error) {
        console.error(`Error finding or creating box for price ID ${priceId}:`, error);
        return null;
    }
}


export async function POST() {
  try {
    // 1. Fetch all subscriptions from Stripe
    const stripeSubscriptions: Stripe.Subscription[] = [];
    for await (const sub of stripe.subscriptions.list({ status: 'all', limit: 100, expand: ['data.customer', 'data.latest_invoice'] })) {
      stripeSubscriptions.push(sub);
    }
    
    // 2. Fetch all subscriptions from Firestore
    const firestoreSubsSnapshot = await getDocs(collection(db, 'subscriptions'));
    const firestoreSubs = firestoreSubsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subscription));
    const firestoreSubMap = new Map(firestoreSubs.map(sub => [sub.stripeSubscriptionId, sub]));

    let createdCount = 0;
    let updatedCount = 0;
    const batch = writeBatch(db);

    // 3. Iterate through Stripe subscriptions and sync with Firestore
    for (const stripeSub of stripeSubscriptions) {
        if (!stripeSub.items.data[0]?.price?.id) continue;
        
        const existingFirestoreSub = firestoreSubMap.get(stripeSub.id);
        const customer = stripeSub.customer as Stripe.Customer;
        if (customer.deleted || !customer.email) continue;
        const newStatus = stripeSub.status.charAt(0).toUpperCase() + stripeSub.status.slice(1);
        const latestInvoice = stripeSub.latest_invoice as Stripe.Invoice;
        const lastChargedDate = latestInvoice?.status === 'paid' && latestInvoice?.created ? new Date(latestInvoice.created * 1000).toISOString().split('T')[0] : undefined;

        if (existingFirestoreSub) {
            // Subscription exists in both, update if different
            if (existingFirestoreSub.status !== newStatus || existingFirestoreSub.customerName !== customer.name || existingFirestoreSub.lastCharged !== lastChargedDate) {
                const subRef = doc(db, 'subscriptions', existingFirestoreSub.id);
                batch.update(subRef, { 
                    status: newStatus, 
                    customerName: customer.name,
                    lastCharged: lastChargedDate || null,
                });
                updatedCount++;
            }
            // Remove from map to track remaining Firestore-only subs
            firestoreSubMap.delete(stripeSub.id);

        } else {
            // Subscription exists in Stripe but not Firestore -> Create it
            // Ensure customer exists in our 'customers' collection
            const customerRef = doc(db, 'customers', customer.id);
            const customerSnap = await getDoc(customerRef);
            if (!customerSnap.exists()) {
                 await setDoc(customerRef, {
                    name: customer.name,
                    email: customer.email,
                    createdAt: serverTimestamp(),
                });
            }

            const user = await findUser(customer.email);
            const boxInfo = await findOrCreateBoxAndPrice(stripeSub.items.data[0].price.id);

            if (boxInfo) { // User is optional, but box info is critical
                const { box, priceOption } = boxInfo;
                const newSubRef = doc(collection(db, 'subscriptions'));
                const newSubData: Omit<Subscription, 'id'> = {
                    userId: user?.uid || customer.id, // Fallback to customer ID if no Firebase user
                    customerName: customer.name, // Use Stripe customer name as source of truth
                    boxId: box.id,
                    boxName: box.name,
                    startDate: new Date(stripeSub.start_date * 1000).toISOString().split('T')[0],
                    status: newStatus as Subscription['status'],
                    nextPickup: new Date(stripeSub.current_period_end * 1000).toISOString().split('T')[0],
                    price: priceOption.price,
                    priceId: priceOption.id,
                    priceName: priceOption.name,
                    createdAt: serverTimestamp(),
                    stripeSubscriptionId: stripeSub.id,
                    stripeCustomerId: customer.id,
                    lastCharged: lastChargedDate || null,
                };
                batch.set(newSubRef, newSubData);
                createdCount++;
            }
        }
    }

    // 4. Any subscriptions remaining in firestoreSubMap do not exist in Stripe
    for (const [stripeId, firestoreSub] of firestoreSubMap.entries()) {
        // We only care about subscriptions that have a stripeId but were not found in the Stripe loop.
        // Subscriptions without a stripeId are 'Pending' or manually created.
        if (stripeId && firestoreSub.status !== 'Unknown') { 
             const subRef = doc(db, 'subscriptions', firestoreSub.id);
             batch.update(subRef, { status: 'Unknown' });
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
    console.error('Failed to sync Stripe subscriptions:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
