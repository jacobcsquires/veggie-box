

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { collection, getDocs, doc, writeBatch, serverTimestamp, Timestamp, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Customer, AppUser } from '@/lib/types';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

const findUser = async (email: string): Promise<AppUser | null> => {
    if (!email) return null;
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where("email", "==", email));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        return { uid: userDoc.id, ...userDoc.data() } as AppUser;
    }
    return null;
}


export async function POST() {
  try {
    // 1. Fetch all customers from Stripe
    const stripeCustomers: Stripe.Customer[] = [];
    for await (const customer of stripe.customers.list({ limit: 100 })) {
        if (!customer.deleted) {
             stripeCustomers.push(customer);
        }
    }
    
    // 2. Fetch all customers from Firestore
    const firestoreCustomersSnapshot = await getDocs(collection(db, 'customers'));
    const firestoreCustomers = firestoreCustomersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
    const firestoreCustomerMap = new Map(firestoreCustomers.map(cust => [cust.id, cust]));

    let createdCount = 0;
    let updatedCount = 0;
    let deletedCount = 0;
    const batch = writeBatch(db);

    // 3. Iterate through Stripe customers and sync with Firestore
    for (const stripeCustomer of stripeCustomers) {
        if (!stripeCustomer.email) continue;

        const existingFirestoreCustomer = firestoreCustomerMap.get(stripeCustomer.id);
        const user = await findUser(stripeCustomer.email);
        const customerRef = doc(db, 'customers', stripeCustomer.id);

        if (existingFirestoreCustomer) {
            // Customer exists in both, update if different
            const updates: { [key: string]: any } = {};
            if (existingFirestoreCustomer.name !== stripeCustomer.name) updates.name = stripeCustomer.name;
            if (existingFirestoreCustomer.email !== stripeCustomer.email) updates.email = stripeCustomer.email;
            if (existingFirestoreCustomer.userId !== user?.uid) updates.userId = user?.uid || null;
            if (existingFirestoreCustomer.localOnly) updates.localOnly = false;

            if (Object.keys(updates).length > 0) {
                batch.update(customerRef, updates);
                updatedCount++;
            }
            firestoreCustomerMap.delete(stripeCustomer.id);

        } else {
            // Customer exists in Stripe but not Firestore -> Create it
            const customerData: Omit<Customer, 'id'> = {
                name: stripeCustomer.name,
                email: stripeCustomer.email,
                createdAt: Timestamp.fromMillis(stripeCustomer.created * 1000),
                userId: user?.uid,
            };
            batch.set(customerRef, customerData);
            createdCount++;
        }
    }

    // 4. Any customers remaining in firestoreCustomerMap do not exist in Stripe (or are deleted)
    for (const [id, firestoreCustomer] of firestoreCustomerMap.entries()) {
        const customerRef = doc(db, 'customers', id);
        batch.delete(customerRef);
        deletedCount++;
    }

    await batch.commit();

    return NextResponse.json({
        message: 'Sync complete.',
        createdCount,
        updatedCount,
        deletedCount,
    });

  } catch (error: any) {
    console.error('Failed to sync Stripe customers:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
