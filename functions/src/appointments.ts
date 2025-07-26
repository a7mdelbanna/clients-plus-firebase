import * as functionsV1 from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

const db = admin.firestore();

// Trigger function for new appointments created through online booking
export const onAppointmentCreated = functionsV1.firestore
  .document('appointments/{appointmentId}')
  .onCreate(async (snap: any, context: any) => {
    // Temporarily disabled to debug booking app issue
    return;
    
    /*
    const appointment = snap.data();
    const appointmentId = context.params.appointmentId;
    
    console.log(`New appointment created: ${appointmentId}`, appointment);
    
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
                               `${locationSettings.contact.address.street || ''}, ${locationSettings.contact.address.city || ''}`.trim() : 
                               '');
                               
      const businessPhone = locationSettings?.contact?.primaryPhone?.number || 
                           locationSettings?.contact?.phone ||
                           company?.phone || 
                           '';
      
      // Create Google Maps link if we have coordinates
      let googleMapsLink = '';
      if (locationSettings?.contact?.coordinates?.lat && locationSettings?.contact?.coordinates?.lng) {
        const { lat, lng } = locationSettings.contact.coordinates;
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
      if (!whatsappConfig.exists || !whatsappConfig.data()?.isActive) {
        console.log('WhatsApp not configured or inactive for company:', appointment.companyId);
        return;
      }
      
      const config = whatsappConfig.data()!;
      
      // Send WhatsApp notification using the Cloud Function
      const clientPhone = client?.primaryPhone || client?.phone || 
                         client?.phoneNumbers?.[0]?.number || appointment.clientPhone;
                         
      console.log('Sending WhatsApp confirmation to:', clientPhone);
      
      const messageData = {
        messageId: `apt-${appointmentId}-confirm`,
        companyId: appointment.companyId,
        config: {
          provider: config.provider,
          accountSid: config.accountSid,
          authToken: config.authToken,
          fromNumber: config.fromNumber
        },
        message: {
          to: clientPhone,
          type: 'appointment_confirmation',
          parameters: {
            appointmentId,
            clientId: appointment.clientId,
            clientName: appointment.clientName,
            clientPhone: clientPhone,
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
          }
        }
      };
      
      // Call the sendWhatsAppMessage function
      const { sendWhatsAppMessage } = await import('./whatsapp');
      const sendFunction = sendWhatsAppMessage as any;
      
      // Create a mock context for the callable function
      const mockContext = {
        auth: { uid: 'system' }
      };
      
      const result = await sendFunction({ data: messageData }, mockContext);
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
    */
  });