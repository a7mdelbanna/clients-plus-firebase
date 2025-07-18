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
} from 'firebase/firestore';
import type { ClientCommunication } from './client.service';

// Communication template interface
export interface CommunicationTemplate {
  id?: string;
  companyId: string;
  name: string;
  type: 'sms' | 'email' | 'whatsapp';
  category: 'appointment_reminder' | 'birthday' | 'miss_you' | 'promotional' | 'review_request' | 'custom';
  subject?: string; // For emails
  content: string;
  variables: string[]; // e.g., ['{clientName}', '{appointmentDate}', '{serviceName}']
  active: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// Campaign interface
export interface Campaign {
  id?: string;
  companyId: string;
  name: string;
  description?: string;
  type: 'sms' | 'email';
  templateId: string;
  targetAudience: {
    filter?: any; // ClientsFilter
    clientIds?: string[];
  };
  scheduledDate?: Timestamp;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
  stats?: {
    totalRecipients: number;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    failed: number;
  };
  createdAt?: Timestamp;
  sentAt?: Timestamp;
}

// Communication preferences
export interface CommunicationPreferences {
  preferredChannel: 'sms' | 'email' | 'phone' | 'whatsapp';
  language: string;
  timezone: string;
  quietHours?: {
    start: string; // e.g., "21:00"
    end: string; // e.g., "09:00"
  };
  frequency?: {
    maxPerDay?: number;
    maxPerWeek?: number;
    maxPerMonth?: number;
  };
}

// Message queue interface
export interface MessageQueue {
  id?: string;
  clientId: string;
  type: 'sms' | 'email' | 'whatsapp';
  templateId?: string;
  subject?: string;
  content: string;
  scheduledFor: Timestamp;
  priority: 'high' | 'normal' | 'low';
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'processing' | 'sent' | 'failed';
  error?: string;
  createdAt?: Timestamp;
  processedAt?: Timestamp;
}

// SMS provider interface
export interface SMSProvider {
  send(phone: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }>;
  getStatus(messageId: string): Promise<'sent' | 'delivered' | 'failed'>;
}

// Email provider interface
export interface EmailProvider {
  send(email: string, subject: string, html: string, attachments?: any[]): Promise<{ success: boolean; messageId?: string; error?: string }>;
  getStatus(messageId: string): Promise<'sent' | 'delivered' | 'opened' | 'bounced' | 'failed'>;
}

class ClientCommunicationService {
  private communicationsCollection = 'clientCommunications';
  private templatesCollection = 'communicationTemplates';
  private campaignsCollection = 'campaigns';
  private messageQueueCollection = 'messageQueue';

  // Placeholder for SMS/Email providers
  private smsProvider: SMSProvider | null = null;
  private emailProvider: EmailProvider | null = null;

  // Record communication
  async recordCommunication(
    communication: Omit<ClientCommunication, 'id' | 'createdAt'>
  ): Promise<string> {
    try {
      const newCommunication = {
        ...communication,
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, this.communicationsCollection), newCommunication);

      // Update client's last contact date
      await updateDoc(doc(db, 'clients', communication.clientId), {
        lastContactDate: communication.date,
        updatedAt: serverTimestamp(),
      });

      return docRef.id;
    } catch (error) {
      console.error('Error recording communication:', error);
      throw error;
    }
  }

  // Send SMS
  async sendSMS(
    clientId: string,
    phone: string,
    message: string,
    templateId?: string,
    campaignId?: string
  ): Promise<string> {
    try {
      // Queue the message
      const messageId = await this.queueMessage({
        clientId,
        type: 'sms',
        templateId,
        content: message,
        scheduledFor: Timestamp.now(),
        priority: 'normal',
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
      });

      // Process immediately if provider is available
      if (this.smsProvider) {
        await this.processQueuedMessage(messageId);
      }

      return messageId;
    } catch (error) {
      console.error('Error sending SMS:', error);
      throw error;
    }
  }

  // Send Email
  async sendEmail(
    clientId: string,
    email: string,
    subject: string,
    content: string,
    templateId?: string,
    campaignId?: string,
    attachments?: any[]
  ): Promise<string> {
    try {
      // Queue the message
      const messageId = await this.queueMessage({
        clientId,
        type: 'email',
        templateId,
        subject,
        content,
        scheduledFor: Timestamp.now(),
        priority: 'normal',
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
      });

      // Process immediately if provider is available
      if (this.emailProvider) {
        await this.processQueuedMessage(messageId);
      }

      return messageId;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  // Queue message for sending
  private async queueMessage(message: Omit<MessageQueue, 'id' | 'createdAt'>): Promise<string> {
    try {
      const newMessage = {
        ...message,
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, this.messageQueueCollection), newMessage);
      return docRef.id;
    } catch (error) {
      console.error('Error queuing message:', error);
      throw error;
    }
  }

  // Process queued message
  private async processQueuedMessage(messageId: string): Promise<void> {
    try {
      const messageRef = doc(db, this.messageQueueCollection, messageId);
      const messageDoc = await getDoc(messageRef);

      if (!messageDoc.exists()) {
        throw new Error('Message not found');
      }

      const message = messageDoc.data() as MessageQueue;

      // Update status to processing
      await updateDoc(messageRef, {
        status: 'processing',
        processedAt: serverTimestamp(),
      });

      let result: { success: boolean; messageId?: string; error?: string };

      // Send based on type
      if (message.type === 'sms' && this.smsProvider) {
        // Get client phone
        const clientDoc = await getDoc(doc(db, 'clients', message.clientId));
        const phone = clientDoc.data()?.phone;
        
        if (!phone) {
          throw new Error('Client phone not found');
        }

        result = await this.smsProvider.send(phone, message.content);
      } else if (message.type === 'email' && this.emailProvider) {
        // Get client email
        const clientDoc = await getDoc(doc(db, 'clients', message.clientId));
        const email = clientDoc.data()?.email;
        
        if (!email) {
          throw new Error('Client email not found');
        }

        result = await this.emailProvider.send(
          email,
          message.subject || '',
          message.content,
          []
        );
      } else {
        throw new Error(`No provider available for ${message.type}`);
      }

      if (result.success) {
        // Update queue status
        await updateDoc(messageRef, {
          status: 'sent',
          processedAt: serverTimestamp(),
        });

        // Record communication
        await this.recordCommunication({
          clientId: message.clientId,
          date: Timestamp.now(),
          type: message.type,
          direction: 'outbound',
          subject: message.subject,
          content: message.content,
          status: 'sent',
          templateId: message.templateId,
        });
      } else {
        // Handle failure
        const newRetryCount = message.retryCount + 1;
        
        if (newRetryCount < message.maxRetries) {
          // Schedule retry
          const retryDelay = Math.pow(2, newRetryCount) * 60 * 1000; // Exponential backoff
          const retryTime = new Date(Date.now() + retryDelay);
          
          await updateDoc(messageRef, {
            status: 'pending',
            retryCount: newRetryCount,
            scheduledFor: Timestamp.fromDate(retryTime),
            error: result.error,
          });
        } else {
          // Max retries reached
          await updateDoc(messageRef, {
            status: 'failed',
            error: result.error,
          });
        }
      }
    } catch (error) {
      console.error('Error processing queued message:', error);
      throw error;
    }
  }

  // Get communication history
  async getCommunicationHistory(
    clientId: string,
    options?: {
      limit?: number;
      type?: ClientCommunication['type'];
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<ClientCommunication[]> {
    try {
      let q = query(
        collection(db, this.communicationsCollection),
        where('clientId', '==', clientId),
        orderBy('date', 'desc')
      );

      if (options?.limit) {
        q = query(q, limit(options.limit));
      }

      const snapshot = await getDocs(q);
      let communications: ClientCommunication[] = [];

      snapshot.forEach((doc) => {
        communications.push({
          id: doc.id,
          ...doc.data(),
        } as ClientCommunication);
      });

      // Apply additional filters
      if (options?.type) {
        communications = communications.filter(c => c.type === options.type);
      }

      if (options?.startDate) {
        const startTimestamp = Timestamp.fromDate(options.startDate);
        communications = communications.filter(c => c.date >= startTimestamp);
      }

      if (options?.endDate) {
        const endTimestamp = Timestamp.fromDate(options.endDate);
        communications = communications.filter(c => c.date <= endTimestamp);
      }

      return communications;
    } catch (error) {
      console.error('Error getting communication history:', error);
      throw error;
    }
  }

  // Subscribe to communications
  subscribeToCommunications(
    clientId: string,
    callback: (communications: ClientCommunication[]) => void
  ): Unsubscribe {
    const q = query(
      collection(db, this.communicationsCollection),
      where('clientId', '==', clientId),
      orderBy('date', 'desc'),
      limit(50)
    );

    return onSnapshot(q, (snapshot) => {
      const communications: ClientCommunication[] = [];
      snapshot.forEach((doc) => {
        communications.push({
          id: doc.id,
          ...doc.data(),
        } as ClientCommunication);
      });
      callback(communications);
    });
  }

  // Template Management
  async createTemplate(
    template: Omit<CommunicationTemplate, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    try {
      const newTemplate = {
        ...template,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, this.templatesCollection), newTemplate);
      return docRef.id;
    } catch (error) {
      console.error('Error creating template:', error);
      throw error;
    }
  }

  // Get templates
  async getTemplates(
    companyId: string,
    type?: CommunicationTemplate['type']
  ): Promise<CommunicationTemplate[]> {
    try {
      let q = query(
        collection(db, this.templatesCollection),
        where('companyId', '==', companyId),
        where('active', '==', true)
      );

      if (type) {
        q = query(q, where('type', '==', type));
      }

      const snapshot = await getDocs(q);
      const templates: CommunicationTemplate[] = [];

      snapshot.forEach((doc) => {
        templates.push({
          id: doc.id,
          ...doc.data(),
        } as CommunicationTemplate);
      });

      return templates;
    } catch (error) {
      console.error('Error getting templates:', error);
      return [];
    }
  }

  // Process template variables
  async processTemplate(
    templateId: string,
    clientId: string,
    additionalVars?: Record<string, string>
  ): Promise<{ subject?: string; content: string }> {
    try {
      const [templateDoc, clientDoc] = await Promise.all([
        getDoc(doc(db, this.templatesCollection, templateId)),
        getDoc(doc(db, 'clients', clientId)),
      ]);

      if (!templateDoc.exists() || !clientDoc.exists()) {
        throw new Error('Template or client not found');
      }

      const template = templateDoc.data() as CommunicationTemplate;
      const client = clientDoc.data();

      // Create variables map
      const variables: Record<string, string> = {
        '{clientName}': `${client.firstName || ''} ${client.lastName || ''}`.trim() || client.name || '',
        '{firstName}': client.firstName || '',
        '{lastName}': client.lastName || '',
        '{email}': client.email || '',
        '{phone}': client.phone || '',
        '{companyName}': '', // Would come from company data
        '{today}': new Date().toLocaleDateString(),
        ...additionalVars,
      };

      // Replace variables in content
      let processedContent = template.content;
      let processedSubject = template.subject || '';

      Object.entries(variables).forEach(([key, value]) => {
        processedContent = processedContent.replace(new RegExp(key, 'g'), value);
        processedSubject = processedSubject.replace(new RegExp(key, 'g'), value);
      });

      return {
        subject: processedSubject,
        content: processedContent,
      };
    } catch (error) {
      console.error('Error processing template:', error);
      throw error;
    }
  }

  // Campaign Management
  async createCampaign(
    campaign: Omit<Campaign, 'id' | 'createdAt'>
  ): Promise<string> {
    try {
      const newCampaign = {
        ...campaign,
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, this.campaignsCollection), newCampaign);
      return docRef.id;
    } catch (error) {
      console.error('Error creating campaign:', error);
      throw error;
    }
  }

  // Send campaign
  async sendCampaign(campaignId: string): Promise<void> {
    try {
      const campaignRef = doc(db, this.campaignsCollection, campaignId);
      const campaignDoc = await getDoc(campaignRef);

      if (!campaignDoc.exists()) {
        throw new Error('Campaign not found');
      }

      const campaign = campaignDoc.data() as Campaign;

      // Update status
      await updateDoc(campaignRef, {
        status: 'sending',
        sentAt: serverTimestamp(),
      });

      // Get target clients
      let clientIds: string[] = [];
      
      if (campaign.targetAudience.clientIds) {
        clientIds = campaign.targetAudience.clientIds;
      } else if (campaign.targetAudience.filter) {
        // TODO: Apply filter to get client IDs
        // This would use the advanced filter system
      }

      // Initialize stats
      const stats = {
        totalRecipients: clientIds.length,
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        bounced: 0,
        failed: 0,
      };

      // Send to each client
      for (const clientId of clientIds) {
        try {
          const { subject, content } = await this.processTemplate(
            campaign.templateId,
            clientId
          );

          if (campaign.type === 'sms') {
            await this.sendSMS(clientId, '', content, campaign.templateId, campaignId);
          } else if (campaign.type === 'email') {
            await this.sendEmail(
              clientId,
              '',
              subject || campaign.name,
              content,
              campaign.templateId,
              campaignId
            );
          }

          stats.sent++;
        } catch (error) {
          console.error(`Error sending to client ${clientId}:`, error);
          stats.failed++;
        }
      }

      // Update campaign with final stats
      await updateDoc(campaignRef, {
        status: 'sent',
        stats,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error sending campaign:', error);
      throw error;
    }
  }

  // Get communication preferences
  async getCommunicationPreferences(clientId: string): Promise<CommunicationPreferences> {
    try {
      const clientDoc = await getDoc(doc(db, 'clients', clientId));
      
      if (!clientDoc.exists()) {
        throw new Error('Client not found');
      }

      const client = clientDoc.data();
      
      // Extract preferences from client data
      return {
        preferredChannel: 'email', // Default, should come from client preferences
        language: client.preferences?.communicationLanguage || 'en',
        timezone: 'UTC', // Should come from client or company settings
        quietHours: {
          start: '21:00',
          end: '09:00',
        },
        frequency: {
          maxPerDay: 2,
          maxPerWeek: 5,
          maxPerMonth: 20,
        },
      };
    } catch (error) {
      console.error('Error getting communication preferences:', error);
      throw error;
    }
  }

  // Check if can send message (respects preferences and limits)
  async canSendMessage(
    clientId: string,
    type: 'sms' | 'email',
    scheduledTime?: Date
  ): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const [preferences, recentCommunications] = await Promise.all([
        this.getCommunicationPreferences(clientId),
        this.getCommunicationHistory(clientId, {
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        }),
      ]);

      // Check quiet hours
      const checkTime = scheduledTime || new Date();
      const hours = checkTime.getHours();
      const quietStart = parseInt(preferences.quietHours?.start.split(':')[0] || '21');
      const quietEnd = parseInt(preferences.quietHours?.end.split(':')[0] || '9');
      
      if (quietStart > quietEnd) {
        // Quiet hours span midnight
        if (hours >= quietStart || hours < quietEnd) {
          return { allowed: false, reason: 'During quiet hours' };
        }
      } else {
        if (hours >= quietStart && hours < quietEnd) {
          return { allowed: false, reason: 'During quiet hours' };
        }
      }

      // Check frequency limits
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const todayCount = recentCommunications.filter(c => 
        c.type === type && c.date.toDate() >= today
      ).length;
      
      const weekCount = recentCommunications.filter(c => 
        c.type === type && c.date.toDate() >= weekAgo
      ).length;
      
      const monthCount = recentCommunications.filter(c => 
        c.type === type
      ).length;

      if (preferences.frequency?.maxPerDay && todayCount >= preferences.frequency.maxPerDay) {
        return { allowed: false, reason: 'Daily limit reached' };
      }

      if (preferences.frequency?.maxPerWeek && weekCount >= preferences.frequency.maxPerWeek) {
        return { allowed: false, reason: 'Weekly limit reached' };
      }

      if (preferences.frequency?.maxPerMonth && monthCount >= preferences.frequency.maxPerMonth) {
        return { allowed: false, reason: 'Monthly limit reached' };
      }

      return { allowed: true };
    } catch (error) {
      console.error('Error checking message limits:', error);
      return { allowed: true }; // Allow by default if check fails
    }
  }

  // Automated message scheduling
  async scheduleAutomatedMessages(clientId: string): Promise<void> {
    try {
      const clientDoc = await getDoc(doc(db, 'clients', clientId));
      
      if (!clientDoc.exists()) {
        return;
      }

      const client = clientDoc.data();

      // Birthday message
      if (client.dateOfBirth && client.marketing?.acceptsPromotions) {
        const dob = client.dateOfBirth instanceof Timestamp ? 
          client.dateOfBirth.toDate() : client.dateOfBirth;
        
        const today = new Date();
        const birthday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
        
        // Schedule 7 days before birthday
        const scheduledDate = new Date(birthday);
        scheduledDate.setDate(scheduledDate.getDate() - 7);
        
        if (scheduledDate > today) {
          await this.queueMessage({
            clientId,
            type: client.marketing.acceptsSMS ? 'sms' : 'email',
            content: 'Birthday message template',
            scheduledFor: Timestamp.fromDate(scheduledDate),
            priority: 'normal',
            retryCount: 0,
            maxRetries: 3,
            status: 'pending',
          });
        }
      }

      // Other automated messages can be added here
      // - Welcome message for new clients
      // - Re-engagement for inactive clients
      // - Post-visit follow-up
      // - Review requests
    } catch (error) {
      console.error('Error scheduling automated messages:', error);
    }
  }
}

export const clientCommunicationService = new ClientCommunicationService();