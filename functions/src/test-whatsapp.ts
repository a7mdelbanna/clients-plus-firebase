import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

// Test function to manually trigger WhatsApp notification
export const testWhatsAppNotification = functions.https.onCall(async (data: any, context: any) => {
  console.log('=== TEST WHATSAPP NOTIFICATION ===');
  console.log('Data received:', data);
  
  const { appointmentId, companyId } = data;
  
  if (!appointmentId || !companyId) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing appointmentId or companyId');
  }
  
  try {
    // Get the appointment
    const appointmentDoc = await db.collection('appointments').doc(appointmentId).get();
    if (!appointmentDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Appointment not found');
    }
    
    const appointment = appointmentDoc.data()!;
    console.log('Appointment data:', appointment);
    
    // Get WhatsApp config
    const whatsappConfig = await db.collection('whatsappConfigs').doc(companyId).get();
    console.log('WhatsApp config exists:', whatsappConfig.exists);
    console.log('WhatsApp config data:', whatsappConfig.data());
    
    if (!whatsappConfig.exists) {
      return {
        success: false,
        error: 'WhatsApp config not found',
        details: {
          companyId,
          configChecked: 'whatsappConfigs/' + companyId
        }
      };
    }
    
    const config = whatsappConfig.data()!;
    if (!config.enabled) {
      return {
        success: false,
        error: 'WhatsApp is not enabled',
        details: {
          enabled: config.enabled,
          provider: config.provider
        }
      };
    }
    
    // Get client info
    let clientPhone = appointment.clientPhone;
    if (appointment.clientId && appointment.clientId !== 'guest') {
      const clientDoc = await db.collection('clients').doc(appointment.clientId).get();
      if (clientDoc.exists) {
        const client = clientDoc.data()!;
        clientPhone = client.primaryPhone || client.phone || client.phoneNumbers?.[0]?.number || appointment.clientPhone;
      }
    }
    
    // Get service name
    let serviceName = 'Service';
    if (appointment.services && appointment.services.length > 0) {
      if (appointment.services[0].serviceName) {
        serviceName = appointment.services.map((s: any) => s.serviceName).join(', ');
      }
    }
    
    // Get business details
    const branchId = appointment.branchId || 'main';
    const locationId = branchId === 'main' ? `${companyId}_main` : `${companyId}_${branchId}`;
    const locationDoc = await db.collection('locationSettings').doc(locationId).get();
    
    const businessName = locationDoc.data()?.basic?.businessName || 'Our Business';
    const businessAddress = locationDoc.data()?.contact?.address?.formatted || '';
    const businessPhone = locationDoc.data()?.contact?.primaryPhone?.number || '';
    
    // Format phone number
    const formatPhoneNumber = (phone: string) => {
      let cleaned = phone.replace(/[^\d+]/g, '');
      if (cleaned.startsWith('+')) return cleaned;
      cleaned = cleaned.replace(/^0+/, '');
      if (!cleaned.startsWith('20')) cleaned = '20' + cleaned;
      return '+' + cleaned;
    };
    
    const formattedPhone = formatPhoneNumber(clientPhone);
    
    // Prepare message data
    const messageData = {
      messageId: `test-${appointmentId}-${Date.now()}`,
      companyId,
      config: {
        provider: config.provider,
        accountSid: config.accountSid,
        authToken: config.authToken,
        fromNumber: config.twilioWhatsAppNumber || config.fromNumber
      },
      message: {
        to: formattedPhone,
        type: 'appointment_confirmation',
        parameters: {
          appointmentId,
          clientId: appointment.clientId,
          clientName: appointment.clientName,
          clientPhone: formattedPhone,
          date: appointment.date.toDate().toLocaleDateString('ar-EG'),
          time: appointment.startTime || appointment.time,
          service: serviceName,
          staffName: appointment.staffName || 'الفريق',
          businessName,
          businessAddress,
          businessPhone,
          language: 'ar'
        }
      }
    };
    
    console.log('Message data prepared:', JSON.stringify(messageData, null, 2));
    
    // Call the sendWhatsAppMessage function
    const { sendWhatsAppMessage } = await import('./whatsapp');
    const sendFunction = sendWhatsAppMessage as any;
    
    const result = await sendFunction({ data: messageData }, { auth: { uid: 'test' } });
    console.log('Send result:', result);
    
    return {
      success: true,
      result,
      details: {
        appointmentId,
        companyId,
        phone: formattedPhone,
        configProvider: config.provider,
        hasCredentials: !!config.accountSid && !!config.authToken
      }
    };
    
  } catch (error) {
    console.error('Test WhatsApp error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: {
        appointmentId,
        companyId
      }
    };
  }
});