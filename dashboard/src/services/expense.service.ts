import { db, storage } from '../config/firebase';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  QueryConstraint,
  writeBatch,
  runTransaction,
  increment,
  deleteDoc,
  type Unsubscribe,
  type DocumentSnapshot,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import type {
  ExpenseCategory,
  Vendor,
  ExpenseTransaction,
  ExpenseReceipt,
  ApprovalWorkflow,
  ApprovalAction,
  RecurringExpenseDetails,
  PurchaseOrder,
  Budget,
  CategoryBudget,
  ExpenseSettings,
  VendorType,
  VendorStatus,
  PurchaseOrderStatus,
  BudgetPeriod,
} from '../types/expense.types';
import { financeService } from './finance.service';

class ExpenseService {
  private categoriesCollection = 'expenseCategories';
  private vendorsCollection = 'vendors';
  private purchaseOrdersCollection = 'purchaseOrders';
  private budgetsCollection = 'budgets';
  private approvalsCollection = 'approvalWorkflows';
  private settingsCollection = 'expenseSettings';

  // Default expense categories for beauty businesses
  private defaultCategories: Omit<ExpenseCategory, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>[] = [
    {
      name: 'Rent & Utilities',
      nameAr: 'الإيجار والمرافق',
      icon: 'Business',
      color: '#1976d2',
      order: 1,
      requiresApproval: true,
      approvalThreshold: 5000,
      requiresReceipt: true,
      allowRecurring: true,
      isActive: true,
      isSystem: true,
    },
    {
      name: 'Salaries & Benefits',
      nameAr: 'الرواتب والمزايا',
      icon: 'AccountBalance',
      color: '#388e3c',
      order: 2,
      requiresApproval: true,
      requiresReceipt: true,
      allowRecurring: true,
      isActive: true,
      isSystem: true,
    },
    {
      name: 'Products & Supplies',
      nameAr: 'المنتجات والمستلزمات',
      icon: 'LocalShipping',
      color: '#7b1fa2',
      order: 3,
      requiresApproval: false,
      approvalThreshold: 10000,
      requiresReceipt: true,
      allowRecurring: false,
      isActive: true,
      isSystem: true,
    },
    {
      name: 'Marketing & Advertising',
      nameAr: 'التسويق والإعلان',
      icon: 'Campaign',
      color: '#d32f2f',
      order: 4,
      requiresApproval: true,
      approvalThreshold: 3000,
      requiresReceipt: true,
      allowRecurring: false,
      isActive: true,
      isSystem: true,
    },
    {
      name: 'Maintenance & Repairs',
      nameAr: 'الصيانة والإصلاحات',
      icon: 'Engineering',
      color: '#f57c00',
      order: 5,
      requiresApproval: false,
      approvalThreshold: 5000,
      requiresReceipt: true,
      allowRecurring: false,
      isActive: true,
      isSystem: true,
    },
    {
      name: 'Professional Services',
      nameAr: 'الخدمات المهنية',
      icon: 'BusinessCenter',
      color: '#0288d1',
      order: 6,
      requiresApproval: true,
      approvalThreshold: 5000,
      requiresReceipt: true,
      allowRecurring: false,
      isActive: true,
      isSystem: true,
    },
    {
      name: 'Insurance',
      nameAr: 'التأمين',
      icon: 'Security',
      color: '#689f38',
      order: 7,
      requiresApproval: true,
      requiresReceipt: true,
      allowRecurring: true,
      isActive: true,
      isSystem: true,
    },
    {
      name: 'Other Expenses',
      nameAr: 'مصروفات أخرى',
      icon: 'MoreHoriz',
      color: '#616161',
      order: 99,
      requiresApproval: false,
      approvalThreshold: 2000,
      requiresReceipt: false,
      allowRecurring: false,
      isActive: true,
      isSystem: true,
    },
  ];

  // Initialize default categories for a company
  async initializeDefaultCategories(companyId: string): Promise<void> {
    try {
      const batch = writeBatch(db);
      
      for (const category of this.defaultCategories) {
        const categoryRef = doc(collection(db, 'companies', companyId, this.categoriesCollection));
        batch.set(categoryRef, {
          ...category,
          companyId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      
      await batch.commit();
    } catch (error) {
      console.error('Error initializing default categories:', error);
      throw error;
    }
  }

  // ==================== EXPENSE CATEGORIES ====================

  // Create expense category
  async createCategory(companyId: string, category: Omit<ExpenseCategory, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const categoryData = {
        ...category,
        companyId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(
        collection(db, 'companies', companyId, this.categoriesCollection),
        categoryData
      );

      return docRef.id;
    } catch (error) {
      console.error('Error creating expense category:', error);
      throw error;
    }
  }

  // Update expense category
  async updateCategory(companyId: string, categoryId: string, updates: Partial<ExpenseCategory>): Promise<void> {
    try {
      const categoryRef = doc(db, 'companies', companyId, this.categoriesCollection, categoryId);
      
      await updateDoc(categoryRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating expense category:', error);
      throw error;
    }
  }

  // Get expense categories
  async getCategories(companyId: string, includeInactive: boolean = false): Promise<ExpenseCategory[]> {
    try {
      const q = query(
        collection(db, 'companies', companyId, this.categoriesCollection),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      let categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExpenseCategory));
      
      // Filter inactive categories in memory if needed
      if (!includeInactive) {
        categories = categories.filter(cat => cat.isActive !== false);
      }
      
      return categories;
    } catch (error) {
      console.error('Error getting expense categories:', error);
      throw error;
    }
  }

  // Subscribe to categories
  subscribeToCategories(
    companyId: string,
    callback: (categories: ExpenseCategory[]) => void,
    includeInactive: boolean = false
  ): Unsubscribe {
    const q = query(
      collection(db, 'companies', companyId, this.categoriesCollection),
      orderBy('createdAt', 'desc')
    );
    
    return onSnapshot(q, (snapshot) => {
      let categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExpenseCategory));
      
      // Filter inactive categories in memory if needed
      if (!includeInactive) {
        categories = categories.filter(cat => cat.isActive !== false);
      }
      
      callback(categories);
    });
  }

  // ==================== VENDORS ====================

  // Create vendor
  async createVendor(vendor: Omit<Vendor, 'id' | 'createdAt' | 'updatedAt' | 'totalTransactions' | 'totalAmount'>): Promise<string> {
    try {
      const vendorData = {
        ...vendor,
        totalTransactions: 0,
        totalAmount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(
        collection(db, 'companies', vendor.companyId, this.vendorsCollection),
        vendorData
      );

      return docRef.id;
    } catch (error) {
      console.error('Error creating vendor:', error);
      throw error;
    }
  }

  // Update vendor
  async updateVendor(companyId: string, vendorId: string, updates: Partial<Vendor>): Promise<void> {
    try {
      const vendorRef = doc(db, 'companies', companyId, this.vendorsCollection, vendorId);
      
      await updateDoc(vendorRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating vendor:', error);
      throw error;
    }
  }

  // Get vendors
  async getVendors(
    companyId: string,
    filters?: {
      status?: VendorStatus;
      type?: VendorType;
      categoryId?: string;
      search?: string;
    }
  ): Promise<Vendor[]> {
    try {
      // Simple query without complex constraints to avoid index issues
      const q = query(
        collection(db, 'companies', companyId, this.vendorsCollection),
        orderBy('name', 'asc')
      );
      
      const snapshot = await getDocs(q);
      let vendors = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vendor));
      
      // Apply all filters client-side
      if (filters?.status) {
        vendors = vendors.filter(vendor => vendor.status === filters.status);
      }
      
      if (filters?.type) {
        vendors = vendors.filter(vendor => vendor.type === filters.type);
      }
      
      if (filters?.categoryId) {
        vendors = vendors.filter(vendor => 
          vendor.categoryIds && vendor.categoryIds.includes(filters.categoryId)
        );
      }
      
      if (filters?.search) {
        const searchTerm = filters.search.toLowerCase();
        vendors = vendors.filter(vendor => 
          vendor.name.toLowerCase().includes(searchTerm) ||
          vendor.nameAr?.toLowerCase().includes(searchTerm) ||
          vendor.code?.toLowerCase().includes(searchTerm)
        );
      }
      
      return vendors;
    } catch (error) {
      console.error('Error getting vendors:', error);
      throw error;
    }
  }

  // Get vendor by ID
  async getVendor(companyId: string, vendorId: string): Promise<Vendor | null> {
    try {
      const vendorDoc = await getDoc(
        doc(db, 'companies', companyId, this.vendorsCollection, vendorId)
      );
      
      if (!vendorDoc.exists()) {
        return null;
      }
      
      return { id: vendorDoc.id, ...vendorDoc.data() } as Vendor;
    } catch (error) {
      console.error('Error getting vendor:', error);
      throw error;
    }
  }

  // Subscribe to vendors
  subscribeToVendors(
    companyId: string,
    callback: (vendors: Vendor[]) => void,
    filters?: {
      status?: VendorStatus;
      type?: VendorType;
    }
  ): Unsubscribe {
    const constraints: QueryConstraint[] = [];
    
    if (filters?.status) {
      constraints.push(where('status', '==', filters.status));
    }
    
    if (filters?.type) {
      constraints.push(where('type', '==', filters.type));
    }
    
    constraints.push(orderBy('name', 'asc'));
    
    const q = query(
      collection(db, 'companies', companyId, this.vendorsCollection),
      ...constraints
    );
    
    return onSnapshot(q, (snapshot) => {
      const vendors = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vendor));
      callback(vendors);
    });
  }

  // ==================== EXPENSE TRANSACTIONS ====================

  // Create expense transaction
  async createExpenseTransaction(
    expense: Omit<ExpenseTransaction, 'id' | 'createdAt' | 'updatedAt'>,
    autoApprove: boolean = false
  ): Promise<string> {
    try {
      // Check if approval is required
      let requiresApproval = false;
      const category = await this.getCategoryById(expense.companyId, expense.expenseDetails.categoryId);
      
      if (category) {
        requiresApproval = category.requiresApproval;
        if (category.approvalThreshold && expense.totalAmount < category.approvalThreshold) {
          requiresApproval = false;
        }
      }
      
      // Set approval status
      expense.expenseDetails.approvalStatus = requiresApproval && !autoApprove ? 'pending' : 'approved';
      
      // Create the financial transaction through finance service
      const transactionId = await financeService.createTransaction(expense);
      
      // If approval is required, create workflow
      if (requiresApproval && !autoApprove) {
        await this.createApprovalWorkflow(expense.companyId, transactionId, expense);
      }
      
      // Skip vendor statistics update - we're using contacts now, not vendors
      // Vendor stats can be tracked through transaction history if needed
      
      // Update budget spent amount
      await this.updateBudgetSpent(expense.companyId, expense.expenseDetails.categoryId, expense.totalAmount);
      
      return transactionId;
    } catch (error) {
      console.error('Error creating expense transaction:', error);
      throw error;
    }
  }

  // Upload receipt
  async uploadReceipt(
    companyId: string,
    transactionId: string,
    file: File,
    userId: string
  ): Promise<ExpenseReceipt> {
    try {
      // Upload file to storage
      const fileName = `receipts/${companyId}/${transactionId}/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, fileName);
      
      const uploadResult = await uploadBytes(storageRef, file);
      const fileUrl = await getDownloadURL(uploadResult.ref);
      
      // Create receipt record
      const receipt: ExpenseReceipt = {
        id: Date.now().toString(),
        fileUrl,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        ocrStatus: 'pending',
        verificationStatus: 'unverified',
        uploadedAt: Timestamp.now(),
        uploadedBy: userId,
      };
      
      // TODO: Trigger OCR processing
      // This would be done through a cloud function or external service
      
      return receipt;
    } catch (error) {
      console.error('Error uploading receipt:', error);
      throw error;
    }
  }

  // ==================== APPROVAL WORKFLOW ====================

  // Create approval workflow
  private async createApprovalWorkflow(
    companyId: string,
    transactionId: string,
    expense: ExpenseTransaction
  ): Promise<string> {
    try {
      // Get approval rules from settings
      const settings = await this.getExpenseSettings(companyId);
      const applicableRules = settings?.approvalRules.filter(rule => {
        if (rule.conditions.minAmount && expense.totalAmount < rule.conditions.minAmount) return false;
        if (rule.conditions.maxAmount && expense.totalAmount > rule.conditions.maxAmount) return false;
        if (rule.conditions.categories && !rule.conditions.categories.includes(expense.expenseDetails.categoryId)) return false;
        return true;
      }) || [];
      
      const workflow: Omit<ApprovalWorkflow, 'id'> = {
        transactionId,
        rules: applicableRules,
        currentStep: 0,
        status: 'pending',
        approvalHistory: [],
        initiatedAt: Timestamp.now(),
      };
      
      const docRef = await addDoc(
        collection(db, 'companies', companyId, this.approvalsCollection),
        workflow
      );
      
      // TODO: Send notification to first approver
      
      return docRef.id;
    } catch (error) {
      console.error('Error creating approval workflow:', error);
      throw error;
    }
  }

  // Process approval action
  async processApproval(
    companyId: string,
    workflowId: string,
    action: Omit<ApprovalAction, 'timestamp'>
  ): Promise<void> {
    try {
      await runTransaction(db, async (transaction) => {
        const workflowRef = doc(db, 'companies', companyId, this.approvalsCollection, workflowId);
        const workflowDoc = await transaction.get(workflowRef);
        
        if (!workflowDoc.exists()) {
          throw new Error('Workflow not found');
        }
        
        const workflow = workflowDoc.data() as ApprovalWorkflow;
        
        // Add action to history
        const approvalAction: ApprovalAction = {
          ...action,
          timestamp: Timestamp.now(),
        };
        
        workflow.approvalHistory.push(approvalAction);
        
        // Update workflow based on action
        if (action.action === 'approve') {
          const currentRule = workflow.rules[workflow.currentStep];
          
          // Check if all approvers have approved (if required)
          if (currentRule.conditions.requiresAllApprovers) {
            const approversForStep = workflow.approvalHistory.filter(
              h => h.action === 'approve' && workflow.rules.findIndex(r => r.step === currentRule.step) === workflow.currentStep
            );
            
            if (approversForStep.length < (currentRule.approverIds?.length || 1)) {
              // Still waiting for other approvers
              transaction.update(workflowRef, {
                approvalHistory: workflow.approvalHistory,
                updatedAt: serverTimestamp(),
              });
              return;
            }
          }
          
          // Move to next step or complete
          if (workflow.currentStep < workflow.rules.length - 1) {
            workflow.currentStep++;
            // TODO: Notify next approver
          } else {
            workflow.status = 'approved';
            workflow.completedAt = Timestamp.now();
            
            // Update the expense transaction
            const transactionRef = doc(
              db,
              'companies',
              companyId,
              'financialTransactions',
              workflow.transactionId
            );
            
            transaction.update(transactionRef, {
              'expenseDetails.approvalStatus': 'approved',
              'expenseDetails.approvalWorkflow': workflow,
              updatedAt: serverTimestamp(),
            });
          }
        } else if (action.action === 'reject') {
          workflow.status = 'rejected';
          workflow.completedAt = Timestamp.now();
          
          // Update the expense transaction
          const transactionRef = doc(
            db,
            'companies',
            companyId,
            'financialTransactions',
            workflow.transactionId
          );
          
          transaction.update(transactionRef, {
            'expenseDetails.approvalStatus': 'rejected',
            'expenseDetails.approvalWorkflow': workflow,
            updatedAt: serverTimestamp(),
          });
        }
        
        transaction.update(workflowRef, {
          ...workflow,
          updatedAt: serverTimestamp(),
        });
      });
    } catch (error) {
      console.error('Error processing approval:', error);
      throw error;
    }
  }

  // Get pending approvals for user
  async getPendingApprovals(companyId: string, userId: string, userRole?: string): Promise<ApprovalWorkflow[]> {
    try {
      const constraints: QueryConstraint[] = [
        where('status', '==', 'pending'),
        orderBy('initiatedAt', 'desc'),
      ];
      
      const q = query(
        collection(db, 'companies', companyId, this.approvalsCollection),
        ...constraints
      );
      
      const snapshot = await getDocs(q);
      const workflows = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ApprovalWorkflow));
      
      // Filter based on user ID and role
      return workflows.filter(workflow => {
        const currentRule = workflow.rules[workflow.currentStep];
        if (!currentRule) return false;
        
        if (currentRule.approverIds?.includes(userId)) return true;
        if (currentRule.approverRole === userRole) return true;
        
        return false;
      });
    } catch (error) {
      console.error('Error getting pending approvals:', error);
      throw error;
    }
  }

  // ==================== PURCHASE ORDERS ====================

  // Create purchase order
  async createPurchaseOrder(order: Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt' | 'orderNumber'>): Promise<string> {
    try {
      // Generate order number
      const orderNumber = await this.generateOrderNumber(order.companyId);
      
      const orderData = {
        ...order,
        orderNumber,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(
        collection(db, 'companies', order.companyId, this.purchaseOrdersCollection),
        orderData
      );

      return docRef.id;
    } catch (error) {
      console.error('Error creating purchase order:', error);
      throw error;
    }
  }

  // Update purchase order
  async updatePurchaseOrder(
    companyId: string,
    orderId: string,
    updates: Partial<PurchaseOrder>
  ): Promise<void> {
    try {
      const orderRef = doc(db, 'companies', companyId, this.purchaseOrdersCollection, orderId);
      
      await updateDoc(orderRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating purchase order:', error);
      throw error;
    }
  }

  // Convert PO to expense
  async convertPOToExpense(
    companyId: string,
    orderId: string,
    accountId: string,
    additionalDetails?: Partial<ExpenseTransaction>
  ): Promise<string> {
    try {
      const order = await this.getPurchaseOrder(companyId, orderId);
      if (!order) {
        throw new Error('Purchase order not found');
      }
      
      // Create expense transaction
      const expense: Omit<ExpenseTransaction, 'id' | 'createdAt' | 'updatedAt'> = {
        companyId,
        accountId,
        type: 'expense',
        status: 'completed',
        date: Timestamp.now(),
        description: `Purchase Order: ${order.orderNumber}`,
        amount: order.subtotal,
        vatAmount: order.vatAmount,
        totalAmount: order.totalAmount,
        paymentMethod: 'bank_transfer',
        reference: order.orderNumber,
        expenseDetails: {
          categoryId: order.items[0]?.categoryId || '',
          vendorId: order.vendorId,
          receipts: [],
          approvalStatus: 'approved',
          isRecurring: false,
          purchaseOrderId: orderId,
          vatAmount: order.vatAmount,
          itemDetails: order.items.map(item => ({
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            total: item.total,
            categoryId: item.categoryId,
          })),
        },
        ...additionalDetails,
      };
      
      const transactionId = await this.createExpenseTransaction(expense, true);
      
      // Update PO with expense reference
      await this.updatePurchaseOrder(companyId, orderId, {
        status: 'received',
        expenseTransactionIds: [...(order.expenseTransactionIds || []), transactionId],
        completedAt: Timestamp.now(),
      });
      
      return transactionId;
    } catch (error) {
      console.error('Error converting PO to expense:', error);
      throw error;
    }
  }

  // ==================== BUDGETS ====================

  // Create budget
  async createBudget(budget: Omit<Budget, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const budgetData = {
        ...budget,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(
        collection(db, 'companies', budget.companyId, this.budgetsCollection),
        budgetData
      );

      return docRef.id;
    } catch (error) {
      console.error('Error creating budget:', error);
      throw error;
    }
  }

  // Update budget
  async updateBudget(companyId: string, budgetId: string, updates: Partial<Budget>): Promise<void> {
    try {
      const budgetRef = doc(db, 'companies', companyId, this.budgetsCollection, budgetId);
      
      await updateDoc(budgetRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating budget:', error);
      throw error;
    }
  }

  // Get all budgets for a branch
  async getBudgets(
    companyId: string,
    branchId?: string
  ): Promise<Budget[]> {
    try {
      // Simple query without ordering to avoid index requirement
      let q;
      
      if (branchId) {
        // Query with branchId filter only
        q = query(
          collection(db, 'companies', companyId, this.budgetsCollection),
          where('branchId', '==', branchId)
        );
      } else {
        // Query all budgets for the company
        q = query(
          collection(db, 'companies', companyId, this.budgetsCollection)
        );
      }
      
      const snapshot = await getDocs(q);
      
      // Sort client-side to avoid index requirement
      const budgets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Budget));
      
      // Sort by createdAt client-side
      budgets.sort((a, b) => {
        const aCreatedAt = (a as any).createdAt;
        const bCreatedAt = (b as any).createdAt;
        
        // Convert Firestore timestamps to dates
        const aDate = aCreatedAt?.toDate ? aCreatedAt.toDate() : 
                      aCreatedAt?.seconds ? new Date(aCreatedAt.seconds * 1000) :
                      aCreatedAt instanceof Date ? aCreatedAt : null;
                      
        const bDate = bCreatedAt?.toDate ? bCreatedAt.toDate() : 
                      bCreatedAt?.seconds ? new Date(bCreatedAt.seconds * 1000) :
                      bCreatedAt instanceof Date ? bCreatedAt : null;
        
        if (!aDate || !bDate) return 0;
        
        // Sort descending (newest first)
        return bDate.getTime() - aDate.getTime();
      });
      
      return budgets;
    } catch (error) {
      console.error('Error getting budgets:', error);
      return [];
    }
  }

  // Get active budget
  async getActiveBudget(
    companyId: string,
    branchId?: string,
    date: Date = new Date()
  ): Promise<Budget | null> {
    try {
      // Simplified query to avoid index requirements
      const q = query(
        collection(db, 'companies', companyId, this.budgetsCollection),
        where('status', '==', 'active')
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return null;
      }
      
      // Filter client-side for date range and branch
      const budgets = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Budget))
        .filter(budget => {
          const budgetStartDate = budget.startDate?.toDate ? budget.startDate.toDate() : budget.startDate;
          const budgetEndDate = budget.endDate?.toDate ? budget.endDate.toDate() : budget.endDate;
          
          // Check date range
          if (budgetStartDate && budgetStartDate > date) return false;
          if (budgetEndDate && budgetEndDate < date) return false;
          
          // Check branch
          if (branchId && budget.branchId !== branchId) return false;
          if (!branchId && budget.branchId) return false;
          
          return true;
        });
      
      return budgets.length > 0 ? budgets[0] : null;
    } catch (error) {
      console.error('Error getting active budget:', error);
      // Don't throw - budget is optional
      return null;
    }
  }

  // Update budget spent amount
  private async updateBudgetSpent(
    companyId: string,
    categoryId: string,
    amount: number
  ): Promise<void> {
    try {
      const budget = await this.getActiveBudget(companyId);
      if (!budget || !budget.id) return;
      
      // Check if this budget has category budgets
      if (!budget.categoryBudgets || budget.categoryBudgets.length === 0) return;
      
      const categoryBudgetIndex = budget.categoryBudgets.findIndex(cb => cb.categoryId === categoryId);
      if (categoryBudgetIndex === -1) return;
      
      const updatedCategoryBudgets = [...budget.categoryBudgets];
      updatedCategoryBudgets[categoryBudgetIndex].spentAmount = 
        (updatedCategoryBudgets[categoryBudgetIndex].spentAmount || 0) + amount;
      updatedCategoryBudgets[categoryBudgetIndex].availableAmount = 
        (updatedCategoryBudgets[categoryBudgetIndex].allocatedAmount || 0) - 
        (updatedCategoryBudgets[categoryBudgetIndex].spentAmount || 0);
      
      // Calculate percentage only if allocated amount exists
      if (updatedCategoryBudgets[categoryBudgetIndex].allocatedAmount > 0) {
        updatedCategoryBudgets[categoryBudgetIndex].percentageUsed = 
          (updatedCategoryBudgets[categoryBudgetIndex].spentAmount / updatedCategoryBudgets[categoryBudgetIndex].allocatedAmount) * 100;
        
        // Check if alert should be sent
        const categoryBudget = updatedCategoryBudgets[categoryBudgetIndex];
        if (categoryBudget.alertThreshold && 
            categoryBudget.percentageUsed >= categoryBudget.alertThreshold && 
            !categoryBudget.alertSent) {
          categoryBudget.alertSent = true;
          categoryBudget.alertSentAt = Timestamp.now();
          // TODO: Send alert notification
        }
      }
      
      await updateDoc(
        doc(db, 'companies', companyId, this.budgetsCollection, budget.id),
        {
          categoryBudgets: updatedCategoryBudgets,
          updatedAt: serverTimestamp(),
        }
      );
    } catch (error) {
      console.error('Error updating budget spent:', error);
      // Don't throw - budget update failure shouldn't block expense creation
    }
  }

  // ==================== SETTINGS ====================

  // Get expense settings
  async getExpenseSettings(companyId: string): Promise<ExpenseSettings | null> {
    try {
      const settingsDoc = await getDoc(
        doc(db, 'companies', companyId, this.settingsCollection, 'default')
      );
      
      if (!settingsDoc.exists()) {
        // Return default settings
        return {
          companyId,
          approvalEnabled: true,
          approvalRules: [],
          ocrEnabled: false,
          autoExtractData: false,
          requireVerification: true,
          recurringEnabled: true,
          reminderDays: [3, 1],
          autoCreateDays: 3,
          budgetEnabled: true,
          budgetPeriod: 'monthly',
          alertThresholds: [70, 90, 100],
          restrictOverBudget: false,
          vatRate: 14,
          includeVatInReports: true,
          notifyOnSubmission: true,
          notifyOnApproval: true,
          notifyOnRejection: true,
          notifyOnBudgetAlert: true,
          syncWithAccounting: false,
        };
      }
      
      return settingsDoc.data() as ExpenseSettings;
    } catch (error) {
      console.error('Error getting expense settings:', error);
      throw error;
    }
  }

  // Update expense settings
  async updateExpenseSettings(companyId: string, updates: Partial<ExpenseSettings>): Promise<void> {
    try {
      const settingsRef = doc(db, 'companies', companyId, this.settingsCollection, 'default');
      
      await updateDoc(settingsRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating expense settings:', error);
      throw error;
    }
  }

  // ==================== HELPERS ====================

  // Get category by ID
  private async getCategoryById(companyId: string, categoryId: string): Promise<ExpenseCategory | null> {
    try {
      const categoryDoc = await getDoc(
        doc(db, 'companies', companyId, this.categoriesCollection, categoryId)
      );
      
      if (!categoryDoc.exists()) {
        return null;
      }
      
      return { id: categoryDoc.id, ...categoryDoc.data() } as ExpenseCategory;
    } catch (error) {
      console.error('Error getting category:', error);
      return null;
    }
  }

  // Update vendor statistics
  private async updateVendorStats(companyId: string, vendorId: string, amount: number): Promise<void> {
    try {
      const vendorRef = doc(db, 'companies', companyId, this.vendorsCollection, vendorId);
      
      await updateDoc(vendorRef, {
        totalTransactions: increment(1),
        totalAmount: increment(amount),
        lastTransactionDate: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating vendor stats:', error);
      // Don't throw - vendor update failure shouldn't block expense creation
    }
  }

  // Generate purchase order number
  private async generateOrderNumber(companyId: string): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    // Get count of POs this month
    const startOfMonth = new Date(year, date.getMonth(), 1);
    const endOfMonth = new Date(year, date.getMonth() + 1, 0);
    
    const q = query(
      collection(db, 'companies', companyId, this.purchaseOrdersCollection),
      where('createdAt', '>=', startOfMonth),
      where('createdAt', '<=', endOfMonth)
    );
    
    const snapshot = await getDocs(q);
    const count = snapshot.size + 1;
    
    return `PO-${year}${month}-${String(count).padStart(4, '0')}`;
  }

  // Get purchase order
  private async getPurchaseOrder(companyId: string, orderId: string): Promise<PurchaseOrder | null> {
    try {
      const orderDoc = await getDoc(
        doc(db, 'companies', companyId, this.purchaseOrdersCollection, orderId)
      );
      
      if (!orderDoc.exists()) {
        return null;
      }
      
      return { id: orderDoc.id, ...orderDoc.data() } as PurchaseOrder;
    } catch (error) {
      console.error('Error getting purchase order:', error);
      throw error;
    }
  }
}

export const expenseService = new ExpenseService();