# Veggie Box Management System

A full-stack application for managing seasonal vegetable box subscriptions, built with Next.js, Firebase, and Stripe.

## Features

- **Customer Portal**: Browse veggie box plans, manage subscriptions, and skip pickups.
- **Admin Dashboard**: Manage products, track subscribers, handle pickup check-ins, and send marketing emails.
- **Stripe Integration**: Automated billing, prorated adjustments, and customer portal access.
- **Pickup-Specific Notes**: Customers can leave specific delivery instructions for individual pickups.
- **Waitlist System**: Automated waitlist management for sold-out plans.

## Tech Stack

- **Framework**: [Next.js 15 (App Router)](https://nextjs.org/)
- **Database**: [Firebase Firestore](https://firebase.google.com/docs/firestore)
- **Authentication**: [Firebase Auth](https://firebase.google.com/docs/auth)
- **Storage**: [Firebase Storage](https://firebase.google.com/docs/storage)
- **Payments**: [Stripe](https://stripe.com/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI Components**: [Shadcn UI](https://ui.shadcn.com/)
- **AI Integration**: [Genkit](https://firebase.google.com/docs/genkit)

## Getting Started

### 1. Prerequisites

- Node.js installed
- A Firebase Project
- A Stripe Account

### 2. Environment Setup

Create a `.env` file in the root directory and add the following variables (refer to `.env.example` if available):

```env
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Stripe
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
NEXT_PUBLIC_BASE_URL=http://localhost:9002

```

### 3. Installation

```bash
npm install
```

### 4. Running the App

```bash
npm run dev
```

The application will be available at `http://localhost:9002`.

## Deployment

This app is optimized for deployment via **Firebase App Hosting**. 

1. Connect your GitHub repository to Firebase.
2. Configure your environment variables in the Firebase Console.
3. Deploy!

## License

This project is private and intended for internal use.
