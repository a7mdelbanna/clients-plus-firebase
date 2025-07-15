import { auth, db } from '../config/firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

export async function ensureUserDocument() {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.log('No current user');
    return;
  }

  try {
    // Check if user document exists
    const userRef = doc(db, 'users', currentUser.uid);
    let userDoc;
    try {
      userDoc = await getDoc(userRef);
    } catch (error) {
      console.log('Error reading user document, will create it:', error);
      userDoc = { exists: () => false };
    }
    
    if (!userDoc.exists()) {
      console.log('Creating missing user document for:', currentUser.uid);
      
      // Get token to check for existing companyId
      const idTokenResult = await currentUser.getIdTokenResult();
      const companyId = idTokenResult.claims.companyId as string;
      
      // Create the user document
      await setDoc(userRef, {
        id: currentUser.uid,
        email: currentUser.email,
        name: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
        companyId: companyId || null,
        role: idTokenResult.claims.role || 'USER',
        active: true,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      });
      
      console.log('User document created successfully');
    } else {
      console.log('User document already exists');
      
      // Update last login
      await setDoc(userRef, {
        lastLoginAt: serverTimestamp(),
      }, { merge: true });
    }
  } catch (error) {
    console.error('Error ensuring user document:', error);
  }
}