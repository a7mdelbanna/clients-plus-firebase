# Claude Project Instructions - Clients+ Dashboard

## Project Overview
This is a Firebase-based multi-tenant SaaS dashboard for Clients+, a platform designed for Egyptian businesses to manage their operations, clients, projects, and employees. The application supports both Arabic and English with RTL/LTR layout switching.

## Current Status (Last Updated: 2025-01-15)

### Completed Features
1. **Authentication System**
   - ✅ Login with email/password
   - ✅ Signup with automatic company creation
   - ✅ Password reset functionality
   - ✅ Arabic/English language toggle
   - ✅ Remember me functionality
   - ✅ Secure route protection
   - ✅ Firebase security rules for multi-tenant access

2. **Multi-tenant Architecture**
   - ✅ Company-based data isolation
   - ✅ Role-based access control (RBAC)
   - ✅ User permissions system
   - ✅ Company-specific theming with persistence
   - ✅ Firestore security rules implemented and deployed

3. **Setup Wizard**
   - ✅ Multi-step onboarding process
   - ✅ Business information collection
   - ✅ Branch/location management
   - ✅ Team size configuration
   - ✅ Theme selection with real-time preview
   - ✅ Real-time validation
   - ✅ Progress saving
   - ✅ Setup completion and redirect to dashboard

4. **Animated Dashboard**
   - ✅ Modern animated UI with Framer Motion
   - ✅ Real-time statistics with CountUp animations
   - ✅ Interactive cards and components
   - ✅ Dark/Light mode support
   - ✅ Responsive design
   - ✅ RTL/LTR support
   - ✅ Welcome section with user info
   - ✅ Quick action buttons
   - ✅ Recent activities feed
   - ✅ Floating action button (FAB)

5. **Interactive Sidebar Navigation**
   - ✅ Animated collapsible sidebar
   - ✅ Main navigation with icons
   - ✅ Expandable sub-menus
   - ✅ Active state indicators
   - ✅ Badge notifications
   - ✅ User profile section with logout
   - ✅ Responsive mobile menu
   - ✅ RTL/LTR support

6. **Settings Page**
   - ✅ Tabbed interface for different settings
   - ✅ Company information management
   - ✅ Theme selection with live preview
   - ✅ Theme persistence in Firestore
   - ✅ Dark/Light mode toggle
   - ✅ Language & region settings (UI ready)
   - ✅ Notification preferences (UI ready)
   - ✅ Security settings (UI ready)

7. **User Profile Page**
   - ✅ Profile photo upload to Firebase Storage
   - ✅ Edit display name
   - ✅ View account information (email, join date, last login)
   - ✅ Change password functionality
   - ✅ Password validation and re-authentication
   - ✅ Verified account badge
   - ✅ Profile information form

### Recent Fixes & Improvements
- ✅ Fixed Firebase permissions error during company creation
- ✅ Fixed input field spacing issues in setup wizard
- ✅ Fixed business form layout with proper field arrangement
- ✅ Fixed address field alignment and consistent heights
- ✅ Fixed setup completion redirect loop issue
- ✅ Fixed missing CircularProgress import error
- ✅ Fixed sidebar spacing issues (both collapsed and expanded states)
- ✅ Fixed user profile section visibility in sidebar
- ✅ Fixed theme persistence after page refresh
- ✅ Updated Firestore security rules to allow owners to update company
- ✅ Fixed theme selection highlighting in Settings
- ✅ Fixed floating action button to use current theme colors
- ✅ Added comprehensive error handling and logging

### Recent Additions (2025-07-15)

#### Firebase Storage Authentication Fix
   - ✓ Created `signupWithCompany` Cloud Function for proper user creation with claims
   - ✓ Updated signup flow to use Cloud Function ensuring all users get `companyId` claim
   - ✓ Fixed storage rules to properly validate custom claims
   - ✓ Added automatic claims migration for existing users
   - ✓ Resolved 403 Forbidden errors for image uploads

#### Service Image Upload serverTimestamp() Fix
   - ✓ Fixed Firebase error when updating services with image arrays
   - ✓ Changed `serverTimestamp()` to `Timestamp.now()` in image upload component
   - ✓ Service editing now works without Firebase validation errors
   - ✓ Updated documentation with serverTimestamp() array limitation

### Recent Additions (2025-07-16)

#### Positions Management System
   - ✓ Created simplified positions system with name and description only
   - ✓ Implemented multi-language translation support (14 languages)
   - ✓ Designed consistent UI pattern for name/description fields
   - ✓ Fixed Firebase undefined field errors for optional fields
   - ✓ Added proper conditional field inclusion to avoid Firestore errors

### Recent Additions (2025-01-15)
1. **Real Company Data in Dashboard**
   - ✅ Created company.service.ts for fetching real statistics
   - ✅ Dashboard now shows actual client count, projects, and revenue
   - ✅ Proper loading states with skeleton UI
   - ✅ Smart "Quick Start" suggestions for new companies
   - ✅ Company name displayed in welcome section

2. **Clients Management System**
   - ✅ Complete CRUD operations for clients
   - ✅ Firestore security rules for multi-tenant access
   - ✅ ClientsList component with search, filter, and pagination
   - ✅ ClientForm with multi-tab interface (Basic, Address, Additional)
   - ✅ Real-time updates support
   - ✅ Export/Import placeholders
   - ✅ Connected dashboard "Add Client" button to navigate to Clients page
   - ✅ Empty states with actionable CTAs
   - ✅ Fixed Firestore permission errors with ensureUserDocument utility
   - ✅ Added automatic user document creation on login
   - ✅ Added manual fix button for permission issues
   - ✅ Created and deployed Firestore indexes for clients, projects, and invoices
   - ✅ Fixed all Grid component warnings by replacing with Box components

3. **Service Management System**
   - ✅ Complete service management architecture for beauty/salon businesses
   - ✅ Service categories with CRUD operations
   - ✅ Services with pricing, duration, and online booking settings
   - ✅ Multi-tab service creation/editing interface (6 tabs)
   - ✅ Real-time subscriptions for categories and services
   - ✅ Advanced service options (VAT, follow-up days, auto-deduction)
   - ✅ Resource management placeholders
   - ✅ Dynamic multi-language translation system:
     - Arabic as primary language (always selected)
     - Choose from 14 available languages
     - Dynamic translation fields based on selected languages
     - Flexible data structure supporting unlimited languages
     - Language selection with interactive chips UI
   - ✅ Multiple image upload system for services:
     - Upload up to 10 images per service
     - Set default/primary image
     - Image preview with delete functionality
     - Firebase Storage integration
     - Responsive image grid layout
     - Service images displayed in category listing
   - ✅ Fixed Firestore permission errors for empty collections
   - ✅ Fixed Firebase addDoc() undefined field errors
   - ✅ Fixed TypeScript import errors (import type)

4. **Positions Management System**
   - ✅ Complete CRUD operations for positions
   - ✅ Position service with real-time subscriptions
   - ✅ Positions list page with search and filtering
   - ✅ Create/Edit position form with two tabs (Basic Info, Translation)
   - ✅ Multi-language translation support (14 languages)
   - ✅ Position name and description fields
   - ✅ Staff count tracking per position
   - ✅ Firestore security rules for positions
   - ✅ Helper functions for getting translated position names/descriptions

### Remaining Tasks
1. **Complete Page Implementations**
   - ClientDetail component (view individual client)
   - Projects tracking page
   - Invoices and billing page
   - Calendar integration
   - Reports and analytics
   - Inventory management

3. **Additional Features**
   - Email notifications
   - Real-time updates
   - Export functionality
   - Advanced search
   - Bulk operations
   - API integration

## Tech Stack
- **Frontend**: React 18 with TypeScript
- **Styling**: Material-UI v6, Emotion CSS-in-JS
- **State Management**: React Context API
- **Forms**: React Hook Form
- **Routing**: React Router v6
- **Animations**: Framer Motion
- **Backend**: Firebase (Firestore, Auth, Functions, Storage)
- **Build Tool**: Vite
- **Language Support**: Arabic (primary) and English with RTL/LTR

## Key Design Principles
1. **Arabic-First Design**: All UI elements optimized for Arabic with RTL layout
2. **Multi-tenant Architecture**: Complete data isolation between companies
3. **Modern Animations**: Smooth, purposeful animations that enhance UX
4. **Responsive Design**: Works seamlessly on desktop and mobile
5. **Theme Customization**: Each company can have its own brand colors
6. **Security First**: Proper authentication and authorization at all levels

## Important Commands
```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build

# Firebase
firebase deploy --only firestore:rules    # Deploy security rules
firebase deploy --only functions          # Deploy cloud functions
firebase deploy                          # Deploy everything
```

## Common Issues and Solutions
1. **Permission Errors**: 
   - Ensure Firestore security rules are deployed with `firebase deploy --only firestore:rules`
   - If user sees "Missing or insufficient permissions", they should logout and login again
   - A "Fix Permissions" button appears on Clients page if permissions are missing
   - Run `window.fixUserDocument()` in browser console as a manual fix

2. **Firestore Query Permission Errors on Empty Collections**:
   - **Error**: "Missing or insufficient permissions" when querying empty collections
   - **Cause**: Security rules checking `resource.data.companyId` fail when no documents exist
   - **Solution**: Update security rules to use `hasCompanyId()` OR `belongsToCompany(resource.data.companyId)`
   - **Example Fix**:
     ```javascript
     // Before (fails on empty collections):
     allow read: if isAuthenticated() && belongsToCompany(resource.data.companyId);
     
     // After (works on empty collections):
     allow read: if isAuthenticated() && 
       (hasCompanyId() || belongsToCompany(resource.data.companyId));
     ```
   - **Deploy**: Run `firebase deploy --only firestore:rules` after updating

3. **Company ID Not Found Errors**:
   - **Cause**: Company ID might be in user document but not in auth token claims
   - **Solution**: Use fallback approach like the dashboard:
     ```typescript
     const idTokenResult = await currentUser.getIdTokenResult();
     let companyId = idTokenResult.claims.companyId as string;
     
     if (!companyId) {
       // Fallback to getting from user document
       companyId = await setupService.getUserCompanyId(currentUser.uid);
     }
     ```

4. **Theme Context Errors**: Check that components are wrapped in ThemeProvider
5. **Redirect Loops**: Clear sessionStorage and check setup status logic
6. **Missing Imports**: VSCode auto-import may miss MUI components
7. **MUI v7 Grid Issues**: Use Stack and Box with flexbox instead of Grid component
8. **SelectChangeEvent Import**: Import from '@mui/material/Select' not '@mui/material'
9. **Type Import Errors**: Use `import type` for TypeScript types (e.g., `import type { User } from 'firebase/auth'`)

10. **Firebase addDoc() Invalid Data Errors**:
    - **Error**: "Function addDoc() called with invalid data. Unsupported field value: undefined"
    - **Cause**: Trying to save `undefined` values to Firestore (Firestore doesn't support undefined)
    - **Solution**: Ensure all optional fields either have a value or are omitted entirely
    - **Example Fix**:
      ```typescript
      // Before (causes error):
      onlineBookingName: data.useOnlineBookingName ? data.onlineBookingName : undefined,
      
      // After (works):
      onlineBookingName: data.useOnlineBookingName ? data.onlineBookingName : data.name,
      // OR omit the field entirely when not needed
      ```
    - **Best Practice**: Use default values instead of undefined, or conditionally include fields
    - **Warning**: Be careful with `||` operator - `'' || undefined` evaluates to undefined, which will cause errors
    - **Better approach**: Check for truthy values and only add fields when they have content:
      ```typescript
      const data: any = { requiredField: 'value' };
      if (optionalField && optionalField.trim()) {
        data.optionalField = optionalField;
      }
      ```

11. **Firebase Storage CORS Errors**:
    - **Error**: "Access to XMLHttpRequest... has been blocked by CORS policy"
    - **Cause**: Firebase Storage needs CORS configuration for web uploads
    - **Solution**: 
      1. Run `./apply-cors.sh` to apply CORS configuration
      2. Deploy storage rules: `firebase deploy --only storage`
      3. Ensure storage bucket URL is correct: `clients-plus-egypt.firebasestorage.app`
    - **See**: FIREBASE_STORAGE_SETUP.md for detailed instructions

12. **Firebase Storage Permission Errors (storage/unauthorized)**:
    - **Error**: "User does not have permission to access..."
    - **Root Cause**: Users created via client-side `createUserWithEmailAndPassword` don't have custom claims
    - **Solution Implemented**:
      1. Created `signupWithCompany` Cloud Function that creates user with proper claims
      2. Updated `Signup.tsx` to use the Cloud Function instead of direct Firebase Auth
      3. Added automatic claims migration for existing users via `checkAndMigrateUserClaims`
      4. Storage rules now properly check `request.auth.token.companyId`
    - **For Existing Users**: The app automatically checks and migrates claims on login
    - **Manual Migration**: Run `window.checkAndMigrateUserClaims()` in browser console

13. **MUI Select Out-of-Range Value Warnings**:
    - **Error**: "You have provided an out-of-range value..."
    - **Cause**: Select component has a value that doesn't exist in available options (e.g., categories not loaded yet)
    - **Solution**: Add `value={field.value || ''}` to Select components and handle empty states properly

14. **Firebase serverTimestamp() in Arrays Error**:
    - **Error**: "Function updateDoc() called with invalid data. serverTimestamp() is not currently supported inside arrays"
    - **Cause**: Using `serverTimestamp()` inside array elements when updating Firestore documents
    - **Solution**: Use `Timestamp.now()` instead of `serverTimestamp()` for timestamp fields inside arrays
    - **Example Fix**:
      ```typescript
      // Before (causes error):
      uploadedAt: serverTimestamp() as Timestamp,
      
      // After (works):
      uploadedAt: Timestamp.now(),
      ```
    - **Note**: `serverTimestamp()` works fine for top-level fields, but not inside arrays or nested objects

## Next Major Features
- Client management system
- Project tracking
- Invoice generation
- Employee management
- Reports and analytics
- Calendar integration
- Notification system
- File storage