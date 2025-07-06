import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAVTrBBhduUSuFxRZ_8okvS0JjV0EV2YuY",
  authDomain: "veggie-box-p5g13.firebaseapp.com",
  projectId: "veggie-box-p5g13",
  storageBucket: "veggie-box-p5g13.firebasestorage.app",
  messagingSenderId: "135857161584",
  appId: "1:135857161584:web:17dee613a48ddf8f913bb5"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
