import { db, storage } from '../config/firebase';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
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
  increment,
  runTransaction,
  type Unsubscribe,
  type DocumentSnapshot,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import type {
  Product,
  ProductCategory,
  ProductFilters,
  ProductStatistics,
  InventoryTransaction,
  InventoryTransactionType,
  StockTransfer,
  PurchaseOrder,
  Vendor,
  StockAlert,
  ProductType,
} from '../types/product.types';

class ProductService {
  private productsCollection = 'products';
  private categoriesCollection = 'productCategories';
  private transactionsCollection = 'inventoryTransactions';
  private transfersCollection = 'stockTransfers';
  private purchaseOrdersCollection = 'purchaseOrders';
  private vendorsCollection = 'vendors';
  private alertsCollection = 'stockAlerts';

  // ==================== Products ====================

  // Create a new product
  async createProduct(product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const newProduct: any = {
        ...product,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // Remove undefined fields to avoid Firestore errors
      Object.keys(newProduct).forEach(key => {
        if (newProduct[key] === undefined) {
          delete newProduct[key];
        }
      });

      const docRef = await addDoc(
        collection(db, 'companies', product.companyId, this.productsCollection),
        newProduct
      );

      // Create initial stock entries for branches if trackInventory is true
      if (product.trackInventory && product.branchStock) {
        await this.initializeBranchStock(product.companyId, docRef.id, product.branchStock);
      }

      return docRef.id;
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
  }

  // Update a product
  async updateProduct(
    companyId: string,
    productId: string,
    updates: Partial<Product>
  ): Promise<void> {
    try {
      const productRef = doc(db, 'companies', companyId, this.productsCollection, productId);
      
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

      await updateDoc(productRef, updateData);
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  }

  // Get a single product
  async getProduct(companyId: string, productId: string): Promise<Product | null> {
    try {
      const productDoc = await getDoc(
        doc(db, 'companies', companyId, this.productsCollection, productId)
      );

      if (!productDoc.exists()) {
        return null;
      }

      return {
        id: productDoc.id,
        ...productDoc.data(),
      } as Product;
    } catch (error) {
      console.error('Error getting product:', error);
      return null;
    }
  }

  // Get products with filters
  async getProducts(
    companyId: string,
    filters?: ProductFilters,
    pageSize: number = 50,
    lastDoc?: DocumentSnapshot
  ): Promise<{ products: Product[]; lastDoc: DocumentSnapshot | null }> {
    try {
      const constraints: QueryConstraint[] = [];

      // Apply filters
      if (filters?.categoryId) {
        constraints.push(where('categoryId', '==', filters.categoryId));
      }
      if (filters?.type) {
        constraints.push(where('type', '==', filters.type));
      }
      if (filters?.status) {
        constraints.push(where('status', '==', filters.status));
      }
      if (filters?.vendorId) {
        constraints.push(where('vendorId', '==', filters.vendorId));
      }
      if (filters?.hasBarcode) {
        constraints.push(where('barcode', '!=', null));
      }

      // Default ordering
      constraints.push(orderBy('name'));
      constraints.push(limit(pageSize));

      // Pagination
      if (lastDoc) {
        constraints.push(startAfter(lastDoc));
      }

      const q = query(
        collection(db, 'companies', companyId, this.productsCollection),
        ...constraints
      );

      const snapshot = await getDocs(q);
      const products: Product[] = [];

      snapshot.forEach((doc) => {
        const product = {
          id: doc.id,
          ...doc.data(),
        } as Product;

        // Apply client-side filters
        if (filters?.search) {
          const searchLower = filters.search.toLowerCase();
          const matchesSearch = 
            product.name.toLowerCase().includes(searchLower) ||
            product.nameAr?.toLowerCase().includes(searchLower) ||
            product.sku?.toLowerCase().includes(searchLower) ||
            product.barcode?.toLowerCase().includes(searchLower);
          
          if (!matchesSearch) return;
        }

        // Filter by trackInventory if specified
        if (filters?.trackInventory !== undefined && product.trackInventory !== filters.trackInventory) {
          return;
        }

        if (filters?.branchId && product.branchStock) {
          const branchStock = product.branchStock[filters.branchId];
          if (!branchStock) return;
          
          if (filters.lowStock && branchStock.quantity > (product.lowStockThreshold || 0)) {
            return;
          }
        }

        if (filters?.priceRange) {
          if (filters.priceRange.min && product.retailPrice < filters.priceRange.min) return;
          if (filters.priceRange.max && product.retailPrice > filters.priceRange.max) return;
        }

        products.push(product);
      });

      return {
        products,
        lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
      };
    } catch (error) {
      console.error('Error getting products:', error);
      throw error;
    }
  }

  // Subscribe to products
  subscribeToProducts(
    companyId: string,
    filters: ProductFilters | undefined,
    callback: (products: Product[]) => void
  ): Unsubscribe {
    const constraints: QueryConstraint[] = [];

    if (filters?.categoryId) {
      constraints.push(where('categoryId', '==', filters.categoryId));
    }
    if (filters?.type) {
      constraints.push(where('type', '==', filters.type));
    }
    if (filters?.status) {
      constraints.push(where('status', '==', filters.status));
    }

    constraints.push(orderBy('name'));

    const q = query(
      collection(db, 'companies', companyId, this.productsCollection),
      ...constraints
    );

    return onSnapshot(q, (snapshot) => {
      const products: Product[] = [];
      
      snapshot.forEach((doc) => {
        const product = {
          id: doc.id,
          ...doc.data(),
        } as Product;

        // Apply client-side filters
        if (filters?.search) {
          const searchLower = filters.search.toLowerCase();
          const matchesSearch = 
            product.name.toLowerCase().includes(searchLower) ||
            product.nameAr?.toLowerCase().includes(searchLower) ||
            product.sku?.toLowerCase().includes(searchLower) ||
            product.barcode?.toLowerCase().includes(searchLower);
          
          if (!matchesSearch) return;
        }

        products.push(product);
      });

      callback(products);
    });
  }

  // Delete a product (soft delete)
  async deleteProduct(companyId: string, productId: string): Promise<void> {
    try {
      await this.updateProduct(companyId, productId, {
        status: 'discontinued',
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  }

  // Upload product image
  async uploadProductImage(
    companyId: string,
    productId: string,
    file: File,
    isPrimary: boolean = false
  ): Promise<string> {
    try {
      const timestamp = Date.now();
      const fileName = `${productId}_${timestamp}_${file.name}`;
      const storageRef = ref(storage, `companies/${companyId}/products/${productId}/${fileName}`);
      
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      // Update product with new image
      const product = await this.getProduct(companyId, productId);
      if (!product) throw new Error('Product not found');

      const images = product.images || [];
      images.push(downloadURL);

      const updates: Partial<Product> = { images };
      if (isPrimary || !product.primaryImage) {
        updates.primaryImage = downloadURL;
      }

      await this.updateProduct(companyId, productId, updates);

      return downloadURL;
    } catch (error) {
      console.error('Error uploading product image:', error);
      throw error;
    }
  }

  // ==================== Categories ====================

  // Create product category
  async createCategory(category: Omit<ProductCategory, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const newCategory = {
        ...category,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(
        collection(db, 'companies', category.companyId, this.categoriesCollection),
        newCategory
      );

      return docRef.id;
    } catch (error) {
      console.error('Error creating product category:', error);
      throw error;
    }
  }

  // Get product categories
  async getCategories(companyId: string): Promise<ProductCategory[]> {
    try {
      const q = query(
        collection(db, 'companies', companyId, this.categoriesCollection),
        where('isActive', '==', true),
        orderBy('sortOrder', 'asc'),
        orderBy('name', 'asc')
      );

      const snapshot = await getDocs(q);
      const categories: ProductCategory[] = [];

      snapshot.forEach((doc) => {
        categories.push({
          id: doc.id,
          ...doc.data(),
        } as ProductCategory);
      });

      return categories;
    } catch (error) {
      console.error('Error getting product categories:', error);
      return [];
    }
  }

  // Update product category
  async updateCategory(
    companyId: string,
    categoryId: string,
    updates: Partial<ProductCategory>
  ): Promise<void> {
    try {
      const categoryRef = doc(db, 'companies', companyId, this.categoriesCollection, categoryId);
      
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

      await updateDoc(categoryRef, updateData);
    } catch (error) {
      console.error('Error updating product category:', error);
      throw error;
    }
  }

  // Delete product category (soft delete)
  async deleteCategory(companyId: string, categoryId: string): Promise<void> {
    try {
      await this.updateCategory(companyId, categoryId, {
        isActive: false,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error deleting product category:', error);
      throw error;
    }
  }

  // ==================== Inventory Transactions ====================

  // Create inventory transaction
  async createInventoryTransaction(
    transaction: Omit<InventoryTransaction, 'id' | 'createdAt'>,
    updateStock: boolean = true
  ): Promise<string> {
    try {
      return await runTransaction(db, async (firestoreTransaction) => {
        // Get current product stock
        const productRef = doc(
          db,
          'companies',
          transaction.companyId,
          this.productsCollection,
          transaction.productId
        );
        const productDoc = await firestoreTransaction.get(productRef);
        
        if (!productDoc.exists()) {
          throw new Error('Product not found');
        }

        const product = productDoc.data() as Product;
        const branchStock = product.branchStock?.[transaction.branchId] || {
          quantity: 0,
          reservedQuantity: 0,
        };

        // Calculate new quantity
        const previousQuantity = branchStock.quantity;
        const newQuantity = previousQuantity + transaction.quantity;

        if (newQuantity < 0) {
          throw new Error('Insufficient stock');
        }

        // Create transaction record
        const newTransaction = {
          ...transaction,
          previousQuantity,
          newQuantity,
          createdAt: serverTimestamp(),
        };

        const transactionRef = doc(
          collection(db, 'companies', transaction.companyId, this.transactionsCollection)
        );
        firestoreTransaction.set(transactionRef, newTransaction);

        // Update product stock if requested
        if (updateStock) {
          const updatedBranchStock = {
            ...product.branchStock,
            [transaction.branchId]: {
              ...branchStock,
              quantity: newQuantity,
              lastStockCheck: serverTimestamp(),
            },
          };

          firestoreTransaction.update(productRef, {
            branchStock: updatedBranchStock,
            updatedAt: serverTimestamp(),
          });

          // Check for low stock alert
          if (product.lowStockThreshold && newQuantity <= product.lowStockThreshold) {
            await this.createStockAlert(
              transaction.companyId,
              transaction.branchId,
              transaction.productId,
              newQuantity,
              product.lowStockThreshold
            );
          }
        }

        return transactionRef.id;
      });
    } catch (error) {
      console.error('Error creating inventory transaction:', error);
      throw error;
    }
  }

  // Get inventory transactions
  async getInventoryTransactions(
    companyId: string,
    filters?: {
      productId?: string;
      branchId?: string;
      type?: InventoryTransactionType;
      startDate?: Date;
      endDate?: Date;
    },
    pageSize: number = 50
  ): Promise<InventoryTransaction[]> {
    try {
      const constraints: QueryConstraint[] = [];

      if (filters?.productId) {
        constraints.push(where('productId', '==', filters.productId));
      }
      if (filters?.branchId) {
        constraints.push(where('branchId', '==', filters.branchId));
      }
      if (filters?.type) {
        constraints.push(where('type', '==', filters.type));
      }
      if (filters?.startDate) {
        constraints.push(where('date', '>=', Timestamp.fromDate(filters.startDate)));
      }
      if (filters?.endDate) {
        constraints.push(where('date', '<=', Timestamp.fromDate(filters.endDate)));
      }

      constraints.push(orderBy('date', 'desc'));
      constraints.push(limit(pageSize));

      const q = query(
        collection(db, 'companies', companyId, this.transactionsCollection),
        ...constraints
      );

      const snapshot = await getDocs(q);
      const transactions: InventoryTransaction[] = [];

      snapshot.forEach((doc) => {
        transactions.push({
          id: doc.id,
          ...doc.data(),
        } as InventoryTransaction);
      });

      return transactions;
    } catch (error) {
      console.error('Error getting inventory transactions:', error);
      return [];
    }
  }

  // ==================== Stock Management ====================

  // Initialize branch stock
  private async initializeBranchStock(
    companyId: string,
    productId: string,
    branchStock: { [branchId: string]: any }
  ): Promise<void> {
    try {
      const batch = writeBatch(db);

      Object.entries(branchStock).forEach(([branchId, stock]) => {
        if (stock.quantity > 0) {
          const transaction: Omit<InventoryTransaction, 'id' | 'createdAt'> = {
            companyId,
            branchId,
            productId,
            type: 'opening',
            date: Timestamp.now(),
            quantity: stock.quantity,
            previousQuantity: 0,
            newQuantity: stock.quantity,
            notes: 'Opening stock',
            performedBy: stock.performedBy || 'system',
          };

          const transactionRef = doc(
            collection(db, 'companies', companyId, this.transactionsCollection)
          );
          batch.set(transactionRef, {
            ...transaction,
            createdAt: serverTimestamp(),
          });
        }
      });

      await batch.commit();
    } catch (error) {
      console.error('Error initializing branch stock:', error);
      throw error;
    }
  }

  // Adjust stock
  async adjustStock(
    companyId: string,
    branchId: string,
    productId: string,
    quantity: number,
    reason: string,
    performedBy: string
  ): Promise<void> {
    try {
      const transaction: Omit<InventoryTransaction, 'id' | 'createdAt'> = {
        companyId,
        branchId,
        productId,
        type: 'adjustment',
        date: Timestamp.now(),
        quantity,
        previousQuantity: 0, // Will be set in createInventoryTransaction
        newQuantity: 0, // Will be set in createInventoryTransaction
        notes: reason,
        performedBy,
      };

      await this.createInventoryTransaction(transaction);
    } catch (error) {
      console.error('Error adjusting stock:', error);
      throw error;
    }
  }

  // Transfer stock between branches
  async createStockTransfer(
    transfer: Omit<StockTransfer, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    try {
      return await runTransaction(db, async (firestoreTransaction) => {
        // Create transfer record
        const transferRef = doc(
          collection(db, 'companies', transfer.companyId, this.transfersCollection)
        );
        
        firestoreTransaction.set(transferRef, {
          ...transfer,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // Create inventory transactions for each item
        for (const item of transfer.items) {
          // Deduct from source branch
          const outTransaction: Omit<InventoryTransaction, 'id' | 'createdAt'> = {
            companyId: transfer.companyId,
            branchId: transfer.fromBranchId,
            productId: item.productId,
            type: 'transfer_out',
            date: transfer.transferDate,
            quantity: -item.quantity,
            previousQuantity: 0,
            newQuantity: 0,
            referenceType: 'transfer',
            referenceId: transferRef.id,
            toBranchId: transfer.toBranchId,
            transferStatus: transfer.status,
            performedBy: transfer.createdBy,
          };

          await this.createInventoryTransaction(outTransaction, transfer.status === 'completed');

          // Add to destination branch (only if completed)
          if (transfer.status === 'completed') {
            const inTransaction: Omit<InventoryTransaction, 'id' | 'createdAt'> = {
              companyId: transfer.companyId,
              branchId: transfer.toBranchId,
              productId: item.productId,
              type: 'transfer_in',
              date: transfer.actualDeliveryDate || transfer.transferDate,
              quantity: item.quantity,
              previousQuantity: 0,
              newQuantity: 0,
              referenceType: 'transfer',
              referenceId: transferRef.id,
              fromBranchId: transfer.fromBranchId,
              transferStatus: 'completed',
              performedBy: transfer.receivedBy || transfer.createdBy,
            };

            await this.createInventoryTransaction(inTransaction);
          }
        }

        return transferRef.id;
      });
    } catch (error) {
      console.error('Error creating stock transfer:', error);
      throw error;
    }
  }

  // ==================== Stock Alerts ====================

  // Create stock alert
  private async createStockAlert(
    companyId: string,
    branchId: string,
    productId: string,
    currentQuantity: number,
    threshold: number
  ): Promise<void> {
    try {
      const alertType = currentQuantity === 0 ? 'out_of_stock' : 'low_stock';
      const severity = currentQuantity === 0 ? 'high' : 
                      currentQuantity <= threshold / 2 ? 'medium' : 'low';

      const alert: Omit<StockAlert, 'id' | 'createdAt'> = {
        companyId,
        branchId,
        productId,
        type: alertType,
        severity,
        currentQuantity,
        threshold,
        message: `Product stock is ${alertType === 'out_of_stock' ? 'out of stock' : 'running low'}`,
        messageAr: `المخزون ${alertType === 'out_of_stock' ? 'نفد' : 'منخفض'}`,
        isRead: false,
        isResolved: false,
      };

      await addDoc(
        collection(db, 'companies', companyId, this.alertsCollection),
        {
          ...alert,
          createdAt: serverTimestamp(),
        }
      );
    } catch (error) {
      console.error('Error creating stock alert:', error);
    }
  }

  // Get stock alerts
  async getStockAlerts(
    companyId: string,
    branchId?: string,
    unreadOnly: boolean = false
  ): Promise<StockAlert[]> {
    try {
      const constraints: QueryConstraint[] = [];

      if (branchId) {
        constraints.push(where('branchId', '==', branchId));
      }
      if (unreadOnly) {
        constraints.push(where('isRead', '==', false));
      }
      constraints.push(where('isResolved', '==', false));
      constraints.push(orderBy('severity', 'desc'));
      constraints.push(orderBy('createdAt', 'desc'));

      const q = query(
        collection(db, 'companies', companyId, this.alertsCollection),
        ...constraints
      );

      const snapshot = await getDocs(q);
      const alerts: StockAlert[] = [];

      snapshot.forEach((doc) => {
        alerts.push({
          id: doc.id,
          ...doc.data(),
        } as StockAlert);
      });

      return alerts;
    } catch (error) {
      console.error('Error getting stock alerts:', error);
      return [];
    }
  }

  // ==================== Statistics ====================

  // Get product statistics
  async getProductStatistics(
    companyId: string,
    branchId?: string
  ): Promise<ProductStatistics> {
    try {
      const products = await this.getProducts(companyId);
      const categories = await this.getCategories(companyId);

      let totalValue = 0;
      let lowStockCount = 0;
      let outOfStockCount = 0;
      let activeCount = 0;

      products.products.forEach((product) => {
        if (product.status === 'active') {
          activeCount++;
        }

        if (product.trackInventory && product.branchStock) {
          const stock = branchId 
            ? product.branchStock[branchId] 
            : Object.values(product.branchStock).reduce((acc, bs) => ({
                quantity: acc.quantity + bs.quantity,
                reservedQuantity: acc.reservedQuantity + bs.reservedQuantity,
              }), { quantity: 0, reservedQuantity: 0 });

          if (stock) {
            totalValue += stock.quantity * product.retailPrice;
            
            if (stock.quantity === 0) {
              outOfStockCount++;
            } else if (product.lowStockThreshold && stock.quantity <= product.lowStockThreshold) {
              lowStockCount++;
            }
          }
        }
      });

      return {
        totalProducts: products.products.length,
        activeProducts: activeCount,
        lowStockProducts: lowStockCount,
        outOfStockProducts: outOfStockCount,
        totalValue,
        categoriesCount: categories.length,
        averagePrice: activeCount > 0 
          ? products.products
              .filter(p => p.status === 'active')
              .reduce((sum, p) => sum + p.retailPrice, 0) / activeCount
          : 0,
      };
    } catch (error) {
      console.error('Error getting product statistics:', error);
      throw error;
    }
  }

  // Check product availability
  async checkProductAvailability(
    companyId: string,
    branchId: string,
    productId: string,
    requestedQuantity: number
  ): Promise<{ available: boolean; currentStock: number; message?: string }> {
    try {
      const product = await this.getProduct(companyId, productId);
      
      if (!product) {
        return {
          available: false,
          currentStock: 0,
          message: 'Product not found',
        };
      }

      if (!product.trackInventory) {
        return {
          available: true,
          currentStock: -1, // Unlimited
        };
      }

      const branchStock = product.branchStock?.[branchId];
      if (!branchStock) {
        return {
          available: false,
          currentStock: 0,
          message: 'No stock information for this branch',
        };
      }

      const availableQuantity = branchStock.quantity - branchStock.reservedQuantity;
      
      return {
        available: availableQuantity >= requestedQuantity,
        currentStock: availableQuantity,
        message: availableQuantity < requestedQuantity 
          ? `Only ${availableQuantity} units available` 
          : undefined,
      };
    } catch (error) {
      console.error('Error checking product availability:', error);
      throw error;
    }
  }
}

export const productService = new ProductService();