# Clients+ Complete System Documentation

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Authentication & Authorization](#authentication--authorization)
4. [Multi-Tenant Architecture](#multi-tenant-architecture)
5. [Main Dashboard Application](#main-dashboard-application)
   - [Setup Wizard](#setup-wizard)
   - [User Management](#user-management)
   - [Client Management](#client-management)
   - [Appointment System](#appointment-system)
   - [Staff Management](#staff-management)
   - [Service Management](#service-management)
   - [Financial System](#financial-system)
   - [Cash Register System](#cash-register-system)
   - [Inventory Management](#inventory-management)
   - [Point of Sale (POS)](#point-of-sale-pos)
   - [Branch Management](#branch-management)
   - [Work Schedule System](#work-schedule-system)
   - [Categories System](#categories-system)
   - [Location Settings](#location-settings)
   - [Resources Management](#resources-management)
   - [Communication System](#communication-system)
6. [Superadmin Dashboard](#superadmin-dashboard)
7. [Online Booking Application](#online-booking-application)
8. [Mobile Applications](#mobile-applications)
9. [Integrations](#integrations)
10. [Security Implementation](#security-implementation)
11. [Database Schema](#database-schema)
12. [API Structure](#api-structure)
13. [Deployment & Infrastructure](#deployment--infrastructure)
14. [Future Roadmap](#future-roadmap)

---

## System Overview

Clients+ is a comprehensive multi-tenant SaaS platform designed for Egyptian beauty salons, spas, and service-based businesses. The system provides complete business management capabilities including appointment scheduling, client management, financial tracking, inventory control, and staff management.

### Key Components:
1. **Main Dashboard** - Business management portal
2. **Superadmin Dashboard** - Platform administration
3. **Online Booking App** - Customer-facing booking interface
4. **Mobile Apps** (Planned) - iOS/Android applications

### Technology Stack:
- **Frontend**: React 18 with TypeScript
- **UI Framework**: Material-UI v6
- **State Management**: React Context API
- **Backend**: Firebase (Firestore, Auth, Functions, Storage)
- **Build Tool**: Vite
- **Styling**: Emotion CSS-in-JS
- **Animations**: Framer Motion
- **Forms**: React Hook Form
- **Routing**: React Router v6
- **Internationalization**: Arabic (primary) and English

---

## Architecture

### Frontend Architecture

```
/dashboard
├── /src
│   ├── /components      # Reusable UI components
│   ├── /contexts        # React Context providers
│   ├── /pages          # Page components
│   ├── /services       # Business logic and API calls
│   ├── /types          # TypeScript type definitions
│   ├── /utils          # Helper functions
│   ├── /hooks          # Custom React hooks
│   └── /config         # Configuration files
```

### Backend Architecture

```
Firebase Services:
├── Authentication      # User authentication
├── Firestore          # NoSQL database
├── Cloud Functions    # Serverless functions
├── Storage           # File storage
├── Hosting          # Web hosting
└── Security Rules   # Access control
```

### Data Flow
1. **User Action** → React Component
2. **Component** → Service Layer
3. **Service** → Firebase API
4. **Firebase** → Security Rules Validation
5. **Database** → Data Operation
6. **Response** → Component Update

---

## Authentication & Authorization

### Authentication Flow

```typescript
// Authentication States
1. Anonymous User → Login Page
2. Email/Password Authentication → Firebase Auth
3. Token Generation → Custom Claims (companyId, role)
4. Context Provider → Global Auth State
5. Protected Routes → Role-Based Access
```

### Implementation Details

#### AuthContext (`/src/contexts/AuthContext.tsx`)
```typescript
interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}
```

#### Key Features:
- Email/password authentication
- Remember me functionality
- Password reset via email
- Automatic token refresh
- Custom claims for company association

### Authorization Levels

1. **System Roles**:
   - `superadmin` - Platform administrators
   - `owner` - Business owner
   - `admin` - Full business access
   - `manager` - Management features
   - `employee` - Limited access
   - `receptionist` - Front desk operations

2. **Permission System**:
   ```typescript
   interface UserPermissions {
     canViewFinancials: boolean;
     canEditStaff: boolean;
     canManageServices: boolean;
     canAccessReports: boolean;
     canManageInventory: boolean;
     canProcessPayments: boolean;
   }
   ```

---

## Multi-Tenant Architecture

### Design Principles
1. **Complete Data Isolation** - Each company's data is segregated
2. **Company-Scoped Queries** - All queries filtered by companyId
3. **Hierarchical Data Structure** - `/companies/{companyId}/...`
4. **Branch Support** - Multi-location businesses

### Implementation

#### Firestore Structure
```
/companies
  /{companyId}
    /clients
    /appointments
    /staff
    /services
    /financialAccounts
    /inventory
    /branches
      /{branchId}
        /locationSettings
        /schedules
```

#### Security Rules Pattern
```javascript
match /companies/{companyId}/{document=**} {
  allow read, write: if isAuthenticated() && 
    belongsToCompany(companyId);
}
```

---

## Main Dashboard Application

### Setup Wizard

**Purpose**: Onboard new businesses through a guided setup process.

**Components**:
- `SetupWizard.tsx` - Main wizard container
- `BusinessInfoStep.tsx` - Business details collection
- `BranchStep.tsx` - Location setup
- `TeamStep.tsx` - Team size configuration
- `ThemeStep.tsx` - Branding customization

**Flow**:
1. Business Information
   - Company name (Arabic/English)
   - Business type selection
   - Contact details
   - Address information

2. Branch Setup
   - Main location details
   - Operating hours
   - Contact information

3. Team Configuration
   - Team size selection
   - Initial user setup

4. Theme Selection
   - Color scheme
   - Logo upload
   - Branding preferences

**Technical Implementation**:
```typescript
// Setup completion check
const checkSetupStatus = async (userId: string) => {
  const userDoc = await getDoc(doc(db, 'users', userId));
  return userDoc.data()?.setupCompleted || false;
};
```

---

### User Management

**Features**:
- User profile management
- Profile photo upload
- Role assignment
- Permission management
- Activity tracking

**Key Components**:
- `UserProfile.tsx` - Profile editing interface
- `UserList.tsx` - User management table
- `UserPermissions.tsx` - Permission assignment

**Profile Management Flow**:
1. Load user data from Firestore
2. Display editable form fields
3. Handle profile photo upload to Storage
4. Update user document
5. Sync with authentication profile

**Technical Details**:
```typescript
interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  photoURL?: string;
  role: UserRole;
  companyId: string;
  branchIds?: string[];
  permissions: UserPermissions;
  lastActive: Timestamp;
  createdAt: Timestamp;
}
```

---

### Client Management

**Purpose**: Comprehensive customer relationship management.

**Features**:
- Client profiles with photos
- Contact information management
- Visit history tracking
- Preference management
- Duplicate detection system
- Communication logs
- Transaction history
- Loyalty tracking

**Components Structure**:
```
/clients
├── ClientsList.tsx        # Main listing with search/filter
├── ClientForm.tsx         # Multi-tab creation/edit form
├── ClientDetail.tsx       # Detailed client view
├── ClientDuplicate.tsx    # Duplicate detection dialog
└── /services
    └── client.service.ts  # Business logic
```

**Client Data Model**:
```typescript
interface Client {
  id?: string;
  companyId: string;
  branchId?: string;
  
  // Basic Information
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  secondaryPhone?: string;
  dateOfBirth?: Timestamp;
  gender?: 'male' | 'female' | 'other';
  
  // Address
  address?: ClientAddress;
  
  // Preferences
  preferences?: ClientPreferences;
  
  // Medical Information
  medicalInfo?: MedicalInfo;
  
  // System Fields
  status: 'active' | 'inactive' | 'blocked';
  source?: 'walk-in' | 'online' | 'referral' | 'social-media';
  tags?: string[];
  notes?: string;
  avatar?: string;
  
  // Metrics
  totalVisits?: number;
  totalSpent?: number;
  lastVisit?: Timestamp;
  loyaltyPoints?: number;
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}
```

**Duplicate Detection Algorithm**:
1. Phone number exact match (Score: 100)
2. Email exact match (Score: 80)
3. Name similarity using Levenshtein distance (Score: 0-60)
4. Date of birth match (Score: 40)
5. Combined score threshold: 70+ triggers warning

---

### Appointment System

**Purpose**: Complete appointment scheduling and management system.

**Features**:
- Calendar views (Day, Week, Month)
- Drag-and-drop rescheduling
- Service selection with duration/pricing
- Staff assignment with availability checking
- Resource booking
- Recurring appointments
- SMS/WhatsApp notifications
- Online booking integration
- Color coding by status

**Component Architecture**:
```
/appointments
├── AppointmentsPage.tsx      # Main container
├── AppointmentPanel.tsx      # Sliding panel for details
├── AppointmentForm.tsx       # Booking form
├── CalendarViews/
│   ├── CalendarDayView.tsx   # Daily staff columns
│   ├── CalendarWeekView.tsx  # Weekly grid view
│   └── CalendarMonthView.tsx # Monthly overview
├── ServiceSelection.tsx      # Service picker
├── TimeSlotPicker.tsx       # Available slots
└── RecurringSettings.tsx    # Repeat configuration
```

**Appointment Data Model**:
```typescript
interface Appointment {
  id?: string;
  companyId: string;
  branchId: string;
  
  // Client Information
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  
  // Service Details
  services: AppointmentService[];
  totalDuration: number; // minutes
  totalPrice: number;
  
  // Scheduling
  date: Timestamp;
  startTime: string; // "HH:mm"
  endTime: string;
  
  // Staff Assignment
  staffId: string;
  staffName: string;
  
  // Status Management
  status: 'pending' | 'confirmed' | 'arrived' | 'in-progress' | 
          'completed' | 'cancelled' | 'no-show';
  
  // Resources
  resources?: string[];
  
  // Source Tracking
  source: 'dashboard' | 'online' | 'phone' | 'walk-in';
  
  // Recurring
  isRecurring?: boolean;
  recurringPattern?: RecurringPattern;
  recurringGroupId?: string;
  
  // Colors & Display
  color?: string;
  
  // Communication
  notifications?: NotificationSettings;
  confirmationSent?: boolean;
  reminderSent?: boolean;
  
  // Additional Info
  notes?: string;
  internalNotes?: string;
  
  // Metadata
  createdAt: Timestamp;
  createdBy: string;
  updatedAt?: Timestamp;
  updatedBy?: string;
}
```

**Time Slot Algorithm**:
1. Get staff working hours for selected date
2. Generate 15-minute interval slots
3. Check existing appointments for conflicts
4. Filter slots by service duration
5. Mark unavailable slots
6. Consider break times and buffer periods

**Notification Flow**:
```
Appointment Created → Check Notification Settings
  ├── Immediate Confirmation
  │   ├── SMS (Twilio integration)
  │   └── WhatsApp (API integration)
  └── Reminder Schedule
      ├── 24 hours before
      ├── 2 hours before
      └── Custom timing
```

---

### Staff Management

**Purpose**: Comprehensive employee management system.

**Features**:
- Staff profiles with role-based access
- Service assignment
- Schedule management with templates
- Multi-branch assignment
- Performance tracking
- Commission calculations
- Online booking availability
- Working hours configuration

**Components**:
```
/staff
├── StaffList.tsx           # Main listing
├── StaffForm.tsx          # Creation/editing
├── StaffDetail.tsx        # Detailed view with tabs
├── /tabs
│   ├── InformationTab.tsx # Profile & access
│   ├── ServicesTab.tsx    # Service assignment
│   ├── ScheduleTab.tsx    # Working hours
│   └── SettingsTab.tsx    # Additional config
```

**Staff Data Model**:
```typescript
interface Staff {
  id?: string;
  companyId: string;
  branchIds: string[];  // Multi-branch support
  
  // Personal Information
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  avatar?: string;
  
  // Employment Details
  positionId: string;
  employeeCode?: string;
  hireDate: Timestamp;
  status: 'active' | 'inactive' | 'on-leave' | 'terminated';
  
  // Access Control
  accessLevel: 'employee' | 'receptionist' | 'manager' | 
               'administrator' | 'owner' | 'no-access';
  hasAppAccess: boolean;
  appInviteSent?: boolean;
  userId?: string; // Firebase Auth UID
  
  // Services & Skills
  services: string[]; // Service IDs
  specializations?: string[];
  certifications?: Certification[];
  
  // Schedule
  schedule?: WorkSchedule;
  scheduledUntil?: Timestamp;
  workingDays: number[]; // 0-6 (Sun-Sat)
  
  // Online Booking
  onlineBooking: boolean;
  bookingColor?: string;
  bufferTime?: number; // minutes between appointments
  
  // Performance
  rating?: number;
  completedAppointments?: number;
  totalRevenue?: number;
  
  // Commission
  commissionRate?: number;
  commissionType?: 'percentage' | 'fixed';
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}
```

**Schedule Management**:
- Template-based scheduling (Full-time, Part-time, etc.)
- 7x24 grid interface for hour selection
- Dot-based visualization
- Copy schedule to future weeks
- Integration with appointment availability

---

### Service Management

**Purpose**: Service catalog and pricing management.

**Features**:
- Service categories with hierarchy
- Multi-language support (14 languages)
- Dynamic pricing with VAT
- Duration management
- Online booking configuration
- Resource requirements
- Image galleries
- Service packages
- Follow-up day settings

**Service Structure**:
```typescript
interface Service {
  id?: string;
  companyId: string;
  branchIds: string[]; // Multi-branch
  
  // Basic Information
  name: string;
  nameAr: string;
  description?: string;
  descriptionAr?: string;
  
  // Translations
  translations?: {
    [languageCode: string]: {
      name: string;
      description?: string;
    }
  };
  
  // Categorization
  categoryId: string;
  subcategoryId?: string;
  tags?: string[];
  
  // Pricing
  price?: number; // Deprecated
  startingPrice: number;
  priceType: 'fixed' | 'starting' | 'variable';
  priceList?: PriceVariation[];
  
  // Duration
  duration: {
    hours: number;
    minutes: number;
  };
  processingTime?: number; // Buffer time
  
  // Settings
  active: boolean;
  onlineBooking: boolean;
  onlineBookingName?: string;
  requiresConsultation: boolean;
  
  // Resources
  requiredResources?: string[];
  maxParallelBookings?: number;
  
  // Images
  images?: ServiceImage[];
  defaultImageIndex?: number;
  
  // Advanced Options
  vatRate?: number;
  vatInclusive: boolean;
  followUpDays?: number;
  autoDeductFromPackage?: boolean;
  
  // Gender Restrictions
  gender?: 'all' | 'male' | 'female';
  
  // Metadata
  sortOrder?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

### Financial System

**Purpose**: Complete financial management for the business.

**Major Components**:
1. **Financial Accounts** - Multi-account management
2. **Transaction Recording** - Income/expense tracking
3. **Financial Reports** - P&L, cash flow, analytics
4. **Expense Categories** - Categorized expense tracking
5. **Digital Wallet Integration** - Egyptian payment methods
6. **Multi-Currency Support** - With EGP as primary

**Account Types**:
- Cash accounts
- Bank accounts
- Digital wallets (Vodafone Cash, Orange Money, etc.)
- Credit card terminals
- Other payment methods

**Financial Account Model**:
```typescript
interface FinancialAccount {
  id?: string;
  companyId: string;
  branchId?: string;
  
  // Account Details
  name: string;
  nameAr?: string;
  type: 'cash' | 'bank' | 'digital_wallet' | 'credit_card' | 'other';
  
  // Bank Details
  bankName?: string;
  accountNumber?: string;
  iban?: string;
  swiftCode?: string;
  
  // Digital Wallet
  digitalWalletType?: 'vodafone_cash' | 'orange_money' | 
                      'etisalat_cash' | 'we_pay' | 'instapay';
  walletPhoneNumber?: string;
  
  // Balances
  openingBalance: number;
  openingDate: Timestamp;
  currentBalance: number;
  
  // Settings
  status: 'active' | 'inactive' | 'closed';
  isDefault: boolean;
  allowNegativeBalance: boolean;
  lowBalanceThreshold?: number;
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}
```

**Transaction Processing Flow**:
```
Transaction Entry → Validation → Account Balance Update
  ├── Income: Add to balance
  ├── Expense: Deduct from balance
  └── Transfer: Update both accounts
```

**Financial Reports**:
1. **Income Statement** (P&L)
   - Revenue by category
   - Expense breakdown
   - Net profit calculation
   - Period comparisons

2. **Cash Flow Statement**
   - Operating activities
   - Investment activities
   - Financing activities
   - Cash position tracking

3. **Account Statements**
   - Transaction history
   - Running balance
   - Reconciliation support

---

### Cash Register System

**Purpose**: Point-of-sale cash management with multi-account support.

**Recent Enhancement**: Complete redesign to support multiple financial accounts with variance tracking.

**Features**:
- Multi-account opening/closing
- Variance tracking per account
- Account transfer functionality
- Cash drop management
- Shift reconciliation
- Movement tracking
- Audit trail

**Core Components**:
```
/register
├── CashRegisterPage.tsx      # Main register interface
├── /components
│   ├── DenominationCounter   # Cash counting interface
│   ├── AccountBalanceTable   # Multi-account display
│   └── MovementHistory       # Transfer tracking
```

**Shift Session Model**:
```typescript
interface ShiftSession {
  id?: string;
  companyId: string;
  branchId: string;
  registerId: string;
  
  // Employee Information
  employeeId: string;
  employeeName: string;
  
  // Opening Data
  openedAt: Timestamp;
  openingCashTotal: number;
  declaredOpeningCash: DenominationCount;
  
  // Multi-Account Support
  accountBalances: Record<string, AccountBalance>;
  linkedAccounts: string[];
  
  // Transaction Totals
  totalSales: number;
  totalRefunds: number;
  totalPayIns: number;
  totalPayOuts: number;
  totalCashDrops: number;
  netCashFlow: number;
  
  // Closing Data
  closedAt?: Timestamp;
  closingCashTotal?: number;
  expectedCash?: number;
  cashVariance?: number;
  varianceCategory?: 'over' | 'short' | 'exact';
  
  // Status
  status: 'active' | 'closing' | 'closed' | 'suspended';
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Account Movement Tracking**:
```typescript
interface AccountMovement {
  id?: string;
  shiftId: string;
  accountId: string;
  accountName: string;
  movementType: 'sale' | 'refund' | 'transfer' | 'fee' | 'adjustment';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  reference?: string;
  description?: string;
  timestamp: Timestamp;
  performedBy: string;
}
```

**Cash Register Workflow**:
1. **Opening Shift**
   - Count physical cash
   - Set expected balances for all accounts
   - Record opening variances
   - Activate shift

2. **During Shift**
   - Record sales/refunds
   - Transfer between accounts
   - Perform cash drops
   - Track all movements

3. **Closing Shift**
   - Count all accounts
   - Calculate variances
   - Review movements
   - Reconcile and close

---

### Inventory Management

**Purpose**: Product inventory tracking and management.

**Features**:
- Product catalog with categories
- Stock level tracking
- Low stock alerts
- Stock movements (in/out)
- Supplier management
- Purchase orders
- Barcode support
- Expiry date tracking
- Multi-location inventory

**Product Model**:
```typescript
interface Product {
  id?: string;
  companyId: string;
  
  // Basic Information
  name: string;
  nameAr?: string;
  description?: string;
  sku: string;
  barcode?: string;
  
  // Categorization
  categoryId: string;
  brandId?: string;
  type: 'product' | 'supply' | 'equipment';
  
  // Inventory
  trackInventory: boolean;
  currentStock: number;
  lowStockThreshold?: number;
  optimalStock?: number;
  unit: string; // pieces, ml, g, etc.
  
  // Pricing
  costPrice: number;
  retailPrice: number;
  wholesalePrice?: number;
  
  // Supplier
  supplierId?: string;
  supplierSku?: string;
  leadTime?: number; // days
  
  // Settings
  status: 'active' | 'inactive' | 'discontinued';
  expiryTracking: boolean;
  
  // Images
  images?: string[];
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Inventory Transaction Types**:
1. **Purchase** - Stock in from supplier
2. **Sale** - Stock out to customer
3. **Adjustment** - Manual corrections
4. **Transfer** - Between locations
5. **Damage** - Damaged goods
6. **Return** - Customer/supplier returns

---

### Point of Sale (POS)

**Purpose**: Streamlined checkout and payment processing.

**Features**:
- Quick sale interface
- Barcode scanning
- Multiple payment methods
- Receipt printing
- Customer selection
- Discount application
- Tax calculation
- Integration with inventory
- Daily sales reports

**Sale Transaction Model**:
```typescript
interface Sale {
  id?: string;
  companyId: string;
  branchId: string;
  
  // Transaction Details
  invoiceNumber: string;
  date: Timestamp;
  status: 'completed' | 'pending' | 'cancelled' | 'refunded';
  
  // Customer
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  
  // Items
  items: SaleItem[];
  
  // Totals
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  discountType?: 'percentage' | 'fixed';
  totalAmount: number;
  
  // Payment
  paymentMethod: PaymentMethod;
  paymentDetails?: PaymentDetails;
  
  // Staff
  staffId: string;
  commissionAmount?: number;
  
  // Register
  registerId?: string;
  shiftId?: string;
  
  // Metadata
  notes?: string;
  createdAt: Timestamp;
  createdBy: string;
}
```

---

### Branch Management

**Purpose**: Multi-location business support.

**Features**:
- Branch creation and management
- Location-specific settings
- Staff assignment to branches
- Service availability per branch
- Branch-specific reporting
- Operating hours per location
- Branch switching in UI

**Branch Model**:
```typescript
interface Branch {
  id: string;
  companyId: string;
  
  // Basic Information
  name: string;
  nameAr?: string;
  code: string;
  type: 'main' | 'branch' | 'kiosk' | 'mobile';
  
  // Contact
  phone: string;
  email?: string;
  whatsapp?: string;
  
  // Address
  address: {
    street: string;
    area?: string;
    city: string;
    governorate?: string;
    postalCode?: string;
    country: string;
  };
  
  // Location
  coordinates?: {
    lat: number;
    lng: number;
  };
  
  // Settings
  status: 'active' | 'inactive' | 'coming-soon';
  onlineBooking: boolean;
  autoConfirmBooking: boolean;
  
  // Operating Hours
  businessHours?: BusinessHours;
  holidays?: Holiday[];
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

### Work Schedule System

**Purpose**: Centralized staff scheduling view.

**Features**:
- Calendar grid showing all staff
- Week and month views
- Schedule templates
- Drag-and-drop editing
- Hour tracking
- Position filtering
- Export capabilities
- Integration with appointments

**Implementation**:
- Real-time aggregation from staff schedules
- Visual hour blocks
- Click-to-edit functionality
- Automatic availability updates

---

### Categories System

**Purpose**: Flexible categorization for various entities.

**Types**:
1. **Client Categories** - Customer segmentation
2. **Service Categories** - Service organization
3. **Product Categories** - Inventory grouping
4. **Expense Categories** - Financial categorization
5. **Appointment Categories** - Booking types

**Features**:
- Hierarchical structure
- Custom colors and icons
- Multi-language names
- Sort ordering
- Active/inactive states

---

### Location Settings

**Purpose**: Business location and branding configuration.

**Features**:
- Business information management
- Logo and banner uploads
- Contact details
- Business hours with breaks
- Google Maps integration
- Photo galleries
- Multi-language descriptions
- Social media links

**Tabs**:
1. **Basic Settings** - Name, category, localization
2. **Contact Details** - Phone, email, website
3. **Business Hours** - Operating schedule
4. **Map** - Location picker
5. **Photos** - Gallery management

---

### Resources Management

**Purpose**: Manage physical resources (rooms, equipment).

**Features**:
- Resource catalog
- Capacity management
- Service linking
- Availability tracking
- Booking conflict prevention
- Maintenance scheduling

**Resource Model**:
```typescript
interface Resource {
  id?: string;
  companyId: string;
  
  name: string;
  type: 'room' | 'equipment' | 'station';
  capacity: number;
  
  services: string[]; // Linked services
  status: 'available' | 'maintenance' | 'retired';
  
  description?: string;
  notes?: string;
}
```

---

### Communication System

**Purpose**: Customer communication management.

**Planned Features**:
- SMS integration (Twilio)
- WhatsApp Business API
- Email campaigns
- Notification templates
- Communication logs
- Automated reminders
- Marketing campaigns
- Customer feedback

---

## Superadmin Dashboard

**Purpose**: Platform administration and monitoring.

**Access**: Hidden URL pattern - `/sa-{random-hash}/dashboard`

**Features**:
1. **Analytics Dashboard**
   - Total businesses
   - Active users
   - Revenue metrics
   - Growth charts
   - Plan distribution

2. **Business Management**
   - Business listing with search
   - Status management (suspend/activate)
   - Detailed business views
   - Usage statistics
   - Subscription management

3. **Pricing Management**
   - Plan configuration
   - Add-on management
   - Business-specific overrides
   - Promotional pricing

4. **System Announcements**
   - Platform-wide messaging
   - Targeted announcements
   - Communication history

**Security**:
- Separate authentication system
- Firestore document validation
- No public links or references
- Audit logging for all actions

---

## Online Booking Application

**Status**: Planned/In Development

**Purpose**: Customer-facing booking interface.

**Planned Features**:
- Business discovery
- Service browsing
- Staff selection
- Available slot viewing
- Booking creation
- Payment processing
- Booking management
- Review system

**Architecture**:
- Separate React application
- Shared Firestore database
- Public-facing routes
- Mobile-responsive design

---

## Mobile Applications

**Status**: Future Development

**Planned Apps**:
1. **Business Owner App**
   - Dashboard metrics
   - Appointment management
   - Staff communication
   - Financial overview

2. **Staff App**
   - Schedule viewing
   - Appointment details
   - Client information
   - Commission tracking

3. **Customer App**
   - Booking management
   - Loyalty program
   - Payment history
   - Reviews and ratings

---

## Integrations

### Current Integrations:
1. **Firebase Services**
   - Authentication
   - Real-time database
   - File storage
   - Cloud functions

2. **Google Maps**
   - Location selection
   - Address autocomplete
   - Map display

### Planned Integrations:
1. **Payment Gateways**
   - PayMob (Egypt)
   - Stripe
   - Cash payment tracking

2. **Communication**
   - Twilio (SMS)
   - WhatsApp Business API
   - SendGrid (Email)

3. **Accounting**
   - QuickBooks export
   - Excel/CSV export

4. **Marketing**
   - Google Analytics
   - Facebook Pixel
   - Marketing automation

---

## Security Implementation

### Authentication Security:
1. **Password Requirements**
   - Minimum 8 characters
   - Firebase Auth validation
   - Secure reset flow

2. **Session Management**
   - Token-based authentication
   - Automatic refresh
   - Secure logout

### Data Security:
1. **Firestore Rules**
   - Company-based isolation
   - Role-based access
   - Field-level security

2. **File Upload Security**
   - File type validation
   - Size limits
   - Virus scanning (planned)

3. **API Security**
   - HTTPS only
   - CORS configuration
   - Rate limiting

### Privacy:
1. **Data Isolation**
   - Complete tenant separation
   - No cross-company access
   - Audit trails

2. **Compliance**
   - GDPR considerations
   - Data retention policies
   - User consent tracking

---

## Database Schema

### Core Collections:

1. **companies**
   ```
   /companies/{companyId}
     - name
     - nameAr
     - businessType
     - subscription
     - settings
     - createdAt
     - updatedAt
   ```

2. **users**
   ```
   /users/{uid}
     - email
     - displayName
     - companyId
     - role
     - permissions
     - profile
   ```

3. **Company Subcollections**:
   - `/companies/{companyId}/clients`
   - `/companies/{companyId}/appointments`
   - `/companies/{companyId}/staff`
   - `/companies/{companyId}/services`
   - `/companies/{companyId}/financialAccounts`
   - `/companies/{companyId}/financialTransactions`
   - `/companies/{companyId}/products`
   - `/companies/{companyId}/sales`
   - `/companies/{companyId}/branches`
   - `/companies/{companyId}/shiftSessions`
   - `/companies/{companyId}/categories`

### Indexing Strategy:
- Composite indexes for common queries
- Single-field indexes for sorting
- Array-contains indexes for filtering

---

## API Structure

### Service Layer Pattern:
```typescript
class ServiceName {
  // CRUD Operations
  async create(data: Type): Promise<string>
  async update(id: string, data: Partial<Type>): Promise<void>
  async delete(id: string): Promise<void>
  async get(id: string): Promise<Type | null>
  async list(filters?: Filters): Promise<Type[]>
  
  // Real-time
  subscribe(callback: (items: Type[]) => void): Unsubscribe
  
  // Business Logic
  async customOperation(): Promise<Result>
}
```

### Cloud Functions:
1. **signupWithCompany** - User creation with claims
2. **sendAppointmentReminder** - Notification scheduling
3. **calculateDailyMetrics** - Analytics aggregation
4. **processPayment** - Payment processing

---

## Deployment & Infrastructure

### Current Setup:
- **Hosting**: Firebase Hosting
- **Database**: Cloud Firestore
- **Authentication**: Firebase Auth
- **Storage**: Firebase Storage
- **Functions**: Cloud Functions
- **Domain**: Custom domain support

### Build & Deploy:
```bash
# Development
npm run dev

# Production Build
npm run build

# Deploy
firebase deploy
```

### Environment Configuration:
- Development: `.env.development`
- Production: `.env.production`
- Firebase config in environment

---

## Future Roadmap

### Phase 1: Core Enhancements (Current)
- ✅ Multi-account cash register
- ✅ Account movement tracking
- 🔄 Cash drop for multiple accounts
- 🔄 Transaction recording integration
- 🔄 Shift summary reports

### Phase 2: Customer Experience
- [ ] Online booking application
- [ ] Customer portal
- [ ] Review system
- [ ] Loyalty program
- [ ] Gift cards

### Phase 3: Advanced Features
- [ ] AI-powered scheduling
- [ ] Predictive analytics
- [ ] Automated marketing
- [ ] Advanced reporting
- [ ] Multi-language support (14 languages)

### Phase 4: Mobile & Integrations
- [ ] Mobile applications
- [ ] Third-party integrations
- [ ] API for external access
- [ ] Webhook system
- [ ] Plugin marketplace

### Phase 5: Scale & Optimize
- [ ] Performance optimization
- [ ] Caching strategy
- [ ] CDN implementation
- [ ] Microservices architecture
- [ ] International expansion

---

## Module Completion Status

### Completed Modules ✅
1. Authentication & Authorization
2. Multi-tenant Architecture
3. Setup Wizard
4. User Management
5. Client Management (with duplicate detection)
6. Appointment System (full implementation)
7. Staff Management (with multi-branch)
8. Service Management (with translations)
9. Financial Accounts
10. Cash Register (with multi-account)
11. Branch Management
12. Work Schedule System
13. Categories System
14. Location Settings
15. Resources Management
16. Basic Inventory
17. Basic POS
18. Superadmin Dashboard (functional)

### In Progress 🔄
1. Account movement tracking (90% complete)
2. Financial Reports (60% complete)
3. Communication System (30% complete)
4. Advanced Inventory features (40% complete)

### Planned 📋
1. Online Booking Application
2. Mobile Applications
3. Advanced Analytics
4. Marketing Automation
5. Third-party Integrations
6. Subscription Management
7. Advanced Reporting
8. API Development

---

## Technical Debt & Improvements

### High Priority:
1. Implement comprehensive error handling
2. Add unit and integration tests
3. Optimize Firestore queries
4. Implement proper caching
5. Add offline support

### Medium Priority:
1. Refactor service layer for consistency
2. Implement proper TypeScript types
3. Add loading states consistently
4. Improve error messages
5. Optimize bundle size

### Low Priority:
1. Add animations consistently
2. Implement dark mode fully
3. Add keyboard shortcuts
4. Improve accessibility
5. Add telemetry

---

## Development Guidelines

### Code Standards:
1. **TypeScript** - Strict mode enabled
2. **React** - Functional components with hooks
3. **Styling** - Emotion with theme consistency
4. **Forms** - React Hook Form for all forms
5. **State** - Context for global, useState for local

### Best Practices:
1. **Security First** - Validate all inputs
2. **Performance** - Lazy load components
3. **Accessibility** - ARIA labels and keyboard nav
4. **Internationalization** - All text translatable
5. **Mobile First** - Responsive design

### Git Workflow:
1. Feature branches from `development`
2. PR reviews required
3. Semantic commit messages
4. Regular rebasing
5. Tagged releases

---

This documentation represents the complete state of the Clients+ system as of the current date, including all implemented features, architecture decisions, and future plans.