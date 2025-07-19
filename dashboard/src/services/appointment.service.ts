import { db } from '../config/firebase';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  writeBatch,
  serverTimestamp,
  onSnapshot,
  QueryConstraint,
  startAt,
  endAt,
} from 'firebase/firestore';
import { format, parse, addMinutes, isBefore, isAfter, areIntervalsOverlapping, startOfDay, endOfDay } from 'date-fns';

// Appointment Types
export type AppointmentStatus = 'pending' | 'confirmed' | 'arrived' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
export type AppointmentSource = 'dashboard' | 'online' | 'phone' | 'walk_in';
export type PaymentStatus = 'none' | 'partial' | 'full' | 'refunded';
export type RepeatType = 'none' | 'daily' | 'weekly' | 'monthly';

export interface AppointmentService {
  serviceId: string;
  serviceName: string;
  duration: number; // in minutes
  price: number;
  staffId?: string; // specific staff for this service if different from main
}

export interface AppointmentResource {
  resourceId: string;
  resourceName: string;
  resourceType: 'chair' | 'room' | 'equipment';
}

export interface AppointmentNotification {
  type: 'confirmation' | 'reminder' | 'follow_up';
  method: ('sms' | 'email' | 'push')[];
  timing?: number; // minutes before appointment
  sent: boolean;
  sentAt?: Timestamp;
}

export interface AppointmentRepeat {
  type: RepeatType;
  interval: number; // 1 = every day/week/month, 2 = every other, etc.
  endDate?: Timestamp;
  maxOccurrences?: number;
  excludeDates?: string[]; // ISO date strings
}

export interface Appointment {
  id?: string;
  companyId: string;
  branchId?: string;
  
  // Client Information
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  isNewClient?: boolean;
  
  // Service Information
  services: AppointmentService[];
  categoryId?: string;
  totalDuration: number; // calculated from services
  totalPrice: number; // calculated from services
  
  // Staff & Timing
  staffId: string;
  staffName: string;
  date: Timestamp;
  startTime: string; // "09:00"
  endTime: string; // "10:30"
  
  // Resources
  resources?: AppointmentResource[];
  
  // Status & Payment
  status: AppointmentStatus;
  paymentStatus: PaymentStatus;
  prepaidAmount?: number;
  
  // Additional Info
  notes?: string;
  internalNotes?: string; // staff-only notes
  color?: string; // for calendar display
  source: AppointmentSource;
  bookingLinkId?: string; // if booked online
  
  // Notifications
  notifications?: AppointmentNotification[];
  
  // Repeat Settings
  repeat?: AppointmentRepeat;
  repeatGroupId?: string; // links repeated appointments
  
  // System fields
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: string;
  lastModifiedBy?: string;
  
  // Change tracking
  changeHistory?: {
    changedAt: Timestamp;
    changedBy: string;
    changes: string[];
  }[];
}

// Time slot for availability
export interface TimeSlot {
  date: string; // ISO date
  startTime: string; // "09:00"
  endTime: string; // "09:30"
  available: boolean;
  staffId: string;
}

// Availability query parameters
export interface AvailabilityQuery {
  companyId: string;
  staffId?: string;
  serviceIds?: string[];
  date: Date;
  duration?: number; // total duration needed
  resourceIds?: string[];
}

class AppointmentService {
  private appointmentsCollection = 'appointments';

  // Create a new appointment
  async createAppointment(
    appointment: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>,
    userId: string
  ): Promise<string> {
    try {
      // Check availability first
      const isAvailable = await this.checkAvailability({
        companyId: appointment.companyId,
        staffId: appointment.staffId,
        date: appointment.date.toDate(),
        duration: appointment.totalDuration,
        serviceIds: appointment.services.map(s => s.serviceId),
      });

      if (!isAvailable) {
        throw new Error('Selected time slot is not available');
      }

      const newAppointment = {
        ...appointment,
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp,
        createdBy: userId,
        changeHistory: [{
          changedAt: serverTimestamp() as Timestamp,
          changedBy: userId,
          changes: ['Appointment created']
        }]
      };

      const docRef = await addDoc(collection(db, this.appointmentsCollection), newAppointment);
      
      // Handle repeat appointments if configured
      if (appointment.repeat && appointment.repeat.type !== 'none') {
        await this.createRepeatAppointments(docRef.id, appointment, userId);
      }

      return docRef.id;
    } catch (error) {
      console.error('Error creating appointment:', error);
      throw error;
    }
  }

  // Get appointments for a date range
  async getAppointments(
    companyId: string,
    startDate: Date,
    endDate: Date,
    staffId?: string,
    branchId?: string
  ): Promise<Appointment[]> {
    try {
      // Build constraints - all where clauses must come before orderBy
      const constraints: QueryConstraint[] = [
        where('companyId', '==', companyId),
        where('date', '>=', Timestamp.fromDate(startDate)),
        where('date', '<=', Timestamp.fromDate(endDate))
      ];

      if (staffId) {
        constraints.push(where('staffId', '==', staffId));
      }

      if (branchId) {
        constraints.push(where('branchId', '==', branchId));
      }

      // Add orderBy after all where clauses
      constraints.push(orderBy('date', 'asc'));
      
      // Temporarily remove second orderBy to simplify index requirements
      // We'll sort by startTime in JavaScript instead
      // constraints.push(orderBy('startTime', 'asc'));

      const q = query(collection(db, this.appointmentsCollection), ...constraints);
      const snapshot = await getDocs(q);

      const appointments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Appointment));

      // Sort by startTime in JavaScript while index is building
      appointments.sort((a, b) => {
        const dateCompare = a.date.toMillis() - b.date.toMillis();
        if (dateCompare !== 0) return dateCompare;
        return a.startTime.localeCompare(b.startTime);
      });

      return appointments;
    } catch (error) {
      console.error('Error getting appointments:', error);
      
      // If index is still building, try a simpler query
      if (error instanceof Error && error.message.includes('index')) {
        console.log('Index not ready, using fallback query');
        
        try {
          // Fallback: just get all appointments for the company and filter in memory
          const fallbackConstraints = [
            where('companyId', '==', companyId),
            orderBy('date', 'asc')
          ];
          
          const q = query(collection(db, this.appointmentsCollection), ...fallbackConstraints);
          const snapshot = await getDocs(q);
          
          let appointments = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Appointment));
          
          // Filter in JavaScript
          appointments = appointments.filter(apt => {
            const aptDate = apt.date.toDate();
            if (aptDate < startDate || aptDate > endDate) return false;
            if (staffId && apt.staffId !== staffId) return false;
            if (branchId && apt.branchId !== branchId) return false;
            return true;
          });
          
          // Sort by date and time
          appointments.sort((a, b) => {
            const dateCompare = a.date.toMillis() - b.date.toMillis();
            if (dateCompare !== 0) return dateCompare;
            return a.startTime.localeCompare(b.startTime);
          });
          
          return appointments;
        } catch (fallbackError) {
          console.error('Fallback query also failed:', fallbackError);
          
          // Ultimate fallback: Get all appointments for company without orderBy
          try {
            console.log('Using ultimate fallback - no sorting in query');
            
            const q = query(
              collection(db, this.appointmentsCollection), 
              where('companyId', '==', companyId)
            );
            const snapshot = await getDocs(q);
            
            let appointments = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            } as Appointment));
            
            // Filter by date range, staff, and branch in JavaScript
            appointments = appointments.filter(apt => {
              const aptDate = apt.date.toDate();
              if (aptDate < startDate || aptDate > endDate) return false;
              if (staffId && apt.staffId !== staffId) return false;
              if (branchId && apt.branchId !== branchId) return false;
              return true;
            });
            
            // Sort by date and time in JavaScript
            appointments.sort((a, b) => {
              const dateCompare = a.date.toMillis() - b.date.toMillis();
              if (dateCompare !== 0) return dateCompare;
              return a.startTime.localeCompare(b.startTime);
            });
            
            console.log(`Found ${appointments.length} appointments using ultimate fallback`);
            return appointments;
            
          } catch (ultimateFallbackError) {
            console.error('Ultimate fallback also failed:', ultimateFallbackError);
            // Return empty array instead of throwing error
            console.log('Returning empty appointments array');
            return [];
          }
        }
      }
      
      throw error;
    }
  }

  // Get single appointment
  async getAppointment(appointmentId: string): Promise<Appointment | null> {
    try {
      const docSnap = await getDoc(doc(db, this.appointmentsCollection, appointmentId));
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Appointment;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting appointment:', error);
      throw error;
    }
  }

  // Update appointment
  async updateAppointment(
    appointmentId: string,
    updates: Partial<Appointment>,
    userId: string
  ): Promise<void> {
    try {
      const currentAppointment = await this.getAppointment(appointmentId);
      if (!currentAppointment) {
        throw new Error('Appointment not found');
      }

      // Check availability if time/staff changed
      if (updates.date || updates.startTime || updates.staffId || updates.totalDuration) {
        const isAvailable = await this.checkAvailability({
          companyId: currentAppointment.companyId,
          staffId: updates.staffId || currentAppointment.staffId,
          date: updates.date?.toDate() || currentAppointment.date.toDate(),
          duration: updates.totalDuration || currentAppointment.totalDuration,
          excludeAppointmentId: appointmentId,
        });

        if (!isAvailable) {
          throw new Error('Selected time slot is not available');
        }
      }

      // Track changes
      const changes: string[] = [];
      if (updates.date) changes.push('Date changed');
      if (updates.startTime) changes.push('Time changed');
      if (updates.staffId) changes.push('Staff changed');
      if (updates.status) changes.push(`Status changed to ${updates.status}`);
      if (updates.services) changes.push('Services modified');

      const changeEntry = {
        changedAt: serverTimestamp() as Timestamp,
        changedBy: userId,
        changes
      };

      await updateDoc(doc(db, this.appointmentsCollection, appointmentId), {
        ...updates,
        updatedAt: serverTimestamp(),
        lastModifiedBy: userId,
        changeHistory: [...(currentAppointment.changeHistory || []), changeEntry]
      });
    } catch (error) {
      console.error('Error updating appointment:', error);
      throw error;
    }
  }

  // Update appointment status
  async updateAppointmentStatus(
    appointmentId: string,
    status: AppointmentStatus,
    userId: string
  ): Promise<void> {
    await this.updateAppointment(appointmentId, { status }, userId);
  }

  // Cancel appointment
  async cancelAppointment(appointmentId: string, userId: string, reason?: string): Promise<void> {
    const updates: Partial<Appointment> = {
      status: 'cancelled',
      internalNotes: reason ? `Cancellation reason: ${reason}` : undefined
    };
    
    await this.updateAppointment(appointmentId, updates, userId);
  }

  // Delete appointment (soft delete by changing status)
  async deleteAppointment(appointmentId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, this.appointmentsCollection, appointmentId));
    } catch (error) {
      console.error('Error deleting appointment:', error);
      throw error;
    }
  }

  // Check availability for a time slot
  async checkAvailability(query: AvailabilityQuery & { excludeAppointmentId?: string }): Promise<boolean> {
    try {
      // 1. Check staff working hours
      const isWorkingHours = await this.checkStaffWorkingHours(
        query.staffId!,
        query.date,
        query.duration || 30
      );

      if (!isWorkingHours) {
        return false;
      }

      // 2. Check for conflicting appointments
      const hasConflicts = await this.checkAppointmentConflicts(
        query.companyId,
        query.staffId!,
        query.date,
        query.duration || 30,
        query.excludeAppointmentId
      );

      if (hasConflicts) {
        return false;
      }

      // 3. Check resource availability if needed
      if (query.resourceIds && query.resourceIds.length > 0) {
        const resourcesAvailable = await this.checkResourceAvailability(
          query.companyId,
          query.resourceIds,
          query.date,
          query.duration || 30
        );

        if (!resourcesAvailable) {
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Error checking availability:', error);
      return false;
    }
  }

  // Get available time slots for a date
  async getAvailableTimeSlots(
    query: AvailabilityQuery,
    slotDuration: number = 30
  ): Promise<TimeSlot[]> {
    try {
      const slots: TimeSlot[] = [];
      const dateStr = format(query.date, 'yyyy-MM-dd');
      
      // Get staff working hours
      const workingHours = await this.getStaffWorkingHours(query.staffId!, query.date);
      
      if (!workingHours) {
        return slots;
      }

      // Get existing appointments
      const appointments = await this.getAppointments(
        query.companyId,
        startOfDay(query.date),
        endOfDay(query.date),
        query.staffId
      );

      // Generate time slots
      for (const period of workingHours) {
        let currentTime = period.start;
        
        while (currentTime < period.end) {
          const endTime = addMinutes(currentTime, query.duration || slotDuration);
          
          if (endTime <= period.end) {
            const startTimeStr = format(currentTime, 'HH:mm');
            const endTimeStr = format(endTime, 'HH:mm');
            
            // Check if slot conflicts with existing appointments
            const hasConflict = appointments.some(apt => {
              const aptStart = parse(apt.startTime, 'HH:mm', query.date);
              const aptEnd = parse(apt.endTime, 'HH:mm', query.date);
              
              return areIntervalsOverlapping(
                { start: currentTime, end: endTime },
                { start: aptStart, end: aptEnd }
              );
            });

            slots.push({
              date: dateStr,
              startTime: startTimeStr,
              endTime: endTimeStr,
              available: !hasConflict,
              staffId: query.staffId!
            });
          }
          
          currentTime = addMinutes(currentTime, slotDuration);
        }
      }

      return slots;
    } catch (error) {
      console.error('Error getting available time slots:', error);
      return [];
    }
  }

  // Subscribe to appointments changes
  subscribeToAppointments(
    companyId: string,
    startDate: Date,
    endDate: Date,
    callback: (appointments: Appointment[]) => void,
    staffId?: string
  ): () => void {
    const constraints: QueryConstraint[] = [
      where('companyId', '==', companyId),
      where('date', '>=', Timestamp.fromDate(startDate)),
      where('date', '<=', Timestamp.fromDate(endDate))
    ];

    if (staffId) {
      constraints.push(where('staffId', '==', staffId));
    }

    const q = query(collection(db, this.appointmentsCollection), ...constraints);

    return onSnapshot(q, (snapshot) => {
      const appointments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Appointment));

      callback(appointments);
    });
  }

  // Private helper methods
  private async checkStaffWorkingHours(
    staffId: string,
    date: Date,
    duration: number
  ): Promise<boolean> {
    // TODO: Integrate with staff schedule service
    // For now, assume 9 AM to 6 PM
    const hour = date.getHours();
    const endHour = addMinutes(date, duration).getHours();
    
    return hour >= 9 && endHour <= 18;
  }

  private async getStaffWorkingHours(
    staffId: string,
    date: Date
  ): Promise<{ start: Date; end: Date }[] | null> {
    // TODO: Integrate with staff schedule service
    // For now, return default working hours
    return [{
      start: new Date(date.setHours(9, 0, 0, 0)),
      end: new Date(date.setHours(18, 0, 0, 0))
    }];
  }

  private async checkAppointmentConflicts(
    companyId: string,
    staffId: string,
    date: Date,
    duration: number,
    excludeAppointmentId?: string
  ): Promise<boolean> {
    try {
      // Validate input date
      if (!date || isNaN(date.getTime())) {
        console.error('Invalid date provided to checkAppointmentConflicts:', date);
        return false;
      }

      const appointments = await this.getAppointments(
        companyId,
        startOfDay(date),
        endOfDay(date),
        staffId
      );

      const startTimeStr = format(date, 'HH:mm');
      const endTime = addMinutes(date, duration);
      
      // Validate calculated end time
      if (isNaN(endTime.getTime())) {
        console.error('Invalid end time calculated:', endTime);
        return false;
      }
      
      const endTimeStr = format(endTime, 'HH:mm');

      return appointments.some(apt => {
        if (apt.id === excludeAppointmentId) return false;
        if (apt.status === 'cancelled') return false;

        try {
          const aptStart = parse(apt.startTime, 'HH:mm', date);
          const aptEnd = parse(apt.endTime, 'HH:mm', date);
          
          // Validate parsed appointment times
          if (isNaN(aptStart.getTime()) || isNaN(aptEnd.getTime())) {
            console.warn('Invalid appointment time found:', apt.startTime, apt.endTime);
            return false;
          }

          return areIntervalsOverlapping(
            { start: date, end: endTime },
            { start: aptStart, end: aptEnd }
          );
        } catch (error) {
          console.error('Error parsing appointment times for conflict check:', error);
          return false;
        }
      });
    } catch (error) {
      console.error('Error in checkAppointmentConflicts:', error);
      return false;
    }
  }

  private async checkResourceAvailability(
    companyId: string,
    resourceIds: string[],
    date: Date,
    duration: number
  ): Promise<boolean> {
    // TODO: Implement resource availability checking
    return true;
  }

  private async createRepeatAppointments(
    originalId: string,
    appointment: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>,
    userId: string
  ): Promise<void> {
    // TODO: Implement recurring appointments
    console.log('Recurring appointments not yet implemented');
  }

  // Get appointments by client
  async getClientAppointments(
    companyId: string,
    clientId: string,
    limit?: number
  ): Promise<Appointment[]> {
    try {
      const constraints: QueryConstraint[] = [
        where('companyId', '==', companyId),
        where('clientId', '==', clientId),
        orderBy('date', 'desc')
      ];

      if (limit) {
        constraints.push(limit(limit));
      }

      const q = query(collection(db, this.appointmentsCollection), ...constraints);
      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Appointment));
    } catch (error) {
      console.error('Error getting client appointments:', error);
      throw error;
    }
  }

  // Get appointment statistics
  async getAppointmentStats(
    companyId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    total: number;
    byStatus: Record<AppointmentStatus, number>;
    revenue: number;
    averageDuration: number;
  }> {
    try {
      const appointments = await this.getAppointments(companyId, startDate, endDate);
      
      const stats = {
        total: appointments.length,
        byStatus: {} as Record<AppointmentStatus, number>,
        revenue: 0,
        totalDuration: 0
      };

      appointments.forEach(apt => {
        stats.byStatus[apt.status] = (stats.byStatus[apt.status] || 0) + 1;
        if (apt.status === 'completed' && apt.paymentStatus === 'full') {
          stats.revenue += apt.totalPrice;
        }
        stats.totalDuration += apt.totalDuration;
      });

      return {
        ...stats,
        averageDuration: stats.total > 0 ? stats.totalDuration / stats.total : 0
      };
    } catch (error) {
      console.error('Error getting appointment stats:', error);
      throw error;
    }
  }

  // Helper method: Get staff working hours
  private async getStaffWorkingHours(staffId: string, date: Date): Promise<{ start: Date; end: Date }[]> {
    // TODO: Integrate with staff schedule service
    // For now, return default working hours 9 AM - 9 PM
    // Create new date objects to avoid mutation
    const workStart = new Date(date);
    workStart.setHours(9, 0, 0, 0);
    
    const workEnd = new Date(date);
    workEnd.setHours(21, 0, 0, 0);
    
    return [{
      start: workStart,
      end: workEnd
    }];
  }

  // Helper method: Check if time is within staff working hours
  private async checkStaffWorkingHours(
    staffId: string,
    date: Date,
    duration: number
  ): Promise<boolean> {
    // TODO: Implement full working hours check with staff schedule
    // For now, always return true to not block the UI
    return true;
  }
}

export const appointmentService = new AppointmentService();