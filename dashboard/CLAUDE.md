# Claude Project Instructions - Clients+ Dashboard

## Project Overview
This is a Firebase-based multi-tenant SaaS dashboard for Clients+, a platform designed for Egyptian businesses to manage their operations, clients, projects, and employees. The application supports both Arabic and English with RTL/LTR layout switching.

## Current Status (Last Updated: 2025-07-15)

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

### Remaining Tasks
1. **Remove Dummy Data**
   - Replace hardcoded statistics with real company data
   - Integrate with actual business metrics
   - Create data aggregation services

2. **Complete Page Implementations**
   - Clients management page
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
1. **Permission Errors**: Ensure Firestore security rules are deployed
2. **Theme Context Errors**: Check that components are wrapped in ThemeProvider
3. **Redirect Loops**: Clear sessionStorage and check setup status logic
4. **Missing Imports**: VSCode auto-import may miss MUI components

## Next Major Features
- Client management system
- Project tracking
- Invoice generation
- Employee management
- Reports and analytics
- Calendar integration
- Notification system
- File storage