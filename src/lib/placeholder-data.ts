import { Carrot, Apple, Leaf, Box } from "lucide-react";

export const boxes = [
  {
    id: "box-1",
    name: "The Starter Sprout",
    description: "Perfect for individuals or couples. A weekly mix of 5-7 seasonal vegetables and fruits.",
    price: "25.00",
    image: "https://placehold.co/600x400.png",
    hint: "vegetable box",
    items: [
      { icon: Carrot, name: "Carrots" },
      { icon: Leaf, name: "Spinach" },
      { icon: Apple, name: "Apples" },
    ]
  },
  {
    id: "box-2",
    name: "The Family Harvest",
    description: "Ideal for a family of 4. A bountiful selection of 8-10 types of produce.",
    price: "45.00",
    image: "https://placehold.co/600x400.png",
    hint: "family vegetables",
     items: [
      { icon: Carrot, name: "Carrots" },
      { icon: Leaf, name: "Lettuce" },
      { icon: Apple, name: "Pears" },
      { icon: Box, name: "Potatoes" },
    ]
  },
  {
    id: "box-3",
    name: "The Veggie Enthusiast",
    description: "For the true veggie lovers! Includes all items from the Family Harvest plus exotic options.",
    price: "60.00",
    image: "https://placehold.co/600x400.png",
    hint: "large vegetable box",
     items: [
      { icon: Carrot, name: "Rainbow Carrots" },
      { icon: Leaf, name: "Kale" },
      { icon: Apple, name: "Peaches" },
      { icon: Box, name: "Sweet Potatoes" },
    ]
  },
];

export const subscriptions = [
    {
        id: "sub_1",
        boxName: "The Family Harvest",
        startDate: "2024-05-01",
        status: "Active",
        nextDelivery: "2024-07-28",
        price: 45.00,
    },
    {
        id: "sub_2",
        boxName: "The Starter Sprout",
        startDate: "2024-06-15",
        status: "Active",
        nextDelivery: "2024-07-25",
        price: 25.00,
    },
    {
        id: "sub_3",
        boxName: "The Starter Sprout",
        startDate: "2024-01-10",
        status: "Cancelled",
        nextDelivery: "N/A",
        price: 25.00,
    }
];

export const users = [
    {
        id: "usr_1",
        name: "John Doe",
        email: "john.doe@example.com",
        joinDate: "2024-04-20",
        subscriptions: 1,
    },
    {
        id: "usr_2",
        name: "Alice Smith",
        email: "alice.smith@example.com",
        joinDate: "2024-05-11",
        subscriptions: 2,
    },
    {
        id: "usr_3",
        name: "Bob Johnson",
        email: "bob.johnson@example.com",
        joinDate: "2024-06-01",
        subscriptions: 0,
    },
    {
        id: "usr_4",
        name: "Emily White",
        email: "emily.white@example.com",
        joinDate: "2023-12-15",
        subscriptions: 1,
    }
];

export const orders = [
    {
        id: "ord_1",
        customerName: "John Doe",
        boxName: "The Family Harvest",
        orderDate: "2024-07-20",
        status: "Shipped",
        price: 45.00,
    },
    {
        id: "ord_2",
        customerName: "Alice Smith",
        boxName: "The Starter Sprout",
        orderDate: "2024-07-21",
        status: "Processing",
        price: 25.00,
    },
    {
        id: "ord_3",
        customerName: "John Doe",
        boxName: "The Veggie Enthusiast",
        orderDate: "2024-07-18",
        status: "Delivered",
        price: 60.00,
    },
    {
        id: "ord_4",
        customerName: "Emily White",
        boxName: "The Starter Sprout",
        orderDate: "2024-07-22",
        status: "Processing",
        price: 25.00,
    },
    {
        id: "ord_5",
        customerName: "Bob Johnson",
        boxName: "The Family Harvest",
        orderDate: "2024-07-19",
        status: "Delivered",
        price: 45.00,
    },
     {
        id: "ord_6",
        customerName: "Alice Smith",
        boxName: "The Family Harvest",
        orderDate: "2024-07-22",
        status: "Shipped",
        price: 45.00,
    }
];

export const revenueData = [
  { month: "Jan", revenue: 1200 },
  { month: "Feb", revenue: 1800 },
  { month: "Mar", revenue: 2200 },
  { month: "Apr", revenue: 2500 },
  { month: "May", revenue: 3100 },
  { month: "Jun", revenue: 3500 },
];

export const popularBoxesData = [
  { name: 'Starter Sprout', value: 400, fill: "var(--color-chart-1)" },
  { name: 'Family Harvest', value: 300, fill: "var(--color-chart-2)" },
  { name: 'Veggie Enthusiast', value: 150, fill: "var(--color-accent)" },
];
