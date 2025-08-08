import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { auth } from '../config/firebase';
import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { ensureUserDocument } from '../utils/fixUserDocument';

interface AuthUser extends User {
  companyId?: string;
}

interface AuthContextType {
  currentUser: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Get the ID token to check for claims
        const idTokenResult = await user.getIdTokenResult();
        const companyId = idTokenResult.claims.companyId as string | undefined;
        
        // Create an extended user object with companyId
        const authUser: AuthUser = Object.assign(user, { companyId });
        setCurrentUser(authUser);
        
        // Ensure user document exists when user logs in
        await ensureUserDocument();
      } else {
        setCurrentUser(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    // Ensure user document exists after login
    await ensureUserDocument();
    // Force token refresh to get updated claims
    await result.user.getIdToken(true);
    
    // Get the updated token with claims
    const idTokenResult = await result.user.getIdTokenResult();
    const companyId = idTokenResult.claims.companyId as string | undefined;
    
    // Update current user with companyId
    const authUser: AuthUser = Object.assign(result.user, { companyId });
    setCurrentUser(authUser);
    
    return result;
  };

  const signup = async (email: string, password: string, displayName: string) => {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(user, { displayName });
  };

  const logout = async () => {
    await signOut(auth);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const value: AuthContextType = {
    currentUser,
    loading,
    login,
    signup,
    logout,
    resetPassword
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};