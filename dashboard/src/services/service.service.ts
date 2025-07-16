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
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// Service Category interfaces
export interface ServiceCategory {
  id?: string;
  companyId: string;
  name: string;
  nameAr?: string;
  useOnlineBookingName?: boolean;
  onlineBookingName?: string;
  servicesCount?: number;
  active: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: string;
}

// Service interfaces
export interface Service {
  id?: string;
  companyId: string;
  categoryId: string;
  name: string; // Primary name in Arabic
  nameAr?: string; // Deprecated - kept for backward compatibility
  translations?: {
    en?: string;
    fr?: string;
    [key: string]: string | undefined;
  };
  startingPrice: number;
  priceRange?: {
    min: number;
    max: number;
  };
  duration: {
    hours: number;
    minutes: number;
  };
  type: 'appointment' | 'group-event';
  apiId?: string;
  
  // Online booking settings
  onlineBooking: {
    enabled: boolean;
    displayName?: string;
    description?: string;
    translations?: {
      en?: string;
      fr?: string;
      [key: string]: string | undefined;
    };
    prepaymentRequired?: boolean;
    membershipRequired?: boolean;
    availabilityPeriod?: number; // days
  };
  
  // Images
  images?: {
    url: string;
    isDefault: boolean;
    uploadedAt: Timestamp;
    name?: string;
  }[];
  
  // Advanced options
  invoiceName?: string;
  taxSystem?: string;
  vat?: number;
  followUpDays?: number;
  autoDeduction?: boolean;
  
  active: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: string;
}

// Service Staff Assignment
export interface ServiceStaff {
  staffId: string;
  price?: number;
  duration?: {
    hours: number;
    minutes: number;
  };
  billOfMaterials?: string;
}

// Service Package
export interface ServicePackage {
  id?: string;
  companyId: string;
  name: string;
  nameAr?: string;
  services: string[]; // service IDs
  totalPrice: number;
  discount?: number;
  active: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: string;
}

// Helper function to get service name in preferred language
export function getServiceName(service: Service, language: string = 'ar'): string {
  if (language === 'ar') {
    return service.name;
  }
  
  // Check translations
  if (service.translations && service.translations[language]) {
    return service.translations[language]!;
  }
  
  // Fallback to Arabic name
  return service.name;
}

// Helper function to get service description in preferred language
export function getServiceDescription(service: Service, language: string = 'ar'): string | undefined {
  if (language === 'ar') {
    return service.onlineBooking.description;
  }
  
  // Check translations
  if (service.onlineBooking.translations && service.onlineBooking.translations[language]) {
    return service.onlineBooking.translations[language];
  }
  
  // Fallback to Arabic description
  return service.onlineBooking.description;
}

export const serviceService = {
  // Service Category CRUD
  async createCategory(
    category: Omit<ServiceCategory, 'id' | 'createdAt' | 'updatedAt'>,
    userId: string
  ): Promise<string> {
    const categoryData = {
      ...category,
      servicesCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: userId,
    };

    const docRef = await addDoc(collection(db, 'serviceCategories'), categoryData);
    return docRef.id;
  },

  async getCategories(companyId: string): Promise<ServiceCategory[]> {
    const q = query(
      collection(db, 'serviceCategories'),
      where('companyId', '==', companyId),
      where('active', '==', true)
    );

    const snapshot = await getDocs(q);
    const categories = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as ServiceCategory));
    
    // Sort in memory for now
    return categories.sort((a, b) => a.name.localeCompare(b.name));
  },

  async updateCategory(categoryId: string, updates: Partial<ServiceCategory>): Promise<void> {
    await updateDoc(doc(db, 'serviceCategories', categoryId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  },

  async deleteCategory(categoryId: string): Promise<void> {
    // Soft delete
    await updateDoc(doc(db, 'serviceCategories', categoryId), {
      active: false,
      updatedAt: serverTimestamp(),
    });
  },

  // Service CRUD
  async createService(
    service: Omit<Service, 'id' | 'createdAt' | 'updatedAt'>,
    userId: string
  ): Promise<string> {
    const serviceData = {
      ...service,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: userId,
    };

    const docRef = await addDoc(collection(db, 'services'), serviceData);
    
    // Update category service count
    if (service.categoryId) {
      const categoryRef = doc(db, 'serviceCategories', service.categoryId);
      const categoryDoc = await getDoc(categoryRef);
      if (categoryDoc.exists()) {
        const currentCount = categoryDoc.data().servicesCount || 0;
        await updateDoc(categoryRef, {
          servicesCount: currentCount + 1,
          updatedAt: serverTimestamp(),
        });
      }
    }

    return docRef.id;
  },

  async getServices(companyId: string, categoryId?: string): Promise<Service[]> {
    let q;
    
    if (categoryId) {
      q = query(
        collection(db, 'services'),
        where('companyId', '==', companyId),
        where('categoryId', '==', categoryId),
        where('active', '==', true)
      );
    } else {
      q = query(
        collection(db, 'services'),
        where('companyId', '==', companyId),
        where('active', '==', true)
      );
    }

    const snapshot = await getDocs(q);
    const services = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as Service));
    
    // Sort in memory
    return services.sort((a, b) => a.name.localeCompare(b.name));
  },

  async getService(serviceId: string): Promise<Service | null> {
    const docSnap = await getDoc(doc(db, 'services', serviceId));
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
      } as Service;
    }
    return null;
  },

  async updateService(serviceId: string, updates: Partial<Service>): Promise<void> {
    await updateDoc(doc(db, 'services', serviceId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  },

  async deleteService(serviceId: string): Promise<void> {
    const serviceDoc = await getDoc(doc(db, 'services', serviceId));
    if (serviceDoc.exists()) {
      const categoryId = serviceDoc.data().categoryId;
      
      // Soft delete service
      await updateDoc(doc(db, 'services', serviceId), {
        active: false,
        updatedAt: serverTimestamp(),
      });
      
      // Update category service count
      if (categoryId) {
        const categoryRef = doc(db, 'serviceCategories', categoryId);
        const categoryDoc = await getDoc(categoryRef);
        if (categoryDoc.exists()) {
          const currentCount = categoryDoc.data().servicesCount || 0;
          await updateDoc(categoryRef, {
            servicesCount: Math.max(0, currentCount - 1),
            updatedAt: serverTimestamp(),
          });
        }
      }
    }
  },

  // Service Staff Management
  async assignStaffToService(
    serviceId: string,
    staff: ServiceStaff[]
  ): Promise<void> {
    const serviceRef = doc(db, 'services', serviceId);
    
    // Delete existing staff assignments
    const existingStaff = await getDocs(collection(serviceRef, 'staff'));
    const deletePromises = existingStaff.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    
    // Add new staff assignments
    const addPromises = staff.map(s => 
      addDoc(collection(serviceRef, 'staff'), {
        ...s,
        assignedAt: serverTimestamp(),
      })
    );
    await Promise.all(addPromises);
  },

  async getServiceStaff(serviceId: string): Promise<ServiceStaff[]> {
    const snapshot = await getDocs(
      collection(db, 'services', serviceId, 'staff')
    );
    return snapshot.docs.map(doc => doc.data() as ServiceStaff);
  },

  // Real-time subscriptions
  subscribeToCategories(
    companyId: string,
    callback: (categories: ServiceCategory[]) => void,
    errorCallback?: (error: Error) => void
  ): Unsubscribe {
    const q = query(
      collection(db, 'serviceCategories'),
      where('companyId', '==', companyId),
      where('active', '==', true)
    );

    return onSnapshot(
      q, 
      (snapshot) => {
        const categories = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as ServiceCategory));
        // Sort in memory
        const sortedCategories = categories.sort((a, b) => a.name.localeCompare(b.name));
        callback(sortedCategories);
      },
      (error) => {
        console.error('Error in subscribeToCategories:', error);
        if (errorCallback) {
          errorCallback(error);
        }
      }
    );
  },

  subscribeToServices(
    companyId: string,
    callback: (services: Service[]) => void,
    categoryId?: string,
    errorCallback?: (error: Error) => void
  ): Unsubscribe {
    let q;
    
    if (categoryId) {
      q = query(
        collection(db, 'services'),
        where('companyId', '==', companyId),
        where('categoryId', '==', categoryId),
        where('active', '==', true)
      );
    } else {
      q = query(
        collection(db, 'services'),
        where('companyId', '==', companyId),
        where('active', '==', true)
      );
    }

    return onSnapshot(
      q, 
      (snapshot) => {
        const services = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as Service));
        // Sort in memory
        const sortedServices = services.sort((a, b) => a.name.localeCompare(b.name));
        callback(sortedServices);
      },
      (error) => {
        console.error('Error in subscribeToServices:', error);
        if (errorCallback) {
          errorCallback(error);
        }
      }
    );
  },
};