import * as functions from 'firebase-functions';
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = functions.config().jwt?.secret || 'your-secret-key';

/**
 * Validate client JWT token
 */
export const validateClientToken = functions.https.onCall(async (data: any) => {
    const { token } = data;

    if (!token || typeof token !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Token is required'
      );
    }

    try {
      // Verify JWT token
      const decoded = jwt.verify(token, JWT_SECRET, {
        issuer: 'clients-plus',
        audience: 'client-portal',
      }) as any;

      return {
        success: true,
        valid: true,
        clientId: decoded.clientId,
        phoneNumber: decoded.phoneNumber,
        companyId: decoded.companyId,
      };

    } catch (error) {
      console.error('Token validation error:', error);
      
      return {
        success: true,
        valid: false,
        error: 'Invalid or expired token',
      };
    }
  });