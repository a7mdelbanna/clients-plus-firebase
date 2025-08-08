import { api, apiCache, shouldUseCache } from './config';
import type { Client } from '../client.service';

// API response interfaces
interface APIResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

interface ClientAPIResponse {
  id: string;
  companyId: string;
  firstName: string;
  lastName?: string;
  name?: string;
  gender?: 'male' | 'female' | 'other' | 'not_specified';
  dateOfBirth?: string; // ISO string from API
  phone?: string;
  email?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  marketing?: {
    acceptsSMS: boolean;
    acceptsEmail: boolean;
    acceptsPromotions: boolean;
  };
  preferences?: any; // Client preferences object
  medical?: {
    allergies?: string[];
    conditions?: string[];
    medications?: string[];
    notes?: string;
  };
  createdAt?: string; // ISO string from API
  updatedAt?: string; // ISO string from API
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
}

interface InvoiceAPIResponse {
  id: string;
  companyId: string;
  clientId: string;
  appointmentId?: string;
  amount: number;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  dueDate: string;
  createdAt: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
}

class ClientAPIService {
  private readonly BASE_PATH = '/clients';

  /**
   * Get client profile using client JWT token
   * The token contains the client ID, so no need to pass it explicitly
   */
  async getClientProfile(): Promise<Client | null> {
    const cacheKey = 'client:profile';
    
    // Check cache first for offline support
    if (shouldUseCache(cacheKey)) {
      const cached = apiCache.get(cacheKey);
      if (cached) {
        console.log('Returning cached client profile');
        return this.mapClientResponse(cached);
      }
    }

    try {
      const response = await api.get<APIResponse<ClientAPIResponse>>(`${this.BASE_PATH}/profile`);
      
      if (response.data.success && response.data.data) {
        const clientData = this.mapClientResponse(response.data.data);
        
        // Cache for 10 minutes
        apiCache.set(cacheKey, response.data.data, 600000);
        
        return clientData;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting client profile:', error);
      
      // Try to return cached data on error
      const cached = apiCache.get(cacheKey);
      if (cached) {
        console.log('API error, returning cached client profile');
        return this.mapClientResponse(cached);
      }
      
      throw error;
    }
  }

  /**
   * Update client profile
   */
  async updateClientProfile(updates: Partial<Client>): Promise<void> {
    try {
      console.log('=== updateClientProfile START ===');
      console.log('Updates:', updates);

      // Remove fields that shouldn't be updated via API
      const { id, companyId, createdAt, ...updateData } = updates;

      // Ensure phone number is normalized if provided
      if (updateData.phone) {
        let normalizedPhone = updateData.phone.replace(/[\s\-\(\)]/g, '').replace(/^\+20/, '');
        // If the normalized phone doesn't start with 0, add it (Egyptian format)
        if (normalizedPhone && !normalizedPhone.startsWith('0')) {
          normalizedPhone = '0' + normalizedPhone;
        }
        updateData.phone = normalizedPhone;
        console.log('Normalized phone:', normalizedPhone);
      }

      // Update the name field for backward compatibility
      if (updateData.firstName || updateData.lastName) {
        const firstName = updateData.firstName || updates.firstName || '';
        const lastName = updateData.lastName || updates.lastName || '';
        updateData.name = `${firstName} ${lastName}`.trim();
      }

      // Convert date objects to ISO strings for API
      const apiUpdateData = this.mapClientToAPI(updateData);

      const response = await api.patch<APIResponse<ClientAPIResponse>>(
        `${this.BASE_PATH}/profile`,
        apiUpdateData
      );

      if (response.data.success) {
        // Clear profile cache to force refresh
        apiCache.delete('client:profile');
        console.log('Client profile updated successfully');
      } else {
        throw new Error(response.data.message || 'Failed to update client profile');
      }

      console.log('=== updateClientProfile END ===');
    } catch (error) {
      console.error('Error updating client profile:', error);
      throw error;
    }
  }

  /**
   * Get client appointments
   */
  async getClientAppointments(maxResults?: number): Promise<any[]> {
    const cacheKey = `client:appointments:${maxResults || 'all'}`;
    
    // Check cache first for offline support
    if (shouldUseCache(cacheKey)) {
      const cached = apiCache.get(cacheKey);
      if (cached) {
        console.log('Returning cached client appointments');
        return cached.map(this.mapAppointmentResponse.bind(this));
      }
    }

    try {
      const params: any = {};
      if (maxResults) {
        params.limit = maxResults;
      }

      const response = await api.get<APIResponse<AppointmentAPIResponse[]>>(
        `${this.BASE_PATH}/appointments`,
        { params }
      );

      if (response.data.success && response.data.data) {
        const appointments = response.data.data.map(this.mapAppointmentResponse.bind(this));
        
        // Cache for 5 minutes
        apiCache.set(cacheKey, response.data.data, 300000);
        
        return appointments;
      }

      return [];
    } catch (error) {
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
   * Get client invoices
   */
  async getClientInvoices(maxResults?: number): Promise<any[]> {
    const cacheKey = `client:invoices:${maxResults || 'all'}`;
    
    // Check cache first for offline support
    if (shouldUseCache(cacheKey)) {
      const cached = apiCache.get(cacheKey);
      if (cached) {
        console.log('Returning cached client invoices');
        return cached.map(this.mapInvoiceResponse.bind(this));
      }
    }

    try {
      const params: any = {};
      if (maxResults) {
        params.limit = maxResults;
      }

      const response = await api.get<APIResponse<InvoiceAPIResponse[]>>(
        `${this.BASE_PATH}/invoices`,
        { params }
      );

      if (response.data.success && response.data.data) {
        const invoices = response.data.data.map(this.mapInvoiceResponse.bind(this));
        
        // Cache for 10 minutes
        apiCache.set(cacheKey, response.data.data, 600000);
        
        return invoices;
      }

      return [];
    } catch (error) {
      console.error('Error getting client invoices:', error);
      
      // Try to return cached data on error
      const cached = apiCache.get(cacheKey);
      if (cached) {
        console.log('API error, returning cached client invoices');
        return cached.map(this.mapInvoiceResponse.bind(this));
      }
      
      throw error;
    }
  }

  /**
   * Cancel appointment
   */
  async cancelAppointment(appointmentId: string, reason?: string): Promise<void> {
    try {
      console.log('=== cancelAppointment START ===');
      console.log('AppointmentId:', appointmentId);
      console.log('Reason:', reason);

      const response = await api.patch<APIResponse<any>>(
        `${this.BASE_PATH}/appointments/${appointmentId}/cancel`,
        {
          reason,
          cancelledBy: 'client'
        }
      );

      if (response.data.success) {
        // Clear appointments cache to force refresh
        this.clearAppointmentsCaches();
        console.log('Appointment cancelled successfully');
      } else {
        throw new Error(response.data.message || 'Failed to cancel appointment');
      }

      console.log('=== cancelAppointment END ===');
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      throw error;
    }
  }

  /**
   * Reschedule appointment
   */
  async rescheduleAppointment(
    appointmentId: string,
    newDate: Date,
    newStartTime: string,
    newEndTime: string
  ): Promise<void> {
    try {
      console.log('=== rescheduleAppointment START ===');
      console.log('AppointmentId:', appointmentId);
      console.log('New Date:', newDate);
      console.log('New Start Time:', newStartTime);
      console.log('New End Time:', newEndTime);

      const response = await api.patch<APIResponse<any>>(
        `${this.BASE_PATH}/appointments/${appointmentId}/reschedule`,
        {
          date: newDate.toISOString(),
          startTime: newStartTime,
          endTime: newEndTime,
          rescheduledBy: 'client'
        }
      );

      if (response.data.success) {
        // Clear appointments cache to force refresh
        this.clearAppointmentsCaches();
        console.log('Appointment rescheduled successfully');
      } else {
        throw new Error(response.data.message || 'Failed to reschedule appointment');
      }

      console.log('=== rescheduleAppointment END ===');
    } catch (error) {
      console.error('Error rescheduling appointment:', error);
      throw error;
    }
  }

  // Helper methods for response mapping
  private mapClientResponse(apiClient: ClientAPIResponse): Client {
    return {
      id: apiClient.id,
      companyId: apiClient.companyId,
      firstName: apiClient.firstName,
      lastName: apiClient.lastName,
      name: apiClient.name,
      gender: apiClient.gender,
      dateOfBirth: apiClient.dateOfBirth ? { 
        toDate: () => new Date(apiClient.dateOfBirth!),
        seconds: Math.floor(new Date(apiClient.dateOfBirth!).getTime() / 1000),
        nanoseconds: 0
      } as any : undefined, // Firebase Timestamp-like object
      phone: apiClient.phone,
      email: apiClient.email,
      address: apiClient.address,
      marketing: apiClient.marketing,
      preferences: apiClient.preferences,
      medical: apiClient.medical,
      createdAt: apiClient.createdAt ? {
        toDate: () => new Date(apiClient.createdAt!),
        seconds: Math.floor(new Date(apiClient.createdAt!).getTime() / 1000),
        nanoseconds: 0
      } as any : undefined,
      updatedAt: apiClient.updatedAt ? {
        toDate: () => new Date(apiClient.updatedAt!),
        seconds: Math.floor(new Date(apiClient.updatedAt!).getTime() / 1000),
        nanoseconds: 0
      } as any : undefined,
    };
  }

  private mapAppointmentResponse(apiAppointment: AppointmentAPIResponse): any {
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

  private mapInvoiceResponse(apiInvoice: InvoiceAPIResponse): any {
    return {
      id: apiInvoice.id,
      companyId: apiInvoice.companyId,
      clientId: apiInvoice.clientId,
      appointmentId: apiInvoice.appointmentId,
      amount: apiInvoice.amount,
      status: apiInvoice.status,
      dueDate: {
        toDate: () => new Date(apiInvoice.dueDate),
        seconds: Math.floor(new Date(apiInvoice.dueDate).getTime() / 1000),
        nanoseconds: 0
      } as any,
      createdAt: {
        toDate: () => new Date(apiInvoice.createdAt),
        seconds: Math.floor(new Date(apiInvoice.createdAt).getTime() / 1000),
        nanoseconds: 0
      } as any,
      items: apiInvoice.items,
    };
  }

  private mapClientToAPI(client: Partial<Client>): any {
    const apiData: any = { ...client };
    
    // Convert Timestamp-like objects to ISO strings
    if (client.dateOfBirth && typeof client.dateOfBirth === 'object' && 'toDate' in client.dateOfBirth) {
      apiData.dateOfBirth = client.dateOfBirth.toDate().toISOString();
    }
    
    return apiData;
  }

  private clearAppointmentsCaches(): void {
    // Clear all appointment-related caches
    const keys = ['all', '10', '20', '50']; // Common limit values
    keys.forEach(key => {
      apiCache.delete(`client:appointments:${key}`);
    });
  }

  /**
   * Clear all client-related caches
   * Useful when switching clients or on logout
   */
  clearAllCaches(): void {
    apiCache.delete('client:profile');
    this.clearAppointmentsCaches();
    
    const keys = ['all', '10', '20', '50']; // Common limit values
    keys.forEach(key => {
      apiCache.delete(`client:invoices:${key}`);
    });
  }
}

export const clientAPI = new ClientAPIService();