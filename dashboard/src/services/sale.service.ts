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
import { Sale, SaleFilters, SaleItem, SalePayment, DailySalesSummary } from '../types/sale.types';
import { productService } from './product.service';
import { financeService } from './finance.service';

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

      const saleData = {
        ...sale,
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
    payments: SalePayment[],
    cashRegisterId?: string
  ): Promise<void> {
    try {
      await runTransaction(db, async (transaction) => {
        // Get the sale document
        const saleRef = doc(db, 'companies', companyId, this.salesCollection, saleId);
        const saleDoc = await transaction.get(saleRef);
        
        if (!saleDoc.exists()) {
          throw new Error('Sale not found');
        }

        const sale = saleDoc.data() as Sale;

        // Update inventory for each item
        for (const item of items) {
          if (item.productId) {
            const productRef = doc(db, 'companies', companyId, 'products', item.productId);
            const productDoc = await transaction.get(productRef);
            
            if (productDoc.exists()) {
              const product = productDoc.data();
              
              // Update branch stock if inventory tracking is enabled
              if (product.trackInventory && product.branchStock) {
                const currentStock = product.branchStock[sale.branchId]?.quantity || 0;
                const newStock = Math.max(0, currentStock - item.quantity);
                
                transaction.update(productRef, {
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
          }
        }

        // Create financial transactions for each payment
        for (const payment of payments) {
          if (payment.accountId) {
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

            // Update account balance
            const accountRef = doc(db, 'companies', companyId, 'accounts', payment.accountId);
            transaction.update(accountRef, {
              balance: increment(payment.amount),
              lastTransactionDate: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        }

        // Update cash register session if provided
        if (cashRegisterId) {
          const registerRef = doc(db, 'companies', companyId, 'cashRegisters', cashRegisterId);
          
          // Group payments by method
          const paymentsByMethod = payments.reduce((acc, payment) => {
            acc[payment.method] = (acc[payment.method] || 0) + payment.amount;
            return acc;
          }, {} as Record<string, number>);

          // Update current amounts in cash register
          const updates: any = {
            [`currentAmounts.${sale.total > 0 ? 'sales' : 'refunds'}`]: increment(Math.abs(sale.total)),
            lastActivityAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };

          // Update amounts by payment method
          Object.entries(paymentsByMethod).forEach(([method, amount]) => {
            updates[`currentAmounts.${method}`] = increment(amount);
          });

          transaction.update(registerRef, updates);
        }

        // Update the sale status
        transaction.update(saleRef, {
          status: 'completed',
          completedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
    } catch (error) {
      console.error('Error completing sale:', error);
      throw error;
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