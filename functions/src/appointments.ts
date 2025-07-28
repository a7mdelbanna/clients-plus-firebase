import * as functionsV1 from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

const db = admin.firestore();

// Format phone number for WhatsApp (must include country code)
function formatPhoneNumber(phone: string, countryCode: string = '20'): string {
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

// Trigger function for new appointments created through online booking
export const onAppointmentCreated = functionsV1.firestore
  .document('appointments/{appointmentId}')
  .onCreate(async (snap: any, context: any) => {
    const appointment = snap.data();
    const appointmentId = context.params.appointmentId;
    
    console.log(`New appointment created: ${appointmentId}`, appointment);
    
    // Skip this function - WhatsApp is now handled directly in the booking app
    console.log('Skipping - WhatsApp notifications are now handled in the booking app');
    return;
    
    // Only process online bookings that have notifications configured
    if (appointment.source !== 'online' || !appointment.notifications || appointment.notifications.length === 0) {
      console.log('Skipping - not an online booking or no notifications configured');
      return;
    }
    
    // Find confirmation notification
    const confirmationNotif = appointment.notifications.find((n: any) => n.type === 'confirmation');
    if (!confirmationNotif || !confirmationNotif.method.includes('whatsapp')) {
      console.log('No WhatsApp confirmation notification configured');
      return;
    }
    
    try {
      // Get company data for business details
      const companyDoc = await db.collection('companies').doc(appointment.companyId).get();
      if (!companyDoc.exists) {
        console.error('Company not found:', appointment.companyId);
        return;
      }
      const company = companyDoc.data();
      
      // Get location settings for the branch
      const branchId = appointment.branchId || 'main';
      const locationId = branchId === 'main' ? `${appointment.companyId}_main` : `${appointment.companyId}_${branchId}`;
      const locationDoc = await db.collection('locationSettings').doc(locationId).get();
      const locationSettings = locationDoc.exists ? locationDoc.data() : null;
      
      // Get client info if clientId exists
      let client: any = null;
      if (appointment.clientId && appointment.clientId !== 'guest') {
        const clientDoc = await db.collection('clients').doc(appointment.clientId).get();
        if (clientDoc.exists) {
          client = clientDoc.data();
        }
      }
      
      // Extract business information
      const businessName = locationSettings?.basic?.businessName || 
                          locationSettings?.basic?.locationName || 
                          company?.businessName || 
                          company?.name || 
                          'Our Business';
                          
      const businessAddress = locationSettings?.contact?.address?.formatted ||
                             (locationSettings?.contact?.address ? 
                               `${locationSettings?.contact?.address?.street || ''}, ${locationSettings?.contact?.address?.city || ''}`.trim() : 
                               '');
                               
      const businessPhone = locationSettings?.contact?.primaryPhone?.number || 
                           locationSettings?.contact?.phone ||
                           company?.phone || 
                           '';
      
      // Create Google Maps link if we have coordinates
      let googleMapsLink = '';
      if (locationSettings?.contact?.coordinates?.lat && locationSettings?.contact?.coordinates?.lng) {
        const { lat, lng } = locationSettings?.contact?.coordinates || { lat: 0, lng: 0 };
        googleMapsLink = `https://maps.google.com/?q=${lat},${lng}`;
      }
      
      // Get service name
      let serviceName = 'خدمة';
      if (appointment.services && appointment.services.length > 0) {
        if (Array.isArray(appointment.services[0])) {
          // Handle old format where services is array of IDs
          serviceName = appointment.services.join(', ');
        } else if (appointment.services[0].serviceName) {
          // Handle new format where services have names
          serviceName = appointment.services.map((s: any) => s.serviceName).join(', ');
        } else {
          serviceName = appointment.services.length + ' خدمات';
        }
      }
      
      // Get WhatsApp config
      const whatsappConfig = await db.collection('whatsappConfigs').doc(appointment.companyId).get();
      if (!whatsappConfig.exists || !whatsappConfig.data()?.enabled) {
        console.log('WhatsApp not configured or not enabled for company:', appointment.companyId);
        return;
      }
      
      const config = whatsappConfig.data()!;
      
      // Send WhatsApp notification using the same pattern as dashboard
      const clientPhone = client?.primaryPhone || client?.phone || 
                         client?.phoneNumbers?.[0]?.number || appointment.clientPhone;
                         
      console.log('Sending WhatsApp confirmation to:', clientPhone);
      
      // Format phone number
      const formattedPhone = formatPhoneNumber(clientPhone);
      console.log('Formatted phone:', formattedPhone);
      
      // 1. First save the message to Firestore (like dashboard does)
      const messageData = {
        companyId: appointment.companyId,
        clientId: appointment.clientId,
        appointmentId: appointmentId,
        to: formattedPhone,
        type: 'appointment_confirmation' as const,
        templateName: 'appointment_confirmation',
        templateLanguage: 'ar' as const,
        parameters: {
          appointmentId,
          clientId: appointment.clientId,
          clientName: appointment.clientName,
          clientPhone: formattedPhone,
          date: appointment.date.toDate().toLocaleDateString('ar-EG', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }),
          time: appointment.startTime || appointment.time,
          service: serviceName,
          staffName: appointment.staffName || 'الفريق',
          businessName,
          businessAddress,
          businessPhone,
          googleMapsLink,
          language: 'ar'
        },
        status: 'pending' as const,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      console.log('Saving WhatsApp message to Firestore...');
      const messageRef = await db
        .collection('companies')
        .doc(appointment.companyId)
        .collection('whatsappMessages')
        .add(messageData);
      
      console.log('Message saved with ID:', messageRef.id);
      
      // 2. Now call the sendWhatsAppMessage function with the message ID
      const { sendWhatsAppMessage } = await import('./whatsapp');
      const sendFunction = sendWhatsAppMessage as any;
      
      const functionData = {
        messageId: messageRef.id,
        companyId: appointment.companyId,
        config,
        message: {
          ...messageData,
          id: messageRef.id
        }
      };
      
      console.log('Calling sendWhatsAppMessage function...');
      
      // Create a mock context for the callable function
      const mockContext = {
        auth: { uid: 'system' }
      };
      
      const result = await sendFunction({ data: functionData }, mockContext);
      console.log('WhatsApp send result:', result);
      
      // Update notification status
      const notifications = appointment.notifications;
      const notifIndex = notifications.findIndex((n: any) => n.type === 'confirmation');
      if (notifIndex >= 0) {
        notifications[notifIndex].sent = true;
        notifications[notifIndex].sentAt = admin.firestore.Timestamp.now();
      }
      
      await snap.ref.update({
        notifications,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log('WhatsApp confirmation sent successfully for appointment:', appointmentId);
      
    } catch (error) {
      console.error('Error sending WhatsApp notification for appointment:', appointmentId, error);
    }
  });