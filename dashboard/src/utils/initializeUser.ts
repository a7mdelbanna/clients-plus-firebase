import { auth, db } from '../config/firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

let initialized = false;

export function initializeUserOnAuth() {
  if (initialized) return;
  initialized = true;
  
  onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    
    // Create a minimal user document if it doesn't exist
    const userRef = doc(db, 'users', user.uid);
    
    try {
      const userDoc = await getDoc(userRef);
      if (!userDoc.exists()) {
        console.log('Creating initial user document for:', user.uid);
        
        // Create minimal document just to satisfy security rules
        await setDoc(userRef, {
          id: user.uid,
          email: user.email,
          name: user.displayName || user.email?.split('@')[0] || 'User',
          createdAt: serverTimestamp(),
          active: true,
        });
        
        console.log('Initial user document created');
      }
    } catch (error) {
      // If we can't read, try to create anyway
      console.log('Attempting to create user document...');
      try {
        await setDoc(userRef, {
          id: user.uid,
          email: user.email,
          name: user.displayName || user.email?.split('@')[0] || 'User',
          createdAt: serverTimestamp(),
          active: true,
        }, { merge: true });
        console.log('User document created/updated');
      } catch (createError) {
        console.error('Failed to create user document:', createError);
      }
    }
  });
}