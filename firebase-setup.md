# Firebase Setup Instructions

## 1. Create Firebase Project

### Via Console:
1. Go to https://console.firebase.google.com
2. Click "Create a project"
3. Name: `clients-plus-egypt` (or your preferred name)
4. Enable Google Analytics (optional)
5. Wait for project creation

### Via CLI:
```bash
firebase projects:create clients-plus-egypt --display-name "Clients+ Egypt"
```

## 2. Initialize Firebase in Project

```bash
cd clients-plus-firebase
firebase use --add
# Select your project
# Give it an alias: "default"
```

## 3. Enable Required Services

Run these commands or enable in console:

```bash
# Enable Authentication
firebase auth:import --project clients-plus-egypt

# Enable Firestore
firebase firestore:databases:create --project clients-plus-egypt

# Enable Storage
firebase storage:buckets:create --project clients-plus-egypt
```

Or in Firebase Console:
1. Authentication > Get Started
2. Firestore Database > Create Database (Start in production mode)
3. Storage > Get Started

## 4. Deploy Everything

```bash
# Deploy all services
firebase deploy

# Or deploy individually:
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only storage:rules
firebase deploy --only functions
```

## 5. Test Cloud Functions

After deployment, you'll get function URLs like:
- https://us-central1-PROJECT_ID.cloudfunctions.net/setupSuperAdmin
- https://us-central1-PROJECT_ID.cloudfunctions.net/registerCompany

## 6. Create Super Admin

Use the Firebase Console or a tool like Postman to call setupSuperAdmin:

```json
POST https://us-central1-PROJECT_ID.cloudfunctions.net/setupSuperAdmin
Content-Type: application/json

{
  "data": {
    "email": "super@clientsplus.com",
    "password": "your-secure-password",
    "name": "Super Admin"
  }
}
```

## 7. Enable Authentication Methods

In Firebase Console > Authentication > Sign-in method:
1. Enable Email/Password
2. Enable Phone (optional)
3. Configure authorized domains

## 8. Set Up Emulators (for local development)

```bash
firebase init emulators
# Select: Authentication, Firestore, Functions, Storage

# Start emulators
firebase emulators:start
```

## Troubleshooting:

### If deployment fails:
1. Check you're logged in: `firebase login`
2. Check project: `firebase projects:list`
3. Check Node version: `node --version` (should be 18+)

### If functions fail:
1. Check logs: `firebase functions:log`
2. Make sure billing is enabled (required for external API calls)