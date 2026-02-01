
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import { doc, updateDoc, serverTimestamp, collection, query, where, getDocs, writeBatch, getDoc, setDoc, limit, runTransaction, orderBy } from 'firebase/firestore';
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
    const q = query(subsRef, where("stripeSubscriptionId", "==", stripeSubscriptionId), limit(1));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
        console.log(`Webhook: Could not find local subscription for Stripe ID: ${stripeSubscriptionId}`);
        return null;
    }
    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Subscription;
}

// Helper function to get the next pickup date for a subscription
const getNextPickupForSubscription = async (boxId: string, currentNextPickup: string): Promise<string | null> => {
    if (!boxId || !currentNextPickup) return null;

    const pickupsRef = collection(db, 'boxes', boxId, 'pickups');
    const q = query(pickupsRef, where('pickupDate', '>', currentNextPickup), orderBy('pickupDate', 'asc'), limit(1));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        return null;
    }
    return querySnapshot.docs[0].data().pickupDate;
};

// Helper to handle subscription cancellation logic idempotently
const handleSubscriptionCancellation = async (stripeSubscriptionId: string) => {
    const localSub = await findSubscriptionByStripeId(stripeSubscriptionId);

    // If subscription is not found, or already marked as Cancelled, do nothing.
    if (!localSub || localSub.status === 'Cancelled') {
        console.log(`Webhook: Cancellation event for ${stripeSubscriptionId}, but subscription not found or already cancelled locally. No action taken.`);
        return;
    }

    const subRef = doc(db, 'subscriptions', localSub.id);
    const boxRef = doc(db, 'boxes', localSub.boxId);

    try {
        await runTransaction(db, async (transaction) => {
            const boxDoc = await transaction.get(boxRef);
            
            // It's possible the box was deleted, but we should still cancel the subscription.
            if (boxDoc.exists()) {
                const boxData = boxDoc.data() as Box;
                const newSubscribedCount = Math.max(0, (boxData.subscribedCount || 0) - 1);
                transaction.update(boxRef, { subscribedCount: newSubscribedCount });
            } else {
                 console.warn(`Webhook: Box ${localSub.boxId} not found while cancelling sub ${localSub.id}. Count not decremented.`);
            }

            // Update subscription status to 'Cancelled'
            transaction.update(subRef, { status: 'Cancelled' });
        });
        console.log(`Webhook: Successfully processed cancellation for sub ${localSub.id}.`);
    } catch (error) {
        console.error(`Webhook Error: Transaction failed for subscription cancellation ${stripeSubscriptionId}.`, error);
        throw error; // Re-throw to be handled by the main POST function
    }
};


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
      
      // IDEMPOTENCY CHECK: See if we've already processed this session
      const subsQuery = query(collection(db, 'subscriptions'), where('stripeSessionId', '==', session.id), limit(1));
      const existingSubSnapshot = await getDocs(subsQuery);
      if (!existingSubSnapshot.empty) {
          console.log(`Webhook: Subscription for session ${session.id} already processed. Skipping.`);
          return NextResponse.json({ received: true, message: "Already processed." });
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
                to: customerEmail,
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
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice;
      console.log(`Webhook: Received invoice.payment_succeeded for invoice ${invoice.id}`);
      
      const stripeSubscriptionId = invoice.subscription as string;
      if (!stripeSubscriptionId) {
        console.warn(`Webhook: invoice.payment_succeeded ${invoice.id} had no subscription ID.`);
        return NextResponse.json({ received: true });
      }

      // We only care about this for recurring payments, not the first payment of a subscription
      // which is handled by checkout.session.completed.
      if (invoice.billing_reason === 'subscription_create') {
        console.log(`Webhook: Skipping invoice.payment_succeeded for subscription creation, handled by checkout.session.completed.`);
        return NextResponse.json({ received: true });
      }

      try {
        const localSub = await findSubscriptionByStripeId(stripeSubscriptionId);

        if (localSub) {
          const newNextPickup = await getNextPickupForSubscription(localSub.boxId, localSub.nextPickup);
          const lastCharged = new Date(invoice.created * 1000).toISOString().split('T')[0];

          const updateData: Partial<Subscription> = {
            status: 'Active', // Ensure status is active
            lastCharged: lastCharged,
          };

          if (newNextPickup) {
            updateData.nextPickup = newNextPickup;
          } else {
            console.warn(`Webhook: Could not find next pickup date for subscription ${localSub.id}`);
          }
          
          await updateDoc(doc(db, 'subscriptions', localSub.id), updateData as any);
          console.log(`Webhook: Updated subscription ${localSub.id} from invoice ${invoice.id}.`);
        } else {
          console.warn(`Webhook: Received invoice.payment_succeeded for unknown subscription ${stripeSubscriptionId}`);
        }
      } catch (error) {
        console.error(`Webhook Error: Failed to process invoice.payment_succeeded for subscription ${stripeSubscriptionId}`, error);
        return NextResponse.json({ error: 'Failed to process successful payment.' }, { status: 500 });
      }
      return NextResponse.json({ received: true });
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      console.log(`Webhook: Received invoice.payment_failed for invoice ${invoice.id}`);
      
      const stripeSubscriptionId = invoice.subscription as string;
      if (!stripeSubscriptionId) {
        return NextResponse.json({ received: true });
      }

      try {
        const localSub = await findSubscriptionByStripeId(stripeSubscriptionId);
        if (localSub) {
          // Stripe will also send a `customer.subscription.updated` event which will set the status.
          // However, we can do it here to be more immediate. The status on the subscription
          // will be 'past_due'.
          const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
          const newStatus = stripeSub.status.charAt(0).toUpperCase() + stripeSub.status.slice(1);
          
          await updateDoc(doc(db, 'subscriptions', localSub.id), { status: newStatus as Subscription['status'] });
          console.log(`Webhook: Updated subscription ${localSub.id} status to ${newStatus} due to failed payment.`);
        }
      } catch (error: any) {
         console.error(`Webhook Error: Failed to process invoice.payment_failed for subscription ${stripeSubscriptionId}`, error);
         return NextResponse.json({ error: 'Failed to process failed payment.' }, { status: 500 });
      }
      
      return NextResponse.json({ received: true });
    }

    case 'customer.subscription.updated': {
        const subscriptionUpdated = event.data.object as Stripe.Subscription;
        console.log(`Webhook: Received customer.subscription.updated for ${subscriptionUpdated.id}`);
        
        // A subscription is considered for cancellation if it's explicitly 'canceled' 
        // or if it's been set to cancel at the end of the current period.
        if (subscriptionUpdated.status === 'canceled' || subscriptionUpdated.cancel_at_period_end) {
            try {
                await handleSubscriptionCancellation(subscriptionUpdated.id);
            } catch (error) {
                return NextResponse.json({ error: 'Failed to process subscription cancellation.' }, { status: 500 });
            }
        } else {
            // Handle other status changes (e.g., past_due -> active)
            const localSub = await findSubscriptionByStripeId(subscriptionUpdated.id);
            if (localSub) {
                const newStatus = subscriptionUpdated.status.charAt(0).toUpperCase() + subscriptionUpdated.status.slice(1);
                
                const updateData: Partial<Subscription> = {};
                if (localSub.status !== newStatus) {
                    updateData.status = newStatus as Subscription['status'];
                }
                
                // Sync trial_end. If it's in the past, Stripe sets it to null.
                // We compare to avoid unnecessary writes.
                if (localSub.trialEnd !== subscriptionUpdated.trial_end) {
                    updateData.trialEnd = subscriptionUpdated.trial_end;
                }

                if (Object.keys(updateData).length > 0) {
                     await updateDoc(doc(db, 'subscriptions', localSub.id), updateData as any);
                     console.log(`Webhook: Updated subscription ${localSub.id} with data:`, updateData);
                }
            }
        }
        return NextResponse.json({ received: true });
    }

    case 'customer.subscription.deleted': {
        const subscriptionDeleted = event.data.object as Stripe.Subscription;
        console.log(`Webhook: Received customer.subscription.deleted for ${subscriptionDeleted.id}`);
        try {
            // A deleted subscription is definitively cancelled.
            await handleSubscriptionCancellation(subscriptionDeleted.id);
        } catch (error) {
            return NextResponse.json({ error: 'Failed to process subscription deletion.' }, { status: 500 });
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
