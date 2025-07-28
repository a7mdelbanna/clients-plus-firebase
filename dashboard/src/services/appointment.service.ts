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
import { format, parse, addMinutes, isBefore, isAfter, areIntervalsOverlapping, startOfDay, endOfDay, addDays, addWeeks, addMonths } from 'date-fns';
import { staffService } from './staff.service';
import { resourceService } from './resource.service';
import { locationService } from './location.service';
import { appointmentFitsWithinBusinessHours } from '../utils/businessHours';
import { whatsAppService } from './whatsapp.service';
import { appointmentReminderService } from './appointmentReminder.service';
import { clientService } from './client.service';
import { serviceService } from './service.service';
import { companyService } from './company.service';

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
  method: ('whatsapp' | 'sms' | 'email' | 'push')[];
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
  
  // Cancellation Info
  cancelledBy?: 'client' | 'staff' | 'system';
  cancelledAt?: Timestamp;
  cancellationReason?: string;
  
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
  branchId?: string;
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
    console.log('=== CREATE APPOINTMENT CALLED ===');
    console.log('Appointment data received:', appointment);
    console.log('User ID:', userId);
    
    try {
      // Check availability first
      let dateToCheck: Date;
      if (appointment.date instanceof Timestamp) {
        dateToCheck = appointment.date.toDate();
      } else if (appointment.date.toDate && typeof appointment.date.toDate === 'function') {
        dateToCheck = appointment.date.toDate();
      } else if (appointment.date instanceof Date) {
        dateToCheck = appointment.date;
      } else {
        dateToCheck = new Date(appointment.date);
      }
      
      
      console.log('Checking appointment availability with:', {
        companyId: appointment.companyId,
        staffId: appointment.staffId,
        date: dateToCheck,
        duration: appointment.totalDuration,
        services: appointment.services
      });
      
      const isAvailable = await this.checkAvailability({
        companyId: appointment.companyId,
        staffId: appointment.staffId,
        date: dateToCheck,
        duration: appointment.totalDuration,
        serviceIds: appointment.services?.map(s => s.serviceId) || [],
      });

      console.log('Is available result:', isAvailable);
      
      if (!isAvailable) {
        throw new Error('Selected time slot is not available');
      }

      const newAppointment = {
        ...appointment,
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp,
        createdBy: userId,
        changeHistory: [{
          changedAt: Timestamp.now(),
          changedBy: userId,
          changes: ['Appointment created']
        }]
      };

      const docRef = await addDoc(collection(db, this.appointmentsCollection), newAppointment);
      
      // Handle repeat appointments if configured
      if (appointment.repeat && appointment.repeat.type !== 'none') {
        await this.createRepeatAppointments(docRef.id, appointment, userId);
      }

      // Send appointment confirmation notifications
      console.log('Checking for notifications:', appointment.notifications);
      if (appointment.notifications && appointment.notifications.length > 0) {
        const confirmationNotif = appointment.notifications.find(n => n.type === 'confirmation');
        console.log('Confirmation notification found:', confirmationNotif);
        if (confirmationNotif && confirmationNotif.method.length > 0) {
          console.log('Sending notifications via methods:', confirmationNotif.method);
          // Send notifications asynchronously (don't wait)
          this.sendAppointmentNotifications(docRef.id, newAppointment, confirmationNotif).catch(error => {
            console.error('Error sending appointment notifications:', error);
            console.error('Error details:', error.message, error.stack);
          });
        } else {
          console.log('No notification methods selected');
        }
      } else {
        console.log('No notifications configured for appointment');
      }

      // Schedule appointment reminders
      const appointmentWithId = { ...newAppointment, id: docRef.id };
      appointmentReminderService.scheduleReminders(appointmentWithId as Appointment).catch(error => {
        console.error('Error scheduling reminders:', error);
      });

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
        changedAt: Timestamp.now(),
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
      console.log('Checking availability for:', {
        companyId: query.companyId,
        staffId: query.staffId,
        date: query.date,
        duration: query.duration,
        branchId: query.branchId
      });
      
      // If no staffId is provided, skip staff-specific checks
      if (!query.staffId) {
        console.log('No staffId provided, returning true');
        return true;
      }
      
      // 1. Check business hours
      const businessHoursValid = await this.checkBusinessHours(
        query.companyId,
        query.branchId,
        query.date,
        query.duration || 30
      );

      console.log('Business hours valid:', businessHoursValid);
      
      if (!businessHoursValid) {
        return false;
      }

      // 2. Check staff working hours
      const isWorkingHours = await this.checkStaffWorkingHours(
        query.staffId!,
        query.date,
        query.duration || 30
      );

      console.log('Staff working hours valid:', isWorkingHours);
      
      if (!isWorkingHours) {
        return false;
      }

      // 3. Check for conflicting appointments
      const hasConflicts = await this.checkAppointmentConflicts(
        query.companyId,
        query.staffId!,
        query.date,
        query.duration || 30,
        query.excludeAppointmentId
      );

      console.log('Has conflicts:', hasConflicts);
      
      if (hasConflicts) {
        return false;
      }

      // 4. Check resource availability if needed
      if (query.resourceIds && query.resourceIds.length > 0) {
        const resourcesAvailable = await this.checkResourceAvailability(
          query.companyId,
          query.resourceIds,
          query.date,
          query.duration || 30,
          query.excludeAppointmentId
        );

        if (!resourcesAvailable) {
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Error checking availability:', error);
      // Don't block on errors - allow appointment creation
      return true;
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
    try {
      // Validate date
      if (!date || isNaN(date.getTime())) {
        console.error('Invalid date provided to checkStaffWorkingHours:', date);
        return false;
      }

      // Get staff member details
      const staffMember = await staffService.getStaffMember(staffId);
      if (!staffMember || !staffMember.schedule?.workingHours) {
        // If no schedule, assume standard working hours
        const hour = date.getHours();
        const endHour = addMinutes(date, duration).getHours();
        return hour >= 9 && endHour <= 18;
      }

      // Check if staff is scheduled
      if (!staffMember.schedule.isScheduled) {
        // If staff is not scheduled, allow standard working hours
        const hour = date.getHours();
        const endHour = addMinutes(date, duration).getHours();
        return hour >= 9 && endHour <= 18;
      }

      // Check if within schedule date range
      if (staffMember.schedule.scheduleStartDate) {
        const startDate = staffMember.schedule.scheduleStartDate.toDate 
          ? staffMember.schedule.scheduleStartDate.toDate()
          : staffMember.schedule.scheduleStartDate;
        if (isBefore(date, startDate)) {
          return false;
        }
      }

      if (staffMember.schedule.scheduledUntil) {
        const endDate = staffMember.schedule.scheduledUntil.toDate
          ? staffMember.schedule.scheduledUntil.toDate()
          : staffMember.schedule.scheduledUntil;
        if (isAfter(date, endDate)) {
          return false;
        }
      }

      // Get day of week
      const dayName = format(date, 'EEEE').toLowerCase();
      const daySchedule = staffMember.schedule.workingHours[dayName];


      if (!daySchedule || !daySchedule.isWorking) {
        return false;
      }

      // Check working hours
      const appointmentStart = format(date, 'HH:mm');
      const appointmentEnd = format(addMinutes(date, duration), 'HH:mm');

      const workStart = daySchedule.start || '09:00';
      const workEnd = daySchedule.end || '18:00';

      // Check if appointment is within working hours
      if (appointmentStart < workStart || appointmentEnd > workEnd) {
        return false;
      }

      // Check for breaks
      if (daySchedule.breaks && daySchedule.breaks.length > 0) {
        for (const breakTime of daySchedule.breaks) {
          // Check if appointment overlaps with break
          if (
            (appointmentStart >= breakTime.start && appointmentStart < breakTime.end) ||
            (appointmentEnd > breakTime.start && appointmentEnd <= breakTime.end) ||
            (appointmentStart <= breakTime.start && appointmentEnd >= breakTime.end)
          ) {
            return false;
          }
        }
      }

      return true;
    } catch (error) {
      console.error('Error checking staff working hours:', error);
      // Fallback to default hours
      const hour = date.getHours();
      const endHour = addMinutes(date, duration).getHours();
      return hour >= 9 && endHour <= 18;
    }
  }

  private async getStaffWorkingHours(
    staffId: string,
    date: Date
  ): Promise<{ start: Date; end: Date }[] | null> {
    try {
      const staffMember = await staffService.getStaffMember(staffId);
      if (!staffMember?.schedule?.workingHours) {
        // Return default hours if no schedule
        const defaultDate = new Date(date);
        return [{
          start: new Date(defaultDate.setHours(9, 0, 0, 0)),
          end: new Date(defaultDate.setHours(18, 0, 0, 0))
        }];
      }

      const dayName = format(date, 'EEEE').toLowerCase();
      const daySchedule = staffMember.schedule.workingHours[dayName];

      if (!daySchedule || !daySchedule.isWorking) {
        return null;
      }

      const [startHour, startMin] = (daySchedule.start || '09:00').split(':').map(Number);
      const [endHour, endMin] = (daySchedule.end || '18:00').split(':').map(Number);

      const workingHours = [{
        start: new Date(date.getFullYear(), date.getMonth(), date.getDate(), startHour, startMin, 0, 0),
        end: new Date(date.getFullYear(), date.getMonth(), date.getDate(), endHour, endMin, 0, 0)
      }];

      // If there are breaks, split the working hours
      if (daySchedule.breaks && daySchedule.breaks.length > 0) {
        const allHours: { start: Date; end: Date }[] = [];
        let currentStart = workingHours[0].start;

        for (const breakTime of daySchedule.breaks.sort((a, b) => a.start.localeCompare(b.start))) {
          const [breakStartHour, breakStartMin] = breakTime.start.split(':').map(Number);
          const [breakEndHour, breakEndMin] = breakTime.end.split(':').map(Number);

          const breakStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), breakStartHour, breakStartMin, 0, 0);
          const breakEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), breakEndHour, breakEndMin, 0, 0);

          // Add working hours before break
          if (currentStart < breakStart) {
            allHours.push({
              start: currentStart,
              end: breakStart
            });
          }

          currentStart = breakEnd;
        }

        // Add remaining hours after last break
        if (currentStart < workingHours[0].end) {
          allHours.push({
            start: currentStart,
            end: workingHours[0].end
          });
        }

        return allHours;
      }

      return workingHours;
    } catch (error) {
      console.error('Error getting staff working hours:', error);
      // Return default hours as fallback
      const defaultDate = new Date(date);
      return [{
        start: new Date(defaultDate.setHours(9, 0, 0, 0)),
        end: new Date(defaultDate.setHours(18, 0, 0, 0))
      }];
    }
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
    duration: number,
    excludeAppointmentId?: string
  ): Promise<boolean> {
    try {
      if (!resourceIds || resourceIds.length === 0) {
        return true; // No resources to check
      }

      // Calculate appointment end time
      const appointmentEnd = new Date(date);
      appointmentEnd.setMinutes(appointmentEnd.getMinutes() + duration);

      // Check each resource
      for (const resourceId of resourceIds) {
        // Get resource details
        const resource = await resourceService.getResource(resourceId);
        
        if (!resource) {
          console.warn(`Resource ${resourceId} not found`);
          continue;
        }

        // Check if resource is active
        if (resource.status !== 'active') {
          return false; // Resource is not active
        }

        // Check resource working hours if defined
        if (resource.workingHours) {
          const dayOfWeek = date.getDay();
          const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
          const dayName = dayNames[dayOfWeek];
          const daySchedule = resource.workingHours[dayName];

          if (!daySchedule || !daySchedule.isWorking) {
            return false; // Resource doesn't work on this day
          }

          if (daySchedule.start && daySchedule.end) {
            const [startHour, startMinute] = daySchedule.start.split(':').map(Number);
            const [endHour, endMinute] = daySchedule.end.split(':').map(Number);

            const workStart = new Date(date);
            workStart.setHours(startHour, startMinute, 0, 0);
            
            const workEnd = new Date(date);
            workEnd.setHours(endHour, endMinute, 0, 0);

            // Check if appointment is within working hours
            if (date < workStart || appointmentEnd > workEnd) {
              return false; // Outside working hours
            }

            // Check if appointment overlaps with any breaks
            if (daySchedule.breaks && daySchedule.breaks.length > 0) {
              for (const breakPeriod of daySchedule.breaks) {
                const [breakStartHour, breakStartMinute] = breakPeriod.start.split(':').map(Number);
                const [breakEndHour, breakEndMinute] = breakPeriod.end.split(':').map(Number);

                const breakStart = new Date(date);
                breakStart.setHours(breakStartHour, breakStartMinute, 0, 0);
                
                const breakEnd = new Date(date);
                breakEnd.setHours(breakEndHour, breakEndMinute, 0, 0);

                // Check if appointment overlaps with break
                if (areIntervalsOverlapping(
                  { start: date, end: appointmentEnd },
                  { start: breakStart, end: breakEnd }
                )) {
                  return false; // Overlaps with break
                }
              }
            }
          }
        }

        // Check for conflicts with other appointments using this resource
        const startOfDayTime = startOfDay(date);
        const endOfDayTime = endOfDay(date);

        // Query appointments that use this resource on the same day
        const q = query(
          collection(db, 'appointments'),
          where('companyId', '==', companyId),
          where('resources', 'array-contains', resourceId),
          where('date', '>=', Timestamp.fromDate(startOfDayTime)),
          where('date', '<=', Timestamp.fromDate(endOfDayTime)),
          where('status', 'in', ['pending', 'confirmed', 'in_progress'])
        );

        const querySnapshot = await getDocs(q);
        
        // Count concurrent usage
        let concurrentUsage = 0;
        
        for (const doc of querySnapshot.docs) {
          if (excludeAppointmentId && doc.id === excludeAppointmentId) {
            continue; // Skip the current appointment being edited
          }

          const existingAppointment = doc.data() as Appointment;
          const existingStart = existingAppointment.date.toDate();
          const existingEnd = new Date(existingStart);
          existingEnd.setMinutes(existingEnd.getMinutes() + existingAppointment.duration);

          // Check if appointments overlap
          if (areIntervalsOverlapping(
            { start: date, end: appointmentEnd },
            { start: existingStart, end: existingEnd }
          )) {
            concurrentUsage++;
            
            // Check if resource capacity is exceeded
            if (concurrentUsage >= (resource.capacity || 1)) {
              return false; // Resource capacity exceeded
            }
          }
        }
      }

      return true; // All resources are available
    } catch (error) {
      console.error('Error checking resource availability:', error);
      // Return true on error to not block the UI
      return true;
    }
  }

  private async createRepeatAppointments(
    originalId: string,
    appointment: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>,
    userId: string
  ): Promise<void> {
    try {
      if (!appointment.repeat || appointment.repeat.type === 'none') {
        return;
      }

      const batch = writeBatch(db);
      const repeatGroupId = originalId; // Use original appointment ID as group ID
      
      let currentDate = appointment.date.toDate ? appointment.date.toDate() : new Date(appointment.date as any);
      const maxOccurrences = appointment.repeat.maxOccurrences || 52; // Default to 52 occurrences (1 year for weekly)
      let occurrences = 0;
      
      // Calculate end date if using maxOccurrences
      const endDate = appointment.repeat.endDate 
        ? (appointment.repeat.endDate.toDate ? appointment.repeat.endDate.toDate() : new Date(appointment.repeat.endDate as any))
        : null;

      while (occurrences < maxOccurrences - 1) { // -1 because the original appointment counts as first occurrence
        // Calculate next date based on repeat type
        if (appointment.repeat.type === 'daily') {
          currentDate = addDays(currentDate, appointment.repeat.interval);
        } else if (appointment.repeat.type === 'weekly') {
          currentDate = addWeeks(currentDate, appointment.repeat.interval);
        } else if (appointment.repeat.type === 'monthly') {
          currentDate = addMonths(currentDate, appointment.repeat.interval);
        }

        // Check if we've passed the end date
        if (endDate && currentDate > endDate) {
          break;
        }

        // Create new appointment
        const newAppointmentRef = doc(collection(db, this.appointmentsCollection));
        const newAppointment = {
          ...appointment,
          date: Timestamp.fromDate(currentDate),
          repeatGroupId,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          createdBy: userId,
          changeHistory: [{
            changedAt: Timestamp.now(),
            changedBy: userId,
            changes: ['Recurring appointment created']
          }]
        };

        batch.set(newAppointmentRef, newAppointment);
        occurrences++;
      }

      // Update original appointment with repeatGroupId
      const originalRef = doc(db, this.appointmentsCollection, originalId);
      batch.update(originalRef, { repeatGroupId });

      await batch.commit();
      console.log(`Created ${occurrences} recurring appointments`);
    } catch (error) {
      console.error('Error creating recurring appointments:', error);
      throw error;
    }
  }

  // Get appointments by client
  async getClientAppointments(
    companyId: string,
    clientId: string,
    maxResults?: number,
    branchId?: string
  ): Promise<Appointment[]> {
    try {
      const constraints: QueryConstraint[] = [
        where('companyId', '==', companyId),
        where('clientId', '==', clientId)
      ];

      // Filter by branch if provided
      if (branchId) {
        constraints.push(where('branchId', '==', branchId));
      }

      constraints.push(orderBy('date', 'desc'));

      if (maxResults) {
        constraints.push(limit(maxResults));
      }

      const q = query(collection(db, this.appointmentsCollection), ...constraints);
      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Appointment));
    } catch (error) {
      console.error('Error getting client appointments:', error);
      // If orderBy fails due to missing index, try without ordering
      if (error instanceof Error && error.message.includes('index')) {
        try {
          const simpleQuery = query(
            collection(db, this.appointmentsCollection),
            where('companyId', '==', companyId),
            where('clientId', '==', clientId)
          );
          const snapshot = await getDocs(simpleQuery);
          
          // Sort on client side
          const appointments = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Appointment));
          
          return appointments.sort((a, b) => {
            const dateA = a.date.toDate ? a.date.toDate() : new Date(a.date as any);
            const dateB = b.date.toDate ? b.date.toDate() : new Date(b.date as any);
            return dateB.getTime() - dateA.getTime();
          });
        } catch (fallbackError) {
          console.error('Error in fallback query:', fallbackError);
          throw fallbackError;
        }
      }
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
    try {
      console.log('Getting staff working hours for:', { staffId, date });
      
      // Get staff member details
      const staff = await staffService.getStaffMember(staffId);
      
      console.log('Staff found:', !!staff);
      console.log('Staff schedule:', staff?.schedule);
      
      if (!staff || !staff.schedule?.isScheduled || !staff.schedule?.workingHours) {
        console.log('No schedule found, using default hours');
        // Return default working hours if no schedule is set
        const workStart = new Date(date);
        workStart.setHours(9, 0, 0, 0);
        
        const workEnd = new Date(date);
        workEnd.setHours(21, 0, 0, 0);
        
        return [{
          start: workStart,
          end: workEnd
        }];
      }

      // Check if the date is within the staff's scheduled period
      if (staff.schedule.scheduleStartDate) {
        const scheduleStart = staff.schedule.scheduleStartDate.toDate();
        if (date < scheduleStart) {
          return []; // Staff not scheduled yet for this date
        }
      }

      if (staff.schedule.scheduledUntil) {
        const scheduleEnd = staff.schedule.scheduledUntil.toDate();
        if (date > scheduleEnd) {
          return []; // Staff schedule has ended
        }
      }

      // Get the day of week (0 = Sunday, 1 = Monday, etc.)
      const dayOfWeek = date.getDay();
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = dayNames[dayOfWeek];

      const daySchedule = staff.schedule.workingHours[dayName];
      
      console.log(`Checking ${dayName} schedule:`, daySchedule);
      
      if (!daySchedule || !daySchedule.isWorking || !daySchedule.start || !daySchedule.end) {
        console.log(`Staff doesn't work on ${dayName}:`, {
          hasSchedule: !!daySchedule,
          isWorking: daySchedule?.isWorking,
          hasStart: !!daySchedule?.start,
          hasEnd: !!daySchedule?.end
        });
        return []; // Staff doesn't work on this day
      }

      // Parse working hours
      const [startHour, startMinute] = daySchedule.start.split(':').map(Number);
      const [endHour, endMinute] = daySchedule.end.split(':').map(Number);

      const workStart = new Date(date);
      workStart.setHours(startHour, startMinute, 0, 0);
      
      const workEnd = new Date(date);
      workEnd.setHours(endHour, endMinute, 0, 0);

      // If there are no breaks, return single working period
      if (!daySchedule.breaks || daySchedule.breaks.length === 0) {
        return [{
          start: workStart,
          end: workEnd
        }];
      }

      // Handle breaks - split working hours into multiple periods
      const periods: { start: Date; end: Date }[] = [];
      let currentStart = workStart;

      for (const breakPeriod of daySchedule.breaks) {
        const [breakStartHour, breakStartMinute] = breakPeriod.start.split(':').map(Number);
        const [breakEndHour, breakEndMinute] = breakPeriod.end.split(':').map(Number);

        const breakStart = new Date(date);
        breakStart.setHours(breakStartHour, breakStartMinute, 0, 0);
        
        const breakEnd = new Date(date);
        breakEnd.setHours(breakEndHour, breakEndMinute, 0, 0);

        // Add working period before break
        if (currentStart < breakStart) {
          periods.push({
            start: new Date(currentStart),
            end: new Date(breakStart)
          });
        }

        currentStart = breakEnd;
      }

      // Add final working period after last break
      if (currentStart < workEnd) {
        periods.push({
          start: new Date(currentStart),
          end: new Date(workEnd)
        });
      }

      return periods;
    } catch (error) {
      console.error('Error getting staff working hours:', error);
      // Return default working hours on error
      const workStart = new Date(date);
      workStart.setHours(9, 0, 0, 0);
      
      const workEnd = new Date(date);
      workEnd.setHours(21, 0, 0, 0);
      
      return [{
        start: workStart,
        end: workEnd
      }];
    }
  }

  // Helper method: Check if time is within staff working hours
  private async checkStaffWorkingHours(
    staffId: string,
    date: Date,
    duration: number
  ): Promise<boolean> {
    try {
      console.log('Checking staff working hours:', { staffId, date, duration });
      
      const workingPeriods = await this.getStaffWorkingHours(staffId, date);
      
      console.log('Working periods:', workingPeriods);
      
      if (workingPeriods.length === 0) {
        console.log('No working periods found');
        return false; // Staff doesn't work on this day
      }

      // Calculate appointment end time
      const appointmentEnd = new Date(date);
      appointmentEnd.setMinutes(appointmentEnd.getMinutes() + duration);
      
      console.log('Appointment time range:', { start: date, end: appointmentEnd });

      // Check if the appointment fits within any working period
      for (const period of workingPeriods) {
        console.log('Checking period:', period);
        if (date >= period.start && appointmentEnd <= period.end) {
          console.log('Appointment fits in this period');
          return true; // Appointment fits within this working period
        }
      }

      console.log('Appointment does not fit in any working period');
      return false; // Appointment doesn't fit within any working period
    } catch (error) {
      console.error('Error checking staff working hours:', error);
      // Return true on error to not block the UI
      return true;
    }
  }

  // Helper method: Check if appointment is within business hours
  private async checkBusinessHours(
    companyId: string,
    branchId: string | undefined,
    date: Date,
    duration: number
  ): Promise<boolean> {
    try {
      // Get location settings for business hours
      const locationSettings = await locationService.getLocationSettings(companyId, branchId);
      
      if (!locationSettings?.contactDetails?.businessHours) {
        // If no business hours are set, allow all times
        return true;
      }

      // Check if appointment fits within business hours
      const fitsWithinHours = appointmentFitsWithinBusinessHours(
        date,
        duration,
        locationSettings.contactDetails.businessHours
      );

      return fitsWithinHours;
    } catch (error) {
      console.error('Error checking business hours:', error);
      // Return true on error to not block the UI
      return true;
    }
  }

  // Get available time slots for a specific date
  async getAvailableTimeSlots(
    companyId: string,
    branchId: string | undefined,
    staffId: string,
    date: Date,
    duration: number,
    resourceIds?: string[]
  ): Promise<Date[]> {
    try {
      const availableSlots: Date[] = [];
      
      // Get business hours
      const locationSettings = await locationService.getLocationSettings(companyId, branchId);
      const businessHours = locationSettings?.contactDetails?.businessHours;
      
      if (!businessHours) {
        // If no business hours set, use default 9 AM to 9 PM
        const startTime = new Date(date);
        startTime.setHours(9, 0, 0, 0);
        const endTime = new Date(date);
        endTime.setHours(21, 0, 0, 0);
        
        let currentSlot = new Date(startTime);
        while (currentSlot < endTime) {
          const query: AvailabilityQuery = {
            companyId,
            branchId,
            staffId,
            date: new Date(currentSlot),
            duration,
            resourceIds
          };
          
          const isAvailable = await this.checkAvailability(query);
          if (isAvailable) {
            availableSlots.push(new Date(currentSlot));
          }
          
          currentSlot.setMinutes(currentSlot.getMinutes() + 30); // 30-minute slots
        }
      } else {
        // Parse business hours and get slots
        const { getAvailableTimeSlots } = await import('../utils/businessHours');
        const potentialSlots = getAvailableTimeSlots(date, 30, businessHours);
        
        // Check each potential slot for availability
        for (const slot of potentialSlots) {
          const query: AvailabilityQuery = {
            companyId,
            branchId,
            staffId,
            date: slot,
            duration,
            resourceIds
          };
          
          const isAvailable = await this.checkAvailability(query);
          if (isAvailable) {
            availableSlots.push(slot);
          }
        }
      }
      
      return availableSlots;
    } catch (error) {
      console.error('Error getting available time slots:', error);
      return [];
    }
  }

  // Send appointment notifications
  private async sendAppointmentNotifications(
    appointmentId: string,
    appointment: Appointment,
    notification: AppointmentNotification
  ): Promise<void> {
    console.log('=== SENDING APPOINTMENT NOTIFICATIONS ===');
    console.log('Appointment ID:', appointmentId);
    console.log('Notification config:', notification);
    
    try {
      // Get client details
      const client = await clientService.getClient(appointment.clientId);
      if (!client) {
        console.error('Client not found for appointment notifications');
        return;
      }
      
      console.log('Client found:', client.name, client.phone);

      // Get staff details
      const staff = await staffService.getStaffMember(appointment.staffId);
      
      // Get service details
      let serviceName = 'Service';
      if (appointment.services && appointment.services.length > 0) {
        const service = await serviceService.getService(appointment.services[0].serviceId);
        if (service) {
          serviceName = service.name;
        }
      }

      // Get business details - use 'main' if no branchId
      const branchId = appointment.branchId || 'main';
      console.log('Getting location settings for branch:', branchId);
      let locationSettings = await locationService.getLocationSettings(appointment.companyId, branchId);
      
      // If no settings found and we're trying 'main', also try branch '1' as fallback
      if ((!locationSettings || !locationSettings.basic?.businessName) && branchId === 'main') {
        console.log('No settings found for main branch, trying branch 1 as fallback');
        locationSettings = await locationService.getLocationSettings(appointment.companyId, '1');
      }
      
      console.log('Location settings loaded:', JSON.stringify(locationSettings, null, 2));
      
      // Get company details as fallback
      const company = await companyService.getCompanyInfo(appointment.companyId);
      console.log('Company data:', company);
      
      // Get branch details
      let branchData: any = null;
      try {
        const branchDoc = await getDoc(doc(db, 'companies', appointment.companyId, 'branches', branchId));
        if (branchDoc.exists()) {
          branchData = { id: branchDoc.id, ...branchDoc.data() };
          console.log('Branch data loaded:', branchData);
        }
      } catch (error) {
        console.error('Error loading branch:', error);
      }
      
      // Use branch name for the appointment, fallback to business name
      const businessName = branchData?.name || 
                          locationSettings?.basic?.locationName || 
                          locationSettings?.basic?.businessName || 
                          company?.businessName || 
                          company?.name || 
                          'Our Business';
      
      // Format address properly from branch data
      let businessAddress = '';
      if (branchData?.address) {
        if (typeof branchData.address === 'string') {
          businessAddress = branchData.address;
        } else if (branchData.address.street || branchData.address.city) {
          businessAddress = [branchData.address.street, branchData.address.city]
            .filter(Boolean)
            .join(', ');
        }
      }
      if (!businessAddress && locationSettings?.contact?.address) {
        businessAddress = locationSettings.contact.address;
      }
                             
      // Get phone number with proper formatting
      let businessPhone = '';
      if (branchData?.contact?.phones && branchData.contact.phones.length > 0) {
        // Use branch phone if available
        const phone = branchData.contact.phones.find((p: any) => p.isPrimary) || branchData.contact.phones[0];
        businessPhone = phone.number || '';
      } else if (branchData?.phone) {
        // Legacy single phone field
        businessPhone = branchData.phone;
      } else if (locationSettings?.contact?.phones && locationSettings.contact.phones.length > 0) {
        const phone = locationSettings.contact.phones[0];
        // Combine country code and number
        businessPhone = `${phone.countryCode || ''}${phone.number || ''}`.trim();
      }
      
      // Create Google Maps link if we have coordinates
      let googleMapsLink = '';
      // First try branch coordinates
      if (branchData?.coordinates?.lat && branchData?.coordinates?.lng) {
        const { lat, lng } = branchData.coordinates;
        googleMapsLink = `https://maps.google.com/?q=${lat},${lng}`;
        console.log('Google Maps link created from branch:', googleMapsLink);
      } else if (locationSettings?.contact?.coordinates?.lat && locationSettings?.contact?.coordinates?.lng) {
        // Fallback to location settings coordinates
        const { lat, lng } = locationSettings.contact.coordinates;
        googleMapsLink = `https://maps.google.com/?q=${lat},${lng}`;
        console.log('Google Maps link created from location settings:', googleMapsLink);
      } else {
        console.log('No map coordinates found in branch or location settings');
      }

      // Send WhatsApp notification
      const clientPhone = client.primaryPhone || client.phone || client.phoneNumbers?.[0]?.number || appointment.clientPhone;
      console.log('Client phone for WhatsApp:', clientPhone);
      console.log('Notification methods:', notification.method);
      
      if (notification.method.includes('whatsapp') && clientPhone) {
        try {
          console.log('Sending WhatsApp confirmation to:', clientPhone);
          const result = await whatsAppService.sendAppointmentConfirmation(appointment.companyId, {
            appointmentId,
            clientId: appointment.clientId,
            clientName: appointment.clientName,
            clientPhone: clientPhone,
            date: appointment.date.toDate(),
            time: appointment.time || appointment.startTime,
            service: serviceName,
            staffName: appointment.staffName,
            businessName,
            businessAddress,
            businessPhone,
            googleMapsLink,
            language: 'ar' // TODO: Get from client preferences
          });
          console.log('WhatsApp send result:', result);
        } catch (error) {
          console.error('Error sending WhatsApp notification:', error);
        }
      } else {
        console.log('WhatsApp not sent - Method includes WhatsApp:', notification.method.includes('whatsapp'), 'Has phone:', !!clientPhone);
      }

      // TODO: Implement SMS notification
      if (notification.method.includes('sms')) {
        console.log('SMS notification not implemented yet');
      }

      // TODO: Implement email notification
      if (notification.method.includes('email')) {
        console.log('Email notification not implemented yet');
      }

      // Update notification status
      await this.updateAppointmentNotificationStatus(appointmentId, notification.type, true);
    } catch (error) {
      console.error('Error sending appointment notifications:', error);
      throw error;
    }
  }

  // Update notification status
  private async updateAppointmentNotificationStatus(
    appointmentId: string,
    notificationType: 'confirmation' | 'reminder' | 'follow_up',
    sent: boolean
  ): Promise<void> {
    try {
      const appointment = await this.getAppointment(appointmentId);
      if (!appointment) return;

      const notifications = appointment.notifications || [];
      const notifIndex = notifications.findIndex(n => n.type === notificationType);
      
      if (notifIndex >= 0) {
        notifications[notifIndex].sent = sent;
        notifications[notifIndex].sentAt = Timestamp.now(); // Use Timestamp.now() instead of serverTimestamp()
      }

      await updateDoc(doc(db, this.appointmentsCollection, appointmentId), {
        notifications,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating notification status:', error);
    }
  }
}

export const appointmentService = new AppointmentService();