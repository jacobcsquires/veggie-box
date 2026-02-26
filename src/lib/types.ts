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
  waitlistCount?: number;
};

export type AddOn = {
  id: string; // Firestore doc ID
  name: string;
  description: string;
  image: string;
  price: number;
  frequency: 'weekly' | 'bi-weekly' | 'monthly';
  stripeProductId: string;
  stripePriceId: string;
  createdAt?: any;
};

export type AddOnItem = {
    priceId: string;
    name: string;
    price: number;
}

export type Subscription = {
    id: string;
    userId: string;
    customerName: string | null;
    boxId: string;
    boxName:string;
    startDate: string;
    status: 'Active' | 'Cancelled' | 'Pending' | 'Past Due' | 'Unpaid' | 'Trialing' | 'Unknown';
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
    notes?: string;
    trialEnd?: number | null;
    skippedPickups?: string[];
    addOns?: AddOnItem[];
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
  phone?: string | null;
}

export type Customer = {
    id: string; // This will be the Stripe Customer ID
    userId?: string | null; // Link to Firebase Auth user if they exist
    name: string | null;
    email: string;
    createdAt: Timestamp;
    status: 'active' | 'inactive';
    activeSubscriptionCount: number;
    phone?: string | null;
}

export type EmailTemplate = {
  id: string;
  name: string;
  description: string;
  subject: string;
  body: string;
  createdAt: Timestamp;
  veggieListImageUrl?: string;
  recipeCardImageUrl?: string;
};

export type WaitlistEntry = {
    id: string; // userId
    userName: string;
    userEmail: string;
    joinedAt: Timestamp;
}
