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

// Position interface
export interface Position {
  id?: string;
  companyId: string;
  name: string; // Primary name in Arabic
  description?: string; // Description in Arabic
  translations?: {
    [key: string]: {
      name: string;
      description?: string;
    };
  };
  
  active: boolean;
  staffCount?: number; // Number of staff in this position
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: string;
}

// Helper function to get position name in preferred language
export function getPositionName(position: Position, language: string = 'ar'): string {
  if (language === 'ar') {
    return position.name;
  }
  
  // Check translations
  if (position.translations && position.translations[language]) {
    return position.translations[language].name;
  }
  
  // Fallback to Arabic name
  return position.name;
}

// Helper function to get position description in preferred language
export function getPositionDescription(position: Position, language: string = 'ar'): string | undefined {
  if (language === 'ar') {
    return position.description;
  }
  
  // Check translations
  if (position.translations && position.translations[language]) {
    return position.translations[language].description;
  }
  
  // Fallback to Arabic description
  return position.description;
}

export const positionService = {
  // Create a new position
  async createPosition(
    position: Omit<Position, 'id' | 'createdAt' | 'updatedAt' | 'staffCount'>,
    userId: string
  ): Promise<string> {
    const positionData = {
      ...position,
      staffCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: userId,
    };

    const docRef = await addDoc(collection(db, 'positions'), positionData);
    return docRef.id;
  },

  // Get all positions for a company
  async getPositions(companyId: string): Promise<Position[]> {
    const q = query(
      collection(db, 'positions'),
      where('companyId', '==', companyId),
      where('active', '==', true)
    );

    const snapshot = await getDocs(q);
    const positions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as Position));
    
    // Sort by name
    return positions.sort((a, b) => a.name.localeCompare(b.name));
  },

  // Get a single position
  async getPosition(positionId: string): Promise<Position | null> {
    const docSnap = await getDoc(doc(db, 'positions', positionId));
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
      } as Position;
    }
    return null;
  },

  // Update a position
  async updatePosition(positionId: string, updates: Partial<Position>): Promise<void> {
    await updateDoc(doc(db, 'positions', positionId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  },

  // Delete a position (soft delete)
  async deletePosition(positionId: string): Promise<void> {
    await updateDoc(doc(db, 'positions', positionId), {
      active: false,
      updatedAt: serverTimestamp(),
    });
  },

  // Real-time subscription to positions
  subscribeToPositions(
    companyId: string,
    callback: (positions: Position[]) => void,
    errorCallback?: (error: Error) => void
  ): Unsubscribe {
    const q = query(
      collection(db, 'positions'),
      where('companyId', '==', companyId),
      where('active', '==', true)
    );

    return onSnapshot(
      q, 
      (snapshot) => {
        const positions = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as Position));
        // Sort by name
        const sortedPositions = positions.sort((a, b) => a.name.localeCompare(b.name));
        callback(sortedPositions);
      },
      (error) => {
        console.error('Error in subscribeToPositions:', error);
        if (errorCallback) {
          errorCallback(error);
        }
      }
    );
  },

  // Check if position name exists
  async checkPositionNameExists(
    companyId: string, 
    name: string, 
    excludeId?: string
  ): Promise<boolean> {
    const q = query(
      collection(db, 'positions'),
      where('companyId', '==', companyId),
      where('name', '==', name),
      where('active', '==', true)
    );

    const snapshot = await getDocs(q);
    
    if (excludeId) {
      return snapshot.docs.some(doc => doc.id !== excludeId);
    }
    
    return !snapshot.empty;
  },
};