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
  items: BoxItem[];
  quantity: number;
  subscribedCount: number;
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
