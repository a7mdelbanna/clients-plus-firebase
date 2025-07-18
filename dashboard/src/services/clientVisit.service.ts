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
  onSnapshot,
  serverTimestamp,
  Timestamp,
  type Unsubscribe,
  increment,
} from 'firebase/firestore';
import type { ClientVisit } from './client.service';
import { clientBalanceService } from './clientBalance.service';

// Visit statistics interface
export interface VisitStatistics {
  totalVisits: number;
  completedVisits: number;
  cancelledVisits: number;
  noShows: number;
  noShowRate: number;
  lastVisit?: Date;
  nextVisit?: Date;
  averageFrequency?: number; // Days between visits
  favoriteService?: {
    id: string;
    name: string;
    count: number;
  };
  favoriteStaff?: {
    id: string;
    name: string;
    count: number;
  };
  totalSpent: number;
  averageSpent: number;
}

// Visit preferences interface
export interface VisitPreferences {
  typicalServices: string[];
  typicalInterval: number; // Days
  preferredDayOfWeek: string[];
  preferredTimeOfDay: 'morning' | 'afternoon' | 'evening';
}

// Appointment request interface
export interface AppointmentRequest {
  clientId: string;
  requestedDate: Date;
  requestedTime: string;
  services: string[];
  preferredStaff?: string;
  notes?: string;
  isRecurring?: boolean;
  recurringPattern?: {
    frequency: 'weekly' | 'biweekly' | 'monthly';
    endDate?: Date;
  };
}

class ClientVisitService {
  private visitsCollection = 'clientVisits';

  // Create a new visit record
  async createVisit(visitData: Omit<ClientVisit, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const newVisit = {
        ...visitData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, this.visitsCollection), newVisit);

      // Update client statistics
      await this.updateClientVisitStats(visitData.clientId);

      // If visit is completed and paid, create a transaction
      if (visitData.status === 'completed' && visitData.paymentStatus === 'paid') {
        await clientBalanceService.applyCharge(
          visitData.clientId,
          visitData.totalAmount,
          `Visit services on ${visitData.date.toDate().toLocaleDateString()}`,
          docRef.id
        );
      }

      return docRef.id;
    } catch (error) {
      console.error('Error creating visit:', error);
      throw error;
    }
  }

  // Update visit status
  async updateVisitStatus(
    visitId: string,
    status: ClientVisit['status'],
    notes?: string
  ): Promise<void> {
    try {
      const visitRef = doc(db, this.visitsCollection, visitId);
      const visitDoc = await getDoc(visitRef);

      if (!visitDoc.exists()) {
        throw new Error('Visit not found');
      }

      const visitData = visitDoc.data() as ClientVisit;

      await updateDoc(visitRef, {
        status,
        notes: notes || visitData.notes,
        updatedAt: serverTimestamp(),
      });

      // Update client statistics
      await this.updateClientVisitStats(visitData.clientId);

      // Handle no-show penalty if configured
      if (status === 'no-show') {
        // TODO: Apply no-show penalty based on business rules
      }
    } catch (error) {
      console.error('Error updating visit status:', error);
      throw error;
    }
  }

  // Add feedback to visit
  async addVisitFeedback(
    visitId: string,
    rating: number,
    comment?: string
  ): Promise<void> {
    try {
      await updateDoc(doc(db, this.visitsCollection, visitId), {
        feedback: {
          rating,
          comment: comment || '',
          date: Timestamp.now(),
        },
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error adding visit feedback:', error);
      throw error;
    }
  }

  // Add photos to visit
  async addVisitPhotos(
    visitId: string,
    photos: { before?: string[]; after?: string[] }
  ): Promise<void> {
    try {
      const visitRef = doc(db, this.visitsCollection, visitId);
      const visitDoc = await getDoc(visitRef);

      if (!visitDoc.exists()) {
        throw new Error('Visit not found');
      }

      const currentPhotos = visitDoc.data().photos || { before: [], after: [] };

      await updateDoc(visitRef, {
        photos: {
          before: [...(currentPhotos.before || []), ...(photos.before || [])],
          after: [...(currentPhotos.after || []), ...(photos.after || [])],
        },
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error adding visit photos:', error);
      throw error;
    }
  }

  // Get visit history
  async getVisitHistory(
    clientId: string,
    options?: {
      limit?: number;
      startDate?: Date;
      endDate?: Date;
      status?: ClientVisit['status'];
    }
  ): Promise<ClientVisit[]> {
    try {
      let q = query(
        collection(db, this.visitsCollection),
        where('clientId', '==', clientId),
        orderBy('date', 'desc')
      );

      if (options?.limit) {
        q = query(q, limit(options.limit));
      }

      const snapshot = await getDocs(q);
      let visits: ClientVisit[] = [];

      snapshot.forEach((doc) => {
        visits.push({
          id: doc.id,
          ...doc.data(),
        } as ClientVisit);
      });

      // Apply additional filters
      if (options?.startDate) {
        const startTimestamp = Timestamp.fromDate(options.startDate);
        visits = visits.filter(v => v.date >= startTimestamp);
      }

      if (options?.endDate) {
        const endTimestamp = Timestamp.fromDate(options.endDate);
        visits = visits.filter(v => v.date <= endTimestamp);
      }

      if (options?.status) {
        visits = visits.filter(v => v.status === options.status);
      }

      return visits;
    } catch (error) {
      console.error('Error getting visit history:', error);
      throw error;
    }
  }

  // Subscribe to visit updates
  subscribeToVisits(
    clientId: string,
    callback: (visits: ClientVisit[]) => void
  ): Unsubscribe {
    const q = query(
      collection(db, this.visitsCollection),
      where('clientId', '==', clientId),
      orderBy('date', 'desc'),
      limit(20)
    );

    return onSnapshot(q, (snapshot) => {
      const visits: ClientVisit[] = [];
      snapshot.forEach((doc) => {
        visits.push({
          id: doc.id,
          ...doc.data(),
        } as ClientVisit);
      });
      callback(visits);
    });
  }

  // Get visit statistics
  async getVisitStatistics(clientId: string): Promise<VisitStatistics> {
    try {
      const visits = await this.getVisitHistory(clientId);

      const totalVisits = visits.length;
      const completedVisits = visits.filter(v => v.status === 'completed').length;
      const cancelledVisits = visits.filter(v => v.status === 'cancelled').length;
      const noShows = visits.filter(v => v.status === 'no-show').length;
      const noShowRate = totalVisits > 0 ? (noShows / totalVisits) * 100 : 0;

      // Get last and next visit
      const sortedVisits = [...visits].sort((a, b) => 
        b.date.seconds - a.date.seconds
      );
      const lastVisit = sortedVisits[0]?.date.toDate();

      const now = Timestamp.now();
      const futureVisits = visits.filter(v => v.date > now);
      const nextVisit = futureVisits.length > 0 ? 
        futureVisits.sort((a, b) => a.date.seconds - b.date.seconds)[0].date.toDate() : 
        undefined;

      // Calculate average frequency
      let averageFrequency: number | undefined;
      if (completedVisits > 1) {
        const completedVisitDates = visits
          .filter(v => v.status === 'completed')
          .map(v => v.date.seconds)
          .sort((a, b) => a - b);

        let totalDays = 0;
        for (let i = 1; i < completedVisitDates.length; i++) {
          totalDays += (completedVisitDates[i] - completedVisitDates[i - 1]) / 86400;
        }
        averageFrequency = totalDays / (completedVisitDates.length - 1);
      }

      // Calculate favorite service
      const serviceCount = new Map<string, { name: string; count: number }>();
      visits.forEach(visit => {
        visit.services.forEach(service => {
          const current = serviceCount.get(service.id) || { name: service.name, count: 0 };
          serviceCount.set(service.id, {
            name: service.name,
            count: current.count + 1,
          });
        });
      });

      let favoriteService: VisitStatistics['favoriteService'];
      if (serviceCount.size > 0) {
        const sorted = Array.from(serviceCount.entries())
          .sort((a, b) => b[1].count - a[1].count);
        favoriteService = {
          id: sorted[0][0],
          name: sorted[0][1].name,
          count: sorted[0][1].count,
        };
      }

      // Calculate favorite staff
      const staffCount = new Map<string, { name: string; count: number }>();
      visits.forEach(visit => {
        visit.services.forEach(service => {
          const current = staffCount.get(service.staffId) || { name: service.staffName, count: 0 };
          staffCount.set(service.staffId, {
            name: service.staffName,
            count: current.count + 1,
          });
        });
      });

      let favoriteStaff: VisitStatistics['favoriteStaff'];
      if (staffCount.size > 0) {
        const sorted = Array.from(staffCount.entries())
          .sort((a, b) => b[1].count - a[1].count);
        favoriteStaff = {
          id: sorted[0][0],
          name: sorted[0][1].name,
          count: sorted[0][1].count,
        };
      }

      // Calculate spending
      const completedPaidVisits = visits.filter(v => 
        v.status === 'completed' && v.paymentStatus === 'paid'
      );
      const totalSpent = completedPaidVisits.reduce((sum, v) => sum + v.totalAmount, 0);
      const averageSpent = completedPaidVisits.length > 0 ? 
        totalSpent / completedPaidVisits.length : 0;

      return {
        totalVisits,
        completedVisits,
        cancelledVisits,
        noShows,
        noShowRate,
        lastVisit,
        nextVisit,
        averageFrequency,
        favoriteService,
        favoriteStaff,
        totalSpent,
        averageSpent,
      };
    } catch (error) {
      console.error('Error getting visit statistics:', error);
      throw error;
    }
  }

  // Update client visit statistics
  private async updateClientVisitStats(clientId: string): Promise<void> {
    try {
      const stats = await this.getVisitStatistics(clientId);
      const clientRef = doc(db, 'clients', clientId);

      await updateDoc(clientRef, {
        totalVisits: stats.totalVisits,
        completedVisits: stats.completedVisits,
        cancelledVisits: stats.cancelledVisits,
        noShows: stats.noShows,
        noShowRate: stats.noShowRate,
        lastVisit: stats.lastVisit ? Timestamp.fromDate(stats.lastVisit) : null,
        nextVisit: stats.nextVisit ? Timestamp.fromDate(stats.nextVisit) : null,
        averageVisitFrequency: stats.averageFrequency,
        favoriteService: stats.favoriteService?.name,
        favoriteStaff: stats.favoriteStaff?.name,
        totalRevenue: stats.totalSpent,
        averageTicket: stats.averageSpent,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating client visit stats:', error);
      // Don't throw - this is a background operation
    }
  }

  // Get appointment preferences
  async getAppointmentPreferences(clientId: string): Promise<VisitPreferences> {
    try {
      const visits = await this.getVisitHistory(clientId, { 
        status: 'completed',
        limit: 20 
      });

      // Calculate typical services
      const serviceFrequency = new Map<string, number>();
      visits.forEach(visit => {
        visit.services.forEach(service => {
          serviceFrequency.set(service.id, (serviceFrequency.get(service.id) || 0) + 1);
        });
      });
      const typicalServices = Array.from(serviceFrequency.entries())
        .filter(([_, count]) => count >= 2)
        .map(([serviceId]) => serviceId);

      // Calculate typical interval
      let typicalInterval = 30; // Default to monthly
      if (visits.length >= 2) {
        const intervals: number[] = [];
        for (let i = 1; i < visits.length; i++) {
          const days = (visits[i - 1].date.seconds - visits[i].date.seconds) / 86400;
          intervals.push(days);
        }
        typicalInterval = Math.round(intervals.reduce((a, b) => a + b) / intervals.length);
      }

      // Calculate preferred day of week
      const dayFrequency = new Map<string, number>();
      visits.forEach(visit => {
        const day = new Date(visit.date.seconds * 1000).toLocaleDateString('en-US', { weekday: 'long' });
        dayFrequency.set(day, (dayFrequency.get(day) || 0) + 1);
      });
      const preferredDayOfWeek = Array.from(dayFrequency.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([day]) => day);

      // Calculate preferred time of day
      const hourCounts = { morning: 0, afternoon: 0, evening: 0 };
      visits.forEach(visit => {
        const hour = new Date(visit.date.seconds * 1000).getHours();
        if (hour < 12) hourCounts.morning++;
        else if (hour < 17) hourCounts.afternoon++;
        else hourCounts.evening++;
      });
      const preferredTimeOfDay = Object.entries(hourCounts)
        .sort((a, b) => b[1] - a[1])[0][0] as 'morning' | 'afternoon' | 'evening';

      return {
        typicalServices,
        typicalInterval,
        preferredDayOfWeek,
        preferredTimeOfDay,
      };
    } catch (error) {
      console.error('Error getting appointment preferences:', error);
      throw error;
    }
  }

  // Check for upcoming visits
  async getUpcomingVisits(
    clientId: string,
    days: number = 7
  ): Promise<ClientVisit[]> {
    try {
      const now = Timestamp.now();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);
      const futureDateTimestamp = Timestamp.fromDate(futureDate);

      const q = query(
        collection(db, this.visitsCollection),
        where('clientId', '==', clientId),
        where('date', '>=', now),
        where('date', '<=', futureDateTimestamp),
        where('status', '!=', 'cancelled'),
        orderBy('date', 'asc')
      );

      const snapshot = await getDocs(q);
      const visits: ClientVisit[] = [];

      snapshot.forEach((doc) => {
        visits.push({
          id: doc.id,
          ...doc.data(),
        } as ClientVisit);
      });

      return visits;
    } catch (error) {
      console.error('Error getting upcoming visits:', error);
      return [];
    }
  }

  // Create appointment request
  async createAppointmentRequest(request: AppointmentRequest): Promise<string> {
    try {
      // This would integrate with your appointment booking system
      // For now, we'll create a placeholder
      const appointmentData = {
        ...request,
        status: 'pending',
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(
        collection(db, 'appointmentRequests'),
        appointmentData
      );

      return docRef.id;
    } catch (error) {
      console.error('Error creating appointment request:', error);
      throw error;
    }
  }

  // Get visit recommendations
  async getVisitRecommendations(clientId: string): Promise<{
    nextRecommendedDate: Date;
    recommendedServices: string[];
    message: string;
  }> {
    try {
      const [stats, preferences] = await Promise.all([
        this.getVisitStatistics(clientId),
        this.getAppointmentPreferences(clientId),
      ]);

      // Calculate next recommended date
      let nextRecommendedDate = new Date();
      if (stats.lastVisit) {
        nextRecommendedDate = new Date(stats.lastVisit);
        nextRecommendedDate.setDate(
          nextRecommendedDate.getDate() + preferences.typicalInterval
        );
      }

      // Generate message
      let message = '';
      if (!stats.lastVisit) {
        message = 'Welcome! Book your first appointment today.';
      } else if (stats.nextVisit) {
        message = `Your next appointment is scheduled for ${stats.nextVisit.toLocaleDateString()}.`;
      } else {
        const daysSinceLastVisit = Math.floor(
          (Date.now() - stats.lastVisit.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        if (daysSinceLastVisit > preferences.typicalInterval * 1.5) {
          message = `It's been ${daysSinceLastVisit} days since your last visit. Time to book your next appointment!`;
        } else {
          message = `Based on your visit pattern, we recommend booking your next appointment around ${nextRecommendedDate.toLocaleDateString()}.`;
        }
      }

      return {
        nextRecommendedDate,
        recommendedServices: preferences.typicalServices,
        message,
      };
    } catch (error) {
      console.error('Error getting visit recommendations:', error);
      throw error;
    }
  }
}

export const clientVisitService = new ClientVisitService();