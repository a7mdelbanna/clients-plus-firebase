import { db } from '../config/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  getDoc, 
  doc, 
  updateDoc,
  addDoc,
  serverTimestamp,
  Timestamp,
  onSnapshot,
  type Unsubscribe
} from 'firebase/firestore';
import { appointmentService, type Appointment } from './appointment.service';
import { whatsAppService } from './whatsapp.service';
import { clientService } from './client.service';
import { staffService } from './staff.service';
import { serviceService } from './service.service';
import { locationService } from './location.service';
import { addHours, addDays, isBefore, isAfter, startOfDay, endOfDay } from 'date-fns';

// Reminder Configuration
export interface ReminderConfig {
  id?: string;
  companyId: string;
  branchId?: string;
  enabled: boolean;
  channels: {
    whatsapp: boolean;
    sms: boolean;
    email: boolean;
  };
  timing: {
    dayBefore: boolean; // Send reminder 1 day before
    hoursBefore: number[]; // e.g., [24, 4] for 24 hours and 4 hours before
    customTimes?: Array<{
      value: number;
      unit: 'minutes' | 'hours' | 'days';
    }>;
  };
  templates: {
    whatsapp?: string;
    sms?: string;
    email?: string;
  };
  excludeStatuses: string[]; // Don't send reminders for these appointment statuses
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// Reminder Log
export interface ReminderLog {
  id?: string;
  companyId: string;
  appointmentId: string;
  clientId: string;
  type: 'whatsapp' | 'sms' | 'email';
  scheduledFor: Timestamp;
  sentAt?: Timestamp;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  error?: string;
  messageId?: string; // Reference to WhatsApp/SMS/Email message
  createdAt?: Timestamp;
}

// Default reminder configuration
const defaultReminderConfig: Omit<ReminderConfig, 'companyId'> = {
  enabled: true,
  channels: {
    whatsapp: true,
    sms: false,
    email: false
  },
  timing: {
    dayBefore: true,
    hoursBefore: [24, 4] // 24 hours and 4 hours before
  },
  excludeStatuses: ['cancelled', 'completed', 'no_show'],
  createdAt: serverTimestamp() as Timestamp,
  updatedAt: serverTimestamp() as Timestamp
};

class AppointmentReminderService {
  private reminderCheckInterval: NodeJS.Timeout | null = null;
  private activeListeners: Map<string, Unsubscribe> = new Map();

  // Get reminder configuration for a company
  async getReminderConfig(companyId: string, branchId?: string): Promise<ReminderConfig> {
    try {
      const docId = branchId ? `${companyId}_${branchId}` : companyId;
      const docRef = doc(db, 'reminderConfigs', docId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { ...docSnap.data(), id: docSnap.id } as ReminderConfig;
      }

      // Return default config if none exists
      const defaultConfig: ReminderConfig = {
        ...defaultReminderConfig,
        companyId
      } as ReminderConfig;
      
      // Only add branchId if it's defined
      if (branchId) {
        defaultConfig.branchId = branchId;
      }
      
      return defaultConfig;
    } catch (error) {
      console.error('Error getting reminder config:', error);
      const defaultConfig: ReminderConfig = {
        ...defaultReminderConfig,
        companyId
      } as ReminderConfig;
      
      // Only add branchId if it's defined
      if (branchId) {
        defaultConfig.branchId = branchId;
      }
      
      return defaultConfig;
    }
  }

  // Save reminder configuration
  async saveReminderConfig(config: ReminderConfig): Promise<void> {
    try {
      // Clean the config data to remove undefined fields
      const cleanConfig: any = {};
      Object.keys(config).forEach(key => {
        if (config[key as keyof ReminderConfig] !== undefined) {
          cleanConfig[key] = config[key as keyof ReminderConfig];
        }
      });

      const configData = {
        ...cleanConfig,
        updatedAt: serverTimestamp()
      };

      if (config.id) {
        // For updates, remove the id from the data
        const { id, ...updateData } = configData;
        await updateDoc(doc(db, 'reminderConfigs', config.id), updateData);
      } else {
        await addDoc(collection(db, 'reminderConfigs'), {
          ...configData,
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error('Error saving reminder config:', error);
      throw error;
    }
  }

  // Schedule reminders for an appointment
  async scheduleReminders(appointment: Appointment): Promise<void> {
    try {
      const config = await this.getReminderConfig(appointment.companyId, appointment.branchId);
      
      if (!config.enabled) {
        return;
      }

      // Don't schedule reminders for excluded statuses
      if (config.excludeStatuses.includes(appointment.status)) {
        return;
      }

      const appointmentDate = appointment.date.toDate();
      const now = new Date();

      // Schedule reminders based on configuration
      const reminderTimes: Array<{ time: Date; type: string }> = [];

      // Day before reminder
      if (config.timing.dayBefore) {
        const dayBefore = addDays(appointmentDate, -1);
        if (isAfter(dayBefore, now)) {
          reminderTimes.push({ time: dayBefore, type: '1 day before' });
        }
      }

      // Hours before reminders
      for (const hours of config.timing.hoursBefore) {
        const timeBefore = addHours(appointmentDate, -hours);
        if (isAfter(timeBefore, now)) {
          reminderTimes.push({ time: timeBefore, type: `${hours} hours before` });
        }
      }

      // Custom time reminders
      if (config.timing.customTimes) {
        for (const custom of config.timing.customTimes) {
          let timeBefore: Date;
          switch (custom.unit) {
            case 'minutes':
              timeBefore = new Date(appointmentDate.getTime() - custom.value * 60 * 1000);
              break;
            case 'hours':
              timeBefore = addHours(appointmentDate, -custom.value);
              break;
            case 'days':
              timeBefore = addDays(appointmentDate, -custom.value);
              break;
          }
          
          if (isAfter(timeBefore, now)) {
            reminderTimes.push({ time: timeBefore, type: `${custom.value} ${custom.unit} before` });
          }
        }
      }

      // Create reminder logs for each scheduled time
      for (const reminder of reminderTimes) {
        // Check if reminder already exists
        const existingReminders = await getDocs(
          query(
            collection(db, 'reminderLogs'),
            where('appointmentId', '==', appointment.id),
            where('scheduledFor', '==', Timestamp.fromDate(reminder.time))
          )
        );

        if (existingReminders.empty) {
          // Create reminder logs for each enabled channel
          if (config.channels.whatsapp) {
            await this.createReminderLog({
              companyId: appointment.companyId,
              appointmentId: appointment.id!,
              clientId: appointment.clientId,
              type: 'whatsapp',
              scheduledFor: Timestamp.fromDate(reminder.time),
              status: 'pending'
            });
          }

          if (config.channels.sms) {
            await this.createReminderLog({
              companyId: appointment.companyId,
              appointmentId: appointment.id!,
              clientId: appointment.clientId,
              type: 'sms',
              scheduledFor: Timestamp.fromDate(reminder.time),
              status: 'pending'
            });
          }

          if (config.channels.email) {
            await this.createReminderLog({
              companyId: appointment.companyId,
              appointmentId: appointment.id!,
              clientId: appointment.clientId,
              type: 'email',
              scheduledFor: Timestamp.fromDate(reminder.time),
              status: 'pending'
            });
          }
        }
      }
    } catch (error) {
      console.error('Error scheduling reminders:', error);
      throw error;
    }
  }

  // Create reminder log
  private async createReminderLog(log: Omit<ReminderLog, 'id' | 'createdAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'reminderLogs'), {
        ...log,
        createdAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating reminder log:', error);
      throw error;
    }
  }

  // Process pending reminders
  async processPendingReminders(): Promise<void> {
    try {
      const now = new Date();
      
      // Query for pending reminders that should be sent now
      const pendingReminders = await getDocs(
        query(
          collection(db, 'reminderLogs'),
          where('status', '==', 'pending'),
          where('scheduledFor', '<=', Timestamp.fromDate(now))
        )
      );

      for (const doc of pendingReminders.docs) {
        const reminder = { ...doc.data(), id: doc.id } as ReminderLog;
        
        try {
          // Get appointment details
          const appointment = await appointmentService.getAppointment(reminder.appointmentId);
          if (!appointment) {
            throw new Error('Appointment not found');
          }

          // Check if appointment status has changed
          const config = await this.getReminderConfig(reminder.companyId);
          if (config.excludeStatuses.includes(appointment.status)) {
            await this.updateReminderStatus(reminder.id!, 'cancelled');
            continue;
          }

          // Send reminder based on type
          switch (reminder.type) {
            case 'whatsapp':
              await this.sendWhatsAppReminder(appointment, reminder);
              break;
            case 'sms':
              // TODO: Implement SMS reminder
              console.log('SMS reminder not implemented yet');
              break;
            case 'email':
              // TODO: Implement email reminder
              console.log('Email reminder not implemented yet');
              break;
          }

          // Update reminder status
          await this.updateReminderStatus(reminder.id!, 'sent');
        } catch (error) {
          console.error('Error processing reminder:', error);
          await this.updateReminderStatus(
            reminder.id!, 
            'failed', 
            error instanceof Error ? error.message : 'Unknown error'
          );
        }
      }
    } catch (error) {
      console.error('Error processing pending reminders:', error);
    }
  }

  // Send WhatsApp reminder
  private async sendWhatsAppReminder(appointment: Appointment, reminder: ReminderLog): Promise<void> {
    try {
      // Get client details
      const client = await clientService.getClient(appointment.clientId);
      if (!client) {
        throw new Error('Client not found');
      }

      // Get staff details
      const staff = appointment.staffId ? await staffService.getStaffMember(appointment.staffId) : null;

      // Get service details
      let serviceName = 'Service';
      if (appointment.services && appointment.services.length > 0) {
        const service = await serviceService.getService(appointment.services[0]);
        if (service) {
          serviceName = service.name;
        }
      }

      // Get business details
      const locationSettings = await locationService.getLocationSettings(appointment.companyId, appointment.branchId);
      const businessName = locationSettings?.basic?.businessName || 
                          locationSettings?.basic?.locationName || 
                          'Our Business';
      const businessPhone = locationSettings?.contact?.phones?.[0] 
        ? `${locationSettings.contact.phones[0].countryCode}${locationSettings.contact.phones[0].number}`
        : '';

      // Calculate reminder time text
      const appointmentDate = appointment.date.toDate();
      const now = new Date();
      const hoursUntil = Math.round((appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60));
      
      let reminderTime: string;
      if (hoursUntil >= 24) {
        const days = Math.round(hoursUntil / 24);
        reminderTime = days === 1 ? 'غداً' : `بعد ${days} أيام`;
      } else {
        reminderTime = `بعد ${hoursUntil} ساعات`;
      }

      // Send WhatsApp reminder
      const messageId = await whatsAppService.sendAppointmentReminder(appointment.companyId, {
        appointmentId: appointment.id!,
        clientId: appointment.clientId,
        clientName: client.name,
        clientPhone: client.primaryPhone || client.phoneNumbers?.[0]?.number || '',
        date: appointmentDate,
        time: appointment.time || appointmentDate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        service: serviceName,
        businessName,
        reminderTime,
        language: 'ar' // TODO: Get from client preferences
      });

      // Update reminder log with message ID
      await updateDoc(doc(db, 'reminderLogs', reminder.id!), {
        messageId,
        sentAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error sending WhatsApp reminder:', error);
      throw error;
    }
  }

  // Update reminder status
  private async updateReminderStatus(
    reminderId: string, 
    status: 'sent' | 'failed' | 'cancelled',
    error?: string
  ): Promise<void> {
    try {
      const updateData: any = {
        status,
        updatedAt: serverTimestamp()
      };

      if (status === 'sent') {
        updateData.sentAt = serverTimestamp();
      } else if (status === 'failed' && error) {
        updateData.error = error;
      }

      await updateDoc(doc(db, 'reminderLogs', reminderId), updateData);
    } catch (error) {
      console.error('Error updating reminder status:', error);
      throw error;
    }
  }

  // Cancel reminders for an appointment
  async cancelReminders(appointmentId: string): Promise<void> {
    try {
      const reminders = await getDocs(
        query(
          collection(db, 'reminderLogs'),
          where('appointmentId', '==', appointmentId),
          where('status', '==', 'pending')
        )
      );

      for (const doc of reminders.docs) {
        await this.updateReminderStatus(doc.id, 'cancelled');
      }
    } catch (error) {
      console.error('Error cancelling reminders:', error);
      throw error;
    }
  }

  // Start reminder processing (should be called on app initialization)
  startReminderProcessing(intervalMinutes: number = 5): void {
    // Clear existing interval if any
    if (this.reminderCheckInterval) {
      clearInterval(this.reminderCheckInterval);
    }

    // Process immediately
    this.processPendingReminders();

    // Set up interval for regular processing
    this.reminderCheckInterval = setInterval(() => {
      this.processPendingReminders();
    }, intervalMinutes * 60 * 1000);
  }

  // Stop reminder processing
  stopReminderProcessing(): void {
    if (this.reminderCheckInterval) {
      clearInterval(this.reminderCheckInterval);
      this.reminderCheckInterval = null;
    }
  }

  // Listen to appointment changes for a company
  listenToAppointments(companyId: string): Unsubscribe {
    const today = startOfDay(new Date());
    const future = addDays(today, 30); // Listen to appointments for next 30 days

    const unsubscribe = onSnapshot(
      query(
        collection(db, 'appointments'),
        where('companyId', '==', companyId),
        where('date', '>=', Timestamp.fromDate(today)),
        where('date', '<=', Timestamp.fromDate(future))
      ),
      async (snapshot) => {
        for (const change of snapshot.docChanges()) {
          if (change.type === 'added' || change.type === 'modified') {
            const appointment = { ...change.doc.data(), id: change.doc.id } as Appointment;
            await this.scheduleReminders(appointment);
          }
        }
      },
      (error) => {
        console.error('Error listening to appointments:', error);
      }
    );

    // Store unsubscribe function
    this.activeListeners.set(companyId, unsubscribe);
    return unsubscribe;
  }

  // Stop listening to a company's appointments
  stopListening(companyId: string): void {
    const unsubscribe = this.activeListeners.get(companyId);
    if (unsubscribe) {
      unsubscribe();
      this.activeListeners.delete(companyId);
    }
  }

  // Stop all listeners
  stopAllListeners(): void {
    for (const unsubscribe of this.activeListeners.values()) {
      unsubscribe();
    }
    this.activeListeners.clear();
  }
}

export const appointmentReminderService = new AppointmentReminderService();