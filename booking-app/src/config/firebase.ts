import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyDJbiI_M3A5cfRLskkDlpcIEs84OPWyMwE",
  authDomain: "clients-plus-egypt.firebaseapp.com",
  projectId: "clients-plus-egypt",
  storageBucket: "clients-plus-egypt.firebasestorage.app",
  messagingSenderId: "798539090470",
  appId: "1:798539090470:web:43e36ab07eeaae5e972b82",
  measurementId: "G-SFBBF2FZET"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Initialize Cloud Storage and get a reference to the service
export const storage = getStorage(app);

// Initialize Firebase Functions and get a reference to the service
export const functions = getFunctions(app, 'europe-west1');

export default app;