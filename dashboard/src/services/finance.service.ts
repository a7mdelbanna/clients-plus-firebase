import { db } from '../config/firebase';
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
  type Unsubscribe,
  type DocumentSnapshot,
} from 'firebase/firestore';
import type {
  FinancialAccount,
  FinancialTransaction,
  ExpenseCategory,
  FinancialReport,
  Budget,
  FinancialSettings,
  TransactionFilters,
  AccountSummary,
  AccountType,
  TransactionType,
  PaymentMethodAmounts,
  DigitalWalletType,
  ReportType,
} from '../types/finance.types';

class FinanceService {
  private accountsCollection = 'financialAccounts';
  private transactionsCollection = 'financialTransactions';
  private expenseCategoriesCollection = 'expenseCategories';
  private reportsCollection = 'financialReports';
  private budgetsCollection = 'budgets';
  private settingsDoc = 'financialSettings';

  // ==================== Financial Accounts ====================

  // Create a new financial account
  async createAccount(account: Omit<FinancialAccount, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const newAccount = {
        ...account,
        currentBalance: account.openingBalance,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(
        collection(db, 'companies', account.companyId, this.accountsCollection),
        newAccount
      );

      // Create opening balance transaction
      if (account.openingBalance !== 0) {
        await this.createTransaction({
          companyId: account.companyId,
          branchId: account.branchId || 'main',
          date: account.openingDate,
          type: account.openingBalance > 0 ? 'income' : 'expense',
          category: 'opening_balance',
          amount: Math.abs(account.openingBalance),
          vatAmount: 0,
          totalAmount: Math.abs(account.openingBalance),
          accountId: docRef.id,
          paymentMethod: account.type === 'cash' ? 'cash' : 
                         account.type === 'bank' ? 'bank_transfer' : 
                         account.type === 'digital_wallet' ? 'digital_wallet' : 'other',
          description: 'Opening Balance',
          descriptionAr: 'الرصيد الافتتاحي',
          status: 'completed',
          createdBy: account.createdBy || 'system',
        });
      }

      return docRef.id;
    } catch (error) {
      console.error('Error creating financial account:', error);
      throw error;
    }
  }

  // Update a financial account
  async updateAccount(
    companyId: string,
    accountId: string,
    updates: Partial<FinancialAccount>
  ): Promise<void> {
    try {
      const accountRef = doc(db, 'companies', companyId, this.accountsCollection, accountId);
      
      const updateData = {
        ...updates,
        updatedAt: serverTimestamp(),
      };

      // Remove undefined fields
      Object.keys(updateData).forEach(key => {
        if (updateData[key as keyof typeof updateData] === undefined) {
          delete updateData[key as keyof typeof updateData];
        }
      });

      await updateDoc(accountRef, updateData);
    } catch (error) {
      console.error('Error updating financial account:', error);
      throw error;
    }
  }

  // Disable/Enable a financial account
  async toggleAccountStatus(
    companyId: string,
    accountId: string,
    status: 'active' | 'inactive'
  ): Promise<void> {
    try {
      await this.updateAccount(companyId, accountId, { status });
    } catch (error) {
      console.error('Error toggling account status:', error);
      throw error;
    }
  }

  // Close/Delete a financial account (soft delete)
  async closeAccount(
    companyId: string,
    accountId: string,
    closedBy: string
  ): Promise<void> {
    try {
      // First check if account has zero balance
      const account = await this.getAccount(companyId, accountId);
      if (!account) {
        throw new Error('Account not found');
      }

      if (account.currentBalance !== 0) {
        throw new Error('Cannot close account with non-zero balance');
      }

      // Check if it's the only account of its type
      const accounts = await this.getAccounts(companyId, { 
        type: account.type,
        status: 'active' 
      });
      
      if (accounts.length === 1 && accounts[0].id === accountId) {
        throw new Error('Cannot close the only active account of this type');
      }

      // Update account status to closed
      await this.updateAccount(companyId, accountId, {
        status: 'closed',
        closedAt: serverTimestamp() as any,
        closedBy,
      });
    } catch (error) {
      console.error('Error closing financial account:', error);
      throw error;
    }
  }

  // Get a single account
  async getAccount(companyId: string, accountId: string): Promise<FinancialAccount | null> {
    try {
      const accountDoc = await getDoc(
        doc(db, 'companies', companyId, this.accountsCollection, accountId)
      );

      if (!accountDoc.exists()) {
        return null;
      }

      return {
        id: accountDoc.id,
        ...accountDoc.data(),
      } as FinancialAccount;
    } catch (error) {
      console.error('Error getting financial account:', error);
      return null;
    }
  }

  // Get all accounts
  async getAccounts(
    companyId: string,
    filters?: {
      branchId?: string;
      type?: AccountType;
      status?: 'active' | 'inactive' | 'closed';
    }
  ): Promise<FinancialAccount[]> {
    try {
      const constraints: QueryConstraint[] = [];
      let needsClientSideSort = false;

      if (filters?.branchId) {
        constraints.push(where('branchId', '==', filters.branchId));
        needsClientSideSort = true;
      }
      if (filters?.type) {
        constraints.push(where('type', '==', filters.type));
        needsClientSideSort = true;
      }
      if (filters?.status) {
        constraints.push(where('status', '==', filters.status));
        needsClientSideSort = true;
      }

      // Only add orderBy if we don't have filters (to avoid index requirement)
      if (!needsClientSideSort) {
        constraints.push(orderBy('name'));
      }

      const q = query(
        collection(db, 'companies', companyId, this.accountsCollection),
        ...constraints
      );

      const snapshot = await getDocs(q);
      const accounts: FinancialAccount[] = [];

      snapshot.forEach((doc) => {
        accounts.push({
          id: doc.id,
          ...doc.data(),
        } as FinancialAccount);
      });

      // Sort client-side if we have filters
      if (needsClientSideSort) {
        accounts.sort((a, b) => {
          const nameA = a.name.toLowerCase();
          const nameB = b.name.toLowerCase();
          return nameA.localeCompare(nameB);
        });
      }

      return accounts;
    } catch (error) {
      console.error('Error getting financial accounts:', error);
      return [];
    }
  }

  // Subscribe to accounts
  subscribeToAccounts(
    companyId: string,
    callback: (accounts: FinancialAccount[]) => void
  ): Unsubscribe {
    // Simple query without complex ordering to avoid index requirements
    const q = query(
      collection(db, 'companies', companyId, this.accountsCollection)
    );

    return onSnapshot(q, (snapshot) => {
      const accounts: FinancialAccount[] = [];
      
      snapshot.forEach((doc) => {
        const account = {
          id: doc.id,
          ...doc.data(),
        } as FinancialAccount;
        
        // Filter out closed accounts client-side
        if (account.status !== 'closed') {
          accounts.push(account);
        }
      });

      // Sort client-side
      accounts.sort((a, b) => {
        // First sort by status
        if (a.status !== b.status) {
          const statusOrder = { 'active': 0, 'inactive': 1, 'closed': 2 };
          return (statusOrder[a.status] || 2) - (statusOrder[b.status] || 2);
        }
        // Then by name
        return a.name.localeCompare(b.name);
      });

      callback(accounts);
    });
  }

  // Get Egyptian digital wallet accounts
  async getDigitalWalletAccounts(
    companyId: string,
    walletType?: DigitalWalletType
  ): Promise<FinancialAccount[]> {
    try {
      const constraints: QueryConstraint[] = [
        where('type', '==', 'digital_wallet'),
        where('status', '==', 'active')
      ];

      if (walletType) {
        constraints.push(where('digitalWalletType', '==', walletType));
      }

      // Remove orderBy to avoid index requirement

      const q = query(
        collection(db, 'companies', companyId, this.accountsCollection),
        ...constraints
      );

      const snapshot = await getDocs(q);
      const accounts: FinancialAccount[] = [];

      snapshot.forEach((doc) => {
        accounts.push({
          id: doc.id,
          ...doc.data(),
        } as FinancialAccount);
      });

      // Sort client-side
      accounts.sort((a, b) => a.name.localeCompare(b.name));

      return accounts;
    } catch (error) {
      console.error('Error getting digital wallet accounts:', error);
      return [];
    }
  }

  // ==================== Financial Transactions ====================

  // Helper method to check if a transaction is a real expense (not transfer or system transaction)
  private isRealExpense(transaction: FinancialTransaction): boolean {
    // Exclude transfer transactions
    if (transaction.isTransfer || transaction.category === 'transfer') {
      return false;
    }
    
    // Exclude system categories that aren't real expenses
    const systemCategories = ['opening_balance', 'cash_count_opening', 'cash_movement'];
    if (systemCategories.includes(transaction.category)) {
      return false;
    }
    
    // Include actual expense transactions
    return transaction.type === 'expense' || 
           transaction.category === 'expense' || 
           !!(transaction as any).expenseDetails ||
           (!!(transaction as any).metadata && !!(transaction as any).metadata.categoryId);
  }

  // Get only expense transactions (excluding transfers and system transactions)
  async getExpenseTransactions(
    companyId: string,
    filters?: TransactionFilters,
    pageSize: number = 50,
    lastDoc?: DocumentSnapshot
  ): Promise<{ transactions: FinancialTransaction[]; lastDoc: DocumentSnapshot | null }> {
    try {
      // Get all transactions first
      const result = await this.getTransactions(companyId, filters, pageSize * 2, lastDoc);
      
      // Filter for real expenses only
      const expenseTransactions = result.transactions.filter(t => this.isRealExpense(t));
      
      // Limit to requested page size
      const limitedTransactions = expenseTransactions.slice(0, pageSize);
      
      return {
        transactions: limitedTransactions,
        lastDoc: result.lastDoc,
      };
    } catch (error) {
      console.error('Error getting expense transactions:', error);
      throw error;
    }
  }

  // Create a financial transaction
  async createTransaction(
    transaction: Omit<FinancialTransaction, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    try {
      return await runTransaction(db, async (firestoreTransaction) => {
        // Get the account
        const accountRef = doc(
          db,
          'companies',
          transaction.companyId,
          this.accountsCollection,
          transaction.accountId
        );
        const accountDoc = await firestoreTransaction.get(accountRef);
        
        if (!accountDoc.exists()) {
          throw new Error('Account not found');
        }

        const account = accountDoc.data() as FinancialAccount;
        
        // Calculate balance change
        let balanceChange = 0;
        if (transaction.type === 'income') {
          balanceChange = transaction.totalAmount;
        } else if (transaction.type === 'expense') {
          balanceChange = -transaction.totalAmount;
        }
        // For transfers, balance change is handled separately

        // Check if account allows negative balance
        if (!account.allowNegativeBalance && account.currentBalance + balanceChange < 0) {
          throw new Error('Insufficient balance');
        }

        // Create transaction
        const newTransaction = {
          ...transaction,
          accountName: account.name, // Denormalize for performance
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        const transactionRef = doc(
          collection(db, 'companies', transaction.companyId, this.transactionsCollection)
        );
        firestoreTransaction.set(transactionRef, newTransaction);

        // Update account balance
        if (balanceChange !== 0) {
          firestoreTransaction.update(accountRef, {
            currentBalance: increment(balanceChange),
            updatedAt: serverTimestamp(),
          });
        }

        // Handle transfer transactions - but only update balances once
        // Skip the transfer account balance update here since we handle both accounts
        // in the createTransfer method to avoid double updating
        if (transaction.isTransfer && transaction.transferAccountId) {
          // We don't update the transfer account balance here anymore
          // The createTransfer method will handle both accounts properly
        }

        // Check for low balance alert
        if (account.lowBalanceThreshold && 
            account.currentBalance + balanceChange <= account.lowBalanceThreshold) {
          // TODO: Create notification/alert
        }

        return transactionRef.id;
      });
    } catch (error) {
      console.error('Error creating financial transaction:', error);
      throw error;
    }
  }

  // Update a financial transaction
  async updateTransaction(
    companyId: string,
    transactionId: string,
    updates: Partial<FinancialTransaction>
  ): Promise<void> {
    try {
      const transactionRef = doc(
        db,
        'companies',
        companyId,
        this.transactionsCollection,
        transactionId
      );

      const updateData: any = {
        ...updates,
        updatedAt: serverTimestamp(),
      };

      // Remove undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      await updateDoc(transactionRef, updateData);
    } catch (error) {
      console.error('Error updating financial transaction:', error);
      throw error;
    }
  }

  // Get transactions with filters
  async getTransactions(
    companyId: string,
    filters?: TransactionFilters,
    pageSize: number = 50,
    lastDoc?: DocumentSnapshot
  ): Promise<{ transactions: FinancialTransaction[]; lastDoc: DocumentSnapshot | null }> {
    try {
      const constraints: QueryConstraint[] = [];
      let filterCount = 0;
      let hasBranchFilter = false;
      let hasDateFilter = false;
      let needsClientSideSort = false;

      // Apply only date filters to the query to avoid index requirements
      // All other filters will be applied client-side
      if (filters?.startDate) {
        constraints.push(where('date', '>=', Timestamp.fromDate(filters.startDate)));
        hasDateFilter = true;
      }
      if (filters?.endDate) {
        constraints.push(where('date', '<=', Timestamp.fromDate(filters.endDate)));
        hasDateFilter = true;
      }
      
      // Check if we have filters that require client-side processing
      needsClientSideSort = !!(filters?.branchId || filters?.type || filters?.status || 
                              filters?.accountId || filters?.category || filters?.paymentMethod || 
                              filters?.digitalWalletType || filters?.search || 
                              filters?.minAmount || filters?.maxAmount);

      // Always use simple query with orderBy to avoid index requirements
      constraints.push(orderBy('date', 'desc'));
      
      // Since we're filtering client-side, we need to get more documents
      // to ensure we have enough after filtering
      const queryLimit = filters ? pageSize * 5 : pageSize;
      constraints.push(limit(queryLimit));

      const q = query(
        collection(db, 'companies', companyId, this.transactionsCollection),
        ...constraints
      );

      const snapshot = await getDocs(q);
      let transactions: FinancialTransaction[] = [];

      snapshot.forEach((doc) => {
        const transaction = {
          id: doc.id,
          ...doc.data(),
        } as FinancialTransaction;

        // Apply all client-side filters
        if (filters?.branchId && transaction.branchId !== filters.branchId) return;
        if (filters?.type && transaction.type !== filters.type) return;
        if (filters?.status && transaction.status !== filters.status) return;
        if (filters?.accountId && transaction.accountId !== filters.accountId) return;
        if (filters?.category && transaction.category !== filters.category) return;
        if (filters?.paymentMethod && transaction.paymentMethod !== filters.paymentMethod) return;
        if (filters?.digitalWalletType && transaction.digitalWalletPayment?.walletType !== filters.digitalWalletType) return;
        
        if (filters?.search) {
          const searchLower = filters.search.toLowerCase();
          const matchesSearch = 
            transaction.description.toLowerCase().includes(searchLower) ||
            transaction.descriptionAr?.toLowerCase().includes(searchLower) ||
            transaction.invoiceNumber?.toLowerCase().includes(searchLower) ||
            transaction.receiptNumber?.toLowerCase().includes(searchLower);
          
          if (!matchesSearch) return;
        }

        if (filters?.minAmount && transaction.totalAmount < filters.minAmount) return;
        if (filters?.maxAmount && transaction.totalAmount > filters.maxAmount) return;

        transactions.push(transaction);
      });

      // Sort client-side if needed
      if (needsClientSideSort) {
        transactions.sort((a, b) => {
          const dateA = a.date?.toDate?.() || new Date(0);
          const dateB = b.date?.toDate?.() || new Date(0);
          return dateB.getTime() - dateA.getTime();
        });
      }

      // Limit results to requested page size
      const finalTransactions = transactions.slice(0, pageSize);
      
      // Get the last document for pagination
      const lastDocResult = finalTransactions.length > 0 
        ? snapshot.docs[snapshot.docs.length - 1] || null
        : null;

      return {
        transactions: finalTransactions,
        lastDoc: lastDocResult,
      };
    } catch (error) {
      console.error('Error getting transactions:', error);
      throw error;
    }
  }

  // Create a transfer between accounts
  async createTransfer(
    companyId: string,
    fromAccountId: string,
    toAccountId: string,
    amount: number,
    description: string,
    createdBy: string,
    branchId: string
  ): Promise<{ fromTransactionId: string; toTransactionId: string }> {
    try {
      return await runTransaction(db, async (firestoreTransaction) => {
        // Get both accounts
        const fromAccountRef = doc(db, 'companies', companyId, this.accountsCollection, fromAccountId);
        const toAccountRef = doc(db, 'companies', companyId, this.accountsCollection, toAccountId);
        
        const [fromAccountDoc, toAccountDoc] = await Promise.all([
          firestoreTransaction.get(fromAccountRef),
          firestoreTransaction.get(toAccountRef)
        ]);

        if (!fromAccountDoc.exists()) {
          throw new Error('From account not found');
        }
        if (!toAccountDoc.exists()) {
          throw new Error('To account not found');
        }

        const fromAccount = fromAccountDoc.data() as FinancialAccount;
        const toAccount = toAccountDoc.data() as FinancialAccount;

        // Check if from account has sufficient balance
        if (!fromAccount.allowNegativeBalance && fromAccount.currentBalance < amount) {
          throw new Error('Insufficient balance');
        }

        const descriptionAr = `${toAccount?.nameAr || toAccount?.name} ← ${fromAccount?.nameAr || fromAccount?.name}`;

        // Create "from" transaction (expense)
        const fromTransactionRef = doc(collection(db, 'companies', companyId, this.transactionsCollection));
        const fromTransaction = {
          companyId,
          branchId,
          date: Timestamp.now(),
          type: 'expense' as const,
          category: 'transfer',
          amount,
          vatAmount: 0,
          totalAmount: amount,
          accountId: fromAccountId,
          accountName: fromAccount.name,
          paymentMethod: 'other' as const,
          isTransfer: true,
          transferAccountId: toAccountId,
          transferDirection: 'from' as const,
          description: `Transfer to account: ${description}`,
          descriptionAr: `تحويل إلى حساب: ${descriptionAr}`,
          status: 'completed' as const,
          createdBy,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        firestoreTransaction.set(fromTransactionRef, fromTransaction);

        // Create "to" transaction (income)
        const toTransactionRef = doc(collection(db, 'companies', companyId, this.transactionsCollection));
        const toTransaction = {
          companyId,
          branchId,
          date: Timestamp.now(),
          type: 'income' as const,
          category: 'transfer',
          amount,
          vatAmount: 0,
          totalAmount: amount,
          accountId: toAccountId,
          accountName: toAccount.name,
          paymentMethod: 'other' as const,
          isTransfer: true,
          transferAccountId: fromAccountId,
          transferDirection: 'to' as const,
          description: `Transfer from account: ${description}`,
          descriptionAr: `تحويل من حساب: ${descriptionAr}`,
          status: 'completed' as const,
          createdBy,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        firestoreTransaction.set(toTransactionRef, toTransaction);

        // Update account balances
        firestoreTransaction.update(fromAccountRef, {
          currentBalance: increment(-amount), // Subtract from source account
          updatedAt: serverTimestamp(),
        });

        firestoreTransaction.update(toAccountRef, {
          currentBalance: increment(amount), // Add to destination account
          updatedAt: serverTimestamp(),
        });

        return { 
          fromTransactionId: fromTransactionRef.id, 
          toTransactionId: toTransactionRef.id 
        };
      });
    } catch (error) {
      console.error('Error creating transfer:', error);
      throw error;
    }
  }

  // ==================== Expense Categories ====================

  // Create expense category
  async createExpenseCategory(
    category: Omit<ExpenseCategory, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    try {
      const newCategory = {
        ...category,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(
        collection(db, 'companies', category.companyId, this.expenseCategoriesCollection),
        newCategory
      );

      return docRef.id;
    } catch (error) {
      console.error('Error creating expense category:', error);
      throw error;
    }
  }

  // Get expense categories
  async getExpenseCategories(companyId: string): Promise<ExpenseCategory[]> {
    try {
      const q = query(
        collection(db, 'companies', companyId, this.expenseCategoriesCollection),
        where('isActive', '==', true)
      );

      const snapshot = await getDocs(q);
      const categories: ExpenseCategory[] = [];

      snapshot.forEach((doc) => {
        categories.push({
          id: doc.id,
          ...doc.data(),
        } as ExpenseCategory);
      });

      // Sort client-side by sortOrder then name
      categories.sort((a, b) => {
        // First by sortOrder
        const orderDiff = (a.sortOrder || 999) - (b.sortOrder || 999);
        if (orderDiff !== 0) return orderDiff;
        // Then by name
        return a.name.localeCompare(b.name);
      });

      return categories;
    } catch (error) {
      console.error('Error getting expense categories:', error);
      return [];
    }
  }

  // ==================== Account Summary ====================

  // Get account summary
  async getAccountSummary(
    companyId: string,
    accountId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<AccountSummary | null> {
    try {
      const account = await this.getAccount(companyId, accountId);
      if (!account) return null;

      // Use a more targeted query to avoid index requirements
      const constraints: QueryConstraint[] = [
        where('accountId', '==', accountId),
        where('status', '==', 'completed')
      ];

      if (startDate) {
        constraints.push(where('date', '>=', Timestamp.fromDate(startDate)));
      }
      if (endDate) {
        constraints.push(where('date', '<=', Timestamp.fromDate(endDate)));
      }

      const q = query(
        collection(db, 'companies', companyId, this.transactionsCollection),
        ...constraints
      );

      const snapshot = await getDocs(q);
      const transactions: FinancialTransaction[] = [];

      snapshot.forEach((doc) => {
        transactions.push({
          id: doc.id,
          ...doc.data(),
        } as FinancialTransaction);
      });

      let periodIncome = 0;
      let periodExpenses = 0;
      let transactionCount = 0;
      let pendingTransactions = 0;
      let lastTransactionDate: Timestamp | undefined;
      let lastTransactionAmount: number | undefined;
      let lastTransactionType: TransactionType | undefined;

      transactions.forEach((transaction) => {
        if (transaction.status === 'completed') {
          transactionCount++;
          
          if (transaction.type === 'income') {
            periodIncome += transaction.totalAmount;
          } else if (transaction.type === 'expense') {
            periodExpenses += transaction.totalAmount;
          }

          if (!lastTransactionDate || transaction.date > lastTransactionDate) {
            lastTransactionDate = transaction.date;
            lastTransactionAmount = transaction.totalAmount;
            lastTransactionType = transaction.type;
          }
        } else if (transaction.status === 'pending') {
          pendingTransactions++;
        }
      });

      return {
        accountId: account.id!,
        accountName: account.name,
        accountType: account.type,
        currentBalance: account.currentBalance,
        periodIncome,
        periodExpenses,
        periodNet: periodIncome - periodExpenses,
        transactionCount,
        pendingTransactions,
        lastTransactionDate,
        lastTransactionAmount,
        lastTransactionType,
      };
    } catch (error) {
      console.error('Error getting account summary:', error);
      return null;
    }
  }

  // ==================== Financial Settings ====================

  // Get user document
  async getUserDocument(userId: string): Promise<any> {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        return userDoc.data();
      }
      return null;
    } catch (error) {
      console.error('Error getting user document:', error);
      return null;
    }
  }


  // Get financial settings
  async getFinancialSettings(companyId: string): Promise<FinancialSettings | null> {
    try {
      const settingsDoc = await getDoc(
        doc(db, 'companies', companyId, this.settingsDoc)
      );

      if (!settingsDoc.exists()) {
        // Return default settings
        return {
          companyId,
          defaultCurrency: 'EGP',
          currencySymbol: 'ج.م',
          currencyPosition: 'after',
          fiscalYearStart: 1,
          defaultVatRate: 14,
          invoicePrefix: 'INV',
          nextInvoiceNumber: 1,
          enableDigitalWallets: true,
          expenseApprovalRequired: false,
          lowBalanceAlerts: true,
        };
      }

      return settingsDoc.data() as FinancialSettings;
    } catch (error) {
      console.error('Error getting financial settings:', error);
      return null;
    }
  }

  // Update financial settings
  async updateFinancialSettings(
    companyId: string,
    settings: Partial<FinancialSettings>
  ): Promise<void> {
    try {
      const settingsRef = doc(db, 'companies', companyId, this.settingsDoc);
      
      const updateData = {
        ...settings,
        companyId,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(settingsRef, updateData);
    } catch (error) {
      console.error('Error updating financial settings:', error);
      throw error;
    }
  }

  // Record digital wallet payment
  async recordDigitalWalletPayment(
    companyId: string,
    branchId: string,
    accountId: string,
    payment: {
      walletType: DigitalWalletType;
      grossAmount: number;
      walletFee?: number;
      walletTransactionId?: string;
      senderPhoneNumber?: string;
      confirmationMethod: 'manual' | 'sms' | 'app_notification' | 'api' | 'qr_scan';
      confirmationScreenshot?: string;
    },
    createdBy: string,
    reference?: {
      type: 'appointment' | 'product_sale' | 'other';
      id?: string;
    }
  ): Promise<string> {
    try {
      const netAmount = payment.grossAmount - (payment.walletFee || 0);

      const transaction: Omit<FinancialTransaction, 'id' | 'createdAt' | 'updatedAt'> = {
        companyId,
        branchId,
        date: Timestamp.now(),
        type: 'income',
        category: reference?.type || 'other',
        amount: payment.grossAmount,
        vatAmount: 0,
        totalAmount: netAmount,
        accountId,
        paymentMethod: 'digital_wallet',
        digitalWalletPayment: {
          walletType: payment.walletType,
          walletTransactionId: payment.walletTransactionId,
          senderPhoneNumber: payment.senderPhoneNumber,
          grossAmount: payment.grossAmount,
          walletFee: payment.walletFee || 0,
          netAmount,
          confirmationMethod: payment.confirmationMethod,
          confirmationScreenshot: payment.confirmationScreenshot,
          confirmedBy: createdBy,
          confirmedAt: Timestamp.now(),
        },
        referenceType: reference?.type,
        referenceId: reference?.id,
        description: `${payment.walletType} payment received`,
        descriptionAr: `تم استلام دفعة ${payment.walletType}`,
        status: 'completed',
        createdBy,
      };

      return await this.createTransaction(transaction);
    } catch (error) {
      console.error('Error recording digital wallet payment:', error);
      throw error;
    }
  }
}

export const financeService = new FinanceService();