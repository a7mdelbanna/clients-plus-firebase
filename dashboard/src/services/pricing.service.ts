import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// Pricing plan configuration
export interface PricingPlan {
  id: string;
  name: string;
  nameAr?: string;
  price: number; // In EGP
  currency: 'EGP';
  features: string[];
  featuresAr?: string[];
  limits: {
    branches: number;
    staff: number;
    appointments: number;
    sms: number;
    storage?: number; // In GB
  };
  popular?: boolean;
  isActive: boolean;
  order: number; // Display order
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// Pricing override for specific companies
export interface PricingOverride {
  id?: string;
  companyId: string;
  companyName: string;
  planId: string;
  originalPrice: number;
  customPrice?: number;
  discountPercentage?: number;
  discountAmount?: number;
  reason: string;
  validFrom: Timestamp;
  validUntil?: Timestamp;
  addons?: {
    whiteLabel?: {
      enabled: boolean;
      customPrice?: number;
    };
    mobileApp?: {
      enabled: boolean;
      customPrice?: number;
    };
  };
  createdBy: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// Add-on configuration
export interface AddOn {
  id: string;
  name: string;
  nameAr?: string;
  description: string;
  descriptionAr?: string;
  type: 'whiteLabel' | 'mobileApp' | 'custom';
  pricing: {
    oneTime?: number;
    monthly?: number;
    setup?: number;
  };
  features: string[];
  featuresAr?: string[];
  isActive: boolean;
  order: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// Company subscription info
export interface CompanySubscription {
  companyId: string;
  planId: string;
  status: 'active' | 'past_due' | 'cancelled' | 'suspended';
  pricing: {
    amount: number;
    currency: 'EGP';
    isLegacy?: boolean;
    legacyStartDate?: Timestamp;
  };
  billingCycle: 'monthly' | 'annual';
  currentPeriodStart: Timestamp;
  currentPeriodEnd: Timestamp;
  nextBillingDate?: Timestamp;
  addons?: Array<{
    id: string;
    status: 'active' | 'pending' | 'cancelled';
    activatedAt: Timestamp;
  }>;
  override?: PricingOverride;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

class PricingService {
  // Get all pricing plans
  async getPricingPlans(activeOnly = true): Promise<PricingPlan[]> {
    try {
      const plansRef = collection(db, 'pricing_configs');
      let q = query(plansRef, orderBy('order', 'asc'));
      
      if (activeOnly) {
        q = query(plansRef, where('isActive', '==', true), orderBy('order', 'asc'));
      }
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as PricingPlan));
    } catch (error) {
      console.error('Error getting pricing plans:', error);
      throw error;
    }
  }

  // Get a specific pricing plan
  async getPricingPlan(planId: string): Promise<PricingPlan | null> {
    try {
      const planDoc = await getDoc(doc(db, 'pricing_configs', planId));
      if (!planDoc.exists()) return null;
      
      return {
        id: planDoc.id,
        ...planDoc.data(),
      } as PricingPlan;
    } catch (error) {
      console.error('Error getting pricing plan:', error);
      throw error;
    }
  }

  // Create or update pricing plan (superadmin only)
  async savePricingPlan(plan: Partial<PricingPlan>): Promise<string> {
    try {
      const planData: any = {
        ...plan,
        updatedAt: serverTimestamp(),
      };

      if (!plan.id) {
        // Create new plan
        planData.createdAt = serverTimestamp();
        const docRef = doc(collection(db, 'pricing_configs'));
        await setDoc(docRef, planData);
        return docRef.id;
      } else {
        // Update existing plan
        const { id, ...updateData } = planData;
        await updateDoc(doc(db, 'pricing_configs', id), updateData);
        return id;
      }
    } catch (error) {
      console.error('Error saving pricing plan:', error);
      throw error;
    }
  }

  // Get all add-ons
  async getAddOns(activeOnly = true): Promise<AddOn[]> {
    try {
      const addonsRef = collection(db, 'addons');
      let q = query(addonsRef, orderBy('order', 'asc'));
      
      if (activeOnly) {
        q = query(addonsRef, where('isActive', '==', true), orderBy('order', 'asc'));
      }
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as AddOn));
    } catch (error) {
      console.error('Error getting add-ons:', error);
      throw error;
    }
  }

  // Get pricing overrides for a company
  async getCompanyPricingOverride(companyId: string): Promise<PricingOverride | null> {
    try {
      const overridesRef = collection(db, 'pricing_overrides');
      const q = query(
        overridesRef,
        where('companyId', '==', companyId),
        where('validFrom', '<=', Timestamp.now()),
        orderBy('validFrom', 'desc')
      );
      
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;

      const override = snapshot.docs[0].data() as PricingOverride;
      
      // Check if override is still valid
      if (override.validUntil && override.validUntil.toMillis() < Date.now()) {
        return null;
      }

      return {
        id: snapshot.docs[0].id,
        ...override,
      };
    } catch (error) {
      console.error('Error getting company pricing override:', error);
      throw error;
    }
  }

  // Create or update pricing override (superadmin only)
  async savePricingOverride(override: Partial<PricingOverride>): Promise<string> {
    try {
      const overrideData: any = {
        ...override,
        updatedAt: serverTimestamp(),
      };

      if (!override.id) {
        // Create new override
        overrideData.createdAt = serverTimestamp();
        const docRef = doc(collection(db, 'pricing_overrides'));
        await setDoc(docRef, overrideData);
        
        // Log to audit
        await this.logPricingChange('override_created', {
          companyId: override.companyId,
          overrideId: docRef.id,
          details: override,
        });
        
        return docRef.id;
      } else {
        // Update existing override
        const { id, ...updateData } = overrideData;
        await updateDoc(doc(db, 'pricing_overrides', id), updateData);
        
        // Log to audit
        await this.logPricingChange('override_updated', {
          companyId: override.companyId,
          overrideId: id,
          details: updateData,
        });
        
        return id;
      }
    } catch (error) {
      console.error('Error saving pricing override:', error);
      throw error;
    }
  }

  // Get company subscription details
  async getCompanySubscription(companyId: string): Promise<CompanySubscription | null> {
    try {
      const company = await getDoc(doc(db, 'companies', companyId));
      if (!company.exists()) return null;

      const companyData = company.data();
      const subscription = companyData.subscription;
      
      if (!subscription) return null;

      // Check for pricing override
      const override = await this.getCompanyPricingOverride(companyId);
      
      return {
        ...subscription,
        override,
      };
    } catch (error) {
      console.error('Error getting company subscription:', error);
      throw error;
    }
  }

  // Calculate effective price for a company
  async calculateEffectivePrice(companyId: string, planId: string): Promise<{
    basePrice: number;
    effectivePrice: number;
    discount?: number;
    discountType?: 'percentage' | 'fixed';
    isLegacy: boolean;
  }> {
    try {
      // Get the plan
      const plan = await this.getPricingPlan(planId);
      if (!plan) throw new Error('Plan not found');

      // Get company subscription
      const subscription = await this.getCompanySubscription(companyId);
      
      // Check if company has legacy pricing
      if (subscription?.pricing.isLegacy) {
        return {
          basePrice: plan.price,
          effectivePrice: subscription.pricing.amount,
          isLegacy: true,
        };
      }

      // Check for override
      const override = await this.getCompanyPricingOverride(companyId);
      if (override && override.planId === planId) {
        if (override.customPrice) {
          return {
            basePrice: plan.price,
            effectivePrice: override.customPrice,
            discount: plan.price - override.customPrice,
            discountType: 'fixed',
            isLegacy: false,
          };
        } else if (override.discountPercentage) {
          const discountAmount = plan.price * (override.discountPercentage / 100);
          return {
            basePrice: plan.price,
            effectivePrice: plan.price - discountAmount,
            discount: override.discountPercentage,
            discountType: 'percentage',
            isLegacy: false,
          };
        }
      }

      // No override or legacy pricing
      return {
        basePrice: plan.price,
        effectivePrice: plan.price,
        isLegacy: false,
      };
    } catch (error) {
      console.error('Error calculating effective price:', error);
      throw error;
    }
  }

  // Subscribe to pricing plan changes
  subscribeToPricingPlans(
    callback: (plans: PricingPlan[]) => void,
    activeOnly = true
  ): Unsubscribe {
    const plansRef = collection(db, 'pricing_configs');
    let q = query(plansRef, orderBy('order', 'asc'));
    
    if (activeOnly) {
      q = query(plansRef, where('isActive', '==', true), orderBy('order', 'asc'));
    }

    return onSnapshot(q, (snapshot) => {
      const plans = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as PricingPlan));
      callback(plans);
    });
  }

  // Log pricing changes to audit log
  private async logPricingChange(action: string, details: any): Promise<void> {
    try {
      const auditRef = collection(db, 'audit_logs');
      await setDoc(doc(auditRef), {
        action,
        category: 'pricing',
        details,
        timestamp: serverTimestamp(),
        performedBy: 'system', // Should be replaced with actual superadmin ID
      });
    } catch (error) {
      console.error('Error logging pricing change:', error);
      // Don't throw - logging shouldn't break the main operation
    }
  }

  // Get pricing data for public API (landing page)
  async getPublicPricingData(): Promise<{
    plans: PricingPlan[];
    addons: AddOn[];
    lastUpdated: Date;
  }> {
    try {
      const [plans, addons] = await Promise.all([
        this.getPricingPlans(true),
        this.getAddOns(true),
      ]);

      return {
        plans,
        addons,
        lastUpdated: new Date(),
      };
    } catch (error) {
      console.error('Error getting public pricing data:', error);
      throw error;
    }
  }
}

export const pricingService = new PricingService();