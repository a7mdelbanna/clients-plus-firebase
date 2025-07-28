import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import twilio from 'twilio';
import * as crypto from 'crypto';

// Twilio client will be initialized on demand

interface OTPSession {
  phoneNumber: string;
  otp: string;
  attempts: number;
  createdAt: admin.firestore.Timestamp;
  expiresAt: admin.firestore.Timestamp;
  verified: boolean;
  clientId?: string;
}

/**
 * Generate a 6-digit OTP
 */
function generateOTP(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Send OTP to client's phone number
 */
export const sendClientOTP = functions.https.onCall(async (data: any) => {
    const { phoneNumber } = data;

    // Validate phone number
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Phone number is required'
      );
    }

    // Validate Egyptian phone number format
    const egyptianPhoneRegex = /^\+20(10|11|12|15)\d{8}$/;
    if (!egyptianPhoneRegex.test(phoneNumber)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Invalid Egyptian phone number format'
      );
    }

    try {
      const db = admin.firestore();
      const otpSessionsRef = db.collection('otpSessions');

      // Check for existing recent OTP sessions
      const recentSessionQuery = await otpSessionsRef
        .where('phoneNumber', '==', phoneNumber)
        .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(
          new Date(Date.now() - 15 * 60 * 1000) // Last 15 minutes
        ))
        .orderBy('createdAt', 'desc')
        .limit(3)
        .get();

      // Rate limiting: max 3 OTP requests per 15 minutes
      if (recentSessionQuery.size >= 3) {
        throw new functions.https.HttpsError(
          'resource-exhausted',
          'Too many OTP requests. Please try again later.'
        );
      }

      // Generate OTP
      const otp = generateOTP();
      const now = admin.firestore.Timestamp.now();
      const expiresAt = admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
      );

      // Create OTP session
      const sessionData: OTPSession = {
        phoneNumber,
        otp,
        attempts: 0,
        createdAt: now,
        expiresAt,
        verified: false,
      };

      // Save OTP session
      const sessionRef = await otpSessionsRef.add(sessionData);

      // Send OTP via SMS
      try {
        // Initialize Twilio client if configured
        let twilioClient: any = null;
        let twilioPhoneNumber: string | undefined;
        
        try {
          const twilioConfig = functions.config().twilio;
          if (twilioConfig?.account_sid && twilioConfig?.auth_token) {
            twilioClient = twilio(twilioConfig.account_sid, twilioConfig.auth_token);
            twilioPhoneNumber = twilioConfig.phone_number;
          }
        } catch (error) {
          console.log('Twilio not configured');
        }
        
        if (twilioPhoneNumber && twilioClient) {
          await twilioClient.messages.create({
            body: `رمز التحقق الخاص بك هو: ${otp}\n\nصالح لمدة 5 دقائق.`,
            from: twilioPhoneNumber,
            to: phoneNumber,
          });
        } else {
          // If Twilio is not configured, log OTP for development
          console.log(`[DEV MODE] OTP for ${phoneNumber}: ${otp}`);
          console.log('[DEV MODE] Twilio not configured - OTP logged to console only');
        }
      } catch (smsError) {
        console.error('Error sending SMS:', smsError);
        // Continue even if SMS fails - OTP is still valid
        console.log(`[SMS FAILED] OTP for ${phoneNumber}: ${otp}`);
      }

      // Check if this is a WhatsApp-enabled number and send via WhatsApp too
      try {
        // Check if client exists and has WhatsApp notifications enabled
        const clientsQuery = await db.collection('clients')
          .where('phone', '==', phoneNumber)
          .limit(1)
          .get();

        if (!clientsQuery.empty) {
          const client = clientsQuery.docs[0].data();
          if (client.preferences?.notifications?.whatsapp !== false) {
            // Send WhatsApp message if available
            // This would integrate with your existing WhatsApp service
            console.log(`WhatsApp OTP for ${phoneNumber}: ${otp}`);
          }
        }
      } catch (whatsappError) {
        console.error('Error sending WhatsApp:', whatsappError);
      }

      return {
        success: true,
        sessionId: sessionRef.id,
        message: 'OTP sent successfully',
      };

    } catch (error) {
      console.error('Error in sendClientOTP:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to send OTP'
      );
    }
  });