

export type Box = {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  hint: string;
  quantity: number;
  subscribedCount: number;
  startDate?: string | null;
  endDate?: string | null;
  createdAt?: any;
  stripeProductId?: string;
  stripePriceId?: string;
  frequency: 'weekly' | 'bi-weekly' | 'monthly';
};

export type Subscription = {
    id: string;
    userId: string;
    customerName: string | null;
    boxId: string;
    boxName:string;
    startDate: string;
    status: 'Active' | 'Cancelled' | 'Pending';
    nextPickup: string;
    price: number;
    createdAt: any; // Firestore timestamp
    stripeSessionId?: string;
    stripeCustomerId?: string;
}

export type Pickup = {
    id: string;
    boxId: string;
    boxName: string;
    pickupDate: string; // YYYY-MM-DD
    note: string;
}
