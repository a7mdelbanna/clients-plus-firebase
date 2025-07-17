import { db } from '../config/firebase';
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
  limit,
  startAfter,
  DocumentSnapshot,
  Timestamp,
  serverTimestamp,
  onSnapshot,
  QueryConstraint,
} from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';

export interface Client {
  id?: string;
  name: string;
  nameAr?: string;
  email: string;
  phone: string;
  mobile?: string;
  address: string;
  addressAr?: string;
  city?: string;
  country?: string;
  postalCode?: string;
  website?: string;
  industry?: string;
  taxNumber?: string;
  status: 'active' | 'inactive' | 'prospect';
  tags?: string[];
  notes?: string;
  companyId: string;
  branchId?: string; // Branch assignment for multi-branch support
  createdBy?: string;
  createdAt?: Timestamp | any;
  updatedAt?: Timestamp | any;
  // Calculated fields
  totalRevenue?: number;
  projectsCount?: number;
  lastContactDate?: Timestamp;
}

export interface ClientContact {
  id?: string;
  name: string;
  nameAr?: string;
  position?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  isPrimary?: boolean;
  createdAt?: Timestamp;
}

export interface ClientsFilter {
  status?: 'active' | 'inactive' | 'prospect' | 'all';
  searchTerm?: string;
  tags?: string[];
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'totalRevenue';
  sortDirection?: 'asc' | 'desc';
}

export interface PaginationOptions {
  pageSize: number;
  lastDoc?: DocumentSnapshot;
}

class ClientService {
  private clientsCollection = 'clients';

  // Create a new client
  async createClient(clientData: Omit<Client, 'id'>, userId: string, branchId?: string): Promise<string> {
    try {
      const newClient = {
        ...clientData,
        branchId: branchId || clientData.branchId, // Use provided branchId or fallback to clientData.branchId
        createdBy: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: clientData.status || 'active',
        totalRevenue: 0,
        projectsCount: 0,
      };

      const docRef = await addDoc(collection(db, this.clientsCollection), newClient);
      return docRef.id;
    } catch (error) {
      console.error('Error creating client:', error);
      throw error;
    }
  }

  // Get a single client by ID
  async getClient(clientId: string): Promise<Client | null> {
    try {
      const docRef = doc(db, this.clientsCollection, clientId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
        } as Client;
      }
      return null;
    } catch (error) {
      console.error('Error getting client:', error);
      throw error;
    }
  }

  // Update a client
  async updateClient(clientId: string, updates: Partial<Client>): Promise<void> {
    try {
      const docRef = doc(db, this.clientsCollection, clientId);
      
      // Remove id from updates if present
      const { id, ...updateData } = updates;
      
      await updateDoc(docRef, {
        ...updateData,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating client:', error);
      throw error;
    }
  }

  // Delete a client
  async deleteClient(clientId: string): Promise<void> {
    try {
      const docRef = doc(db, this.clientsCollection, clientId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting client:', error);
      throw error;
    }
  }

  // Get clients with filtering and pagination
  async getClients(
    companyId: string,
    filter?: ClientsFilter,
    pagination?: PaginationOptions,
    branchId?: string
  ): Promise<{ clients: Client[]; lastDoc: DocumentSnapshot | null }> {
    try {
      const constraints: QueryConstraint[] = [
        where('companyId', '==', companyId)
      ];

      // Add branch filtering if branchId is provided
      if (branchId) {
        constraints.push(where('branchId', '==', branchId));
      }

      // Apply status filter
      if (filter?.status && filter.status !== 'all') {
        constraints.push(where('status', '==', filter.status));
      }

      // Apply sorting
      const sortField = filter?.sortBy || 'createdAt';
      const sortDirection = filter?.sortDirection || 'desc';
      constraints.push(orderBy(sortField, sortDirection));

      // Apply pagination
      if (pagination?.pageSize) {
        constraints.push(limit(pagination.pageSize));
      }

      if (pagination?.lastDoc) {
        constraints.push(startAfter(pagination.lastDoc));
      }

      const q = query(collection(db, this.clientsCollection), ...constraints);
      const querySnapshot = await getDocs(q);

      const clients: Client[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        clients.push({
          id: doc.id,
          ...data,
        } as Client);
      });

      // Apply client-side search filter
      let filteredClients = clients;
      if (filter?.searchTerm) {
        const searchLower = filter.searchTerm.toLowerCase();
        filteredClients = clients.filter((client) =>
          client.name.toLowerCase().includes(searchLower) ||
          client.email.toLowerCase().includes(searchLower) ||
          (client.phone && client.phone.includes(filter.searchTerm!)) ||
          (client.nameAr && client.nameAr.includes(filter.searchTerm!))
        );
      }

      // Apply tags filter
      if (filter?.tags && filter.tags.length > 0) {
        filteredClients = filteredClients.filter((client) =>
          client.tags?.some((tag) => filter.tags?.includes(tag))
        );
      }

      const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1] || null;

      return {
        clients: filteredClients,
        lastDoc,
      };
    } catch (error) {
      console.error('Error getting clients:', error);
      throw error;
    }
  }

  // Get all clients for a company (no pagination)
  async getAllClients(companyId: string): Promise<Client[]> {
    try {
      const q = query(
        collection(db, this.clientsCollection),
        where('companyId', '==', companyId),
        orderBy('name', 'asc')
      );

      const querySnapshot = await getDocs(q);
      const clients: Client[] = [];

      querySnapshot.forEach((doc) => {
        clients.push({
          id: doc.id,
          ...doc.data(),
        } as Client);
      });

      return clients;
    } catch (error) {
      console.error('Error getting all clients:', error);
      throw error;
    }
  }

  // Subscribe to real-time client updates
  subscribeToClients(
    companyId: string,
    callback: (clients: Client[]) => void,
    filter?: ClientsFilter,
    branchId?: string
  ): Unsubscribe {
    const constraints: QueryConstraint[] = [
      where('companyId', '==', companyId)
    ];

    // Add branch filtering if branchId is provided
    if (branchId) {
      constraints.push(where('branchId', '==', branchId));
    }

    if (filter?.status && filter.status !== 'all') {
      constraints.push(where('status', '==', filter.status));
    }

    const sortField = filter?.sortBy || 'createdAt';
    const sortDirection = filter?.sortDirection || 'desc';
    constraints.push(orderBy(sortField, sortDirection));

    const q = query(collection(db, this.clientsCollection), ...constraints);

    return onSnapshot(q, (snapshot) => {
      const clients: Client[] = [];
      snapshot.forEach((doc) => {
        clients.push({
          id: doc.id,
          ...doc.data(),
        } as Client);
      });

      // Apply client-side filters
      let filteredClients = clients;
      if (filter?.searchTerm) {
        const searchLower = filter.searchTerm.toLowerCase();
        filteredClients = clients.filter((client) =>
          client.name.toLowerCase().includes(searchLower) ||
          client.email.toLowerCase().includes(searchLower) ||
          (client.phone && client.phone.includes(filter.searchTerm!))
        );
      }

      callback(filteredClients);
    });
  }

  // Get client contacts
  async getClientContacts(clientId: string): Promise<ClientContact[]> {
    try {
      const contactsRef = collection(db, this.clientsCollection, clientId, 'contacts');
      const q = query(contactsRef, orderBy('isPrimary', 'desc'), orderBy('name'));
      const querySnapshot = await getDocs(q);

      const contacts: ClientContact[] = [];
      querySnapshot.forEach((doc) => {
        contacts.push({
          id: doc.id,
          ...doc.data(),
        } as ClientContact);
      });

      return contacts;
    } catch (error) {
      console.error('Error getting client contacts:', error);
      throw error;
    }
  }

  // Add client contact
  async addClientContact(clientId: string, contact: Omit<ClientContact, 'id'>): Promise<string> {
    try {
      const contactsRef = collection(db, this.clientsCollection, clientId, 'contacts');
      const newContact = {
        ...contact,
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(contactsRef, newContact);
      return docRef.id;
    } catch (error) {
      console.error('Error adding client contact:', error);
      throw error;
    }
  }

  // Update client stats (called after project/invoice changes)
  async updateClientStats(clientId: string, companyId: string): Promise<void> {
    try {
      // Get projects count
      const projectsQuery = query(
        collection(db, 'projects'),
        where('clientId', '==', clientId),
        where('companyId', '==', companyId)
      );
      const projectsSnapshot = await getDocs(projectsQuery);
      const projectsCount = projectsSnapshot.size;

      // Get total revenue from paid invoices
      const invoicesQuery = query(
        collection(db, 'invoices'),
        where('clientId', '==', clientId),
        where('companyId', '==', companyId),
        where('status', '==', 'paid')
      );
      const invoicesSnapshot = await getDocs(invoicesQuery);
      
      let totalRevenue = 0;
      invoicesSnapshot.forEach((doc) => {
        const invoice = doc.data();
        totalRevenue += invoice.amount || 0;
      });

      // Update client document
      await this.updateClient(clientId, {
        projectsCount,
        totalRevenue,
      });
    } catch (error) {
      console.error('Error updating client stats:', error);
      // Don't throw - this is a background operation
    }
  }

  // Get client suggestions for autocomplete
  async getClientSuggestions(companyId: string, searchTerm: string): Promise<Client[]> {
    try {
      const clients = await this.getAllClients(companyId);
      
      if (!searchTerm) return clients.slice(0, 10);

      const searchLower = searchTerm.toLowerCase();
      return clients
        .filter((client) =>
          client.name.toLowerCase().includes(searchLower) ||
          client.email.toLowerCase().includes(searchLower)
        )
        .slice(0, 10);
    } catch (error) {
      console.error('Error getting client suggestions:', error);
      return [];
    }
  }
}

export const clientService = new ClientService();