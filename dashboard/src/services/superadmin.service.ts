import {
  collection,
  doc,
  getDocs,
  getDoc,
  updateDoc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  Timestamp,
  serverTimestamp,
  DocumentSnapshot,
  type QueryConstraint,
  writeBatch,
  increment,
  getCountFromServer,
} from 'firebase/firestore';
import { db, auth } from '../config/firebase';

// Business status
export type BusinessStatus = 'active' | 'suspended' | 'pending' | 'cancelled';

// Company subscription info (copied from pricing.service.ts to avoid circular import)
export interface CompanySubscription {
  companyId: string;
  planId: string;
  status: BusinessStatus;
  pricing: {
    amount: number;
    currency: 'EGP';
    billingCycle: 'monthly' | 'yearly';
  };
  currentPeriodStart: Timestamp;
  currentPeriodEnd: Timestamp;
  nextBillingDate?: Timestamp;
  trialEnd?: Timestamp;
  cancelAtPeriodEnd?: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Business summary for list view
export interface BusinessSummary {
  id: string;
  name: string;
  businessName?: string;
  email: string;
  plan: string;
  status: BusinessStatus;
  monthlyRevenue: number;
  totalUsers: number;
  totalBranches: number;
  createdAt: Timestamp;
  lastActivity?: Timestamp;
  subscription?: CompanySubscription;
}

// Detailed business info
export interface BusinessDetail extends BusinessSummary {
  ownerId: string;
  ownerName: string;
  phone?: string;
  address?: {
    street: string;
    city: string;
    country: string;
  };
  settings?: any;
  usage: {
    appointments: number;
    clients: number;
    staff: number;
    services: number;
    storage: number; // In MB
  };
  billing: {
    lastPayment?: Timestamp;
    nextPayment?: Timestamp;
    paymentMethod?: string;
    currency: 'EGP';
  };
}

// Analytics data
export interface PlatformAnalytics {
  totalBusinesses: number;
  activeBusinesses: number;
  totalRevenue: number;
  monthlyRevenue: number;
  totalUsers: number;
  averageRevenuePerUser: number;
  churnRate: number;
  growthRate: number;
  planDistribution: Array<{
    plan: string;
    count: number;
    percentage: number;
  }>;
  revenueByPlan: Array<{
    plan: string;
    revenue: number;
    percentage: number;
  }>;
  monthlyTrend: Array<{
    month: string;
    revenue: number;
    businesses: number;
    newBusinesses: number;
  }>;
}

// Search filters
export interface BusinessFilters {
  status?: BusinessStatus;
  plan?: string;
  searchTerm?: string;
  minRevenue?: number;
  maxRevenue?: number;
  createdAfter?: Date;
  createdBefore?: Date;
  hasOverride?: boolean;
}

class SuperadminService {
  // Debug helper to check superadmin status
  async debugSuperadminStatus(): Promise<void> {
    try {
      const currentUser = auth.currentUser;
      console.log('🔍 Current user:', currentUser?.uid || 'No user authenticated');
      
      if (!currentUser) {
        console.error('❌ No user is currently authenticated');
        return;
      }
      
      // Check if superadmin document exists
      const superadminDoc = await getDoc(doc(db, 'superadmins', currentUser.uid));
      console.log('📄 Superadmin document exists:', superadminDoc.exists());
      
      if (superadminDoc.exists()) {
        const data = superadminDoc.data();
        console.log('📋 Superadmin document data:', data);
        console.log('✅ Role check:', data?.role === 'superadmin' ? 'PASS' : 'FAIL');
      }
      
      // Try to access companies collection to test rules
      console.log('🧪 Testing companies collection access...');
      const companiesRef = collection(db, 'companies');
      const testQuery = query(companiesRef, limit(1));
      const result = await getDocs(testQuery);
      console.log('✅ Companies access test: SUCCESS');
      console.log('📊 Found', result.size, 'companies in test query');
      
    } catch (error) {
      console.error('❌ Debug test failed:', error);
    }
  }
  // Get paginated list of businesses
  async getBusinesses(
    filters: BusinessFilters = {},
    pageSize = 20,
    lastDoc?: DocumentSnapshot
  ): Promise<{
    businesses: BusinessSummary[];
    lastDoc: DocumentSnapshot | null;
    hasMore: boolean;
  }> {
    try {
      console.log('🔄 Getting businesses with filters:', filters);
      const companiesRef = collection(db, 'companies');
      
      // Simplified query - just get all and filter client-side for now
      const constraints: QueryConstraint[] = [
        orderBy('createdAt', 'desc'),
        limit(pageSize + 1)
      ];
      
      if (lastDoc) {
        constraints.push(startAfter(lastDoc));
      }

      const q = query(companiesRef, ...constraints);
      const snapshot = await getDocs(q);

      console.log(`📊 Retrieved ${snapshot.docs.length} businesses from Firestore`);

      const businesses: BusinessSummary[] = [];
      let lastVisible: DocumentSnapshot | null = null;

      snapshot.docs.slice(0, pageSize).forEach((doc, index) => {
        const data = doc.data();
        console.log(`🏢 Processing business ${index + 1}: ${data.name || data.businessName || doc.id}`);
        
        const business: BusinessSummary = {
          id: doc.id,
          name: data.name || data.businessName || 'Unnamed Business',
          businessName: data.businessName,
          email: data.email || '',
          plan: data.subscription?.planId || 'free',
          status: (data.subscription?.status as BusinessStatus) || 'active',
          monthlyRevenue: data.subscription?.pricing?.amount || 0,
          totalUsers: data.stats?.totalUsers || 1,
          totalBranches: data.stats?.totalBranches || 1,
          createdAt: data.createdAt,
          lastActivity: data.lastActivity,
          subscription: data.subscription,
        };

        businesses.push(business);
        
        if (index === pageSize - 1) {
          lastVisible = doc;
        }
      });

      // Apply client-side filtering
      let filteredBusinesses = businesses;
      
      if (filters.status && filters.status !== 'active') {
        filteredBusinesses = filteredBusinesses.filter(b => b.status === filters.status);
      }
      
      if (filters.plan) {
        filteredBusinesses = filteredBusinesses.filter(b => b.plan === filters.plan);
      }
      
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        filteredBusinesses = filteredBusinesses.filter(b => 
          b.name.toLowerCase().includes(searchLower) ||
          b.email.toLowerCase().includes(searchLower) ||
          (b.businessName && b.businessName.toLowerCase().includes(searchLower))
        );
      }

      console.log(`✅ Returning ${filteredBusinesses.length} filtered businesses`);

      return {
        businesses: filteredBusinesses,
        lastDoc: lastVisible,
        hasMore: snapshot.docs.length > pageSize,
      };
    } catch (error) {
      console.error('❌ Error getting businesses:', error);
      throw error;
    }
  }

  // Get detailed business information
  async getBusinessDetail(businessId: string): Promise<BusinessDetail | null> {
    try {
      const businessDoc = await getDoc(doc(db, 'companies', businessId));
      if (!businessDoc.exists()) return null;

      const data = businessDoc.data();
      
      // Get owner details
      const ownerDoc = await getDoc(doc(db, 'users', data.ownerId));
      const ownerData = ownerDoc.exists() ? ownerDoc.data() : {};

      // Get usage stats (you might want to aggregate these from subcollections)
      const usage = {
        appointments: data.stats?.totalAppointments || 0,
        clients: data.stats?.totalClients || 0,
        staff: data.stats?.totalStaff || 0,
        services: data.stats?.totalServices || 0,
        storage: data.stats?.totalStorage || 0,
      };

      return {
        id: businessDoc.id,
        name: data.name || data.businessName || 'Unnamed Business',
        businessName: data.businessName,
        email: data.email || ownerData.email || '',
        ownerId: data.ownerId,
        ownerName: ownerData.displayName || ownerData.name || 'Unknown',
        phone: data.phone,
        address: data.address,
        plan: data.subscription?.planId || 'free',
        status: data.subscription?.status || 'active',
        monthlyRevenue: data.subscription?.pricing?.amount || 0,
        totalUsers: data.stats?.totalUsers || 1,
        totalBranches: data.stats?.totalBranches || 1,
        createdAt: data.createdAt,
        lastActivity: data.lastActivity,
        subscription: data.subscription,
        settings: data.settings,
        usage,
        billing: {
          lastPayment: data.billing?.lastPayment,
          nextPayment: data.subscription?.nextBillingDate,
          paymentMethod: data.billing?.paymentMethod,
          currency: 'EGP',
        },
      };
    } catch (error) {
      console.error('Error getting business detail:', error);
      throw error;
    }
  }

  // Update business status
  async updateBusinessStatus(
    businessId: string,
    status: BusinessStatus,
    reason?: string
  ): Promise<void> {
    try {
      const batch = writeBatch(db);
      
      // Update company document
      const companyRef = doc(db, 'companies', businessId);
      batch.update(companyRef, {
        'subscription.status': status,
        'subscription.statusUpdatedAt': serverTimestamp(),
        'subscription.statusReason': reason || null,
        updatedAt: serverTimestamp(),
      });

      // Log the action
      const auditRef = doc(collection(db, 'audit_logs'));
      batch.set(auditRef, {
        action: 'business_status_updated',
        category: 'business_management',
        targetId: businessId,
        details: {
          newStatus: status,
          reason,
        },
        timestamp: serverTimestamp(),
        performedBy: 'superadmin', // Should be actual admin ID
      });

      await batch.commit();
    } catch (error) {
      console.error('Error updating business status:', error);
      throw error;
    }
  }

  // Activate or deactivate a business
  async toggleBusinessActivation(
    businessId: string,
    activate: boolean,
    reason?: string
  ): Promise<void> {
    const newStatus = activate ? 'active' : 'suspended';
    await this.updateBusinessStatus(businessId, newStatus, reason);
  }

  // Update business plan
  async updateBusinessPlan(
    businessId: string,
    newPlanId: string,
    applyImmediately = false
  ): Promise<void> {
    try {
      const updateData: any = {
        'subscription.planId': newPlanId,
        'subscription.planUpdatedAt': serverTimestamp(),
      };

      if (applyImmediately) {
        updateData['subscription.currentPeriodStart'] = serverTimestamp();
        // Calculate new period end based on billing cycle
        // This is simplified - in production you'd want proper date calculation
        updateData['subscription.currentPeriodEnd'] = Timestamp.fromDate(
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        );
      }

      await updateDoc(doc(db, 'companies', businessId), {
        ...updateData,
        updatedAt: serverTimestamp(),
      });

      // Log the action
      await this.logAction('business_plan_updated', {
        businessId,
        newPlanId,
        applyImmediately,
      });
    } catch (error) {
      console.error('Error updating business plan:', error);
      throw error;
    }
  }

  // Get platform analytics
  async getPlatformAnalytics(): Promise<PlatformAnalytics> {
    try {
      console.log('📊 Starting platform analytics...');
      console.log('🔐 Current auth state:', auth.currentUser?.uid || 'No user');
      console.log('🔐 Auth user email:', auth.currentUser?.email || 'No email');
      
      if (!auth.currentUser) {
        throw new Error('❌ No authenticated user - superadmin authentication failed');
      }
      
      const companiesRef = collection(db, 'companies');
      
      // Simplified approach - just get all companies first
      console.log('🔄 Getting all companies...');
      const allBusinesses = await getDocs(companiesRef);
      const totalBusinesses = allBusinesses.size;
      
      console.log(`📈 Found ${totalBusinesses} total businesses`);
      
      let activeBusinesses = 0;
      let totalRevenue = 0;
      let monthlyRevenue = 0;
      let totalUsers = 0;
      const planCounts: { [key: string]: number } = {};
      const planRevenue: { [key: string]: number } = {};

      allBusinesses.forEach(doc => {
        const data = doc.data();
        console.log(`🏢 Processing business: ${data.name || data.businessName || doc.id}`);
        
        const revenue = data.subscription?.pricing?.amount || 0;
        const status = data.subscription?.status || 'active';
        
        if (status === 'active') {
          activeBusinesses++;
          monthlyRevenue += revenue;
        }
        
        totalRevenue += revenue * 12; // Annual projection
        totalUsers += data.stats?.totalUsers || 1;
        
        const plan = data.subscription?.planId || 'free';
        planCounts[plan] = (planCounts[plan] || 0) + 1;
        planRevenue[plan] = (planRevenue[plan] || 0) + revenue;
      });

      console.log(`✅ Processed: ${activeBusinesses} active, ${monthlyRevenue} monthly revenue`);

      // Calculate plan distribution
      const planDistribution = Object.entries(planCounts).map(([plan, count]) => ({
        plan,
        count,
        percentage: totalBusinesses > 0 ? (count / totalBusinesses) * 100 : 0,
      }));

      // Calculate revenue by plan
      const revenueByPlan = Object.entries(planRevenue).map(([plan, revenue]) => ({
        plan,
        revenue,
        percentage: monthlyRevenue > 0 ? (revenue / monthlyRevenue) * 100 : 0,
      }));

      // Calculate metrics
      const averageRevenuePerUser = activeBusinesses > 0 ? monthlyRevenue / activeBusinesses : 0;
      const churnRate = 2.3; // Mock data
      const growthRate = 8.7; // Mock data

      // Mock monthly trend
      const monthlyTrend = [
        { month: 'Jan', revenue: 145000, businesses: 285, newBusinesses: 12 },
        { month: 'Feb', revenue: 152000, businesses: 298, newBusinesses: 13 },
        { month: 'Mar', revenue: 168000, businesses: 315, newBusinesses: 17 },
        { month: 'Apr', revenue: 172000, businesses: 324, newBusinesses: 9 },
        { month: 'May', revenue: 181000, businesses: 338, newBusinesses: 14 },
        { month: 'Jun', revenue: monthlyRevenue, businesses: totalBusinesses, newBusinesses: 28 },
      ];

      const result = {
        totalBusinesses,
        activeBusinesses,
        totalRevenue,
        monthlyRevenue,
        totalUsers,
        averageRevenuePerUser,
        churnRate,
        growthRate,
        planDistribution,
        revenueByPlan,
        monthlyTrend,
      };

      console.log('📊 Analytics result:', result);
      return result;
    } catch (error) {
      console.error('❌ Error getting platform analytics:', error);
      throw error;
    }
  }

  // Send announcement to businesses
  async sendAnnouncement(
    title: string,
    message: string,
    targetAudience: 'all' | 'active' | 'plan' | 'custom',
    filters?: {
      plans?: string[];
      businessIds?: string[];
    }
  ): Promise<void> {
    try {
      const announcementRef = doc(collection(db, 'system_announcements'));
      await setDoc(announcementRef, {
        title,
        message,
        targetAudience,
        filters,
        active: true,
        createdAt: serverTimestamp(),
        createdBy: 'superadmin', // Should be actual admin ID
      });

      // Log the action
      await this.logAction('announcement_sent', {
        announcementId: announcementRef.id,
        title,
        targetAudience,
      });
    } catch (error) {
      console.error('Error sending announcement:', error);
      throw error;
    }
  }

  // Private helper to log actions
  private async logAction(action: string, details: any): Promise<void> {
    try {
      const auditRef = doc(collection(db, 'audit_logs'));
      await setDoc(auditRef, {
        action,
        category: 'superadmin',
        details,
        timestamp: serverTimestamp(),
        performedBy: 'superadmin', // Should be actual admin ID
      });
    } catch (error) {
      console.error('Error logging action:', error);
    }
  }
}

export const superadminService = new SuperadminService();

// Expose debug functions globally for console debugging
declare global {
  interface Window {
    debugSuperadminStatus: () => Promise<void>;
    fixSuperadminDocument: (uid: string) => Promise<void>;
  }
}

window.debugSuperadminStatus = () => superadminService.debugSuperadminStatus();
window.fixSuperadminDocument = async (uid: string) => {
  try {
    console.log('🔧 Creating/fixing superadmin document for UID:', uid);
    await setDoc(doc(db, 'superadmins', uid), {
      role: 'superadmin',
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
    }, { merge: true });
    console.log('✅ Superadmin document created/fixed successfully');
  } catch (error) {
    console.error('❌ Failed to fix superadmin document:', error);
  }
};