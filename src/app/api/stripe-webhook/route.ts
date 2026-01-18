
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import { doc, updateDoc, serverTimestamp, collection, query, where, getDocs, writeBatch, getDoc, setDoc, limit, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Subscription, Box, AppUser, Customer } from '@/lib/types';


const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// Helper function to find a user by email
const findUserByEmail = async (email: string): Promise<AppUser | null> => {
    if (!email) return null;
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where("email", "==", email), limit(1));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
        console.log(`Webhook: Could not find user for email: ${email}`);
        return null;
    }
    const userDoc = querySnapshot.docs[0];
    return { uid: userDoc.id, ...userDoc.data() } as AppUser;
}

// Helper function to find a subscription by its Stripe ID
const findSubscriptionByStripeId = async (stripeSubscriptionId: string): Promise<Subscription | null> => {
    const subsRef = collection(db, 'subscriptions');
    const q = query(subsRef, where("stripeSubscriptionId", "==", stripeSubscriptionId));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
        console.log(`Webhook: Could not find local subscription for Stripe ID: ${stripeSubscriptionId}`);
        return null;
    }
    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Subscription;
}

export async function POST(req: Request) {
  const body = await req.text();
  const signature = headers().get('Stripe-Signature') as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error(`??  Webhook signature verification failed.`, err.message);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const { boxId, userId, customerName, price, priceId, priceName, startDate, boxName } = session.metadata || {};

      if (!boxId || !userId || !priceId || !price || !startDate) {
        console.error('Webhook Error: Missing required metadata in checkout session.');
        return NextResponse.json({ received: true, message: "Missing metadata" });
      }

      const subscriptionRef = doc(collection(db, 'subscriptions'));
      const boxRef = doc(db, 'boxes', boxId);

      try {
        // Use a transaction to create the subscription and update the box count atomically
        await runTransaction(db, async (transaction) => {
            const boxDoc = await transaction.get(boxRef);
            if (!boxDoc.exists()) {
                throw new Error(`Webhook Error: Veggie Box Plan with ID ${boxId} not found.`);
            }

            const currentBoxData = boxDoc.data() as Box;
            const newSubscribedCount = (currentBoxData.subscribedCount || 0) + 1;

            if (newSubscribedCount > currentBoxData.quantity) {
                console.error(`Webhook Race Condition: Box ${boxId} sold out. Cannot create subscription.`);
                if (session.subscription) {
                     await stripe.subscriptions.cancel(session.subscription as string);
                     console.log(`Webhook: Canceled Stripe subscription ${session.subscription} due to sold out box.`);
                }
                throw new Error(`Veggie Box Plan "${currentBoxData.name}" is sold out.`);
            }
            
            transaction.update(boxRef, { subscribedCount: newSubscribedCount });
            
            const subscriptionData: Omit<Subscription, 'id'> = {
                userId,
                customerName: customerName || session.customer_details?.name || 'N/A',
                boxId,
                boxName: currentBoxData.name,
                price: parseFloat(price),
                priceId,
                priceName: priceName || '',
                status: 'Active',
                startDate,
                nextPickup: startDate,
                createdAt: serverTimestamp(),
                stripeCustomerId: session.customer as string,
                stripeSubscriptionId: session.subscription as string,
                stripeSessionId: session.id,
            };
            transaction.set(subscriptionRef, subscriptionData);
        });

        console.log(`Webhook: Successfully created and activated subscription ${subscriptionRef.id}`);

        // Send receipt email via Trigger Email extension
        const customerEmail = session.customer_details?.email;
        if (customerEmail) {
            const boxDoc = await getDoc(boxRef);
            const freshBoxData = boxDoc.data() as Box;
            const mailRef = doc(collection(db, "mail"));
            await setDoc(mailRef, {
                to: [customerEmail],
                message: {
                    subject: `Your subscription to ${freshBoxData.name} is confirmed!`,
                    html: `
                    <h1>Thank you, ${customerName || 'there'}!</h1>
                    <p>Your subscription to the <strong>${freshBoxData.name}</strong> is confirmed.</p>
                    <p>
                        <strong>Plan:</strong> ${priceName || ''}<br>
                        <strong>Price:</strong> $${parseFloat(price).toFixed(2)} per ${freshBoxData.frequency.replace('-ly','')}
                    </p>
                    <p>Your first pickup date is scheduled for <strong>${startDate}</strong>.</p>
                    <p>You can manage your subscription anytime by visiting your dashboard.</p>
                    <p>Thanks for supporting local!</p>
                    `,
                },
            });
            console.log(`Webhook: Receipt email queued for subscription ${subscriptionRef.id}`);
        }
        return NextResponse.json({ received: true });

      } catch (error) {
        console.error(`Webhook Error: Failed to process checkout for session: ${session.id}`, error);
        return NextResponse.json({ error: 'Failed to process checkout completion.' }, { status: 500 });
      }
    }
    case 'customer.subscription.updated': {
        const subscriptionUpdated = event.data.object as Stripe.Subscription;
        console.log(`Webhook: Received customer.subscription.updated for ${subscriptionUpdated.id}`);
        const localSub = await findSubscriptionByStripeId(subscriptionUpdated.id);
        
        if (localSub) {
            const newStatus = subscriptionUpdated.status.charAt(0).toUpperCase() + subscriptionUpdated.status.slice(1);
            try {
                 await updateDoc(doc(db, 'subscriptions', localSub.id), { status: newStatus });
                 console.log(`Webhook: Successfully updated status for local subscription ${localSub.id} to ${newStatus}`);
            } catch(error) {
                console.error(`Webhook: Failed to update subscription status for ${localSub.id}`, error);
                return NextResponse.json({ error: 'Failed to update subscription in database.' }, { status: 500 });
            }
        }
        return NextResponse.json({ received: true });
    }

    case 'customer.subscription.deleted': {
        const subscriptionDeleted = event.data.object as Stripe.Subscription;
        console.log(`Webhook: Received customer.subscription.deleted for ${subscriptionDeleted.id}`);
        const localSub = await findSubscriptionByStripeId(subscriptionDeleted.id);

        if (localSub) {
             try {
                // Mark as cancelled, or whatever status makes sense for a hard delete from stripe
                 await updateDoc(doc(db, 'subscriptions', localSub.id), { status: 'Cancelled' });
                 console.log(`Webhook: Successfully marked local subscription ${localSub.id} as Cancelled`);
            } catch(error) {
                console.error(`Webhook: Failed to mark subscription as cancelled for ${localSub.id}`, error);
                return NextResponse.json({ error: 'Failed to update subscription in database.' }, { status: 500 });
            }
        }
        return NextResponse.json({ received: true });
    }
    
    case 'customer.created': {
        const customer = event.data.object as Stripe.Customer;
        console.log(`Webhook: Received customer.created for ${customer.id}`);
        if (!customer.email) {
            console.warn(`Webhook: customer.created event for ${customer.id} has no email. Cannot create customer.`);
            return NextResponse.json({ received: true });
        }
        
        try {
            const user = await findUserByEmail(customer.email);

            const customerData: Partial<Customer> = {
                name: customer.name,
                email: customer.email,
                createdAt: serverTimestamp(),
                userId: user?.uid || null,
                activeSubscriptionCount: 0,
                status: 'inactive',
            };

            await setDoc(doc(db, 'customers', customer.id), customerData, { merge: true });
            console.log(`Webhook: Successfully created/merged customer ${customer.id} in Firestore.`);
            return NextResponse.json({ received: true });
        } catch (error) {
            console.error(`Webhook Error: Failed to create customer ${customer.id}`, error);
            return NextResponse.json({ error: 'Failed to create customer record.' }, { status: 500 });
        }
    }

    case 'customer.updated': {
      const customer = event.data.object as Stripe.Customer;
      console.log(`Webhook: Received customer.updated for ${customer.id}`);
      
      const customerRef = doc(db, 'customers', customer.id);

      try {
        const docSnap = await getDoc(customerRef);
        const user = await findUserByEmail(customer.email!);

        if (docSnap.exists()) {
          // Update the local customer record
          await updateDoc(customerRef, {
            name: customer.name,
            email: customer.email,
            userId: user?.uid || null,
          });
          console.log(`Webhook: Successfully updated customer ${customer.id} in Firestore.`);
        } else {
          // If customer doesn't exist, create it (handles cases where created webhook was missed)
          console.warn(`Webhook: Received customer.updated for ${customer.id}, but customer does not exist in Firestore. Creating it now.`);
          
          const customerData: Omit<Customer, 'id'> = {
                name: customer.name,
                email: customer.email!,
                createdAt: serverTimestamp(),
                userId: user?.uid || null,
                status: 'inactive',
                activeSubscriptionCount: 0,
            };
          await setDoc(customerRef, customerData);
        }
        return NextResponse.json({ received: true });
      } catch (error) {
        console.error(`Webhook Error: Failed to update/create customer ${customer.id}`, error);
        return NextResponse.json({ error: 'Failed to update customer record.' }, { status: 500 });
      }
    }
        
    default:
      // Temporarily log all unhandled events to see what's coming in
      // console.log(`Unhandled event type ${event.type}`, event.data.object);
      break;
  }

  return NextResponse.json({ received: true });
}
