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
  Invoice,
  InvoiceItem,
  InvoicePayment,
  InvoiceTemplate,
  InvoiceSettings,
  InvoiceFilters,
  InvoiceSummary,
  InvoiceStatus,
  PaymentStatus,
} from '../types/invoice.types';
import { financeService } from './finance.service';
import { clientService } from './client.service';
import { companyService } from './company.service';

class InvoiceService {
  private invoicesCollection = 'invoices';
  private templatesCollection = 'invoiceTemplates';
  private settingsDoc = 'invoiceSettings';

  // ==================== Invoice Management ====================

  // Create a new invoice
  async createInvoice(
    invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    try {
      return await runTransaction(db, async (transaction) => {
        // Get and update invoice number
        const settingsRef = doc(
          db,
          'companies',
          invoice.companyId,
          this.settingsDoc
        );
        const settingsDoc = await transaction.get(settingsRef);
        
        let invoiceNumber = invoice.invoiceNumber;
        if (!invoiceNumber) {
          const settings = settingsDoc.exists() 
            ? settingsDoc.data() as InvoiceSettings
            : { invoicePrefix: 'INV', nextInvoiceNumber: 1 };
          
          invoiceNumber = `${settings.invoicePrefix}-${String(settings.nextInvoiceNumber).padStart(4, '0')}`;
          
          // Update next invoice number
          transaction.set(settingsRef, {
            ...settings,
            nextInvoiceNumber: (settings.nextInvoiceNumber || 1) + 1,
            updatedAt: serverTimestamp(),
          }, { merge: true });
        }

        // Create invoice
        const newInvoice = {
          ...invoice,
          invoiceNumber,
          status: invoice.status || 'draft',
          paymentStatus: this.calculatePaymentStatus(invoice.paidAmount, invoice.totalAmount),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        const invoiceRef = doc(
          collection(db, 'companies', invoice.companyId, this.invoicesCollection)
        );
        transaction.set(invoiceRef, newInvoice);

        // Create financial transaction if invoice is sent/paid
        if (invoice.status === 'paid' && invoice.paidAmount > 0) {
          await this.createInvoiceTransaction(invoice, invoiceRef.id);
        }

        return invoiceRef.id;
      });
    } catch (error) {
      console.error('Error creating invoice:', error);
      throw error;
    }
  }

  // Update an invoice
  async updateInvoice(
    companyId: string,
    invoiceId: string,
    updates: Partial<Invoice>
  ): Promise<void> {
    try {
      const invoiceRef = doc(
        db,
        'companies',
        companyId,
        this.invoicesCollection,
        invoiceId
      );

      // Get current invoice
      const currentDoc = await getDoc(invoiceRef);
      if (!currentDoc.exists()) {
        throw new Error('Invoice not found');
      }
      const currentInvoice = currentDoc.data() as Invoice;

      // Calculate payment status if amounts changed
      if (updates.paidAmount !== undefined || updates.totalAmount !== undefined) {
        const paidAmount = updates.paidAmount ?? currentInvoice.paidAmount;
        const totalAmount = updates.totalAmount ?? currentInvoice.totalAmount;
        updates.paymentStatus = this.calculatePaymentStatus(paidAmount, totalAmount);
        updates.dueAmount = totalAmount - paidAmount;
      }

      // Update status timestamps
      if (updates.status && updates.status !== currentInvoice.status) {
        if (updates.status === 'sent' && !currentInvoice.sentAt) {
          updates.sentAt = Timestamp.now();
        }
      }

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

      await updateDoc(invoiceRef, updateData);

      // Create transaction if status changed to paid
      if (updates.status === 'paid' && currentInvoice.status !== 'paid' && updates.paidAmount) {
        await this.createInvoiceTransaction({
          ...currentInvoice,
          ...updates,
        } as Invoice, invoiceId);
      }
    } catch (error) {
      console.error('Error updating invoice:', error);
      throw error;
    }
  }

  // Get a single invoice
  async getInvoice(companyId: string, invoiceId: string): Promise<Invoice | null> {
    try {
      const invoiceDoc = await getDoc(
        doc(db, 'companies', companyId, this.invoicesCollection, invoiceId)
      );

      if (!invoiceDoc.exists()) {
        return null;
      }

      return {
        id: invoiceDoc.id,
        ...invoiceDoc.data(),
      } as Invoice;
    } catch (error) {
      console.error('Error getting invoice:', error);
      return null;
    }
  }

  // Get invoices with filters
  async getInvoices(
    companyId: string,
    filters?: InvoiceFilters,
    pageSize: number = 50,
    lastDoc?: DocumentSnapshot
  ): Promise<{ invoices: Invoice[]; lastDoc: DocumentSnapshot | null }> {
    try {
      const constraints: QueryConstraint[] = [];

      // Apply filters
      if (filters?.status) {
        if (Array.isArray(filters.status)) {
          constraints.push(where('status', 'in', filters.status));
        } else {
          constraints.push(where('status', '==', filters.status));
        }
      }
      if (filters?.paymentStatus) {
        constraints.push(where('paymentStatus', '==', filters.paymentStatus));
      }
      if (filters?.clientId) {
        constraints.push(where('clientId', '==', filters.clientId));
      }
      if (filters?.branchId) {
        constraints.push(where('branchId', '==', filters.branchId));
      }
      if (filters?.startDate) {
        constraints.push(where('invoiceDate', '>=', Timestamp.fromDate(filters.startDate)));
      }
      if (filters?.endDate) {
        constraints.push(where('invoiceDate', '<=', Timestamp.fromDate(filters.endDate)));
      }

      // Default ordering
      constraints.push(orderBy('invoiceDate', 'desc'));
      constraints.push(limit(pageSize));

      // Pagination
      if (lastDoc) {
        constraints.push(startAfter(lastDoc));
      }

      const q = query(
        collection(db, 'companies', companyId, this.invoicesCollection),
        ...constraints
      );

      const snapshot = await getDocs(q);
      const invoices: Invoice[] = [];

      snapshot.forEach((doc) => {
        const invoice = {
          id: doc.id,
          ...doc.data(),
        } as Invoice;

        // Apply client-side filters
        if (filters?.search) {
          const searchLower = filters.search.toLowerCase();
          const matchesSearch = 
            invoice.invoiceNumber.toLowerCase().includes(searchLower) ||
            invoice.clientName.toLowerCase().includes(searchLower) ||
            invoice.clientEmail?.toLowerCase().includes(searchLower) ||
            invoice.clientPhone?.toLowerCase().includes(searchLower);
          
          if (!matchesSearch) return;
        }

        if (filters?.minAmount && invoice.totalAmount < filters.minAmount) return;
        if (filters?.maxAmount && invoice.totalAmount > filters.maxAmount) return;

        if (filters?.isOverdue) {
          const isOverdue = invoice.status !== 'paid' && 
            invoice.dueDate.toDate() < new Date();
          if (!isOverdue) return;
        }

        invoices.push(invoice);
      });

      return {
        invoices,
        lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
      };
    } catch (error) {
      console.error('Error getting invoices:', error);
      throw error;
    }
  }

  // Subscribe to invoices
  subscribeToInvoices(
    companyId: string,
    callback: (invoices: Invoice[]) => void,
    filters?: InvoiceFilters
  ): Unsubscribe {
    const constraints: QueryConstraint[] = [];

    if (filters?.status) {
      if (Array.isArray(filters.status)) {
        constraints.push(where('status', 'in', filters.status));
      } else {
        constraints.push(where('status', '==', filters.status));
      }
    }
    if (filters?.clientId) {
      constraints.push(where('clientId', '==', filters.clientId));
    }
    if (filters?.branchId) {
      constraints.push(where('branchId', '==', filters.branchId));
    }

    constraints.push(orderBy('invoiceDate', 'desc'));
    constraints.push(limit(100));

    const q = query(
      collection(db, 'companies', companyId, this.invoicesCollection),
      ...constraints
    );

    return onSnapshot(q, (snapshot) => {
      const invoices: Invoice[] = [];
      
      snapshot.forEach((doc) => {
        invoices.push({
          id: doc.id,
          ...doc.data(),
        } as Invoice);
      });

      callback(invoices);
    });
  }

  // ==================== Invoice Operations ====================

  // Record a payment
  async recordPayment(
    companyId: string,
    invoiceId: string,
    payment: Omit<InvoicePayment, 'id' | 'recordedAt'>
  ): Promise<void> {
    try {
      const invoiceRef = doc(
        db,
        'companies',
        companyId,
        this.invoicesCollection,
        invoiceId
      );

      const invoiceDoc = await getDoc(invoiceRef);
      if (!invoiceDoc.exists()) {
        throw new Error('Invoice not found');
      }

      const invoice = invoiceDoc.data() as Invoice;
      const newPayment = {
        ...payment,
        id: Date.now().toString(),
        recordedAt: Timestamp.now(),
      };

      const updatedPayments = [...(invoice.payments || []), newPayment];
      const paidAmount = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
      const dueAmount = invoice.totalAmount - paidAmount;
      const paymentStatus = this.calculatePaymentStatus(paidAmount, invoice.totalAmount);
      const status: InvoiceStatus = paymentStatus === 'paid' ? 'paid' : invoice.status;

      await updateDoc(invoiceRef, {
        payments: updatedPayments,
        paidAmount,
        dueAmount,
        paymentStatus,
        status,
        updatedAt: serverTimestamp(),
      });

      // Create financial transaction
      await financeService.createTransaction({
        companyId,
        branchId: invoice.branchId || 'main',
        date: payment.date,
        type: 'income',
        category: 'invoice_payment',
        amount: payment.amount,
        vatAmount: 0,
        totalAmount: payment.amount,
        accountId: 'default', // TODO: Get from payment method mapping
        paymentMethod: payment.method,
        referenceType: 'invoice',
        referenceId: invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        description: `Payment for Invoice ${invoice.invoiceNumber}`,
        descriptionAr: `دفعة للفاتورة ${invoice.invoiceNumber}`,
        status: 'completed',
        createdBy: payment.recordedBy,
      });
    } catch (error) {
      console.error('Error recording payment:', error);
      throw error;
    }
  }

  // Send invoice (email)
  async sendInvoice(
    companyId: string,
    invoiceId: string,
    email?: string
  ): Promise<void> {
    try {
      // Update invoice status
      await this.updateInvoice(companyId, invoiceId, {
        status: 'sent',
        sentAt: Timestamp.now(),
      });

      // TODO: Implement email sending
      console.log('Invoice sent to:', email);
    } catch (error) {
      console.error('Error sending invoice:', error);
      throw error;
    }
  }

  // Mark invoice as viewed
  async markAsViewed(companyId: string, invoiceId: string): Promise<void> {
    try {
      const invoiceRef = doc(
        db,
        'companies',
        companyId,
        this.invoicesCollection,
        invoiceId
      );

      const invoiceDoc = await getDoc(invoiceRef);
      if (!invoiceDoc.exists()) return;

      const invoice = invoiceDoc.data() as Invoice;
      if (invoice.status === 'sent' && !invoice.viewedAt) {
        await updateDoc(invoiceRef, {
          status: 'viewed',
          viewedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error('Error marking invoice as viewed:', error);
    }
  }

  // Cancel invoice
  async cancelInvoice(
    companyId: string,
    invoiceId: string,
    reason?: string
  ): Promise<void> {
    try {
      await this.updateInvoice(companyId, invoiceId, {
        status: 'cancelled',
        notes: reason ? `Cancelled: ${reason}` : 'Cancelled',
      });
    } catch (error) {
      console.error('Error cancelling invoice:', error);
      throw error;
    }
  }

  // ==================== Invoice Templates ====================

  // Create invoice template
  async createTemplate(
    template: Omit<InvoiceTemplate, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    try {
      const newTemplate = {
        ...template,
        usageCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(
        collection(db, 'companies', template.companyId, this.templatesCollection),
        newTemplate
      );

      return docRef.id;
    } catch (error) {
      console.error('Error creating invoice template:', error);
      throw error;
    }
  }

  // Get invoice templates
  async getTemplates(companyId: string): Promise<InvoiceTemplate[]> {
    try {
      const q = query(
        collection(db, 'companies', companyId, this.templatesCollection),
        where('isActive', '==', true),
        orderBy('name')
      );

      const snapshot = await getDocs(q);
      const templates: InvoiceTemplate[] = [];

      snapshot.forEach((doc) => {
        templates.push({
          id: doc.id,
          ...doc.data(),
        } as InvoiceTemplate);
      });

      return templates;
    } catch (error) {
      console.error('Error getting invoice templates:', error);
      return [];
    }
  }

  // ==================== Invoice Settings ====================

  // Get invoice settings
  async getSettings(companyId: string): Promise<InvoiceSettings> {
    try {
      const settingsDoc = await getDoc(
        doc(db, 'companies', companyId, this.settingsDoc)
      );

      if (!settingsDoc.exists()) {
        // Return default settings
        return {
          companyId,
          invoicePrefix: 'INV',
          nextInvoiceNumber: 1,
          defaultDueDays: 30,
          defaultVatRate: 14,
          showVatBreakdown: true,
          showLogo: true,
          logoPosition: 'left',
          paperSize: 'A4',
        };
      }

      return settingsDoc.data() as InvoiceSettings;
    } catch (error) {
      console.error('Error getting invoice settings:', error);
      throw error;
    }
  }

  // Update invoice settings
  async updateSettings(
    companyId: string,
    settings: Partial<InvoiceSettings>
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
      console.error('Error updating invoice settings:', error);
      throw error;
    }
  }

  // ==================== Invoice Summary ====================

  // Get invoice summary
  async getInvoiceSummary(
    companyId: string,
    branchId?: string
  ): Promise<InvoiceSummary> {
    try {
      const constraints: QueryConstraint[] = [];
      if (branchId) {
        constraints.push(where('branchId', '==', branchId));
      }

      const q = query(
        collection(db, 'companies', companyId, this.invoicesCollection),
        ...constraints
      );

      const snapshot = await getDocs(q);
      
      const summary: InvoiceSummary = {
        totalInvoices: 0,
        totalAmount: 0,
        paidAmount: 0,
        dueAmount: 0,
        overdueAmount: 0,
        draftCount: 0,
        sentCount: 0,
        paidCount: 0,
        overdueCount: 0,
        currentMonthTotal: 0,
        lastMonthTotal: 0,
        growthPercentage: 0,
        topClients: [],
      };

      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

      const clientTotals = new Map<string, { 
        name: string; 
        total: number; 
        count: number; 
      }>();

      snapshot.forEach((doc) => {
        const invoice = doc.data() as Invoice;
        const invoiceDate = invoice.invoiceDate.toDate();
        
        summary.totalInvoices++;
        summary.totalAmount += invoice.totalAmount;
        summary.paidAmount += invoice.paidAmount;
        summary.dueAmount += invoice.dueAmount;

        // Status counts
        switch (invoice.status) {
          case 'draft':
            summary.draftCount++;
            break;
          case 'sent':
          case 'viewed':
            summary.sentCount++;
            break;
          case 'paid':
            summary.paidCount++;
            break;
        }

        // Check overdue
        if (invoice.status !== 'paid' && invoice.status !== 'cancelled' && 
            invoice.dueDate.toDate() < now) {
          summary.overdueCount++;
          summary.overdueAmount += invoice.dueAmount;
        }

        // Monthly totals
        if (invoiceDate >= currentMonthStart) {
          summary.currentMonthTotal += invoice.totalAmount;
        } else if (invoiceDate >= lastMonthStart && invoiceDate <= lastMonthEnd) {
          summary.lastMonthTotal += invoice.totalAmount;
        }

        // Client totals
        const clientData = clientTotals.get(invoice.clientId) || {
          name: invoice.clientName,
          total: 0,
          count: 0,
        };
        clientData.total += invoice.totalAmount;
        clientData.count++;
        clientTotals.set(invoice.clientId, clientData);
      });

      // Calculate growth
      if (summary.lastMonthTotal > 0) {
        summary.growthPercentage = 
          ((summary.currentMonthTotal - summary.lastMonthTotal) / summary.lastMonthTotal) * 100;
      }

      // Top clients
      const sortedClients = Array.from(clientTotals.entries())
        .map(([clientId, data]) => ({
          clientId,
          clientName: data.name,
          totalAmount: data.total,
          invoiceCount: data.count,
        }))
        .sort((a, b) => b.totalAmount - a.totalAmount)
        .slice(0, 5);

      summary.topClients = sortedClients;

      return summary;
    } catch (error) {
      console.error('Error getting invoice summary:', error);
      throw error;
    }
  }

  // ==================== Helper Methods ====================

  // Calculate payment status
  private calculatePaymentStatus(
    paidAmount: number,
    totalAmount: number
  ): PaymentStatus {
    if (paidAmount === 0) return 'unpaid';
    if (paidAmount >= totalAmount) return 'paid';
    if (paidAmount < totalAmount) return 'partial';
    return 'unpaid';
  }

  // Create financial transaction for invoice
  private async createInvoiceTransaction(
    invoice: Invoice,
    invoiceId: string
  ): Promise<void> {
    try {
      // Create income transaction for the invoice
      await financeService.createTransaction({
        companyId: invoice.companyId,
        branchId: invoice.branchId || 'main',
        date: invoice.invoiceDate,
        type: 'income',
        category: 'invoice',
        amount: invoice.totalAmount - invoice.vatAmount,
        vatAmount: invoice.vatAmount,
        totalAmount: invoice.totalAmount,
        accountId: 'default', // TODO: Get from settings
        paymentMethod: 'other',
        referenceType: 'invoice',
        referenceId: invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        description: `Invoice ${invoice.invoiceNumber} - ${invoice.clientName}`,
        descriptionAr: `فاتورة ${invoice.invoiceNumber} - ${invoice.clientName}`,
        status: 'completed',
        createdBy: invoice.createdBy,
      });
    } catch (error) {
      console.error('Error creating invoice transaction:', error);
      // Don't throw - invoice is already created
    }
  }

  // Generate invoice from appointment
  async generateFromAppointment(
    companyId: string,
    appointmentId: string,
    createdBy: string
  ): Promise<string> {
    try {
      // TODO: Get appointment details and create invoice
      // This would integrate with appointment service
      
      throw new Error('Not implemented');
    } catch (error) {
      console.error('Error generating invoice from appointment:', error);
      throw error;
    }
  }

  // Duplicate invoice
  async duplicateInvoice(
    companyId: string,
    invoiceId: string,
    createdBy: string
  ): Promise<string> {
    try {
      const originalInvoice = await this.getInvoice(companyId, invoiceId);
      if (!originalInvoice) {
        throw new Error('Invoice not found');
      }

      // Create new invoice with same items but new dates
      const newInvoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'> = {
        ...originalInvoice,
        invoiceNumber: '', // Will be auto-generated
        invoiceDate: Timestamp.now(),
        dueDate: Timestamp.fromDate(
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
        ),
        status: 'draft',
        paymentStatus: 'unpaid',
        paidAmount: 0,
        dueAmount: originalInvoice.totalAmount,
        payments: [],
        sentAt: undefined,
        viewedAt: undefined,
        lastReminderAt: undefined,
        reminderCount: 0,
        createdBy,
      };

      return await this.createInvoice(newInvoice);
    } catch (error) {
      console.error('Error duplicating invoice:', error);
      throw error;
    }
  }
}

export const invoiceService = new InvoiceService();