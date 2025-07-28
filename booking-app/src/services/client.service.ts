import { db } from '../config/firebase';
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';

export interface ClientAddress {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

export interface ClientMarketing {
  acceptsSMS: boolean;
  acceptsEmail: boolean;
  acceptsPromotions: boolean;
}

export interface ClientPreferences {
  // Service preferences
  preferredStaff?: string[];
  preferredDays?: string[];
  preferredTimes?: string[];
  roomPreferences?: string;
  
  // Communication preferences
  communicationLanguage?: string;
  communicationStyle?: 'silent' | 'minimal' | 'chatty' | 'very_social';
  
  // Lifestyle preferences
  favoriteDrinks?: string[];
  musicPreferences?: {
    genres?: string[];
    artists?: string[];
    volume?: 'quiet' | 'moderate' | 'loud';
    preference?: 'no_music' | 'background' | 'engaged';
  };
  
  // Comfort preferences
  temperaturePreference?: 'cold' | 'cool' | 'moderate' | 'warm' | 'hot';
  aromatherapy?: string[];
  refreshments?: {
    beverageTemperature?: 'ice_cold' | 'cold' | 'room_temp' | 'warm' | 'hot';
    snackPreferences?: string[];
  };
  
  // Special requests
  specialRequests?: string;
}

export interface Client {
  id?: string;
  companyId: string;
  
  // Basic Information
  firstName: string;
  lastName?: string;
  name?: string; // Legacy field
  gender?: 'male' | 'female' | 'other' | 'not_specified';
  dateOfBirth?: Timestamp;
  
  // Contact Information
  phone?: string;
  email?: string;
  address?: ClientAddress;
  
  // Marketing
  marketing?: ClientMarketing;
  
  // Preferences
  preferences?: ClientPreferences;
  
  // System fields
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

class ClientService {
  // Get client by ID
  async getClient(clientId: string): Promise<Client | null> {
    try {
      console.log('=== getClient START ===');
      console.log('ClientId:', clientId);
      
      const clientDoc = await getDoc(doc(db, 'clients', clientId));
      
      if (!clientDoc.exists()) {
        console.log('Client not found');
        return null;
      }
      
      const clientData = clientDoc.data() as Client;
      console.log('Client data loaded:', {
        id: clientDoc.id,
        name: clientData.name || `${clientData.firstName} ${clientData.lastName}`,
        phone: clientData.phone,
        email: clientData.email
      });
      
      return {
        id: clientDoc.id,
        ...clientData
      };
    } catch (error) {
      console.error('Error getting client:', error);
      throw error;
    }
  }
  
  // Update client profile
  async updateClient(clientId: string, updates: Partial<Client>): Promise<void> {
    try {
      console.log('=== updateClient START ===');
      console.log('ClientId:', clientId);
      console.log('Updates:', updates);
      
      // Remove fields that shouldn't be updated
      const { id, companyId, createdAt, ...updateData } = updates;
      
      // Ensure phone number is normalized if provided
      if (updateData.phone) {
        let normalizedPhone = updateData.phone.replace(/[\s\-\(\)]/g, '').replace(/^\+20/, '');
        // If the normalized phone doesn't start with 0, add it (Egyptian format)
        if (normalizedPhone && !normalizedPhone.startsWith('0')) {
          normalizedPhone = '0' + normalizedPhone;
        }
        updateData.phone = normalizedPhone;
        console.log('Normalized phone:', normalizedPhone);
      }
      
      // Update the name field for backward compatibility
      if (updateData.firstName || updateData.lastName) {
        const firstName = updateData.firstName || updates.firstName || '';
        const lastName = updateData.lastName || updates.lastName || '';
        updateData.name = `${firstName} ${lastName}`.trim();
      }
      
      // Remove undefined values - Firestore doesn't accept them
      const cleanedData = Object.entries(updateData).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {} as any);
      
      await updateDoc(doc(db, 'clients', clientId), {
        ...cleanedData,
        updatedAt: serverTimestamp(),
      });
      
      console.log('Client updated successfully');
      console.log('=== updateClient END ===');
    } catch (error) {
      console.error('Error updating client:', error);
      throw error;
    }
  }
}

export const clientService = new ClientService();