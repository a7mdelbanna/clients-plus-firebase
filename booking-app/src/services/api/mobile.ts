/**
 * Mobile Optimization Features
 * Handles offline support, retry logic, caching, and mobile-specific optimizations
 */

import { api, apiCache, requestQueue, getConnectionStatus } from './config';

// Network quality detection
interface NetworkInfo {
  effectiveType: '2g' | '3g' | '4g' | 'slow-2g';
  downlink: number;
  rtt: number;
}

// Connection quality levels
type ConnectionQuality = 'poor' | 'good' | 'excellent';

class MobileOptimization {
  private networkInfo: NetworkInfo | null = null;
  private connectionQuality: ConnectionQuality = 'good';
  private isLowDataMode = false;

  constructor() {
    this.initializeNetworkDetection();
    this.setupLowDataModeDetection();
    this.setupPerformanceMonitoring();
  }

  /**
   * Initialize network quality detection
   */
  private initializeNetworkDetection(): void {
    // @ts-ignore - NetworkInformation is experimental
    if ('connection' in navigator && navigator.connection) {
      // @ts-ignore
      const connection = navigator.connection;
      
      this.networkInfo = {
        effectiveType: connection.effectiveType || '4g',
        downlink: connection.downlink || 10,
        rtt: connection.rtt || 100
      };

      this.updateConnectionQuality();

      // Listen for network changes
      connection.addEventListener('change', () => {
        this.networkInfo = {
          effectiveType: connection.effectiveType || '4g',
          downlink: connection.downlink || 10,
          rtt: connection.rtt || 100
        };
        this.updateConnectionQuality();
        console.log('Network changed:', this.networkInfo, 'Quality:', this.connectionQuality);
      });
    }
  }

  /**
   * Update connection quality based on network info
   */
  private updateConnectionQuality(): void {
    if (!this.networkInfo) {
      this.connectionQuality = 'good';
      return;
    }

    const { effectiveType, downlink, rtt } = this.networkInfo;

    if (effectiveType === 'slow-2g' || effectiveType === '2g' || downlink < 0.5 || rtt > 2000) {
      this.connectionQuality = 'poor';
    } else if (effectiveType === '4g' && downlink > 10 && rtt < 100) {
      this.connectionQuality = 'excellent';
    } else {
      this.connectionQuality = 'good';
    }
  }

  /**
   * Setup low data mode detection
   */
  private setupLowDataModeDetection(): void {
    // Check if user prefers reduced data usage
    // @ts-ignore - saveData is experimental
    if ('connection' in navigator && navigator.connection && navigator.connection.saveData) {
      this.isLowDataMode = true;
      console.log('Low data mode detected');
    }

    // Also check for battery saver mode
    // @ts-ignore - getBattery is experimental
    if ('getBattery' in navigator) {
      // @ts-ignore
      navigator.getBattery().then((battery: any) => {
        if (battery.level < 0.2) {
          this.isLowDataMode = true;
          console.log('Low battery detected, enabling data saving mode');
        }
      });
    }
  }

  /**
   * Setup performance monitoring
   */
  private setupPerformanceMonitoring(): void {
    // Monitor API response times
    let responseTimeSum = 0;
    let responseCount = 0;

    api.interceptors.response.use(
      (response) => {
        const config = response.config as any;
        if (config.metadata && config.metadata.startTime) {
          const responseTime = Date.now() - config.metadata.startTime;
          responseTimeSum += responseTime;
          responseCount++;
          
          const avgResponseTime = responseTimeSum / responseCount;
          
          // Adjust caching strategy based on response times
          if (avgResponseTime > 3000) { // > 3 seconds
            this.enableAggressiveCaching();
          }
          
          console.log(`API Response Time: ${responseTime}ms, Average: ${avgResponseTime.toFixed(0)}ms`);
        }
        return response;
      },
      (error) => error
    );

    // Add start time to requests
    api.interceptors.request.use((config) => {
      config.metadata = { startTime: Date.now() };
      return config;
    });
  }

  /**
   * Enable aggressive caching for slow connections
   */
  private enableAggressiveCaching(): void {
    console.log('Enabling aggressive caching due to slow connection');
    // This could modify cache TTL values or enable additional caching strategies
  }

  /**
   * Get optimized request configuration based on network conditions
   */
  getOptimizedRequestConfig(baseConfig: any = {}): any {
    const config = { ...baseConfig };

    switch (this.connectionQuality) {
      case 'poor':
        config.timeout = 45000; // 45 seconds for poor connections
        config.headers = {
          ...config.headers,
          'Accept-Encoding': 'gzip, deflate, br', // Ensure compression
          'X-Network-Quality': 'poor'
        };
        break;

      case 'good':
        config.timeout = 30000; // 30 seconds for good connections
        config.headers = {
          ...config.headers,
          'X-Network-Quality': 'good'
        };
        break;

      case 'excellent':
        config.timeout = 15000; // 15 seconds for excellent connections
        config.headers = {
          ...config.headers,
          'X-Network-Quality': 'excellent'
        };
        break;
    }

    // Low data mode adjustments
    if (this.isLowDataMode) {
      config.headers = {
        ...config.headers,
        'X-Low-Data-Mode': 'true'
      };
    }

    return config;
  }

  /**
   * Preload critical data when network is good
   */
  async preloadCriticalData(companyId?: string, branchId?: string): Promise<void> {
    if (this.connectionQuality === 'poor' || this.isLowDataMode) {
      console.log('Skipping preload due to poor connection or low data mode');
      return;
    }

    if (!navigator.onLine) {
      console.log('Offline, skipping preload');
      return;
    }

    try {
      console.log('Preloading critical data...');

      const preloadPromises: Promise<any>[] = [];

      // Preload commonly accessed data
      if (companyId && branchId) {
        // Preload services
        preloadPromises.push(
          import('./booking.api').then(({ bookingAPI }) => 
            bookingAPI.getServicesForBooking(companyId, branchId)
          ).catch(console.error)
        );

        // Preload staff
        preloadPromises.push(
          import('./booking.api').then(({ bookingAPI }) => 
            bookingAPI.getStaffForBooking(companyId, branchId)
          ).catch(console.error)
        );
      }

      // Preload client profile if authenticated
      const clientSession = localStorage.getItem('clientPortalSession');
      if (clientSession) {
        preloadPromises.push(
          import('./client.api').then(({ clientAPI }) => 
            clientAPI.getClientProfile()
          ).catch(console.error)
        );

        preloadPromises.push(
          import('./client.api').then(({ clientAPI }) => 
            clientAPI.getClientAppointments(10)
          ).catch(console.error)
        );
      }

      await Promise.allSettled(preloadPromises);
      console.log('Critical data preload completed');
    } catch (error) {
      console.error('Error preloading critical data:', error);
    }
  }

  /**
   * Optimize image loading for mobile
   */
  getOptimizedImageUrl(originalUrl: string, maxWidth: number = 400): string {
    if (!originalUrl) return originalUrl;

    // For poor connections, request smaller images
    if (this.connectionQuality === 'poor') {
      maxWidth = Math.min(maxWidth, 200);
    }

    // If the API supports image optimization, add query parameters
    if (originalUrl.includes('/api/')) {
      const separator = originalUrl.includes('?') ? '&' : '?';
      return `${originalUrl}${separator}w=${maxWidth}&q=${this.isLowDataMode ? 60 : 80}`;
    }

    return originalUrl;
  }

  /**
   * Check if we should fetch data or use cache
   */
  shouldFetchData(cacheKey: string, isUserInitiated: boolean = false): boolean {
    // Always fetch for user-initiated actions
    if (isUserInitiated) return true;

    // Check if we have cached data
    const cachedData = apiCache.get(cacheKey);
    if (!cachedData) return true;

    // For poor connections, prefer cache
    if (this.connectionQuality === 'poor') return false;

    // For good/excellent connections, fetch fresh data
    return true;
  }

  /**
   * Get cache TTL based on connection quality and data type
   */
  getCacheTTL(dataType: 'profile' | 'appointments' | 'services' | 'staff' | 'timeslots'): number {
    const baseTTLs = {
      profile: 600000,    // 10 minutes
      appointments: 300000, // 5 minutes
      services: 900000,    // 15 minutes
      staff: 600000,       // 10 minutes
      timeslots: 180000    // 3 minutes
    };

    const baseTTL = baseTTLs[dataType];

    // Extend TTL for poor connections
    if (this.connectionQuality === 'poor') {
      return baseTTL * 3; // 3x longer cache
    }

    // Shorter TTL for excellent connections (fresher data)
    if (this.connectionQuality === 'excellent') {
      return baseTTL * 0.5; // Half the cache time
    }

    return baseTTL;
  }

  /**
   * Sync queued requests when back online
   */
  async syncWhenOnline(): Promise<void> {
    if (!navigator.onLine) return;

    const status = getConnectionStatus();
    if (status.queuedRequests === 0) return;

    console.log(`Syncing ${status.queuedRequests} queued requests...`);
    
    // The request queue will automatically process when back online
    // We can add additional sync logic here if needed
    
    // Wait a bit for the queue to process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const newStatus = getConnectionStatus();
    console.log(`Sync completed. Remaining queued requests: ${newStatus.queuedRequests}`);
  }

  /**
   * Enable/disable features based on connection quality
   */
  getFeatureFlags(): {
    enableRealTimeUpdates: boolean;
    enableImagePreload: boolean;
    enableBackgroundSync: boolean;
    enableAdvancedCaching: boolean;
    maxConcurrentRequests: number;
  } {
    switch (this.connectionQuality) {
      case 'poor':
        return {
          enableRealTimeUpdates: false,
          enableImagePreload: false,
          enableBackgroundSync: false,
          enableAdvancedCaching: true,
          maxConcurrentRequests: 1
        };

      case 'good':
        return {
          enableRealTimeUpdates: false,
          enableImagePreload: true,
          enableBackgroundSync: true,
          enableAdvancedCaching: true,
          maxConcurrentRequests: 3
        };

      case 'excellent':
        return {
          enableRealTimeUpdates: true,
          enableImagePreload: true,
          enableBackgroundSync: true,
          enableAdvancedCaching: false,
          maxConcurrentRequests: 5
        };

      default:
        return {
          enableRealTimeUpdates: false,
          enableImagePreload: true,
          enableBackgroundSync: true,
          enableAdvancedCaching: true,
          maxConcurrentRequests: 3
        };
    }
  }

  // Getters for component use
  get isOnline(): boolean {
    return navigator.onLine;
  }

  get currentConnectionQuality(): ConnectionQuality {
    return this.connectionQuality;
  }

  get isInLowDataMode(): boolean {
    return this.isLowDataMode;
  }

  get networkInformation(): NetworkInfo | null {
    return this.networkInfo;
  }

  get queuedRequestsCount(): number {
    return getConnectionStatus().queuedRequests;
  }
}

// Export singleton instance
export const mobileOptimization = new MobileOptimization();

// Export utility functions
export const isSlowConnection = (): boolean => {
  return mobileOptimization.currentConnectionQuality === 'poor';
};

export const shouldReduceDataUsage = (): boolean => {
  return mobileOptimization.isInLowDataMode || isSlowConnection();
};

export const getOptimalImageSize = (baseSize: number): number => {
  if (shouldReduceDataUsage()) {
    return Math.min(baseSize, 200);
  }
  if (mobileOptimization.currentConnectionQuality === 'excellent') {
    return baseSize;
  }
  return Math.min(baseSize, 400);
};