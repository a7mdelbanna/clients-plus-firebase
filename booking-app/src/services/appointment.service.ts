import { db } from '../config/firebase';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  QueryConstraint,
  limit,
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