import type { Timestamp } from "firebase/firestore";

export type PricingOption = {
  id: string; // Stripe Price ID
  name: string;
  price: number;
  description?: string;
};

export type Box = {
  id: string;
  name: string;
  description: string;
  image: string;
  hint: string;
  quantity: number;
  subscribedCount: number;
  startDate?: string | null;
  endDate?: string | null;
  createdAt?: any;
  stripeProductId?: string;
  pricingOptions: PricingOption[];
  frequency: 'weekly' | 'bi-weekly' | 'monthly';
  displayOnWebsite: boolean;
  manualSignupCutoff: boolean;
};

export type Subscription = {
    id: string;
    userId: string;
    customerName: string | null;
    boxId: string;
    boxName:string;
    startDate: string;
    status: 'Active' | 'Cancelled' | 'Pending' | 'Past Due' | 'Unpaid' | 'Unknown';
    nextPickup: string;
    lastCharged?: string;
    price: number;
    priceId: string;
    priceName?: string;
    createdAt: any; // Firestore timestamp
    stripeSessionId?: string;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    customerEmail?: string;
}

export type Pickup = {
    id: string;
    boxId: string;
    boxName: string;
    pickupDate: string; // YYYY-MM-DD
    note: string;
}

export type AppUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  isAdmin?: boolean;
}

export type Customer = {
    id: string; // This will be the Stripe Customer ID
    userId?: string; // Link to Firebase Auth user if they exist
    name: string | null;
    email: string;
    createdAt: Timestamp;
    localOnly?: boolean; // Flag to indicate if customer only exists locally
}
