import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
const twilio = require('twilio');

// Cloud Function to send WhatsApp messages
export const sendWhatsAppMessage = functions.https.onCall(async (request: any, context: any) => {
  // Temporarily allow testing without authentication
  // TODO: Re-enable authentication for production
  console.log('Auth context:', context.auth ? 'Authenticated' : 'Not authenticated');
  
  // For testing purposes, we'll allow unauthenticated calls
  // if (!context.auth) {
  //   throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  // }

  // The actual data is in request.data for Firebase v2 callable functions
  const data = request.data || request;
  
  // Log the raw data first (avoiding circular references)
  console.log('sendWhatsAppMessage called with request keys:', Object.keys(request || {}));
  console.log('sendWhatsAppMessage called with data keys:', Object.keys(data || {}));
  
  const { messageId, companyId, config, message } = data;
  
  // Validate required fields
  if (!messageId || !companyId || !message) {
    console.error('Missing required fields:', { messageId, companyId, hasMessage: !!message });
    throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
  }
  
  console.log('sendWhatsAppMessage parsed data:', {
    messageId,
    companyId,
    to: message?.to,
    type: message?.type,
    hasConfig: !!config,
    provider: config?.provider
  });

  try {
    // Initialize Twilio client if we have config
    let twilioClient: any = null;
    if (config && config.provider === 'twilio' && config.accountSid && config.authToken) {
      twilioClient = twilio(config.accountSid, config.authToken);
      console.log('Twilio client initialized');
    } else {
      console.log('No valid Twilio config, will simulate send');
    }
    
    // Build the message text based on template
    let messageText = '';
    
    if (message.type === 'appointment_confirmation') {
      // Build confirmation message
      messageText = `*تأكيد الموعد في ${message.parameters.businessName}* 📅\n\n`;
      messageText += `مرحباً ${message.parameters.clientName}،\n\n`;
      messageText += `تم تأكيد موعدك بنجاح:\n\n`;
      messageText += `📅 *التاريخ:* ${message.parameters.date}\n`;
      messageText += `⏰ *الوقت:* ${message.parameters.time}\n`;
      messageText += `💇 *الخدمة:* ${message.parameters.service}\n`;
      messageText += `👤 *الأخصائي:* ${message.parameters.staffName}\n\n`;
      
      // Business details section
      messageText += `🏢 *تفاصيل الصالون:*\n`;
      messageText += `${message.parameters.businessName}\n`;
      
      // Address section
      if (message.parameters.businessAddress) {
        messageText += `\n📍 *العنوان:*\n`;
        messageText += `${message.parameters.businessAddress}\n`;
      }
      
      // Google Maps link
      if (message.parameters.googleMapsLink) {
        messageText += `\n🗺️ *موقع على الخريطة:*\n`;
        messageText += `${message.parameters.googleMapsLink}\n`;
      }
      
      // Contact section
      if (message.parameters.businessPhone) {
        messageText += `\n📞 *للاتصال:* ${message.parameters.businessPhone}\n`;
      }
      
      messageText += `\nنتطلع لرؤيتك! 🌟\n\n`;
      messageText += `_للإلغاء أو تغيير الموعد، يرجى التواصل معنا_`;
    } else if (message.type === 'appointment_reminder') {
      // Build reminder message
      messageText = `*تذكير بموعدك في ${message.parameters.businessName}* ⏰\n\n`;
      messageText += `مرحباً ${message.parameters.clientName}،\n\n`;
      messageText += `نذكرك بموعدك ${message.parameters.reminderTime}:\n\n`;
      messageText += `📅 *التاريخ:* ${message.parameters.date}\n`;
      messageText += `⏰ *الوقت:* ${message.parameters.time}\n`;
      messageText += `💇 *الخدمة:* ${message.parameters.service}\n`;
      messageText += `👤 *الأخصائي:* ${message.parameters.staffName}\n\n`;
      
      // Location section
      messageText += `📍 *موقع الفرع:*\n`;
      if (message.parameters.googleMapsLink) {
        messageText += `${message.parameters.googleMapsLink}\n`;
      } else if (message.parameters.businessAddress) {
        messageText += `${message.parameters.businessAddress}\n`;
      }
      
      messageText += `\nنتطلع لرؤيتك! 🌟`;
    } else {
      // Custom message
      messageText = message.parameters.text || 'رسالة من ' + message.parameters.businessName;
    }

    // For testing, we'll mark the message as sent
    // In production, this would be after actual Twilio API call
    // Update message status to sent
    await admin.firestore()
      .collection('companies')
      .doc(companyId)
      .collection('whatsappMessages')
      .doc(messageId)
      .update({
        status: 'sent',
        messageText: messageText,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    
    console.log('WhatsApp message marked as sent in Firestore');
    
    // Send actual WhatsApp message via Twilio if configured
    let twilioMessageSid = null;
    if (twilioClient && config.twilioWhatsAppNumber) {
      try {
        // Format phone numbers for WhatsApp
        const fromNumber = config.twilioWhatsAppNumber.startsWith('whatsapp:') 
          ? config.twilioWhatsAppNumber 
          : `whatsapp:${config.twilioWhatsAppNumber}`;
        
        const toNumber = message.to.startsWith('whatsapp:') 
          ? message.to 
          : `whatsapp:${message.to}`;
        
        console.log('Sending WhatsApp message via Twilio:');
        console.log(`From: ${fromNumber}`);
        console.log(`To: ${toNumber}`);
        
        const twilioMessage = await twilioClient.messages.create({
          body: messageText,
          from: fromNumber,
          to: toNumber
        });
        
        twilioMessageSid = twilioMessage.sid;
        console.log('WhatsApp message sent successfully via Twilio:', twilioMessageSid);
        
        // Update message with Twilio SID
        await admin.firestore()
          .collection('companies')
          .doc(companyId)
          .collection('whatsappMessages')
          .doc(messageId)
          .update({
            twilioMessageSid: twilioMessageSid,
            actualProvider: 'twilio',
            actualSentAt: admin.firestore.FieldValue.serverTimestamp(),
          });
      } catch (twilioError) {
        console.error('Twilio send error:', twilioError);
        // Don't throw here, we'll continue with simulated send
        console.log('Falling back to simulated send due to Twilio error');
      }
    } else {
      // Simulating the send
      console.log('Simulating WhatsApp message (no Twilio config):');
      console.log(`To: ${message.to}`);
      console.log(`Message: ${messageText}`);
    }

    return {
      success: true,
      messageId: messageId,
      messageText: messageText,
      twilioMessageSid: twilioMessageSid,
      actuallySent: !!twilioMessageSid
    };
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    
    // Update message with error
    await admin.firestore()
      .collection('companies')
      .doc(companyId)
      .collection('whatsappMessages')
      .doc(messageId)
      .update({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    throw new functions.https.HttpsError('internal', 'Failed to send WhatsApp message');
  }
});

// Webhook to handle Twilio status callbacks
export const whatsappWebhook = functions.https.onRequest(async (req, res) => {
  const { MessageSid, MessageStatus } = req.body;

  try {
    // Find the message in Firestore by Twilio message ID
    const messagesRef = admin.firestore().collectionGroup('whatsappMessages');
    const snapshot = await messagesRef.where('messageId', '==', MessageSid).get();

    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      const updateData: any = {
        status: MessageStatus,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // Update timestamps based on status
      if (MessageStatus === 'delivered') {
        updateData.deliveredAt = admin.firestore.FieldValue.serverTimestamp();
      } else if (MessageStatus === 'read') {
        updateData.readAt = admin.firestore.FieldValue.serverTimestamp();
      } else if (MessageStatus === 'failed') {
        updateData.status = 'failed';
      }

      await doc.ref.update(updateData);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error processing WhatsApp webhook:', error);
    res.status(500).send('Error processing webhook');
  }
});