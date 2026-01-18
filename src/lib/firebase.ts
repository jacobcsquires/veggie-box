import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDA4QzG5XMPBKoMrm7WPKNN9s1Uvbt-mfw",
  authDomain: "veggie-box-app-25433570-29ebb.firebaseapp.com",
  projectId: "veggie-box-app-25433570-29ebb",
  storageBucket: "veggie-box-app-25433570-29ebb.firebasestorage.app",
  messagingSenderId: "468927648474",
  appId: "1:468927648474:web:c30b2994fd93823c758be3"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
