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

// Resource interface
export interface Resource {
  id?: string;
  companyId: string;
  name: string;
  description?: string;
  services: string[]; // Service IDs that can use this resource
  capacity: number; // How many can use simultaneously (default: 1)
  workingHours?: {
    [day: string]: { // monday, tuesday, wednesday, thursday, friday, saturday, sunday
      isWorking: boolean;
      start?: string; // "09:00"
      end?: string; // "17:00"
      breaks?: Array<{
        start: string;
        end: string;
      }>;
    };
  };
  status: 'active' | 'inactive';
  active: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: string;
}

class ResourceService {
  private collectionName = 'resources';

  // Create a new resource
  async createResource(resource: Omit<Resource, 'id'>, companyId: string): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, this.collectionName), {
        ...resource,
        companyId,
        capacity: resource.capacity || 1,
        status: resource.status || 'active',
        active: true,
        services: resource.services || [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating resource:', error);
      throw error;
    }
  }

  // Get all resources for a company
  async getResources(companyId: string): Promise<Resource[]> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('companyId', '==', companyId),
        where('active', '==', true),
        orderBy('name')
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Resource));
    } catch (error) {
      console.error('Error getting resources:', error);
      throw error;
    }
  }

  // Get resources by service ID
  async getResourcesByService(companyId: string, serviceId: string): Promise<Resource[]> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('companyId', '==', companyId),
        where('services', 'array-contains', serviceId),
        where('status', '==', 'active'),
        where('active', '==', true)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Resource));
    } catch (error) {
      console.error('Error getting resources by service:', error);
      throw error;
    }
  }

  // Get a single resource
  async getResource(resourceId: string): Promise<Resource | null> {
    try {
      const docRef = doc(db, this.collectionName, resourceId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data()
        } as Resource;
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error getting resource:', error);
      throw error;
    }
  }

  // Update a resource
  async updateResource(resourceId: string, updates: Partial<Resource>): Promise<void> {
    try {
      const docRef = doc(db, this.collectionName, resourceId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating resource:', error);
      throw error;
    }
  }

  // Delete a resource (soft delete)
  async deleteResource(resourceId: string): Promise<void> {
    try {
      const docRef = doc(db, this.collectionName, resourceId);
      await updateDoc(docRef, {
        active: false,
        status: 'inactive',
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error deleting resource:', error);
      throw error;
    }
  }

  // Subscribe to resources changes
  subscribeToResources(
    companyId: string,
    onUpdate: (resources: Resource[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const q = query(
      collection(db, this.collectionName),
      where('companyId', '==', companyId),
      where('active', '==', true),
      orderBy('name')
    );

    return onSnapshot(
      q,
      (querySnapshot) => {
        const resources = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Resource));
        onUpdate(resources);
      },
      (error) => {
        console.error('Error subscribing to resources:', error);
        if (onError) onError(error);
      }
    );
  }

  // Check resource availability for a specific time slot
  async checkResourceAvailability(
    resourceId: string, 
    date: Date, 
    startTime: string, 
    endTime: string
  ): Promise<boolean> {
    // This will be implemented when we have appointment/booking system
    // For now, just check if resource is active
    try {
      const resource = await this.getResource(resourceId);
      if (!resource || resource.status !== 'active') {
        return false;
      }

      // Check working hours if defined
      if (resource.workingHours) {
        const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()];
        const daySchedule = resource.workingHours[dayName];
        
        if (!daySchedule || !daySchedule.isWorking) {
          return false;
        }

        // TODO: Check if requested time is within working hours
        // TODO: Check if resource is not already booked for this time
      }

      return true;
    } catch (error) {
      console.error('Error checking resource availability:', error);
      return false;
    }
  }
}

export const resourceService = new ResourceService();