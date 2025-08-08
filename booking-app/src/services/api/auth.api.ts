import { api, apiCache } from './config';

// API response interfaces
interface APIResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

interface SendOTPResponse {
  success: boolean;
  sessionId: string;
  message?: string;
}

interface VerifyOTPResponse {
  success: boolean;
  session: {
    clientId: string;
    phoneNumber: string;
    name: string;
    token: string;
    expiresAt: string; // ISO string
  };
  message?: string;
}

interface ValidateTokenResponse {
  success: boolean;
  client: {
    id: string;
    name: string;
    phoneNumber: string;
  };
  message?: string;
}

interface ClientSession {
  clientId: string;
  phoneNumber: string;
  name: string;
  token: string;
  expiresAt: Date;
}

class ClientAuthAPIService {
  private readonly BASE_PATH = '/auth/client';
  private readonly SESSION_KEY = 'clientPortalSession';

  /**
   * Send OTP to phone number
   */
  async sendOTP(phoneNumber: string): Promise<{ success: boolean; message?: string }> {
    try {
      console.log('=== sendOTP START ===');
      console.log('Phone number:', phoneNumber);

      // Normalize phone number
      let normalizedPhone = phoneNumber.replace(/[\s\-\(\)]/g, '').replace(/^\+20/, '');
      if (normalizedPhone && !normalizedPhone.startsWith('0')) {
        normalizedPhone = '0' + normalizedPhone;
      }

      const response = await api.post<APIResponse<SendOTPResponse>>(
        `${this.BASE_PATH}/send-otp`,
        {
          phoneNumber: normalizedPhone
        }
      );

      if (response.data.success) {
        // Store session ID for verification
        sessionStorage.setItem('otpSessionId', response.data.data.sessionId);
        
        console.log('OTP sent successfully');
        console.log('=== sendOTP END ===');
        
        return { success: true };
      } else {
        return { 
          success: false, 
          message: response.data.message || 'فشل إرسال رمز التحقق' 
        };
      }
    } catch (error: any) {
      console.error('Error sending OTP:', error);

      // Handle specific API errors
      if (error.response?.status === 429) {
        return { 
          success: false, 
          message: 'تم تجاوز عدد المحاولات المسموح. حاول بعد 15 دقيقة.' 
        };
      }

      if (error.response?.status === 400) {
        return { 
          success: false, 
          message: error.response.data.message || 'رقم الهاتف غير صحيح' 
        };
      }

      // Fallback to mock OTP for development
      if (import.meta.env.DEV) {
        console.log('Using mock OTP for development');
        sessionStorage.setItem('otpSessionId', 'mock-session-' + Date.now());
        sessionStorage.setItem('mockOTP', '123456');
        sessionStorage.setItem('mockPhone', phoneNumber);
        return { success: true };
      }

      return { 
        success: false, 
        message: 'فشل إرسال رمز التحقق. حاول مرة أخرى.' 
      };
    }
  }

  /**
   * Verify OTP and get client session
   */
  async verifyOTP(otp: string, phoneNumber: string, companyId?: string): Promise<{ success: boolean; message?: string }> {
    try {
      console.log('=== verifyOTP START ===');
      console.log('OTP:', otp);
      console.log('Phone number:', phoneNumber);
      console.log('Company ID:', companyId);

      // Check for mock OTP in development FIRST
      if (import.meta.env.DEV) {
        const mockOTP = sessionStorage.getItem('mockOTP');
        const mockPhone = sessionStorage.getItem('mockPhone');
        const sessionId = sessionStorage.getItem('otpSessionId');
        
        if (sessionId?.startsWith('mock-') && mockOTP && mockPhone === phoneNumber) {
          if (otp === mockOTP) {
            console.log('Using mock authentication for development');
            
            // Create mock session
            const mockSession: ClientSession = {
              clientId: 'mock-client-123',
              phoneNumber: phoneNumber,
              name: 'عميل تجريبي',
              token: 'mock-token-' + Date.now(),
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            };
            
            // Store session
            this.storeSession(mockSession);
            
            // Clean up mock data
            sessionStorage.removeItem('mockOTP');
            sessionStorage.removeItem('mockPhone');
            sessionStorage.removeItem('otpSessionId');
            
            console.log('=== verifyOTP (MOCK) END ===');
            return { success: true };
          } else {
            return { 
              success: false, 
              message: 'رمز التحقق غير صحيح. استخدم: 123456' 
            };
          }
        }
      }

      // Get session ID from storage
      const sessionId = sessionStorage.getItem('otpSessionId');
      if (!sessionId) {
        return { 
          success: false, 
          message: 'انتهت صلاحية رمز التحقق. اطلب رمز جديد.' 
        };
      }

      // Normalize phone number
      let normalizedPhone = phoneNumber.replace(/[\s\-\(\)]/g, '').replace(/^\+20/, '');
      if (normalizedPhone && !normalizedPhone.startsWith('0')) {
        normalizedPhone = '0' + normalizedPhone;
      }

      const requestBody: any = {
        phoneNumber: normalizedPhone,
        otp,
        sessionId
      };

      // Include company ID if provided
      if (companyId) {
        requestBody.companyId = companyId;
      }

      const response = await api.post<APIResponse<VerifyOTPResponse>>(
        `${this.BASE_PATH}/verify-otp`,
        requestBody
      );

      if (response.data.success && response.data.data.session) {
        // Create client session from response
        const clientSession: ClientSession = {
          clientId: response.data.data.session.clientId,
          phoneNumber: response.data.data.session.phoneNumber,
          name: response.data.data.session.name,
          token: response.data.data.session.token,
          expiresAt: new Date(response.data.data.session.expiresAt),
        };
        
        // Store session
        this.storeSession(clientSession);
        
        // Clean up session storage
        sessionStorage.removeItem('otpSessionId');
        
        console.log('OTP verified successfully');
        console.log('=== verifyOTP END ===');
        
        return { success: true };
      } else {
        return { 
          success: false, 
          message: response.data.message || 'رمز التحقق غير صحيح' 
        };
      }
    } catch (error: any) {
      console.error('Error verifying OTP:', error);

      // Handle specific API errors
      if (error.response?.status === 404) {
        return { 
          success: false, 
          message: 'انتهت صلاحية رمز التحقق. اطلب رمز جديد.' 
        };
      }

      if (error.response?.status === 401) {
        return { 
          success: false, 
          message: error.response.data.message || 'رمز التحقق غير صحيح' 
        };
      }

      if (error.response?.status === 400) {
        return { 
          success: false, 
          message: error.response.data.message || 'بيانات غير صحيحة' 
        };
      }

      return { 
        success: false, 
        message: 'حدث خطأ في التحقق. حاول مرة أخرى.' 
      };
    }
  }

  /**
   * Validate current client token
   */
  async validateClientToken(): Promise<{ success: boolean; client?: any; message?: string }> {
    try {
      const session = this.getStoredSession();
      if (!session || !session.token) {
        return { success: false, message: 'No active session' };
      }

      // Check if session is expired
      if (session.expiresAt <= new Date()) {
        this.clearSession();
        return { success: false, message: 'Session expired' };
      }

      const response = await api.post<APIResponse<ValidateTokenResponse>>(
        `${this.BASE_PATH}/validate-token`,
        {
          token: session.token
        }
      );

      if (response.data.success && response.data.data.client) {
        // Update session with latest data
        const updatedSession: ClientSession = {
          ...session,
          name: response.data.data.client.name,
        };
        this.storeSession(updatedSession);

        return { 
          success: true, 
          client: response.data.data.client 
        };
      } else {
        this.clearSession();
        return { 
          success: false, 
          message: response.data.message || 'Invalid session' 
        };
      }
    } catch (error: any) {
      console.error('Error validating client token:', error);

      // If token is invalid, clear session
      if (error.response?.status === 401) {
        this.clearSession();
        return { success: false, message: 'Session expired' };
      }

      return { 
        success: false, 
        message: 'Failed to validate session' 
      };
    }
  }

  /**
   * Logout client
   */
  async logout(): Promise<void> {
    try {
      const session = this.getStoredSession();
      if (session?.token) {
        // Call logout endpoint to invalidate token on server
        await api.post(`${this.BASE_PATH}/logout`, {
          token: session.token
        });
      }
    } catch (error) {
      console.error('Error during logout:', error);
      // Don't throw error - we still want to clear local session
    } finally {
      this.clearSession();
      // Clear all client-related caches
      this.clearAllCaches();
    }
  }

  /**
   * Get stored session
   */
  getStoredSession(): ClientSession | null {
    const savedSession = localStorage.getItem(this.SESSION_KEY);
    if (!savedSession) return null;

    try {
      const parsed = JSON.parse(savedSession);
      const session: ClientSession = {
        ...parsed,
        expiresAt: new Date(parsed.expiresAt)
      };

      // Check if session is still valid
      if (session.expiresAt > new Date()) {
        return session;
      } else {
        this.clearSession();
        return null;
      }
    } catch (error) {
      console.error('Error parsing client session:', error);
      this.clearSession();
      return null;
    }
  }

  /**
   * Check if client is authenticated
   */
  isAuthenticated(): boolean {
    const session = this.getStoredSession();
    return !!session && session.expiresAt > new Date();
  }

  /**
   * Store session in localStorage
   */
  private storeSession(session: ClientSession): void {
    try {
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    } catch (error) {
      console.error('Error storing client session:', error);
    }
  }

  /**
   * Clear session from localStorage
   */
  private clearSession(): void {
    localStorage.removeItem(this.SESSION_KEY);
    sessionStorage.removeItem('otpSessionId');
    sessionStorage.removeItem('mockOTP');
    sessionStorage.removeItem('mockPhone');
  }

  /**
   * Clear all client-related caches
   */
  private clearAllCaches(): void {
    // Clear client-specific caches
    const cacheKeys = [
      'client:profile',
      'client:appointments:all',
      'client:appointments:10',
      'client:appointments:20',
      'client:appointments:50',
      'client:invoices:all',
      'client:invoices:10',
      'client:invoices:20',
      'client:invoices:50'
    ];

    cacheKeys.forEach(key => {
      apiCache.delete(key);
    });
  }

  /**
   * Get current client ID from session
   */
  getCurrentClientId(): string | null {
    const session = this.getStoredSession();
    return session?.clientId || null;
  }

  /**
   * Get current client phone from session
   */
  getCurrentClientPhone(): string | null {
    const session = this.getStoredSession();
    return session?.phoneNumber || null;
  }

  /**
   * Get current client name from session
   */
  getCurrentClientName(): string | null {
    const session = this.getStoredSession();
    return session?.name || null;
  }

  /**
   * Refresh session by extending expiry (if supported by API)
   */
  async refreshSession(): Promise<{ success: boolean; message?: string }> {
    try {
      const session = this.getStoredSession();
      if (!session || !session.token) {
        return { success: false, message: 'No active session' };
      }

      const response = await api.post<APIResponse<{ token: string; expiresAt: string }>>(
        `${this.BASE_PATH}/refresh-token`,
        {
          token: session.token
        }
      );

      if (response.data.success && response.data.data) {
        const updatedSession: ClientSession = {
          ...session,
          token: response.data.data.token,
          expiresAt: new Date(response.data.data.expiresAt)
        };
        
        this.storeSession(updatedSession);
        return { success: true };
      } else {
        return { 
          success: false, 
          message: response.data.message || 'Failed to refresh session' 
        };
      }
    } catch (error: any) {
      console.error('Error refreshing session:', error);
      
      // If refresh fails, clear session
      if (error.response?.status === 401) {
        this.clearSession();
      }

      return { 
        success: false, 
        message: 'Failed to refresh session' 
      };
    }
  }
}

export const clientAuthAPI = new ClientAuthAPIService();