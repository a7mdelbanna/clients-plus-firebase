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
  Timestamp,
  serverTimestamp,
  onSnapshot,
  increment,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type {
  DiscountRule,
  DiscountFilters,
  DiscountValidationResult,
  DiscountCalculationResult,
  AppliedDiscount,
  DiscountUsageStats,
  DiscountType,
  DiscountAppliesTo,
} from '../types/discount.types';
import type { SaleItem } from '../types/sale.types';

class DiscountService {
  private collectionName = 'discountRules';

  // Create a new discount rule
  async createDiscount(discount: Omit<DiscountRule, 'id' | 'createdAt' | 'updatedAt' | 'currentUses'>): Promise<string> {
    const discountData = {
      ...discount,
      currentUses: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, this.collectionName), discountData);
    return docRef.id;
  }

  // Update an existing discount rule
  async updateDiscount(discountId: string, updates: Partial<DiscountRule>): Promise<void> {
    const docRef = doc(db, this.collectionName, discountId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  }

  // Get a discount rule by ID
  async getDiscount(discountId: string): Promise<DiscountRule | null> {
    const docRef = doc(db, this.collectionName, discountId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as DiscountRule;
    }
    
    return null;
  }

  // Get discount rules with filters
  async getDiscounts(
    companyId: string,
    filters: DiscountFilters = {},
    limitCount = 50
  ): Promise<{
    discounts: DiscountRule[];
    lastDoc: any;
  }> {
    let q = query(
      collection(db, this.collectionName),
      where('companyId', '==', companyId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    // Apply filters
    if (filters.isActive !== undefined) {
      q = query(q, where('isActive', '==', filters.isActive));
    }

    if (filters.discountType) {
      q = query(q, where('discountType', '==', filters.discountType));
    }

    if (filters.appliesTo) {
      q = query(q, where('appliesTo', '==', filters.appliesTo));
    }

    if (filters.branchId) {
      q = query(q, where('branchId', '==', filters.branchId));
    }

    const querySnapshot = await getDocs(q);
    const discounts = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as DiscountRule[];

    // Apply client-side filters for complex conditions
    let filteredDiscounts = discounts;

    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filteredDiscounts = filteredDiscounts.filter(discount =>
        discount.name.toLowerCase().includes(searchTerm) ||
        discount.nameAr?.toLowerCase().includes(searchTerm) ||
        discount.description?.toLowerCase().includes(searchTerm)
      );
    }

    if (filters.startDate || filters.endDate) {
      filteredDiscounts = filteredDiscounts.filter(discount => {
        if (!discount.startDate && !discount.endDate) return true;
        
        const discountStart = discount.startDate?.toDate();
        const discountEnd = discount.endDate?.toDate();
        
        if (filters.startDate && discountEnd && discountEnd < filters.startDate) return false;
        if (filters.endDate && discountStart && discountStart > filters.endDate) return false;
        
        return true;
      });
    }

    return {
      discounts: filteredDiscounts,
      lastDoc: querySnapshot.docs[querySnapshot.docs.length - 1],
    };
  }

  // Subscribe to discount rules changes
  subscribeToDiscounts(
    companyId: string,
    filters: DiscountFilters = {},
    callback: (discounts: DiscountRule[]) => void
  ): () => void {
    let q = query(
      collection(db, this.collectionName),
      where('companyId', '==', companyId),
      orderBy('createdAt', 'desc')
    );

    // Apply filters
    if (filters.isActive !== undefined) {
      q = query(q, where('isActive', '==', filters.isActive));
    }

    if (filters.branchId) {
      q = query(q, where('branchId', '==', filters.branchId));
    }

    return onSnapshot(q, (snapshot) => {
      const discounts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as DiscountRule[];

      callback(discounts);
    });
  }

  // Delete a discount rule
  async deleteDiscount(discountId: string): Promise<void> {
    const docRef = doc(db, this.collectionName, discountId);
    await deleteDoc(docRef);
  }

  // Validate discount rules for a sale
  async validateDiscount(
    discountId: string,
    customerId: string | undefined,
    items: SaleItem[],
    subtotal: number,
    branchId: string,
    currentDate: Date = new Date()
  ): Promise<DiscountValidationResult> {
    const discount = await this.getDiscount(discountId);
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!discount) {
      errors.push('Discount not found');
      return { isValid: false, errors, warnings };
    }

    // Check if discount is active
    if (!discount.isActive) {
      errors.push('Discount is not active');
    }

    // Check branch restrictions
    if (discount.branchId && discount.branchId !== branchId) {
      errors.push('Discount not valid for this branch');
    }

    // Check date validity
    if (discount.startDate && discount.startDate.toDate() > currentDate) {
      errors.push('Discount is not yet valid');
    }

    if (discount.endDate && discount.endDate.toDate() < currentDate) {
      errors.push('Discount has expired');
    }

    // Check time restrictions
    if (discount.validHours) {
      const currentTime = currentDate.toTimeString().slice(0, 5);
      if (currentTime < discount.validHours.start || currentTime > discount.validHours.end) {
        errors.push(`Discount only valid between ${discount.validHours.start} and ${discount.validHours.end}`);
      }
    }

    // Check day restrictions
    if (discount.validDays && discount.validDays.length > 0) {
      const currentDay = currentDate.getDay();
      if (!discount.validDays.includes(currentDay)) {
        errors.push('Discount not valid on this day of the week');
      }
    }

    // Check minimum order amount
    if (discount.minimumOrderAmount && subtotal < discount.minimumOrderAmount) {
      errors.push(`Minimum order amount of ${discount.minimumOrderAmount} EGP required`);
    }

    // Check minimum quantity
    if (discount.minimumQuantity) {
      const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
      if (totalQuantity < discount.minimumQuantity) {
        errors.push(`Minimum quantity of ${discount.minimumQuantity} items required`);
      }
    }

    // Check usage limits
    if (discount.usageLimit === 'limited' && discount.maxUses) {
      if (discount.currentUses >= discount.maxUses) {
        errors.push('Discount usage limit reached');
      } else if (discount.currentUses >= discount.maxUses * 0.9) {
        warnings.push('Discount usage limit almost reached');
      }
    }

    // Check customer restrictions
    if (customerId) {
      if (discount.allowedCustomerIds && !discount.allowedCustomerIds.includes(customerId)) {
        errors.push('Customer not eligible for this discount');
      }

      if (discount.excludedCustomerIds && discount.excludedCustomerIds.includes(customerId)) {
        errors.push('Customer excluded from this discount');
      }

      // Check per-customer usage limit
      if (discount.maxUsesPerCustomer) {
        // This would require tracking customer usage - placeholder for now
        warnings.push('Customer usage limit not implemented yet');
      }
    }

    // Check product/category applicability
    if (discount.appliesTo === 'product' && discount.productIds) {
      const applicableItems = items.filter(item => discount.productIds?.includes(item.productId));
      if (applicableItems.length === 0) {
        errors.push('No eligible products in cart for this discount');
      }
    }

    if (discount.appliesTo === 'category' && discount.categoryIds) {
      // This would require product category information - placeholder for now
      warnings.push('Category-based discounts not fully implemented yet');
    }

    // Calculate maximum discount amount for percentage discounts
    let maxDiscountAmount: number | undefined;
    if (discount.maximumDiscountAmount && discount.discountType === 'percentage') {
      maxDiscountAmount = discount.maximumDiscountAmount;
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined,
      maxDiscountAmount,
    };
  }

  // Calculate discount amount for items
  calculateDiscount(
    discount: DiscountRule,
    items: SaleItem[],
    subtotal: number
  ): DiscountCalculationResult {
    let discountAmount = 0;
    const appliedDiscounts: AppliedDiscount[] = [];
    const itemIds: string[] = [];

    switch (discount.appliesTo) {
      case 'order':
        // Apply to entire order
        if (discount.discountType === 'percentage') {
          discountAmount = (subtotal * discount.discountValue) / 100;
        } else {
          discountAmount = discount.discountValue;
        }

        // Apply maximum discount cap
        if (discount.maximumDiscountAmount && discountAmount > discount.maximumDiscountAmount) {
          discountAmount = discount.maximumDiscountAmount;
        }

        // Ensure discount doesn't exceed subtotal
        discountAmount = Math.min(discountAmount, subtotal);
        break;

      case 'product':
        // Apply to specific products
        if (discount.productIds) {
          const eligibleItems = items.filter(item => discount.productIds?.includes(item.productId));
          const eligibleSubtotal = eligibleItems.reduce((sum, item) => sum + item.subtotal, 0);
          
          if (discount.discountType === 'percentage') {
            discountAmount = (eligibleSubtotal * discount.discountValue) / 100;
          } else {
            discountAmount = Math.min(discount.discountValue, eligibleSubtotal);
          }

          itemIds.push(...eligibleItems.map(item => item.productId));
        }
        break;

      case 'category':
        // Category-based discounts would require product category mapping
        // Placeholder implementation
        break;
    }

    // Ensure discount is not negative or NaN
    discountAmount = Math.max(0, discountAmount || 0);

    const appliedDiscount: AppliedDiscount = {
      discountId: discount.id!,
      discountName: discount.name,
      discountType: discount.discountType,
      discountValue: discount.discountValue,
      appliedAmount: discountAmount,
      appliesTo: discount.appliesTo,
      itemIds: itemIds.length > 0 ? itemIds : undefined,
      appliedAt: Timestamp.now(),
    };

    appliedDiscounts.push(appliedDiscount);

    return {
      originalAmount: subtotal,
      discountAmount,
      finalAmount: subtotal - discountAmount,
      appliedDiscounts,
      savings: discountAmount,
    };
  }

  // Apply multiple discounts with combination rules
  async applyMultipleDiscounts(
    discountIds: string[],
    items: SaleItem[],
    subtotal: number,
    customerId?: string,
    branchId?: string
  ): Promise<DiscountCalculationResult> {
    const discounts: DiscountRule[] = [];
    
    // Load all discounts
    for (const id of discountIds) {
      const discount = await this.getDiscount(id);
      if (discount) {
        discounts.push(discount);
      }
    }

    // Check combination rules
    const validDiscounts = discounts.filter(discount => {
      if (!discount.canCombineWithOthers && discounts.length > 1) {
        return false;
      }

      if (discount.excludedDiscountIds) {
        const hasExcluded = discountIds.some(id => 
          id !== discount.id && discount.excludedDiscountIds?.includes(id)
        );
        if (hasExcluded) return false;
      }

      return true;
    });

    let totalDiscountAmount = 0;
    let currentSubtotal = subtotal;
    const allAppliedDiscounts: AppliedDiscount[] = [];

    // Apply discounts in order (order discounts first, then product-specific)
    const orderDiscounts = validDiscounts.filter(d => d.appliesTo === 'order');
    const productDiscounts = validDiscounts.filter(d => d.appliesTo === 'product');

    // Apply order-level discounts first
    for (const discount of orderDiscounts) {
      const result = this.calculateDiscount(discount, items, currentSubtotal);
      totalDiscountAmount += result.discountAmount;
      currentSubtotal -= result.discountAmount;
      allAppliedDiscounts.push(...result.appliedDiscounts);
    }

    // Apply product-level discounts
    for (const discount of productDiscounts) {
      const result = this.calculateDiscount(discount, items, subtotal); // Use original subtotal for product discounts
      totalDiscountAmount += result.discountAmount;
      allAppliedDiscounts.push(...result.appliedDiscounts);
    }

    return {
      originalAmount: subtotal,
      discountAmount: totalDiscountAmount,
      finalAmount: subtotal - totalDiscountAmount,
      appliedDiscounts: allAppliedDiscounts,
      savings: totalDiscountAmount,
    };
  }

  // Record discount usage (call this when a sale is completed)
  async recordDiscountUsage(discountId: string, saleId: string, amount: number): Promise<void> {
    const discountRef = doc(db, this.collectionName, discountId);
    await updateDoc(discountRef, {
      currentUses: increment(1),
      lastUsedAt: serverTimestamp(),
    });

    // Create usage record for analytics
    const usageRef = collection(db, 'discountUsage');
    await addDoc(usageRef, {
      discountId,
      saleId,
      amount,
      usedAt: serverTimestamp(),
    });
  }

  // Get discount usage statistics
  async getDiscountStats(discountId: string): Promise<DiscountUsageStats | null> {
    const discount = await this.getDiscount(discountId);
    if (!discount) return null;

    // Get usage records
    const usageQuery = query(
      collection(db, 'discountUsage'),
      where('discountId', '==', discountId),
      orderBy('usedAt', 'desc')
    );

    const usageSnapshot = await getDocs(usageQuery);
    const usageRecords = usageSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const totalUses = usageRecords.length;
    const totalSavings = usageRecords.reduce((sum, record) => sum + (record.amount || 0), 0);

    // This is a simplified version - full implementation would require more complex aggregation
    return {
      discountId,
      discountName: discount.name,
      totalUses,
      totalSavings,
      averageOrderValue: totalUses > 0 ? totalSavings / totalUses : 0,
      conversionRate: 0, // Would require order data to calculate
      topCustomers: [], // Would require customer usage tracking
      usageByDate: [], // Would require date-based aggregation
    };
  }

  // Get active discounts for POS
  async getActiveDiscountsForPOS(
    companyId: string,
    branchId: string,
    customerId?: string
  ): Promise<DiscountRule[]> {
    const currentDate = new Date();
    const currentTime = currentDate.toTimeString().slice(0, 5);
    const currentDay = currentDate.getDay();

    const { discounts } = await this.getDiscounts(companyId, {
      isActive: true,
      branchId,
    });

    // Filter discounts that are currently valid
    return discounts.filter(discount => {
      // Check date validity
      if (discount.startDate && discount.startDate.toDate() > currentDate) return false;
      if (discount.endDate && discount.endDate.toDate() < currentDate) return false;

      // Check time restrictions
      if (discount.validHours) {
        if (currentTime < discount.validHours.start || currentTime > discount.validHours.end) {
          return false;
        }
      }

      // Check day restrictions
      if (discount.validDays && discount.validDays.length > 0) {
        if (!discount.validDays.includes(currentDay)) return false;
      }

      // Check usage limits
      if (discount.usageLimit === 'limited' && discount.maxUses) {
        if (discount.currentUses >= discount.maxUses) return false;
      }

      // Check customer restrictions
      if (customerId) {
        if (discount.allowedCustomerIds && !discount.allowedCustomerIds.includes(customerId)) {
          return false;
        }
        if (discount.excludedCustomerIds && discount.excludedCustomerIds.includes(customerId)) {
          return false;
        }
      }

      return true;
    });
  }
}

export const discountService = new DiscountService();