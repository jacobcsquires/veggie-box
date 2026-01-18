

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Customer } from '@/lib/types';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export async function POST(request: Request) {
  try {
    const { name, email } = await request.json();

    if (!name || !email) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    // 1. Create customer in Stripe
    const stripeCustomer = await stripe.customers.create({
        name,
        email,
    });

    // 2. Create customer in Firestore
    const customerData: Omit<Customer, 'id'> = {
        name,
        email,
        createdAt: serverTimestamp() as any,
        activeSubscriptionCount: 0,
        status: 'inactive',
    };
    // Use stripeCustomer.id as the document ID in Firestore
    await setDoc(doc(db, 'customers', stripeCustomer.id), customerData);
    

    return NextResponse.json({ success: true, customerId: stripeCustomer.id });
  } catch (error: any) {
    console.error('Stripe customer creation failed:', error);
    if (error.code === 'resource_already_exists' || error.raw?.code === 'email_invalid') {
        return NextResponse.json({ message: error.message }, { status: 409 });
    }
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
