# Claude Project Instructions - Clients+ Dashboard

## Project Overview
This is a Firebase-based multi-tenant SaaS dashboard for Clients+, a platform designed for Egyptian businesses to manage their operations, clients, projects, and employees. The application supports both Arabic and English with RTL/LTR layout switching.

## Current Status (Last Updated: 2025-07-23 - Early Morning)

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

7. **Enhanced User Profile System (2025-07-23)**
   - ✅ **Complete Profile Management**:
     - Profile photo upload to Firebase Storage with real-time updates
     - Edit comprehensive profile information (first name, last name, display name)
     - Contact information management (phone, location, bio)
     - Email display (non-editable with verification status)
   - ✅ **Modern UX Design**:
     - Header section with large avatar (140x140), user info, and quick stats
     - Organized form sections (Basic Information, Contact Information, About)
     - Sidebar with Security & Account settings and Account Statistics
     - Enhanced visual hierarchy with proper spacing and typography
   - ✅ **Security Features**:
     - Password change functionality with validation and re-authentication
     - Two-factor authentication placeholder (Coming Soon)
     - Password change button clearly visible on separate line
   - ✅ **User Role Detection**:
     - Dynamic role identification (Owner, Admin, Manager, Employee, Receptionist)
     - Company ownership verification from Firestore
     - Color-coded role chips with Arabic/English support
     - Automatic role determination with fallback logic
   - ✅ **Account Statistics**:
     - Profile completion percentage calculation
     - Total login count tracking
     - Account type display with appropriate colors
     - Member since and last active dates with consistent formatting
   - ✅ **Data Integration**:
     - Complete Firestore user document integration
     - Real-time profile data loading and saving
     - Proper error handling and toast notifications
     - RTL/LTR layout support maintained throughout

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

#### Enhanced Employee Management System (Altiego-based)
   - ✓ Replaced basic employee system with comprehensive staff management
   - ✓ Advanced filtering by position, status, access level, and search
   - ✓ Role-based access control with 6 access levels (Employee, Administrator, etc.)
   - ✓ Enhanced employee detail page with 6 tabs:
     - Information: Profile management, avatar upload, access control
     - Services: Service assignment with search, filter, and category grouping
     - Online Booking: Booking configuration (placeholder)
     - Additional Info: Personal details (placeholder)
     - Settings: Employee settings (placeholder)
     - Schedule: Full schedule management with templates, calendar view, and working hours
   - ✓ Real-time online booking toggle from staff list
   - ✓ Schedule status display with direct links
   - ✓ Service count tracking
   - ✓ Invitation system for granting access
   - ✓ Enhanced data model with schedule, services, and booking fields
   - ✓ Duplicate Detection System (2025-07-18):
     - Smart client duplicate detection using phone, email, name, and DOB matching
     - Levenshtein distance algorithm for fuzzy name matching
     - Score-based duplicate detection with configurable thresholds
     - Warning dialog showing potential duplicates with match details
     - Block/warn/allow actions based on match confidence
     - Visual duplicate match cards with avatars and match scores
     - Integrated seamlessly into client form submission workflow
   - ✓ Client Form Fixes (2025-07-18):
     - Fixed email field focus loss with memoized EmailField component
     - Fixed FieldRow scope error in EmailField component
     - Fixed interactive sliders in Preferences tab (volume and temperature)
     - Removed conflicting {...field} spread in slider components
     - All form fields now working correctly without UI glitches
   - ✓ Schedule Tab Implementation:
     - Schedule templates (Full-time, Morning, Evening, Weekend, Custom)
     - Date and time pickers for schedule setup
     - Working days selection with interactive chips
     - Calendar view with week/month toggle
     - "Scheduled until" date tracking
     - Auto-navigation from "Add to schedule" option
     - Clear schedule functionality
   - ✓ Enhanced Schedule Tab with Dot Grid System (2025-07-16):
     - 7x24 interactive dot grid (7 days × 24 hours)
     - Each dot represents one hour slot
     - Manual mode: Click dots to toggle working/not working
     - Template mode: Auto-fill based on selected template
     - Compact responsive UI that fits all screens
     - Template section moved above grid to save space
     - All fields on single line with proper labels
     - Time selection using dropdowns (hours 00-23, minutes in 15-min intervals)
     - Week selection using dropdowns (common periods: 1-52 weeks)
     - Copy schedule functionality with week dropdown
     - Visual hour totals per day
     - Legend for dot states (working/available)

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

### Recent Additions (2025-07-22 - Morning)

#### Employee Working Hours Integration in Appointments
   - ✓ **Time Slot Availability Based on Staff Schedule**:
     - Time slots now respect individual employee working hours
     - Slots outside employee working hours are visually disabled
     - Calendar week view shows unavailable slots with gray background
     - Prevents booking appointments outside staff scheduled hours
   - ✓ **Smart Time Slot Filtering**:
     - When selecting a specific employee, only their working hours are available
     - Non-working days show all slots as disabled
     - Working days show only slots within start/end times as available
     - Example: Employee working 09:00-17:00 → slots before 09:00 and after 17:00 are disabled
   - ✓ **Visual Feedback**:
     - Available slots: Normal appearance with hover effects
     - Unavailable slots: Gray background, reduced opacity, "not-allowed" cursor
     - Clear distinction between working and non-working hours
   - ✓ **Implementation Details**:
     - Updated `TimeSlotPicker` component to accept employee working hours
     - Modified `CalendarWeekView` to check individual time slots against schedule
     - Modified `CalendarDayView` with same working hours logic for daily view
     - Added `isTimeSlotAvailable` function for granular time checking
     - Maintains backward compatibility for employees without schedules

#### Branch Management System (Multi-branch Support)
   - ✓ **Complete Branch CRUD Operations**:
     - Branch management page at `/settings/branches`
     - Create new branches with wizard-style form
     - Edit existing branches
     - Activate/deactivate branches
     - Delete branches (except main branch)
   - ✓ **Branch Service (`branch.service.ts`)**:
     - Full CRUD operations with Firestore
     - Plan-based branch limits (trial: 2, basic: 3, pro: 5, enterprise: unlimited)
     - Legacy data structure support
     - Branch validation and counting
   - ✓ **Branch Management UI**:
     - List view showing all branches with status
     - Staff and service count per branch
     - Quick actions (edit, toggle status, delete)
     - Plan limit alerts and enforcement
     - Protected main branch from deletion/deactivation
   - ✓ **Branch Form Pages**:
     - Multi-step wizard for branch creation
     - Step 1: Basic Information (name, type, status)
     - Step 2: Location & Contact (address, phone, email)
     - Step 3: Settings (online booking, auto-confirm)
     - Form validation and error handling
   - ✓ **Branch Context Integration**:
     - Branch selector in header for switching branches
     - All data scoped to selected branch
     - Persistent branch selection
     - Automatic refresh on branch changes
   - ✓ **MUI Component Fixes**:
     - Fixed tooltip warnings for disabled buttons by wrapping in spans
     - Proper TypeScript types for branch data structures
   - ✓ **Multi-Branch Staff Assignment** (2025-07-22):
     - Updated Staff interface with `branchIds?: string[]` array field
     - Backward compatibility maintained with legacy `branchId` field
     - Created branch assignment UI in InformationTab with clickable chips
     - Staff can now be assigned to work at multiple branches
     - Updated filtering logic to check both branchIds array and legacy branchId
     - Added Firestore indexes for branchIds array queries
     - Created migration utility `migrateStaffBranches()` for existing data
     - Appointments and other features automatically filter staff by current branch

### Recent Additions (2025-07-22 - Evening)

#### Multi-Branch Service Management
   - ✓ **Service Branch Assignment**:
     - Services can now be assigned to multiple branches
     - Added `branchIds` array field to Service interface
     - Backward compatibility maintained with legacy `branchId` field
     - Branch selection UI with clickable chips in service forms
   - ✓ **Service Creation/Edit Forms**:
     - Added "Branches" tab to service creation and edit pages
     - Branch selection with visual chips showing assigned branches
     - Validation ensures at least one branch is selected
     - Services default to current branch if none specified
   - ✓ **Service Filtering by Branch**:
     - Fixed real-time subscription filtering in `subscribeToServices()`
     - Services only appear in their assigned branches
     - Client-side filtering handles both old and new branch formats
     - Company-wide services (no branch) show in all branches
   - ✓ **UI/UX Improvements**:
     - Fixed service creation save button not working
     - Fixed online booking display name validation error
     - Auto-fill online booking display name from service name
     - Online booking enabled by default as requested
   - ✓ **Component Updates**:
     - Updated ServiceCategoryPage to use branch context
     - Fixed ServiceSelection component in appointments
     - Branch filtering now works across entire application

#### Work Schedule Branch Filtering
   - ✓ **Fixed employee filtering by branch**:
     - Work schedule now only shows employees assigned to current branch
     - Updated WorkScheduleService to accept branch ID parameter
     - Modified all schedule methods to filter staff by branch
     - Maintains support for both new branchIds array and legacy branchId
   - ✓ **Implementation Details**:
     - Added BranchContext to WorkSchedulePage
     - Updated getStaffSchedules, getMonthSchedule, getWeekSchedule methods
     - Staff filtering handles multi-branch assignments correctly
     - Employees with no branch assignment are excluded (not shown in any branch)

### Recent Additions (2025-07-19, 2025-07-20 & 2025-07-21)

#### Appointment Management System (Complete Implementation)
   - ✓ **Complete appointment booking workflow** from staff selection to time slot booking
   - ✓ **Service Management Integration**: 
     - Fixed service duration structure (hours/minutes object → total minutes)
     - Fixed service pricing (startingPrice vs undefined price)
     - Service chips display correct duration and price in EGP
     - Total duration and price calculations working properly
   - ✓ **Client Management Integration**:
     - Fixed client autocomplete search functionality  
     - Auto-loads all clients when dropdown opens
     - Search works with real-time filtering
     - Handles client selection with phone/email auto-fill
     - Fixed data structure mismatch (service returns object, not array)
     - **NEW: Inline client creation** - Create new clients directly from appointment form
   - ✓ **Time Slot Management**:
     - Visual time slot picker with morning/afternoon/evening sections
     - Real-time availability checking for selected staff and date
     - Proper time validation and error handling
     - Duration-based slot calculations
     - **NEW: Staff schedule integration** - Time slots respect staff working hours
   - ✓ **Form Validation & Error Handling**:
     - Fixed React JSX key prop errors in service chips
     - Fixed invalid time value errors in date/time calculations
     - Added comprehensive validation for all required fields
     - Proper error messages in Arabic and English
     - **NEW: Fixed Firebase undefined field errors** - Clean data before saving
   - ✓ **Multi-language Support**: Full Arabic/English support with RTL layout
   - ✓ **Staff Assignment**: Working staff selection with availability integration
   - ✓ **Appointment Status Management**: Complete status workflow (pending → confirmed → completed)
   - ✓ **New UI Implementation (2025-07-19)**:
     - Replaced modal dialogs with sliding panel pattern
     - Created CalendarWeekView with clean grid layout (9:00-22:00 time slots)
     - AppointmentPanel sliding drawer component with smooth animations
     - AppointmentPanelForm with tabbed interface matching UI design
     - AppointmentStatusBar with interactive status pills
     - ServiceSelection with search, categories, and running totals
     - NotificationSettings for booking confirmations and reminders
     - VisitHistory showing client appointment history
     - AdvancedFields for comments, resources, and color coding
     - Integrated all components into main AppointmentsPage
     - WhatsApp integration button in appointment panel
   - ✓ **Critical Bug Fixes (2025-07-20)**:
     - **Fixed appointment date issue** - Appointments now appear on correct date in calendar
     - **Fixed duplicate key warnings** - Using unique IDs for client search results
     - **Fixed branchId undefined errors** - Clean data before Firebase saves
     - **Fixed time slot availability** - Proper staff schedule integration
     - **Fixed appointment time synchronization** - Separated hours/minutes state management
   - ✓ **New Features (2025-07-21)**:
     - **Appointment Source Selection** - Track how appointments are booked (Dashboard/Online/Phone/Walk-in)
     - **Recurring Appointments** - Full support for daily, weekly, and monthly recurring appointments
       - RecurringSettings component with interval and end date options
       - Preview of upcoming appointments in the series
       - Batch creation of recurring appointments
       - Visual indicators in calendar for recurring appointments
       - RecurringActionsDialog for managing series edits/deletes
     - **Calendar Views** - Added daily and monthly views alongside week view
       - CalendarDayView with staff columns and time slots
       - CalendarMonthView with appointment previews and status summaries
       - Smart navigation between views (click month date → day view)
       - View-specific date navigation and display
     - **Fixed appointmentDate prop error** in AdvancedFields component

### Recent Additions (2025-07-16 continued)

#### Work Schedule Management System
   - ✓ Calendar grid view showing all employees' schedules
   - ✓ Month and week view toggles
   - ✓ Green blocks (#4CAF50) for working hours
   - ✓ Employee sidebar with avatars and total hours
   - ✓ Real-time schedule aggregation from staff working hours
   - ✓ Daily, weekly, and monthly hour calculations
   - ✓ Filter dropdown (position, status, date range)
   - ✓ Today highlighting and weekend date coloring
   - ✓ Navigation controls with previous/next and today button
   - ✓ Export to PDF placeholder (implementation pending)
   - ✓ Responsive Design Improvements (2025-07-16):
     - Fixed calendar widget being cut off at screen edge
     - Added horizontal scrolling with sticky employee column
     - Enhanced scrollbar styling with primary theme color
     - Mobile-optimized table with reduced cell sizes
     - Responsive breakpoints for different screen sizes
     - Animated scroll indicator for mobile devices
     - Employee names with ellipsis for overflow
     - Adjusted minimum widths for better mobile experience
   - ✓ Enhanced 7-Day Calendar View (2025-07-16):
     - Limited display to 7 days for improved readability
     - Larger day numbers (1.75rem) and names (1rem)
     - Better spacing with increased padding (p: 2)
     - Visual separation with vertical borders between days
     - Weekend days highlighted with grey background
     - Today highlighted with warning color
     - Bigger schedule blocks with enhanced hover effects
     - Improved employee avatars and info display
     - Clean, modern design with proper shadows
   - ✓ Fixed Calendar Edge and Navigation Issues (2025-07-16):
     - Added proper container padding to prevent calendar from touching screen edges
     - Calendar wrapped in styled Box with padding and shadow
     - Fixed navigation to always move by 7 days (weekly navigation)
     - Updated date range display to show correct week range
     - Removed unnecessary end cap columns
     - Always loads week schedule (7 days) regardless of view mode
     - Consistent weekly view with proper start/end dates
   - ✓ Schedule Editing Functionality (2025-07-16):
     - Created ScheduleEditDialog component for add/edit/delete operations
     - Click empty cells to add new schedules (shows + icon on hover)
     - Click existing schedule blocks to edit (shows pencil icon on hover)
     - Time selection with hour and minute dropdowns (15-minute intervals)
     - Real-time total hours calculation display
     - Delete functionality for existing schedules
     - Updates staff working hours in Firebase
     - Automatic schedule reload after changes
     - Visual feedback with hover effects and icons
   - ✓ Schedule Date Range Validation (2025-07-16):
     - Added scheduleStartDate field to staff schedule
     - Work schedule only shows employees during their scheduled period
     - Validates both start and end dates before displaying schedules
     - Prevents schedules from appearing before start date
     - Respects scheduledUntil date for schedule expiration
     - Fixed ScheduleTab.tsx to save scheduleStartDate when creating/updating schedules
     - Improved migration utility to use employee registration start date when available
     - Added fixEmployeeScheduleStartDate utility for debugging specific employees

#### Resources Management System
   - ✓ Complete CRUD operations for resources (rooms, equipment)
   - ✓ Resource-service linking with multi-select dropdown
   - ✓ Capacity management (simultaneous usage)
   - ✓ Empty state with helpful messaging
   - ✓ Inline add resource form
   - ✓ Real-time updates with Firestore subscriptions
   - ✓ Soft delete with status management
   - ✓ Integration points for future booking conflicts

#### Categories Management System (2025-07-17)
   - ✓ Three category types: Client, Appointment, and Event categories
   - ✓ Main categories dashboard at /settings/categories
   - ✓ Individual management pages for each category type
   - ✓ Category creation with name, color, icon, and description
   - ✓ Multi-language support (Arabic and English)
   - ✓ Color picker with predefined brand colors
   - ✓ Icon selector with category-specific icon sets
   - ✓ Real-time updates with Firestore subscriptions
   - ✓ Category item count tracking
   - ✓ Edit and soft delete functionality
   - ✓ Search and filter capabilities
   - ✓ Firestore security rules and indexes deployed
   - ✓ Empty states with CTAs
   - ✓ Responsive design with animations

#### Location Settings System (2025-07-17)
   - ✓ Comprehensive location management service (location.service.ts)
   - ✓ Location Settings page with 5 tabs:
     - Basic Settings: Logo upload, business name, category, city, localization
     - Contact Details: Address, phone numbers, website, business hours
     - Business Hours: Weekly schedule with breaks, copy functionality
     - Map: Full Google Maps integration with search and markers
     - Photos: Business banner and gallery with drag-and-drop upload
   - ✓ Multi-tenant location settings with branch support
   - ✓ Real-time subscriptions for location data
   - ✓ Logo upload to Firebase Storage
   - ✓ Phone number validation with country codes
   - ✓ Business hours with day/time selection and breaks
   - ✓ Google Maps Integration Fixes (2025-07-17):
     - Interactive map with click-to-set location
     - Address search with autocomplete (restricted to Egypt)
     - Get current location button with geolocation API
     - Reverse geocoding for address lookup
     - Marker animation and map controls
     - Coordinates display with lat/lng values
     - Address syncs with map location automatically
     - Fixed undefined coordinates error with proper validation
     - Added null checks for lat/lng values before saving
     - Fixed Google Maps multiple loading error when switching tabs
     - Replaced LoadScript component with useLoadScript hook for proper lifecycle
     - Fixed constant loading spinner issue
   - ✓ Business Name and Category Synchronization:
     - Fixed business name always reverting to setup wizard value
     - Prioritized saved location settings over company data
     - Added category mapping from setup wizard business types
     - Proper business name and category persistence after save
   - ✓ Photos Tab Implementation:
     - Banner section for hero image (used in online booking)
     - Gallery section for multiple business photos
     - Drag-and-drop upload support with react-dropzone
     - Dark theme compatibility with theme-aware colors
     - Firebase Storage integration for banner and business photos
     - Image validation and size limits (10MB banner, 5MB photos)
     - Caption editing for both banner and gallery photos
     - Upload progress indicators and error handling
   - ✓ Integration with existing settings menu
   - ✓ Route configuration in App.tsx
   - Note: Google Maps Autocomplete shows deprecation warning (works but should migrate to PlaceAutocompleteElement in future)

### Remaining Tasks
1. **Appointment System Enhancements**
   - WhatsApp integration for appointment confirmations
   - Drag-and-drop appointment rescheduling in calendar view
   - Email/SMS appointment notifications and reminders
   - Resource booking conflict detection
   - Payment processing integration
   - Appointment templates
   - Rich text editor for appointment notes
   - File attachments for appointments
   - Appointment reminder settings configuration

2. **Complete Page Implementations**
   - ClientDetail component (view individual client)
   - Projects tracking page
   - Invoices and billing page
   - Calendar integration with appointments
   - Reports and analytics
   - Inventory management
   - PDF export implementation for work schedule
   - DescriptionTab with rich text editor for location settings
   - Business Information page

3. **Additional Features**
   - Email notifications
   - Real-time updates
   - Export functionality
   - Advanced search
   - Bulk operations
   - API integration

3. **Production Deployment Tasks**
   - **IMPORTANT: Secure Google Maps API Key**
     - Add domain restrictions in Google Cloud Console
     - Allowed referrers should include:
       ```
       https://your-domain.com/*
       https://www.your-domain.com/*
       ```
     - Remove localhost and unrestricted access
     - Enable only required APIs (Maps JavaScript, Places, Geocoding)

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

## Next Steps for Testing
1. **Test Location Settings Features**:
   - ✅ Google Maps integration working
   - Test logo upload functionality
   - Test business hours configuration
   - Test contact details (phone numbers, website)
   - Test all data persistence after page refresh

2. **Implement Branch Switcher in Sidebar**:
   - Allow users to switch between branches
   - Update all pages to be branch-aware
   - Test multi-branch functionality

3. **Complete Remaining Settings Pages**:
   - Business Information page
   - Rich text editor for descriptions
   - Photo gallery for business photos

## Common Issues and Solutions (Updated 2025-07-19)
1. **Permission Errors**: 
   - Ensure Firestore security rules are deployed with `firebase deploy --only firestore:rules`
   - If user sees "Missing or insufficient permissions", they should logout and login again
   - A "Fix Permissions" button appears on Clients page if permissions are missing
   - Run `window.fixUserDocument()` in browser console as a manual fix

2. **Firestore Index Errors**:
   - **Error**: "The query requires an index" when filtering/ordering data
   - **Cause**: Missing composite index for multi-field queries
   - **Solution**: 
     1. Add the required index to `firestore.indexes.json`
     2. Deploy with `firebase deploy --only firestore:indexes`
   - **Example**: Multi-branch client queries need index on branchId + companyId + createdAt
   - **Prevention**: Add indexes proactively for all new query patterns

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

15. **Material-UI Icon Import Errors**:
    - **Error**: "The requested module does not provide an export named 'Services'"
    - **Cause**: Using non-existent icon names from @mui/icons-material
    - **Solution**: Use correct icon names (e.g., `MiscellaneousServices` instead of `Services`)
    - **How to check**: Visit https://mui.com/material-ui/material-icons/ to search for valid icon names

16. **Firestore Undefined Field Value Errors**:
    - **Error**: "Function addDoc() called with invalid data. Unsupported field value: undefined"
    - **Cause**: Trying to save `undefined` values to Firestore fields
    - **Solution**: Build objects conditionally and only include fields with actual values
    - **Example Fix**:
      ```typescript
      // Before (causes error):
      const data = {
        email: condition ? value : undefined,  // ❌ undefined not allowed
      };
      
      // After (works):
      const data: any = {};
      if (condition && value) {
        data.email = value;  // ✅ Only add field if it has a value
      }
      ```

17. **Work Schedule Shows Employees Outside Their Scheduled Period**:
    - **Error**: Employees appear in work schedule before their start date or after their end date
    - **Cause**: Missing `scheduleStartDate` field when saving schedules in ScheduleTab
    - **Solution**: 
      1. Fixed ScheduleTab.tsx to save `scheduleStartDate` when creating/updating schedules
      2. Run migration by clicking the sync button (⟳) in Work Schedule page
      3. For specific fixes, use: `window.fixEmployeeScheduleStartDate('employeeId', new Date('2025-07-16'))`
    - **Prevention**: Always save both `scheduleStartDate` and `scheduledUntil` together

18. **Resources Not Appearing Immediately After Creation**:
    - **Error**: New resources don't show up immediately after saving, require page refresh
    - **Cause**: Improper cleanup of Firestore real-time subscription in useEffect
    - **Solution**: 
      1. Fixed subscription cleanup by properly handling the unsubscribe function in useEffect
      2. Added small delay (100ms) before closing form to ensure real-time update is received
    - **Prevention**: Always properly clean up Firestore subscriptions in useEffect cleanup function

19. **Location Settings Update Permission Error**:
    - **Error**: "Missing or insufficient permissions" when saving location settings
    - **Cause**: Using `updateDoc` on a document that doesn't exist yet
    - **Solution**: 
      1. Modified all update methods in location.service.ts to check if document exists first
      2. Use `setDoc` to create document if it doesn't exist, `updateDoc` if it does
      3. Apply same pattern to updateBasicSettings, updateContactDetails, etc.
    - **Example Fix**:
      ```typescript
      // Check if document exists
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        await updateDoc(docRef, data);
      } else {
        await setDoc(docRef, fullData);
      }
      ```
    - **Prevention**: Always check document existence before using updateDoc

20. **Location Settings Data Persistence Issue**:
    - **Error**: Saved data shows success but doesn't persist after page refresh
    - **Cause**: Inconsistent document ID construction between read and write operations
    - **Solution**: 
      1. Fixed document ID format to be consistent across all methods
      2. Changed from `docId = branchId || ${companyId}_main` to `docId = branchId ? ${companyId}_${branchId} : ${companyId}_main`
      3. Ensures data is saved to and loaded from the same document
    - **Example Fix**:
      ```typescript
      // Consistent format for both read and write
      const docId = branchId ? `${companyId}_${branchId}` : `${companyId}_main`;
      ```
    - **Prevention**: Always use consistent document ID format across service methods

21. **Branch Name Synchronization Issue**:
    - **Error**: Branch name in header doesn't update when changed in location settings
    - **Cause**: Branch names stored in two different places without synchronization
    - **Solution**: 
      1. Added `updateBranchName` method to sync branch name to branches subcollection
      2. When updating location settings, also update the branch document
      3. Branch selector in header shows the synced name
    - **Implementation**:
      ```typescript
      // In updateBasicSettings
      if (basicSettings.locationName) {
        await this.updateBranchName(companyId, branchId || 'main', basicSettings.locationName);
      }
      ```
    - **Data Flow**: 
      - Location Settings → updates both `locationSettings` and `branches` collections
      - Header BranchSelector → reads from `branches` collection
    - **Prevention**: Keep single source of truth for shared data

22. **useFieldArray Phone/Dynamic Input Loses Focus on Every Keystroke**:
    - **Error**: When typing in dynamic form fields (like phone numbers), the input loses focus after each character
    - **Root Cause**: 
      1. Form validation mode set to `onChange` causes re-renders on every keystroke
      2. useFieldArray fields get re-mounted when the form re-renders
      3. React loses track of which input element had focus
    - **Solution**: 
      1. Change form mode from `onChange` to `onSubmit`:
      ```typescript
      const { control, handleSubmit } = useForm({
        mode: 'onSubmit', // Instead of 'onChange'
      });
      ```
      2. This prevents validation from running on every keystroke
      3. Form only validates when submitted, eliminating constant re-renders
    - **Alternative Solutions Tried (Less Effective)**:
      - Using `keyName` in useFieldArray
      - Creating memoized components
      - Using stable keys for array items
      - Using uncontrolled inputs
    - **When This Happens**: Common with react-hook-form's useFieldArray for dynamic lists (phones, emails, addresses)
    - **Prevention**: Always use `mode: 'onSubmit'` or `mode: 'onBlur'` for forms with dynamic field arrays

23. **Client Form Submit Button Not Working**:
    - **Error**: Form submit button appears to work but nothing happens, no form submission
    - **Root Causes & Solutions**:
      1. **CompanyId Access Issue**: 
         - Error: `currentUser.companyId` is undefined
         - Solution: Get companyId from token claims:
         ```typescript
         const idTokenResult = await currentUser.getIdTokenResult();
         const companyId = idTokenResult.claims.companyId as string;
         ```
      2. **Firestore Undefined Field Values**:
         - Error: "Function addDoc() called with invalid data. Unsupported field value: undefined"
         - Solution: Only include fields with actual values:
         ```typescript
         const clientData: any = { /* required fields */ };
         
         // Add optional fields conditionally
         if (data.dateOfBirth) {
           clientData.dateOfBirth = Timestamp.fromDate(data.dateOfBirth);
         }
         
         if (data.medicalInfo?.allergies?.length || data.medicalInfo?.conditions?.length) {
           clientData.medicalInfo = { ...data.medicalInfo, lastUpdated: Timestamp.now() };
         }
         ```
      3. **Missing Service Parameters**:
         - Error: createClient function requires userId parameter
         - Solution: Pass all required parameters:
         ```typescript
         await clientService.createClient(clientData, currentUser.uid, currentBranch?.id);
         ```
    - **Prevention**: 
      - Always check service function signatures for required parameters
      - Use conditional field inclusion for optional Firestore fields
      - Get companyId from token claims, not user object directly

24. **Branch ID Mismatch Between Setup and Firestore**:
    - **Error**: "Branch 1 not found in branches subcollection" when updating branch name
    - **Root Cause**: 
      1. Setup wizard creates branches with hardcoded ID (e.g., `id: '1'`)
      2. When saved to Firestore, branches got auto-generated document IDs
      3. The branch object has `id: '1'` but Firestore document ID is different
    - **Solutions Implemented**:
      1. Changed setup to use branch.id as document ID if provided
      2. Changed default branch ID from '1' to 'main' for clarity
      3. Added robust fallback in `updateBranchName`:
         - Try provided branchId first
         - If branchId is '1', also try 'main' (backward compatibility)
         - If single branch exists, update it regardless of ID
    - **Code Changes**:
      ```typescript
      // Setup service now uses branch.id as document ID
      const branchRef = branch.id 
        ? doc(db, 'companies', companyId, 'branches', branch.id)
        : doc(collection(db, 'companies', companyId, 'branches'));
      ```
    - **Prevention**: Always use consistent ID strategies between data model and storage
    - **Migration**: For existing users with mismatched branch IDs, run in browser console:
      ```javascript
      // Get company ID from auth context or user claims
      const companyId = 'your-company-id';
      window.migrateBranchIds(companyId);
      ```

25. **MUI Slider Not Interactive with React Hook Form**:
    - **Error**: Sliders appear non-interactive and don't respond to user input
    - **Root Cause**: Using `{...field}` spread operator with custom `value` and `onChange` properties
    - **Problem**: The spread operator includes field's original `value` and `onChange` which conflict with custom ones
    - **Solution**: Remove `{...field}` and only use custom `value` and `onChange` properties
    - **Example Fix**:
      ```typescript
      // Before (non-interactive):
      <Slider
        {...field}
        value={field.value === 'quiet' ? 1 : 2}
        onChange={(_, value) => field.onChange(value === 1 ? 'quiet' : 'loud')}
      />
      
      // After (interactive):
      <Slider
        value={field.value === 'quiet' ? 1 : 2}
        onChange={(_, value) => field.onChange(value === 1 ? 'quiet' : 'loud')}
      />
      ```
    - **Prevention**: When using custom value transformations, don't spread the field object
    - **Common Pattern**: This affects any controlled component that needs value transformation

26. **Appointment Form Service Duration and Price Display Errors**:
    - **Error**: "[object Object]" displayed instead of duration and price values
    - **Root Cause**: Service duration stored as `{hours: number, minutes: number}` object, not simple number
    - **Solution**: Updated all duration calculations to convert hours+minutes to total minutes:
      ```typescript
      const durationInMinutes = service.duration 
        ? (service.duration.hours || 0) * 60 + (service.duration.minutes || 0)
        : 0;
      ```
    - **Additional Fix**: Changed from non-existent `price` to `startingPrice` property
    - **Currency Fix**: Updated currency display from "$" to "EGP"
    - **Impact**: Fixed service chip labels, total calculations, and appointment data preparation

27. **Client Autocomplete Search Not Working**:
    - **Error**: Client search shows "No options" and constant loading, then white screen crash
    - **Root Cause**: `clientService.getClients()` returns `{clients: Client[], lastDoc}` object, not array
    - **Solution**: Extract clients array from service result:
      ```typescript
      const result = await clientService.getClients(companyId);
      const clientsArray = result?.clients || [];
      setClients(clientsArray);
      ```
    - **MUI Error Fix**: Added array safety checks to prevent `options.filter is not a function`
    - **UX Enhancement**: Added auto-load on dropdown open for better user experience
    - **Prevention**: Always ensure state arrays are properly initialized to prevent filter errors

28. **WhatsApp Notification Business Name and Location Data Issues** (2025-07-22):
    - **Error**: WhatsApp messages showing branch name instead of business name, missing coordinates and phone
    - **Root Causes**:
      1. Business name priority was using `locationName` before `businessName`
      2. Location contact details were being replaced instead of merged when updating
      3. Appointments created without branch ID defaulted to 'main' which had no data
    - **Solutions Implemented**:
      1. Fixed business name priority in `appointment.service.ts`:
         ```typescript
         const businessName = locationSettings?.basic?.businessName || 
                             locationSettings?.basic?.locationName || 
                             company?.businessName || 
                             company?.name || 
                             'Our Business';
         ```
      2. Fixed contact details merging in `location.service.ts`:
         ```typescript
         const existingContact = existingData.contact || {};
         await updateDoc(docRef, {
           contact: { ...existingContact, ...contactDetails },
           updatedAt: serverTimestamp(),
         });
         ```
      3. Added branch ID to `AppointmentForm` component
      4. Added fallback to load branch '1' settings when 'main' has no data
    - **Impact**: WhatsApp messages now correctly show business name, phone, and Google Maps link
    - **Prevention**: Always include branch ID in appointments, ensure proper data merging in updates

29. **Missing Routes Error (No routes matched location)**:
    - **Error**: "No routes matched location '/settings/branches/new'" in console
    - **Root Cause**: Route not defined in App.tsx Routes configuration
    - **Solution**: Add missing routes to App.tsx:
      ```typescript
      // Import the component
      import BranchFormPage from './pages/settings/branches/BranchFormPage';
      
      // Add routes after the main branches route
      <Route path="/settings/branches/new" element={
        <PageTransition>
          <BranchFormPage />
        </PageTransition>
      } />
      <Route path="/settings/branches/:branchId/edit" element={
        <PageTransition>
          <BranchFormPage />
        </PageTransition>
      } />
      ```
    - **Prevention**: Always add all related routes when creating new pages (list, create, edit)

30. **MUI Menu anchorEl Invalid Warning**:
    - **Error**: "The `anchorEl` prop provided to the component is invalid. The anchor element should be part of the document layout."
    - **Root Cause**: Single shared Menu component trying to handle anchor elements from multiple components, causing stale references
    - **Solution**: Move Menu component inside each component that needs it:
      ```typescript
      // Before (causes error - shared menu in parent):
      const ParentComponent = () => {
        const [anchorEl, setAnchorEl] = useState(null);
        return (
          <>
            {items.map(item => <Card onClick={(e) => setAnchorEl(e.currentTarget)} />)}
            <Menu anchorEl={anchorEl} /> {/* Single menu for all cards */}
          </>
        );
      };
      
      // After (works - each card has its own menu):
      const CardComponent = ({ item }) => {
        const [anchorEl, setAnchorEl] = useState(null);
        return (
          <>
            <Card>
              <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} />
            </Card>
            <Menu anchorEl={anchorEl} /> {/* Menu scoped to this card */}
          </>
        );
      };
      ```
    - **Key Points**:
      - Each component should manage its own menu state
      - Menu should be rendered in the same component as its anchor
      - Avoids stale references when components re-render
    - **Prevention**: Always render Menu components close to their anchor elements

### Superadmin Dashboard (2025-07-22 - Evening & 2025-07-23 - Early Morning)
   - ✅ **Secure Access Architecture**:
     - Random 32-character URL hash (e.g., `/sa-7f8e3b2a9c1d4e5f6789abcdef012345/dashboard`)
     - Separate authentication system from regular users
     - Dedicated SuperadminAuthContext for authentication
     - Protected routes with SuperadminProtectedRoute component
     - No public links or references to superadmin area
   - ✅ **Dashboard Implementation**:
     - Created SuperadminLayout with dark theme navigation
     - Implemented SuperadminDashboard with real-time analytics displaying actual data
     - Business management interface with status controls
     - Revenue charts and plan distribution visualization using recharts
     - Real-time business data loading from Firestore companies collection
   - ✅ **Authentication System Fixed (2025-07-23)**:
     - **CRITICAL FIX**: Resolved authentication issue where Firebase auth was signing out immediately after login
     - Fixed SuperadminAuthContext to maintain Firebase session for Firestore access
     - Added comprehensive debugging tools and console logging
     - Implemented proper superadmin document structure validation
     - Added global debug functions: `window.debugSuperadminStatus()` and `window.fixSuperadminDocument(uid)`
   - ✅ **Real Data Integration**:
     - Dashboard successfully loads actual business data from Firestore
     - Platform analytics showing real metrics: 9 businesses, 9 users, plan distribution
     - Recent businesses table displaying actual company names (including Arabic names)
     - Revenue tracking and growth calculations from real subscription data
   - ✅ **Business Management Interface (2025-07-23)**:
     - **BusinessListPage**: Complete business listing with filtering and search
       - Filter by status (Active, Suspended, Pending, Cancelled)
       - Search by business name, email, or business name
       - Paginated results with business cards showing key metrics
       - Action menu for suspend/activate/view details operations
       - Route-based filtering (e.g., `/businesses/active` auto-filters)
     - **BusinessDetailPage**: Comprehensive business management interface
       - 5-tab layout: Overview, Subscription, Usage & Analytics, Contact Info, Billing
       - Real-time business data loading with error handling
       - Business status management (suspend/activate with confirmation dialogs)
       - Edit mode for contact information and business details
       - Subscription plan display with billing information
       - Usage statistics showing appointments, clients, staff, services, storage
       - Navigation breadcrumbs and back-to-list functionality
   - ✅ **Pricing Management System (2025-07-23)**:
     - **PricingManagementPage**: Complete pricing administration interface
       - 4-tab layout: Pricing Plans, Premium Add-ons, Business Overrides, Promotions
       - **Pricing Plans Tab**: Visual plan cards with create/edit functionality
         - Plan configuration: pricing, limits, features, popularity flags
         - Multi-language support (English/Arabic display names and descriptions)
         - Plan activation/deactivation controls
       - **Premium Add-ons Tab**: Table-based add-on management
         - Setup fees and monthly recurring fees
         - Category organization (branding, integration, analytics, automation)
         - Add-on creation and editing with dialog forms
       - Route-based tab switching (URLs control active tab)
       - Integration with pricing.service.ts for CRUD operations
   - ✅ **System Announcements (2025-07-23)**:
     - **AnnouncementsPage**: Platform-wide communication system
       - Create and manage system announcements for businesses
       - Target audience selection (All, Active, Specific Plans, Custom)
       - Draft/send immediately functionality
       - Announcement history with status tracking
       - Rich text messaging with title and description
       - Integration with superadmin.service.ts sendAnnouncement method
   - ✅ **Enhanced Navigation & Routing**:
     - Added all superadmin routes to App.tsx with proper nesting
     - Business list routes: `/businesses`, `/businesses/active`, `/businesses/suspended`, `/businesses/pending`
     - Business detail route: `/businesses/:businessId`
     - Pricing routes: `/pricing/plans`, `/pricing/overrides`, `/pricing/addons`, `/pricing/promotions`
     - Communications route: `/communications/announcements`
     - Route-based state management (URL changes automatically set filters/tabs)
   - ✅ **Pricing System Architecture**:
     - Dynamic pricing plans (Starter: 597 EGP, Professional: 1,797 EGP, Business: 3,897 EGP)
     - Premium add-ons (White-label: 10,000 EGP + 1,000/month, Mobile App: 35,000 EGP + 2,500/month)
     - Grandfathering system for legacy pricing
     - Business-level pricing overrides
     - Public API for landing page pricing
   - ✅ **Services Created**:
     - `pricing.service.ts` - Pricing plans, overrides, and calculations
     - `superadmin.service.ts` - Business management and analytics with real-time data
   - ✅ **Firestore Security**:
     - Added superadmin collections with restricted access
     - Helper function `isSuperadmin()` for authorization
     - Deployed updated Firestore rules allowing superadmin access to companies collection
     - Audit logging for all superadmin actions
     - Public read access for pricing configs
   - ✅ **Technical Fixes Applied**:
     - Fixed missing imports and circular dependencies (Calendar icon → CalendarToday)
     - Simplified analytics queries for better performance
     - Added proper error handling and fallback data
     - Removed external API dependencies that caused connection errors
     - Fixed CompanySubscription interface import issues
     - Proper TypeScript types and import statements
   - ✅ **Setup Documentation**:
     - Created SUPERADMIN_SETUP.md with detailed instructions
     - Node.js script for creating superadmin users
     - Security best practices and warnings
   
   **Note**: Superadmin system is functional but needs UI/UX enhancements and Arabic language support for production use.

## Feature Development Roadmap (Prioritized by Business Impact)

### 🔥 Phase 1: Revenue Protection & Growth (CRITICAL - 5-6 weeks)
**Goal**: Immediate impact on revenue through better financial visibility and customer retention

#### 1.1 Fix & Enhance Financial Analytics (Week 1)
- **Current Issues**:
  - FinanceReportsPage transaction filtering errors (FIXED)
  - Limited financial insights
  - No profit/loss statements
- **Deliverables**:
  - Complete financial dashboard with real metrics
  - Profit & Loss statements
  - Cash flow visualization
  - Expense categorization and tracking
  - Multi-period comparisons
- **Dependencies**: finance.service.ts, transaction system, chart libraries

#### 1.2 Customer Retention System (Weeks 2-4)
- **Business Impact**: 20-30% reduction in no-shows, increased repeat bookings
- **Features**:
  - Automated appointment reminders (SMS/WhatsApp/Email)
  - Service follow-up reminders (e.g., "Time for your monthly facial!")
  - Birthday and special occasion greetings
  - Loyalty points system
  - Missed appointment win-back campaigns
- **New Services Needed**:
  - notification.service.ts (SMS/WhatsApp integration)
  - loyalty.service.ts
  - automation.service.ts
- **Dependencies**: client data, appointment system, communication APIs

#### 1.3 Enhanced Business Dashboard (Weeks 5-6)
- **Current State**: Basic dashboard with placeholder data
- **Enhancements**:
  - Real-time KPI dashboard
  - Staff performance rankings and metrics
  - Service profitability analysis
  - Customer lifetime value tracking
  - Booking trends and peak hour analysis
  - Revenue forecasting
- **Dependencies**: All existing services for data aggregation

### 📊 Phase 2: Operational Excellence (MEDIUM - 3-4 weeks)

#### 2.1 Complete POS Transaction Recording
- **Current Gaps**: Transaction recording might be incomplete
- **Features**:
  - Ensure all sales update inventory
  - Payment method tracking
  - Cash drawer reconciliation
  - Daily sales reports
  - Receipt customization
- **Dependencies**: sale.service.ts, inventory.service.ts, finance.service.ts

#### 2.2 Inventory Management Enhancements
- **Current State**: Basic inventory tracking exists
- **Enhancements**:
  - Low stock alerts with customizable thresholds
  - Expiry date tracking for products
  - Stock movement history and audit trail
  - Supplier management and purchase orders
  - Barcode scanning support
  - Stock take and adjustment features
- **New Features**: supplier.service.ts, stockAlert.service.ts

### 💰 Phase 3: Staff & Financial Management (MEDIUM - 4-5 weeks)

#### 3.1 Staff Commission & Performance System
- **Features**:
  - Commission calculation rules (percentage, fixed, tiered)
  - Service-based commission tracking
  - Performance bonuses
  - Tips tracking and distribution
  - Monthly commission reports
- **Dependencies**: staff.service.ts, appointment data, sales data

#### 3.2 Basic Payroll Management
- **Features**:
  - Salary calculation with deductions
  - Commission integration
  - Leave management
  - Payslip generation
  - Export to accounting software
- **New Services**: payroll.service.ts, leave.service.ts

### 📱 Phase 4: Advanced Features (LOWER PRIORITY)

#### 4.1 Marketing Campaigns
- Email campaign builder
- SMS blast messaging
- Customer segmentation
- Campaign analytics

#### 4.2 Advanced Analytics
- Predictive analytics
- Customer churn prediction
- Demand forecasting
- Business intelligence dashboard

#### 4.3 Mobile Applications
- Staff mobile app (React Native)
- Customer booking app
- Owner dashboard app

## Implementation Approach

### Before Starting Each Phase:
1. **Full System Analysis**
   - Map all related components and services
   - Identify dependencies and connections
   - Review existing code for reusability
   - Plan database schema changes

2. **Research & Best Practices**
   - Industry-specific requirements
   - Compliance and regulations
   - User experience patterns
   - Performance considerations

3. **Technical Planning**
   - API design and endpoints
   - State management approach
   - Database indexing needs
   - Security considerations

### Quality Assurance:
- Unit tests for critical business logic
- Integration tests for workflows
- Performance testing for large datasets
- Security audit for sensitive features

## Current System Architecture Overview

### Core Services:
- **Client Management**: client.service.ts, clientVisit.service.ts
- **Appointment System**: appointment.service.ts, calendar components
- **Staff Management**: staff.service.ts, schedule management
- **Financial System**: finance.service.ts, transaction tracking
- **Inventory**: inventory.service.ts, product management
- **POS**: sale.service.ts, checkout flow

### Key Integrations:
- Firebase Auth for user management
- Firestore for real-time data
- Firebase Storage for images
- Branch-based multi-tenancy
- Role-based access control

### Technical Debt to Address:
- Standardize error handling across services
- Implement proper TypeScript types
- Add loading states consistently
- Improve offline capabilities
- Optimize Firestore queries