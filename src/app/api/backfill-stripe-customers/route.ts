

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { collection, getDocs, doc, writeBatch, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Subscription, AppUser } from '@/lib/types';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

// This function is now part of the more comprehensive sync-stripe-subscriptions route.
// It remains here to avoid breaking changes if it was bookmarked, but it is deprecated.
// The new logic is more robust.
export async function POST(request: Request) {
  try {
    const subscriptionsRef = collection(db, 'subscriptions');
    const querySnapshot = await getDocs(subscriptionsRef);
    
    // Fetch all subscriptions from Firestore, not just those missing a customer ID
    const allFirestoreSubs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subscription));

    if (allFirestoreSubs.length === 0) {
      return NextResponse.json({ message: 'No subscriptions found in Firestore to sync.', updatedCount: 0 });
    }

    const batch = writeBatch(db);
    let updatedCount = 0;

    for (const sub of allFirestoreSubs) {
       // Only process subscriptions that don't have a Stripe Customer ID yet.
      if (sub.stripeCustomerId) {
        continue;
      }
      
      const userRef = doc(db, 'users', sub.userId);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        console.warn(`User document not found for subscription ${sub.id}, skipping.`);
        continue;
      }

      const user = userSnap.data() as AppUser;
      if (!user.email) {
        console.warn(`User ${user.uid} has no email, cannot find Stripe customer for subscription ${sub.id}.`);
        continue;
      }
      
      const customerSearch = await stripe.customers.list({ email: user.email, limit: 1 });
      
      if (customerSearch.data.length > 0) {
        const customer = customerSearch.data[0];
        const subDocRef = doc(db, 'subscriptions', sub.id);
        
        // Check if the customer ID is actually different before writing to avoid unnecessary writes
        if (sub.stripeCustomerId !== customer.id) {
            batch.update(subDocRef, { stripeCustomerId: customer.id });
            updatedCount++;
        }
      } else {
         console.warn(`No Stripe customer found for email ${user.email} (subscription ${sub.id}).`);
      }
    }

    if (updatedCount > 0) {
        await batch.commit();
    }

    return NextResponse.json({ message: `Sync complete. ${updatedCount} subscription(s) updated.`, updatedCount });

  } catch (error: any) {
    console.error('Failed to backfill Stripe Customer IDs:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
