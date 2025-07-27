import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { collection, getDocs, doc, writeBatch, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Subscription, AppUser } from '@/lib/types';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export async function POST(request: Request) {
  try {
    const subscriptionsRef = collection(db, 'subscriptions');
    const querySnapshot = await getDocs(subscriptionsRef);
    
    const subscriptionsToUpdate = querySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Subscription))
        .filter(sub => !sub.stripeCustomerId);

    if (subscriptionsToUpdate.length === 0) {
      return NextResponse.json({ message: 'All subscriptions are already up-to-date.', updatedCount: 0 });
    }

    const batch = writeBatch(db);
    let updatedCount = 0;

    for (const sub of subscriptionsToUpdate) {
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
        batch.update(subDocRef, { stripeCustomerId: customer.id });
        updatedCount++;
      } else {
         console.warn(`No Stripe customer found for email ${user.email} (subscription ${sub.id}).`);
      }
    }

    await batch.commit();

    return NextResponse.json({ message: 'Successfully updated subscriptions.', updatedCount });

  } catch (error: any) {
    console.error('Failed to backfill Stripe Customer IDs:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

    