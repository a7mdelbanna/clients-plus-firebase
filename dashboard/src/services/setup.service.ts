import { 
  doc, 
  updateDoc, 
  getDoc, 
  setDoc,
  collection, 
  addDoc, 
  serverTimestamp,
  writeBatch 
} from 'firebase/firestore';
import { db, functions } from '../config/firebase';
import { httpsCallable } from 'firebase/functions';
import type { CompanySetupData, Branch } from '../types/index';
import { businessThemes, defaultTheme } from '../themes';

interface CompanyData {
  id: string;
  name: string;
  businessType?: string;
  mainServices?: string[];
  ownerPosition?: string;
  employeeCount?: number;
  theme?: {
    id: string;
    primary: string;
    secondary: string;
  };
  setupCompleted?: boolean;
  setupCompletedAt?: any;
  branches?: Branch[];
}

export const setupService = {
  // Get user's company ID from users collection
  async getUserCompanyId(userId: string): Promise<string | null> {
    try {
      // First try to get from token claims
      const { currentUser } = await import('firebase/auth').then(m => ({ currentUser: m.getAuth().currentUser }));
      if (currentUser && currentUser.uid === userId) {
        const idTokenResult = await currentUser.getIdTokenResult();
        if (idTokenResult.claims.companyId) {
          return idTokenResult.claims.companyId as string;
        }
      }
      
      // Then try to get from user document
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          return userDoc.data().companyId || null;
        }
      } catch (docError) {
        console.log('User document not found, this is expected for new users');
      }
      
      return null;
    } catch (error) {
      console.error('Error getting user company ID:', error);
      return null;
    }
  },
  
  // Get user document
  async getUserDoc(userId: string): Promise<any | null> {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        return userDoc.data();
      }
      return null;
    } catch (error) {
      // This is expected for new users who haven't completed setup
      console.log('User document not found, this is expected for new users');
      return null;
    }
  },
  // Create a new company for a user who just signed up
  async createCompanyForUser(userId: string, userEmail: string, userName: string): Promise<string> {
    try {
      // Small delay to ensure auth state is propagated
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Create a new company document
      const companyRef = doc(collection(db, 'companies'));
      const companyId = companyRef.id;
      
      const companyData = {
        id: companyId,
        name: '', // Will be set during setup
        createdAt: serverTimestamp(),
        active: true,
        subscription: {
          plan: 'TRIAL',
          status: 'ACTIVE',
          startDate: serverTimestamp(),
          endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days trial
        },
        settings: {
          language: 'ar',
          timezone: 'Africa/Cairo',
        },
        setupCompleted: false,
        ownerId: userId,
      };

      console.log('Creating company with ID:', companyId, 'for user:', userId);
      await setDoc(companyRef, companyData);

      // Create user document in company subcollection
      const userRef = doc(db, 'companies', companyId, 'users', userId);
      await setDoc(userRef, {
        id: userId,
        email: userEmail,
        name: userName,
        role: 'ADMIN',
        active: true,
        createdAt: serverTimestamp(),
        permissions: ['manage_all'],
      });

      // Also create in global users collection
      const globalUserRef = doc(db, 'users', userId);
      try {
        await setDoc(globalUserRef, {
          id: userId,
          email: userEmail,
          name: userName,
          role: 'ADMIN',
          companyId,
          active: true,
          createdAt: serverTimestamp(),
        });
        console.log('Global user document created successfully');
      } catch (globalUserError) {
        console.error('Error creating global user document:', globalUserError);
        // Continue anyway - the company is created
      }

      // Call cloud function to update user claims with companyId
      try {
        const updateClaims = httpsCallable(functions, 'updateUserClaims');
        await updateClaims({ 
          userId,
          claims: {
            companyId,
            role: 'ADMIN',
            permissions: ['manage_all']
          }
        });
      } catch (claimError) {
        console.error('Error updating claims:', claimError);
        // Don't throw - company is still created even if claims update fails
      }

      console.log('Company created successfully with ID:', companyId);
      return companyId;
    } catch (error) {
      console.error('Error creating company for user:', error);
      // Provide more specific error messages
      if (error instanceof Error && error.message.includes('Missing or insufficient permissions')) {
        throw new Error('خطأ في الصلاحيات. يرجى تحديث الصفحة والمحاولة مرة أخرى.');
      }
      throw new Error('فشل في إنشاء الشركة. يرجى المحاولة مرة أخرى.');
    }
  },

  // Check if company setup is completed
  async checkSetupStatus(companyId: string): Promise<boolean> {
    try {
      const companyRef = doc(db, 'companies', companyId);
      const companySnap = await getDoc(companyRef);
      
      if (companySnap.exists()) {
        const data = companySnap.data() as CompanyData;
        return data.setupCompleted || false;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking setup status:', error);
      return false;
    }
  },

  // Get company data
  async getCompanyData(companyId: string): Promise<CompanyData | null> {
    try {
      console.log('[setupService] Getting company data for ID:', companyId);
      const companyRef = doc(db, 'companies', companyId);
      const companySnap = await getDoc(companyRef);
      
      if (companySnap.exists()) {
        const data = companySnap.data();
        console.log('[setupService] Company document found:', data);
        return { id: companySnap.id, ...data } as CompanyData;
      }
      
      console.warn('[setupService] Company document does not exist for ID:', companyId);
      return null;
    } catch (error) {
      console.error('[setupService] Error fetching company data:', error);
      return null;
    }
  },

  // Complete company setup
  async completeSetup(companyId: string, setupData: CompanySetupData): Promise<void> {
    try {
      console.log('[setupService] Starting completeSetup for company:', companyId);
      console.log('[setupService] Setup data:', setupData);
      
      const batch = writeBatch(db);
      
      // Find the selected theme to get its colors
      const selectedTheme = businessThemes.find(t => t.id === setupData.themeId) || defaultTheme;
      
      // Update company document
      const companyRef = doc(db, 'companies', companyId);
      const updateData: any = {
        name: setupData.businessName,
        businessType: setupData.businessType,
        mainServices: setupData.mainServices,
        ownerPosition: setupData.ownerPosition,
        employeeCount: setupData.employeeCount,
        theme: {
          id: selectedTheme.id,
          primary: selectedTheme.primary,
          secondary: selectedTheme.secondary
        },
        setupCompleted: true,
        setupCompletedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      console.log('[setupService] Update data to be saved:', updateData);
      
      // Check if company exists and get current data
      const companySnap = await getDoc(companyRef);
      if (!companySnap.exists()) {
        console.error('[setupService] Company does not exist:', companyId);
        throw new Error('الشركة غير موجودة. يرجى تحديث الصفحة والمحاولة مرة أخرى.');
      }
      
      console.log('[setupService] Current company data before update:', companySnap.data());
      batch.update(companyRef, updateData);

      // Add branches as subcollection
      for (const branch of setupData.branches) {
        // Use the branch id from the data if it exists, otherwise generate new one
        const branchRef = branch.id 
          ? doc(db, 'companies', companyId, 'branches', branch.id)
          : doc(collection(db, 'companies', companyId, 'branches'));
        
        // Remove the id from branch data as it's stored as document ID
        const { id, ...branchData } = branch;
        
        batch.set(branchRef, {
          ...branchData,
          createdAt: serverTimestamp(),
          active: true
        });
      }

      // If there's only one branch, update it as the main location
      if (setupData.branches.length === 1) {
        const locationsRef = collection(db, 'companies', companyId, 'locations');
        const locationDoc = doc(locationsRef);
        batch.set(locationDoc, {
          name: setupData.branches[0].name,
          address: setupData.branches[0].address,
          phone: setupData.branches[0].phone,
          isMain: true,
          active: true,
          createdAt: serverTimestamp()
        });
      }

      await batch.commit();
      console.log('[setupService] Batch commit successful');
      
      // Call cloud function to update user claims if needed
      try {
        // Get the current user to update their claims
        const { currentUser } = await import('firebase/auth').then(m => ({ currentUser: m.getAuth().currentUser }));
        if (currentUser) {
          const updateClaims = httpsCallable(functions, 'updateUserClaims');
          console.log('[setupService] Updating user claims for user:', currentUser.uid);
          await updateClaims({ 
            userId: currentUser.uid,
            claims: {
              companyId: companyId,
              role: 'ADMIN',
              setupCompleted: true
            }
          });
          console.log('[setupService] User claims updated successfully');
        } else {
          console.warn('[setupService] No current user found, skipping claims update');
        }
      } catch (claimError) {
        console.error('[setupService] Error updating claims:', claimError);
        // Don't throw - setup is still successful even if claims update fails
      }
      
      console.log('[setupService] Setup completed successfully for company:', companyId);
      
    } catch (error) {
      console.error('[setupService] Error completing setup:', error);
      throw new Error('فشل في حفظ البيانات. يرجى المحاولة مرة أخرى.');
    }
  },

  // Save setup progress (optional - for saving draft)
  async saveSetupProgress(companyId: string, step: number, data: Partial<CompanySetupData>): Promise<void> {
    try {
      const progressRef = doc(db, 'companies', companyId, 'setupProgress', 'current');
      
      // Use set with merge to create document if it doesn't exist
      await setDoc(progressRef, {
        step,
        data,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.error('Error saving setup progress:', error);
      // Don't throw - this is optional functionality
    }
  },

  // Get setup progress (optional - for resuming setup)
  async getSetupProgress(companyId: string): Promise<{ step: number; data: Partial<CompanySetupData> } | null> {
    try {
      const progressRef = doc(db, 'companies', companyId, 'setupProgress', 'current');
      const progressSnap = await getDoc(progressRef);
      
      if (progressSnap.exists()) {
        return progressSnap.data() as { step: number; data: Partial<CompanySetupData> };
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching setup progress:', error);
      return null;
    }
  }
};