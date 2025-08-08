import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';

export interface PhoneNumber {
  countryCode: string;
  number: string;
  type?: 'main' | 'mobile' | 'whatsapp';
}

export interface Address {
  street: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
}

export interface Break {
  start: string;
  end: string;
}

export interface DaySchedule {
  isOpen: boolean;
  openTime?: string;
  closeTime?: string;
  breaks?: Break[];
}

export interface BranchSettings {
  allowOnlineBooking: boolean;
  autoConfirmAppointments: boolean;
  requireDepositForBooking: boolean;
  depositAmount?: number;
  cancellationHours?: number;
}

export interface Branch {
  id?: string;
  name: string;
  type: 'main' | 'secondary';
  status: 'active' | 'inactive';
  address: Address;
  contact: {
    phones: PhoneNumber[];
    email?: string;
  };
  coordinates?: {
    lat: number;
    lng: number;
  };
  operatingHours: {
    [day: string]: DaySchedule;
  };
  services?: string[]; // Service IDs available at branch
  resources?: string[]; // Resource IDs at branch
  staff?: string[]; // Staff IDs assigned to branch
  settings?: BranchSettings;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  
  // Legacy fields for compatibility
  phone?: string;
  isMain?: boolean;
  active?: boolean;
}

export const branchService = {
  // Create a new branch
  async createBranch(companyId: string, branchData: Omit<Branch, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const branchesRef = collection(db, 'companies', companyId, 'branches');
      
      // If this is being set as main branch, unset other main branches
      if (branchData.type === 'main' || branchData.isMain) {
        const existingBranches = await getDocs(branchesRef);
        const batch = writeBatch(db);
        
        existingBranches.forEach((doc) => {
          const data = doc.data();
          if (data.type === 'main' || data.isMain) {
            batch.update(doc.ref, { 
              type: 'secondary',
              isMain: false,
              updatedAt: serverTimestamp() 
            });
          }
        });
        
        await batch.commit();
      }
      
      // Prepare branch data with legacy fields for compatibility
      const dataToSave = {
        ...branchData,
        // Legacy fields
        phone: branchData.contact.phones[0] ? 
          `${branchData.contact.phones[0].countryCode}${branchData.contact.phones[0].number}` : '',
        isMain: branchData.type === 'main',
        active: branchData.status === 'active',
        // New fields
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      const docRef = await addDoc(branchesRef, dataToSave);
      return docRef.id;
    } catch (error) {
      console.error('Error creating branch:', error);
      throw error;
    }
  },

  // Update an existing branch
  async updateBranch(companyId: string, branchId: string, updates: Partial<Branch>): Promise<void> {
    try {
      const branchRef = doc(db, 'companies', companyId, 'branches', branchId);
      
      // If updating to main branch, unset other main branches
      if (updates.type === 'main' || updates.isMain) {
        const branchesRef = collection(db, 'companies', companyId, 'branches');
        const existingBranches = await getDocs(branchesRef);
        const batch = writeBatch(db);
        
        existingBranches.forEach((doc) => {
          if (doc.id !== branchId) {
            const data = doc.data();
            if (data.type === 'main' || data.isMain) {
              batch.update(doc.ref, { 
                type: 'secondary',
                isMain: false,
                updatedAt: serverTimestamp() 
              });
            }
          }
        });
        
        await batch.commit();
      }
      
      // Prepare update data with legacy fields
      const updateData: any = {
        ...updates,
        updatedAt: serverTimestamp(),
      };
      
      // Update legacy fields if new fields are being updated
      if (updates.contact?.phones?.[0]) {
        updateData.phone = `${updates.contact.phones[0].countryCode}${updates.contact.phones[0].number}`;
      }
      if (updates.type !== undefined) {
        updateData.isMain = updates.type === 'main';
      }
      if (updates.status !== undefined) {
        updateData.active = updates.status === 'active';
      }
      
      await updateDoc(branchRef, updateData);
    } catch (error) {
      console.error('Error updating branch:', error);
      throw error;
    }
  },

  // Delete a branch (soft delete by setting status to inactive)
  async deleteBranch(companyId: string, branchId: string): Promise<void> {
    try {
      const branchRef = doc(db, 'companies', companyId, 'branches', branchId);
      
      // Check if this is the main branch
      const branchDoc = await getDoc(branchRef);
      if (branchDoc.exists()) {
        const data = branchDoc.data();
        if (data.type === 'main' || data.isMain) {
          throw new Error('Cannot delete the main branch');
        }
      }
      
      // Soft delete by setting status to inactive
      await updateDoc(branchRef, {
        status: 'inactive',
        active: false,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error deleting branch:', error);
      throw error;
    }
  },

  // Get all branches for a company
  async getBranches(companyId: string, includeInactive = false): Promise<Branch[]> {
    try {
      const branchesRef = collection(db, 'companies', companyId, 'branches');
      
      // Temporary workaround: Get all docs and filter client-side until index is created
      // TODO: Once the branches index is created (active + createdAt), revert to using Firestore queries:
      // let q = query(branchesRef, orderBy('createdAt', 'asc'));
      // if (!includeInactive) {
      //   q = query(branchesRef, where('active', '==', true), orderBy('createdAt', 'asc'));
      // }
      const snapshot = await getDocs(branchesRef);
      const branches: Branch[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        
        // Filter inactive branches if needed
        if (!includeInactive && data.active === false) {
          return;
        }
        
        branches.push({
          id: doc.id,
          ...data,
          // Ensure new fields exist with defaults
          type: data.type || (data.isMain ? 'main' : 'secondary'),
          status: data.status || (data.active !== false ? 'active' : 'inactive'),
        } as Branch);
      });
      
      // Sort branches: main branch first, then by createdAt
      branches.sort((a, b) => {
        // Main branch always comes first
        if (a.type === 'main' || a.isMain) return -1;
        if (b.type === 'main' || b.isMain) return 1;
        
        // Sort by createdAt (ascending)
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return aTime - bTime;
      });
      
      return branches;
    } catch (error) {
      console.error('Error getting branches:', error);
      throw error;
    }
  },

  // Get a single branch
  async getBranch(companyId: string, branchId: string): Promise<Branch | null> {
    try {
      const branchRef = doc(db, 'companies', companyId, 'branches', branchId);
      const branchDoc = await getDoc(branchRef);
      
      if (!branchDoc.exists()) {
        return null;
      }
      
      const data = branchDoc.data();
      return {
        id: branchDoc.id,
        ...data,
        type: data.type || (data.isMain ? 'main' : 'secondary'),
        status: data.status || (data.active !== false ? 'active' : 'inactive'),
      } as Branch;
    } catch (error) {
      console.error('Error getting branch:', error);
      throw error;
    }
  },

  // Assign staff to a branch
  async assignStaffToBranch(companyId: string, branchId: string, staffIds: string[]): Promise<void> {
    try {
      const batch = writeBatch(db);
      
      // Update branch with staff IDs
      const branchRef = doc(db, 'companies', companyId, 'branches', branchId);
      batch.update(branchRef, {
        staff: staffIds,
        updatedAt: serverTimestamp(),
      });
      
      // Update each staff member with branch assignment
      for (const staffId of staffIds) {
        const staffRef = doc(db, 'staff', staffId);
        batch.update(staffRef, {
          branchId: branchId,
          updatedAt: serverTimestamp(),
        });
      }
      
      await batch.commit();
    } catch (error) {
      console.error('Error assigning staff to branch:', error);
      throw error;
    }
  },

  // Assign services to a branch
  async assignServicesToBranch(companyId: string, branchId: string, serviceIds: string[]): Promise<void> {
    try {
      const branchRef = doc(db, 'companies', companyId, 'branches', branchId);
      await updateDoc(branchRef, {
        services: serviceIds,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error assigning services to branch:', error);
      throw error;
    }
  },

  // Assign resources to a branch
  async assignResourcesToBranch(companyId: string, branchId: string, resourceIds: string[]): Promise<void> {
    try {
      const branchRef = doc(db, 'companies', companyId, 'branches', branchId);
      await updateDoc(branchRef, {
        resources: resourceIds,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error assigning resources to branch:', error);
      throw error;
    }
  },

  // Get branch count for a company
  async getBranchCount(companyId: string): Promise<number> {
    try {
      const branchesRef = collection(db, 'companies', companyId, 'branches');
      const q = query(branchesRef, where('active', '==', true));
      const snapshot = await getDocs(q);
      return snapshot.size;
    } catch (error) {
      console.error('Error getting branch count:', error);
      throw error;
    }
  },

  // Check if company can add more branches based on plan
  async canAddBranch(companyId: string, planType: 'trial' | 'basic' | 'pro' | 'enterprise' = 'trial'): Promise<boolean> {
    try {
      const currentCount = await this.getBranchCount(companyId);
      
      const limits = {
        trial: 2,
        basic: 3,
        pro: 5,
        enterprise: Infinity,
      };
      
      return currentCount < limits[planType];
    } catch (error) {
      console.error('Error checking branch limit:', error);
      throw error;
    }
  },
};