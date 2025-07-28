
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { collection, getDocs, doc, writeBatch, serverTimestamp, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Subscription, Box, AppUser } from '@/lib/types';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

// Helper function to find a user by email
const findUserByEmail = async (email: string): Promise<AppUser | null> => {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where("email", "==", email));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
        return null;
    }
    return { uid: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as AppUser;
}

// Helper function to find a box by its Stripe Price ID
const findBoxByPriceId = async (priceId: string): Promise<Box | null> => {
    const boxesRef = collection(db, 'boxes');
    const q = query(boxesRef, where("stripePriceId", "==", priceId));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
        return null;
    }
    return { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as Box;
}

export async function POST() {
  try {
    // 1. Fetch all active subscriptions from Stripe
    const stripeSubscriptions: Stripe.Subscription[] = [];
    for await (const sub of stripe.subscriptions.list({ status: 'all', limit: 100 })) {
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

        if (existingFirestoreSub) {
            // Subscription exists in both, update status if different
            const newStatus = stripeSub.status.charAt(0).toUpperCase() + stripeSub.status.slice(1);
            if (existingFirestoreSub.status !== newStatus) {
                const subRef = doc(db, 'subscriptions', existingFirestoreSub.id);
                batch.update(subRef, { status: newStatus });
                updatedCount++;
            }
            // Remove from map to track remaining Firestore-only subs
            firestoreSubMap.delete(stripeSub.id);

        } else {
            // Subscription exists in Stripe but not Firestore -> Create it
            const customer = await stripe.customers.retrieve(stripeSub.customer as string) as Stripe.Customer;
            if (customer.deleted) continue;

            const user = await findUserByEmail(customer.email!);
            const box = await findBoxByPriceId(stripeSub.items.data[0].price.id);

            if (user && box) {
                const newSubRef = doc(collection(db, 'subscriptions'));
                const newSubData: Omit<Subscription, 'id'> = {
                    userId: user.uid,
                    customerName: user.displayName || customer.name,
                    boxId: box.id,
                    boxName: box.name,
                    startDate: new Date(stripeSub.start_date * 1000).toISOString().split('T')[0],
                    status: (stripeSub.status.charAt(0).toUpperCase() + stripeSub.status.slice(1)) as Subscription['status'],
                    nextPickup: new Date(stripeSub.current_period_end * 1000).toISOString().split('T')[0],
                    price: (stripeSub.items.data[0].price.unit_amount || 0) / 100,
                    createdAt: serverTimestamp(),
                    stripeSubscriptionId: stripeSub.id,
                    stripeCustomerId: customer.id,
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
        if (stripeId) { 
             const subRef = doc(db, 'subscriptions', firestoreSub.id);
             batch.update(subRef, { status: 'Unknown', localOnly: true }); // Mark as localOnly or another status
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
