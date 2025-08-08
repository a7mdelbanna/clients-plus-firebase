import { Timestamp } from 'firebase/firestore';
import type { DocumentSnapshot } from 'firebase/firestore';
import { clientApiService, ExpressClient, ExpressClientsFilter, ExpressPaginationOptions, ClientsResponse } from './client.api';
import type { 
  Client, 
  ClientsFilter, 
  PaginationOptions,
  DuplicateCheckResult,
  ClientContact,
  ClientBalanceSummary,
  BulkOperationResult
} from '../client.service';

/**
 * Client API Adapter
 * Provides backward compatibility between Firebase client service interface and Express API
 * This allows existing components to work without modification
 */
export class ClientApiAdapter {
  
  /**
   * Convert Firebase Client to Express Client format
   */
  private firebaseToExpressClient(firebaseClient: Omit<Client, 'id'>): Omit<ExpressClient, 'id' | 'createdAt' | 'updatedAt' | 'companyId'> {
    return {
      firstName: firebaseClient.firstName,
      lastName: firebaseClient.lastName,
      email: firebaseClient.email,
      phone: firebaseClient.phone,
      dateOfBirth: firebaseClient.dateOfBirth instanceof Timestamp 
        ? firebaseClient.dateOfBirth.toDate().toISOString().split('T')[0]
        : firebaseClient.dateOfBirth?.toString(),
      gender: this.mapGender(firebaseClient.gender),
      status: this.mapStatus(firebaseClient.status),
      phones: firebaseClient.phones,
      emails: firebaseClient.emails,
      address: firebaseClient.address,
      notes: firebaseClient.notes,
      tags: firebaseClient.tags,
      branchId: firebaseClient.branchId,
      totalRevenue: firebaseClient.totalRevenue,
      projectsCount: firebaseClient.projectsCount,
      totalVisits: firebaseClient.totalVisits,
      completedVisits: firebaseClient.completedVisits,
      cancelledVisits: firebaseClient.cancelledVisits,
      noShows: firebaseClient.noShows,
      noShowRate: firebaseClient.noShowRate,
      currentBalance: firebaseClient.currentBalance,
      loyaltyPoints: firebaseClient.loyaltyPoints,
      lastVisit: firebaseClient.lastVisit instanceof Timestamp 
        ? firebaseClient.lastVisit.toDate().toISOString()
        : firebaseClient.lastVisit?.toString(),
      nextVisit: firebaseClient.nextVisit instanceof Timestamp 
        ? firebaseClient.nextVisit.toDate().toISOString()
        : firebaseClient.nextVisit?.toString(),
      averageVisitFrequency: firebaseClient.averageVisitFrequency,
      favoriteService: firebaseClient.favoriteService,
      favoriteStaff: firebaseClient.favoriteStaff,
      averageTicket: firebaseClient.averageTicket,
      lifetimeValue: firebaseClient.lifetimeValue,
      lastContactDate: firebaseClient.lastContactDate instanceof Timestamp 
        ? firebaseClient.lastContactDate.toDate().toISOString()
        : firebaseClient.lastContactDate?.toString(),
    };
  }

  /**
   * Convert Express Client to Firebase Client format
   */
  private expressToFirebaseClient(expressClient: ExpressClient): Client {
    return {
      id: expressClient.id,
      firstName: expressClient.firstName,
      lastName: expressClient.lastName,
      middleName: undefined, // Not in Express model
      preferredName: undefined, // Not in Express model
      email: expressClient.email,
      phone: expressClient.phone,
      dateOfBirth: expressClient.dateOfBirth 
        ? Timestamp.fromDate(new Date(expressClient.dateOfBirth))
        : undefined,
      age: this.calculateAge(expressClient.dateOfBirth),
      gender: this.reverseMapGender(expressClient.gender),
      status: this.reverseMapStatus(expressClient.status),
      phones: expressClient.phones,
      emails: expressClient.emails,
      address: expressClient.address,
      notes: expressClient.notes,
      tags: expressClient.tags,
      companyId: expressClient.companyId,
      branchId: expressClient.branchId,
      createdAt: Timestamp.fromDate(new Date(expressClient.createdAt)),
      updatedAt: Timestamp.fromDate(new Date(expressClient.updatedAt)),
      createdBy: expressClient.createdById,
      totalRevenue: expressClient.totalRevenue,
      projectsCount: expressClient.projectsCount,
      totalVisits: expressClient.totalVisits,
      completedVisits: expressClient.completedVisits,
      cancelledVisits: expressClient.cancelledVisits,
      noShows: expressClient.noShows,
      noShowRate: expressClient.noShowRate,
      currentBalance: expressClient.currentBalance,
      loyaltyPoints: expressClient.loyaltyPoints,
      lastVisit: expressClient.lastVisit 
        ? Timestamp.fromDate(new Date(expressClient.lastVisit))
        : undefined,
      nextVisit: expressClient.nextVisit 
        ? Timestamp.fromDate(new Date(expressClient.nextVisit))
        : undefined,
      averageVisitFrequency: expressClient.averageVisitFrequency,
      favoriteService: expressClient.favoriteService,
      favoriteStaff: expressClient.favoriteStaff,
      averageTicket: expressClient.averageTicket,
      lifetimeValue: expressClient.lifetimeValue,
      lastContactDate: expressClient.lastContactDate 
        ? Timestamp.fromDate(new Date(expressClient.lastContactDate))
        : undefined,
      
      // Legacy fields for backward compatibility
      name: `${expressClient.firstName} ${expressClient.lastName || ''}`.trim(),
      
      // Default values for Firebase-specific fields
      categoryId: undefined,
      portalEnabled: false,
      customFields: {},
      marketing: {
        acceptsSMS: true,
        acceptsEmail: true,
        acceptsPromotions: true,
      },
      memberSince: Timestamp.fromDate(new Date(expressClient.createdAt)),
    };
  }

  /**
   * Convert Firebase filter to Express filter format
   */
  private firebaseToExpressFilter(filter?: ClientsFilter): ExpressClientsFilter | undefined {
    if (!filter) return undefined;

    return {
      status: this.mapStatus(filter.status),
      search: filter.searchTerm,
      tags: filter.tags,
      gender: filter.gender?.map(g => this.mapGender(g)),
      quickFilter: filter.quickFilter,
      minAge: filter.ageRange?.min,
      maxAge: filter.ageRange?.max,
      birthdayMonth: filter.birthday?.month,
      upcomingBirthdays: filter.birthday?.upcomingDays,
      acceptsSMS: filter.acceptsSMS,
      acceptsEmail: filter.acceptsEmail,
      hasValidEmail: filter.hasValidEmail,
      hasValidPhone: filter.hasValidPhone,
      branchId: filter.branchId,
      sortBy: filter.sortBy,
      sortDirection: filter.sortDirection,
      registrationFrom: filter.registrationDate?.from 
        ? (filter.registrationDate.from instanceof Timestamp 
          ? filter.registrationDate.from.toDate().toISOString()
          : filter.registrationDate.from.toISOString())
        : undefined,
      registrationTo: filter.registrationDate?.to 
        ? (filter.registrationDate.to instanceof Timestamp 
          ? filter.registrationDate.to.toDate().toISOString()
          : filter.registrationDate.to.toISOString())
        : undefined,
      minBalance: filter.currentBalance?.min,
      maxBalance: filter.currentBalance?.max,
      minLifetimeSpend: filter.lifetimeSpend?.min,
      maxLifetimeSpend: filter.lifetimeSpend?.max,
    };
  }

  /**
   * Convert Firebase pagination to Express pagination
   */
  private firebasePaginationToExpress(pagination?: PaginationOptions): ExpressPaginationOptions | undefined {
    if (!pagination) return undefined;

    return {
      page: 1, // Firebase uses cursor-based, Express uses page-based
      limit: pagination.pageSize,
    };
  }

  /**
   * Map Firebase gender to Express gender
   */
  private mapGender(gender?: Client['gender']): ExpressClient['gender'] {
    switch (gender) {
      case 'male': return 'MALE';
      case 'female': return 'FEMALE';
      case 'other': return 'OTHER';
      case 'not_specified':
      default: return 'PREFER_NOT_TO_SAY';
    }
  }

  /**
   * Map Express gender to Firebase gender
   */
  private reverseMapGender(gender?: ExpressClient['gender']): Client['gender'] {
    switch (gender) {
      case 'MALE': return 'male';
      case 'FEMALE': return 'female';
      case 'OTHER': return 'other';
      case 'PREFER_NOT_TO_SAY':
      default: return 'not_specified';
    }
  }

  /**
   * Map Firebase status to Express status
   */
  private mapStatus(status?: Client['status']): ExpressClient['status'] {
    switch (status) {
      case 'active': return 'ACTIVE';
      case 'inactive': return 'INACTIVE';
      case 'prospect': return 'SUSPENDED'; // Map prospect to suspended as closest equivalent
      default: return 'ACTIVE';
    }
  }

  /**
   * Map Express status to Firebase status
   */
  private reverseMapStatus(status?: ExpressClient['status']): Client['status'] {
    switch (status) {
      case 'ACTIVE': return 'active';
      case 'INACTIVE': return 'inactive';
      case 'SUSPENDED': return 'inactive'; // Map suspended to inactive
      case 'ARCHIVED': return 'inactive'; // Map archived to inactive
      default: return 'active';
    }
  }

  /**
   * Calculate age from date of birth string
   */
  private calculateAge(dateOfBirth?: string): number | undefined {
    if (!dateOfBirth) return undefined;
    
    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    
    return age;
  }

  /**
   * Create a new client
   */
  async createClient(clientData: Omit<Client, 'id'>, userId: string, branchId?: string): Promise<string> {
    const expressClientData = this.firebaseToExpressClient(clientData);
    if (branchId) {
      expressClientData.branchId = branchId;
    }
    
    const createdClient = await clientApiService.createClient(expressClientData);
    return createdClient.id;
  }

  /**
   * Get a single client by ID
   */
  async getClient(clientId: string): Promise<Client | null> {
    try {
      const expressClient = await clientApiService.getClientById(clientId);
      return this.expressToFirebaseClient(expressClient);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Update a client
   */
  async updateClient(clientId: string, updates: Partial<Client>): Promise<void> {
    const expressUpdates = this.firebaseToExpressClient(updates as Omit<Client, 'id'>);
    await clientApiService.updateClient(clientId, expressUpdates);
  }

  /**
   * Delete a client
   */
  async deleteClient(clientId: string): Promise<void> {
    await clientApiService.deleteClient(clientId);
  }

  /**
   * Get clients with filtering and pagination
   */
  async getClients(
    companyId: string,
    filter?: ClientsFilter,
    pagination?: PaginationOptions,
    branchId?: string
  ): Promise<{ clients: Client[]; lastDoc: DocumentSnapshot | null }> {
    const expressFilter = this.firebaseToExpressFilter(filter);
    if (branchId) {
      expressFilter!.branchId = branchId;
    }
    
    const expressPagination = this.firebasePaginationToExpress(pagination);
    
    const result = await clientApiService.getClients(expressFilter, expressPagination);
    
    const clients = result.data.map(client => this.expressToFirebaseClient(client));
    
    // Firebase uses DocumentSnapshot for pagination, but Express uses page numbers
    // We'll create a mock DocumentSnapshot for compatibility
    const lastDoc = result.data.length > 0 ? {
      id: result.data[result.data.length - 1].id,
      exists: () => true,
      data: () => result.data[result.data.length - 1],
    } as DocumentSnapshot : null;

    return {
      clients,
      lastDoc,
    };
  }

  /**
   * Get all clients for a company (no pagination)
   */
  async getAllClients(companyId: string): Promise<Client[]> {
    const expressClients = await clientApiService.getAllClients();
    return expressClients.map(client => this.expressToFirebaseClient(client));
  }

  /**
   * Get client suggestions for autocomplete
   */
  async getClientSuggestions(companyId: string, searchTerm: string): Promise<Client[]> {
    const suggestions = await clientApiService.getClientSuggestions(searchTerm);
    return suggestions.map(client => this.expressToFirebaseClient(client));
  }

  /**
   * Check for duplicate clients
   */
  async checkForDuplicates(clientData: Partial<Client>): Promise<DuplicateCheckResult> {
    const expressClientData = this.firebaseToExpressClient(clientData as Omit<Client, 'id'>);
    const result = await clientApiService.checkDuplicates(expressClientData);
    
    // Convert Express clients back to Firebase format in the matches
    return {
      ...result,
      matches: result.matches.map(match => ({
        ...match,
        client: this.expressToFirebaseClient(match.client as ExpressClient),
      })),
    };
  }

  /**
   * Update client stats
   */
  async updateClientStats(clientId: string, companyId: string): Promise<void> {
    await clientApiService.updateClientStats(clientId);
  }

  /**
   * Get client contacts
   */
  async getClientContacts(clientId: string): Promise<ClientContact[]> {
    return await clientApiService.getClientContacts(clientId);
  }

  /**
   * Add client contact
   */
  async addClientContact(clientId: string, contact: Omit<ClientContact, 'id'>): Promise<string> {
    return await clientApiService.addClientContact(clientId, contact);
  }

  /**
   * Get client balance summary
   */
  async getClientBalanceSummary(clientId: string): Promise<ClientBalanceSummary> {
    return await clientApiService.getClientBalanceSummary(clientId);
  }

  /**
   * Search clients (using the search endpoint)
   */
  async searchClients(
    companyId: string,
    searchTerm: string,
    filter?: Omit<ClientsFilter, 'searchTerm'>,
    pagination?: PaginationOptions
  ): Promise<{ clients: Client[]; lastDoc: DocumentSnapshot | null }> {
    const expressFilter = this.firebaseToExpressFilter(filter);
    const expressPagination = this.firebasePaginationToExpress(pagination);
    
    const result = await clientApiService.searchClients(searchTerm, expressFilter, expressPagination);
    
    const clients = result.data.map(client => this.expressToFirebaseClient(client));
    
    const lastDoc = result.data.length > 0 ? {
      id: result.data[result.data.length - 1].id,
      exists: () => true,
      data: () => result.data[result.data.length - 1],
    } as DocumentSnapshot : null;

    return {
      clients,
      lastDoc,
    };
  }

  /**
   * Get clients with advanced filters (maps to regular getClients)
   */
  async getClientsWithAdvancedFilters(
    companyId: string,
    filter: ClientsFilter,
    pagination?: PaginationOptions,
    branchId?: string
  ): Promise<{ clients: Client[]; lastDoc: DocumentSnapshot | null; totalCount: number }> {
    const result = await this.getClients(companyId, filter, pagination, branchId);
    
    // Express API provides pagination info, but we need to mock totalCount for compatibility
    // In a real implementation, we'd get this from the API response
    return {
      ...result,
      totalCount: result.clients.length,
    };
  }

  /**
   * Bulk update clients
   */
  async bulkUpdateClients(
    clientIds: string[],
    updates: Partial<Client>,
    companyId: string
  ): Promise<BulkOperationResult> {
    const expressUpdates = this.firebaseToExpressClient(updates as Omit<Client, 'id'>);
    return await clientApiService.bulkUpdateClients({
      clientIds,
      updates: expressUpdates,
    });
  }

  /**
   * Subscribe to real-time client updates
   * NOTE: Express API doesn't support real-time updates, so this will use polling
   */
  subscribeToClients(
    companyId: string,
    callback: (clients: Client[]) => void,
    filter?: ClientsFilter,
    branchId?: string
  ): (() => void) {
    let intervalId: NodeJS.Timeout;
    
    const fetchClients = async () => {
      try {
        const result = await this.getClients(companyId, filter, undefined, branchId);
        callback(result.clients);
      } catch (error) {
        console.error('Error fetching clients for subscription:', error);
      }
    };

    // Initial fetch
    fetchClients();

    // Poll every 30 seconds (configurable)
    intervalId = setInterval(fetchClients, 30000);

    // Return unsubscribe function
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }
}

// Create and export singleton instance
export const clientApiAdapter = new ClientApiAdapter();

export default clientApiAdapter;