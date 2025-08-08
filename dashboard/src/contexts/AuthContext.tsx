import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { authAPI, tokenUtils } from '../config/api';
import { AxiosError } from 'axios';

interface AuthUser {
  id: string;
  email: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  photoURL?: string;
  emailVerified: boolean;
  companyId?: string;
  role?: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface AuthContextType {
  currentUser: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  signup: (email: string, password: string, displayName: string, firstName?: string, lastName?: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfile: (profileData: Partial<AuthUser>) => Promise<void>;
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
    const initializeAuth = async () => {
      try {
        if (tokenUtils.isTokenValid()) {
          // Get current user data from API
          const response = await authAPI.me();
          setCurrentUser(response.data.user);
        } else {
          // Try to refresh token if available
          const refreshToken = tokenUtils.getRefreshToken();
          if (refreshToken) {
            try {
              const response = await authAPI.refreshToken(refreshToken);
              const { accessToken, refreshToken: newRefreshToken, expiresIn, user } = response.data;
              const rememberMe = tokenUtils.getRememberMe();
              tokenUtils.setTokens(accessToken, newRefreshToken, expiresIn, rememberMe);
              setCurrentUser(user);
            } catch (refreshError) {
              // Refresh failed, clear tokens
              tokenUtils.clearTokens();
              setCurrentUser(null);
            }
          } else {
            setCurrentUser(null);
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        tokenUtils.clearTokens();
        setCurrentUser(null);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Listen for token expiration events
    const handleTokenExpired = () => {
      setCurrentUser(null);
      tokenUtils.clearTokens();
    };

    window.addEventListener('auth:token-expired', handleTokenExpired);

    return () => {
      window.removeEventListener('auth:token-expired', handleTokenExpired);
    };
  }, []);

  const login = async (email: string, password: string, rememberMe: boolean = false) => {
    try {
      const response = await authAPI.login({ email, password, rememberMe });
      const { accessToken, refreshToken, expiresIn, user } = response.data;
      
      // Store tokens
      tokenUtils.setTokens(accessToken, refreshToken, expiresIn, rememberMe);
      
      // Set current user
      setCurrentUser(user);
      
      return response.data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const signup = async (
    email: string, 
    password: string, 
    displayName: string, 
    firstName?: string, 
    lastName?: string
  ) => {
    try {
      const response = await authAPI.register({
        email,
        password,
        displayName,
        firstName,
        lastName
      });
      
      const { accessToken, refreshToken, expiresIn, user } = response.data;
      
      // Store tokens
      tokenUtils.setTokens(accessToken, refreshToken, expiresIn, false);
      
      // Set current user
      setCurrentUser(user);
      
      return response.data;
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Call logout API to invalidate tokens on server
      await authAPI.logout();
    } catch (error) {
      // Even if API call fails, clear local tokens
      console.error('Logout API error:', error);
    } finally {
      // Clear tokens and user state
      tokenUtils.clearTokens();
      setCurrentUser(null);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await authAPI.forgotPassword(email);
    } catch (error) {
      console.error('Reset password error:', error);
      throw error;
    }
  };

  const refreshUser = async () => {
    try {
      const response = await authAPI.me();
      setCurrentUser(response.data.user);
    } catch (error) {
      console.error('Refresh user error:', error);
      throw error;
    }
  };

  const updateProfile = async (profileData: Partial<AuthUser>) => {
    try {
      const response = await authAPI.updateProfile(profileData);
      setCurrentUser(response.data.user);
    } catch (error) {
      console.error('Update profile error:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    currentUser,
    loading,
    login,
    signup,
    logout,
    resetPassword,
    refreshUser,
    updateProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};