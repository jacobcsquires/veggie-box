
import { NextResponse } from 'next/server';
import { doc, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Box } from '@/lib/types';

export async function POST(request: Request) {
  const { subscriptionId, boxId } = await request.json();

  if (!subscriptionId || !boxId) {
    return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
  }

  const subscriptionRef = doc(db, 'subscriptions', subscriptionId);
  const boxRef = doc(db, 'boxes', boxId);

  try {
    await runTransaction(db, async (transaction) => {
      const boxDoc = await transaction.get(boxRef);
      if (!boxDoc.exists()) {
        throw new Error("Associated box does not exist!");
      }

      const currentBoxData = boxDoc.data() as Omit<Box, 'id'>;
      const newSubscribedCount = Math.max(0, (currentBoxData.subscribedCount || 0) - 1);
      
      transaction.update(boxRef, { subscribedCount: newSubscribedCount });
      transaction.delete(subscriptionRef);
    });

    return NextResponse.json({ success: true, message: 'Pending subscription cancelled.' });

  } catch (error: any) {
    console.error('Failed to cancel pending subscription:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
