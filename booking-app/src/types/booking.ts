import type { Timestamp } from 'firebase/firestore';

export interface BookingLink {
  id?: string;
  companyId: string;
  branchId?: string; // Deprecated
  name: string;
  slug: string;
  type: 'company' | 'general' | 'employee';
  employeeId?: string;
  serviceId?: string;
  description?: string;
  isMain: boolean;
  isActive: boolean;
  branchSettings?: {
    mode: 'single' | 'multi';
    allowedBranches: string[];
    defaultBranch?: string;
  };
  fullUrl?: string;
  shortUrl?: string;
  settings: {
    defaultLanguage: string;
    mapType: 'google' | 'osm';
    bookingFlow: 'stepByStep' | 'shortStep' | 'menu';
    stepsOrder: string[];
    theme: 'light' | 'dark';
    primaryColor: string;
    coverImage?: string;
    logoUrl?: string;
    allowMultipleBookings: boolean;
    maxBookingsPerSession: number;
    showGroupEvents: boolean;
    groupEventsDisplay: 'allOnPage' | 'byDays';
    serviceDisplay: 'horizontal' | 'vertical';
    showServiceCategories: boolean;
    showServicePrices: boolean;
    showServiceDuration: boolean;
    showEmployeePhotos: boolean;
    showEmployeeRatings: boolean;
    allowAnyEmployee: boolean;
    timeSlotInterval: number;
    showMorningSlots: boolean;
    showAfternoonSlots: boolean;
    showEveningSlots: boolean;
  };
  analytics: {
    views: number;
    uniqueViews: number;
    bookings: number;
    conversionRate: number;
    lastViewedAt?: Timestamp;
    viewsByDate: Record<string, number>;
    bookingsByDate: Record<string, number>;
  };
  createdBy: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Branch {
  id: string;
  name: string;
  type: 'main' | 'secondary';
  status: 'active' | 'inactive';
  address: {
    street: string;
    city: string;
    state?: string;
    postalCode?: string;
    country: string;
  };
  contact: {
    phones: Array<{
      number: string;
      type: 'mobile' | 'landline';
      isPrimary: boolean;
    }>;
    email?: string;
  };
  coordinates?: {
    lat: number;
    lng: number;
  };
  operatingHours: Record<string, {
    isOpen: boolean;
    openTime?: string;
    closeTime?: string;
    breaks?: Array<{
      startTime: string;
      endTime: string;
    }>;
  }>;
  settings?: {
    allowOnlineBooking: boolean;
    autoConfirmAppointments: boolean;
    requireDepositForBooking: boolean;
    depositAmount?: number;
    cancellationHours?: number;
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
  finalPrice?: number;
  description?: string;
  images?: string[];
  active: boolean;
  onlineBooking: {
    enabled: boolean;
    displayName?: string;
    description?: string;
    translations?: Record<string, string>;
    prepaymentRequired?: boolean;
    membershipRequired?: boolean;
    availabilityPeriod?: number;
  };
}

export interface Staff {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  position?: string;
  avatar?: string;
  companyId: string;
  branchIds?: string[];
  services: string[];
  status: 'active' | 'inactive' | 'vacation';
  active: boolean;
  onlineBooking: {
    enabled: boolean;
    profile?: {
      description?: string;
      showRating?: boolean;
    };
    rules?: {
      requirePrepayment?: boolean;
      allowAnySpecialist?: boolean;
    };
    schedulingTime?: 'general' | 'personal';
  };
  schedule?: {
    workingHours: Record<string, {
      enabled: boolean;
      startTime?: string;
      endTime?: string;
      breaks?: Array<{
        startTime: string;
        endTime: string;
      }>;
    }>;
    scheduledUntil?: Date;
    scheduleStartDate?: Date;
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
  branchId: string;
  clientId?: string;
  clientPhone: string;
  clientName: string;
  clientEmail?: string;
  staffId: string;
  services: string[];
  date: Date;
  startTime: string;
  endTime?: string;
  duration: number;
  status: 'pending' | 'confirmed' | 'arrived' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  source: 'online' | 'dashboard' | 'phone' | 'walk-in';
  notes?: string;
  bookingLinkId?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}