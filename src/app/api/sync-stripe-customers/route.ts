

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { collection, getDocs, doc, writeBatch, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Customer } from '@/lib/types';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});


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
    const batch = writeBatch(db);

    // 3. Iterate through Stripe customers and sync with Firestore
    for (const stripeCustomer of stripeCustomers) {
        const existingFirestoreCustomer = firestoreCustomerMap.get(stripeCustomer.id);

        const customerData: Customer = {
            id: stripeCustomer.id,
            name: stripeCustomer.name,
            email: stripeCustomer.email!,
            createdAt: Timestamp.fromMillis(stripeCustomer.created * 1000),
            localOnly: false
        };

        const customerRef = doc(db, 'customers', stripeCustomer.id);

        if (existingFirestoreCustomer) {
            // Customer exists in both, update if different
            if (existingFirestoreCustomer.name !== customerData.name || existingFirestoreCustomer.email !== customerData.email || existingFirestoreCustomer.localOnly) {
                batch.update(customerRef, { name: customerData.name, email: customerData.email, localOnly: false });
                updatedCount++;
            }
            // Remove from map to track remaining Firestore-only customers
            firestoreCustomerMap.delete(stripeCustomer.id);

        } else {
            // Customer exists in Stripe but not Firestore -> Create it
            batch.set(customerRef, customerData);
            createdCount++;
        }
    }

    // 4. Any customers remaining in firestoreCustomerMap do not exist in Stripe (or are deleted)
    for (const [id, firestoreCustomer] of firestoreCustomerMap.entries()) {
        if (firestoreCustomer.localOnly === false) { // Only flag previously synced customers
             const subRef = doc(db, 'customers', id);
             batch.update(subRef, { localOnly: true }); 
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
    console.error('Failed to sync Stripe customers:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
