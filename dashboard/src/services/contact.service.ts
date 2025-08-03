import { db } from '../config/firebase';
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
  limit,
  startAfter,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  QueryConstraint,
  writeBatch,
  deleteDoc,
  setDoc,
  type Unsubscribe,
  type DocumentSnapshot,
} from 'firebase/firestore';
import type {
  Contact,
  ContactStatus,
  ContactFilters,
  ContactActivity,
  QuickCreateContact,
  ContactCategory,
  ContactMergeRequest,
} from '../types/contact.types';
import { ContactType } from '../types/contact.types';

class ContactService {
  private contactsCollection = 'contacts';
  private categoriesCollection = 'contactCategories';
  private activitiesCollection = 'contactActivities';

  // ==================== CONTACT CRUD ====================

  // Generate unique contact code
  private async generateContactCode(companyId: string, type: ContactType): Promise<string> {
    const prefix = type.substring(0, 3).toUpperCase(); // CLI, VEN, EMP, etc.
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  // Create contact
  async createContact(contact: Omit<Contact, 'id' | 'createdAt' | 'updatedAt' | 'code'>): Promise<string> {
    try {
      const code = await this.generateContactCode(contact.companyId, contact.type);
      
      const contactData = {
        ...contact,
        code,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(
        collection(db, 'companies', contact.companyId, this.contactsCollection),
        contactData
      );

      // Update category count if applicable
      if (contact.categoryId) {
        await this.updateCategoryCount(contact.companyId, contact.categoryId, 1);
      }

      return docRef.id;
    } catch (error) {
      console.error('Error creating contact:', error);
      throw error;
    }
  }

  // Quick create contact (minimal fields)
  async quickCreateContact(data: QuickCreateContact): Promise<string> {
    try {
      const contact: Omit<Contact, 'id' | 'createdAt' | 'updatedAt' | 'code'> = {
        companyId: data.companyId,
        type: data.type,
        displayName: data.displayName,
        status: 'active',
        phones: data.phone ? [{
          number: data.phone,
          type: 'mobile',
          isPrimary: true
        }] : [],
        emails: data.email ? [{
          email: data.email,
          type: 'personal',
          isPrimary: true
        }] : [],
        addresses: [],
        tags: [],
        createdBy: 'system', // Should be replaced with actual user ID
      };

      return await this.createContact(contact);
    } catch (error) {
      console.error('Error quick creating contact:', error);
      throw error;
    }
  }

  // Update contact
  async updateContact(companyId: string, contactId: string, updates: Partial<Contact>): Promise<void> {
    try {
      const contactRef = doc(db, 'companies', companyId, this.contactsCollection, contactId);
      
      // Handle category change
      const oldDoc = await getDoc(contactRef);
      const oldData = oldDoc.data() as Contact;
      
      if (oldData?.categoryId !== updates.categoryId) {
        if (oldData?.categoryId) {
          await this.updateCategoryCount(companyId, oldData.categoryId, -1);
        }
        if (updates.categoryId) {
          await this.updateCategoryCount(companyId, updates.categoryId, 1);
        }
      }

      await updateDoc(contactRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating contact:', error);
      throw error;
    }
  }

  // Get single contact
  async getContact(companyId: string, contactId: string): Promise<Contact | null> {
    try {
      const contactDoc = await getDoc(
        doc(db, 'companies', companyId, this.contactsCollection, contactId)
      );

      if (!contactDoc.exists()) {
        return null;
      }

      return { id: contactDoc.id, ...contactDoc.data() } as Contact;
    } catch (error) {
      console.error('Error getting contact:', error);
      throw error;
    }
  }

  // Get contacts with filters
  async getContacts(
    companyId: string,
    filters: ContactFilters = {},
    pageSize: number = 20,
    lastDoc?: DocumentSnapshot
  ): Promise<{ contacts: Contact[]; lastDoc: DocumentSnapshot | null }> {
    try {
      const constraints: QueryConstraint[] = [];

      // Type filter
      if (filters.types && filters.types.length > 0) {
        constraints.push(where('type', 'in', filters.types));
      }

      // Status filter
      if (filters.status && filters.status.length > 0) {
        constraints.push(where('status', 'in', filters.status));
      }

      // Category filter
      if (filters.categoryIds && filters.categoryIds.length > 0) {
        constraints.push(where('categoryId', 'in', filters.categoryIds));
      }

      // Branch filter
      if (filters.branchIds && filters.branchIds.length > 0) {
        constraints.push(where('branchIds', 'array-contains-any', filters.branchIds));
      }

      // Date range filter
      if (filters.dateRange) {
        constraints.push(where('createdAt', '>=', Timestamp.fromDate(filters.dateRange.start)));
        constraints.push(where('createdAt', '<=', Timestamp.fromDate(filters.dateRange.end)));
      }

      // Ordering
      constraints.push(orderBy('createdAt', 'desc'));

      // Pagination
      constraints.push(limit(pageSize));
      if (lastDoc) {
        constraints.push(startAfter(lastDoc));
      }

      const q = query(
        collection(db, 'companies', companyId, this.contactsCollection),
        ...constraints
      );

      const snapshot = await getDocs(q);
      let contacts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Contact));

      // Client-side search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        contacts = contacts.filter(contact =>
          contact.displayName.toLowerCase().includes(searchLower) ||
          contact.nameAr?.toLowerCase().includes(searchLower) ||
          contact.companyName?.toLowerCase().includes(searchLower) ||
          contact.code?.toLowerCase().includes(searchLower) ||
          contact.phones.some(p => p.number.includes(filters.search!)) ||
          contact.emails.some(e => e.email.toLowerCase().includes(searchLower)) ||
          contact.taxNumber?.includes(filters.search!)
        );
      }

      // Tag filter (client-side)
      if (filters.tags && filters.tags.length > 0) {
        contacts = contacts.filter(contact =>
          filters.tags!.some(tag => contact.tags.includes(tag))
        );
      }

      return {
        contacts,
        lastDoc: snapshot.docs[snapshot.docs.length - 1] || null
      };
    } catch (error) {
      console.error('Error getting contacts:', error);
      throw error;
    }
  }

  // Subscribe to contacts
  subscribeToContacts(
    companyId: string,
    filters: ContactFilters = {},
    callback: (contacts: Contact[]) => void
  ): Unsubscribe {
    const constraints: QueryConstraint[] = [];

    // Apply same filters as getContacts
    if (filters.types && filters.types.length > 0) {
      constraints.push(where('type', 'in', filters.types));
    }

    if (filters.status && filters.status.length > 0) {
      constraints.push(where('status', 'in', filters.status));
    }

    constraints.push(orderBy('createdAt', 'desc'));

    const q = query(
      collection(db, 'companies', companyId, this.contactsCollection),
      ...constraints
    );

    return onSnapshot(q, (snapshot) => {
      let contacts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Contact));
      
      // Apply client-side filters
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        contacts = contacts.filter(contact =>
          contact.displayName.toLowerCase().includes(searchLower) ||
          contact.nameAr?.toLowerCase().includes(searchLower) ||
          contact.companyName?.toLowerCase().includes(searchLower)
        );
      }

      callback(contacts);
    });
  }

  // Delete contact
  async deleteContact(companyId: string, contactId: string): Promise<void> {
    try {
      const contactRef = doc(db, 'companies', companyId, this.contactsCollection, contactId);
      
      // Get contact to update category count
      const contactDoc = await getDoc(contactRef);
      const contact = contactDoc.data() as Contact;
      
      if (contact?.categoryId) {
        await this.updateCategoryCount(companyId, contact.categoryId, -1);
      }

      await deleteDoc(contactRef);
    } catch (error) {
      console.error('Error deleting contact:', error);
      throw error;
    }
  }

  // Archive contact (soft delete)
  async archiveContact(companyId: string, contactId: string): Promise<void> {
    try {
      await this.updateContact(companyId, contactId, { status: 'archived' });
    } catch (error) {
      console.error('Error archiving contact:', error);
      throw error;
    }
  }

  // ==================== CONTACT MERGING ====================

  // Merge contacts
  async mergeContacts(companyId: string, mergeRequest: ContactMergeRequest): Promise<void> {
    try {
      const batch = writeBatch(db);

      // Get primary contact
      const primaryRef = doc(db, 'companies', companyId, this.contactsCollection, mergeRequest.primaryContactId);
      const primaryDoc = await getDoc(primaryRef);
      const primaryContact = { id: primaryDoc.id, ...primaryDoc.data() } as Contact;

      // Get secondary contacts
      const secondaryContacts: Contact[] = [];
      for (const secondaryId of mergeRequest.secondaryContactIds) {
        const secondaryDoc = await getDoc(
          doc(db, 'companies', companyId, this.contactsCollection, secondaryId)
        );
        if (secondaryDoc.exists()) {
          secondaryContacts.push({ id: secondaryDoc.id, ...secondaryDoc.data() } as Contact);
        }
      }

      // Merge data based on fieldsToKeep preferences
      const mergedData: Partial<Contact> = { ...primaryContact };

      // Merge arrays (phones, emails, addresses, etc.)
      for (const secondary of secondaryContacts) {
        // Merge phones
        secondary.phones.forEach(phone => {
          if (!mergedData.phones!.some(p => p.number === phone.number)) {
            mergedData.phones!.push({ ...phone, isPrimary: false });
          }
        });

        // Merge emails
        secondary.emails.forEach(email => {
          if (!mergedData.emails!.some(e => e.email === email.email)) {
            mergedData.emails!.push({ ...email, isPrimary: false });
          }
        });

        // Merge addresses
        secondary.addresses.forEach(address => {
          if (!mergedData.addresses!.some(a => 
            a.street === address.street && a.city === address.city
          )) {
            mergedData.addresses!.push({ ...address, isPrimary: false });
          }
        });

        // Merge tags
        secondary.tags.forEach(tag => {
          if (!mergedData.tags!.includes(tag)) {
            mergedData.tags!.push(tag);
          }
        });

        // Merge notes
        if (secondary.notes) {
          mergedData.notes = `${mergedData.notes || ''}\n\n--- Merged from ${secondary.displayName} ---\n${secondary.notes}`.trim();
        }
      }

      // Update primary contact
      batch.update(primaryRef, {
        ...mergedData,
        updatedAt: serverTimestamp(),
      });

      // Archive secondary contacts
      for (const secondaryId of mergeRequest.secondaryContactIds) {
        const secondaryRef = doc(db, 'companies', companyId, this.contactsCollection, secondaryId);
        batch.update(secondaryRef, {
          status: 'archived',
          internalNotes: `Merged into ${primaryContact.displayName} (${primaryContact.code}) on ${new Date().toISOString()}`,
          updatedAt: serverTimestamp(),
        });
      }

      await batch.commit();
    } catch (error) {
      console.error('Error merging contacts:', error);
      throw error;
    }
  }

  // ==================== CONTACT CATEGORIES ====================

  // Create category
  async createCategory(companyId: string, category: Omit<ContactCategory, 'id' | 'createdAt' | 'updatedAt' | 'contactCount'>): Promise<string> {
    try {
      const categoryData = {
        ...category,
        contactCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(
        collection(db, 'companies', companyId, this.categoriesCollection),
        categoryData
      );

      return docRef.id;
    } catch (error) {
      console.error('Error creating contact category:', error);
      throw error;
    }
  }

  // Get categories
  async getCategories(companyId: string, type?: ContactType): Promise<ContactCategory[]> {
    try {
      const constraints: QueryConstraint[] = [];
      
      if (type) {
        constraints.push(where('type', '==', type));
      }
      
      constraints.push(where('isActive', '==', true));
      constraints.push(orderBy('name', 'asc'));

      const q = query(
        collection(db, 'companies', companyId, this.categoriesCollection),
        ...constraints
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContactCategory));
    } catch (error) {
      console.error('Error getting contact categories:', error);
      throw error;
    }
  }

  // Update category count
  private async updateCategoryCount(companyId: string, categoryId: string, increment: number): Promise<void> {
    try {
      const categoryRef = doc(db, 'companies', companyId, this.categoriesCollection, categoryId);
      const categoryDoc = await getDoc(categoryRef);
      
      if (categoryDoc.exists()) {
        const currentCount = categoryDoc.data().contactCount || 0;
        await updateDoc(categoryRef, {
          contactCount: Math.max(0, currentCount + increment),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error('Error updating category count:', error);
      // Don't throw, this is not critical
    }
  }

  // ==================== CONTACT ACTIVITIES ====================

  // Log activity
  async logActivity(companyId: string, activity: Omit<ContactActivity, 'id'>): Promise<string> {
    try {
      const activityData = {
        ...activity,
        date: serverTimestamp(),
      };

      const docRef = await addDoc(
        collection(db, 'companies', companyId, this.contactsCollection, activity.contactId, this.activitiesCollection),
        activityData
      );

      // Update last interaction date
      await this.updateContact(companyId, activity.contactId, {
        lastInteractionDate: Timestamp.now(),
      });

      return docRef.id;
    } catch (error) {
      console.error('Error logging contact activity:', error);
      throw error;
    }
  }

  // Get activities for a contact
  async getActivities(companyId: string, contactId: string, pageSize: number = 50): Promise<ContactActivity[]> {
    try {
      const q = query(
        collection(db, 'companies', companyId, this.contactsCollection, contactId, this.activitiesCollection),
        orderBy('date', 'desc'),
        limit(pageSize)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContactActivity));
    } catch (error) {
      console.error('Error getting contact activities:', error);
      throw error;
    }
  }

  // ==================== MIGRATION HELPERS ====================

  // Find contact by related entity
  async findContactByRelatedEntity(
    companyId: string,
    entityType: 'clientId' | 'staffId' | 'vendorId' | 'userId',
    entityId: string
  ): Promise<Contact | null> {
    try {
      const q = query(
        collection(db, 'companies', companyId, this.contactsCollection),
        where(`relatedEntities.${entityType}`, '==', entityId),
        limit(1)
      );

      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        return null;
      }

      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Contact;
    } catch (error) {
      console.error('Error finding contact by related entity:', error);
      throw error;
    }
  }

  // Create contact from existing entity
  async createContactFromClient(companyId: string, client: any, createdBy: string): Promise<string> {
    try {
      const contact: Omit<Contact, 'id' | 'createdAt' | 'updatedAt' | 'code'> = {
        companyId,
        type: ContactType.CLIENT,
        status: client.status === 'active' ? 'active' : 'inactive',
        firstName: client.firstName,
        lastName: client.lastName,
        displayName: `${client.firstName || ''} ${client.lastName || ''}`.trim() || client.preferredName || 'Unknown',
        nameAr: client.nameAr,
        phones: client.phones || [],
        emails: client.emails || [],
        addresses: client.address ? [{
          ...client.address,
          type: 'home',
          isPrimary: true
        }] : [],
        socialMedia: client.socialMedia ? Object.entries(client.socialMedia).map(([platform, handle]) => ({
          platform: platform as any,
          handle: handle as string
        })) : [],
        website: client.website,
        taxNumber: client.taxNumber,
        industry: client.industry,
        gender: client.gender,
        dateOfBirth: client.dateOfBirth,
        nationality: client.nationality,
        language: client.preferredLanguage,
        financial: {
          creditLimit: client.creditLimit,
          currentBalance: client.currentBalance,
          totalTransactions: client.totalRevenue,
          paymentTerms: client.paymentTerms,
        },
        categoryId: client.categoryId,
        tags: client.tags || [],
        notes: client.notes,
        internalNotes: client.internalNotes,
        relatedEntities: {
          clientId: client.id,
        },
        customFields: client.customFields,
        branchIds: client.branchId ? [client.branchId] : [],
        createdBy,
      };

      return await this.createContact(contact);
    } catch (error) {
      console.error('Error creating contact from client:', error);
      throw error;
    }
  }

  async createContactFromStaff(companyId: string, staff: any, createdBy: string): Promise<string> {
    try {
      const displayName = `${staff.name || ''} ${staff.lastName || ''}`.trim() || 'Unknown';
      
      const contact: Omit<Contact, 'id' | 'createdAt' | 'updatedAt' | 'code'> = {
        companyId,
        type: ContactType.EMPLOYEE,
        status: staff.status === 'active' ? 'active' : 'inactive',
        firstName: staff.name,
        lastName: staff.lastName,
        displayName,
        nameAr: staff.nameAr,
        phones: staff.phone ? [{
          number: staff.phone,
          type: 'mobile',
          isPrimary: true
        }] : [],
        emails: staff.email ? [{
          email: staff.email,
          type: 'work',
          isPrimary: true
        }] : [],
        addresses: [],
        gender: staff.personalInfo?.gender,
        nationality: staff.personalInfo?.citizenship,
        positionId: staff.positionId,
        employmentDate: staff.employmentDate,
        tags: [],
        notes: staff.notes,
        relatedEntities: {
          staffId: staff.id,
          userId: staff.userId,
        },
        branchIds: staff.branchIds || (staff.branchId ? [staff.branchId] : []),
        createdBy,
      };

      return await this.createContact(contact);
    } catch (error) {
      console.error('Error creating contact from staff:', error);
      throw error;
    }
  }

  async createContactFromVendor(companyId: string, vendor: any, createdBy: string): Promise<string> {
    try {
      const contact: Omit<Contact, 'id' | 'createdAt' | 'updatedAt' | 'code'> = {
        companyId,
        type: vendor.type === 'supplier' ? ContactType.SUPPLIER : ContactType.VENDOR,
        status: vendor.status,
        displayName: vendor.name,
        nameAr: vendor.nameAr,
        companyName: vendor.name,
        companyNameAr: vendor.nameAr,
        phones: vendor.phone ? [{
          number: vendor.phone,
          type: 'work',
          isPrimary: true
        }] : [],
        emails: vendor.email ? [{
          email: vendor.email,
          type: 'work',
          isPrimary: true
        }] : [],
        addresses: vendor.address ? [{
          ...vendor.address,
          type: 'work',
          isPrimary: true
        }] : [],
        website: vendor.website,
        taxNumber: vendor.taxNumber,
        commercialRegister: vendor.commercialRegister,
        contactPersons: vendor.contactPerson ? [{
          name: vendor.contactPerson,
          isPrimary: true
        }] : [],
        financial: {
          creditDays: vendor.paymentTerms?.creditDays,
          creditLimit: vendor.paymentTerms?.creditLimit,
          defaultPaymentMethod: vendor.paymentTerms?.defaultMethod,
          totalTransactions: vendor.totalTransactions,
          totalAmount: vendor.totalAmount,
          bankAccounts: vendor.paymentTerms?.bankAccount ? [{
            ...vendor.paymentTerms.bankAccount,
            currency: 'EGP'
          }] : [],
        },
        tags: vendor.tags || [],
        notes: vendor.notes,
        relatedEntities: {
          vendorId: vendor.id,
        },
        createdBy,
      };

      return await this.createContact(contact);
    } catch (error) {
      console.error('Error creating contact from vendor:', error);
      throw error;
    }
  }
}

export const contactService = new ContactService();