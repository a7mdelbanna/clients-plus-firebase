import { db } from '../config/firebase';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  addDoc,
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

// WhatsApp Message Types
export interface WhatsAppMessage {
  id?: string;
  companyId: string;
  clientId: string;
  appointmentId?: string;
  to: string; // Phone number with country code
  type: 'appointment_confirmation' | 'appointment_reminder' | 'follow_up' | 'custom';
  templateName?: string;
  templateLanguage: 'ar' | 'en';
  parameters?: Record<string, string>; // Template variable values
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  messageId?: string; // WhatsApp message ID
  error?: string;
  sentAt?: Timestamp;
  deliveredAt?: Timestamp;
  readAt?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// WhatsApp Configuration
export interface WhatsAppConfig {
  enabled: boolean;
  provider: 'twilio' | 'whatsapp_cloud' | 'custom';
  accountSid?: string; // For Twilio
  authToken?: string; // For Twilio
  twilioWhatsAppNumber?: string; // For Twilio WhatsApp number
  phoneNumberId?: string; // For WhatsApp Cloud API
  accessToken?: string; // For WhatsApp Cloud API
  webhookUrl?: string;
  defaultLanguage: 'ar' | 'en';
}

// WhatsApp Template
export interface WhatsAppTemplate {
  id: string;
  name: string;
  type: 'appointment_confirmation' | 'appointment_reminder' | 'follow_up' | 'custom';
  language: 'ar' | 'en';
  header?: string;
  body: string;
  footer?: string;
  buttons?: Array<{
    type: 'quick_reply' | 'url' | 'phone_number';
    text: string;
    payload?: string;
  }>;
  variables: string[]; // List of variable names used in template
  approved: boolean; // WhatsApp approval status
}

// Default message templates
const defaultTemplates: Record<string, WhatsAppTemplate> = {
  appointment_confirmation_ar: {
    id: 'appointment_confirmation_ar',
    name: 'appointment_confirmation',
    type: 'appointment_confirmation',
    language: 'ar',
    header: 'تأكيد الموعد',
    body: 'مرحباً {{clientName}}،\n\nتم تأكيد موعدك:\n📅 التاريخ: {{date}}\n⏰ الوقت: {{time}}\n💇 الخدمة: {{service}}\n👤 مع: {{staffName}}\n\nالعنوان: {{businessAddress}}\n\nللإلغاء أو التعديل، يرجى الاتصال بنا.',
    footer: '{{businessName}}',
    buttons: [
      {
        type: 'phone_number',
        text: 'اتصل بنا',
        payload: '{{businessPhone}}'
      }
    ],
    variables: ['clientName', 'date', 'time', 'service', 'staffName', 'businessAddress', 'businessName', 'businessPhone'],
    approved: true
  },
  appointment_confirmation_en: {
    id: 'appointment_confirmation_en',
    name: 'appointment_confirmation',
    type: 'appointment_confirmation',
    language: 'en',
    header: 'Appointment Confirmation',
    body: 'Hello {{clientName}},\n\nYour appointment is confirmed:\n📅 Date: {{date}}\n⏰ Time: {{time}}\n💇 Service: {{service}}\n👤 With: {{staffName}}\n\nAddress: {{businessAddress}}\n\nTo cancel or reschedule, please contact us.',
    footer: '{{businessName}}',
    buttons: [
      {
        type: 'phone_number',
        text: 'Call Us',
        payload: '{{businessPhone}}'
      }
    ],
    variables: ['clientName', 'date', 'time', 'service', 'staffName', 'businessAddress', 'businessName', 'businessPhone'],
    approved: true
  },
  appointment_reminder_ar: {
    id: 'appointment_reminder_ar',
    name: 'appointment_reminder',
    type: 'appointment_reminder',
    language: 'ar',
    header: 'تذكير بالموعد',
    body: 'مرحباً {{clientName}}،\n\nنذكرك بموعدك {{reminderTime}}:\n📅 التاريخ: {{date}}\n⏰ الوقت: {{time}}\n💇 الخدمة: {{service}}\n\nنتطلع لرؤيتك!',
    footer: '{{businessName}}',
    variables: ['clientName', 'reminderTime', 'date', 'time', 'service', 'businessName'],
    approved: true
  },
  appointment_reminder_en: {
    id: 'appointment_reminder_en',
    name: 'appointment_reminder',
    type: 'appointment_reminder',
    language: 'en',
    header: 'Appointment Reminder',
    body: 'Hello {{clientName}},\n\nThis is a reminder for your appointment {{reminderTime}}:\n📅 Date: {{date}}\n⏰ Time: {{time}}\n💇 Service: {{service}}\n\nWe look forward to seeing you!',
    footer: '{{businessName}}',
    variables: ['clientName', 'reminderTime', 'date', 'time', 'service', 'businessName'],
    approved: true
  }
};

class WhatsAppService {
  private configCache: Map<string, WhatsAppConfig> = new Map();

  // Get WhatsApp configuration for a company
  async getConfig(companyId: string): Promise<WhatsAppConfig | null> {
    try {
      // Check cache first
      if (this.configCache.has(companyId)) {
        return this.configCache.get(companyId)!;
      }

      // Try to get from top-level collection first
      const topLevelRef = doc(db, 'whatsappConfigs', companyId);
      const topLevelSnap = await getDoc(topLevelRef);

      if (topLevelSnap.exists()) {
        const config = topLevelSnap.data() as WhatsAppConfig;
        this.configCache.set(companyId, config);
        return config;
      }

      // Fallback to company settings subcollection
      const settingsRef = doc(db, 'companies', companyId, 'settings', 'whatsapp');
      const settingsSnap = await getDoc(settingsRef);

      if (settingsSnap.exists()) {
        const config = settingsSnap.data() as WhatsAppConfig;
        this.configCache.set(companyId, config);
        return config;
      }

      return null;
    } catch (error) {
      console.error('Error getting WhatsApp config:', error);
      return null;
    }
  }

  // Save WhatsApp configuration
  async saveConfig(companyId: string, config: WhatsAppConfig): Promise<void> {
    try {
      // Save to top-level whatsappConfigs collection
      const docRef = doc(db, 'whatsappConfigs', companyId);
      await setDoc(docRef, {
        ...config,
        companyId,
        updatedAt: serverTimestamp()
      }, { merge: true }); // Use merge to handle both create and update

      // Update cache
      this.configCache.set(companyId, config);
    } catch (error) {
      console.error('Error saving WhatsApp config:', error);
      throw error;
    }
  }

  // Format phone number for WhatsApp (must include country code)
  formatPhoneNumber(phone: string, countryCode: string = '20'): string {
    // Remove all non-numeric characters except +
    let cleaned = phone.replace(/[^\d+]/g, '');
    
    // If starts with +, preserve it
    if (cleaned.startsWith('+')) {
      return cleaned;
    }
    
    // Remove leading zeros
    cleaned = cleaned.replace(/^0+/, '');
    
    // Add country code if not present
    if (!cleaned.startsWith(countryCode)) {
      cleaned = countryCode + cleaned;
    }
    
    // Always add + prefix for international format
    return '+' + cleaned;
  }

  // Send WhatsApp message
  async sendMessage(
    companyId: string,
    message: Omit<WhatsAppMessage, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    console.log('=== WHATSAPP SERVICE - sendMessage ===');
    console.log('To:', message.to);
    console.log('Type:', message.type);
    
    try {
      const config = await this.getConfig(companyId);
      console.log('Config loaded:', !!config);
      console.log('Config enabled:', config?.enabled);
      console.log('Config provider:', config?.provider);
      
      if (!config || !config.enabled) {
        throw new Error('WhatsApp is not configured or enabled for this company');
      }

      // Format phone number
      const formattedPhone = this.formatPhoneNumber(message.to);

      // Store message in Firestore
      const messageData: WhatsAppMessage = {
        ...message,
        to: formattedPhone,
        status: 'pending',
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp
      };

      const docRef = await addDoc(
        collection(db, 'companies', companyId, 'whatsappMessages'),
        messageData
      );

      // Call Cloud Function to send message
      // In production, this would call your backend service
      try {
        console.log('Calling Cloud Function sendWhatsAppMessage');
        const sendWhatsAppMessage = httpsCallable(functions, 'sendWhatsAppMessage');
        
        const functionData = {
          messageId: docRef.id,
          companyId,
          config,
          message: {
            ...messageData,
            id: docRef.id
          }
        };
        
        console.log('Sending to Cloud Function:', JSON.stringify(functionData, null, 2));
        
        const result = await sendWhatsAppMessage(functionData);
        console.log('Cloud Function result:', result.data);

        // Update message status
        await updateDoc(docRef, {
          status: 'sent',
          messageId: (result.data as any).messageId,
          sentAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        // Update message with error
        await updateDoc(docRef, {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          updatedAt: serverTimestamp()
        });
        throw error;
      }

      return docRef.id;
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      throw error;
    }
  }

  // Send appointment confirmation
  async sendAppointmentConfirmation(
    companyId: string,
    appointmentData: {
      appointmentId: string;
      clientId: string;
      clientName: string;
      clientPhone: string;
      date: Date;
      time: string;
      service: string;
      staffName: string;
      businessName: string;
      businessAddress: string;
      businessPhone: string;
      googleMapsLink?: string;
      language: 'ar' | 'en';
    }
  ): Promise<string> {
    console.log('=== WHATSAPP SERVICE - sendAppointmentConfirmation ===');
    console.log('Company ID:', companyId);
    console.log('Phone:', appointmentData.clientPhone);
    
    const template = defaultTemplates[`appointment_confirmation_${appointmentData.language}`];
    console.log('Using template:', template.name);
    
    const parameters: Record<string, string> = {
      clientName: appointmentData.clientName,
      date: appointmentData.date.toLocaleDateString(appointmentData.language === 'ar' ? 'ar-EG' : 'en-US'),
      time: appointmentData.time,
      service: appointmentData.service,
      staffName: appointmentData.staffName,
      businessName: appointmentData.businessName,
      businessAddress: appointmentData.businessAddress,
      businessPhone: appointmentData.businessPhone,
      googleMapsLink: appointmentData.googleMapsLink
    };
    
    console.log('Message parameters:', parameters);

    return this.sendMessage(companyId, {
      companyId,
      clientId: appointmentData.clientId,
      appointmentId: appointmentData.appointmentId,
      to: appointmentData.clientPhone,
      type: 'appointment_confirmation',
      templateName: template.name,
      templateLanguage: appointmentData.language,
      parameters
    });
  }

  // Send appointment reminder
  async sendAppointmentReminder(
    companyId: string,
    appointmentData: {
      appointmentId: string;
      clientId: string;
      clientName: string;
      clientPhone: string;
      date: Date;
      time: string;
      service: string;
      businessName: string;
      reminderTime: string; // e.g., "tomorrow", "in 2 hours"
      language: 'ar' | 'en';
    }
  ): Promise<string> {
    const template = defaultTemplates[`appointment_reminder_${appointmentData.language}`];
    
    const parameters: Record<string, string> = {
      clientName: appointmentData.clientName,
      reminderTime: appointmentData.reminderTime,
      date: appointmentData.date.toLocaleDateString(appointmentData.language === 'ar' ? 'ar-EG' : 'en-US'),
      time: appointmentData.time,
      service: appointmentData.service,
      businessName: appointmentData.businessName
    };

    return this.sendMessage(companyId, {
      companyId,
      clientId: appointmentData.clientId,
      appointmentId: appointmentData.appointmentId,
      to: appointmentData.clientPhone,
      type: 'appointment_reminder',
      templateName: template.name,
      templateLanguage: appointmentData.language,
      parameters
    });
  }

  // Get message templates
  getTemplates(language: 'ar' | 'en'): WhatsAppTemplate[] {
    return Object.values(defaultTemplates).filter(t => t.language === language);
  }

  // Update message status (called by webhook)
  async updateMessageStatus(
    companyId: string,
    messageId: string,
    status: 'delivered' | 'read' | 'failed',
    error?: string
  ): Promise<void> {
    try {
      const docRef = doc(db, 'companies', companyId, 'whatsappMessages', messageId);
      
      const updateData: any = {
        status,
        updatedAt: serverTimestamp()
      };

      if (status === 'delivered') {
        updateData.deliveredAt = serverTimestamp();
      } else if (status === 'read') {
        updateData.readAt = serverTimestamp();
      } else if (status === 'failed' && error) {
        updateData.error = error;
      }

      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error('Error updating message status:', error);
      throw error;
    }
  }
}

export const whatsAppService = new WhatsAppService();