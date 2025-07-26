import { db } from '../config/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  addDoc,
  updateDoc,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import type { BookingLink, Branch, Service, Staff, Appointment, TimeSlot } from '../types/booking';

class BookingService {
  // Get public booking link by company and link slugs
  async getPublicBookingLink(companySlug: string, linkSlug: string): Promise<BookingLink | null> {
    try {
      console.log('Fetching company with slug:', companySlug);
      
      // First get company by slug
      const companyQuery = query(
        collection(db, 'companies'),
        where('slug', '==', companySlug)
      );
      const companySnap = await getDocs(companyQuery);
      
      console.log('Company query result:', companySnap.empty ? 'empty' : `found ${companySnap.size} companies`);
      
      if (companySnap.empty) return null;
      
      const companyId = companySnap.docs[0].id;
      console.log('Found company ID:', companyId);
      
      // Then get the booking link
      const linkQuery = query(
        collection(db, 'bookingLinks'),
        where('companyId', '==', companyId),
        where('slug', '==', linkSlug),
        where('isActive', '==', true)
      );
      
      const linkSnap = await getDocs(linkQuery);
      console.log('Booking link query result:', linkSnap.empty ? 'empty' : `found ${linkSnap.size} links`);
      
      if (linkSnap.empty) return null;
      
      return {
        id: linkSnap.docs[0].id,
        ...linkSnap.docs[0].data()
      } as BookingLink;
    } catch (error) {
      console.error('Error getting public booking link:', error);
      throw error;
    }
  }

  // Track link view
  async trackLinkView(linkId: string): Promise<void> {
    try {
      const linkRef = doc(db, 'bookingLinks', linkId);
      const linkDoc = await getDoc(linkRef);
      
      if (!linkDoc.exists()) return;
      
      const linkData = linkDoc.data() as BookingLink;
      const today = new Date().toISOString().split('T')[0];
      const analytics = linkData.analytics || {
        views: 0,
        uniqueViews: 0,
        bookings: 0,
        conversionRate: 0,
        viewsByDate: {},
        bookingsByDate: {},
      };
      
      // Update view counts
      analytics.views++;
      analytics.viewsByDate[today] = (analytics.viewsByDate[today] || 0) + 1;
      analytics.lastViewedAt = Timestamp.now();
      
      await updateDoc(linkRef, { analytics });
    } catch (error) {
      console.error('Error tracking link view:', error);
      // Don't throw - tracking shouldn't break the app
    }
  }

  // Get branches for booking
  async getBranchesForBooking(companyId: string, branchIds?: string[]): Promise<Branch[]> {
    try {
      const branchesRef = collection(db, 'companies', companyId, 'branches');
      let q = query(branchesRef, where('status', '==', 'active'));
      
      const snapshot = await getDocs(q);
      let branches = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Branch[];
      
      // Filter by allowed branch IDs if provided
      if (branchIds && branchIds.length > 0) {
        branches = branches.filter(branch => branchIds.includes(branch.id));
      }
      
      return branches;
    } catch (error) {
      console.error('Error getting branches:', error);
      throw error;
    }
  }

  // Get services for booking
  async getServicesForBooking(companyId: string, branchId: string): Promise<Service[]> {
    try {
      console.log('Fetching services for company:', companyId, 'branch:', branchId);
      
      const servicesQuery = query(
        collection(db, 'services'),
        where('companyId', '==', companyId)
        // Remove active filter for now to see all services
      );
      
      const snapshot = await getDocs(servicesQuery);
      console.log('Found services:', snapshot.size);
      
      const services = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Service[];
      
      console.log('All services:', services);
      
      // Filter services that are available for online booking and assigned to branch
      const filteredServices = services.filter(service => {
        const isActive = service.active !== false; // Check active field
        const isOnlineEnabled = service.onlineBooking?.enabled === true;
        const isInBranch = !service.branchIds || service.branchIds.length === 0 || service.branchIds.includes(branchId);
        
        console.log(`Service ${service.name}: active=${isActive}, online=${isOnlineEnabled}, inBranch=${isInBranch}`);
        
        return isActive && isOnlineEnabled && isInBranch;
      });
      
      console.log('Filtered services:', filteredServices);
      return filteredServices;
    } catch (error) {
      console.error('Error getting services:', error);
      throw error;
    }
  }

  // Get staff for booking
  async getStaffForBooking(companyId: string, branchId: string, serviceId?: string): Promise<Staff[]> {
    try {
      const staffQuery = query(
        collection(db, 'staff'),
        where('companyId', '==', companyId),
        where('active', '==', true),
        where('status', '==', 'active')
      );
      
      const snapshot = await getDocs(staffQuery);
      let staffList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Staff[];
      
      // Filter staff that are available for online booking and assigned to branch
      staffList = staffList.filter(staff => 
        staff.onlineBooking?.enabled &&
        staff.branchIds?.includes(branchId)
      );
      
      // Filter by service if provided
      if (serviceId) {
        staffList = staffList.filter(staff => staff.services.includes(serviceId));
      }
      
      return staffList;
    } catch (error) {
      console.error('Error getting staff:', error);
      throw error;
    }
  }

  // Get available time slots
  async getAvailableTimeSlots(
    companyId: string,
    branchId: string,
    staffId: string,
    date: Date,
    serviceDuration: number
  ): Promise<TimeSlot[]> {
    try {
      console.log('Getting time slots:', { companyId, branchId, staffId, date, serviceDuration });
      
      // Handle "any" staff selection
      if (!staffId || staffId === 'any' || staffId === '') {
        console.log('Any staff selected - returning default slots');
        return this.getDefaultTimeSlots(date, serviceDuration);
      }
      
      // Get staff member details
      const staffDoc = await getDoc(doc(db, 'staff', staffId));
      if (!staffDoc.exists()) {
        console.log('Staff not found:', staffId);
        return [];
      }
      
      const staff = { id: staffDoc.id, ...staffDoc.data() } as Staff;
      console.log('Staff data:', staff);
      
      // Get branch operating hours
      let branch: Branch | null = null;
      
      // First try direct lookup
      const branchDoc = await getDoc(doc(db, 'companies', companyId, 'branches', branchId));
      if (branchDoc.exists()) {
        branch = { id: branchDoc.id, ...branchDoc.data() } as Branch;
      } else {
        // If not found and branchId is '1' or 'main', try to find the main branch
        if (branchId === '1' || branchId === 'main') {
          const branchesQuery = query(
            collection(db, 'companies', companyId, 'branches'),
            where('type', '==', 'main'),
            limit(1)
          );
          const branchesSnapshot = await getDocs(branchesQuery);
          if (!branchesSnapshot.empty) {
            const mainBranchDoc = branchesSnapshot.docs[0];
            branch = { id: mainBranchDoc.id, ...mainBranchDoc.data() } as Branch;
            console.log('Found main branch with ID:', mainBranchDoc.id);
          }
        }
        
        // If still not found, try to get the first active branch
        if (!branch) {
          const fallbackQuery = query(
            collection(db, 'companies', companyId, 'branches'),
            where('status', '==', 'active'),
            limit(1)
          );
          const fallbackSnapshot = await getDocs(fallbackQuery);
          if (!fallbackSnapshot.empty) {
            const firstBranchDoc = fallbackSnapshot.docs[0];
            branch = { id: firstBranchDoc.id, ...firstBranchDoc.data() } as Branch;
            console.log('Using first active branch:', firstBranchDoc.id);
          }
        }
      }
      
      if (!branch) {
        console.log('No branch found for ID:', branchId);
        return [];
      }
      console.log('Branch data:', branch);
      
      // Get day of week
      const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const branchHours = branch.operatingHours?.[dayOfWeek];
      const staffHours = staff.schedule?.workingHours?.[dayOfWeek];
      
      console.log('Day of week:', dayOfWeek);
      console.log('Branch operating hours:', branch.operatingHours);
      console.log('Staff schedule:', staff.schedule);
      console.log('Branch hours for day:', branchHours);
      console.log('Staff hours for day:', staffHours);
      
      // Match dashboard logic exactly
      let startTimeStr = '09:00';
      let endTimeStr = '21:00'; // 9:00 PM like the dashboard
      
      // Check if staff has a schedule
      if (!staff.schedule || !staff.schedule.workingHours) {
        console.log('Staff not scheduled - using branch hours or defaults');
        // Use branch hours if available, otherwise defaults
        if (branchHours && branchHours.isOpen) {
          startTimeStr = branchHours.openTime || '09:00';
          endTimeStr = branchHours.closeTime || '21:00';
        }
      } else if (!staffHours || (!staffHours.enabled && !staffHours.isWorking)) {
        console.log('Staff does not work on', dayOfWeek, '- using branch hours as fallback');
        // Use branch hours as fallback
        if (branchHours && branchHours.isOpen) {
          startTimeStr = branchHours.openTime || '09:00';
          endTimeStr = branchHours.closeTime || '21:00';
        } else {
          // If branch is also closed, use defaults to show some slots
          console.log('Branch also closed on', dayOfWeek, '- using default hours');
        }
      } else {
        // Staff works this day - use their hours
        // Check both possible field names: startTime/endTime and start/end
        if (staffHours.startTime || staffHours.start) {
          startTimeStr = staffHours.startTime || staffHours.start;
        }
        if (staffHours.endTime || staffHours.end) {
          endTimeStr = staffHours.endTime || staffHours.end;
        }
        console.log('Using staff hours:', startTimeStr, 'to', endTimeStr);
      }
      
      console.log('Using hours:', startTimeStr, 'to', endTimeStr);
      
      // Generate time slots based on branch and staff hours
      const slots: TimeSlot[] = [];
      const slotInterval = 30; // 30 minutes
      
      const startTime = this.parseTime(startTimeStr);
      const endTime = this.parseTime(endTimeStr);
      
      // Get existing appointments for the day
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      // Get appointments for the day
      console.log('Fetching appointments for staff:', staffId, 'on date:', date);
      const appointmentsQuery = query(
        collection(db, 'appointments'),
        where('staffId', '==', staffId),
        where('date', '>=', Timestamp.fromDate(startOfDay)),
        where('date', '<=', Timestamp.fromDate(endOfDay))
      );
      
      const appointmentsSnap = await getDocs(appointmentsQuery);
      const appointments = appointmentsSnap.docs
        .map(doc => doc.data() as Appointment)
        .filter(apt => ['pending', 'confirmed', 'arrived', 'in_progress'].includes(apt.status));
      
      // Generate slots
      let currentTime = startTime;
      console.log('Generating slots from', startTime, 'to', endTime, 'duration:', serviceDuration);
      console.log('Appointments for the day:', appointments.length);
      
      // Log appointment details for debugging
      appointments.forEach(apt => {
        console.log('Appointment:', {
          startTime: apt.startTime,
          endTime: apt.endTime,
          duration: apt.duration,
          totalDuration: apt.totalDuration,
          status: apt.status
        });
      });
      
      while (currentTime + serviceDuration <= endTime) {
        const timeString = this.formatTime(currentTime);
        
        // Check if slot is available
        const isAvailable = !appointments.some(apt => {
          const aptStart = this.parseTime(apt.startTime);
          // Use totalDuration if duration is not available
          const aptDuration = apt.duration || apt.totalDuration || 60; // Default to 60 minutes
          const aptEnd = aptStart + aptDuration;
          const slotEnd = currentTime + serviceDuration;
          
          const overlaps = (currentTime >= aptStart && currentTime < aptEnd) ||
                          (slotEnd > aptStart && slotEnd <= aptEnd) ||
                          (currentTime <= aptStart && slotEnd >= aptEnd);
          
          if (overlaps) {
            console.log(`Slot ${timeString} overlaps with appointment ${apt.startTime}-${apt.endTime}`);
          }
          
          return overlaps;
        });
        
        slots.push({
          time: timeString,
          available: isAvailable,
          staffId,
        });
        
        currentTime += slotInterval;
      }
      
      console.log('Generated slots:', slots.length, 'slots');
      return slots;
    } catch (error) {
      console.error('Error getting available time slots:', error);
      throw error;
    }
  }

  // Get default time slots when "any" staff is selected
  private getDefaultTimeSlots(date: Date, serviceDuration: number): TimeSlot[] {
    const slots: TimeSlot[] = [];
    const slotInterval = 30; // 30 minutes
    
    // Default business hours: 9 AM to 9 PM (matching dashboard)
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
  
  // Generate time slots helper
  private generateTimeSlots(
    startTimeStr: string, 
    endTimeStr: string, 
    serviceDuration: number,
    staffId?: string
  ): TimeSlot[] {
    const slots: TimeSlot[] = [];
    const slotInterval = 30; // 30 minutes
    
    // Parse start and end times
    const [startHour, startMin] = startTimeStr.split(':').map(Number);
    const [endHour, endMin] = endTimeStr.split(':').map(Number);
    
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;
    
    let currentTime = startTime;
    while (currentTime + serviceDuration <= endTime) {
      const hours = Math.floor(currentTime / 60);
      const minutes = currentTime % 60;
      const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      
      slots.push({
        time: timeString,
        available: true,
        staffId
      });
      
      currentTime += slotInterval;
    }
    
    return slots;
  }

  // Create appointment
  async createAppointment(appointmentData: Partial<Appointment>): Promise<string> {
    try {
      const appointment: Partial<Appointment> = {
        ...appointmentData,
        status: 'pending',
        source: 'online',
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp,
      };
      
      const docRef = await addDoc(collection(db, 'appointments'), appointment);
      
      // Track booking in link analytics
      if (appointmentData.bookingLinkId) {
        await this.trackBooking(appointmentData.bookingLinkId);
      }
      
      return docRef.id;
    } catch (error) {
      console.error('Error creating appointment:', error);
      throw error;
    }
  }

  // Track booking
  private async trackBooking(linkId: string): Promise<void> {
    try {
      const linkRef = doc(db, 'bookingLinks', linkId);
      const linkDoc = await getDoc(linkRef);
      
      if (!linkDoc.exists()) return;
      
      const linkData = linkDoc.data() as BookingLink;
      const today = new Date().toISOString().split('T')[0];
      const analytics = linkData.analytics;
      
      // Update booking count
      analytics.bookings++;
      analytics.bookingsByDate[today] = (analytics.bookingsByDate[today] || 0) + 1;
      
      // Calculate conversion rate
      if (analytics.views > 0) {
        analytics.conversionRate = (analytics.bookings / analytics.views) * 100;
      }
      
      await updateDoc(linkRef, { analytics });
    } catch (error) {
      console.error('Error tracking booking:', error);
      // Don't throw - tracking shouldn't break the app
    }
  }

  // Helper functions
  private parseTime(timeString: string): number {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private formatTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }
}

export const bookingService = new BookingService();