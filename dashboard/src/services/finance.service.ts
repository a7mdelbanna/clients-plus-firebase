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
  CashRegisterSession,
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
  private cashRegistersCollection = 'cashRegisterSessions';
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

        // Handle transfer transactions
        if (transaction.isTransfer && transaction.transferAccountId) {
          const transferAccountRef = doc(
            db,
            'companies',
            transaction.companyId,
            this.accountsCollection,
            transaction.transferAccountId
          );
          
          const transferBalanceChange = transaction.transferDirection === 'from' 
            ? transaction.totalAmount 
            : -transaction.totalAmount;
          
          firestoreTransaction.update(transferAccountRef, {
            currentBalance: increment(transferBalanceChange),
            updatedAt: serverTimestamp(),
          });
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

  // Get transactions with filters
  async getTransactions(
    companyId: string,
    filters?: TransactionFilters,
    pageSize: number = 50,
    lastDoc?: DocumentSnapshot
  ): Promise<{ transactions: FinancialTransaction[]; lastDoc: DocumentSnapshot | null }> {
    try {
      const constraints: QueryConstraint[] = [];
      let needsClientSideSort = false;
      let hasDateFilter = false;

      // Apply filters
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
      if (filters?.accountId) {
        constraints.push(where('accountId', '==', filters.accountId));
        needsClientSideSort = true;
      }
      if (filters?.category) {
        constraints.push(where('category', '==', filters.category));
        needsClientSideSort = true;
      }
      if (filters?.paymentMethod) {
        constraints.push(where('paymentMethod', '==', filters.paymentMethod));
        needsClientSideSort = true;
      }
      if (filters?.digitalWalletType) {
        constraints.push(where('digitalWalletPayment.walletType', '==', filters.digitalWalletType));
        needsClientSideSort = true;
      }
      if (filters?.startDate) {
        constraints.push(where('date', '>=', Timestamp.fromDate(filters.startDate)));
        hasDateFilter = true;
      }
      if (filters?.endDate) {
        constraints.push(where('date', '<=', Timestamp.fromDate(filters.endDate)));
        hasDateFilter = true;
      }

      // Only add orderBy if we don't have conflicting filters or if we have date filters
      if (!needsClientSideSort || hasDateFilter) {
        constraints.push(orderBy('date', 'desc'));
      }
      
      // Don't use limit when we need client-side operations
      if (!needsClientSideSort) {
        constraints.push(limit(pageSize));
        // Pagination
        if (lastDoc) {
          constraints.push(startAfter(lastDoc));
        }
      }

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

        // Apply client-side filters
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
      if (needsClientSideSort && !hasDateFilter) {
        transactions.sort((a, b) => {
          const dateA = a.date?.toDate?.() || new Date(0);
          const dateB = b.date?.toDate?.() || new Date(0);
          return dateB.getTime() - dateA.getTime();
        });
      }

      // Apply pagination client-side if needed
      let lastDocResult = null;
      if (needsClientSideSort) {
        // Find the start index if lastDoc is provided
        let startIndex = 0;
        if (lastDoc) {
          const lastDocId = lastDoc.id;
          startIndex = transactions.findIndex(t => t.id === lastDocId) + 1;
        }
        
        // Slice for pagination
        transactions = transactions.slice(startIndex, startIndex + pageSize);
        
        // Set lastDoc for next page
        if (transactions.length === pageSize && startIndex + pageSize < snapshot.docs.length) {
          const lastTransactionId = transactions[transactions.length - 1].id;
          lastDocResult = snapshot.docs.find(doc => doc.id === lastTransactionId) || null;
        }
      } else {
        lastDocResult = snapshot.docs[snapshot.docs.length - 1] || null;
      }

      return {
        transactions,
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
      // Create "from" transaction
      const fromTransactionId = await this.createTransaction({
        companyId,
        branchId,
        date: Timestamp.now(),
        type: 'expense',
        category: 'transfer',
        amount,
        vatAmount: 0,
        totalAmount: amount,
        accountId: fromAccountId,
        paymentMethod: 'other',
        isTransfer: true,
        transferAccountId: toAccountId,
        transferDirection: 'from',
        description: `Transfer to account: ${description}`,
        descriptionAr: `تحويل إلى حساب: ${description}`,
        status: 'completed',
        createdBy,
      });

      // Create "to" transaction
      const toTransactionId = await this.createTransaction({
        companyId,
        branchId,
        date: Timestamp.now(),
        type: 'income',
        category: 'transfer',
        amount,
        vatAmount: 0,
        totalAmount: amount,
        accountId: toAccountId,
        paymentMethod: 'other',
        isTransfer: true,
        transferAccountId: fromAccountId,
        transferDirection: 'to',
        description: `Transfer from account: ${description}`,
        descriptionAr: `تحويل من حساب: ${description}`,
        status: 'completed',
        createdBy,
      });

      return { fromTransactionId, toTransactionId };
    } catch (error) {
      console.error('Error creating transfer:', error);
      throw error;
    }
  }

  // ==================== Cash Register ====================

  // Open cash register
  async openCashRegister(
    session: Omit<CashRegisterSession, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    try {
      // Check if there's already an open session
      const openSessions = await this.getOpenCashRegisterSessions(
        session.companyId,
        session.branchId,
        session.registerId
      );

      if (openSessions.length > 0) {
        throw new Error('Cash register already has an open session');
      }

      const newSession = {
        ...session,
        status: 'open' as const,
        transactionCount: 0,
        transactions: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(
        collection(db, 'companies', session.companyId, this.cashRegistersCollection),
        newSession
      );

      return docRef.id;
    } catch (error) {
      console.error('Error opening cash register:', error);
      throw error;
    }
  }

  // Close cash register
  async closeCashRegister(
    companyId: string,
    sessionId: string,
    actualAmounts: PaymentMethodAmounts,
    discrepancyNotes?: string,
    closedBy?: string
  ): Promise<void> {
    try {
      const sessionRef = doc(db, 'companies', companyId, this.cashRegistersCollection, sessionId);
      const sessionDoc = await getDoc(sessionRef);

      if (!sessionDoc.exists()) {
        throw new Error('Cash register session not found');
      }

      const session = sessionDoc.data() as CashRegisterSession;
      
      if (session.status !== 'open') {
        throw new Error('Cash register session is not open');
      }

      // Calculate expected amounts based on transactions
      const expectedAmounts = await this.calculateExpectedAmounts(
        companyId,
        session.openedAt,
        Timestamp.now(),
        session.branchId
      );

      // Calculate discrepancies
      const discrepancies = {
        cash: actualAmounts.cash - expectedAmounts.cash,
        card: actualAmounts.card - expectedAmounts.card,
        bankTransfer: actualAmounts.bankTransfer - expectedAmounts.bankTransfer,
        digitalWallet: actualAmounts.digitalWallet - expectedAmounts.digitalWallet,
        check: actualAmounts.check - expectedAmounts.check,
        total: actualAmounts.total - expectedAmounts.total,
      };

      await updateDoc(sessionRef, {
        closedBy: closedBy || session.openedBy,
        closedAt: serverTimestamp(),
        expectedAmounts,
        actualAmounts,
        discrepancies,
        discrepancyNotes,
        status: 'closed',
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error closing cash register:', error);
      throw error;
    }
  }

  // Get open cash register sessions
  async getOpenCashRegisterSessions(
    companyId: string,
    branchId?: string,
    registerId?: string
  ): Promise<CashRegisterSession[]> {
    try {
      const constraints: QueryConstraint[] = [
        where('status', '==', 'open')
      ];

      if (branchId) {
        constraints.push(where('branchId', '==', branchId));
      }
      if (registerId) {
        constraints.push(where('registerId', '==', registerId));
      }

      // Remove orderBy to avoid index requirement when using filters

      const q = query(
        collection(db, 'companies', companyId, this.cashRegistersCollection),
        ...constraints
      );

      const snapshot = await getDocs(q);
      const sessions: CashRegisterSession[] = [];

      snapshot.forEach((doc) => {
        sessions.push({
          id: doc.id,
          ...doc.data(),
        } as CashRegisterSession);
      });

      // Sort client-side by openedAt desc
      sessions.sort((a, b) => {
        const dateA = a.openedAt?.toDate?.() || new Date(0);
        const dateB = b.openedAt?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });

      return sessions;
    } catch (error) {
      console.error('Error getting open cash register sessions:', error);
      return [];
    }
  }

  // Calculate expected amounts for cash register
  private async calculateExpectedAmounts(
    companyId: string,
    startTime: Timestamp,
    endTime: Timestamp,
    branchId: string
  ): Promise<PaymentMethodAmounts> {
    try {
      const q = query(
        collection(db, 'companies', companyId, this.transactionsCollection),
        where('branchId', '==', branchId),
        where('date', '>=', startTime),
        where('date', '<=', endTime),
        where('status', '==', 'completed')
      );

      const snapshot = await getDocs(q);
      
      const amounts: PaymentMethodAmounts = {
        cash: 0,
        card: 0,
        bankTransfer: 0,
        digitalWallet: 0,
        check: 0,
        total: 0,
        digitalWalletBreakdown: {},
      };

      snapshot.forEach((doc) => {
        const transaction = doc.data() as FinancialTransaction;
        const amount = transaction.type === 'income' 
          ? transaction.totalAmount 
          : -transaction.totalAmount;

        switch (transaction.paymentMethod) {
          case 'cash':
            amounts.cash += amount;
            break;
          case 'card':
            amounts.card += amount;
            break;
          case 'bank_transfer':
            amounts.bankTransfer += amount;
            break;
          case 'digital_wallet':
            amounts.digitalWallet += amount;
            if (transaction.digitalWalletPayment?.walletType) {
              const walletType = transaction.digitalWalletPayment.walletType;
              amounts.digitalWalletBreakdown![walletType] = 
                (amounts.digitalWalletBreakdown![walletType] || 0) + amount;
            }
            break;
          case 'check':
            amounts.check += amount;
            break;
        }
        
        amounts.total += amount;
      });

      return amounts;
    } catch (error) {
      console.error('Error calculating expected amounts:', error);
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
    reference?: {
      type: 'appointment' | 'product_sale' | 'other';
      id?: string;
    },
    createdBy: string
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