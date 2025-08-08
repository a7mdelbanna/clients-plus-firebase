/**
 * API Services Index
 * Central export point for all API services
 */

// Core API services
export { api, apiCache, requestQueue, getConnectionStatus } from './config';
export { clientAPI } from './client.api';
export { clientAuthAPI } from './auth.api';
export { appointmentAPI } from './appointment.api';
export { bookingAPI } from './booking.api';

// Adapters for Firebase compatibility
export {
  clientServiceAdapter,
  appointmentServiceAdapter,
  bookingServiceAdapter,
  clientAuthAdapter,
  USE_API,
  getServiceType,
  shouldUseAPIForComponent,
  clearAllCaches
} from './adapters';

// Mobile optimization utilities
export { mobileOptimization } from './mobile';

// Types
export type { Appointment, TimeSlot } from './appointment.api';