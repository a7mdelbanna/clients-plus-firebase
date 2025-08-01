# Comprehensive Expense Management System Plan for Clients+

## Overview
A complete expense management solution tailored for Egyptian beauty salons and spas, integrating with the existing financial system while providing advanced categorization, approval workflows, and analytics.

## System Architecture

### 1. Core Components

#### A. Expense Categories Management
```typescript
interface ExpenseCategory {
  id: string;
  companyId: string;
  parentCategoryId?: string; // For subcategories
  
  // Basic Info
  name: string;
  nameAr: string;
  icon: string;
  color: string;
  
  // Configuration
  requiresApproval: boolean;
  approvalThreshold?: number;
  requiresReceipt: boolean;
  allowRecurring: boolean;
  
  // Budget
  monthlyBudget?: number;
  yearlyBudget?: number;
  budgetAlertThreshold?: number; // Percentage
  
  // Metadata
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Default Categories for Beauty Businesses:**
1. **Space & Facilities** (المكان والمرافق)
   - Rent/Lease (الإيجار)
   - Utilities (المرافق)
   - Maintenance (الصيانة)
   - Cleaning Services (خدمات النظافة)

2. **Staff & Payroll** (الموظفين والرواتب)
   - Salaries (الرواتب)
   - Commissions (العمولات)
   - Benefits (المزايا)
   - Training (التدريب)

3. **Products & Supplies** (المنتجات والمستلزمات)
   - Beauty Products (منتجات التجميل)
   - Tools & Equipment (الأدوات والمعدات)
   - Retail Products (منتجات البيع)
   - Disposables (المستهلكات)

4. **Marketing & Advertising** (التسويق والإعلان)
   - Digital Marketing (التسويق الرقمي)
   - Print Materials (المواد المطبوعة)
   - Events & Promotions (الفعاليات والعروض)

5. **Operations** (العمليات)
   - Licenses & Permits (التراخيص والتصاريح)
   - Insurance (التأمين)
   - Software Subscriptions (اشتراكات البرامج)
   - Professional Services (الخدمات المهنية)

#### B. Expense Transaction Model
```typescript
interface ExpenseTransaction extends FinancialTransaction {
  // Additional expense-specific fields
  expenseDetails: {
    categoryId: string;
    subcategoryId?: string;
    vendorId?: string;
    
    // Receipt Management
    receipts: ExpenseReceipt[];
    
    // Approval Workflow
    approvalStatus: 'pending' | 'approved' | 'rejected' | 'not_required';
    approvalWorkflow?: ApprovalWorkflow;
    
    // Recurring Expense
    isRecurring: boolean;
    recurringDetails?: RecurringExpenseDetails;
    
    // Purchase Order
    purchaseOrderId?: string;
    
    // Additional Details
    billNumber?: string;
    taxInvoiceNumber?: string;
    vatAmount?: number;
    
    // Allocation
    costCenter?: string; // Branch, department, etc.
    project?: string;
  };
}
```

#### C. Receipt Management
```typescript
interface ExpenseReceipt {
  id: string;
  
  // File Info
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  
  // Extracted Data (OCR)
  extractedData?: {
    vendorName?: string;
    amount?: number;
    date?: Date;
    items?: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }>;
    taxNumber?: string;
    vatAmount?: number;
  };
  
  // Processing Status
  ocrStatus: 'pending' | 'processing' | 'completed' | 'failed';
  verificationStatus: 'unverified' | 'verified' | 'disputed';
  
  // Metadata
  uploadedAt: Timestamp;
  uploadedBy: string;
  notes?: string;
}
```

### 2. Approval Workflow System

#### A. Workflow Configuration
```typescript
interface ApprovalWorkflow {
  id: string;
  transactionId: string;
  
  // Workflow Setup
  rules: ApprovalRule[];
  currentStep: number;
  
  // Status
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  
  // History
  approvalHistory: ApprovalAction[];
  
  // Timing
  initiatedAt: Timestamp;
  completedAt?: Timestamp;
  deadline?: Timestamp;
}

interface ApprovalRule {
  step: number;
  approverRole?: string; // 'manager' | 'owner' | 'accountant'
  approverIds?: string[]; // Specific user IDs
  
  conditions: {
    minAmount?: number;
    maxAmount?: number;
    categories?: string[];
    requiresAllApprovers?: boolean; // For multiple approvers
  };
  
  autoApproveConditions?: {
    underAmount?: number;
    trustedVendors?: boolean;
    recurringExpense?: boolean;
  };
}
```

#### B. Approval Actions
```typescript
interface ApprovalAction {
  approverId: string;
  approverName: string;
  action: 'approve' | 'reject' | 'request_info';
  timestamp: Timestamp;
  comments?: string;
  attachments?: string[];
}
```

### 3. Vendor Management

```typescript
interface Vendor {
  id: string;
  companyId: string;
  
  // Basic Info
  name: string;
  nameAr: string;
  type: 'supplier' | 'service_provider' | 'contractor' | 'other';
  
  // Contact Info
  contactPerson?: string;
  phone: string;
  email?: string;
  address?: Address;
  
  // Business Info
  taxNumber?: string;
  commercialRegister?: string;
  website?: string;
  
  // Categories
  categories: string[]; // Which expense categories they provide
  
  // Payment Terms
  paymentTerms: {
    defaultMethod: PaymentMethod;
    creditDays?: number;
    creditLimit?: number;
    earlyPaymentDiscount?: number;
  };
  
  // Performance
  rating?: number;
  totalTransactions: number;
  totalAmount: number;
  averageDeliveryTime?: number;
  
  // Status
  status: 'active' | 'inactive' | 'blocked';
  notes?: string;
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 4. Purchase Order System

```typescript
interface PurchaseOrder {
  id: string;
  companyId: string;
  branchId?: string;
  
  // Order Info
  orderNumber: string;
  vendorId: string;
  
  // Items
  items: PurchaseOrderItem[];
  
  // Amounts
  subtotal: number;
  vatAmount: number;
  discountAmount?: number;
  totalAmount: number;
  
  // Delivery
  deliveryDate?: Date;
  deliveryAddress?: Address;
  
  // Status
  status: 'draft' | 'sent' | 'partial' | 'received' | 'cancelled';
  
  // Approval
  approvalRequired: boolean;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  
  // Related Documents
  quotationId?: string;
  invoiceIds: string[];
  receiptIds: string[];
  
  // Metadata
  createdAt: Timestamp;
  createdBy: string;
  notes?: string;
}

interface PurchaseOrderItem {
  productId?: string; // From inventory
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  receivedQuantity?: number;
}
```

### 5. Budget Management

```typescript
interface Budget {
  id: string;
  companyId: string;
  branchId?: string;
  
  // Period
  type: 'monthly' | 'quarterly' | 'yearly';
  startDate: Date;
  endDate: Date;
  
  // Budget Lines
  categoryBudgets: CategoryBudget[];
  
  // Totals
  totalBudget: number;
  totalAllocated: number;
  
  // Status
  status: 'draft' | 'active' | 'closed';
  
  // Metadata
  createdAt: Timestamp;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: Timestamp;
}

interface CategoryBudget {
  categoryId: string;
  allocatedAmount: number;
  spentAmount: number;
  committedAmount: number; // POs not yet received
  
  // Alerts
  alertThreshold: number; // Percentage
  alertSent: boolean;
  
  // Forecast
  forecastAmount?: number;
  lastYearAmount?: number;
}
```

### 6. Recurring Expenses

```typescript
interface RecurringExpenseDetails {
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  
  // Schedule
  startDate: Date;
  endDate?: Date;
  nextDueDate: Date;
  
  // Amount
  fixedAmount?: number;
  estimatedAmount?: number;
  
  // Auto-creation
  autoCreate: boolean;
  daysBeforeDue: number; // Create X days before due
  
  // Notifications
  reminderDays: number[]; // Remind X days before
  
  // History
  occurrences: Array<{
    dueDate: Date;
    transactionId?: string;
    amount: number;
    status: 'pending' | 'paid' | 'overdue' | 'skipped';
  }>;
}
```

## UI Components

### 1. Expense Dashboard
- **Overview Cards**: Total expenses, pending approvals, budget status
- **Category Breakdown**: Pie chart with drill-down
- **Recent Expenses**: List with quick actions
- **Budget vs Actual**: Visual comparison
- **Alerts**: Overbudget categories, pending approvals

### 2. Expense Entry Form
- **Quick Entry**: Amount, category, vendor
- **Receipt Upload**: Camera/gallery with OCR
- **Category Selection**: Hierarchical with search
- **Vendor Selection**: Auto-complete with add new
- **Recurring Setup**: Frequency and schedule
- **Cost Allocation**: Branch/project assignment

### 3. Approval Interface
- **Approval Queue**: Pending items with filters
- **Expense Details**: Full view with receipts
- **Quick Actions**: Approve/reject with comments
- **Bulk Operations**: Multiple approval handling
- **History View**: Past decisions and notes

### 4. Vendor Management
- **Vendor List**: Search, filter, sort
- **Vendor Profile**: Details, history, performance
- **Quick Add**: Minimal form for new vendors
- **Performance Metrics**: Rating, delivery, quality
- **Statement**: Transaction history and balance

### 5. Budget Planning
- **Budget Setup**: Category allocation wizard
- **Visual Editor**: Drag to adjust allocations
- **Comparison View**: Previous periods, actuals
- **Forecast Tools**: Trend-based predictions
- **Alert Configuration**: Threshold settings

### 6. Reports & Analytics
- **Expense Reports**: By category, vendor, period
- **Budget Reports**: Variance analysis
- **Vendor Reports**: Performance, spending
- **Tax Reports**: VAT summary for filing
- **Custom Reports**: Report builder

## System Connections

### 1. Financial System Integration
```
Expense Management ←→ Financial Transactions
- Every expense creates a financial transaction
- Account balance updates
- Cash flow impact
- Financial reports inclusion
```

### 2. Inventory Integration
```
Purchase Orders ←→ Inventory Management
- Auto-generate POs from low stock
- Update inventory on PO receipt
- Track product costs
- Supplier performance metrics
```

### 3. Staff Integration
```
Expense Approvals ←→ Staff Roles
- Role-based approval routing
- Staff expense submissions
- Commission vs expense tracking
- Petty cash management
```

### 4. Branch Integration
```
Expenses ←→ Branch Management
- Branch-specific budgets
- Cost center allocation
- Multi-branch vendor management
- Consolidated reporting
```

### 5. Accounting Integration
```
Expense Categories ←→ Chart of Accounts
- Map categories to GL accounts
- Automated journal entries
- VAT tracking and reporting
- Financial statement preparation
```

## Implementation Phases

### Phase 1: Core Expense Management (2 weeks)
1. Expense category setup
2. Basic expense entry
3. Receipt upload and storage
4. Simple approval workflow
5. Basic reporting

### Phase 2: Vendor & PO Management (2 weeks)
1. Vendor database
2. Purchase order creation
3. PO to expense conversion
4. Vendor performance tracking
5. Payment tracking

### Phase 3: Advanced Features (2 weeks)
1. OCR receipt scanning
2. Recurring expense automation
3. Budget management
4. Advanced approval rules
5. Mobile app support

### Phase 4: Integration & Analytics (1 week)
1. Full financial integration
2. Inventory connection
3. Advanced analytics
4. Custom report builder
5. API for third-party integration

## Egyptian Market Considerations

### 1. Compliance
- **VAT Tracking**: Automatic VAT calculation and reporting
- **Tax Invoice Management**: Proper numbering and storage
- **Arabic Documentation**: Bilingual support throughout
- **Local Payment Methods**: Cash, bank transfer, InstaPay

### 2. Business Practices
- **Cash Payments**: Strong cash payment tracking
- **Supplier Relations**: Credit terms management
- **Price Negotiations**: Discount tracking
- **Seasonal Variations**: Ramadan, summer patterns

### 3. Technology Adoption
- **Mobile-First**: WhatsApp receipt sharing
- **Offline Mode**: Network interruption handling
- **Simple UI**: Easy for non-technical staff
- **Voice Notes**: Audio memo attachments

## Security & Permissions

### 1. Role-Based Access
- **Owner**: Full access, budget approval
- **Manager**: Expense approval, reports
- **Accountant**: All financial views
- **Staff**: Submit expenses only

### 2. Data Security
- Encrypted receipt storage
- Audit trail for all actions
- Secure vendor information
- GDPR/local compliance

## Success Metrics

1. **Efficiency Gains**
   - 70% reduction in expense processing time
   - 90% first-time approval rate
   - 50% reduction in receipt loss

2. **Cost Savings**
   - 15-20% reduction through budget visibility
   - 10% savings via vendor negotiations
   - 5% early payment discount capture

3. **Compliance Improvement**
   - 100% receipt capture
   - 100% VAT compliance
   - Zero audit findings

4. **User Adoption**
   - 90% staff using mobile submission
   - 95% on-time expense reporting
   - 80% vendor self-service adoption