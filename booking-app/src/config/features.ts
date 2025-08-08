/**
 * Feature Flags Configuration - Booking App
 * Centralized feature flag management for gradual API migration
 */

import React from 'react';

// =========================== FEATURE FLAG DEFINITIONS ===========================

export interface BookingFeatureFlags {
  // Wave 2 API Migration Flags
  USE_EXPRESS_APPOINTMENTS: boolean;
  USE_EXPRESS_CLIENTS: boolean;
  
  // Real-time Features
  USE_WEBSOCKET: boolean;
  ENABLE_REAL_TIME_UPDATES: boolean;
  
  // Migration & Development Flags
  FORCE_EXPRESS_MODE: boolean;
  ENABLE_FALLBACK: boolean;
  DEBUG_API: boolean;
  
  // Booking App Features
  ENABLE_CLIENT_AUTH: boolean;
  ENABLE_GUEST_BOOKING: boolean;
  ENABLE_MULTI_LANGUAGE: boolean;
  ENABLE_SMS_VERIFICATION: boolean;
  ENABLE_EMAIL_VERIFICATION: boolean;
  ENABLE_SOCIAL_LOGIN: boolean;
  
  // UX Features
  ENABLE_APPOINTMENT_REMINDERS: boolean;
  ENABLE_CANCELLATION: boolean;
  ENABLE_RESCHEDULING: boolean;
  ENABLE_BOOKING_NOTES: boolean;
  ENABLE_STAFF_SELECTION: boolean;
  ENABLE_SERVICE_DESCRIPTIONS: boolean;
}

// =========================== ENVIRONMENT VARIABLE MAPPING ===========================

const getBooleanEnv = (key: string, defaultValue = false): boolean => {
  const value = process.env[key];
  return value ? value.toLowerCase() === 'true' : defaultValue;
};

const getStringEnv = (key: string, defaultValue = ''): string => {
  return process.env[key] || defaultValue;
};

const getNumberEnv = (key: string, defaultValue = 0): number => {
  const value = process.env[key];
  return value ? parseInt(value, 10) : defaultValue;
};

// =========================== FEATURE FLAGS IMPLEMENTATION ===========================

export const BOOKING_FEATURE_FLAGS: BookingFeatureFlags = {
  // Wave 2 API Migration Flags
  USE_EXPRESS_APPOINTMENTS: getBooleanEnv('REACT_APP_USE_EXPRESS_APPOINTMENTS', true),
  USE_EXPRESS_CLIENTS: getBooleanEnv('REACT_APP_USE_EXPRESS_CLIENTS', false),
  
  // Real-time Features
  USE_WEBSOCKET: getBooleanEnv('REACT_APP_USE_WEBSOCKET', false),
  ENABLE_REAL_TIME_UPDATES: getBooleanEnv('REACT_APP_ENABLE_REAL_TIME_UPDATES', false),
  
  // Migration & Development Flags
  FORCE_EXPRESS_MODE: getBooleanEnv('REACT_APP_FORCE_EXPRESS_MODE', false),
  ENABLE_FALLBACK: getBooleanEnv('REACT_APP_ENABLE_FALLBACK', true),
  DEBUG_API: getBooleanEnv('REACT_APP_DEBUG_API', process.env.NODE_ENV === 'development'),
  
  // Booking App Features
  ENABLE_CLIENT_AUTH: getBooleanEnv('REACT_APP_ENABLE_CLIENT_AUTH', true),
  ENABLE_GUEST_BOOKING: getBooleanEnv('REACT_APP_ENABLE_GUEST_BOOKING', true),
  ENABLE_MULTI_LANGUAGE: getBooleanEnv('REACT_APP_ENABLE_MULTI_LANGUAGE', true),
  ENABLE_SMS_VERIFICATION: getBooleanEnv('REACT_APP_ENABLE_SMS_VERIFICATION', false),
  ENABLE_EMAIL_VERIFICATION: getBooleanEnv('REACT_APP_ENABLE_EMAIL_VERIFICATION', true),
  ENABLE_SOCIAL_LOGIN: getBooleanEnv('REACT_APP_ENABLE_SOCIAL_LOGIN', false),
  
  // UX Features
  ENABLE_APPOINTMENT_REMINDERS: getBooleanEnv('REACT_APP_ENABLE_APPOINTMENT_REMINDERS', true),
  ENABLE_CANCELLATION: getBooleanEnv('REACT_APP_ENABLE_CANCELLATION', true),
  ENABLE_RESCHEDULING: getBooleanEnv('REACT_APP_ENABLE_RESCHEDULING', true),
  ENABLE_BOOKING_NOTES: getBooleanEnv('REACT_APP_ENABLE_BOOKING_NOTES', true),
  ENABLE_STAFF_SELECTION: getBooleanEnv('REACT_APP_ENABLE_STAFF_SELECTION', true),
  ENABLE_SERVICE_DESCRIPTIONS: getBooleanEnv('REACT_APP_ENABLE_SERVICE_DESCRIPTIONS', true),
};

// =========================== API CONFIGURATION ===========================

export const BOOKING_API_CONFIG = {
  BASE_URL: getStringEnv('REACT_APP_API_BASE_URL', 'http://localhost:3001/api/v1'),
  WS_URL: getStringEnv('REACT_APP_WS_URL', 'ws://localhost:3001'),
  TIMEOUT: getNumberEnv('REACT_APP_API_TIMEOUT', 30000),
  RETRY_ATTEMPTS: getNumberEnv('REACT_APP_API_RETRY_ATTEMPTS', 3),
  RETRY_DELAY: getNumberEnv('REACT_APP_API_RETRY_DELAY', 1000),
  LOG_LEVEL: getStringEnv('REACT_APP_LOG_LEVEL', 'info'),
  DEFAULT_LANGUAGE: getStringEnv('REACT_APP_DEFAULT_LANGUAGE', 'en'),
};

// =========================== FEATURE FLAG SERVICE ===========================

export class BookingFeatureFlagService {
  private static instance: BookingFeatureFlagService;
  private flags: BookingFeatureFlags;
  private overrides: Partial<BookingFeatureFlags> = {};

  constructor(initialFlags: BookingFeatureFlags = BOOKING_FEATURE_FLAGS) {
    this.flags = { ...initialFlags };
  }

  static getInstance(): BookingFeatureFlagService {
    if (!BookingFeatureFlagService.instance) {
      BookingFeatureFlagService.instance = new BookingFeatureFlagService();
    }
    return BookingFeatureFlagService.instance;
  }

  /**
   * Check if a feature is enabled
   */
  isEnabled(feature: keyof BookingFeatureFlags): boolean {
    return this.overrides[feature] ?? this.flags[feature];
  }

  /**
   * Enable/disable a feature at runtime
   */
  setFeature(feature: keyof BookingFeatureFlags, enabled: boolean): void {
    this.overrides[feature] = enabled;
    console.log(`Booking feature ${feature} ${enabled ? 'enabled' : 'disabled'}`);
    
    // Persist to localStorage for development
    if (process.env.NODE_ENV === 'development') {
      const key = `booking-feature-flag-${feature}`;
      localStorage.setItem(key, enabled.toString());
    }
  }

  /**
   * Reset feature to default value
   */
  resetFeature(feature: keyof BookingFeatureFlags): void {
    delete this.overrides[feature];
    console.log(`Booking feature ${feature} reset to default`);
    
    if (process.env.NODE_ENV === 'development') {
      const key = `booking-feature-flag-${feature}`;
      localStorage.removeItem(key);
    }
  }

  /**
   * Get all current flag values
   */
  getAllFlags(): BookingFeatureFlags {
    return { ...this.flags, ...this.overrides };
  }

  /**
   * Load overrides from localStorage (development only)
   */
  loadOverrides(): void {
    if (process.env.NODE_ENV !== 'development') return;

    Object.keys(this.flags).forEach(feature => {
      const key = `booking-feature-flag-${feature}`;
      const value = localStorage.getItem(key);
      if (value !== null) {
        this.overrides[feature as keyof BookingFeatureFlags] = value === 'true';
      }
    });
  }

  /**
   * Check if appointment booking is using Express API
   */
  isAppointmentApiMigrated(): boolean {
    return this.isEnabled('USE_EXPRESS_APPOINTMENTS');
  }

  /**
   * Check if real-time features are enabled
   */
  isRealTimeEnabled(): boolean {
    return this.isEnabled('USE_WEBSOCKET') && this.isEnabled('ENABLE_REAL_TIME_UPDATES');
  }

  /**
   * Get booking flow configuration
   */
  getBookingFlowConfig() {
    return {
      clientAuth: this.isEnabled('ENABLE_CLIENT_AUTH'),
      guestBooking: this.isEnabled('ENABLE_GUEST_BOOKING'),
      staffSelection: this.isEnabled('ENABLE_STAFF_SELECTION'),
      bookingNotes: this.isEnabled('ENABLE_BOOKING_NOTES'),
      cancellation: this.isEnabled('ENABLE_CANCELLATION'),
      rescheduling: this.isEnabled('ENABLE_RESCHEDULING'),
      serviceDescriptions: this.isEnabled('ENABLE_SERVICE_DESCRIPTIONS'),
    };
  }

  /**
   * Get authentication configuration
   */
  getAuthConfig() {
    return {
      enableClientAuth: this.isEnabled('ENABLE_CLIENT_AUTH'),
      enableSmsVerification: this.isEnabled('ENABLE_SMS_VERIFICATION'),
      enableEmailVerification: this.isEnabled('ENABLE_EMAIL_VERIFICATION'),
      enableSocialLogin: this.isEnabled('ENABLE_SOCIAL_LOGIN'),
    };
  }
}

// =========================== CONVENIENCE FUNCTIONS ===========================

export const bookingFeatureFlags = BookingFeatureFlagService.getInstance();

// Load any development overrides
bookingFeatureFlags.loadOverrides();

/**
 * Check if a booking feature is enabled
 */
export const isBookingFeatureEnabled = (feature: keyof BookingFeatureFlags): boolean => {
  return bookingFeatureFlags.isEnabled(feature);
};

/**
 * Component wrapper for booking feature-gated content
 */
export const BookingFeatureGate: React.FC<{
  feature: keyof BookingFeatureFlags;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}> = ({ feature, children, fallback = null }) => {
  return isBookingFeatureEnabled(feature) ? <>{children}</> : <>{fallback}</>;
};

/**
 * Hook for booking feature flag values
 */
export const useBookingFeatureFlag = (feature: keyof BookingFeatureFlags) => {
  const [enabled, setEnabled] = React.useState(bookingFeatureFlags.isEnabled(feature));

  React.useEffect(() => {
    setEnabled(bookingFeatureFlags.isEnabled(feature));
  }, [feature]);

  return enabled;
};

// =========================== DEVELOPMENT HELPERS ===========================

/**
 * Development-only booking feature flag debugger
 */
export const BookingFeatureFlagDebugger: React.FC = () => {
  if (process.env.NODE_ENV !== 'development') return null;

  const [flags, setFlags] = React.useState(bookingFeatureFlags.getAllFlags());

  const handleToggle = (feature: keyof BookingFeatureFlags) => {
    const newValue = !flags[feature];
    bookingFeatureFlags.setFeature(feature, newValue);
    setFlags({ ...flags, [feature]: newValue });
  };

  const handleReset = (feature: keyof BookingFeatureFlags) => {
    bookingFeatureFlags.resetFeature(feature);
    setFlags(bookingFeatureFlags.getAllFlags());
  };

  return (
    <div style={{ 
      position: 'fixed', 
      top: 10, 
      left: 10, 
      background: 'white', 
      border: '1px solid #ccc',
      padding: '10px',
      borderRadius: '4px',
      fontSize: '12px',
      maxHeight: '400px',
      overflowY: 'auto',
      zIndex: 9999,
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    }}>
      <h4>Booking Features (Dev)</h4>
      {Object.entries(flags).map(([feature, enabled]) => (
        <div key={feature} style={{ marginBottom: '4px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={() => handleToggle(feature as keyof BookingFeatureFlags)}
            />
            <span style={{ fontSize: '10px' }}>{feature}</span>
            <button 
              onClick={() => handleReset(feature as keyof BookingFeatureFlags)}
              style={{ fontSize: '8px', padding: '1px 3px' }}
            >
              Reset
            </button>
          </label>
        </div>
      ))}
    </div>
  );
};

// =========================== EXPORTS ===========================

export default {
  BOOKING_FEATURE_FLAGS,
  BOOKING_API_CONFIG,
  bookingFeatureFlags,
  isBookingFeatureEnabled,
  BookingFeatureFlagService,
  BookingFeatureGate,
  BookingFeatureFlagDebugger,
};