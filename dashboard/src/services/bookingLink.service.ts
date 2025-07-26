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
  serverTimestamp,
  Timestamp,
  onSnapshot,
} from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { getBookingAppUrl } from '../config/urls';

// Booking Link Types
export type BookingLinkType = 'company' | 'general' | 'employee';
export type BookingFlow = 'stepByStep' | 'shortStep' | 'menu';
export type GroupEventsDisplay = 'allOnPage' | 'byDays';
export type MapType = 'google' | 'osm';

export interface BookingLinkSettings {
  // Basic Settings
  defaultLanguage: string;
  mapType: MapType;
  chain?: string;
  bookingFlow: BookingFlow;
  stepsOrder: string[]; // ['employee', 'service', 'datetime']
  
  // Design Settings
  theme: 'light' | 'dark';
  primaryColor: string;
  coverImage?: string;
  logoUrl?: string;
  
  // Features
  allowMultipleBookings: boolean;
  maxBookingsPerSession: number;
  showGroupEvents: boolean;
  groupEventsDisplay: GroupEventsDisplay;
  
  // Service Display
  serviceDisplay: 'horizontal' | 'vertical';
  showServiceCategories: boolean;
  showServicePrices: boolean;
  showServiceDuration: boolean;
  
  // Employee Display
  showEmployeePhotos: boolean;
  showEmployeeRatings: boolean;
  allowAnyEmployee: boolean;
  
  // Time Slot Display
  timeSlotInterval: number; // in minutes
  showMorningSlots: boolean;
  showAfternoonSlots: boolean;
  showEveningSlots: boolean;
}

export interface BookingLinkAnalytics {
  views: number;
  uniqueViews: number;
  bookings: number;
  conversionRate: number;
  lastViewedAt?: Timestamp;
  viewsByDate: Record<string, number>; // ISO date -> count
  bookingsByDate: Record<string, number>;
}

export interface BookingLinkBranchSettings {
  mode: 'single' | 'multi';
  allowedBranches: string[]; // Branch IDs that can be used with this link
  defaultBranch?: string; // Default branch for single mode
}

export interface BookingLink {
  id?: string;
  companyId: string;
  branchId?: string; // Deprecated - kept for backward compatibility
  name: string;
  slug: string; // unique within company
  type: BookingLinkType;
  employeeId?: string; // for employee-specific links
  serviceId?: string; // for service-specific links
  description?: string;
  isMain: boolean;
  isActive: boolean;
  
  // Branch Configuration
  branchSettings?: BookingLinkBranchSettings;
  
  // Full URL for easy copying
  fullUrl?: string;
  shortUrl?: string; // if we implement URL shortening
  
  // Configuration
  settings: BookingLinkSettings;
  
  // Analytics
  analytics: BookingLinkAnalytics;
  
  // Metadata
  createdBy: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

class BookingLinkService {
  private bookingLinksCollection = 'bookingLinks';

  // Create a new booking link
  async createBookingLink(
    companyId: string,
    linkData: Omit<BookingLink, 'id' | 'companyId' | 'createdAt' | 'updatedAt' | 'analytics'>
  ): Promise<string> {
    try {
      // Ensure unique slug within company
      const uniqueSlug = await this.generateUniqueSlug(companyId, linkData.slug || linkData.name);
      
      // Get company data for URL generation
      const companyDoc = await getDoc(doc(db, 'companies', companyId));
      if (!companyDoc.exists()) {
        throw new Error('Company not found');
      }
      
      const companyData = companyDoc.data();
      const companySlug = companyData.slug || companyId;
      
      // Initialize analytics
      const analytics: BookingLinkAnalytics = {
        views: 0,
        uniqueViews: 0,
        bookings: 0,
        conversionRate: 0,
        viewsByDate: {},
        bookingsByDate: {},
      };
      
      // Create the booking link
      const newLink: Omit<BookingLink, 'id'> = {
        ...linkData,
        companyId,
        slug: uniqueSlug,
        fullUrl: `${getBookingAppUrl()}/book/${companySlug}/${uniqueSlug}`,
        analytics,
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp,
      };
      
      const docRef = await addDoc(collection(db, this.bookingLinksCollection), newLink);
      
      // If this is set as main link, unset other main links
      if (linkData.isMain) {
        await this.unsetOtherMainLinks(companyId, docRef.id);
      }
      
      return docRef.id;
    } catch (error) {
      console.error('Error creating booking link:', error);
      throw error;
    }
  }

  // Get all booking links for a company
  async getCompanyBookingLinks(companyId: string, branchId?: string): Promise<BookingLink[]> {
    try {
      let constraints = [
        where('companyId', '==', companyId),
        orderBy('createdAt', 'desc')
      ];
      
      // Add branch filter if provided
      if (branchId) {
        constraints.push(where('branchId', '==', branchId));
      }
      
      const q = query(collection(db, this.bookingLinksCollection), ...constraints);
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as BookingLink));
    } catch (error) {
      console.error('Error getting booking links:', error);
      throw error;
    }
  }

  // Get a single booking link by ID
  async getBookingLink(linkId: string): Promise<BookingLink | null> {
    try {
      const docRef = doc(db, this.bookingLinksCollection, linkId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data()
        } as BookingLink;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting booking link:', error);
      throw error;
    }
  }

  // Get public booking link by company and link slugs
  async getPublicBookingLink(companySlug: string, linkSlug: string): Promise<BookingLink | null> {
    try {
      // First get company by slug
      const companyQuery = query(
        collection(db, 'companies'),
        where('slug', '==', companySlug)
      );
      const companySnap = await getDocs(companyQuery);
      
      if (companySnap.empty) return null;
      
      const companyId = companySnap.docs[0].id;
      
      // Then get the booking link
      const linkQuery = query(
        collection(db, this.bookingLinksCollection),
        where('companyId', '==', companyId),
        where('slug', '==', linkSlug),
        where('isActive', '==', true)
      );
      
      const linkSnap = await getDocs(linkQuery);
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

  // Update a booking link
  async updateBookingLink(linkId: string, updates: Partial<BookingLink>): Promise<void> {
    try {
      const docRef = doc(db, this.bookingLinksCollection, linkId);
      
      // Remove id from updates if present
      const { id, ...updateData } = updates;
      
      await updateDoc(docRef, {
        ...updateData,
        updatedAt: serverTimestamp(),
      });
      
      // If this is set as main link, unset other main links
      if (updates.isMain) {
        const linkDoc = await getDoc(docRef);
        const linkData = linkDoc.data();
        if (linkData) {
          await this.unsetOtherMainLinks(linkData.companyId, linkId);
        }
      }
    } catch (error) {
      console.error('Error updating booking link:', error);
      throw error;
    }
  }

  // Delete a booking link
  async deleteBookingLink(linkId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, this.bookingLinksCollection, linkId));
    } catch (error) {
      console.error('Error deleting booking link:', error);
      throw error;
    }
  }

  // Toggle link active status
  async toggleLinkStatus(linkId: string): Promise<void> {
    try {
      const linkDoc = await this.getBookingLink(linkId);
      if (!linkDoc) throw new Error('Link not found');
      
      await this.updateBookingLink(linkId, {
        isActive: !linkDoc.isActive
      });
    } catch (error) {
      console.error('Error toggling link status:', error);
      throw error;
    }
  }

  // Generate unique slug within company
  async generateUniqueSlug(companyId: string, baseName: string): Promise<string> {
    let slug = baseName.toLowerCase()
      .replace(/[أ-ي]/g, '') // Remove Arabic characters
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    
    // Ensure minimum length
    if (slug.length < 3) {
      slug = `link-${slug || 'new'}`;
    }
    
    let counter = 0;
    let uniqueSlug = slug;
    
    while (true) {
      const q = query(
        collection(db, this.bookingLinksCollection),
        where('companyId', '==', companyId),
        where('slug', '==', uniqueSlug)
      );
      
      const snapshot = await getDocs(q);
      if (snapshot.empty) break;
      
      counter++;
      uniqueSlug = `${slug}-${counter}`;
    }
    
    return uniqueSlug;
  }

  // Unset other main links when setting a new main link
  private async unsetOtherMainLinks(companyId: string, exceptLinkId: string): Promise<void> {
    try {
      const q = query(
        collection(db, this.bookingLinksCollection),
        where('companyId', '==', companyId),
        where('isMain', '==', true)
      );
      
      const snapshot = await getDocs(q);
      const updatePromises = snapshot.docs
        .filter(doc => doc.id !== exceptLinkId)
        .map(doc => updateDoc(doc.ref, { isMain: false }));
      
      await Promise.all(updatePromises);
    } catch (error) {
      console.error('Error unsetting main links:', error);
    }
  }

  // Track link view (for analytics)
  async trackLinkView(linkId: string, uniqueView: boolean = false): Promise<void> {
    try {
      const linkDoc = await this.getBookingLink(linkId);
      if (!linkDoc || !linkDoc.analytics) return;
      
      const today = new Date().toISOString().split('T')[0];
      const analytics = linkDoc.analytics;
      
      // Update view counts
      analytics.views++;
      if (uniqueView) {
        analytics.uniqueViews++;
      }
      
      // Update daily views
      analytics.viewsByDate[today] = (analytics.viewsByDate[today] || 0) + 1;
      analytics.lastViewedAt = Timestamp.now();
      
      // Calculate conversion rate
      if (analytics.views > 0) {
        analytics.conversionRate = (analytics.bookings / analytics.views) * 100;
      }
      
      await this.updateBookingLink(linkId, { analytics });
    } catch (error) {
      console.error('Error tracking link view:', error);
    }
  }

  // Track booking (for analytics)
  async trackBooking(linkId: string): Promise<void> {
    try {
      const linkDoc = await this.getBookingLink(linkId);
      if (!linkDoc || !linkDoc.analytics) return;
      
      const today = new Date().toISOString().split('T')[0];
      const analytics = linkDoc.analytics;
      
      // Update booking count
      analytics.bookings++;
      
      // Update daily bookings
      analytics.bookingsByDate[today] = (analytics.bookingsByDate[today] || 0) + 1;
      
      // Calculate conversion rate
      if (analytics.views > 0) {
        analytics.conversionRate = (analytics.bookings / analytics.views) * 100;
      }
      
      await this.updateBookingLink(linkId, { analytics });
    } catch (error) {
      console.error('Error tracking booking:', error);
    }
  }

  // Subscribe to real-time updates for company booking links
  subscribeToBookingLinks(
    companyId: string,
    callback: (links: BookingLink[]) => void,
    branchId?: string
  ): Unsubscribe {
    let constraints = [
      where('companyId', '==', companyId),
      orderBy('createdAt', 'desc')
    ];
    
    if (branchId) {
      constraints.push(where('branchId', '==', branchId));
    }
    
    const q = query(collection(db, this.bookingLinksCollection), ...constraints);
    
    return onSnapshot(q, (snapshot) => {
      const links: BookingLink[] = [];
      const seenIds = new Set<string>();
      
      snapshot.forEach((doc) => {
        // Skip if we've already seen this ID
        if (seenIds.has(doc.id)) {
          console.warn(`Duplicate booking link ID found: ${doc.id}`);
          return;
        }
        
        seenIds.add(doc.id);
        links.push({
          id: doc.id,
          ...doc.data()
        } as BookingLink);
      });
      callback(links);
    });
  }

  // Get default settings for a new booking link
  getDefaultSettings(): BookingLinkSettings {
    return {
      defaultLanguage: 'ar',
      mapType: 'google',
      bookingFlow: 'stepByStep',
      stepsOrder: ['service', 'employee', 'datetime'],
      theme: 'light',
      primaryColor: '#FF6B00',
      allowMultipleBookings: false,
      maxBookingsPerSession: 1,
      showGroupEvents: false,
      groupEventsDisplay: 'allOnPage',
      serviceDisplay: 'vertical',
      showServiceCategories: true,
      showServicePrices: true,
      showServiceDuration: true,
      showEmployeePhotos: true,
      showEmployeeRatings: false,
      allowAnyEmployee: true,
      timeSlotInterval: 30,
      showMorningSlots: true,
      showAfternoonSlots: true,
      showEveningSlots: true,
    };
  }
}

export const bookingLinkService = new BookingLinkService();