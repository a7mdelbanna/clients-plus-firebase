import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

interface SuperadminUser {
  uid: string;
  email: string;
  displayName: string;
  role: 'superadmin';
  lastLogin: Date;
}

interface SuperadminAuthContextType {
  currentSuperadmin: SuperadminUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  checkAccess: () => boolean;
}

const SuperadminAuthContext = createContext<SuperadminAuthContextType | undefined>(undefined);

// Session storage key
const SUPERADMIN_SESSION_KEY = 'superadmin_session';

export const useSuperadminAuth = () => {
  const context = useContext(SuperadminAuthContext);
  if (context === undefined) {
    throw new Error('useSuperadminAuth must be used within a SuperadminAuthProvider');
  }
  return context;
};

interface SuperadminAuthProviderProps {
  children: React.ReactNode;
}

export const SuperadminAuthProvider: React.FC<SuperadminAuthProviderProps> = ({ children }) => {
  const [currentSuperadmin, setCurrentSuperadmin] = useState<SuperadminUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Load session from localStorage on mount
  useEffect(() => {
    const loadSession = async () => {
      try {
        const savedSession = localStorage.getItem(SUPERADMIN_SESSION_KEY);
        if (savedSession) {
          const session = JSON.parse(savedSession);
          
          // Verify session is still valid (less than 24 hours old)
          const sessionAge = Date.now() - session.timestamp;
          const maxAge = 24 * 60 * 60 * 1000; // 24 hours
          
          if (sessionAge < maxAge) {
            // Verify the user still exists in superadmins collection
            try {
              const superadminDoc = await getDoc(doc(db, 'superadmins', session.user.uid));
              if (superadminDoc.exists() && superadminDoc.data().role === 'superadmin') {
                setCurrentSuperadmin(session.user);
              } else {
                // Session invalid, clear it
                localStorage.removeItem(SUPERADMIN_SESSION_KEY);
              }
            } catch (error) {
              console.error('Error verifying superadmin session:', error);
              localStorage.removeItem(SUPERADMIN_SESSION_KEY);
            }
          } else {
            // Session expired
            localStorage.removeItem(SUPERADMIN_SESSION_KEY);
          }
        }
      } catch (error) {
        console.error('Error loading superadmin session:', error);
      }
      setLoading(false);
    };

    loadSession();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      // Create a temporary auth session to verify credentials
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      try {
        // Check if user is a superadmin
        console.log('🔍 Verifying superadmin status for UID:', userCredential.user.uid);
        const superadminDoc = await getDoc(doc(db, 'superadmins', userCredential.user.uid));
        console.log('📄 Superadmin document exists:', superadminDoc.exists());
        
        if (!superadminDoc.exists()) {
          console.error('❌ Superadmin document does not exist for UID:', userCredential.user.uid);
          // Sign out from regular auth immediately
          await firebaseSignOut(auth);
          throw new Error('Access denied. This account does not have superadmin privileges.');
        }
        
        const data = superadminDoc.data();
        console.log('📋 Superadmin document data:', data);
        
        if (!data || data.role !== 'superadmin') {
          console.error('❌ Invalid role:', data?.role, 'Expected: superadmin');
          await firebaseSignOut(auth);
          throw new Error('Access denied. Invalid role.');
        }
        
        console.log('✅ Superadmin role verified successfully');

        // Create superadmin session
        const superadminUser: SuperadminUser = {
          uid: userCredential.user.uid,
          email: userCredential.user.email || '',
          displayName: data.displayName || 'Superadmin',
          role: 'superadmin',
          lastLogin: new Date(),
        };

        // Save session to localStorage
        const session = {
          user: superadminUser,
          timestamp: Date.now(),
        };
        localStorage.setItem(SUPERADMIN_SESSION_KEY, JSON.stringify(session));

        // Update last login in Firestore and ensure proper superadmin document structure FIRST
        try {
          await setDoc(doc(db, 'superadmins', userCredential.user.uid), {
            role: 'superadmin',
            email: userCredential.user.email,
            createdAt: serverTimestamp(),
            lastLogin: serverTimestamp(),
          }, { merge: true });
          console.log('✅ Superadmin document updated successfully');
        } catch (updateError) {
          console.warn('⚠️ Failed to update superadmin document:', updateError);
        }

        // Update state
        setCurrentSuperadmin(superadminUser);

        // KEEP the Firebase auth session for Firestore access
        // Don't sign out - we need to stay authenticated for Firestore rules
        console.log('✅ Keeping Firebase auth session for Firestore access');
        
      } catch (firestoreError: any) {
        // Sign out if any error
        await firebaseSignOut(auth);
        
        if (firestoreError.code === 'permission-denied') {
          throw new Error('Access denied. This account does not have superadmin privileges.');
        }
        throw firestoreError;
      }
      
    } catch (error: any) {
      console.error('Superadmin sign in error:', error);
      
      // Provide user-friendly error messages
      if (error.code === 'auth/user-not-found') {
        throw new Error('No account found with this email.');
      } else if (error.code === 'auth/wrong-password') {
        throw new Error('Incorrect password.');
      } else if (error.code === 'auth/invalid-email') {
        throw new Error('Invalid email address.');
      } else if (error.code === 'auth/too-many-requests') {
        throw new Error('Too many failed attempts. Please try again later.');
      } else if (error.code === 'auth/invalid-credential') {
        throw new Error('Invalid email or password.');
      }
      
      throw error;
    }
  };

  const signOut = async () => {
    try {
      // Clear session
      localStorage.removeItem(SUPERADMIN_SESSION_KEY);
      setCurrentSuperadmin(null);
      
      // Also sign out from Firebase auth if signed in
      if (auth.currentUser) {
        await firebaseSignOut(auth);
      }
    } catch (error) {
      console.error('Superadmin sign out error:', error);
      throw error;
    }
  };

  const checkAccess = () => {
    // Check if current URL matches the superadmin pattern
    const urlHash = import.meta.env.VITE_SUPERADMIN_URL_HASH;
    const currentPath = window.location.pathname;
    const expectedPath = `/sa-${urlHash}`;
    
    return currentPath.startsWith(expectedPath) && currentSuperadmin !== null;
  };

  const value = {
    currentSuperadmin,
    loading,
    signIn,
    signOut,
    checkAccess,
  };

  return (
    <SuperadminAuthContext.Provider value={value}>
      {children}
    </SuperadminAuthContext.Provider>
  );
};