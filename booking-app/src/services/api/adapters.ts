/**
 * Adapter services to maintain Firebase compatibility
 * These adapters provide the same interface as Firebase services but use API calls
 */

import { clientAPI } from './client.api';
import { clientAuthAPI } from './auth.api';
import { appointmentAPI } from './appointment.api';
import { bookingAPI } from './booking.api';
import type { Client } from '../client.service';
import type { Appointment } from './appointment.api';
import type { BookingLink, Branch, Service, Staff, TimeSlot } from '../../types/booking';

// Flag to determine which implementation to use
const USE_API = import.meta.env.VITE_USE_API === 'true';

/**
 * Client Service Adapter
 * Provides the same interface as the original Firebase-based client.service.ts
 */
class ClientServiceAdapter {
  async getClient(clientId: string): Promise<Client | null> {
    if (USE_API) {
      // Use API implementation
      return await clientAPI.getClientProfile();
    } else {
      // Use Firebase implementation
      const { clientService } = await import('../client.service');
      return await clientService.getClient(clientId);
    }
  }

  async updateClient(clientId: string, updates: Partial<Client>): Promise<void> {
    if (USE_API) {
      // Use API implementation
      return await clientAPI.updateClientProfile(updates);
    } else {
      // Use Firebase implementation
      const { clientService } = await import('../client.service');
      return await clientService.updateClient(clientId, updates);
    }
  }
}

/**
 * Appointment Service Adapter
 * Provides the same interface as the original Firebase-based appointment.service.ts
 */
class AppointmentServiceAdapter {
  async cancelAppointment(
    appointmentId: string,
    clientId: string,
    reason?: string
  ): Promise<void> {
    if (USE_API) {
      // Use API implementation
      return await appointmentAPI.cancelAppointment(appointmentId, clientId, reason);
    } else {
      // Use Firebase implementation
      const { appointmentService } = await import('../appointment.service');
      return await appointmentService.cancelAppointment(appointmentId, clientId, reason);
    }
  }

  async rescheduleAppointment(
    appointmentId: string,
    clientId: string,
    newDate: Date,
    newStartTime: string,
    newEndTime: string
  ): Promise<void> {
    if (USE_API) {
      // Use API implementation
      return await appointmentAPI.rescheduleAppointment(
        appointmentId, 
        clientId, 
        newDate, 
        newStartTime, 
        newEndTime
      );
    } else {
      // Use Firebase implementation
      const { appointmentService } = await import('../appointment.service');
      return await appointmentService.rescheduleAppointment(
        appointmentId, 
        clientId, 
        newDate, 
        newStartTime, 
        newEndTime
      );
    }
  }

  async checkTimeSlotAvailability(
    companyId: string,
    staffId: string,
    date: Date,
    startTime: string,
    duration: number
  ): Promise<boolean> {
    if (USE_API) {
      // Use API implementation
      return await appointmentAPI.checkTimeSlotAvailability(
        companyId, 
        staffId, 
        date, 
        startTime, 
        duration
      );
    } else {
      // Use Firebase implementation
      const { appointmentService } = await import('../appointment.service');
      return await appointmentService.checkTimeSlotAvailability(
        companyId, 
        staffId, 
        date, 
        startTime, 
        duration
      );
    }
  }

  async getAvailableTimeSlots(
    companyId: string,
    staffId: string,
    date: Date,
    duration: number,
    workingHours?: { start: string; end: string }
  ): Promise<{ time: string; available: boolean }[]> {
    if (USE_API) {
      // Use API implementation
      return await appointmentAPI.getAvailableTimeSlots(
        companyId, 
        staffId, 
        date, 
        duration, 
        workingHours
      );
    } else {
      // Use Firebase implementation
      const { appointmentService } = await import('../appointment.service');
      return await appointmentService.getAvailableTimeSlots(
        companyId, 
        staffId, 
        date, 
        duration, 
        workingHours
      );
    }
  }

  async getClientAppointments(
    companyId: string,
    clientId: string,
    maxResults?: number
  ): Promise<Appointment[]> {
    if (USE_API) {
      // Use API implementation
      return await appointmentAPI.getClientAppointments(companyId, clientId, maxResults);
    } else {
      // Use Firebase implementation
      const { appointmentService } = await import('../appointment.service');
      return await appointmentService.getClientAppointments(companyId, clientId, maxResults);
    }
  }

  async getClientAppointmentsByPhone(
    companyId: string,
    phoneNumber: string,
    maxResults?: number
  ): Promise<Appointment[]> {
    if (USE_API) {
      // Use API implementation
      return await appointmentAPI.getClientAppointmentsByPhone(companyId, phoneNumber, maxResults);
    } else {
      // Use Firebase implementation
      const { appointmentService } = await import('../appointment.service');
      return await appointmentService.getClientAppointmentsByPhone(companyId, phoneNumber, maxResults);
    }
  }
}

/**
 * Booking Service Adapter
 * Provides the same interface as the original Firebase-based booking.service.ts
 */
class BookingServiceAdapter {
  async getPublicBookingLink(companySlug: string, linkSlug: string): Promise<BookingLink | null> {
    if (USE_API) {
      // Use API implementation
      return await bookingAPI.getPublicBookingLink(companySlug, linkSlug);
    } else {
      // Use Firebase implementation
      const { bookingService } = await import('../booking.service');
      return await bookingService.getPublicBookingLink(companySlug, linkSlug);
    }
  }

  async trackLinkView(linkId: string): Promise<void> {
    if (USE_API) {
      // Use API implementation
      return await bookingAPI.trackLinkView(linkId);
    } else {
      // Use Firebase implementation
      const { bookingService } = await import('../booking.service');
      return await bookingService.trackLinkView(linkId);
    }
  }

  async getBranchesForBooking(companyId: string, branchIds?: string[]): Promise<Branch[]> {
    if (USE_API) {
      // Use API implementation
      return await bookingAPI.getBranchesForBooking(companyId, branchIds);
    } else {
      // Use Firebase implementation
      const { bookingService } = await import('../booking.service');
      return await bookingService.getBranchesForBooking(companyId, branchIds);
    }
  }

  async getServicesForBooking(companyId: string, branchId: string): Promise<Service[]> {
    if (USE_API) {
      // Use API implementation
      return await bookingAPI.getServicesForBooking(companyId, branchId);
    } else {
      // Use Firebase implementation
      const { bookingService } = await import('../booking.service');
      return await bookingService.getServicesForBooking(companyId, branchId);
    }
  }

  async getStaffForBooking(companyId: string, branchId: string, serviceId?: string): Promise<Staff[]> {
    if (USE_API) {
      // Use API implementation
      return await bookingAPI.getStaffForBooking(companyId, branchId, serviceId);
    } else {
      // Use Firebase implementation
      const { bookingService } = await import('../booking.service');
      return await bookingService.getStaffForBooking(companyId, branchId, serviceId);
    }
  }

  async getAvailableTimeSlots(
    companyId: string,
    branchId: string,
    staffId: string,
    date: Date,
    serviceDuration: number
  ): Promise<TimeSlot[]> {
    if (USE_API) {
      // Use API implementation
      return await bookingAPI.getAvailableTimeSlots(companyId, branchId, staffId, date, serviceDuration);
    } else {
      // Use Firebase implementation
      const { bookingService } = await import('../booking.service');
      return await bookingService.getAvailableTimeSlots(companyId, branchId, staffId, date, serviceDuration);
    }
  }

  async findOrCreateClient(companyId: string, branchId: string, name: string, phone: string, email?: string): Promise<string> {
    if (USE_API) {
      // Use API implementation
      return await bookingAPI.findOrCreateClient(companyId, branchId, name, phone, email);
    } else {
      // Use Firebase implementation
      const { bookingService } = await import('../booking.service');
      return await bookingService.findOrCreateClient(companyId, branchId, name, phone, email);
    }
  }

  async createAppointment(appointmentData: Partial<Appointment>): Promise<string> {
    if (USE_API) {
      // Use API implementation
      return await bookingAPI.createAppointment(appointmentData);
    } else {
      // Use Firebase implementation
      const { bookingService } = await import('../booking.service');
      return await bookingService.createAppointment(appointmentData);
    }
  }
}

/**
 * Client Auth Context Adapter
 * Provides compatibility layer for the ClientAuthContext
 */
export class ClientAuthAdapter {
  async login(phoneNumber: string): Promise<{ success: boolean; message?: string }> {
    if (USE_API) {
      // Use API implementation
      return await clientAuthAPI.sendOTP(phoneNumber);
    } else {
      // Use Firebase implementation - would need to import the actual auth logic
      throw new Error('Firebase auth not implemented in adapter');
    }
  }

  async verifyOTP(otp: string, phoneNumber: string, companyId?: string): Promise<{ success: boolean; message?: string }> {
    if (USE_API) {
      // Use API implementation
      return await clientAuthAPI.verifyOTP(otp, phoneNumber, companyId);
    } else {
      // Use Firebase implementation - would need to import the actual auth logic
      throw new Error('Firebase auth not implemented in adapter');
    }
  }

  async logout(): Promise<void> {
    if (USE_API) {
      // Use API implementation
      return await clientAuthAPI.logout();
    } else {
      // Use Firebase implementation - clear localStorage
      localStorage.removeItem('clientPortalSession');
    }
  }

  isAuthenticated(): boolean {
    if (USE_API) {
      // Use API implementation
      return clientAuthAPI.isAuthenticated();
    } else {
      // Use Firebase implementation - check localStorage
      const savedSession = localStorage.getItem('clientPortalSession');
      if (!savedSession) return false;
      
      try {
        const parsed = JSON.parse(savedSession);
        const expiresAt = new Date(parsed.expiresAt);
        return expiresAt > new Date();
      } catch {
        return false;
      }
    }
  }

  getSession(): any {
    if (USE_API) {
      // Use API implementation
      return clientAuthAPI.getStoredSession();
    } else {
      // Use Firebase implementation - get from localStorage
      const savedSession = localStorage.getItem('clientPortalSession');
      if (!savedSession) return null;
      
      try {
        const parsed = JSON.parse(savedSession);
        return {
          ...parsed,
          expiresAt: new Date(parsed.expiresAt)
        };
      } catch {
        return null;
      }
    }
  }
}

// Export adapter instances
export const clientServiceAdapter = new ClientServiceAdapter();
export const appointmentServiceAdapter = new AppointmentServiceAdapter();
export const bookingServiceAdapter = new BookingServiceAdapter();
export const clientAuthAdapter = new ClientAuthAdapter();

// Export flag for components to check
export { USE_API };

/**
 * Helper function to determine which service to use
 */
export const getServiceType = (): 'api' | 'firebase' => {
  return USE_API ? 'api' : 'firebase';
};

/**
 * Migration helper - gradually migrate components
 * This allows for A/B testing or gradual rollout
 */
export const shouldUseAPIForComponent = (componentName: string): boolean => {
  // For now, use the global flag
  // In the future, this could be component-specific or user-specific
  return USE_API;
};

/**
 * Cache management - clear all caches when switching between implementations
 */
export const clearAllCaches = (): void => {
  if (USE_API) {
    // Clear API caches
    clientAPI.clearAllCaches();
    appointmentAPI.clearAllCaches();
    bookingAPI.clearAllCaches();
  }
  // Firebase doesn't have explicit caches to clear in this implementation
};