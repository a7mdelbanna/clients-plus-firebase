import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
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

// Base category interface
export interface BaseCategory {
  id?: string;
  companyId: string;
  name: string;
  nameAr?: string;
  color: string;
  icon: string;
  description?: string;
  descriptionAr?: string;
  itemCount?: number;
  active: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: string;
}

// Specific category types
export interface ClientCategory extends BaseCategory {
  type: 'client';
}

export interface AppointmentCategory extends BaseCategory {
  type: 'appointment';
}

export interface EventCategory extends BaseCategory {
  type: 'event';
}

export type Category = ClientCategory | AppointmentCategory | EventCategory;

// Predefined colors for categories
export const CATEGORY_COLORS = [
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#EF4444', // Red
  '#14B8A6', // Teal
  '#84CC16', // Lime
  '#F97316', // Orange
  '#6366F1', // Indigo
];

// Predefined icons for each category type
export const CATEGORY_ICONS = {
  client: [
    'People',
    'Person',
    'Groups',
    'BusinessCenter',
    'Star',
    'Favorite',
    'WorkspacePremium',
    'Verified',
    'AccountCircle',
    'Badge',
  ],
  appointment: [
    'CalendarToday',
    'Schedule',
    'EventNote',
    'AccessTime',
    'Today',
    'DateRange',
    'MoreTime',
    'Alarm',
    'EventAvailable',
    'BookOnline',
  ],
  event: [
    'Event',
    'Celebration',
    'Group',
    'Stadium',
    'TheaterComedy',
    'SportsEsports',
    'MusicNote',
    'Restaurant',
    'School',
    'FitnessCenter',
  ],
};

class CategoryService {
  private readonly collections = {
    client: 'clientCategories',
    appointment: 'appointmentCategories',
    event: 'eventCategories',
  };

  // Create a new category
  async createCategory<T extends Category>(
    category: Omit<T, 'id'>,
    type: 'client' | 'appointment' | 'event'
  ): Promise<string> {
    try {
      const collectionName = this.collections[type];
      const docRef = await addDoc(collection(db, collectionName), {
        ...category,
        type,
        itemCount: 0,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      console.error(`Error creating ${type} category:`, error);
      throw error;
    }
  }

  // Get all categories of a specific type for a company
  async getCategories<T extends Category>(
    companyId: string,
    type: 'client' | 'appointment' | 'event'
  ): Promise<T[]> {
    try {
      const collectionName = this.collections[type];
      const q = query(
        collection(db, collectionName),
        where('companyId', '==', companyId),
        where('active', '==', true),
        orderBy('name')
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        type,
      } as T));
    } catch (error) {
      console.error(`Error getting ${type} categories:`, error);
      throw error;
    }
  }

  // Get a single category
  async getCategory<T extends Category>(
    categoryId: string,
    type: 'client' | 'appointment' | 'event'
  ): Promise<T | null> {
    try {
      const collectionName = this.collections[type];
      const docRef = doc(db, collectionName, categoryId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
          type,
        } as T;
      } else {
        return null;
      }
    } catch (error) {
      console.error(`Error getting ${type} category:`, error);
      throw error;
    }
  }

  // Update a category
  async updateCategory(
    categoryId: string,
    updates: Partial<BaseCategory>,
    type: 'client' | 'appointment' | 'event'
  ): Promise<void> {
    try {
      const collectionName = this.collections[type];
      const docRef = doc(db, collectionName, categoryId);
      
      // Remove undefined values
      const cleanUpdates = Object.entries(updates).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {} as Record<string, unknown>);

      await updateDoc(docRef, {
        ...cleanUpdates,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error(`Error updating ${type} category:`, error);
      throw error;
    }
  }

  // Delete a category (soft delete)
  async deleteCategory(
    categoryId: string,
    type: 'client' | 'appointment' | 'event'
  ): Promise<void> {
    try {
      const collectionName = this.collections[type];
      const docRef = doc(db, collectionName, categoryId);
      await updateDoc(docRef, {
        active: false,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error(`Error deleting ${type} category:`, error);
      throw error;
    }
  }

  // Subscribe to categories changes
  subscribeToCategories<T extends Category>(
    companyId: string,
    type: 'client' | 'appointment' | 'event',
    onUpdate: (categories: T[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const collectionName = this.collections[type];
    const q = query(
      collection(db, collectionName),
      where('companyId', '==', companyId),
      where('active', '==', true),
      orderBy('name')
    );

    return onSnapshot(
      q,
      (querySnapshot) => {
        const categories = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          type,
        } as T));
        onUpdate(categories);
      },
      (error) => {
        console.error(`Error subscribing to ${type} categories:`, error);
        if (onError) onError(error);
      }
    );
  }

  // Get category counts for dashboard
  async getCategoryCounts(companyId: string): Promise<{
    client: number;
    appointment: number;
    event: number;
  }> {
    try {
      const counts = await Promise.all([
        this.getCategories(companyId, 'client'),
        this.getCategories(companyId, 'appointment'),
        this.getCategories(companyId, 'event'),
      ]);

      return {
        client: counts[0].length,
        appointment: counts[1].length,
        event: counts[2].length,
      };
    } catch (error) {
      console.error('Error getting category counts:', error);
      return { client: 0, appointment: 0, event: 0 };
    }
  }

  // Update category item count (to be called when items are added/removed)
  async updateCategoryItemCount(
    categoryId: string,
    type: 'client' | 'appointment' | 'event',
    increment: boolean = true
  ): Promise<void> {
    try {
      const category = await this.getCategory(categoryId, type);
      if (category) {
        const currentCount = category.itemCount || 0;
        const newCount = increment ? currentCount + 1 : Math.max(0, currentCount - 1);
        
        await this.updateCategory(categoryId, { itemCount: newCount }, type);
      }
    } catch (error) {
      console.error(`Error updating category item count:`, error);
      // Don't throw - this is a non-critical operation
    }
  }
}

export const categoryService = new CategoryService();