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
  increment,
} from 'firebase/firestore';
import type { 
  ClientTransaction, 
  ClientPackage, 
  ClientMembership,
  ClientBalanceSummary 
} from './client.service';

// Balance configuration interface
export interface BalanceConfig {
  allowNegativeBalance: boolean;
  defaultCreditLimit: number;
  lowBalanceThreshold: number;
  autoChargeEnabled: boolean;
  autoChargeThreshold: number;
  currency: string;
  currencySymbol: string;
}

// Payment method interface
export interface PaymentMethod {
  id?: string;
  clientId: string;
  type: 'cash' | 'card' | 'bank_transfer' | 'check' | 'other';
  details?: {
    last4?: string;
    cardBrand?: string;
    bankName?: string;
    checkNumber?: string;
  };
  isDefault: boolean;
  createdAt?: Timestamp;
}

// Loyalty configuration
export interface LoyaltyConfig {
  pointsPerCurrency: number; // e.g., 1 point per $10 spent
  redemptionRate: number; // e.g., 100 points = $1
  expiryMonths?: number; // Points expire after X months
  bonusPointsEvents: {
    firstVisit?: number;
    birthday?: number;
    referral?: number;
    review?: number;
  };
}

// Loyalty transaction
export interface LoyaltyTransaction {
  id?: string;
  clientId: string;
  date: Timestamp;
  type: 'earned' | 'redeemed' | 'expired' | 'bonus' | 'adjustment';
  points: number;
  description: string;
  reference?: string; // Transaction or visit ID
  expiryDate?: Timestamp;
  createdAt?: Timestamp;
}

// Gift card interface
export interface GiftCard {
  id?: string;
  code: string;
  clientId?: string; // Owner of the gift card
  purchasedBy: string; // Client ID who purchased
  purchaseDate: Timestamp;
  originalAmount: number;
  currentBalance: number;
  expiryDate?: Timestamp;
  status: 'active' | 'depleted' | 'expired';
  usageHistory: {
    date: Timestamp;
    amount: number;
    transactionId: string;
  }[];
  createdAt?: Timestamp;
}

class ClientBalanceService {
  private transactionsCollection = 'clientTransactions';
  private packagesCollection = 'clientPackages';
  private membershipsCollection = 'clientMemberships';
  private loyaltyCollection = 'clientLoyalty';
  private giftCardsCollection = 'giftCards';

  // Create a new transaction
  async createTransaction(
    transaction: Omit<ClientTransaction, 'id' | 'createdAt'>,
    updateClientBalance: boolean = true
  ): Promise<string> {
    try {
      return await runTransaction(db, async (firestoreTransaction) => {
        // Calculate the new balance
        const previousBalance = await this.getCurrentBalance(transaction.clientId);
        const debitAmount = transaction.debit || 0;
        const creditAmount = transaction.credit || 0;
        const newBalance = previousBalance - debitAmount + creditAmount;

        // Create the transaction with the calculated balance
        const transactionData = {
          ...transaction,
          balance: newBalance,
          createdAt: serverTimestamp(),
        };

        const docRef = doc(collection(db, this.transactionsCollection));
        firestoreTransaction.set(docRef, transactionData);

        // Update client balance if requested
        if (updateClientBalance) {
          const clientRef = doc(db, 'clients', transaction.clientId);
          firestoreTransaction.update(clientRef, {
            currentBalance: newBalance,
            lastContactDate: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        return docRef.id;
      });
    } catch (error) {
      console.error('Error creating transaction:', error);
      throw error;
    }
  }

  // Get current balance for a client
  async getCurrentBalance(clientId: string): Promise<number> {
    try {
      // First try to get from client document
      const clientDoc = await getDoc(doc(db, 'clients', clientId));
      if (clientDoc.exists() && clientDoc.data().currentBalance !== undefined) {
        return clientDoc.data().currentBalance;
      }

      // If not found, calculate from transactions
      return await this.calculateBalanceFromTransactions(clientId);
    } catch (error) {
      console.error('Error getting current balance:', error);
      return 0;
    }
  }

  // Calculate balance from all transactions
  async calculateBalanceFromTransactions(clientId: string): Promise<number> {
    try {
      const q = query(
        collection(db, this.transactionsCollection),
        where('clientId', '==', clientId),
        orderBy('date', 'asc')
      );

      const snapshot = await getDocs(q);
      let balance = 0;

      snapshot.forEach((doc) => {
        const transaction = doc.data();
        if (!transaction.voidedAt) {
          balance = balance - (transaction.debit || 0) + (transaction.credit || 0);
        }
      });

      return balance;
    } catch (error) {
      console.error('Error calculating balance:', error);
      return 0;
    }
  }

  // Get transaction history
  async getTransactionHistory(
    clientId: string,
    options?: {
      limit?: number;
      startDate?: Date;
      endDate?: Date;
      type?: ClientTransaction['type'];
    }
  ): Promise<ClientTransaction[]> {
    try {
      let q = query(
        collection(db, this.transactionsCollection),
        where('clientId', '==', clientId),
        orderBy('date', 'desc')
      );

      if (options?.limit) {
        q = query(q, limit(options.limit));
      }

      const snapshot = await getDocs(q);
      let transactions: ClientTransaction[] = [];

      snapshot.forEach((doc) => {
        transactions.push({
          id: doc.id,
          ...doc.data(),
        } as ClientTransaction);
      });

      // Apply additional filters
      if (options?.startDate) {
        const startTimestamp = Timestamp.fromDate(options.startDate);
        transactions = transactions.filter(t => t.date >= startTimestamp);
      }

      if (options?.endDate) {
        const endTimestamp = Timestamp.fromDate(options.endDate);
        transactions = transactions.filter(t => t.date <= endTimestamp);
      }

      if (options?.type) {
        transactions = transactions.filter(t => t.type === options.type);
      }

      return transactions;
    } catch (error) {
      console.error('Error getting transaction history:', error);
      throw error;
    }
  }

  // Subscribe to balance changes
  subscribeToBalance(
    clientId: string,
    callback: (balance: number) => void
  ): Unsubscribe {
    // Subscribe to client document for balance changes
    const clientRef = doc(db, 'clients', clientId);
    return onSnapshot(clientRef, (snapshot) => {
      if (snapshot.exists()) {
        const balance = snapshot.data().currentBalance || 0;
        callback(balance);
      }
    });
  }

  // Subscribe to transactions
  subscribeToTransactions(
    clientId: string,
    callback: (transactions: ClientTransaction[]) => void
  ): Unsubscribe {
    const q = query(
      collection(db, this.transactionsCollection),
      where('clientId', '==', clientId),
      orderBy('date', 'desc'),
      limit(50)
    );

    return onSnapshot(q, (snapshot) => {
      const transactions: ClientTransaction[] = [];
      snapshot.forEach((doc) => {
        transactions.push({
          id: doc.id,
          ...doc.data(),
        } as ClientTransaction);
      });
      callback(transactions);
    });
  }

  // Process payment
  async processPayment(
    clientId: string,
    amount: number,
    method: string,
    reference?: string,
    notes?: string
  ): Promise<string> {
    try {
      const transaction: Omit<ClientTransaction, 'id' | 'createdAt'> = {
        clientId,
        date: Timestamp.now(),
        type: 'payment',
        description: `Payment received via ${method}`,
        credit: amount,
        paymentMethod: method,
        reference,
        notes,
      };

      return await this.createTransaction(transaction);
    } catch (error) {
      console.error('Error processing payment:', error);
      throw error;
    }
  }

  // Apply charge
  async applyCharge(
    clientId: string,
    amount: number,
    description: string,
    reference?: string
  ): Promise<string> {
    try {
      const transaction: Omit<ClientTransaction, 'id' | 'createdAt'> = {
        clientId,
        date: Timestamp.now(),
        type: 'sale',
        description,
        debit: amount,
        reference,
      };

      return await this.createTransaction(transaction);
    } catch (error) {
      console.error('Error applying charge:', error);
      throw error;
    }
  }

  // Process refund
  async processRefund(
    clientId: string,
    amount: number,
    reason: string,
    originalTransactionId?: string
  ): Promise<string> {
    try {
      const transaction: Omit<ClientTransaction, 'id' | 'createdAt'> = {
        clientId,
        date: Timestamp.now(),
        type: 'refund',
        description: `Refund: ${reason}`,
        credit: amount,
        reference: originalTransactionId,
        notes: reason,
      };

      return await this.createTransaction(transaction);
    } catch (error) {
      console.error('Error processing refund:', error);
      throw error;
    }
  }

  // Package Management
  async createPackage(packageData: Omit<ClientPackage, 'id' | 'createdAt'>): Promise<string> {
    try {
      const newPackage = {
        ...packageData,
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, this.packagesCollection), newPackage);
      
      // Create a transaction for the package purchase
      await this.applyCharge(
        packageData.clientId,
        packageData.originalValue,
        `Package purchase: ${packageData.name}`,
        docRef.id
      );

      return docRef.id;
    } catch (error) {
      console.error('Error creating package:', error);
      throw error;
    }
  }

  // Get active packages
  async getActivePackages(clientId: string): Promise<ClientPackage[]> {
    try {
      const q = query(
        collection(db, this.packagesCollection),
        where('clientId', '==', clientId),
        where('status', '==', 'active')
      );

      const snapshot = await getDocs(q);
      const packages: ClientPackage[] = [];

      snapshot.forEach((doc) => {
        packages.push({
          id: doc.id,
          ...doc.data(),
        } as ClientPackage);
      });

      return packages;
    } catch (error) {
      console.error('Error getting active packages:', error);
      return [];
    }
  }

  // Use package value
  async usePackageValue(packageId: string, amount: number, serviceId: string): Promise<void> {
    try {
      const packageRef = doc(db, this.packagesCollection, packageId);
      const packageDoc = await getDoc(packageRef);

      if (!packageDoc.exists()) {
        throw new Error('Package not found');
      }

      const packageData = packageDoc.data() as ClientPackage;
      const newRemainingValue = packageData.remainingValue - amount;

      if (newRemainingValue < 0) {
        throw new Error('Insufficient package value');
      }

      await updateDoc(packageRef, {
        remainingValue: newRemainingValue,
        status: newRemainingValue === 0 ? 'depleted' : 'active',
        updatedAt: serverTimestamp(),
      });

      // Create a transaction record
      await this.createTransaction({
        clientId: packageData.clientId,
        date: Timestamp.now(),
        type: 'sale',
        description: `Package usage for service ${serviceId}`,
        debit: 0, // No charge to balance
        reference: packageId,
        notes: `Used $${amount} from package`,
      }, false);
    } catch (error) {
      console.error('Error using package value:', error);
      throw error;
    }
  }

  // Membership Management
  async createMembership(
    membershipData: Omit<ClientMembership, 'id' | 'createdAt'>
  ): Promise<string> {
    try {
      const newMembership = {
        ...membershipData,
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, this.membershipsCollection), newMembership);
      
      // Create initial membership fee transaction
      await this.applyCharge(
        membershipData.clientId,
        membershipData.fee,
        `Membership fee: ${membershipData.type}`,
        docRef.id
      );

      return docRef.id;
    } catch (error) {
      console.error('Error creating membership:', error);
      throw error;
    }
  }

  // Get active membership
  async getActiveMembership(clientId: string): Promise<ClientMembership | null> {
    try {
      const q = query(
        collection(db, this.membershipsCollection),
        where('clientId', '==', clientId),
        where('status', '==', 'active'),
        limit(1)
      );

      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data(),
      } as ClientMembership;
    } catch (error) {
      console.error('Error getting active membership:', error);
      return null;
    }
  }

  // Loyalty Points Management
  async addLoyaltyPoints(
    clientId: string,
    points: number,
    description: string,
    reference?: string
  ): Promise<void> {
    try {
      const transaction: LoyaltyTransaction = {
        clientId,
        date: Timestamp.now(),
        type: 'earned',
        points,
        description,
        reference,
        createdAt: serverTimestamp() as Timestamp,
      };

      await addDoc(collection(db, this.loyaltyCollection), transaction);

      // Update client's loyalty points
      const clientRef = doc(db, 'clients', clientId);
      await updateDoc(clientRef, {
        loyaltyPoints: increment(points),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error adding loyalty points:', error);
      throw error;
    }
  }

  // Redeem loyalty points
  async redeemLoyaltyPoints(
    clientId: string,
    points: number,
    description: string
  ): Promise<void> {
    try {
      // Check if client has enough points
      const clientDoc = await getDoc(doc(db, 'clients', clientId));
      const currentPoints = clientDoc.data()?.loyaltyPoints || 0;

      if (currentPoints < points) {
        throw new Error('Insufficient loyalty points');
      }

      const transaction: LoyaltyTransaction = {
        clientId,
        date: Timestamp.now(),
        type: 'redeemed',
        points: -points,
        description,
        createdAt: serverTimestamp() as Timestamp,
      };

      await addDoc(collection(db, this.loyaltyCollection), transaction);

      // Update client's loyalty points
      const clientRef = doc(db, 'clients', clientId);
      await updateDoc(clientRef, {
        loyaltyPoints: increment(-points),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error redeeming loyalty points:', error);
      throw error;
    }
  }

  // Get balance summary
  async getBalanceSummary(clientId: string): Promise<ClientBalanceSummary> {
    try {
      const [balance, transactions, packages, membership, clientDoc] = await Promise.all([
        this.getCurrentBalance(clientId),
        this.getTransactionHistory(clientId, { limit: 100 }),
        this.getActivePackages(clientId),
        this.getActiveMembership(clientId),
        getDoc(doc(db, 'clients', clientId)),
      ]);

      // Calculate total lifetime spend
      const totalLifetimeSpend = transactions
        .filter(t => t.type === 'sale' && !t.voidedAt)
        .reduce((sum, t) => sum + (t.debit || 0), 0);

      // Calculate average ticket
      const completedSales = transactions.filter(t => t.type === 'sale' && !t.voidedAt);
      const averageTicket = completedSales.length > 0
        ? totalLifetimeSpend / completedSales.length
        : 0;

      // Get last payment
      const lastPayment = transactions
        .filter(t => t.type === 'payment')
        .sort((a, b) => b.date.seconds - a.date.seconds)[0];

      // Count outstanding invoices (negative balance)
      const outstandingInvoices = balance < 0 ? 1 : 0;

      const loyaltyPoints = clientDoc.data()?.loyaltyPoints || 0;
      const creditLimit = clientDoc.data()?.creditLimit || 0;

      return {
        currentBalance: balance,
        totalLifetimeSpend,
        averageTicket,
        lastPayment: lastPayment ? {
          date: lastPayment.date,
          amount: lastPayment.credit || 0,
          method: lastPayment.paymentMethod || 'unknown',
        } : undefined,
        outstandingInvoices,
        creditLimit,
        packages: packages.length,
        memberships: membership ? 1 : 0,
        loyaltyPoints,
      };
    } catch (error) {
      console.error('Error getting balance summary:', error);
      throw error;
    }
  }

  // Gift Card Management
  async createGiftCard(
    purchasedBy: string,
    amount: number,
    recipientId?: string,
    expiryMonths: number = 12
  ): Promise<string> {
    try {
      const code = this.generateGiftCardCode();
      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + expiryMonths);

      const giftCard: Omit<GiftCard, 'id'> = {
        code,
        clientId: recipientId,
        purchasedBy,
        purchaseDate: Timestamp.now(),
        originalAmount: amount,
        currentBalance: amount,
        expiryDate: Timestamp.fromDate(expiryDate),
        status: 'active',
        usageHistory: [],
        createdAt: serverTimestamp() as Timestamp,
      };

      const docRef = await addDoc(collection(db, this.giftCardsCollection), giftCard);

      // Create transaction for the purchase
      await this.applyCharge(
        purchasedBy,
        amount,
        `Gift card purchase: ${code}`,
        docRef.id
      );

      return docRef.id;
    } catch (error) {
      console.error('Error creating gift card:', error);
      throw error;
    }
  }

  // Use gift card
  async useGiftCard(
    code: string,
    amount: number,
    transactionId: string
  ): Promise<void> {
    try {
      const q = query(
        collection(db, this.giftCardsCollection),
        where('code', '==', code),
        where('status', '==', 'active'),
        limit(1)
      );

      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        throw new Error('Gift card not found or inactive');
      }

      const giftCardDoc = snapshot.docs[0];
      const giftCard = giftCardDoc.data() as GiftCard;

      if (giftCard.currentBalance < amount) {
        throw new Error('Insufficient gift card balance');
      }

      const newBalance = giftCard.currentBalance - amount;
      const usageEntry = {
        date: Timestamp.now(),
        amount,
        transactionId,
      };

      await updateDoc(doc(db, this.giftCardsCollection, giftCardDoc.id), {
        currentBalance: newBalance,
        status: newBalance === 0 ? 'depleted' : 'active',
        usageHistory: [...giftCard.usageHistory, usageEntry],
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error using gift card:', error);
      throw error;
    }
  }

  // Generate unique gift card code
  private generateGiftCardCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 16; i++) {
      if (i > 0 && i % 4 === 0) code += '-';
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // Batch operations for performance
  async batchUpdateBalances(
    updates: { clientId: string; adjustment: number; reason: string }[]
  ): Promise<void> {
    try {
      const batch = writeBatch(db);
      const timestamp = serverTimestamp();

      for (const update of updates) {
        // Create transaction
        const transactionRef = doc(collection(db, this.transactionsCollection));
        batch.set(transactionRef, {
          clientId: update.clientId,
          date: Timestamp.now(),
          type: 'adjustment',
          description: update.reason,
          [update.adjustment > 0 ? 'credit' : 'debit']: Math.abs(update.adjustment),
          createdAt: timestamp,
        });

        // Update client balance
        const clientRef = doc(db, 'clients', update.clientId);
        batch.update(clientRef, {
          currentBalance: increment(update.adjustment),
          updatedAt: timestamp,
        });
      }

      await batch.commit();
    } catch (error) {
      console.error('Error batch updating balances:', error);
      throw error;
    }
  }
}

export const clientBalanceService = new ClientBalanceService();