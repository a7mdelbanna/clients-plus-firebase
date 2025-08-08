import axios, { AxiosInstance, AxiosError, AxiosResponse } from 'axios';

// Base API configuration
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1',
  TIMEOUT: 30000, // 30 seconds for mobile networks
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second base delay
};

// Request queue for offline support
interface QueuedRequest {
  id: string;
  config: any;
  timestamp: number;
  priority: 'high' | 'medium' | 'low';
}

class APIRequestQueue {
  private queue: QueuedRequest[] = [];
  private isOnline = navigator.onLine;

  constructor() {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processQueue();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  add(config: any, priority: 'high' | 'medium' | 'low' = 'medium'): void {
    if (this.isOnline) return;
    
    const request: QueuedRequest = {
      id: Date.now().toString(),
      config,
      timestamp: Date.now(),
      priority,
    };
    
    this.queue.push(request);
    // Sort by priority and timestamp
    this.queue.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      return a.timestamp - b.timestamp;
    });
  }

  private async processQueue(): Promise<void> {
    if (!this.isOnline || this.queue.length === 0) return;

    const requests = [...this.queue];
    this.queue = [];

    for (const request of requests) {
      try {
        await axios(request.config);
        console.log('Queued request processed successfully:', request.id);
      } catch (error) {
        console.error('Failed to process queued request:', request.id, error);
        // Re-queue if still relevant (less than 1 hour old)
        if (Date.now() - request.timestamp < 3600000) {
          this.queue.push(request);
        }
      }
    }
  }

  get queueSize(): number {
    return this.queue.length;
  }
}

// Create request queue instance
const requestQueue = new APIRequestQueue();

// Create axios instance with client-specific configuration
const createAPIInstance = (): AxiosInstance => {
  const instance = axios.create({
    baseURL: API_CONFIG.BASE_URL,
    timeout: API_CONFIG.TIMEOUT,
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Type': 'booking-app',
      'X-Platform': 'web',
    },
  });

  // Request interceptor
  instance.interceptors.request.use(
    (config) => {
      // Add client JWT token if available
      const clientSession = localStorage.getItem('clientPortalSession');
      if (clientSession) {
        try {
          const session = JSON.parse(clientSession);
          if (session.token && new Date(session.expiresAt) > new Date()) {
            config.headers.Authorization = `Bearer ${session.token}`;
            config.headers['X-Client-ID'] = session.clientId;
          }
        } catch (error) {
          console.error('Error parsing client session:', error);
          localStorage.removeItem('clientPortalSession');
        }
      }

      // Add to offline queue if offline
      if (!navigator.onLine) {
        requestQueue.add(config, 'medium');
        throw new axios.Cancel('Request queued for offline processing');
      }

      console.log('API Request:', config.method?.toUpperCase(), config.url);
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor with retry logic
  instance.interceptors.response.use(
    (response: AxiosResponse) => {
      console.log('API Response:', response.status, response.config.url);
      return response;
    },
    async (error: AxiosError) => {
      const config = error.config as any;
      
      // Don't retry if request was cancelled or if we've already retried too many times
      if (!config || axios.isCancel(error) || config._retryCount >= API_CONFIG.RETRY_ATTEMPTS) {
        return Promise.reject(error);
      }

      // Initialize retry count
      config._retryCount = config._retryCount || 0;

      // Determine if we should retry
      const shouldRetry = 
        // Network errors
        error.code === 'ECONNABORTED' ||
        error.code === 'NETWORK_ERROR' ||
        !error.response ||
        // Server errors (5xx)
        (error.response.status >= 500 && error.response.status <= 599) ||
        // Rate limiting
        error.response.status === 429;

      if (shouldRetry) {
        config._retryCount++;
        
        // Exponential backoff with jitter
        const delay = API_CONFIG.RETRY_DELAY * Math.pow(2, config._retryCount - 1) + 
                     Math.random() * 1000;
        
        console.log(`Retrying request (${config._retryCount}/${API_CONFIG.RETRY_ATTEMPTS}) after ${delay}ms`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return instance(config);
      }

      // Handle client authentication errors
      if (error.response?.status === 401) {
        // Clear invalid session
        localStorage.removeItem('clientPortalSession');
        
        // Don't redirect in booking app, just clear session
        console.log('Client session expired, cleared local storage');
      }

      console.error('API Error:', {
        status: error.response?.status,
        url: error.config?.url,
        method: error.config?.method,
        message: error.message,
      });

      return Promise.reject(error);
    }
  );

  return instance;
};

// Create the main API instance
export const api = createAPIInstance();

// Helper functions for error handling
export const isNetworkError = (error: any): boolean => {
  return !error.response && (error.code === 'NETWORK_ERROR' || error.code === 'ECONNABORTED');
};

export const isServerError = (error: any): boolean => {
  return error.response && error.response.status >= 500;
};

export const isClientError = (error: any): boolean => {
  return error.response && error.response.status >= 400 && error.response.status < 500;
};

// Cache utilities for mobile optimization
class APICache {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  set(key: string, data: any, ttl: number = 300000): void { // Default 5 minutes
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;

    // Check if expired
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  clear(): void {
    this.cache.clear();
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  // Clean expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

export const apiCache = new APICache();

// Auto-cleanup cache every 5 minutes
setInterval(() => {
  apiCache.cleanup();
}, 300000);

// Export request queue for monitoring
export { requestQueue };

// Connection status utilities
export const getConnectionStatus = () => ({
  isOnline: navigator.onLine,
  queuedRequests: requestQueue.queueSize,
});

// Helper to check if we should use cache
export const shouldUseCache = (key: string): boolean => {
  return !navigator.onLine && apiCache.get(key) !== null;
};