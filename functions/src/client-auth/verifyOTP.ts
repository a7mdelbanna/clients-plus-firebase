import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = functions.config().jwt?.secret || 'your-secret-key';

interface ClientData {
  id: string;
  name: string;
  phone: string;
  email?: string;
  companyId: string;
}

/**
 * Verify OTP and create client session
 */
export const verifyClientOTP = functions.https.onCall(async (data: any) => {
    const { phoneNumber, otp } = data;

    // Validate input
    if (!phoneNumber || !otp || typeof phoneNumber !== 'string' || typeof otp !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Phone number and OTP are required'
      );
    }

    // Validate OTP format (6 digits)
    if (!/^\d{6}$/.test(otp)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Invalid OTP format'
      );
    }

    try {
      const db = admin.firestore();
      const otpSessionsRef = db.collection('otpSessions');

      // Find the most recent OTP session for this phone number
      const sessionQuery = await otpSessionsRef
        .where('phoneNumber', '==', phoneNumber)
        .where('verified', '==', false)
        .where('expiresAt', '>', admin.firestore.Timestamp.now())
        .orderBy('expiresAt', 'desc')
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      if (sessionQuery.empty) {
        throw new functions.https.HttpsError(
          'not-found',
          'No valid OTP session found. Please request a new OTP.'
        );
      }

      const sessionDoc = sessionQuery.docs[0];
      const sessionData = sessionDoc.data();

      // Check if max attempts exceeded
      if (sessionData.attempts >= 3) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Maximum verification attempts exceeded. Please request a new OTP.'
        );
      }

      // Increment attempts
      await sessionDoc.ref.update({
        attempts: admin.firestore.FieldValue.increment(1),
      });

      // Verify OTP
      if (sessionData.otp !== otp) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Invalid OTP. Please try again.'
        );
      }

      // Mark session as verified
      await sessionDoc.ref.update({
        verified: true,
        verifiedAt: admin.firestore.Timestamp.now(),
      });

      // Find or create client
      let clientData: ClientData | null = null;
      
      // Search for client by phone number across all companies
      const clientsQuery = await db.collection('clients')
        .where('phone', '==', phoneNumber)
        .limit(1)
        .get();

      if (!clientsQuery.empty) {
        const clientDoc = clientsQuery.docs[0];
        const client = clientDoc.data();
        
        clientData = {
          id: clientDoc.id,
          name: client.name || 'عميل',
          phone: client.phone,
          email: client.email,
          companyId: client.companyId,
        };

        // Update session with client ID
        await sessionDoc.ref.update({
          clientId: clientDoc.id,
        });
      } else {
        // No client found - they might be trying to access appointments
        // created before they were added as a client
        throw new functions.https.HttpsError(
          'not-found',
          'No client account found for this phone number.'
        );
      }

      // Generate JWT token
      const token = jwt.sign(
        {
          clientId: clientData.id,
          phoneNumber: clientData.phone,
          companyId: clientData.companyId,
        },
        JWT_SECRET,
        {
          expiresIn: '24h',
          issuer: 'clients-plus',
          audience: 'client-portal',
        }
      );

      // Create session response
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      return {
        success: true,
        session: {
          clientId: clientData.id,
          phoneNumber: clientData.phone,
          name: clientData.name,
          token,
          expiresAt: expiresAt.toISOString(),
        },
      };

    } catch (error) {
      console.error('Error in verifyClientOTP:', error);
      
      // Re-throw if it's already an HttpsError
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      
      throw new functions.https.HttpsError(
        'internal',
        'Failed to verify OTP'
      );
    }
  });