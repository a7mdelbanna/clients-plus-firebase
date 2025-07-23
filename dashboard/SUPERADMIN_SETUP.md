# Superadmin Dashboard Setup Guide

## Overview

The Clients+ Superadmin Dashboard is a secure, isolated control panel for managing the entire platform. It includes business management, pricing configuration, payment monitoring, and system-wide analytics.

## Security Features

1. **Random URL Access**: The dashboard is accessible only through a secure, randomized URL pattern
2. **Separate Authentication**: Superadmins use a completely separate authentication system
3. **IP Whitelisting**: Optional IP-based access control
4. **Audit Logging**: All actions are logged for security and compliance
5. **No Public Links**: The superadmin area is not linked from any public-facing pages

## Initial Setup

### 1. Environment Configuration

Add the following to your `.env` file:

```bash
# Generate a secure 32-character random hash
# You can use: openssl rand -hex 16
VITE_SUPERADMIN_URL_HASH=your_random_32_char_hash_here
```

### 2. Create Superadmin User

**Option A: Development Method (Quick Setup)**

1. First, create a regular user account:
   - Go to your app's signup page
   - Create a new account with email/password
   - Or create directly in Firebase Console > Authentication

2. Get the user's UID from Firebase Console

3. Open your app in the browser and open the console (F12)

4. Run this command in the console:
```javascript
await createSuperadminDev('USER_UID_HERE', 'admin@example.com', 'Admin Name')
```

5. The user can now login at the superadmin URL

**Option B: Production Method (Using Firebase Admin SDK)**

For production, you need a secure server-side environment:

1. Create a separate Node.js project:
```bash
mkdir superadmin-setup
cd superadmin-setup
npm init -y
npm install firebase-admin
```

2. Download your service account key from Firebase Console:
   - Go to Project Settings > Service Accounts
   - Click "Generate new private key"
   - Save as `serviceAccountKey.json`

3. Create this script (`createSuperadmin.js`):
```javascript
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function createSuperadmin(email, password, displayName) {
  try {
    // Create user
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName,
      emailVerified: true,
    });

    // Add to superadmins collection
    await admin.firestore().collection('superadmins').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: displayName,
      role: 'superadmin',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLogin: null,
    });

    // Set custom claims
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      role: 'superadmin',
      isSuperadmin: true,
    });

    console.log('Superadmin created successfully!');
    console.log('UID:', userRecord.uid);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run with your details
createSuperadmin('admin@example.com', 'SecurePassword123!', 'Admin Name')
  .then(() => process.exit(0));
```

4. Run the script:
```bash
node createSuperadmin.js
```

**Option C: Manual Creation (Alternative)**

1. Create a user in Firebase Auth Console
2. Add the user document to Firestore:

```javascript
// In Firestore, create document in 'superadmins' collection
{
  uid: "user_uid_from_auth",
  email: "admin@example.com",
  displayName: "Admin Name",
  role: "superadmin",
  createdAt: serverTimestamp(),
  lastLogin: null
}
```

### 3. Deploy Firestore Security Rules

Deploy the updated security rules that include superadmin access:

```bash
firebase deploy --only firestore:rules
```

### 4. Access the Dashboard

The superadmin dashboard URL will be:
```
https://your-domain.com/sa-[YOUR_HASH]/login
```

Example:
```
https://app.clientsplus.com/sa-7f8e3b2a9c1d4e5f6789abcdef012345/login
```

## Dashboard Features

### 1. Business Management
- View all registered businesses
- Filter by status, plan, revenue
- Activate/suspend businesses
- View detailed business analytics
- Override pricing for specific businesses

### 2. Pricing Configuration
- Create and edit pricing plans
- Set plan features and limits
- Configure add-ons (White-label, Mobile App)
- Set promotional campaigns
- View pricing analytics

### 3. Financial Management
- Monitor all transactions
- Track failed payments
- Process refunds
- Generate revenue reports
- View payment analytics

### 4. System Administration
- Send platform-wide announcements
- Configure feature flags
- View audit logs
- Manage system settings
- Monitor platform health

## Security Best Practices

1. **Keep the URL Secret**: Never share the superadmin URL publicly
2. **Use Strong Passwords**: Enforce strong password requirements
3. **Enable 2FA**: Use two-factor authentication for all superadmin accounts
4. **Regular Audits**: Review audit logs regularly
5. **Limited Access**: Only give superadmin access to trusted personnel
6. **Secure Environment Variables**: Never commit `.env` files to version control

## API Endpoints

The superadmin dashboard includes several API endpoints for the landing page:

### Public Pricing API
```
GET /api/public/pricing
```
Returns current pricing plans and add-ons for the landing page.

## Troubleshooting

### Cannot Access Dashboard
1. Check that the URL hash matches your `.env` configuration
2. Verify the user exists in the `superadmins` collection
3. Check browser console for authentication errors
4. Ensure Firestore rules are deployed

### Permission Errors
1. Verify the user document has `role: 'superadmin'`
2. Check that security rules are properly deployed
3. Ensure the user is authenticated

### Missing Data
1. Initialize pricing plans in Firestore
2. Ensure all required collections exist
3. Check browser console for Firestore errors

## Development Notes

### Adding New Superadmin Features

1. Add routes in `SuperadminLayout.tsx`
2. Create new pages in `src/pages/superadmin/`
3. Update security rules if new collections are needed
4. Add services in `src/services/`
5. Update audit logging for new actions

### Testing

Always test superadmin features in a development environment first:

1. Use Firebase Emulators for local testing
2. Create test businesses and data
3. Verify security rules work correctly
4. Test all CRUD operations

## Important Security Warning

⚠️ **NEVER expose the superadmin URL hash in:**
- Client-side code (except environment variables)
- Public repositories
- Documentation shared with regular users
- Support tickets or forums
- Marketing materials

The security of your entire platform depends on keeping this URL secret!