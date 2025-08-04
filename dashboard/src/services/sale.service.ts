import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
  QueryConstraint,
  DocumentSnapshot,
  startAfter,
  runTransaction,
  increment,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Sale, SaleFilters, SaleItem, SalePayment, DailySalesSummary } from '../types/sale.types';
import { productService } from './product.service';
import { financeService } from './finance.service';
import { registerService } from './register.service';
import type { PaymentBreakdown } from '../types/register.types';

class SaleService {
  private salesCollection = 'sales';

  // Generate sale number
  async generateSaleNumber(companyId: string, branchId: string): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    
    // Get the count of sales for this month
    const startOfMonth = new Date(year, new Date().getMonth(), 1);
    const endOfMonth = new Date(year, new Date().getMonth() + 1, 0, 23, 59, 59);
    
    const q = query(
      collection(db, 'companies', companyId, this.salesCollection),
      where('branchId', '==', branchId),
      where('createdAt', '>=', Timestamp.fromDate(startOfMonth)),
      where('createdAt', '<=', Timestamp.fromDate(endOfMonth))
    );
    
    const snapshot = await getDocs(q);
    const count = snapshot.size + 1;
    
    return `POS-${year}${month}-${String(count).padStart(4, '0')}`;
  }

  // Generate receipt number
  async generateReceiptNumber(companyId: string, branchId: string): Promise<string> {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    
    // Get the count of receipts for today
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
    
    const q = query(
      collection(db, 'companies', companyId, this.salesCollection),
      where('branchId', '==', branchId),
      where('createdAt', '>=', Timestamp.fromDate(startOfDay)),
      where('createdAt', '<=', Timestamp.fromDate(endOfDay))
    );
    
    const snapshot = await getDocs(q);
    const count = snapshot.size + 1;
    
    return `RCP-${dateStr}-${String(count).padStart(3, '0')}`;
  }

  // Create a new sale
  async createSale(
    sale: Omit<Sale, 'id' | 'createdAt' | 'updatedAt' | 'saleNumber' | 'receiptNumber'>
  ): Promise<string> {
    try {
      const saleNumber = await this.generateSaleNumber(sale.companyId, sale.branchId);
      const receiptNumber = await this.generateReceiptNumber(sale.companyId, sale.branchId);

      // Helper function to deeply clean an object/array of undefined values
      const cleanObject = (obj: any): any => {
        if (Array.isArray(obj)) {
          return obj.map(item => cleanObject(item));
        } else if (obj !== null && typeof obj === 'object' && !(obj instanceof Date) && !(obj.constructor.name === 'Timestamp')) {
          const cleaned: any = {};
          Object.keys(obj).forEach(key => {
            const value = obj[key];
            if (value !== undefined) {
              cleaned[key] = cleanObject(value);
            }
          });
          return cleaned;
        }
        return obj;
      };

      // Clean the sale object to remove undefined values
      const cleanedSale = cleanObject(sale);

      const saleData = {
        ...cleanedSale,
        saleNumber,
        receiptNumber,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(
        collection(db, 'companies', sale.companyId, this.salesCollection),
        saleData
      );

      return docRef.id;
    } catch (error) {
      console.error('Error creating sale:', error);
      throw error;
    }
  }

  // Complete a sale with inventory and financial updates
  async completeSale(
    companyId: string,
    saleId: string,
    items: SaleItem[],
    payments: SalePayment[]
  ): Promise<void> {
    try {
      await runTransaction(db, async (transaction) => {
        // ===== PHASE 1: ALL READS FIRST =====
        
        // Read the sale document
        const saleRef = doc(db, 'companies', companyId, this.salesCollection, saleId);
        const saleDoc = await transaction.get(saleRef);
        
        if (!saleDoc.exists()) {
          throw new Error('Sale not found');
        }

        const sale = saleDoc.data() as Sale;

        // Read all product documents
        const productDocs: { ref: any; data: any; item: SaleItem }[] = [];
        for (const item of items) {
          if (item.productId) {
            const productRef = doc(db, 'companies', companyId, 'products', item.productId);
            const productDoc = await transaction.get(productRef);
            if (productDoc.exists()) {
              productDocs.push({ ref: productRef, data: productDoc.data(), item });
            }
          }
        }

        // Read all account documents
        const accountDocs: { ref: any; exists: boolean; payment: SalePayment }[] = [];
        for (const payment of payments) {
          if (payment.accountId) {
            const accountRef = doc(db, 'companies', companyId, 'accounts', payment.accountId);
            const accountDoc = await transaction.get(accountRef);
            accountDocs.push({ ref: accountRef, exists: accountDoc.exists(), payment });
          }
        }


        // ===== PHASE 2: ALL WRITES =====

        // Update inventory for each product
        for (const { ref, data: product, item } of productDocs) {
          // Update branch stock if inventory tracking is enabled
          if (product.trackInventory && product.branchStock) {
            const currentStock = product.branchStock[sale.branchId]?.quantity || 0;
            const newStock = Math.max(0, currentStock - item.quantity);
            
            transaction.update(ref, {
              [`branchStock.${sale.branchId}.quantity`]: newStock,
              [`branchStock.${sale.branchId}.lastUpdated`]: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });

            // Create inventory transaction
            const inventoryData = {
              productId: item.productId,
              type: 'sale',
              quantity: -item.quantity,
              reference: sale.receiptNumber,
              referenceId: saleId,
              branchId: sale.branchId,
              companyId,
              createdAt: serverTimestamp(),
              createdBy: sale.staffId,
              notes: `Sale ${sale.receiptNumber}`,
            };

            const inventoryRef = doc(collection(db, 'companies', companyId, 'inventoryTransactions'));
            transaction.set(inventoryRef, inventoryData);
          }
        }

        // Create financial transactions and update account balances
        for (const { ref, exists, payment } of accountDocs) {
          // Create financial transaction
          const transactionData = {
            accountId: payment.accountId,
            type: 'income' as const,
            category: 'sales',
            amount: payment.amount,
            description: `Sale ${sale.receiptNumber}`,
            reference: sale.receiptNumber,
            referenceId: saleId,
            paymentMethod: payment.method,
            date: Timestamp.now(),
            status: 'completed' as const,
            companyId,
            branchId: sale.branchId,
            createdBy: sale.staffId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };

          const financeRef = doc(collection(db, 'companies', companyId, 'transactions'));
          transaction.set(financeRef, transactionData);

          // Update account balance if account exists
          if (exists) {
            transaction.update(ref, {
              currentBalance: increment(payment.amount),
              lastTransactionDate: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } else {
            // Only log in development mode
            if (import.meta.env.DEV) {
              console.debug(`Account ${payment.accountId} not found, skipping balance update`);
            }
          }
        }


        // Update the sale status
        transaction.update(saleRef, {
          status: 'completed',
          completedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      // After transaction is complete, record in cash register if there's an active shift
      await this.recordSaleInRegister(companyId, saleId, payments);
    } catch (error) {
      console.error('Error completing sale:', error);
      throw error;
    }
  }

  // Record sale in cash register
  private async recordSaleInRegister(
    companyId: string,
    saleId: string,
    payments: SalePayment[]
  ): Promise<void> {
    try {
      // Get the current user's active shift
      const userId = payments[0]?.createdBy || 'system'; // Get userId from payment
      const activeShifts = await registerService.getActiveShiftsForEmployee(companyId, userId);
      
      if (activeShifts.length === 0) {
        // No active shift, skip register recording
        console.log('No active shift for user, skipping register recording');
        return;
      }

      const currentShift = activeShifts[0];
      
      // Build payment breakdown
      const paymentBreakdown: PaymentBreakdown = {
        cash: 0,
        card: [],
        bankTransfer: 0,
        digitalWallet: [],
        giftCard: [],
        loyalty: 0,
        credit: 0,
        other: [],
      };

      let totalAmount = 0;
      
      for (const payment of payments) {
        totalAmount += payment.amount;
        
        switch (payment.method) {
          case 'cash':
            paymentBreakdown.cash = (paymentBreakdown.cash || 0) + payment.amount;
            break;
          case 'card':
            paymentBreakdown.card?.push({
              amount: payment.amount,
              cardType: 'other',
            });
            break;
          case 'bank_transfer':
            paymentBreakdown.bankTransfer = (paymentBreakdown.bankTransfer || 0) + payment.amount;
            break;
          case 'digital_wallet':
            paymentBreakdown.digitalWallet?.push({
              amount: payment.amount,
              walletType: payment.walletType || 'other',
            });
            break;
          default:
            paymentBreakdown.other?.push({
              amount: payment.amount,
              method: payment.method,
            });
        }
      }

      // Record the transaction in the register
      await registerService.recordTransaction(companyId, currentShift.id!, {
        registerId: currentShift.registerId,
        type: 'sale',
        category: 'product',
        paymentMethods: paymentBreakdown,
        subtotal: totalAmount,
        totalAmount,
        referenceType: 'sale',
        referenceId: saleId,
        performedBy: userId,
        performedByName: currentShift.employeeName,
      });
    } catch (error) {
      // Log error but don't fail the sale
      console.error('Error recording sale in register:', error);
    }
  }

  // Get sales with filters
  async getSales(
    companyId: string,
    filters?: SaleFilters,
    pageSize: number = 50,
    lastDoc?: DocumentSnapshot
  ): Promise<{ sales: Sale[]; lastDoc: DocumentSnapshot | null }> {
    try {
      const constraints: QueryConstraint[] = [];

      // Apply filters
      if (filters?.startDate) {
        constraints.push(where('createdAt', '>=', Timestamp.fromDate(filters.startDate)));
      }
      if (filters?.endDate) {
        constraints.push(where('createdAt', '<=', Timestamp.fromDate(filters.endDate)));
      }
      if (filters?.status) {
        constraints.push(where('status', '==', filters.status));
      }
      if (filters?.customerId) {
        constraints.push(where('customerId', '==', filters.customerId));
      }
      if (filters?.staffId) {
        constraints.push(where('staffId', '==', filters.staffId));
      }

      // Default ordering
      constraints.push(orderBy('createdAt', 'desc'));
      constraints.push(limit(pageSize));

      // Pagination
      if (lastDoc) {
        constraints.push(startAfter(lastDoc));
      }

      const q = query(
        collection(db, 'companies', companyId, this.salesCollection),
        ...constraints
      );

      const snapshot = await getDocs(q);
      const sales: Sale[] = [];

      snapshot.forEach((doc) => {
        sales.push({
          id: doc.id,
          ...doc.data(),
        } as Sale);
      });

      return {
        sales,
        lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
      };
    } catch (error) {
      console.error('Error getting sales:', error);
      throw error;
    }
  }

  // Get daily sales summary
  async getDailySummary(
    companyId: string,
    date: Date,
    branchId?: string
  ): Promise<DailySalesSummary> {
    try {
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);

      const constraints: QueryConstraint[] = [
        where('createdAt', '>=', Timestamp.fromDate(startOfDay)),
        where('createdAt', '<=', Timestamp.fromDate(endOfDay)),
        where('status', '==', 'completed'),
      ];

      if (branchId) {
        constraints.push(where('branchId', '==', branchId));
      }

      const q = query(
        collection(db, 'companies', companyId, this.salesCollection),
        ...constraints
      );

      const snapshot = await getDocs(q);
      
      let totalSales = 0;
      let totalAmount = 0;
      let totalTax = 0;
      let totalDiscount = 0;
      let totalProfit = 0;
      const paymentBreakdown = {
        cash: 0,
        card: 0,
        bank_transfer: 0,
        digital_wallet: 0,
      };
      const productSales = new Map<string, {
        productId: string;
        productName: string;
        quantity: number;
        revenue: number;
      }>();

      snapshot.forEach((doc) => {
        const sale = doc.data() as Sale;
        
        totalSales++;
        totalAmount += sale.total;
        totalTax += sale.totalTax;
        totalDiscount += sale.totalDiscount;
        totalProfit += sale.profitMargin || 0;

        // Payment breakdown
        sale.payments.forEach(payment => {
          if (payment.method in paymentBreakdown) {
            paymentBreakdown[payment.method as keyof typeof paymentBreakdown] += payment.amount;
          }
        });

        // Product sales
        sale.items.forEach(item => {
          const existing = productSales.get(item.productId);
          if (existing) {
            existing.quantity += item.quantity;
            existing.revenue += item.subtotal;
          } else {
            productSales.set(item.productId, {
              productId: item.productId,
              productName: item.productName,
              quantity: item.quantity,
              revenue: item.subtotal,
            });
          }
        });
      });

      // Get top 10 products by revenue
      const topProducts = Array.from(productSales.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      return {
        date,
        totalSales,
        totalAmount,
        totalTax,
        totalDiscount,
        totalProfit,
        paymentBreakdown,
        topProducts,
      };
    } catch (error) {
      console.error('Error getting daily summary:', error);
      throw error;
    }
  }

  // Void a sale
  async voidSale(companyId: string, saleId: string, reason: string): Promise<void> {
    try {
      const saleRef = doc(db, 'companies', companyId, this.salesCollection, saleId);
      
      await updateDoc(saleRef, {
        status: 'voided',
        voidedAt: serverTimestamp(),
        voidReason: reason,
        updatedAt: serverTimestamp(),
      });

      // TODO: Reverse inventory and financial transactions
    } catch (error) {
      console.error('Error voiding sale:', error);
      throw error;
    }
  }
}

export const saleService = new SaleService();