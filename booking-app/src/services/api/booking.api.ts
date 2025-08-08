import { api, apiCache, shouldUseCache } from './config';
import type { BookingLink, Branch, Service, Staff, Appointment, TimeSlot } from '../../types/booking';

// API response interfaces
interface APIResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

interface BookingLinkAPIResponse {
  id: string;
  companyId: string;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
  allowedBranchIds?: string[];
  settings: {
    requireClientInfo: boolean;
    allowReschedule: boolean;
    allowCancel: boolean;
    advanceBookingDays: number;
    bufferTime: number;
  };
  analytics?: {
    views: number;
    uniqueViews: number;
    bookings: number;
    conversionRate: number;
    viewsByDate: Record<string, number>;
    bookingsByDate: Record<string, number>;
    lastViewedAt?: string;
  };
}

interface BranchAPIResponse {
  id: string;
  name: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  phone?: string;
  email?: string;
  status: 'active' | 'inactive';
  type?: 'main' | 'branch';
  operatingHours?: Record<string, {
    isOpen: boolean;
    openTime?: string;
    closeTime?: string;
  }>;
}

interface ServiceAPIResponse {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  duration: number;
  price: number;
  category?: string;
  active: boolean;
  branchIds?: string[];
  onlineBooking?: {
    enabled: boolean;
    advanceBookingDays?: number;
    bufferTime?: number;
  };
  availableStaffCount?: number;
}

interface StaffAPIResponse {
  id: string;
  companyId: string;
  firstName: string;
  lastName: string;
  name: string;
  email?: string;
  phone?: string;
  active: boolean;
  status: 'active' | 'inactive';
  branchIds: string[];
  services: string[];
  onlineBooking?: {
    enabled: boolean;
  };
  schedule?: {
    workingHours?: Record<string, {
      enabled?: boolean;
      isWorking?: boolean;
      startTime?: string;
      endTime?: string;
      start?: string;
      end?: string;
    }>;
  };
}

interface TimeSlotAPIResponse {
  time: string;
  available: boolean;
  staffId?: string;
}

interface CreateAppointmentRequest {
  companyId: string;
  branchId: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  date: string; // ISO string
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
  totalPrice: number;
  totalDuration: number;
  bookingLinkId?: string;
  notes?: string;
}

class BookingAPIService {
  private readonly BASE_PATH = '/booking';

  /**
   * Get public booking link by company and link slugs
   */
  async getPublicBookingLink(companySlug: string, linkSlug: string): Promise<BookingLink | null> {
    const cacheKey = `booking-link:${companySlug}:${linkSlug}`;
    
    // Check cache first for offline support
    if (shouldUseCache(cacheKey)) {
      const cached = apiCache.get(cacheKey);
      if (cached) {
        console.log('Returning cached booking link');
        return this.mapBookingLinkResponse(cached);
      }
    }

    try {
      console.log('Fetching booking link with slugs:', companySlug, linkSlug);
      
      const response = await api.get<APIResponse<BookingLinkAPIResponse>>(
        `${this.BASE_PATH}/link/${companySlug}/${linkSlug}`
      );
      
      if (response.data.success && response.data.data) {
        const bookingLink = this.mapBookingLinkResponse(response.data.data);
        
        // Cache for 30 minutes
        apiCache.set(cacheKey, response.data.data, 1800000);
        
        return bookingLink;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting public booking link:', error);
      
      // Try to return cached data on error
      const cached = apiCache.get(cacheKey);
      if (cached) {
        console.log('API error, returning cached booking link');
        return this.mapBookingLinkResponse(cached);
      }
      
      throw error;
    }
  }

  /**
   * Track link view
   */
  async trackLinkView(linkId: string): Promise<void> {
    try {
      // Don't await this - it's just analytics
      api.post(`${this.BASE_PATH}/track-view/${linkId}`).catch(error => {
        console.error('Error tracking link view:', error);
      });
    } catch (error) {
      console.error('Error tracking link view:', error);
      // Don't throw - tracking shouldn't break the app
    }
  }

  /**
   * Get branches for booking
   */
  async getBranchesForBooking(companyId: string, branchIds?: string[]): Promise<Branch[]> {
    const cacheKey = `branches:${companyId}:${branchIds?.join(',') || 'all'}`;
    
    // Check cache first for offline support
    if (shouldUseCache(cacheKey)) {
      const cached = apiCache.get(cacheKey);
      if (cached) {
        console.log('Returning cached branches');
        return cached.map(this.mapBranchResponse.bind(this));
      }
    }

    try {
      const params: any = { companyId };
      if (branchIds && branchIds.length > 0) {
        params.branchIds = branchIds.join(',');
      }

      const response = await api.get<APIResponse<BranchAPIResponse[]>>(
        `${this.BASE_PATH}/branches`,
        { params }
      );

      if (response.data.success && response.data.data) {
        const branches = response.data.data.map(this.mapBranchResponse.bind(this));
        
        // Cache for 15 minutes
        apiCache.set(cacheKey, response.data.data, 900000);
        
        return branches;
      }

      return [];
    } catch (error) {
      console.error('Error getting branches:', error);
      
      // Try to return cached data on error
      const cached = apiCache.get(cacheKey);
      if (cached) {
        console.log('API error, returning cached branches');
        return cached.map(this.mapBranchResponse.bind(this));
      }
      
      throw error;
    }
  }

  /**
   * Get services for booking
   */
  async getServicesForBooking(companyId: string, branchId: string): Promise<Service[]> {
    const cacheKey = `services:${companyId}:${branchId}`;
    
    // Check cache first for offline support
    if (shouldUseCache(cacheKey)) {
      const cached = apiCache.get(cacheKey);
      if (cached) {
        console.log('Returning cached services');
        return cached.map(this.mapServiceResponse.bind(this));
      }
    }

    try {
      console.log('Fetching services for company:', companyId, 'branch:', branchId);

      const response = await api.get<APIResponse<ServiceAPIResponse[]>>(
        `${this.BASE_PATH}/services`,
        { params: { companyId, branchId } }
      );

      if (response.data.success && response.data.data) {
        const services = response.data.data.map(this.mapServiceResponse.bind(this));
        
        // Cache for 15 minutes
        apiCache.set(cacheKey, response.data.data, 900000);
        
        console.log('Filtered services:', services.length);
        return services;
      }

      return [];
    } catch (error) {
      console.error('Error getting services:', error);
      
      // Try to return cached data on error
      const cached = apiCache.get(cacheKey);
      if (cached) {
        console.log('API error, returning cached services');
        return cached.map(this.mapServiceResponse.bind(this));
      }
      
      throw error;
    }
  }

  /**
   * Get staff for booking
   */
  async getStaffForBooking(companyId: string, branchId: string, serviceId?: string): Promise<Staff[]> {
    const cacheKey = `staff:${companyId}:${branchId}:${serviceId || 'all'}`;
    
    // Check cache first for offline support
    if (shouldUseCache(cacheKey)) {
      const cached = apiCache.get(cacheKey);
      if (cached) {
        console.log('Returning cached staff');
        return cached.map(this.mapStaffResponse.bind(this));
      }
    }

    try {
      const params: any = { companyId, branchId };
      if (serviceId) {
        params.serviceId = serviceId;
      }

      const response = await api.get<APIResponse<StaffAPIResponse[]>>(
        `${this.BASE_PATH}/staff`,
        { params }
      );

      if (response.data.success && response.data.data) {
        const staffList = response.data.data.map(this.mapStaffResponse.bind(this));
        
        // Cache for 10 minutes
        apiCache.set(cacheKey, response.data.data, 600000);
        
        return staffList;
      }

      return [];
    } catch (error) {
      console.error('Error getting staff:', error);
      
      // Try to return cached data on error
      const cached = apiCache.get(cacheKey);
      if (cached) {
        console.log('API error, returning cached staff');
        return cached.map(this.mapStaffResponse.bind(this));
      }
      
      throw error;
    }
  }

  /**
   * Get available time slots
   */
  async getAvailableTimeSlots(
    companyId: string,
    branchId: string,
    staffId: string,
    date: Date,
    serviceDuration: number
  ): Promise<TimeSlot[]> {
    const cacheKey = `timeslots:${companyId}:${branchId}:${staffId}:${date.toISOString().split('T')[0]}:${serviceDuration}`;
    
    // Check cache first for offline support (short cache for time slots)
    if (shouldUseCache(cacheKey)) {
      const cached = apiCache.get(cacheKey);
      if (cached) {
        console.log('Returning cached time slots');
        return cached.map(this.mapTimeSlotResponse.bind(this));
      }
    }

    try {
      console.log('Getting time slots:', { companyId, branchId, staffId, date, serviceDuration });

      // Handle "any" staff selection
      if (!staffId || staffId === 'any' || staffId === '') {
        console.log('Any staff selected - returning default slots');
        return this.getDefaultTimeSlots(date, serviceDuration);
      }

      const response = await api.post<APIResponse<TimeSlotAPIResponse[]>>(
        `${this.BASE_PATH}/time-slots`,
        {
          companyId,
          branchId,
          staffId,
          date: date.toISOString(),
          serviceDuration
        }
      );

      if (response.data.success && response.data.data) {
        const slots = response.data.data.map(this.mapTimeSlotResponse.bind(this));
        
        // Cache for 3 minutes (time slots change frequently)
        apiCache.set(cacheKey, response.data.data, 180000);
        
        console.log('Generated slots:', slots.length, 'slots');
        return slots;
      }

      return [];
    } catch (error) {
      console.error('Error getting available time slots:', error);
      
      // Try to return cached data on error
      const cached = apiCache.get(cacheKey);
      if (cached) {
        console.log('API error, returning cached time slots');
        return cached.map(this.mapTimeSlotResponse.bind(this));
      }
      
      // Fallback to default slots
      console.log('Fallback to default time slots');
      return this.getDefaultTimeSlots(date, serviceDuration);
    }
  }

  /**
   * Find or create client
   */
  async findOrCreateClient(companyId: string, branchId: string, name: string, phone: string, email?: string): Promise<string> {
    try {
      // Normalize phone number
      const normalizedPhone = phone.replace(/[\s\-\(\)]/g, '').replace(/^\+20/, '');

      const response = await api.post<APIResponse<{ clientId: string }>>(
        `${this.BASE_PATH}/client`,
        {
          companyId,
          branchId,
          name,
          phone: normalizedPhone,
          email: email || ''
        }
      );

      if (response.data.success && response.data.data.clientId) {
        return response.data.data.clientId;
      }

      // If client creation fails, return 'guest' to allow appointment to proceed
      return 'guest';
    } catch (error) {
      console.error('Error finding/creating client:', error);
      // If client creation fails, return 'guest' to allow appointment to proceed
      return 'guest';
    }
  }

  /**
   * Create appointment
   */
  async createAppointment(appointmentData: Partial<Appointment>): Promise<string> {
    try {
      // Convert appointment data to API format
      const apiAppointmentData: CreateAppointmentRequest = {
        companyId: appointmentData.companyId!,
        branchId: appointmentData.branchId || '',
        clientName: appointmentData.clientName!,
        clientPhone: appointmentData.clientPhone!,
        clientEmail: (appointmentData as any).clientEmail,
        date: appointmentData.date ? new Date(appointmentData.date.seconds * 1000).toISOString() : new Date().toISOString(),
        startTime: appointmentData.startTime!,
        endTime: appointmentData.endTime!,
        services: appointmentData.services!,
        staffId: appointmentData.staffId!,
        staffName: appointmentData.staffName!,
        totalPrice: appointmentData.totalPrice!,
        totalDuration: appointmentData.totalDuration || appointmentData.totalDuration || 30,
        bookingLinkId: (appointmentData as any).bookingLinkId,
        notes: (appointmentData as any).notes
      };

      const response = await api.post<APIResponse<{ appointmentId: string }>>(
        `${this.BASE_PATH}/appointment`,
        apiAppointmentData
      );

      if (response.data.success && response.data.data.appointmentId) {
        // Clear relevant caches
        this.clearBookingCaches();
        
        return response.data.data.appointmentId;
      }

      throw new Error(response.data.message || 'Failed to create appointment');
    } catch (error) {
      console.error('Error creating appointment:', error);
      throw error;
    }
  }

  // Helper methods
  private getDefaultTimeSlots(date: Date, serviceDuration: number): TimeSlot[] {
    const slots: TimeSlot[] = [];
    const slotInterval = 30; // 30 minutes

    // Default business hours: 9 AM to 9 PM
    const startTime = 9 * 60; // 9:00 AM in minutes
    const endTime = 21 * 60; // 9:00 PM in minutes

    let currentTime = startTime;
    while (currentTime + serviceDuration <= endTime) {
      const hours = Math.floor(currentTime / 60);
      const minutes = currentTime % 60;
      const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

      slots.push({
        time: timeString,
        available: true
      });

      currentTime += slotInterval;
    }

    return slots;
  }

  // Response mappers
  private mapBookingLinkResponse(apiData: BookingLinkAPIResponse): BookingLink {
    return {
      id: apiData.id,
      companyId: apiData.companyId,
      name: apiData.name,
      slug: apiData.slug,
      description: apiData.description,
      isActive: apiData.isActive,
      allowedBranchIds: apiData.allowedBranchIds,
      settings: apiData.settings,
      analytics: apiData.analytics ? {
        ...apiData.analytics,
        lastViewedAt: apiData.analytics.lastViewedAt ? {
          toDate: () => new Date(apiData.analytics.lastViewedAt!),
          seconds: Math.floor(new Date(apiData.analytics.lastViewedAt!).getTime() / 1000),
          nanoseconds: 0
        } as any : undefined
      } : undefined
    };
  }

  private mapBranchResponse(apiData: BranchAPIResponse): Branch {
    return {
      id: apiData.id,
      name: apiData.name,
      address: apiData.address,
      phone: apiData.phone,
      email: apiData.email,
      status: apiData.status,
      type: apiData.type,
      operatingHours: apiData.operatingHours
    };
  }

  private mapServiceResponse(apiData: ServiceAPIResponse): Service {
    return {
      id: apiData.id,
      companyId: apiData.companyId,
      name: apiData.name,
      description: apiData.description,
      duration: apiData.duration,
      price: apiData.price,
      category: apiData.category,
      active: apiData.active,
      branchIds: apiData.branchIds,
      onlineBooking: apiData.onlineBooking,
      availableStaffCount: apiData.availableStaffCount
    };
  }

  private mapStaffResponse(apiData: StaffAPIResponse): Staff {
    return {
      id: apiData.id,
      companyId: apiData.companyId,
      firstName: apiData.firstName,
      lastName: apiData.lastName,
      name: apiData.name,
      email: apiData.email,
      phone: apiData.phone,
      active: apiData.active,
      status: apiData.status,
      branchIds: apiData.branchIds,
      services: apiData.services,
      onlineBooking: apiData.onlineBooking,
      schedule: apiData.schedule
    };
  }

  private mapTimeSlotResponse(apiData: TimeSlotAPIResponse): TimeSlot {
    return {
      time: apiData.time,
      available: apiData.available,
      staffId: apiData.staffId
    };
  }

  private clearBookingCaches(): void {
    // Clear time slot caches when appointments are created
    // For simplicity, clear all caches
    apiCache.clear();
  }

  /**
   * Clear all booking-related caches
   */
  clearAllCaches(): void {
    apiCache.clear();
  }
}

export const bookingAPI = new BookingAPIService();