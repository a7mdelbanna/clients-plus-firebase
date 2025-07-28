import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

interface ClientSession {
  clientId: string;
  phoneNumber: string;
  name: string;
  token: string;
  expiresAt: Date;
}

interface ClientAuthContextType {
  session: ClientSession | null;
  loading: boolean;
  login: (phoneNumber: string) => Promise<{ success: boolean; message?: string }>;
  verifyOTP: (otp: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  isAuthenticated: boolean;
}

const ClientAuthContext = createContext<ClientAuthContextType | undefined>(undefined);

export const useClientAuth = () => {
  const context = useContext(ClientAuthContext);
  if (!context) {
    throw new Error('useClientAuth must be used within ClientAuthProvider');
  }
  return context;
};

interface ClientAuthProviderProps {
  children: ReactNode;
}

const SESSION_KEY = 'clientPortalSession';

export const ClientAuthProvider: React.FC<ClientAuthProviderProps> = ({ children }) => {
  const [session, setSession] = useState<ClientSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingPhone, setPendingPhone] = useState<string>('');
  const navigate = useNavigate();

  // Load session from localStorage on mount
  useEffect(() => {
    const savedSession = localStorage.getItem(SESSION_KEY);
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        const expiresAt = new Date(parsed.expiresAt);
        
        // Check if session is still valid
        if (expiresAt > new Date()) {
          setSession(parsed);
        } else {
          localStorage.removeItem(SESSION_KEY);
        }
      } catch (error) {
        console.error('Error loading client session:', error);
        localStorage.removeItem(SESSION_KEY);
      }
    }
    setLoading(false);
  }, []);

  const login = async (phoneNumber: string): Promise<{ success: boolean; message?: string }> => {
    try {
      // Store the phone number for OTP verification
      setPendingPhone(phoneNumber);
      
      // Call Firebase Function to send OTP
      const sendOTP = httpsCallable(functions, 'sendClientOTP');
      
      try {
        const result = await sendOTP({ phoneNumber });
        const data = result.data as any;
        
        if (data.success) {
          // Store session ID for verification
          sessionStorage.setItem('otpSessionId', data.sessionId);
          return { success: true };
        } else {
          return { 
            success: false, 
            message: data.message || 'فشل إرسال رمز التحقق' 
          };
        }
      } catch (functionError: any) {
        console.error('Function call error:', functionError);
        
        // Fallback to mock OTP for testing
        if (import.meta.env.DEV) {
          console.log('Using mock OTP for development');
          // Store mock session data
          sessionStorage.setItem('otpSessionId', 'mock-session-' + Date.now());
          sessionStorage.setItem('mockOTP', '123456');
          sessionStorage.setItem('mockPhone', phoneNumber);
          return { success: true };
        }
        
        throw functionError;
      }
    } catch (error: any) {
      console.error('Login error:', error);
      
      // Handle specific error messages
      if (error.code === 'functions/resource-exhausted') {
        return { 
          success: false, 
          message: 'تم تجاوز عدد المحاولات المسموح. حاول بعد 15 دقيقة.' 
        };
      }
      
      return { 
        success: false, 
        message: 'فشل إرسال رمز التحقق. حاول مرة أخرى.' 
      };
    }
  };

  const verifyOTP = async (otp: string): Promise<{ success: boolean; message?: string }> => {
    try {
      // Check for mock OTP in development
      if (import.meta.env.DEV) {
        const mockOTP = sessionStorage.getItem('mockOTP');
        const mockPhone = sessionStorage.getItem('mockPhone');
        
        if (mockOTP && mockPhone === pendingPhone && otp === mockOTP) {
          console.log('Using mock authentication for development');
          
          // Create mock session
          const mockSession: ClientSession = {
            clientId: 'mock-client-123',
            phoneNumber: pendingPhone,
            name: 'عميل تجريبي',
            token: 'mock-token-' + Date.now(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          };
          
          setSession(mockSession);
          localStorage.setItem(SESSION_KEY, JSON.stringify(mockSession));
          sessionStorage.removeItem('mockOTP');
          sessionStorage.removeItem('mockPhone');
          sessionStorage.removeItem('otpSessionId');
          
          return { success: true };
        }
      }
      
      // Get session ID from storage
      const sessionId = sessionStorage.getItem('otpSessionId');
      
      // Call Firebase Function to verify OTP
      const verifyOTPFunc = httpsCallable(functions, 'verifyClientOTP');
      const result = await verifyOTPFunc({ 
        phoneNumber: pendingPhone,
        otp,
        sessionId 
      });
      
      const data = result.data as any;
      
      if (data.success && data.session) {
        // Create session from response
        const clientSession: ClientSession = {
          clientId: data.session.clientId,
          phoneNumber: data.session.phoneNumber,
          name: data.session.name,
          token: data.session.token,
          expiresAt: new Date(data.session.expiresAt),
        };
        
        setSession(clientSession);
        localStorage.setItem(SESSION_KEY, JSON.stringify(clientSession));
        sessionStorage.removeItem('otpSessionId');
        
        return { success: true };
      } else {
        return { 
          success: false, 
          message: data.message || 'رمز التحقق غير صحيح' 
        };
      }
    } catch (error: any) {
      console.error('OTP verification error:', error);
      
      // Handle specific error messages
      if (error.code === 'functions/not-found') {
        return { 
          success: false, 
          message: 'انتهت صلاحية رمز التحقق. اطلب رمز جديد.' 
        };
      }
      
      if (error.code === 'functions/permission-denied') {
        return { 
          success: false, 
          message: error.message || 'رمز التحقق غير صحيح' 
        };
      }
      
      return { 
        success: false, 
        message: 'حدث خطأ في التحقق. حاول مرة أخرى.' 
      };
    }
  };

  const logout = () => {
    setSession(null);
    localStorage.removeItem(SESSION_KEY);
    navigate('/client/login');
  };

  const value: ClientAuthContextType = {
    session,
    loading,
    login,
    verifyOTP,
    logout,
    isAuthenticated: !!session,
  };

  return (
    <ClientAuthContext.Provider value={value}>
      {children}
    </ClientAuthContext.Provider>
  );
};