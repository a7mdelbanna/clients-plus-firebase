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
  onSnapshot,
  serverTimestamp,
  Timestamp,
  runTransaction,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import type {
  ShiftSession,
  DenominationCount,
  RegisterTransaction,
  PaymentBreakdown,
  CashDrop,
  CashAdjustment,
  DailyRegisterSummary,
  ShiftSummary,
  RegisterConfig,
  RegisterAuditLog,
  RegisterAction,
  RegisterAnalytics,
  ShiftStatus,
  AccountBalance,
} from '../types/register.types';

class RegisterService {
  private shiftsCollection = 'shiftSessions';
  private transactionsCollection = 'registerTransactions';
  private cashDropsCollection = 'cashDrops';
  private adjustmentsCollection = 'cashAdjustments';
  private dailySummariesCollection = 'dailyRegisterSummaries';
  private registerConfigCollection = 'registerConfigs';
  private auditLogsCollection = 'registerAuditLogs';

  // ==================== Shift Management ====================

  /**
   * Open a new shift for an employee
   */
  async openShift(
    companyId: string,
    branchId: string,
    registerId: string,
    employeeId: string,
    employeeName: string,
    openingCash: DenominationCount,
    notes?: string,
    accountBalances?: Record<string, AccountBalance>,
    linkedAccounts?: string[]
  ): Promise<string> {
    try {
      // Check for existing open shifts for this register
      const existingShifts = await this.getActiveShiftsForRegister(companyId, branchId, registerId);
      if (existingShifts.length > 0) {
        throw new Error('Register already has an active shift');
      }

      // Check for existing open shifts for this employee
      const employeeShifts = await this.getActiveShiftsForEmployee(companyId, employeeId);
      if (employeeShifts.length > 0) {
        throw new Error('Employee already has an active shift');
      }

      // Calculate total from denominations
      const openingTotal = this.calculateDenominationTotal(openingCash);

      // Create new shift session
      const shiftData: Omit<ShiftSession, 'id'> = {
        companyId,
        branchId,
        registerId,
        employeeId,
        employeeName,
        openedAt: Timestamp.now(),
        declaredOpeningCash: openingCash,
        openingCashTotal: openingTotal,
        openingNotes: notes,
        accountBalances: accountBalances || {},
        linkedAccounts: linkedAccounts || [],
        status: 'active',
        totalSales: 0,
        totalRefunds: 0,
        totalPayIns: 0,
        totalPayOuts: 0,
        totalCashDrops: 0,
        netCashFlow: openingTotal,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      const docRef = await addDoc(
        collection(db, 'companies', companyId, this.shiftsCollection),
        shiftData
      );

      // Log the action
      await this.logAuditAction(
        companyId,
        branchId,
        registerId,
        docRef.id,
        'shift_open',
        employeeId,
        { openingCash: openingTotal, notes }
      );

      return docRef.id;
    } catch (error) {
      console.error('Error opening shift:', error);
      throw error;
    }
  }

  /**
   * Close an active shift with reconciliation
   */
  async closeShift(
    companyId: string,
    shiftId: string,
    closingCash: DenominationCount,
    notes?: string,
    approvedBy?: string,
    accountBalances?: Record<string, AccountBalance>
  ): Promise<void> {
    try {
      let shiftData: ShiftSession | null = null;
      let closingTotal = 0;
      let variance = 0;
      
      await runTransaction(db, async (transaction) => {
        const shiftRef = doc(db, 'companies', companyId, this.shiftsCollection, shiftId);
        const shiftDoc = await transaction.get(shiftRef);

        if (!shiftDoc.exists()) {
          throw new Error('Shift not found');
        }

        const shift = shiftDoc.data() as ShiftSession;
        shiftData = shift;

        if (shift.status !== 'active' && shift.status !== 'closing') {
          throw new Error('Shift is not active');
        }

        // Calculate closing total
        closingTotal = this.calculateDenominationTotal(closingCash);

        // Calculate expected cash (opening + sales - refunds + pay ins - pay outs - drops)
        const expectedCash = shift.openingCashTotal + 
                           shift.totalSales - 
                           shift.totalRefunds + 
                           shift.totalPayIns - 
                           shift.totalPayOuts - 
                           shift.totalCashDrops;

        // Calculate variance
        variance = closingTotal - expectedCash;
        const varianceCategory = variance > 0.01 ? 'over' : 
                                variance < -0.01 ? 'short' : 'exact';

        // Update shift with closing data
        const updateData: any = {
          closedAt: Timestamp.now(),
          declaredClosingCash: closingCash,
          closingCashTotal: closingTotal,
          expectedCash,
          cashVariance: variance,
          varianceCategory,
          status: 'closed' as ShiftStatus,
          requiresReview: Math.abs(variance) > 10, // Flag for review if variance > 10 EGP
          updatedAt: Timestamp.now(),
        };
        
        // Add optional fields only if they have values
        if (notes && notes.trim()) {
          updateData.closingNotes = notes;
          updateData.varianceNotes = notes;
        }
        
        if (approvedBy) {
          updateData.closingApprovedBy = approvedBy;
          updateData.closingApprovedAt = Timestamp.now();
        }
        
        // Update account balances with closing data if provided
        if (accountBalances && Object.keys(accountBalances).length > 0) {
          // Ensure all values in accountBalances are defined
          const cleanedBalances: Record<string, AccountBalance> = {};
          for (const [key, value] of Object.entries(accountBalances)) {
            if (value && typeof value === 'object') {
              cleanedBalances[key] = {
                ...value,
                // Ensure all number fields have a value
                openingExpected: value.openingExpected || 0,
                openingActual: value.openingActual || 0,
                openingVariance: value.openingVariance || 0,
                currentBalance: value.currentBalance || 0,
                closingExpected: value.closingExpected || 0,
                closingActual: value.closingActual || 0,
                closingVariance: value.closingVariance || 0,
              };
            }
          }
          updateData.accountBalances = cleanedBalances;
        }

        transaction.update(shiftRef, updateData);
      });

      // Log the action
      if (shiftData) {
        await this.logAuditAction(
          companyId,
          shiftData.branchId,
          shiftData.registerId,
          shiftId,
          'shift_close',
          shiftData.employeeId,
          { closingCash: closingTotal, variance }
        );
      }
    } catch (error) {
      console.error('Error closing shift:', error);
      throw error;
    }
  }

  /**
   * Suspend an active shift temporarily
   */
  async suspendShift(
    companyId: string,
    shiftId: string,
    reason: string
  ): Promise<void> {
    try {
      const shiftRef = doc(db, 'companies', companyId, this.shiftsCollection, shiftId);
      
      await updateDoc(shiftRef, {
        status: 'suspended',
        suspendedAt: Timestamp.now(),
        suspendReason: reason,
        updatedAt: Timestamp.now(),
      });

      const shiftDoc = await getDoc(shiftRef);
      const shift = shiftDoc.data() as ShiftSession;

      await this.logAuditAction(
        companyId,
        shift.branchId,
        shift.registerId,
        shiftId,
        'shift_suspend',
        shift.employeeId,
        { reason }
      );
    } catch (error) {
      console.error('Error suspending shift:', error);
      throw error;
    }
  }

  /**
   * Resume a suspended shift
   */
  async resumeShift(companyId: string, shiftId: string): Promise<void> {
    try {
      const shiftRef = doc(db, 'companies', companyId, this.shiftsCollection, shiftId);
      
      await updateDoc(shiftRef, {
        status: 'active',
        suspendedAt: null,
        suspendReason: null,
        updatedAt: Timestamp.now(),
      });

      const shiftDoc = await getDoc(shiftRef);
      const shift = shiftDoc.data() as ShiftSession;

      await this.logAuditAction(
        companyId,
        shift.branchId,
        shift.registerId,
        shiftId,
        'shift_resume',
        shift.employeeId,
        {}
      );
    } catch (error) {
      console.error('Error resuming shift:', error);
      throw error;
    }
  }

  // ==================== Transaction Management ====================

  /**
   * Record a new transaction in the register
   */
  async recordTransaction(
    companyId: string,
    shiftId: string,
    transaction: Omit<RegisterTransaction, 'id' | 'shiftId' | 'timestamp'>
  ): Promise<string> {
    try {
      return await runTransaction(db, async (firestoreTransaction) => {
        // Get the shift
        const shiftRef = doc(db, 'companies', companyId, this.shiftsCollection, shiftId);
        const shiftDoc = await firestoreTransaction.get(shiftRef);

        if (!shiftDoc.exists()) {
          throw new Error('Shift not found');
        }

        const shift = shiftDoc.data() as ShiftSession;

        if (shift.status !== 'active') {
          throw new Error('Shift is not active');
        }

        // Create transaction record
        const transactionData: Omit<RegisterTransaction, 'id'> = {
          ...transaction,
          shiftId,
          timestamp: Timestamp.now(),
        };

        const transactionRef = doc(
          collection(db, 'companies', companyId, this.transactionsCollection)
        );
        firestoreTransaction.set(transactionRef, transactionData);

        // Update shift totals based on transaction type
        const updates: any = {
          updatedAt: Timestamp.now(),
        };

        const cashAmount = transaction.paymentMethods.cash || 0;

        switch (transaction.type) {
          case 'sale':
            updates.totalSales = (shift.totalSales || 0) + transaction.totalAmount;
            updates.netCashFlow = (shift.netCashFlow || 0) + cashAmount;
            break;
          case 'refund':
            updates.totalRefunds = (shift.totalRefunds || 0) + transaction.totalAmount;
            updates.netCashFlow = (shift.netCashFlow || 0) - cashAmount;
            break;
          case 'pay_in':
            updates.totalPayIns = (shift.totalPayIns || 0) + transaction.totalAmount;
            updates.netCashFlow = (shift.netCashFlow || 0) + cashAmount;
            break;
          case 'pay_out':
            updates.totalPayOuts = (shift.totalPayOuts || 0) + transaction.totalAmount;
            updates.netCashFlow = (shift.netCashFlow || 0) - cashAmount;
            break;
        }

        firestoreTransaction.update(shiftRef, updates);

        // Log the action
        await this.logAuditAction(
          companyId,
          shift.branchId,
          shift.registerId,
          shiftId,
          'transaction_create',
          transaction.performedBy,
          { transactionId: transactionRef.id, type: transaction.type, amount: transaction.totalAmount }
        );

        return transactionRef.id;
      });
    } catch (error) {
      console.error('Error recording transaction:', error);
      throw error;
    }
  }

  /**
   * Void a transaction
   */
  async voidTransaction(
    companyId: string,
    transactionId: string,
    voidedBy: string,
    reason: string,
    approvedBy?: string
  ): Promise<void> {
    try {
      await runTransaction(db, async (firestoreTransaction) => {
        // Get the transaction
        const transactionRef = doc(db, 'companies', companyId, this.transactionsCollection, transactionId);
        const transactionDoc = await firestoreTransaction.get(transactionRef);

        if (!transactionDoc.exists()) {
          throw new Error('Transaction not found');
        }

        const transaction = transactionDoc.data() as RegisterTransaction;

        if (transaction.isVoided) {
          throw new Error('Transaction is already voided');
        }

        // Get the shift
        const shiftRef = doc(db, 'companies', companyId, this.shiftsCollection, transaction.shiftId);
        const shiftDoc = await firestoreTransaction.get(shiftRef);

        if (!shiftDoc.exists()) {
          throw new Error('Shift not found');
        }

        const shift = shiftDoc.data() as ShiftSession;

        // Update transaction
        firestoreTransaction.update(transactionRef, {
          isVoided: true,
          voidedAt: Timestamp.now(),
          voidedBy,
          voidReason: reason,
          voidApprovedBy: approvedBy,
        });

        // Reverse shift totals
        const updates: any = {
          updatedAt: Timestamp.now(),
        };

        const cashAmount = transaction.paymentMethods.cash || 0;

        switch (transaction.type) {
          case 'sale':
            updates.totalSales = shift.totalSales - transaction.totalAmount;
            updates.netCashFlow = shift.netCashFlow - cashAmount;
            break;
          case 'refund':
            updates.totalRefunds = shift.totalRefunds - transaction.totalAmount;
            updates.netCashFlow = shift.netCashFlow + cashAmount;
            break;
          case 'pay_in':
            updates.totalPayIns = shift.totalPayIns - transaction.totalAmount;
            updates.netCashFlow = shift.netCashFlow - cashAmount;
            break;
          case 'pay_out':
            updates.totalPayOuts = shift.totalPayOuts - transaction.totalAmount;
            updates.netCashFlow = shift.netCashFlow + cashAmount;
            break;
        }

        firestoreTransaction.update(shiftRef, updates);
      });

      await this.logAuditAction(
        companyId,
        '',
        '',
        '',
        'transaction_void',
        voidedBy,
        { transactionId, reason }
      );
    } catch (error) {
      console.error('Error voiding transaction:', error);
      throw error;
    }
  }

  // ==================== Cash Management ====================

  /**
   * Perform a cash drop (move cash to safe)
   */
  async performCashDrop(
    companyId: string,
    shiftId: string,
    amount: number,
    denominations: DenominationCount,
    performedBy: string,
    safeId?: string,
    notes?: string,
    witnessedBy?: string
  ): Promise<string> {
    try {
      return await runTransaction(db, async (transaction) => {
        // Get the shift
        const shiftRef = doc(db, 'companies', companyId, this.shiftsCollection, shiftId);
        const shiftDoc = await transaction.get(shiftRef);

        if (!shiftDoc.exists()) {
          throw new Error('Shift not found');
        }

        const shift = shiftDoc.data() as ShiftSession;

        if (shift.status !== 'active') {
          throw new Error('Shift is not active');
        }

        // Create cash drop record
        const cashDropData: Omit<CashDrop, 'id'> = {
          shiftId,
          amount,
          denominations,
          droppedAt: Timestamp.now(),
          droppedBy: performedBy,
          safeId,
          safeName: safeId,
          witnessed: !!witnessedBy,
          witnessedBy,
          notes,
        };

        const dropRef = doc(
          collection(db, 'companies', companyId, this.cashDropsCollection)
        );
        transaction.set(dropRef, cashDropData);

        // Update shift totals
        transaction.update(shiftRef, {
          totalCashDrops: (shift.totalCashDrops || 0) + amount,
          netCashFlow: (shift.netCashFlow || 0) - amount,
          updatedAt: Timestamp.now(),
        });

        await this.logAuditAction(
          companyId,
          shift.branchId,
          shift.registerId,
          shiftId,
          'cash_drop',
          performedBy,
          { amount, safeId }
        );

        return dropRef.id;
      });
    } catch (error) {
      console.error('Error performing cash drop:', error);
      throw error;
    }
  }

  /**
   * Record a cash adjustment (pay in/out)
   */
  async recordCashAdjustment(
    companyId: string,
    shiftId: string,
    adjustment: Omit<CashAdjustment, 'id' | 'shiftId' | 'performedAt'>
  ): Promise<string> {
    try {
      return await runTransaction(db, async (transaction) => {
        // Get the shift
        const shiftRef = doc(db, 'companies', companyId, this.shiftsCollection, shiftId);
        const shiftDoc = await transaction.get(shiftRef);

        if (!shiftDoc.exists()) {
          throw new Error('Shift not found');
        }

        const shift = shiftDoc.data() as ShiftSession;

        if (shift.status !== 'active') {
          throw new Error('Shift is not active');
        }

        // Create adjustment record
        const adjustmentData: Omit<CashAdjustment, 'id'> = {
          ...adjustment,
          shiftId,
          performedAt: Timestamp.now(),
        };

        const adjustmentRef = doc(
          collection(db, 'companies', companyId, this.adjustmentsCollection)
        );
        transaction.set(adjustmentRef, adjustmentData);

        // Update shift totals
        const updates: any = {
          updatedAt: Timestamp.now(),
        };

        if (adjustment.type === 'pay_in') {
          updates.totalPayIns = (shift.totalPayIns || 0) + adjustment.amount;
          updates.netCashFlow = (shift.netCashFlow || 0) + adjustment.amount;
        } else if (adjustment.type === 'pay_out') {
          updates.totalPayOuts = (shift.totalPayOuts || 0) + adjustment.amount;
          updates.netCashFlow = (shift.netCashFlow || 0) - adjustment.amount;
        }

        transaction.update(shiftRef, updates);

        await this.logAuditAction(
          companyId,
          shift.branchId,
          shift.registerId,
          shiftId,
          adjustment.type,
          adjustment.authorizedBy,
          { amount: adjustment.amount, reason: adjustment.reason }
        );

        return adjustmentRef.id;
      });
    } catch (error) {
      console.error('Error recording cash adjustment:', error);
      throw error;
    }
  }

  /**
   * Record account movement (transfer between accounts)
   */
  async recordAccountMovement(
    companyId: string,
    shiftId: string,
    movement: Omit<AccountMovement, 'id' | 'shiftId' | 'timestamp'>
  ): Promise<string> {
    try {
      return await runTransaction(db, async (transaction) => {
        // Get the shift
        const shiftRef = doc(db, 'companies', companyId, this.shiftsCollection, shiftId);
        const shiftDoc = await transaction.get(shiftRef);

        if (!shiftDoc.exists()) {
          throw new Error('Shift not found');
        }

        const shift = shiftDoc.data() as ShiftSession;

        if (shift.status !== 'active') {
          throw new Error('Shift is not active');
        }

        // Create movement record
        const movementData: Omit<AccountMovement, 'id'> = {
          ...movement,
          shiftId,
          timestamp: Timestamp.now(),
        };

        const movementRef = doc(
          collection(db, 'companies', companyId, 'accountMovements')
        );
        transaction.set(movementRef, movementData);

        // Update shift account balances if exists
        if (shift.accountBalances && shift.accountBalances[movement.accountId]) {
          const updates: any = {
            [`accountBalances.${movement.accountId}.currentBalance`]: movement.balanceAfter,
            [`accountBalances.${movement.accountId}.lastUpdated`]: Timestamp.now(),
            updatedAt: Timestamp.now(),
          };
          
          transaction.update(shiftRef, updates);
        }

        await this.logAuditAction(
          companyId,
          shift.branchId,
          shift.registerId,
          shiftId,
          'account_movement',
          movement.performedBy,
          { 
            accountId: movement.accountId, 
            movementType: movement.movementType, 
            amount: movement.amount 
          }
        );

        return movementRef.id;
      });
    } catch (error) {
      console.error('Error recording account movement:', error);
      throw error;
    }
  }

  /**
   * Get account movements for a shift
   */
  async getShiftAccountMovements(
    companyId: string,
    shiftId: string
  ): Promise<AccountMovement[]> {
    try {
      const q = query(
        collection(db, 'companies', companyId, 'accountMovements'),
        where('shiftId', '==', shiftId),
        orderBy('timestamp', 'desc')
      );

      const snapshot = await getDocs(q);
      const movements: AccountMovement[] = [];

      snapshot.forEach(doc => {
        movements.push({ id: doc.id, ...doc.data() } as AccountMovement);
      });

      return movements;
    } catch (error) {
      console.error('Error getting account movements:', error);
      return [];
    }
  }

  // ==================== Query Methods ====================

  /**
   * Get active shifts for a register
   */
  async getActiveShiftsForRegister(
    companyId: string,
    branchId: string,
    registerId: string
  ): Promise<ShiftSession[]> {
    try {
      const q = query(
        collection(db, 'companies', companyId, this.shiftsCollection),
        where('branchId', '==', branchId),
        where('registerId', '==', registerId),
        where('status', 'in', ['active', 'suspended'])
      );

      const snapshot = await getDocs(q);
      const shifts: ShiftSession[] = [];

      snapshot.forEach(doc => {
        shifts.push({ id: doc.id, ...doc.data() } as ShiftSession);
      });

      return shifts;
    } catch (error) {
      console.error('Error getting active shifts for register:', error);
      return [];
    }
  }

  /**
   * Get active shifts for an employee
   */
  async getActiveShiftsForEmployee(
    companyId: string,
    employeeId: string
  ): Promise<ShiftSession[]> {
    try {
      const q = query(
        collection(db, 'companies', companyId, this.shiftsCollection),
        where('employeeId', '==', employeeId),
        where('status', 'in', ['active', 'suspended'])
      );

      const snapshot = await getDocs(q);
      const shifts: ShiftSession[] = [];

      snapshot.forEach(doc => {
        shifts.push({ id: doc.id, ...doc.data() } as ShiftSession);
      });

      return shifts;
    } catch (error) {
      console.error('Error getting active shifts for employee:', error);
      return [];
    }
  }

  /**
   * Get shift by ID
   */
  async getShift(companyId: string, shiftId: string): Promise<ShiftSession | null> {
    try {
      const shiftDoc = await getDoc(
        doc(db, 'companies', companyId, this.shiftsCollection, shiftId)
      );

      if (!shiftDoc.exists()) {
        return null;
      }

      return { id: shiftDoc.id, ...shiftDoc.data() } as ShiftSession;
    } catch (error) {
      console.error('Error getting shift:', error);
      return null;
    }
  }

  /**
   * Get transactions for a shift
   */
  async getShiftTransactions(
    companyId: string,
    shiftId: string
  ): Promise<RegisterTransaction[]> {
    try {
      const q = query(
        collection(db, 'companies', companyId, this.transactionsCollection),
        where('shiftId', '==', shiftId),
        orderBy('timestamp', 'desc')
      );

      const snapshot = await getDocs(q);
      const transactions: RegisterTransaction[] = [];

      snapshot.forEach(doc => {
        transactions.push({ id: doc.id, ...doc.data() } as RegisterTransaction);
      });

      return transactions;
    } catch (error: any) {
      console.error('Error getting shift transactions:', error);
      
      // If the error is due to missing index, try without ordering
      if (error.message?.includes('requires an index')) {
        try {
          console.log('Retrying without ordering due to missing index...');
          const q = query(
            collection(db, 'companies', companyId, this.transactionsCollection),
            where('shiftId', '==', shiftId)
          );

          const snapshot = await getDocs(q);
          const transactions: RegisterTransaction[] = [];

          snapshot.forEach(doc => {
            transactions.push({ id: doc.id, ...doc.data() } as RegisterTransaction);
          });

          // Sort client-side
          transactions.sort((a, b) => {
            const timeA = a.timestamp?.toDate?.() || new Date(0);
            const timeB = b.timestamp?.toDate?.() || new Date(0);
            return timeB.getTime() - timeA.getTime();
          });

          return transactions;
        } catch (retryError) {
          console.error('Error in retry:', retryError);
          return [];
        }
      }
      
      return [];
    }
  }

  /**
   * Subscribe to shift updates
   */
  subscribeToShift(
    companyId: string,
    shiftId: string,
    callback: (shift: ShiftSession | null) => void
  ): Unsubscribe {
    const shiftRef = doc(db, 'companies', companyId, this.shiftsCollection, shiftId);
    
    return onSnapshot(shiftRef, (doc) => {
      if (doc.exists()) {
        callback({ id: doc.id, ...doc.data() } as ShiftSession);
      } else {
        callback(null);
      }
    });
  }

  /**
   * Get daily summary for a register
   */
  async getDailySummary(
    companyId: string,
    branchId: string,
    registerId: string,
    date: Date
  ): Promise<DailyRegisterSummary | null> {
    try {
      // Get all shifts for the day
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const q = query(
        collection(db, 'companies', companyId, this.shiftsCollection),
        where('branchId', '==', branchId),
        where('registerId', '==', registerId),
        where('openedAt', '>=', Timestamp.fromDate(startOfDay)),
        where('openedAt', '<=', Timestamp.fromDate(endOfDay))
      );

      const snapshot = await getDocs(q);
      const shifts: ShiftSession[] = [];

      snapshot.forEach(doc => {
        shifts.push({ id: doc.id, ...doc.data() } as ShiftSession);
      });

      if (shifts.length === 0) {
        return null;
      }

      // Calculate summary
      const summary: DailyRegisterSummary = {
        companyId,
        branchId,
        registerId,
        date,
        shifts: shifts.map(shift => ({
          shiftId: shift.id!,
          employeeId: shift.employeeId,
          employeeName: shift.employeeName,
          startTime: shift.openedAt,
          endTime: shift.closedAt,
          duration: shift.closedAt ? 
            Math.floor((shift.closedAt.toMillis() - shift.openedAt.toMillis()) / 60000) : 
            undefined,
          openingCash: shift.openingCashTotal,
          closingCash: shift.closingCashTotal || 0,
          expectedCash: shift.expectedCash || 0,
          actualCash: shift.closingCashTotal || 0,
          variance: shift.cashVariance || 0,
          totalTransactions: 0, // TODO: Calculate from transactions
          totalSales: shift.totalSales,
          totalRefunds: shift.totalRefunds,
          status: shift.status === 'closed' ? 'closed' : 
                 Math.abs(shift.cashVariance || 0) > 10 ? 'flagged' : 'active',
          flagReason: Math.abs(shift.cashVariance || 0) > 10 ? 'High variance' : undefined,
        })),
        totalShifts: shifts.length,
        openingBalance: shifts[0].openingCashTotal,
        closingBalance: shifts[shifts.length - 1].closingCashTotal || 0,
        totalSales: shifts.reduce((sum, s) => sum + s.totalSales, 0),
        totalRefunds: shifts.reduce((sum, s) => sum + s.totalRefunds, 0),
        totalNet: shifts.reduce((sum, s) => sum + s.totalSales - s.totalRefunds, 0),
        paymentMethodTotals: {
          cash: 0, // TODO: Calculate from transactions
          card: 0,
          bankTransfer: 0,
          digitalWallet: 0,
          giftCard: 0,
          loyalty: 0,
          credit: 0,
          other: 0,
        },
        totalCashDrops: shifts.reduce((sum, s) => sum + s.totalCashDrops, 0),
        totalPayIns: shifts.reduce((sum, s) => sum + s.totalPayIns, 0),
        totalPayOuts: shifts.reduce((sum, s) => sum + s.totalPayOuts, 0),
        totalExpected: shifts.reduce((sum, s) => sum + (s.expectedCash || 0), 0),
        totalActual: shifts.reduce((sum, s) => sum + (s.closingCashTotal || 0), 0),
        totalVariance: shifts.reduce((sum, s) => sum + (s.cashVariance || 0), 0),
        transactionCount: 0, // TODO: Calculate from transactions
        averageTransactionValue: 0,
        voidCount: 0,
        voidValue: 0,
        status: shifts.every(s => s.status === 'closed') ? 'closed' : 'open',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      return summary;
    } catch (error) {
      console.error('Error getting daily summary:', error);
      return null;
    }
  }

  // ==================== Helper Methods ====================

  /**
   * Calculate total from denomination count
   */
  private calculateDenominationTotal(denominations: DenominationCount): number {
    let total = 0;

    // Bills
    total += denominations.bills[200] * 200;
    total += denominations.bills[100] * 100;
    total += denominations.bills[50] * 50;
    total += denominations.bills[20] * 20;
    total += denominations.bills[10] * 10;
    total += denominations.bills[5] * 5;
    total += denominations.bills[1] * 1;

    // Coins
    total += denominations.coins[1] * 1;
    total += denominations.coins[0.5] * 0.5;
    total += denominations.coins[0.25] * 0.25;

    // Rolls
    if (denominations.rolls) {
      denominations.rolls.forEach(roll => {
        total += roll.value;
      });
    }

    // Foreign currency
    if (denominations.foreignCurrency) {
      denominations.foreignCurrency.forEach(fc => {
        total += fc.valueInLocal;
      });
    }

    return total;
  }

  /**
   * Log an audit action
   */
  private async logAuditAction(
    companyId: string,
    branchId: string,
    registerId: string,
    shiftId: string,
    action: RegisterAction,
    performedBy: string,
    details: any
  ): Promise<void> {
    try {
      const auditLog: Omit<RegisterAuditLog, 'id'> = {
        companyId,
        branchId,
        registerId,
        shiftId,
        action,
        performedBy,
        performedAt: Timestamp.now(),
        details,
      };

      await addDoc(
        collection(db, 'companies', companyId, this.auditLogsCollection),
        auditLog
      );
    } catch (error) {
      console.error('Error logging audit action:', error);
      // Don't throw - audit logging should not break the main operation
    }
  }
}

export const registerService = new RegisterService();