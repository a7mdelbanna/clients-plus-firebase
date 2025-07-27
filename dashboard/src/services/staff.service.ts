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

// Access levels enum
export type AccessLevel = 'Employee' | 'Administrator' | 'CallCenter' | 'Accountant' | 'Manager' | 'Owner';

// Staff interface - Enhanced version
export interface Staff {
  id?: string;
  companyId: string;
  branchId?: string; // Deprecated - kept for backward compatibility
  branchIds?: string[]; // Multiple branch assignments
  
  // Basic Info
  name: string; // Primary name in Arabic
  lastName?: string;
  middleName?: string;
  specialization?: string; // What customers see during online booking
  positionId?: string; // Reference to position for filtering
  avatar?: string; // Profile photo URL
  
  // Contact
  email?: string;
  phone?: string;
  
  // Access & Authentication
  access: {
    level: AccessLevel;
    status: 'not_granted' | 'invited' | 'active';
    inviteSentAt?: Timestamp;
    lastLogin?: Timestamp;
  };
  
  // Schedule
  schedule: {
    isScheduled: boolean;
    scheduleStartDate?: Timestamp; // When the schedule starts
    scheduledUntil?: Timestamp; // When the schedule ends
    defaultTemplate?: string; // Reference to schedule template
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
  };
  
  // Services
  services: string[]; // Service IDs this employee provides
  servicesCount?: number; // For quick display
  
  // Online Booking
  onlineBooking: {
    enabled: boolean;
    profile?: {
      description?: string; // Rich text description
      showRating?: boolean;
    };
    rules?: {
      requirePrepayment?: boolean;
      allowAnySpecialist?: boolean;
    };
    schedulingTime?: 'general' | 'personal';
  };
  
  // Personal Information
  personalInfo?: {
    employmentDate?: Timestamp;
    registrationEndDate?: Timestamp; // Patent termination date
    citizenship?: string;
    gender?: 'Unknown' | 'Male' | 'Female';
  };
  
  // Documents
  documents?: {
    passport?: string;
    taxId?: string; // Taxpayer Identification Number
    insuranceNumber?: string;
  };
  
  // System fields
  status: 'active' | 'dismissed' | 'deleted';
  active: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: string;
}

// Access level permissions
export const AccessLevelPermissions: Record<AccessLevel, string[]> = {
  Employee: ['view_own_schedule', 'view_own_services', 'update_availability'],
  Administrator: ['manage_appointments', 'manage_payments', 'view_all_schedules'],
  CallCenter: ['create_appointments', 'view_all_schedules', 'manage_clients'],
  Accountant: ['view_payroll', 'manage_payroll', 'view_financial_reports'],
  Manager: ['manage_location', 'manage_staff', 'view_reports'],
  Owner: ['*'], // All permissions
};

// Access level descriptions for UI
export const AccessLevelDescriptions: Record<AccessLevel, string> = {
  Employee: 'يقدم الخدمات',
  Administrator: 'مسؤول عن المواعيد ومدفوعاتها',
  CallCenter: 'يساعد العملاء ويحجز المواعيد',
  Accountant: 'مسؤول عن الرواتب',
  Manager: 'يدير موقعًا',
  Owner: 'لديه جميع الصلاحيات',
};

export const staffService = {
  // Create a new staff member
  async createStaff(
    staff: Omit<Staff, 'id' | 'createdAt' | 'updatedAt'>,
    userId: string,
    branchId?: string
  ): Promise<string> {
    const staffData = {
      ...staff,
      branchId: branchId || staff.branchId, // Keep for backward compatibility
      branchIds: staff.branchIds || (branchId ? [branchId] : []), // New multi-branch support
      services: staff.services || [],
      servicesCount: staff.services?.length || 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: userId,
    };

    const docRef = await addDoc(collection(db, 'staff'), staffData);
    
    // Update position staff count if position is assigned
    if (staff.positionId) {
      await this.updatePositionStaffCount(staff.positionId, 1);
    }
    
    return docRef.id;
  },

  // Get all staff for a company
  async getStaff(companyId: string, branchId?: string): Promise<Staff[]> {
    const q = query(
      collection(db, 'staff'),
      where('companyId', '==', companyId),
      where('active', '==', true)
    );

    const snapshot = await getDocs(q);
    let staff = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        access: data.access || { level: 'Employee', status: 'not_granted' },
        schedule: data.schedule || { isScheduled: false },
        services: data.services || [],
        onlineBooking: data.onlineBooking || { enabled: false },
      } as Staff;
    });
    
    // Filter by branch on client side to handle both legacy and new data
    if (branchId) {
      staff = staff.filter(s => {
        // Check new branchIds array first
        if (s.branchIds && s.branchIds.length > 0) {
          return s.branchIds.includes(branchId);
        }
        // Fall back to legacy single branchId
        if (s.branchId) {
          return s.branchId === branchId;
        }
        // Include staff with no branch assignment (legacy data)
        return !s.branchId && !s.branchIds;
      });
    }
    
    // Sort by name
    return staff.sort((a, b) => a.name.localeCompare(b.name));
  },

  // Get staff by position
  async getStaffByPosition(companyId: string, positionId: string): Promise<Staff[]> {
    const q = query(
      collection(db, 'staff'),
      where('companyId', '==', companyId),
      where('positionId', '==', positionId),
      where('active', '==', true)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as Staff));
  },

  // Get a single staff member
  async getStaffMember(staffId: string): Promise<Staff | null> {
    const docSnap = await getDoc(doc(db, 'staff', staffId));
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
      } as Staff;
    }
    return null;
  },

  // Update a staff member
  async updateStaff(staffId: string, updates: Partial<Staff>): Promise<void> {
    const currentStaff = await this.getStaffMember(staffId);
    if (!currentStaff) throw new Error('Staff member not found');

    // Handle position change
    if ('positionId' in updates && updates.positionId !== currentStaff.positionId) {
      // Decrease count for old position
      if (currentStaff.positionId) {
        await this.updatePositionStaffCount(currentStaff.positionId, -1);
      }
      // Increase count for new position
      if (updates.positionId) {
        await this.updatePositionStaffCount(updates.positionId, 1);
      }
    }

    // Update services count if services are updated
    const updateData: any = { ...updates };
    if ('services' in updates) {
      updateData.servicesCount = updates.services?.length || 0;
    }

    await updateDoc(doc(db, 'staff', staffId), {
      ...updateData,
      updatedAt: serverTimestamp(),
    });
  },

  // Delete a staff member (soft delete)
  async deleteStaff(staffId: string): Promise<void> {
    const currentStaff = await this.getStaffMember(staffId);
    if (!currentStaff) throw new Error('Staff member not found');

    // Update position staff count
    if (currentStaff.positionId) {
      await this.updatePositionStaffCount(currentStaff.positionId, -1);
    }

    await updateDoc(doc(db, 'staff', staffId), {
      active: false,
      status: 'deleted',
      'personalInfo.registrationEndDate': serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  },

  // Update position staff count
  async updatePositionStaffCount(positionId: string, change: number): Promise<void> {
    const positionRef = doc(db, 'positions', positionId);
    const positionDoc = await getDoc(positionRef);
    
    if (positionDoc.exists()) {
      const currentCount = positionDoc.data().staffCount || 0;
      await updateDoc(positionRef, {
        staffCount: Math.max(0, currentCount + change),
        updatedAt: serverTimestamp(),
      });
    }
  },

  // Real-time subscription to staff
  subscribeToStaff(
    companyId: string,
    callback: (staff: Staff[]) => void,
    errorCallback?: (error: Error) => void,
    branchId?: string
  ): Unsubscribe {
    const q = query(
      collection(db, 'staff'),
      where('companyId', '==', companyId),
      where('active', '==', true)
    );

    return onSnapshot(
      q, 
      (snapshot) => {
        let staff = snapshot.docs.map(doc => {
          const data = doc.data();
          // Ensure proper data structure for new schema
          return {
            id: doc.id,
            ...data,
            access: data.access || { level: 'Employee', status: 'not_granted' },
            schedule: data.schedule || { isScheduled: false },
            services: data.services || [],
            onlineBooking: data.onlineBooking || { enabled: false },
          } as Staff;
        });
        
        // Filter by branch on client side to handle both legacy and new data
        if (branchId) {
          staff = staff.filter(s => {
            // Check new branchIds array first
            if (s.branchIds && s.branchIds.length > 0) {
              return s.branchIds.includes(branchId);
            }
            // Fall back to legacy single branchId
            if (s.branchId) {
              return s.branchId === branchId;
            }
            // Include staff with no branch assignment (legacy data)
            return !s.branchId && !s.branchIds;
          });
        }
        
        // Sort by name
        const sortedStaff = staff.sort((a, b) => a.name.localeCompare(b.name));
        callback(sortedStaff);
      },
      (error) => {
        console.error('Error in subscribeToStaff:', error);
        if (errorCallback) {
          errorCallback(error);
        }
      }
    );
  },

  // Check if email exists for company
  async checkEmailExists(
    companyId: string, 
    email: string, 
    excludeId?: string
  ): Promise<boolean> {
    const q = query(
      collection(db, 'staff'),
      where('companyId', '==', companyId),
      where('email', '==', email),
      where('active', '==', true)
    );

    const snapshot = await getDocs(q);
    
    if (excludeId) {
      return snapshot.docs.some(doc => doc.id !== excludeId);
    }
    
    return !snapshot.empty;
  },

  // Get staff by service
  async getStaffByService(companyId: string, serviceId: string): Promise<Staff[]> {
    const q = query(
      collection(db, 'staff'),
      where('companyId', '==', companyId),
      where('services', 'array-contains', serviceId),
      where('active', '==', true),
      where('status', '==', 'active')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as Staff));
  },

  // Get staff with filters
  async getStaffWithFilters(
    companyId: string,
    filters: {
      positionId?: string;
      status?: 'active' | 'dismissed' | 'deleted';
      accessLevel?: AccessLevel;
      searchTerm?: string;
    }
  ): Promise<Staff[]> {
    let q = query(
      collection(db, 'staff'),
      where('companyId', '==', companyId)
    );

    // Apply position filter
    if (filters.positionId) {
      q = query(q, where('positionId', '==', filters.positionId));
    }

    // Apply status filter
    if (filters.status) {
      q = query(q, where('status', '==', filters.status));
    }

    // Apply access level filter
    if (filters.accessLevel) {
      q = query(q, where('access.level', '==', filters.accessLevel));
    }

    const snapshot = await getDocs(q);
    let staff = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as Staff));

    // Apply text search on client side
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      staff = staff.filter(s => 
        s.name.toLowerCase().includes(searchLower) ||
        s.specialization?.toLowerCase().includes(searchLower) ||
        s.email?.toLowerCase().includes(searchLower) ||
        s.phone?.includes(filters.searchTerm)
      );
    }

    return staff.sort((a, b) => a.name.localeCompare(b.name));
  },

  // Send invitation to staff member
  async sendStaffInvitation(
    staffId: string,
    contactInfo: string
  ): Promise<void> {
    // This would integrate with email/SMS service
    await updateDoc(doc(db, 'staff', staffId), {
      'access.status': 'invited',
      'access.inviteSentAt': serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  },

  // Update staff services
  async updateStaffServices(
    staffId: string,
    serviceIds: string[]
  ): Promise<void> {
    await updateDoc(doc(db, 'staff', staffId), {
      services: serviceIds,
      servicesCount: serviceIds.length,
      updatedAt: serverTimestamp(),
    });
  },

  // Sync staff branch assignments to branch documents
  async syncStaffBranchAssignments(
    companyId: string,
    staffId: string,
    newBranchIds: string[]
  ): Promise<void> {
    try {
      // Get current staff data to find old branches
      const staffDoc = await getDoc(doc(db, 'staff', staffId));
      if (!staffDoc.exists()) return;
      
      const staffData = staffDoc.data();
      const oldBranchIds = staffData.branchIds || (staffData.branchId ? [staffData.branchId] : []);
      
      // Find branches to remove staff from
      const branchesToRemove = oldBranchIds.filter((id: string) => !newBranchIds.includes(id));
      
      // Find branches to add staff to
      const branchesToAdd = newBranchIds.filter(id => !oldBranchIds.includes(id));
      
      // Update branch documents
      const updatePromises: Promise<void>[] = [];
      
      // Remove staff from old branches
      for (const branchId of branchesToRemove) {
        const branchRef = doc(db, 'companies', companyId, 'branches', branchId);
        const branchDoc = await getDoc(branchRef);
        
        if (branchDoc.exists()) {
          const currentStaff = branchDoc.data().staff || [];
          const newStaff = currentStaff.filter((id: string) => id !== staffId);
          
          updatePromises.push(
            updateDoc(branchRef, {
              staff: newStaff,
              updatedAt: serverTimestamp(),
            })
          );
        }
      }
      
      // Add staff to new branches
      for (const branchId of branchesToAdd) {
        const branchRef = doc(db, 'companies', companyId, 'branches', branchId);
        const branchDoc = await getDoc(branchRef);
        
        if (branchDoc.exists()) {
          const currentStaff = branchDoc.data().staff || [];
          if (!currentStaff.includes(staffId)) {
            currentStaff.push(staffId);
          }
          
          updatePromises.push(
            updateDoc(branchRef, {
              staff: currentStaff,
              updatedAt: serverTimestamp(),
            })
          );
        }
      }
      
      // Execute all updates
      await Promise.all(updatePromises);
      
    } catch (error) {
      console.error('Error syncing staff branch assignments:', error);
      throw error;
    }
  },
};