# WhatsApp Error Debug Guide

## Current Error
```
POST https://us-central1-clients-plus-egypt.cloudfunctions.net/sendWhatsAppMessage 500 (Internal Server Error)
Error: Cannot read properties of undefined (reading 'to')
```

## What This Means
The Cloud Function is receiving the data but the `message` object is undefined when it tries to access `message.to`.

## Debug Steps

### 1. Check the Cloud Function Logs
```bash
firebase functions:log --only sendWhatsAppMessage --lines 20
```

Look for the line that says "sendWhatsAppMessage called with raw data:" to see exactly what data is being sent.

### 2. Test with a Simple Call
In the browser console, try this simplified test:

```javascript
// Get the functions instance
const { functions } = await import('/src/config/firebase.js');
const { httpsCallable } = await import('firebase/functions');

// Create a simple test
const sendWhatsAppMessage = httpsCallable(functions, 'sendWhatsAppMessage');

// Try sending with minimal data
const testData = {
  messageId: 'test-123',
  companyId: 'your-company-id',
  config: {
    provider: 'twilio',
    accountSid: 'your-sid',
    authToken: 'your-token',
    twilioWhatsAppNumber: '+14155238886'
  },
  message: {
    to: '+201555282289',
    type: 'custom',
    parameters: {
      text: 'Test message'
    }
  }
};

try {
  const result = await sendWhatsAppMessage(testData);
  console.log('Success:', result.data);
} catch (error) {
  console.error('Error:', error);
}
```

### 3. Common Issues

1. **Data Structure Mismatch**: The frontend might be sending data in a different structure than the Cloud Function expects.

2. **Authentication Context**: Even though auth is disabled for testing, the function might have issues with the context.

3. **Serialization Issues**: Some data might not be serializing correctly when sent to the Cloud Function.

### 4. Temporary Workaround

If the issue persists, you can test Twilio directly from the browser console:

```javascript
// This is just for testing - DO NOT use in production
const testTwilio = async () => {
  const accountSid = 'your-account-sid';
  const authToken = 'your-auth-token';
  const from = 'whatsapp:+14155238886';
  const to = 'whatsapp:+201555282289';
  const body = 'مرحبا! هذه رسالة تجريبية من نظام المواعيد';

  // Note: This won't work due to CORS, but shows the structure
  console.log('Twilio message structure:', {
    from,
    to,
    body
  });
};
```

### 5. Next Steps

Once we can see the exact data structure in the logs, we can:
1. Fix any data structure mismatches
2. Ensure all required fields are present
3. Update the Cloud Function to handle the data correctly

## Updated Cloud Function

The function now has better error handling and will log:
1. The raw data received
2. Which fields are missing (if any)
3. The parsed data structure

This will help identify exactly where the issue is.