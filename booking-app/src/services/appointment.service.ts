import { db } from '../config/firebase';
import {
  collection,
  doc,
  getDoc,
  updateDoc,
  query,
  where,
  orderBy,
  getDocs,
  QueryConstraint,
  limit,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';

export interface Appointment {
  id?: string;
  companyId: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  date: any; // Firestore Timestamp
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

class AppointmentService {
  // Cancel an appointment
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
      
      // First, get the appointment to verify ownership
      const appointmentDoc = await getDoc(doc(db, 'appointments', appointmentId));
      
      if (!appointmentDoc.exists()) {
        throw new Error('Appointment not found');
      }
      
      const appointment = appointmentDoc.data() as Appointment;
      
      // Verify the client owns this appointment
      if (appointment.clientId !== clientId) {
        console.error('Client ID mismatch:', {
          appointmentClientId: appointment.clientId,
          requestClientId: clientId
        });
        throw new Error('Unauthorized: You can only cancel your own appointments');
      }
      
      // Check if appointment can be cancelled (only pending or confirmed)
      if (!['pending', 'confirmed'].includes(appointment.status)) {
        throw new Error(`Cannot cancel appointment with status: ${appointment.status}`);
      }
      
      // Check if appointment is in the future
      const appointmentDate = appointment.date.toDate ? appointment.date.toDate() : new Date(appointment.date);
      if (appointmentDate < new Date()) {
        throw new Error('Cannot cancel past appointments');
      }
      
      // Update the appointment status
      const updates: any = {
        status: 'cancelled',
        updatedAt: serverTimestamp()
      };
      
      // Add cancellation reason if provided
      if (reason) {
        updates.cancellationReason = reason;
        updates.cancelledBy = 'client';
        updates.cancelledAt = serverTimestamp();
      }
      
      await updateDoc(doc(db, 'appointments', appointmentId), updates);
      
      console.log('Appointment cancelled successfully');
      console.log('=== cancelAppointment END ===');
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      throw error;
    }
  }

  // Reschedule an appointment
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
      
      // First, get the appointment to verify ownership
      const appointmentDoc = await getDoc(doc(db, 'appointments', appointmentId));
      
      if (!appointmentDoc.exists()) {
        throw new Error('Appointment not found');
      }
      
      const appointment = appointmentDoc.data() as Appointment;
      
      // Verify the client owns this appointment
      if (appointment.clientId !== clientId) {
        console.error('Client ID mismatch:', {
          appointmentClientId: appointment.clientId,
          requestClientId: clientId
        });
        throw new Error('Unauthorized: You can only reschedule your own appointments');
      }
      
      // Check if appointment can be rescheduled (only pending or confirmed)
      if (!['pending', 'confirmed'].includes(appointment.status)) {
        throw new Error(`Cannot reschedule appointment with status: ${appointment.status}`);
      }
      
      // Check if current appointment is in the future
      const currentAppointmentDate = appointment.date.toDate ? appointment.date.toDate() : new Date(appointment.date);
      if (currentAppointmentDate < new Date()) {
        throw new Error('Cannot reschedule past appointments');
      }
      
      // Check if new date is in the future
      if (newDate < new Date()) {
        throw new Error('Cannot reschedule to a past date');
      }
      
      // TODO: Add availability checking here
      // For now, we'll just update the appointment
      // In the next step, we'll add proper availability checking
      
      // Update the appointment with new date and time
      const updates: any = {
        date: Timestamp.fromDate(newDate),
        startTime: newStartTime,
        endTime: newEndTime,
        updatedAt: serverTimestamp(),
        // Add reschedule tracking
        lastRescheduledAt: serverTimestamp(),
        lastRescheduledBy: 'client',
        // Keep the appointment as pending after reschedule
        // The business can confirm it again
        status: 'pending'
      };
      
      await updateDoc(doc(db, 'appointments', appointmentId), updates);
      
      console.log('Appointment rescheduled successfully');
      console.log('=== rescheduleAppointment END ===');
    } catch (error) {
      console.error('Error rescheduling appointment:', error);
      throw error;
    }
  }

  // Check if a time slot is available
  async checkTimeSlotAvailability(
    companyId: string,
    staffId: string,
    date: Date,
    startTime: string,
    duration: number
  ): Promise<boolean> {
    try {
      console.log('=== checkTimeSlotAvailability START ===');
      console.log('Checking availability for:', {
        companyId,
        staffId,
        date,
        startTime,
        duration
      });
      
      // Get start and end of the day for the query
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      // Query appointments for the same staff on the same day
      // Using the same approach as booking.service.ts to avoid complex index requirements
      const appointmentsQuery = query(
        collection(db, 'appointments'),
        where('staffId', '==', staffId),
        where('date', '>=', Timestamp.fromDate(startOfDay)),
        where('date', '<=', Timestamp.fromDate(endOfDay))
      );
      
      const snapshot = await getDocs(appointmentsQuery);
      
      if (snapshot.empty) {
        console.log('No appointments found for this staff on this day');
        return true;
      }
      
      // Filter results on client side for company and status
      const relevantAppointments = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Appointment))
        .filter(apt => 
          apt.companyId === companyId && 
          ['pending', 'confirmed', 'in_progress'].includes(apt.status) &&
          apt.status !== 'rescheduled' // Exclude rescheduled appointments
        );
      
      if (relevantAppointments.length === 0) {
        console.log('No relevant appointments found after filtering');
        return true;
      }
      
      // Check for time conflicts
      const requestedStartMinutes = this.timeToMinutes(startTime);
      const requestedEndMinutes = requestedStartMinutes + duration;
      
      for (const appointment of relevantAppointments) {
        const appointmentStartMinutes = this.timeToMinutes(appointment.startTime);
        const appointmentEndMinutes = this.timeToMinutes(appointment.endTime);
        
        // Check if there's an overlap
        if (
          (requestedStartMinutes >= appointmentStartMinutes && requestedStartMinutes < appointmentEndMinutes) ||
          (requestedEndMinutes > appointmentStartMinutes && requestedEndMinutes <= appointmentEndMinutes) ||
          (requestedStartMinutes <= appointmentStartMinutes && requestedEndMinutes >= appointmentEndMinutes)
        ) {
          console.log('Time slot conflicts with existing appointment:', appointment.id);
          return false;
        }
      }
      
      console.log('Time slot is available');
      console.log('=== checkTimeSlotAvailability END ===');
      return true;
    } catch (error) {
      console.error('Error checking time slot availability:', error);
      
      // If it's an index error, try a simpler approach
      if (error instanceof Error && error.message.includes('index')) {
        console.log('Index error detected, using fallback approach');
        try {
          // Simple query by staffId only
          const simpleQuery = query(
            collection(db, 'appointments'),
            where('staffId', '==', staffId)
          );
          
          const simpleSnapshot = await getDocs(simpleQuery);
          
          // Filter on client side
          const relevantAppointments = simpleSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Appointment))
            .filter(apt => {
              const aptDate = apt.date.toDate ? apt.date.toDate() : new Date(apt.date);
              return apt.companyId === companyId &&
                     aptDate >= startOfDay &&
                     aptDate <= endOfDay &&
                     ['pending', 'confirmed', 'in_progress'].includes(apt.status) &&
                     apt.status !== 'rescheduled'; // Exclude rescheduled appointments
            });
          
          // Check for time conflicts
          const requestedStartMinutes = this.timeToMinutes(startTime);
          const requestedEndMinutes = requestedStartMinutes + duration;
          
          for (const appointment of relevantAppointments) {
            const appointmentStartMinutes = this.timeToMinutes(appointment.startTime);
            const appointmentEndMinutes = this.timeToMinutes(appointment.endTime);
            
            // Check if there's an overlap
            if (
              (requestedStartMinutes >= appointmentStartMinutes && requestedStartMinutes < appointmentEndMinutes) ||
              (requestedEndMinutes > appointmentStartMinutes && requestedEndMinutes <= appointmentEndMinutes) ||
              (requestedStartMinutes <= appointmentStartMinutes && requestedEndMinutes >= appointmentEndMinutes)
            ) {
              console.log('Time slot conflicts with existing appointment:', appointment.id);
              return false;
            }
          }
          
          console.log('Time slot is available (fallback)');
          return true;
        } catch (fallbackError) {
          console.error('Fallback also failed:', fallbackError);
          return false;
        }
      }
      
      // In case of other errors, return false to be safe
      return false;
    }
  }
  
  // Helper function to convert time string to minutes
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  // Get available time slots for a specific date and staff
  async getAvailableTimeSlots(
    companyId: string,
    staffId: string,
    date: Date,
    duration: number,
    workingHours?: { start: string; end: string }
  ): Promise<{ time: string; available: boolean }[]> {
    try {
      console.log('=== getAvailableTimeSlots START ===');
      console.log('Parameters:', { companyId, staffId, date, duration, workingHours });
      
      // Handle "any" staff selection - return all slots as available
      if (!staffId || staffId === 'any' || staffId.trim() === '') {
        console.log('Any staff selected - returning default available slots');
        const startTime = workingHours?.start || '09:00';
        const endTime = workingHours?.end || '21:00'; // 9 PM like booking service
        const slots: { time: string; available: boolean }[] = [];
        const slotInterval = 30; // 30-minute slots
        
        let currentMinutes = this.timeToMinutes(startTime);
        const endMinutes = this.timeToMinutes(endTime);
        
        while (currentMinutes + duration <= endMinutes) {
          const hours = Math.floor(currentMinutes / 60);
          const minutes = currentMinutes % 60;
          const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
          
          slots.push({
            time: timeString,
            available: true
          });
          
          currentMinutes += slotInterval;
        }
        
        return slots;
      }
      
      // Default working hours if not provided
      const startTime = workingHours?.start || '09:00';
      const endTime = workingHours?.end || '21:00'; // 9 PM like booking service
      
      const slots: { time: string; available: boolean }[] = [];
      const slotInterval = 30; // 30-minute slots
      
      // Generate all possible time slots
      let currentMinutes = this.timeToMinutes(startTime);
      const endMinutes = this.timeToMinutes(endTime);
      
      while (currentMinutes + duration <= endMinutes) {
        const hours = Math.floor(currentMinutes / 60);
        const minutes = currentMinutes % 60;
        const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        
        // Check if this slot is available
        const isAvailable = await this.checkTimeSlotAvailability(
          companyId,
          staffId,
          date,
          timeString,
          duration
        );
        
        slots.push({
          time: timeString,
          available: isAvailable
        });
        
        currentMinutes += slotInterval;
      }
      
      console.log(`Generated ${slots.length} time slots`);
      console.log('=== getAvailableTimeSlots END ===');
      return slots;
    } catch (error) {
      console.error('Error getting available time slots:', error);
      return [];
    }
  }

  // Get appointments by client ID (same as dashboard VisitHistory)
  async getClientAppointments(
    companyId: string,
    clientId: string,
    maxResults?: number
  ): Promise<Appointment[]> {
    try {
      const constraints: QueryConstraint[] = [
        where('companyId', '==', companyId),
        where('clientId', '==', clientId),
        orderBy('date', 'desc')
      ];

      if (maxResults) {
        constraints.push(limit(maxResults));
      }

      const q = query(collection(db, 'appointments'), ...constraints);
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
          console.log('Index not ready, trying fallback query without ordering');
          const simpleQuery = query(
            collection(db, 'appointments'),
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
            const dateA = a.date.toDate ? a.date.toDate() : new Date(a.date);
            const dateB = b.date.toDate ? b.date.toDate() : new Date(b.date);
            return dateB.getTime() - dateA.getTime();
          });
        } catch (fallbackError) {
          console.error('Fallback query also failed:', fallbackError);
          
          // Ultimate fallback: Get all company appointments and filter client-side
          try {
            console.log('Using ultimate fallback - fetching all company appointments');
            const companyQuery = query(
              collection(db, 'appointments'),
              where('companyId', '==', companyId)
            );
            const snapshot = await getDocs(companyQuery);
            
            // Filter by clientId on client side
            const appointments = snapshot.docs
              .map(doc => ({
                id: doc.id,
                ...doc.data()
              } as Appointment))
              .filter(apt => apt.clientId === clientId);
            
            // Sort by date
            appointments.sort((a, b) => {
              const dateA = a.date.toDate ? a.date.toDate() : new Date(a.date);
              const dateB = b.date.toDate ? b.date.toDate() : new Date(b.date);
              return dateB.getTime() - dateA.getTime();
            });
            
            // Apply limit if specified
            if (maxResults && appointments.length > maxResults) {
              return appointments.slice(0, maxResults);
            }
            
            return appointments;
          } catch (ultimateError) {
            console.error('Ultimate fallback also failed:', ultimateError);
            // Return empty array instead of throwing
            return [];
          }
        }
      }
      throw error;
    }
  }

  // Get appointments by phone number (for clients without real ID)
  async getClientAppointmentsByPhone(
    companyId: string,
    phoneNumber: string,
    maxResults?: number
  ): Promise<Appointment[]> {
    console.log('=== getClientAppointmentsByPhone START ===');
    console.log('CompanyId:', companyId);
    console.log('Original PhoneNumber:', phoneNumber);
    console.log('MaxResults:', maxResults);
    
    // Normalize phone number - remove spaces, dashes, and country code if present
    // This matches how booking.service.ts stores phone numbers
    let normalizedPhone = phoneNumber.replace(/[\s\-\(\)]/g, '').replace(/^\+20/, '');
    
    // If the normalized phone doesn't start with 0, add it (Egyptian format)
    if (normalizedPhone && !normalizedPhone.startsWith('0')) {
      normalizedPhone = '0' + normalizedPhone;
    }
    
    console.log('Normalized PhoneNumber:', normalizedPhone);
    
    try {
      const constraints: QueryConstraint[] = [
        where('companyId', '==', companyId),
        where('clientPhone', '==', normalizedPhone),
        orderBy('date', 'desc')
      ];

      if (maxResults) {
        constraints.push(limit(maxResults));
      }

      console.log('Attempting primary query with ordering...');
      const q = query(collection(db, 'appointments'), ...constraints);
      const snapshot = await getDocs(q);
      
      console.log('Primary query successful! Found', snapshot.size, 'appointments');
      const appointments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Appointment));
      
      console.log('=== getClientAppointmentsByPhone SUCCESS ===');
      return appointments;
    } catch (error: any) {
      console.error('Primary query failed:', error);
      console.error('Error code:', error?.code);
      console.error('Error message:', error?.message);
      
      // Check for index error in various ways
      const isIndexError = 
        (error?.code === 'failed-precondition') ||
        (error?.message && error.message.includes('index')) ||
        (error?.message && error.message.includes('requires an index'));
      
      console.log('Is index error?', isIndexError);
      
      if (isIndexError) {
        try {
          // First try without orderBy
          console.log('=== FALLBACK 1: Trying without ordering ===');
          const simpleQuery = query(
            collection(db, 'appointments'),
            where('companyId', '==', companyId),
            where('clientPhone', '==', normalizedPhone)
          );
          const snapshot = await getDocs(simpleQuery);
          
          console.log('Fallback 1 successful! Found', snapshot.size, 'appointments');
          
          // Sort on client side
          const appointments = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Appointment));
          
          appointments.sort((a, b) => {
            const dateA = a.date.toDate ? a.date.toDate() : new Date(a.date);
            const dateB = b.date.toDate ? b.date.toDate() : new Date(b.date);
            return dateB.getTime() - dateA.getTime();
          });
          
          console.log('=== getClientAppointmentsByPhone FALLBACK 1 SUCCESS ===');
          return appointments;
        } catch (fallbackError: any) {
          console.error('Fallback 1 failed:', fallbackError);
          console.error('Fallback error code:', fallbackError?.code);
          console.error('Fallback error message:', fallbackError?.message);
          
          // Ultimate fallback: Get all company appointments and filter client-side
          try {
            console.log('=== FALLBACK 2: Fetching all company appointments ===');
            const companyQuery = query(
              collection(db, 'appointments'),
              where('companyId', '==', companyId)
            );
            const snapshot = await getDocs(companyQuery);
            
            console.log('Fallback 2: Found', snapshot.size, 'total company appointments');
            
            // Filter by phone on client side
            const allAppointments = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            } as Appointment));
            
            console.log('Sample appointment data:', allAppointments.slice(0, 2));
            
            const appointments = allAppointments.filter(apt => {
              console.log('Checking appointment:', apt.id, 'clientPhone:', apt.clientPhone, 'matches?', apt.clientPhone === normalizedPhone);
              return apt.clientPhone === normalizedPhone;
            });
            
            console.log('Filtered to', appointments.length, 'appointments for normalized phone', normalizedPhone);
            
            // Sort by date
            appointments.sort((a, b) => {
              const dateA = a.date.toDate ? a.date.toDate() : new Date(a.date);
              const dateB = b.date.toDate ? b.date.toDate() : new Date(b.date);
              return dateB.getTime() - dateA.getTime();
            });
            
            // Apply limit if specified
            if (maxResults && appointments.length > maxResults) {
              return appointments.slice(0, maxResults);
            }
            
            console.log('=== getClientAppointmentsByPhone FALLBACK 2 SUCCESS ===');
            return appointments;
          } catch (ultimateError) {
            console.error('Fallback 2 (ultimate) failed:', ultimateError);
            console.log('=== getClientAppointmentsByPhone FAILED - Returning empty array ===');
            return [];
          }
        }
      }
      
      // Not an index error, re-throw
      console.error('Not an index error, re-throwing...');
      throw error;
    }
  }
}

export const appointmentService = new AppointmentService();