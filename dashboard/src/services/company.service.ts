import { db } from '../config/firebase';
import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  Timestamp
} from 'firebase/firestore';

export interface CompanyStats {
  totalClients: number;
  activeProjects: number;
  monthlyRevenue: number;
  growthRate: number;
  clientsGrowth: string;
  projectsGrowth: string;
  revenueGrowth: string;
  growthRateChange: string;
}

export interface RecentActivity {
  id: string;
  title: string;
  titleAr: string;
  time: Date;
  type: 'client' | 'project' | 'invoice' | 'meeting';
}

class CompanyService {
  async getCompanyStats(companyId: string): Promise<CompanyStats> {
    try {
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

      // Get clients count
      let totalClients = 0;
      try {
        const clientsQuery = query(
          collection(db, 'clients'),
          where('companyId', '==', companyId),
          where('status', '==', 'active')
        );
        const clientsSnapshot = await getDocs(clientsQuery);
        totalClients = clientsSnapshot.size;
      } catch (error) {
        console.log('No clients collection access yet - this is normal for new companies');
      }

      // Get clients from last month for growth calculation
      let clientsGrowth = '+0%';
      try {
        const lastMonthClientsQuery = query(
          collection(db, 'clients'),
          where('companyId', '==', companyId),
          where('createdAt', '>=', Timestamp.fromDate(lastMonthStart)),
          where('createdAt', '<=', Timestamp.fromDate(lastMonthEnd))
        );
        const lastMonthClientsSnapshot = await getDocs(lastMonthClientsQuery);
        const lastMonthClients = lastMonthClientsSnapshot.size;
        
        clientsGrowth = lastMonthClients > 0 
          ? `+${Math.round(((totalClients - lastMonthClients) / lastMonthClients) * 100)}%`
          : '+0%';
      } catch (error) {
        // Default growth for new companies
      }

      // Get active projects count
      let activeProjects = 0;
      try {
        const projectsQuery = query(
          collection(db, 'projects'),
          where('companyId', '==', companyId),
          where('status', 'in', ['active', 'in_progress'])
        );
        const projectsSnapshot = await getDocs(projectsQuery);
        activeProjects = projectsSnapshot.size;
      } catch (error) {
        console.log('No projects collection access yet - this is normal for new companies');
      }

      // Calculate projects growth
      const projectsGrowth = '+0%'; // Default for new companies

      // Get current month revenue
      let monthlyRevenue = 0;
      try {
        const invoicesQuery = query(
          collection(db, 'invoices'),
          where('companyId', '==', companyId),
          where('status', '==', 'paid'),
          where('paidAt', '>=', Timestamp.fromDate(currentMonthStart)),
          where('paidAt', '<=', Timestamp.fromDate(currentMonthEnd))
        );
        const invoicesSnapshot = await getDocs(invoicesQuery);
        
        invoicesSnapshot.forEach(doc => {
          const data = doc.data();
          monthlyRevenue += data.amount || 0;
        });
      } catch (error) {
        console.log('No invoices collection access yet - this is normal for new companies');
      }

      // Calculate revenue growth
      let revenueGrowth = '+0%';
      try {
        const lastMonthInvoicesQuery = query(
          collection(db, 'invoices'),
          where('companyId', '==', companyId),
          where('status', '==', 'paid'),
          where('paidAt', '>=', Timestamp.fromDate(lastMonthStart)),
          where('paidAt', '<=', Timestamp.fromDate(lastMonthEnd))
        );
        const lastMonthInvoicesSnapshot = await getDocs(lastMonthInvoicesQuery);
        
        let lastMonthRevenue = 0;
        lastMonthInvoicesSnapshot.forEach(doc => {
          const data = doc.data();
          lastMonthRevenue += data.amount || 0;
        });

        revenueGrowth = lastMonthRevenue > 0
          ? `+${Math.round(((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)}%`
          : '+0%';
      } catch (error) {
        // Default growth for new companies
      }

      // Calculate overall growth rate
      const growthRate = 0; // Start at 0 for new companies
      const growthRateChange = '+0%'; // No change yet for new companies

      return {
        totalClients: totalClients || 0,
        activeProjects: activeProjects || 0,
        monthlyRevenue: monthlyRevenue || 0,
        growthRate: growthRate || 0,
        clientsGrowth,
        projectsGrowth,
        revenueGrowth,
        growthRateChange
      };
    } catch (error: any) {
      // Don't log permission errors - they're expected for new companies
      if (error?.code !== 'permission-denied') {
        console.error('Error fetching company stats:', error);
      }
      // Return default values if there's an error
      return {
        totalClients: 0,
        activeProjects: 0,
        monthlyRevenue: 0,
        growthRate: 0,
        clientsGrowth: '+0%',
        projectsGrowth: '+0%',
        revenueGrowth: '+0%',
        growthRateChange: '+0%'
      };
    }
  }

  async getRecentActivities(_companyId: string, _limitCount: number = 4): Promise<RecentActivity[]> {
    try {
      // For now, return empty array since we don't have activity logging yet
      // In a real implementation, this would query an activities collection
      return [];
    } catch (error) {
      console.error('Error fetching recent activities:', error);
      return [];
    }
  }

  async getCompanyInfo(companyId: string): Promise<any> {
    try {
      const companyDoc = await getDoc(doc(db, 'companies', companyId));
      if (companyDoc.exists()) {
        return companyDoc.data();
      }
      return null;
    } catch (error) {
      console.error('Error fetching company info:', error);
      return null;
    }
  }
}

export const companyService = new CompanyService();