import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

export interface UserProfile {
  uid: string;
  displayName?: string;
  email?: string;
  phoneNumber?: string;
  location?: string;
  bio?: string;
  firstName?: string;
  lastName?: string;
  photoURL?: string;
  emailVerified?: boolean;
  companyId?: string;
  role?: string;
  preferences?: UserPreferences;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  lastLoginAt?: Timestamp;
}

export interface UserPreferences {
  language: 'en' | 'ar';
  theme: 'light' | 'dark' | 'system';
  notifications: {
    email: boolean;
    sms: boolean;
    push: boolean;
    appointments: boolean;
    reminders: boolean;
    marketing: boolean;
  };
  privacy: {
    profileVisibility: 'public' | 'company' | 'private';
    showLastSeen: boolean;
    showPhoneNumber: boolean;
  };
  display: {
    dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
    timeFormat: '12h' | '24h';
    timezone: string;
    currency: 'EGP' | 'USD' | 'EUR';
  };
}

export const defaultUserPreferences: UserPreferences = {
  language: 'ar',
  theme: 'system',
  notifications: {
    email: true,
    sms: true,
    push: true,
    appointments: true,
    reminders: true,
    marketing: false,
  },
  privacy: {
    profileVisibility: 'company',
    showLastSeen: true,
    showPhoneNumber: false,
  },
  display: {
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h',
    timezone: 'Africa/Cairo',
    currency: 'EGP',
  },
};

class UserService {
  // Get user profile from Firestore
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      
      if (userDoc.exists()) {
        return {
          uid,
          ...userDoc.data(),
        } as UserProfile;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting user profile:', error);
      throw error;
    }
  }

  // Create or update user profile
  async updateUserProfile(uid: string, profileData: Partial<UserProfile>): Promise<void> {
    try {
      const userRef = doc(db, 'users', uid);
      const existingUser = await getDoc(userRef);
      
      const updateData = {
        ...profileData,
        updatedAt: serverTimestamp(),
      };

      if (existingUser.exists()) {
        // Update existing user
        await updateDoc(userRef, updateData);
      } else {
        // Create new user document
        await setDoc(userRef, {
          uid,
          createdAt: serverTimestamp(),
          preferences: defaultUserPreferences,
          ...updateData,
        });
      }
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  }

  // Update user preferences
  async updateUserPreferences(uid: string, preferences: Partial<UserPreferences>): Promise<void> {
    try {
      const userRef = doc(db, 'users', uid);
      
      // Get current preferences
      const userDoc = await getDoc(userRef);
      const currentPreferences = userDoc.exists() 
        ? userDoc.data().preferences || defaultUserPreferences
        : defaultUserPreferences;

      // Merge preferences
      const updatedPreferences = {
        ...currentPreferences,
        ...preferences,
        // Deep merge nested objects
        notifications: {
          ...currentPreferences.notifications,
          ...preferences.notifications,
        },
        privacy: {
          ...currentPreferences.privacy,
          ...preferences.privacy,
        },
        display: {
          ...currentPreferences.display,
          ...preferences.display,
        },
      };

      await updateDoc(userRef, {
        preferences: updatedPreferences,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating user preferences:', error);
      throw error;
    }
  }

  // Update last login timestamp
  async updateLastLogin(uid: string): Promise<void> {
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        lastLoginAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating last login:', error);
      // Don't throw error for last login update
    }
  }

  // Update user's photo URL
  async updatePhotoURL(uid: string, photoURL: string): Promise<void> {
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        photoURL,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating photo URL:', error);
      throw error;
    }
  }

  // Delete user account data (GDPR compliance)
  async deleteUserData(uid: string): Promise<void> {
    try {
      const userRef = doc(db, 'users', uid);
      
      // Instead of deleting, mark as deleted and anonymize data
      await updateDoc(userRef, {
        deleted: true,
        deletedAt: serverTimestamp(),
        displayName: '[Deleted User]',
        email: '[deleted]',
        phoneNumber: '[deleted]',
        location: '[deleted]',
        bio: '[deleted]',
        firstName: '[deleted]',
        lastName: '[deleted]',
        photoURL: null,
      });
    } catch (error) {
      console.error('Error deleting user data:', error);
      throw error;
    }
  }

  // Search users (for admin purposes)
  async searchUsers(query: string, companyId?: string): Promise<UserProfile[]> {
    try {
      // This would typically use Algolia or similar for full-text search
      // For now, return empty array as placeholder
      console.log('Search users:', query, companyId);
      return [];
    } catch (error) {
      console.error('Error searching users:', error);
      throw error;
    }
  }

  // Get users by company
  async getUsersByCompany(companyId: string): Promise<UserProfile[]> {
    try {
      // This would query users by companyId
      // For now, return empty array as placeholder
      console.log('Get users by company:', companyId);
      return [];
    } catch (error) {
      console.error('Error getting users by company:', error);
      throw error;
    }
  }
}

export const userService = new UserService();