import { 
  collection, 
  doc, 
  getDoc,
  getDocs, 
  setDoc,
  updateDoc, 
  serverTimestamp,
  Timestamp,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// Location Settings interfaces
export interface LocationBasicSettings {
  locationName: string;
  businessName: string;
  category: string;
  city: string;
  notificationLanguage: string;
  dateFormat: string;
  logoUrl?: string;
}

export interface LocationContactDetails {
  address: string;
  postalCode?: string;
  phones: Array<{
    countryCode: string;
    number: string;
  }>;
  website?: string;
  businessHours?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface LocationDescription {
  content: string; // Rich text HTML content
  plainText?: string; // Plain text version for SEO
}

export interface LocationPhotos {
  banner?: {
    url: string;
    caption?: string;
  };
  photos: Array<{
    url: string;
    caption?: string;
    order: number;
  }>;
}

export interface CompanyLegalDetails {
  type: 'legal_entity' | 'sole_proprietor' | 'partnership' | 'other';
  businessName: string;
  legalAddress?: string;
  actualAddress?: string;
  taxId?: string;
  industryCode?: string;
  bankCode?: string;
  bankName?: string;
  correspondentAccount?: string;
  cardPaymentAccount?: string;
}

export interface LocationSettings {
  id?: string;
  companyId: string;
  branchId?: string;
  basic: LocationBasicSettings;
  contact: LocationContactDetails;
  description?: LocationDescription;
  photos?: LocationPhotos;
  legal?: CompanyLegalDetails;
  socialMedia?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
    youtube?: string;
    tiktok?: string;
  };
  seo?: {
    metaTitle?: string;
    metaDescription?: string;
    keywords?: string[];
  };
  active: boolean;
  isMain: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

class LocationService {
  private collectionName = 'locationSettings';

  // Get location settings for a company (specific branch)
  async getLocationSettings(companyId: string, branchId?: string): Promise<LocationSettings | null> {
    try {
      // If no branchId provided, use 'main' as default
      const docId = branchId ? `${companyId}_${branchId}` : `${companyId}_main`;
      const docRef = doc(db, this.collectionName, docId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data()
        } as LocationSettings;
      }
      
      // Return default settings if none exist
      return this.getDefaultLocationSettings(companyId, branchId);
    } catch (error) {
      console.error('Error getting location settings:', error);
      throw error;
    }
  }

  // Get default location settings
  private getDefaultLocationSettings(companyId: string, branchId?: string): LocationSettings {
    return {
      companyId,
      branchId,
      basic: {
        locationName: 'الفرع الرئيسي',
        businessName: '',
        category: '',
        city: '',
        notificationLanguage: 'ar',
        dateFormat: 'DD.MM.YYYY, HH:mm',
      },
      contact: {
        address: '',
        phones: [{ countryCode: '+20', number: '' }], // Egypt default
      },
      active: true,
      isMain: !branchId,
    };
  }

  // Save or update location settings
  async saveLocationSettings(
    companyId: string, 
    settings: Partial<LocationSettings>,
    branchId?: string
  ): Promise<void> {
    try {
      const docId = branchId ? `${companyId}_${branchId}` : `${companyId}_main`;
      const docRef = doc(db, this.collectionName, docId);
      
      // Check if document exists
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        // Update existing
        await updateDoc(docRef, {
          ...settings,
          updatedAt: serverTimestamp(),
        });
      } else {
        // Create new
        await setDoc(docRef, {
          ...settings,
          companyId,
          branchId,
          isMain: !branchId,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error('Error saving location settings:', error);
      throw error;
    }
  }

  // Update basic settings
  async updateBasicSettings(
    companyId: string,
    basicSettings: Partial<LocationBasicSettings>,
    branchId?: string
  ): Promise<void> {
    try {
      const docId = branchId ? `${companyId}_${branchId}` : `${companyId}_main`;
      const docRef = doc(db, this.collectionName, docId);
      
      // Check if document exists
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        // Update existing
        await updateDoc(docRef, {
          basic: basicSettings,
          updatedAt: serverTimestamp(),
        });
        console.log('Location settings updated successfully');
      } else {
        // Create new with basic settings
        await setDoc(docRef, {
          companyId,
          branchId,
          basic: basicSettings,
          contact: {
            address: '',
            phones: [{ countryCode: '+20', number: '' }],
          },
          isMain: !branchId,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        console.log('Location settings created successfully');
      }
      
      // Also update branch name in the branches subcollection if locationName changed
      if (basicSettings.locationName) {
        console.log('Updating branch name to:', basicSettings.locationName);
        await this.updateBranchName(companyId, branchId || 'main', basicSettings.locationName);
      }
    } catch (error) {
      console.error('Error updating basic settings:', error);
      throw error;
    }
  }

  // Update contact details
  async updateContactDetails(
    companyId: string,
    contactDetails: Partial<LocationContactDetails>,
    branchId?: string
  ): Promise<void> {
    try {
      const docId = branchId ? `${companyId}_${branchId}` : `${companyId}_main`;
      const docRef = doc(db, this.collectionName, docId);
      
      // Check if document exists
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        // Update existing
        await updateDoc(docRef, {
          contact: contactDetails,
          updatedAt: serverTimestamp(),
        });
      } else {
        // Create new with contact details
        await setDoc(docRef, {
          companyId,
          branchId,
          basic: {
            locationName: 'الفرع الرئيسي',
            businessName: '',
            category: '',
            city: '',
            notificationLanguage: 'ar',
            dateFormat: 'DD.MM.YYYY, HH:mm',
          },
          contact: contactDetails,
          isMain: !branchId,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error('Error updating contact details:', error);
      throw error;
    }
  }

  // Update description
  async updateDescription(
    companyId: string,
    description: LocationDescription,
    branchId?: string
  ): Promise<void> {
    try {
      const docId = branchId ? `${companyId}_${branchId}` : `${companyId}_main`;
      const docRef = doc(db, this.collectionName, docId);
      
      // Check if document exists
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        // Update existing
        await updateDoc(docRef, {
          description,
          updatedAt: serverTimestamp(),
        });
      } else {
        // Create new with description
        await setDoc(docRef, {
          companyId,
          branchId,
          basic: this.getDefaultLocationSettings(companyId, branchId).basic,
          contact: this.getDefaultLocationSettings(companyId, branchId).contact,
          description,
          isMain: !branchId,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error('Error updating description:', error);
      throw error;
    }
  }

  // Update photos
  async updatePhotos(
    companyId: string,
    photos: LocationPhotos,
    branchId?: string
  ): Promise<void> {
    try {
      const docId = branchId ? `${companyId}_${branchId}` : `${companyId}_main`;
      const docRef = doc(db, this.collectionName, docId);
      
      // Check if document exists
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        // Update existing
        await updateDoc(docRef, {
          photos,
          updatedAt: serverTimestamp(),
        });
      } else {
        // Create new with photos
        await setDoc(docRef, {
          companyId,
          branchId,
          basic: this.getDefaultLocationSettings(companyId, branchId).basic,
          contact: this.getDefaultLocationSettings(companyId, branchId).contact,
          photos,
          isMain: !branchId,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error('Error updating photos:', error);
      throw error;
    }
  }

  // Update legal details
  async updateLegalDetails(
    companyId: string,
    legalDetails: Partial<CompanyLegalDetails>,
    branchId?: string
  ): Promise<void> {
    try {
      const docId = branchId ? `${companyId}_${branchId}` : `${companyId}_main`;
      const docRef = doc(db, this.collectionName, docId);
      
      // Check if document exists
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        // Update existing
        await updateDoc(docRef, {
          legal: legalDetails,
          updatedAt: serverTimestamp(),
        });
      } else {
        // Create new with legal details
        await setDoc(docRef, {
          companyId,
          branchId,
          basic: this.getDefaultLocationSettings(companyId, branchId).basic,
          contact: this.getDefaultLocationSettings(companyId, branchId).contact,
          legal: legalDetails,
          isMain: !branchId,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error('Error updating legal details:', error);
      throw error;
    }
  }

  // Subscribe to location settings changes
  subscribeToLocationSettings(
    companyId: string,
    onUpdate: (settings: LocationSettings | null) => void,
    onError?: (error: Error) => void,
    branchId?: string
  ): Unsubscribe {
    // If no branchId provided, use 'main' as default
    const docId = branchId ? `${companyId}_${branchId}` : `${companyId}_main`;
    const docRef = doc(db, this.collectionName, docId);

    return onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          onUpdate({
            id: docSnap.id,
            ...docSnap.data()
          } as LocationSettings);
        } else {
          onUpdate(this.getDefaultLocationSettings(companyId, branchId));
        }
      },
      (error) => {
        console.error('Error subscribing to location settings:', error);
        if (onError) onError(error);
      }
    );
  }

  // Validate phone number format
  validatePhoneNumber(countryCode: string, phoneNumber: string): boolean {
    // Basic validation - can be enhanced with libphonenumber
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    
    // Country-specific validation
    switch (countryCode) {
      case '+20': // Egypt
        return cleanNumber.length === 10 || cleanNumber.length === 11;
      case '+1': // US/Canada
        return cleanNumber.length === 10;
      case '+44': // UK
        return cleanNumber.length === 10 || cleanNumber.length === 11;
      default:
        return cleanNumber.length >= 7 && cleanNumber.length <= 15;
    }
  }

  // Format business hours for display
  formatBusinessHours(hours: string): string {
    // This can be enhanced with proper parsing
    return hours.trim();
  }

  // Get cities list in Arabic
  getCities(): string[] {
    return [
      'القاهرة',
      'الإسكندرية',
      'الجيزة',
      'شرم الشيخ',
      'الغردقة',
      'الأقصر',
      'أسوان',
      'بورسعيد',
      'السويس',
      'المنصورة',
      'طنطا',
      'أسيوط',
      'الفيوم',
      'الإسماعيلية',
      'الزقازيق',
      'دمياط',
      'المنيا',
      'بني سويف',
      'قنا',
      'سوهاج',
    ];
  }

  // Get cities with bilingual support
  getCitiesWithTranslation(): Array<{ value: string; labelAr: string; labelEn: string }> {
    return [
      { value: 'cairo', labelAr: 'القاهرة', labelEn: 'Cairo' },
      { value: 'alexandria', labelAr: 'الإسكندرية', labelEn: 'Alexandria' },
      { value: 'giza', labelAr: 'الجيزة', labelEn: 'Giza' },
      { value: 'sharm_el_sheikh', labelAr: 'شرم الشيخ', labelEn: 'Sharm El-Sheikh' },
      { value: 'hurghada', labelAr: 'الغردقة', labelEn: 'Hurghada' },
      { value: 'luxor', labelAr: 'الأقصر', labelEn: 'Luxor' },
      { value: 'aswan', labelAr: 'أسوان', labelEn: 'Aswan' },
      { value: 'port_said', labelAr: 'بورسعيد', labelEn: 'Port Said' },
      { value: 'suez', labelAr: 'السويس', labelEn: 'Suez' },
      { value: 'mansoura', labelAr: 'المنصورة', labelEn: 'Mansoura' },
      { value: 'tanta', labelAr: 'طنطا', labelEn: 'Tanta' },
      { value: 'asyut', labelAr: 'أسيوط', labelEn: 'Asyut' },
      { value: 'fayoum', labelAr: 'الفيوم', labelEn: 'Fayoum' },
      { value: 'ismailia', labelAr: 'الإسماعيلية', labelEn: 'Ismailia' },
      { value: 'zagazig', labelAr: 'الزقازيق', labelEn: 'Zagazig' },
      { value: 'damietta', labelAr: 'دمياط', labelEn: 'Damietta' },
      { value: 'minya', labelAr: 'المنيا', labelEn: 'Minya' },
      { value: 'beni_suef', labelAr: 'بني سويف', labelEn: 'Beni Suef' },
      { value: 'qena', labelAr: 'قنا', labelEn: 'Qena' },
      { value: 'sohag', labelAr: 'سوهاج', labelEn: 'Sohag' },
    ];
  }

  // Get business categories with proper structure
  getBusinessCategories(): Array<{ value: string; labelAr: string; labelEn: string }> {
    return [
      { value: 'beauty_salon', labelAr: 'صالون تجميل', labelEn: 'Beauty Salon' },
      { value: 'barbershop', labelAr: 'صالون حلاقة', labelEn: 'Barbershop' },
      { value: 'spa_wellness', labelAr: 'سبا ومركز عافية', labelEn: 'Spa & Wellness' },
      { value: 'medical_clinic', labelAr: 'عيادة طبية', labelEn: 'Medical Clinic' },
      { value: 'dental_clinic', labelAr: 'عيادة أسنان', labelEn: 'Dental Clinic' },
      { value: 'fitness_center', labelAr: 'مركز لياقة بدنية', labelEn: 'Fitness Center' },
      { value: 'restaurant', labelAr: 'مطعم', labelEn: 'Restaurant' },
      { value: 'retail_store', labelAr: 'متجر بيع بالتجزئة', labelEn: 'Retail Store' },
      { value: 'professional_services', labelAr: 'خدمات مهنية', labelEn: 'Professional Services' },
      { value: 'educational_center', labelAr: 'مركز تعليمي', labelEn: 'Educational Center' },
      { value: 'photography_studio', labelAr: 'استوديو تصوير', labelEn: 'Photography Studio' },
      { value: 'event_planning', labelAr: 'تنظيم فعاليات', labelEn: 'Event Planning' },
      { value: 'automotive_services', labelAr: 'خدمات السيارات', labelEn: 'Automotive Services' },
      { value: 'pet_services', labelAr: 'خدمات الحيوانات الأليفة', labelEn: 'Pet Services' },
      { value: 'other', labelAr: 'أخرى', labelEn: 'Other' },
    ];
  }

  // Get business categories as simple array (for backward compatibility)
  getBusinessCategoriesSimple(): string[] {
    return this.getBusinessCategories().map(cat => cat.labelAr);
  }

  // Map setup wizard business type to location category
  mapBusinessTypeToCategory(businessType: string): string {
    const mappings: Record<string, string> = {
      'barbershop': 'صالون حلاقة',
      'beauty-salon': 'صالون تجميل',
      'beauty-center': 'سبا ومركز عافية',
      'hair-salon': 'صالون تجميل',
      'nail-salon': 'صالون تجميل',
      'gym': 'مركز لياقة بدنية',
      'spa': 'سبا ومركز عافية',
      'wellness-center': 'سبا ومركز عافية',
      'clinic': 'عيادة طبية',
      'dental': 'عيادة أسنان',
      'restaurant': 'مطعم',
      'cafe': 'مطعم',
      'retail': 'متجر بيع بالتجزئة',
      'professional': 'خدمات مهنية',
      'educational': 'مركز تعليمي',
      'other': 'أخرى',
    };
    
    // Get the Arabic label from the mapping
    const arabicLabel = mappings[businessType];
    if (!arabicLabel) {
      return 'أخرى'; // Default to 'Other' if not found
    }
    
    return arabicLabel;
  }

  // Update photos
  async updatePhotos(companyId: string, photos: LocationPhotos, branchId?: string): Promise<void> {
    try {
      const docId = branchId ? `${companyId}_${branchId}` : `${companyId}_main`;
      const docRef = doc(db, this.collectionName, docId);
      
      // Check if document exists
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        await updateDoc(docRef, {
          photos,
          updatedAt: serverTimestamp(),
        });
      } else {
        // Create new document with photos
        const defaultSettings = this.getDefaultLocationSettings(companyId, branchId);
        await setDoc(docRef, {
          ...defaultSettings,
          photos,
          updatedAt: serverTimestamp(),
        });
      }
      
      console.log('Photos updated successfully');
    } catch (error) {
      console.error('Error updating photos:', error);
      throw error;
    }
  }

  // Update branch name in the branches subcollection
  async updateBranchName(companyId: string, branchId: string, name: string): Promise<void> {
    try {
      console.log(`Attempting to update branch name. CompanyId: ${companyId}, BranchId: ${branchId}, Name: ${name}`);
      
      // First, try with the provided branchId
      const branchRef = doc(db, 'companies', companyId, 'branches', branchId);
      const branchDoc = await getDoc(branchRef);
      
      if (branchDoc.exists()) {
        await updateDoc(branchRef, {
          name,
          updatedAt: serverTimestamp(),
        });
        console.log('Branch name updated successfully in branches collection');
        return;
      }
      
      // If not found and branchId is '1', try 'main' (for backward compatibility)
      if (branchId === '1') {
        console.log('Branch with ID "1" not found, trying "main"...');
        const mainBranchRef = doc(db, 'companies', companyId, 'branches', 'main');
        const mainBranchDoc = await getDoc(mainBranchRef);
        
        if (mainBranchDoc.exists()) {
          await updateDoc(mainBranchRef, {
            name,
            updatedAt: serverTimestamp(),
          });
          console.log('Branch name updated successfully for main branch');
          return;
        }
      }
      
      // If still not found, check if there's only one branch and update it
      const branchesRef = collection(db, 'companies', companyId, 'branches');
      const branchesSnapshot = await getDocs(branchesRef);
      
      if (branchesSnapshot.size === 1) {
        const singleBranchDoc = branchesSnapshot.docs[0];
        await updateDoc(singleBranchDoc.ref, {
          name,
          updatedAt: serverTimestamp(),
        });
        console.log(`Branch name updated for single branch (ID: ${singleBranchDoc.id})`);
      } else {
        console.warn(`Branch ${branchId} not found in branches subcollection and multiple branches exist`);
      }
    } catch (error) {
      console.error('Error updating branch name:', error);
      // Don't throw here to avoid breaking the main save operation
    }
  }
}

export const locationService = new LocationService();