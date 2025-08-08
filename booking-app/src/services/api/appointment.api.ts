import { api, apiCache, shouldUseCache } from './config';

// API response interfaces
interface APIResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

interface AppointmentAPIResponse {
  id: string;
  companyId: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  date: string; // ISO string from API
  startTime: string;
  endTime: string;
  services: Array<{
    serviceId: string;
    serviceName: string;
    duration: number;
    price: number;
  }>;
  staffId: string;
  staffName: string;
  status: string;
  totalPrice: number;
  totalDuration: number;
  branchId?: string;
  branchName?: string;
  createdAt?: string;
  updatedAt?: string;
  cancellationReason?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  lastRescheduledAt?: string;
  lastRescheduledBy?: string;
}

interface TimeSlotAPIResponse {
  time: string;
  available: boolean;
  staffId?: string;
}

// Firebase-compatible interfaces for existing components
export interface Appointment {
  id?: string;
  companyId: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  date: any; // Firebase-compatible Timestamp
  startTime: string;
  endTime: string;
  services: Array<{
    serviceId: string;
    serviceName: string;
    duration: number;
    price: number;
  }>;
  staffId: string;
  staffName: string;
  status: string;
  totalPrice: number;
  totalDuration: number;
  branchId?: string;
  branchName?: string;
}

export interface TimeSlot {
  time: string;
  available: boolean;
  staffId?: string;
}

class AppointmentAPIService {
  private readonly BASE_PATH = '/appointments';

  /**
   * Cancel an appointment (for authenticated clients)
   */
  async cancelAppointment(
    appointmentId: string,
    clientId: string,
    reason?: string
  ): Promise<void> {
    try {
      console.log('=== cancelAppointment START ===');
      console.log('AppointmentId:', appointmentId);
      console.log('ClientId:', clientId);
      console.log('Reason:', reason);

      const response = await api.patch<APIResponse<any>>(
        `${this.BASE_PATH}/${appointmentId}/cancel`,
        {
          clientId,
          reason,
          cancelledBy: 'client'
        }
      );

      if (response.data.success) {
        // Clear appointment-related caches
        this.clearAppointmentCaches(clientId);
        console.log('Appointment cancelled successfully');
      } else {
        throw new Error(response.data.message || 'Failed to cancel appointment');
      }

      console.log('=== cancelAppointment END ===');
    } catch (error: any) {
      console.error('Error cancelling appointment:', error);

      // Handle specific API errors
      if (error.response?.status === 404) {
        throw new Error('Appointment not found');
      }

      if (error.response?.status === 403) {
        throw new Error('Unauthorized: You can only cancel your own appointments');
      }

      if (error.response?.status === 400) {
        throw new Error(error.response.data.message || `Cannot cancel appointment with current status`);
      }

      throw error;
    }
  }

  /**
   * Reschedule an appointment (for authenticated clients)
   */
  async rescheduleAppointment(
    appointmentId: string,
    clientId: string,
    newDate: Date,
    newStartTime: string,
    newEndTime: string
  ): Promise<void> {
    try {
      console.log('=== rescheduleAppointment START ===');
      console.log('AppointmentId:', appointmentId);
      console.log('ClientId:', clientId);
      console.log('New Date:', newDate);
      console.log('New Start Time:', newStartTime);
      console.log('New End Time:', newEndTime);

      const response = await api.patch<APIResponse<any>>(
        `${this.BASE_PATH}/${appointmentId}/reschedule`,
        {
          clientId,
          date: newDate.toISOString(),
          startTime: newStartTime,
          endTime: newEndTime,
          rescheduledBy: 'client'
        }
      );

      if (response.data.success) {
        // Clear appointment-related caches
        this.clearAppointmentCaches(clientId);
        console.log('Appointment rescheduled successfully');
      } else {
        throw new Error(response.data.message || 'Failed to reschedule appointment');
      }

      console.log('=== rescheduleAppointment END ===');
    } catch (error: any) {
      console.error('Error rescheduling appointment:', error);

      // Handle specific API errors
      if (error.response?.status === 404) {
        throw new Error('Appointment not found');
      }

      if (error.response?.status === 403) {
        throw new Error('Unauthorized: You can only reschedule your own appointments');
      }

      if (error.response?.status === 400) {
        throw new Error(error.response.data.message || 'Cannot reschedule to a past date');
      }

      if (error.response?.status === 409) {
        throw new Error('Time slot is not available');
      }

      throw error;
    }
  }

  /**
   * Check if a time slot is available
   */
  async checkTimeSlotAvailability(
    companyId: string,
    staffId: string,
    date: Date,
    startTime: string,
    duration: number
  ): Promise<boolean> {
    const cacheKey = `availability:${companyId}:${staffId}:${date.toISOString().split('T')[0]}:${startTime}:${duration}`;
    
    // Check cache first for offline support (short cache for availability)
    if (shouldUseCache(cacheKey)) {
      const cached = apiCache.get(cacheKey);
      if (cached !== null) {
        console.log('Returning cached availability');
        return cached;
      }
    }

    try {
      console.log('=== checkTimeSlotAvailability START ===');
      console.log('Checking availability for:', {
        companyId,
        staffId,
        date,
        startTime,
        duration
      });

      const response = await api.post<APIResponse<{ available: boolean }>>(
        `${this.BASE_PATH}/check-availability`,
        {
          companyId,
          staffId,
          date: date.toISOString(),
          startTime,
          duration
        }
      );

      if (response.data.success && response.data.data) {
        const isAvailable = response.data.data.available;
        
        // Cache for 2 minutes (availability changes frequently)
        apiCache.set(cacheKey, isAvailable, 120000);
        
        console.log('Time slot availability:', isAvailable);
        console.log('=== checkTimeSlotAvailability END ===');
        
        return isAvailable;
      }

      return false;
    } catch (error: any) {
      console.error('Error checking time slot availability:', error);
      
      // Try to return cached data on error
      const cached = apiCache.get(cacheKey);
      if (cached !== null) {
        console.log('API error, returning cached availability');
        return cached;
      }
      
      // Default to false for safety
      return false;
    }
  }

  /**
   * Get available time slots for a specific date and staff
   */
  async getAvailableTimeSlots(
    companyId: string,
    staffId: string,
    date: Date,
    duration: number,
    workingHours?: { start: string; end: string }
  ): Promise<TimeSlot[]> {
    const cacheKey = `timeslots:${companyId}:${staffId}:${date.toISOString().split('T')[0]}:${duration}`;
    
    // Check cache first for offline support
    if (shouldUseCache(cacheKey)) {
      const cached = apiCache.get(cacheKey);
      if (cached) {
        console.log('Returning cached time slots');
        return cached.map(this.mapTimeSlotResponse.bind(this));
      }
    }

    try {
      console.log('=== getAvailableTimeSlots START ===');
      console.log('Parameters:', { companyId, staffId, date, duration, workingHours });

      // Handle "any" staff selection
      if (!staffId || staffId === 'any' || staffId.trim() === '') {
        console.log('Any staff selected - returning default available slots');
        const slots = this.getDefaultTimeSlots(date, duration, workingHours);
        return slots;
      }

      const response = await api.post<APIResponse<TimeSlotAPIResponse[]>>(
        `${this.BASE_PATH}/available-slots`,
        {
          companyId,
          staffId,
          date: date.toISOString(),
          duration,
          workingHours
        }
      );

      if (response.data.success && response.data.data) {
        const slots = response.data.data.map(this.mapTimeSlotResponse.bind(this));
        
        // Cache for 5 minutes
        apiCache.set(cacheKey, response.data.data, 300000);
        
        console.log(`Generated ${slots.length} time slots`);
        console.log('=== getAvailableTimeSlots END ===');
        
        return slots;
      }

      return [];
    } catch (error: any) {
      console.error('Error getting available time slots:', error);
      
      // Try to return cached data on error
      const cached = apiCache.get(cacheKey);
      if (cached) {
        console.log('API error, returning cached time slots');
        return cached.map(this.mapTimeSlotResponse.bind(this));
      }
      
      // Fallback to default slots for "any" staff or on error
      console.log('API error, returning default time slots');
      return this.getDefaultTimeSlots(date, duration, workingHours);
    }
  }

  /**
   * Get appointments by client ID (for authenticated clients)
   */
  async getClientAppointments(
    companyId: string,
    clientId: string,
    maxResults?: number
  ): Promise<Appointment[]> {
    const cacheKey = `client-appointments:${companyId}:${clientId}:${maxResults || 'all'}`;
    
    // Check cache first for offline support
    if (shouldUseCache(cacheKey)) {
      const cached = apiCache.get(cacheKey);
      if (cached) {
        console.log('Returning cached client appointments');
        return cached.map(this.mapAppointmentResponse.bind(this));
      }
    }

    try {
      const params: any = { companyId, clientId };
      if (maxResults) {
        params.limit = maxResults;
      }

      const response = await api.get<APIResponse<AppointmentAPIResponse[]>>(
        `${this.BASE_PATH}/client`,
        { params }
      );

      if (response.data.success && response.data.data) {
        const appointments = response.data.data.map(this.mapAppointmentResponse.bind(this));
        
        // Cache for 5 minutes
        apiCache.set(cacheKey, response.data.data, 300000);
        
        return appointments;
      }

      return [];
    } catch (error: any) {
      console.error('Error getting client appointments:', error);
      
      // Try to return cached data on error
      const cached = apiCache.get(cacheKey);
      if (cached) {
        console.log('API error, returning cached client appointments');
        return cached.map(this.mapAppointmentResponse.bind(this));
      }
      
      throw error;
    }
  }

  /**
   * Get appointments by phone number (for clients without authenticated session)
   */
  async getClientAppointmentsByPhone(
    companyId: string,
    phoneNumber: string,
    maxResults?: number
  ): Promise<Appointment[]> {
    console.log('=== getClientAppointmentsByPhone START ===');
    console.log('CompanyId:', companyId);
    console.log('Original PhoneNumber:', phoneNumber);
    console.log('MaxResults:', maxResults);

    // Normalize phone number
    let normalizedPhone = phoneNumber.replace(/[\s\-\(\)]/g, '').replace(/^\+20/, '');
    if (normalizedPhone && !normalizedPhone.startsWith('0')) {
      normalizedPhone = '0' + normalizedPhone;
    }
    console.log('Normalized PhoneNumber:', normalizedPhone);

    const cacheKey = `phone-appointments:${companyId}:${normalizedPhone}:${maxResults || 'all'}`;
    
    // Check cache first for offline support
    if (shouldUseCache(cacheKey)) {
      const cached = apiCache.get(cacheKey);
      if (cached) {
        console.log('Returning cached phone appointments');
        return cached.map(this.mapAppointmentResponse.bind(this));
      }
    }

    try {
      const params: any = { 
        companyId, 
        phone: normalizedPhone 
      };
      if (maxResults) {
        params.limit = maxResults;
      }

      const response = await api.get<APIResponse<AppointmentAPIResponse[]>>(
        `${this.BASE_PATH}/by-phone`,
        { params }
      );

      if (response.data.success && response.data.data) {
        const appointments = response.data.data.map(this.mapAppointmentResponse.bind(this));
        
        // Cache for 5 minutes
        apiCache.set(cacheKey, response.data.data, 300000);
        
        console.log('=== getClientAppointmentsByPhone SUCCESS ===');
        return appointments;
      }

      console.log('=== getClientAppointmentsByPhone NO DATA ===');
      return [];
    } catch (error: any) {
      console.error('Error getting client appointments by phone:', error);
      
      // Try to return cached data on error
      const cached = apiCache.get(cacheKey);
      if (cached) {
        console.log('API error, returning cached phone appointments');
        return cached.map(this.mapAppointmentResponse.bind(this));
      }
      
      console.log('=== getClientAppointmentsByPhone FAILED - Returning empty array ===');
      return [];
    }
  }

  // Helper methods
  private getDefaultTimeSlots(
    date: Date, 
    duration: number, 
    workingHours?: { start: string; end: string }
  ): TimeSlot[] {
    const slots: TimeSlot[] = [];
    const slotInterval = 30; // 30-minute slots

    // Use provided working hours or default business hours
    const startTime = workingHours?.start || '09:00';
    const endTime = workingHours?.end || '21:00'; // 9 PM

    const startMinutes = this.timeToMinutes(startTime);
    const endMinutes = this.timeToMinutes(endTime);

    let currentMinutes = startMinutes;
    while (currentMinutes + duration <= endMinutes) {
      const timeString = this.formatTime(currentMinutes);
      
      slots.push({
        time: timeString,
        available: true
      });
      
      currentMinutes += slotInterval;
    }

    return slots;
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private formatTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  private mapAppointmentResponse(apiAppointment: AppointmentAPIResponse): Appointment {
    return {
      id: apiAppointment.id,
      companyId: apiAppointment.companyId,
      clientId: apiAppointment.clientId,
      clientName: apiAppointment.clientName,
      clientPhone: apiAppointment.clientPhone,
      date: {
        toDate: () => new Date(apiAppointment.date),
        seconds: Math.floor(new Date(apiAppointment.date).getTime() / 1000),
        nanoseconds: 0
      } as any, // Firebase Timestamp-like object
      startTime: apiAppointment.startTime,
      endTime: apiAppointment.endTime,
      services: apiAppointment.services,
      staffId: apiAppointment.staffId,
      staffName: apiAppointment.staffName,
      status: apiAppointment.status,
      totalPrice: apiAppointment.totalPrice,
      totalDuration: apiAppointment.totalDuration,
      branchId: apiAppointment.branchId,
      branchName: apiAppointment.branchName,
    };
  }

  private mapTimeSlotResponse(apiTimeSlot: TimeSlotAPIResponse): TimeSlot {
    return {
      time: apiTimeSlot.time,
      available: apiTimeSlot.available,
      staffId: apiTimeSlot.staffId
    };
  }

  private clearAppointmentCaches(clientId?: string): void {
    // Clear time slot caches (they change frequently)
    apiCache.clear(); // For simplicity, clear all caches when appointments change
  }

  /**
   * Clear all appointment-related caches
   * Useful when data changes or on logout
   */
  clearAllCaches(): void {
    apiCache.clear();
  }
}

export const appointmentAPI = new AppointmentAPIService();