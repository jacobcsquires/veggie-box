
export type BoxItem = {
  name: string;
  icon: string;
};

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

export type Order = {
    id: string;
    userId: string;
    customerName: string;
    boxId: string;
    boxName: string;
    orderDate: string;
    status: 'Processing' | 'Shipped' | 'Delivered';
    price: number;
    createdAt: any; // Firestore timestamp
}

export type Subscription = {
    id: string;
    userId: string;
    boxId: string;
    boxName:string;
    startDate: string;
    status: 'Active' | 'Cancelled';
    nextDelivery: string;
    price: number;
    createdAt: any; // Firestore timestamp
}

export type Delivery = {
    id: string;
    boxId: string;
    boxName: string;
    deliveryDate: string; // YYYY-MM-DD
    items: BoxItem[];
}
