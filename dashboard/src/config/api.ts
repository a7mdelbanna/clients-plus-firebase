import axios, { AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { toast } from 'react-toastify';

// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Token storage keys
export const TOKEN_STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  TOKEN_EXPIRY: 'token_expiry',
  REMEMBER_ME: 'remember_me'
};

// Token utilities
export const tokenUtils = {
  getAccessToken: (): string | null => {
    return localStorage.getItem(TOKEN_STORAGE_KEYS.ACCESS_TOKEN);
  },

  getRefreshToken: (): string | null => {
    return localStorage.getItem(TOKEN_STORAGE_KEYS.REFRESH_TOKEN);
  },

  getTokenExpiry: (): number | null => {
    const expiry = localStorage.getItem(TOKEN_STORAGE_KEYS.TOKEN_EXPIRY);
    return expiry ? parseInt(expiry, 10) : null;
  },

  getRememberMe: (): boolean => {
    return localStorage.getItem(TOKEN_STORAGE_KEYS.REMEMBER_ME) === 'true';
  },

  setTokens: (accessToken: string, refreshToken: string, expiresIn: number, rememberMe: boolean = false) => {
    const storage = rememberMe ? localStorage : sessionStorage;
    
    storage.setItem(TOKEN_STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    storage.setItem(TOKEN_STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    storage.setItem(TOKEN_STORAGE_KEYS.TOKEN_EXPIRY, (Date.now() + expiresIn * 1000).toString());
    localStorage.setItem(TOKEN_STORAGE_KEYS.REMEMBER_ME, rememberMe.toString());

    // If not remember me, also store in localStorage for token refresh
    if (!rememberMe) {
      localStorage.setItem(TOKEN_STORAGE_KEYS.ACCESS_TOKEN, accessToken);
      localStorage.setItem(TOKEN_STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
      localStorage.setItem(TOKEN_STORAGE_KEYS.TOKEN_EXPIRY, (Date.now() + expiresIn * 1000).toString());
    }
  },

  clearTokens: () => {
    // Clear from both localStorage and sessionStorage
    Object.values(TOKEN_STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
  },

  isTokenExpired: (): boolean => {
    const expiry = tokenUtils.getTokenExpiry();
    if (!expiry) return true;
    
    // Check if token expires in the next 5 minutes
    return Date.now() > (expiry - 5 * 60 * 1000);
  },

  isTokenValid: (): boolean => {
    const token = tokenUtils.getAccessToken();
    return token !== null && !tokenUtils.isTokenExpired();
  }
};

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = tokenUtils.getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for token refresh and error handling
let isRefreshing = false;
let failedQueue: Array<{ resolve: Function; reject: Function }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 Unauthorized
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // If we're already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          return apiClient(originalRequest);
        }).catch((err) => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = tokenUtils.getRefreshToken();
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken
        });

        const { accessToken, refreshToken: newRefreshToken, expiresIn } = response.data;
        const rememberMe = tokenUtils.getRememberMe();
        
        tokenUtils.setTokens(accessToken, newRefreshToken, expiresIn, rememberMe);
        
        // Update the original request with new token
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        }

        processQueue(null, accessToken);
        
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        
        // Clear tokens and redirect to login
        tokenUtils.clearTokens();
        
        // Dispatch custom event for auth context to handle
        window.dispatchEvent(new CustomEvent('auth:token-expired'));
        
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Handle other errors
    if (error.response?.status === 403) {
      toast.error('ليس لديك صلاحية للوصول إلى هذا المورد');
    } else if (error.response?.status >= 500) {
      toast.error('خطأ في الخادم. يرجى المحاولة لاحقاً');
    } else if (error.code === 'ECONNABORTED') {
      toast.error('انتهت مهلة الاتصال. يرجى المحاولة مرة أخرى');
    } else if (!error.response) {
      toast.error('خطأ في الاتصال بالشبكة');
    }

    return Promise.reject(error);
  }
);

export default apiClient;

// Auth API endpoints
export const authAPI = {
  login: (credentials: { email: string; password: string; rememberMe?: boolean }) =>
    apiClient.post('/auth/login', credentials),
    
  register: (userData: { 
    email: string; 
    password: string; 
    displayName: string;
    firstName?: string;
    lastName?: string;
  }) =>
    apiClient.post('/auth/register', userData),
    
  logout: () =>
    apiClient.post('/auth/logout', { refreshToken: tokenUtils.getRefreshToken() }),
    
  refreshToken: (refreshToken: string) =>
    apiClient.post('/auth/refresh', { refreshToken }),
    
  forgotPassword: (email: string) =>
    apiClient.post('/auth/forgot-password', { email }),
    
  resetPassword: (token: string, newPassword: string) =>
    apiClient.post('/auth/reset-password', { token, password: newPassword }),
    
  verifyEmail: (token: string) =>
    apiClient.post('/auth/verify-email', { token }),
    
  resendVerification: (email: string) =>
    apiClient.post('/auth/resend-verification', { email }),
    
  me: () =>
    apiClient.get('/auth/me'),
    
  updateProfile: (profileData: any) =>
    apiClient.put('/auth/profile', profileData),
    
  changePassword: (currentPassword: string, newPassword: string) =>
    apiClient.put('/auth/change-password', { currentPassword, newPassword })
};