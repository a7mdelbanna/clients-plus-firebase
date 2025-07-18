import { db } from '../config/firebase';
import {
  collection,
  doc,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import type { ClientActivity } from './client.service';

// Activity event types
export const ACTIVITY_EVENTS = {
  // Profile events
  PROFILE_CREATED: 'profile_created',
  PROFILE_UPDATED: 'profile_updated',
  PROFILE_VIEWED: 'profile_viewed',
  PROFILE_DELETED: 'profile_deleted',
  
  // Contact events
  CONTACT_ADDED: 'contact_added',
  CONTACT_UPDATED: 'contact_updated',
  CONTACT_VERIFIED: 'contact_verified',
  
  // Appointment events
  APPOINTMENT_BOOKED: 'appointment_booked',
  APPOINTMENT_CONFIRMED: 'appointment_confirmed',
  APPOINTMENT_CANCELLED: 'appointment_cancelled',
  APPOINTMENT_COMPLETED: 'appointment_completed',
  APPOINTMENT_NO_SHOW: 'appointment_no_show',
  
  // Financial events
  PAYMENT_MADE: 'payment_made',
  PAYMENT_FAILED: 'payment_failed',
  REFUND_ISSUED: 'refund_issued',
  BALANCE_ADJUSTED: 'balance_adjusted',
  PACKAGE_PURCHASED: 'package_purchased',
  MEMBERSHIP_STARTED: 'membership_started',
  MEMBERSHIP_RENEWED: 'membership_renewed',
  MEMBERSHIP_CANCELLED: 'membership_cancelled',
  
  // Communication events
  MESSAGE_SENT: 'message_sent',
  MESSAGE_RECEIVED: 'message_received',
  EMAIL_OPENED: 'email_opened',
  EMAIL_BOUNCED: 'email_bounced',
  
  // Category events
  CATEGORY_CHANGED: 'category_changed',
  TAG_ADDED: 'tag_added',
  TAG_REMOVED: 'tag_removed',
  
  // Loyalty events
  POINTS_EARNED: 'points_earned',
  POINTS_REDEEMED: 'points_redeemed',
  REWARD_CLAIMED: 'reward_claimed',
  
  // Portal events
  PORTAL_LOGIN: 'portal_login',
  PORTAL_LOGOUT: 'portal_logout',
  PORTAL_PASSWORD_CHANGED: 'portal_password_changed',
  
  // Other events
  NOTE_ADDED: 'note_added',
  DOCUMENT_UPLOADED: 'document_uploaded',
  CONSENT_GIVEN: 'consent_given',
  CONSENT_WITHDRAWN: 'consent_withdrawn',
  REFERRAL_MADE: 'referral_made',
} as const;

export type ActivityEventType = typeof ACTIVITY_EVENTS[keyof typeof ACTIVITY_EVENTS];

// Activity summary interface
export interface ActivitySummary {
  totalActivities: number;
  activitiesByType: Record<string, number>;
  recentActivities: ClientActivity[];
  mostActiveDay?: string;
  mostActiveHour?: number;
  lastActivityDate?: Date;
}

// Activity filter interface
export interface ActivityFilter {
  events?: ActivityEventType[];
  performedBy?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

// Change tracking interface
export interface FieldChange {
  field: string;
  oldValue: any;
  newValue: any;
  changedAt: Timestamp;
  changedBy: string;
}

class ClientActivityService {
  private activitiesCollection = 'clientActivities';

  // Log activity
  async logActivity(
    clientId: string,
    event: ActivityEventType,
    details: Record<string, any>,
    performedBy: string,
    changes?: FieldChange[]
  ): Promise<string> {
    try {
      const activity: Omit<ClientActivity, 'id'> = {
        clientId,
        timestamp: Timestamp.now(),
        event,
        details,
        performedBy,
        performedByName: await this.getPerformerName(performedBy),
        ipAddress: details.ipAddress,
        userAgent: details.userAgent,
        changes: changes?.map(c => ({
          field: c.field,
          oldValue: c.oldValue,
          newValue: c.newValue,
        })),
      };

      const docRef = await addDoc(collection(db, this.activitiesCollection), activity);
      return docRef.id;
    } catch (error) {
      console.error('Error logging activity:', error);
      throw error;
    }
  }

  // Get performer name
  private async getPerformerName(performedBy: string): Promise<string> {
    if (performedBy === 'system') return 'System';
    if (performedBy === 'client') return 'Client';
    
    try {
      // Try to get from users collection
      const userDoc = await getDocs(
        query(
          collection(db, 'users'),
          where('uid', '==', performedBy),
          limit(1)
        )
      );
      
      if (!userDoc.empty) {
        const userData = userDoc.docs[0].data();
        return userData.displayName || userData.email || 'Unknown User';
      }
      
      // Try to get from staff collection
      const staffDoc = await getDocs(
        query(
          collection(db, 'staff'),
          where('userId', '==', performedBy),
          limit(1)
        )
      );
      
      if (!staffDoc.empty) {
        const staffData = staffDoc.docs[0].data();
        return `${staffData.firstName} ${staffData.lastName}`.trim() || 'Unknown Staff';
      }
      
      return 'Unknown User';
    } catch (error) {
      console.error('Error getting performer name:', error);
      return performedBy;
    }
  }

  // Get activity history
  async getActivityHistory(
    clientId: string,
    filter?: ActivityFilter
  ): Promise<ClientActivity[]> {
    try {
      let q = query(
        collection(db, this.activitiesCollection),
        where('clientId', '==', clientId),
        orderBy('timestamp', 'desc')
      );

      if (filter?.limit) {
        q = query(q, limit(filter.limit));
      }

      const snapshot = await getDocs(q);
      let activities: ClientActivity[] = [];

      snapshot.forEach((doc) => {
        activities.push({
          id: doc.id,
          ...doc.data(),
        } as ClientActivity);
      });

      // Apply additional filters
      if (filter?.events && filter.events.length > 0) {
        activities = activities.filter(a => 
          filter.events!.includes(a.event as ActivityEventType)
        );
      }

      if (filter?.performedBy) {
        activities = activities.filter(a => a.performedBy === filter.performedBy);
      }

      if (filter?.startDate) {
        const startTimestamp = Timestamp.fromDate(filter.startDate);
        activities = activities.filter(a => a.timestamp >= startTimestamp);
      }

      if (filter?.endDate) {
        const endTimestamp = Timestamp.fromDate(filter.endDate);
        activities = activities.filter(a => a.timestamp <= endTimestamp);
      }

      return activities;
    } catch (error) {
      console.error('Error getting activity history:', error);
      throw error;
    }
  }

  // Subscribe to activities
  subscribeToActivities(
    clientId: string,
    callback: (activities: ClientActivity[]) => void,
    filter?: ActivityFilter
  ): Unsubscribe {
    let q = query(
      collection(db, this.activitiesCollection),
      where('clientId', '==', clientId),
      orderBy('timestamp', 'desc'),
      limit(filter?.limit || 50)
    );

    return onSnapshot(q, (snapshot) => {
      let activities: ClientActivity[] = [];
      
      snapshot.forEach((doc) => {
        activities.push({
          id: doc.id,
          ...doc.data(),
        } as ClientActivity);
      });

      // Apply client-side filters
      if (filter?.events && filter.events.length > 0) {
        activities = activities.filter(a => 
          filter.events!.includes(a.event as ActivityEventType)
        );
      }

      if (filter?.performedBy) {
        activities = activities.filter(a => a.performedBy === filter.performedBy);
      }

      callback(activities);
    });
  }

  // Get activity summary
  async getActivitySummary(
    clientId: string,
    days: number = 30
  ): Promise<ActivitySummary> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const activities = await this.getActivityHistory(clientId, {
        startDate,
        limit: 1000,
      });

      // Count activities by type
      const activitiesByType: Record<string, number> = {};
      const dayCount: Record<string, number> = {};
      const hourCount: Record<number, number> = {};

      activities.forEach(activity => {
        // Count by type
        activitiesByType[activity.event] = (activitiesByType[activity.event] || 0) + 1;
        
        // Count by day
        const date = activity.timestamp.toDate();
        const dayKey = date.toDateString();
        dayCount[dayKey] = (dayCount[dayKey] || 0) + 1;
        
        // Count by hour
        const hour = date.getHours();
        hourCount[hour] = (hourCount[hour] || 0) + 1;
      });

      // Find most active day
      let mostActiveDay: string | undefined;
      let maxDayCount = 0;
      Object.entries(dayCount).forEach(([day, count]) => {
        if (count > maxDayCount) {
          maxDayCount = count;
          mostActiveDay = day;
        }
      });

      // Find most active hour
      let mostActiveHour: number | undefined;
      let maxHourCount = 0;
      Object.entries(hourCount).forEach(([hour, count]) => {
        if (count > maxHourCount) {
          maxHourCount = count;
          mostActiveHour = parseInt(hour);
        }
      });

      const lastActivityDate = activities.length > 0 ? 
        activities[0].timestamp.toDate() : undefined;

      return {
        totalActivities: activities.length,
        activitiesByType,
        recentActivities: activities.slice(0, 10),
        mostActiveDay,
        mostActiveHour,
        lastActivityDate,
      };
    } catch (error) {
      console.error('Error getting activity summary:', error);
      throw error;
    }
  }

  // Log profile changes
  async logProfileChanges(
    clientId: string,
    changes: FieldChange[],
    performedBy: string
  ): Promise<void> {
    if (changes.length === 0) return;

    try {
      await this.logActivity(
        clientId,
        ACTIVITY_EVENTS.PROFILE_UPDATED,
        {
          fieldsUpdated: changes.map(c => c.field),
          updateCount: changes.length,
        },
        performedBy,
        changes
      );
    } catch (error) {
      console.error('Error logging profile changes:', error);
      // Don't throw - this is a background operation
    }
  }

  // Convenience methods for common activities
  async logProfileCreated(clientId: string, createdBy: string, source?: string): Promise<void> {
    await this.logActivity(
      clientId,
      ACTIVITY_EVENTS.PROFILE_CREATED,
      { source: source || 'manual' },
      createdBy
    );
  }

  async logAppointmentBooked(
    clientId: string,
    appointmentId: string,
    date: Date,
    services: string[],
    performedBy: string
  ): Promise<void> {
    await this.logActivity(
      clientId,
      ACTIVITY_EVENTS.APPOINTMENT_BOOKED,
      {
        appointmentId,
        date: date.toISOString(),
        services,
      },
      performedBy
    );
  }

  async logPaymentMade(
    clientId: string,
    amount: number,
    method: string,
    transactionId: string,
    performedBy: string
  ): Promise<void> {
    await this.logActivity(
      clientId,
      ACTIVITY_EVENTS.PAYMENT_MADE,
      {
        amount,
        method,
        transactionId,
      },
      performedBy
    );
  }

  async logCommunicationSent(
    clientId: string,
    type: 'sms' | 'email',
    subject: string,
    communicationId: string,
    performedBy: string
  ): Promise<void> {
    await this.logActivity(
      clientId,
      ACTIVITY_EVENTS.MESSAGE_SENT,
      {
        type,
        subject,
        communicationId,
      },
      performedBy
    );
  }

  async logCategoryChanged(
    clientId: string,
    oldCategory: string,
    newCategory: string,
    reason: string,
    performedBy: string
  ): Promise<void> {
    await this.logActivity(
      clientId,
      ACTIVITY_EVENTS.CATEGORY_CHANGED,
      {
        oldCategory,
        newCategory,
        reason,
      },
      performedBy,
      [{
        field: 'category',
        oldValue: oldCategory,
        newValue: newCategory,
        changedAt: Timestamp.now(),
        changedBy: performedBy,
      }]
    );
  }

  async logPortalAccess(
    clientId: string,
    action: 'login' | 'logout',
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logActivity(
      clientId,
      action === 'login' ? ACTIVITY_EVENTS.PORTAL_LOGIN : ACTIVITY_EVENTS.PORTAL_LOGOUT,
      {
        ipAddress,
        userAgent,
      },
      'client'
    );
  }

  // Search activities
  async searchActivities(
    companyId: string,
    searchTerm: string,
    options?: {
      limit?: number;
      clientIds?: string[];
    }
  ): Promise<ClientActivity[]> {
    try {
      // This is a simplified search - in production, you'd want full-text search
      let activities: ClientActivity[] = [];
      
      // If specific client IDs provided, search those
      if (options?.clientIds && options.clientIds.length > 0) {
        for (const clientId of options.clientIds) {
          const clientActivities = await this.getActivityHistory(clientId, {
            limit: options.limit || 100,
          });
          activities.push(...clientActivities);
        }
      }

      // Filter by search term
      const searchLower = searchTerm.toLowerCase();
      activities = activities.filter(activity => {
        const eventMatch = activity.event.toLowerCase().includes(searchLower);
        const detailsMatch = JSON.stringify(activity.details).toLowerCase().includes(searchLower);
        const performerMatch = activity.performedByName?.toLowerCase().includes(searchLower);
        
        return eventMatch || detailsMatch || performerMatch;
      });

      // Sort by timestamp
      activities.sort((a, b) => b.timestamp.seconds - a.timestamp.seconds);

      // Limit results
      if (options?.limit) {
        activities = activities.slice(0, options.limit);
      }

      return activities;
    } catch (error) {
      console.error('Error searching activities:', error);
      throw error;
    }
  }

  // Export activity log
  async exportActivityLog(
    clientId: string,
    format: 'json' | 'csv',
    filter?: ActivityFilter
  ): Promise<string> {
    try {
      const activities = await this.getActivityHistory(clientId, filter);
      
      if (format === 'json') {
        return JSON.stringify(activities, null, 2);
      } else if (format === 'csv') {
        // CSV header
        let csv = 'Date,Time,Event,Performed By,Details,Changes\n';
        
        // CSV rows
        activities.forEach(activity => {
          const date = activity.timestamp.toDate();
          const dateStr = date.toLocaleDateString();
          const timeStr = date.toLocaleTimeString();
          const detailsStr = JSON.stringify(activity.details).replace(/"/g, '""');
          const changesStr = activity.changes ? 
            JSON.stringify(activity.changes).replace(/"/g, '""') : '';
          
          csv += `"${dateStr}","${timeStr}","${activity.event}","${activity.performedByName || activity.performedBy}","${detailsStr}","${changesStr}"\n`;
        });
        
        return csv;
      } else {
        throw new Error('Unsupported format');
      }
    } catch (error) {
      console.error('Error exporting activity log:', error);
      throw error;
    }
  }

  // Cleanup old activities (for data retention policies)
  async cleanupOldActivities(clientId: string, retentionDays: number): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      const cutoffTimestamp = Timestamp.fromDate(cutoffDate);

      const q = query(
        collection(db, this.activitiesCollection),
        where('clientId', '==', clientId),
        where('timestamp', '<', cutoffTimestamp)
      );

      const snapshot = await getDocs(q);
      let deletedCount = 0;

      // Note: In production, you'd want to batch delete these
      // For now, we'll just count them
      snapshot.forEach(() => {
        deletedCount++;
      });

      return deletedCount;
    } catch (error) {
      console.error('Error cleaning up old activities:', error);
      throw error;
    }
  }
}

export const clientActivityService = new ClientActivityService();