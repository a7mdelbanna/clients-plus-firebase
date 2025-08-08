# API Service Layer for Booking Application

This directory contains a comprehensive API service layer designed to replace Firebase with Express API endpoints while maintaining full backward compatibility.

## Overview

The API service layer provides:
- **Seamless Migration**: Drop-in replacement for Firebase services
- **Mobile Optimization**: Offline support, retry logic, and caching
- **Client Authentication**: Phone OTP-based authentication system
- **Connection Monitoring**: Adaptive behavior based on network conditions
- **Request Queuing**: Automatic retry of failed requests when back online

## Architecture

```
src/services/api/
├── config.ts           # Axios configuration and interceptors
├── auth.api.ts         # Client authentication (OTP)
├── client.api.ts       # Client profile management
├── appointment.api.ts  # Appointment operations
├── booking.api.ts      # Booking flow management
├── adapters.ts         # Firebase compatibility layer
├── mobile.ts           # Mobile optimization features
└── index.ts           # Main exports
```

## Environment Configuration

Add these environment variables to your `.env` file:

```bash
# API Configuration
VITE_API_BASE_URL=http://localhost:3000/api/v1
VITE_USE_API=true

# Optional: Mobile optimization
VITE_ENABLE_OFFLINE_MODE=true
VITE_CACHE_TTL_MINUTES=10
```

## Quick Start

### 1. Enable API Mode

Set `VITE_USE_API=true` in your environment file to use the API instead of Firebase.

### 2. Update Component Imports

Replace Firebase service imports with adapter imports:

```typescript
// Before (Firebase)
import { clientService } from '../services/client.service';
import { appointmentService } from '../services/appointment.service';

// After (API with Firebase compatibility)
import { clientServiceAdapter, appointmentServiceAdapter } from '../services/api';
```

### 3. Authentication Context Update

Update your ClientAuthContext to use the API:

```typescript
import { clientAuthAPI } from '../services/api';

// In your context
const login = async (phoneNumber: string) => {
  return await clientAuthAPI.sendOTP(phoneNumber);
};

const verifyOTP = async (otp: string, phoneNumber: string, companyId?: string) => {
  return await clientAuthAPI.verifyOTP(otp, phoneNumber, companyId);
};
```

## Core Services

### Authentication Service

```typescript
import { clientAuthAPI } from '@/services/api';

// Send OTP
const result = await clientAuthAPI.sendOTP('+201234567890');

// Verify OTP
const verification = await clientAuthAPI.verifyOTP('123456', '+201234567890');

// Check authentication status
const isAuth = clientAuthAPI.isAuthenticated();

// Get current session
const session = clientAuthAPI.getStoredSession();

// Logout
await clientAuthAPI.logout();
```

### Client Service

```typescript
import { clientAPI } from '@/services/api';

// Get client profile (uses JWT token)
const profile = await clientAPI.getClientProfile();

// Update client profile
await clientAPI.updateClientProfile({
  firstName: 'أحمد',
  lastName: 'محمد',
  phone: '01234567890'
});

// Get client appointments
const appointments = await clientAPI.getClientAppointments(10);

// Get client invoices
const invoices = await clientAPI.getClientInvoices(5);
```

### Appointment Service

```typescript
import { appointmentAPI } from '@/services/api';

// Cancel appointment
await appointmentAPI.cancelAppointment(appointmentId, clientId, 'Changed my mind');

// Reschedule appointment
await appointmentAPI.rescheduleAppointment(
  appointmentId, 
  clientId, 
  newDate, 
  newStartTime, 
  newEndTime
);

// Check time slot availability
const isAvailable = await appointmentAPI.checkTimeSlotAvailability(
  companyId, 
  staffId, 
  date, 
  startTime, 
  duration
);

// Get available time slots
const slots = await appointmentAPI.getAvailableTimeSlots(
  companyId, 
  staffId, 
  date, 
  duration
);
```

### Booking Service

```typescript
import { bookingAPI } from '@/services/api';

// Get booking link
const bookingLink = await bookingAPI.getPublicBookingLink('company-slug', 'link-slug');

// Get branches
const branches = await bookingAPI.getBranchesForBooking(companyId, branchIds);

// Get services
const services = await bookingAPI.getServicesForBooking(companyId, branchId);

// Get staff
const staff = await bookingAPI.getStaffForBooking(companyId, branchId, serviceId);

// Create appointment
const appointmentId = await bookingAPI.createAppointment(appointmentData);
```

## Mobile Optimization

### Network Quality Detection

```typescript
import { mobileOptimization } from '@/services/api';

// Get current connection quality
const quality = mobileOptimization.currentConnectionQuality; // 'poor' | 'good' | 'excellent'

// Check if in low data mode
const isLowData = mobileOptimization.isInLowDataMode;

// Get feature flags based on connection
const features = mobileOptimization.getFeatureFlags();
```

### Offline Support

```typescript
import { getConnectionStatus, mobileOptimization } from '@/services/api';

// Check connection status
const status = getConnectionStatus();
console.log(`Online: ${status.isOnline}, Queued: ${status.queuedRequests}`);

// Sync when back online
await mobileOptimization.syncWhenOnline();

// Preload critical data
await mobileOptimization.preloadCriticalData(companyId, branchId);
```

### Caching

```typescript
import { apiCache } from '@/services/api';

// Manual cache management
apiCache.set('key', data, 300000); // Cache for 5 minutes
const cachedData = apiCache.get('key');
apiCache.delete('key');
apiCache.clear();
```

## Adapter Pattern for Gradual Migration

The adapter services provide the same interface as Firebase services, enabling gradual migration:

```typescript
import { 
  clientServiceAdapter, 
  appointmentServiceAdapter, 
  bookingServiceAdapter 
} from '@/services/api/adapters';

// These work exactly like Firebase services
const client = await clientServiceAdapter.getClient(clientId);
await appointmentServiceAdapter.cancelAppointment(appointmentId, clientId);
const bookingLink = await bookingServiceAdapter.getPublicBookingLink(companySlug, linkSlug);
```

## Error Handling

The API services include comprehensive error handling:

```typescript
try {
  await clientAPI.getClientProfile();
} catch (error) {
  if (error.response?.status === 401) {
    // Handle authentication error
  } else if (error.response?.status === 404) {
    // Handle not found error
  } else {
    // Handle network or other errors
  }
}
```

## Testing

### Mock Mode (Development)

For development without an API server:

```typescript
// The services automatically use mock responses in development mode
// OTP is always '123456' in mock mode
```

### API Testing

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# The app will use API endpoints if VITE_USE_API=true
```

## Performance Considerations

### Connection Quality Adaptations

- **Poor Connection**: Longer timeouts, aggressive caching, reduced concurrent requests
- **Good Connection**: Balanced timeouts, moderate caching, background preloading
- **Excellent Connection**: Short timeouts, real-time updates, maximum concurrent requests

### Caching Strategy

- **Profile Data**: 10-minute cache
- **Appointments**: 5-minute cache  
- **Services/Staff**: 15-minute cache
- **Time Slots**: 3-minute cache (frequently changing)

### Request Optimization

- Automatic request deduplication
- Exponential backoff retry logic
- Request prioritization (high/medium/low)
- Compression headers for all requests

## Migration Checklist

- [ ] Set `VITE_USE_API=true` in environment
- [ ] Update authentication context to use `clientAuthAPI`
- [ ] Replace service imports with adapter imports
- [ ] Test critical user flows
- [ ] Monitor error rates and performance
- [ ] Implement proper error boundaries
- [ ] Add loading states for poor connections
- [ ] Test offline functionality

## API Endpoints Expected

The services expect these API endpoints:

### Authentication
- `POST /auth/client/send-otp`
- `POST /auth/client/verify-otp`
- `POST /auth/client/validate-token`
- `POST /auth/client/refresh-token`
- `POST /auth/client/logout`

### Clients
- `GET /clients/profile`
- `PATCH /clients/profile`
- `GET /clients/appointments`
- `GET /clients/invoices`
- `PATCH /clients/appointments/{id}/cancel`
- `PATCH /clients/appointments/{id}/reschedule`

### Appointments
- `GET /appointments/client`
- `GET /appointments/by-phone`
- `PATCH /appointments/{id}/cancel`
- `PATCH /appointments/{id}/reschedule`
- `POST /appointments/check-availability`
- `POST /appointments/available-slots`

### Booking
- `GET /booking/link/{companySlug}/{linkSlug}`
- `POST /booking/track-view/{linkId}`
- `GET /booking/branches`
- `GET /booking/services`
- `GET /booking/staff`
- `POST /booking/time-slots`
- `POST /booking/client`
- `POST /booking/appointment`

## Troubleshooting

### Common Issues

1. **Network Errors**: Check internet connection and API server status
2. **Authentication Errors**: Verify JWT token is valid and not expired
3. **Cache Issues**: Clear browser cache or use `apiCache.clear()`
4. **Mobile Issues**: Check network quality detection and mobile optimizations

### Debug Mode

Enable debug logging:

```typescript
// Add to your app initialization
if (import.meta.env.DEV) {
  localStorage.setItem('debug', 'api:*');
}
```

### Monitoring

Monitor API health:

```typescript
import { getConnectionStatus, mobileOptimization } from '@/services/api';

setInterval(() => {
  const status = getConnectionStatus();
  const quality = mobileOptimization.currentConnectionQuality;
  
  console.log('API Status:', {
    online: status.isOnline,
    queued: status.queuedRequests,
    quality: quality
  });
}, 30000); // Every 30 seconds
```