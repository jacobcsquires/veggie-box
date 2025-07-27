


export type Order = {
    id: string;
    customerName: string;
    boxName: string;
    status: 'Processing' | 'Shipped' | 'Delivered';
    orderDate: string;
    price: number;
    createdAt?: any;
}

export type Box = {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  hint: string;
  quantity: number;
  subscribedCount: number;
  startDate?: string;
  endDate?: string;
  createdAt?: any;
};

export type Subscription = {
    id: string;
    userId: string;
    customerName: string | null;
    boxId: string;
    boxName:string;
    startDate: string;
    status: 'Active' | 'Cancelled';
    nextPickup: string;
    price: number;
    createdAt: any; // Firestore timestamp
}

export type Pickup = {
    id: string;
    boxId: string;
    boxName: string;
    pickupDate: string; // YYYY-MM-DD
    note: string;
}

    

    