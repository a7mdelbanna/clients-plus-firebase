# Migration Example: ClientAppointmentsList Component

This example shows how to migrate the `ClientAppointmentsList` component from Firebase to the API service layer.

## Before (Firebase)

```typescript
import { appointmentService, type Appointment } from '../services/appointment.service';

const loadAppointments = async () => {
  try {
    setLoading(true);
    setError(null);

    let appointmentList: Appointment[] = [];
    
    if (session?.clientId && session.clientId !== 'mock-client-123') {
      // Real client - get appointments by client ID
      appointmentList = await appointmentService.getClientAppointments(
        bookingData.linkData.companyId,
        session.clientId,
        20 // Limit to recent 20 appointments
      );
    } else {
      // Mock client or phone-based lookup - get appointments by phone
      appointmentList = await appointmentService.getClientAppointmentsByPhone(
        bookingData.linkData.companyId,
        session.phoneNumber,
        20
      );
    }

    setAppointments(appointmentList);
  } catch (error) {
    console.error('Error loading appointments:', error);
    setError('Failed to load appointments');
  } finally {
    setLoading(false);
  }
};

const handleCancelAppointment = async (appointmentId: string, reason?: string) => {
  try {
    await appointmentService.cancelAppointment(appointmentId, session!.clientId, reason);
    await loadAppointments(); // Reload appointments
  } catch (error) {
    console.error('Error cancelling appointment:', error);
    throw error;
  }
};
```

## After (API with Compatibility)

```typescript
import { appointmentServiceAdapter } from '../services/api/adapters';
import type { Appointment } from '../services/api';

const loadAppointments = async () => {
  try {
    setLoading(true);
    setError(null);

    let appointmentList: Appointment[] = [];
    
    if (session?.clientId && session.clientId !== 'mock-client-123') {
      // Real client - get appointments by client ID
      appointmentList = await appointmentServiceAdapter.getClientAppointments(
        bookingData.linkData.companyId,
        session.clientId,
        20 // Limit to recent 20 appointments
      );
    } else {
      // Mock client or phone-based lookup - get appointments by phone
      appointmentList = await appointmentServiceAdapter.getClientAppointmentsByPhone(
        bookingData.linkData.companyId,
        session.phoneNumber,
        20
      );
    }

    setAppointments(appointmentList);
  } catch (error) {
    console.error('Error loading appointments:', error);
    setError('Failed to load appointments');
  } finally {
    setLoading(false);
  }
};

const handleCancelAppointment = async (appointmentId: string, reason?: string) => {
  try {
    await appointmentServiceAdapter.cancelAppointment(appointmentId, session!.clientId, reason);
    await loadAppointments(); // Reload appointments
  } catch (error) {
    console.error('Error cancelling appointment:', error);
    throw error;
  }
};
```

## After (Direct API with Mobile Optimization)

For better performance and mobile optimization, you can use the API services directly:

```typescript
import { appointmentAPI, mobileOptimization, shouldReduceDataUsage } from '../services/api';
import type { Appointment } from '../services/api';

const loadAppointments = async (userInitiated: boolean = false) => {
  try {
    setLoading(true);
    setError(null);

    // Check if we should use cached data for performance
    const cacheKey = `appointments:${session?.clientId || session?.phoneNumber}`;
    if (!userInitiated && !mobileOptimization.shouldFetchData(cacheKey)) {
      console.log('Using cached appointments for performance');
      setLoading(false);
      return;
    }

    let appointmentList: Appointment[] = [];
    
    // Reduce the number of appointments loaded on slow connections
    const maxResults = shouldReduceDataUsage() ? 10 : 20;
    
    if (session?.clientId && session.clientId !== 'mock-client-123') {
      // Real client - get appointments by client ID
      appointmentList = await appointmentAPI.getClientAppointments(
        bookingData.linkData.companyId,
        session.clientId,
        maxResults
      );
    } else {
      // Mock client or phone-based lookup - get appointments by phone
      appointmentList = await appointmentAPI.getClientAppointmentsByPhone(
        bookingData.linkData.companyId,
        session.phoneNumber,
        maxResults
      );
    }

    setAppointments(appointmentList);
  } catch (error) {
    console.error('Error loading appointments:', error);
    
    // More specific error handling
    if (error.response?.status === 401) {
      setError('Session expired. Please log in again.');
    } else if (error.response?.status === 404) {
      setError('No appointments found.');
    } else if (!navigator.onLine) {
      setError('No internet connection. Please check your network.');
    } else {
      setError('Failed to load appointments. Please try again.');
    }
  } finally {
    setLoading(false);
  }
};

const handleCancelAppointment = async (appointmentId: string, reason?: string) => {
  try {
    await appointmentAPI.cancelAppointment(appointmentId, session!.clientId, reason);
    
    // Force refresh of appointments
    await loadAppointments(true);
  } catch (error) {
    console.error('Error cancelling appointment:', error);
    
    // Handle specific errors
    if (error.response?.status === 403) {
      throw new Error('You can only cancel your own appointments');
    } else if (error.response?.status === 400) {
      throw new Error('Cannot cancel this appointment. It may be too late or already cancelled.');
    } else {
      throw error;
    }
  }
};

// Add refresh functionality
const handleRefresh = () => {
  loadAppointments(true); // Force refresh
};

// Add connection status monitoring
useEffect(() => {
  const handleOnline = () => {
    console.log('Back online, syncing appointments');
    loadAppointments(true);
  };

  window.addEventListener('online', handleOnline);
  return () => window.removeEventListener('online', handleOnline);
}, []);
```

## Enhanced Component with Mobile Optimization

```typescript
import React, { useEffect, useState, useCallback } from 'react';
import { 
  appointmentAPI, 
  mobileOptimization, 
  shouldReduceDataUsage,
  getConnectionStatus 
} from '../services/api';

const ClientAppointmentsList: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState(getConnectionStatus());

  // Monitor connection status
  useEffect(() => {
    const interval = setInterval(() => {
      setConnectionStatus(getConnectionStatus());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const loadAppointments = useCallback(async (userInitiated: boolean = false) => {
    // ... implementation as shown above
  }, [session, bookingData]);

  // Preload data when connection is good
  useEffect(() => {
    if (mobileOptimization.currentConnectionQuality === 'excellent' && session) {
      mobileOptimization.preloadCriticalData(
        bookingData?.linkData?.companyId,
        bookingData?.selectedBranch?.id
      );
    }
  }, [mobileOptimization.currentConnectionQuality, session, bookingData]);

  // Auto-sync when back online
  useEffect(() => {
    const handleOnline = async () => {
      await mobileOptimization.syncWhenOnline();
      loadAppointments(true);
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [loadAppointments]);

  return (
    <Box>
      {/* Connection status indicator */}
      {!connectionStatus.isOnline && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('offline_mode')} 
          {connectionStatus.queuedRequests > 0 && 
            ` - ${connectionStatus.queuedRequests} ${t('requests_queued')}`
          }
        </Alert>
      )}

      {mobileOptimization.currentConnectionQuality === 'poor' && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {t('slow_connection_detected')}
        </Alert>
      )}

      {/* Rest of your component */}
      {loading ? (
        <CircularProgress />
      ) : error ? (
        <Alert 
          severity="error" 
          action={
            <Button onClick={() => loadAppointments(true)}>
              {t('retry')}
            </Button>
          }
        >
          {error}
        </Alert>
      ) : (
        <List>
          {appointments.map((appointment) => (
            <ListItem key={appointment.id}>
              {/* Appointment content */}
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
};
```

## Key Migration Benefits

1. **Gradual Migration**: Use adapters for zero-code-change migration
2. **Mobile Optimization**: Automatic connection quality detection and optimization
3. **Offline Support**: Automatic request queuing and sync
4. **Better Error Handling**: More specific error messages and retry logic
5. **Performance**: Intelligent caching and preloading
6. **Network Awareness**: Adaptive behavior based on connection quality

## Migration Steps

1. **Phase 1**: Replace imports with adapter imports (zero code changes)
2. **Phase 2**: Add connection status monitoring and error handling
3. **Phase 3**: Implement mobile optimizations and offline support
4. **Phase 4**: Add user-initiated refresh and better UX

This approach allows for incremental migration while providing immediate benefits.