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
import type { BookingLink } from './bookingLink.service';

export interface Branch {
  id: string;
  name: string;
  type: 'main' | 'branch';
  status: 'active' | 'inactive';
  address?: string;
  phone?: string;
  email?: string;
  operatingHours?: Record<string, any>;
  onlineBooking?: {
    enabled: boolean;
    autoConfirm: boolean;
  };
}

export interface Service {
  id: string;
  name: string;
  categoryId: string;
  companyId: string;
  branchIds?: string[];
  duration: {
    hours: number;
    minutes: number;
  };
  startingPrice: number;
  active: boolean;
  onlineBooking?: {
    enabled: boolean;
    displayName?: string;
  };
}

export interface Staff {
  id: string;
  name: string;
  companyId: string;
  branchIds?: string[];
  services: string[];
  active: boolean;
  status: 'active' | 'inactive';
  onlineBooking?: {
    enabled: boolean;
  };
  schedule?: {
    workingHours?: Record<string, any>;
  };
}

export interface TimeSlot {
  time: string;
  available: boolean;
  staffId?: string;
}

export interface Appointment {
  id?: string;
  companyId: string;
  branchId?: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  services: any[];
  staffId: string;
  staffName: string;
  date: Timestamp;
  startTime: string;
  endTime: string;
  duration: number;
  totalPrice: number;
  status: string;
  source: string;
  bookingLinkId?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

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
      );
      
      const snapshot = await getDocs(servicesQuery);
      console.log('Found services:', snapshot.size);
      
      const services = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Service[];
      
      // Filter services that are available for online booking and assigned to branch
      const filteredServices = services.filter(service => {
        const isActive = service.active !== false;
        const isOnlineEnabled = service.onlineBooking?.enabled === true;
        const isInBranch = !service.branchIds || service.branchIds.length === 0 || service.branchIds.includes(branchId);
        
        return isActive && isOnlineEnabled && isInBranch;
      });
      
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
}

export const bookingService = new BookingService();