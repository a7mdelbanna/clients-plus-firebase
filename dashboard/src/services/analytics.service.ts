import {
  collection,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Sale } from '../types/sale.types';

export interface SalesMetrics {
  totalSales: number;
  totalRevenue: number;
  totalProfit: number;
  averageOrderValue: number;
  totalTransactions: number;
  growthRate: number;
  profitMargin: number;
}

export interface TopProduct {
  productId: string;
  productName: string;
  quantitySold: number;
  revenue: number;
  profit: number;
  profitMargin: number;
  salesCount: number;
}

export interface StaffPerformance {
  staffId: string;
  staffName: string;
  totalSales: number;
  totalRevenue: number;
  totalTransactions: number;
  averageOrderValue: number;
  topProduct: string;
}

export interface SalesAnalytics {
  metrics: SalesMetrics;
  topProducts: TopProduct[];
  staffPerformance: StaffPerformance[];
  dailyTrends: Array<{
    date: string;
    sales: number;
    revenue: number;
    transactions: number;
  }>;
  paymentMethodBreakdown: Record<string, {
    amount: number;
    percentage: number;
    transactionCount: number;
  }>;
  hourlyTrends: Array<{
    hour: number;
    sales: number;
    transactions: number;
  }>;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface AnalyticsFilters {
  branchId?: string;
  staffId?: string;
  productId?: string;
  paymentMethod?: string;
  dateRange: DateRange;
}

class AnalyticsService {
  private salesCollection = 'sales';

  // Get comprehensive sales analytics
  async getSalesAnalytics(
    companyId: string,
    filters: AnalyticsFilters
  ): Promise<SalesAnalytics> {
    try {
      const sales = await this.getSalesData(companyId, filters);
      
      const metrics = this.calculateSalesMetrics(sales, filters);
      const topProducts = this.calculateTopProducts(sales);
      const staffPerformance = this.calculateStaffPerformance(sales);
      const dailyTrends = this.calculateDailyTrends(sales, filters);
      const paymentMethodBreakdown = this.calculatePaymentMethodBreakdown(sales);
      const hourlyTrends = this.calculateHourlyTrends(sales);

      return {
        metrics,
        topProducts,
        staffPerformance,
        dailyTrends,
        paymentMethodBreakdown,
        hourlyTrends,
      };
    } catch (error) {
      console.error('Error getting sales analytics:', error);
      throw error;
    }
  }

  // Get sales data for analysis
  private async getSalesData(
    companyId: string,
    filters: AnalyticsFilters
  ): Promise<Sale[]> {
    try {
      const constraints: QueryConstraint[] = [
        where('status', '==', 'completed'),
        where('createdAt', '>=', Timestamp.fromDate(filters.dateRange.startDate)),
        where('createdAt', '<=', Timestamp.fromDate(filters.dateRange.endDate)),
      ];

      if (filters.branchId) {
        constraints.push(where('branchId', '==', filters.branchId));
      }

      if (filters.staffId) {
        constraints.push(where('staffId', '==', filters.staffId));
      }

      constraints.push(orderBy('createdAt', 'desc'));

      const q = query(
        collection(db, 'companies', companyId, this.salesCollection),
        ...constraints
      );

      const snapshot = await getDocs(q);
      const sales: Sale[] = [];

      snapshot.forEach((doc) => {
        const sale = {
          id: doc.id,
          ...doc.data(),
        } as Sale;

        // Apply client-side filters
        if (filters.productId) {
          const hasProduct = sale.items.some(item => item.productId === filters.productId);
          if (!hasProduct) return;
        }

        if (filters.paymentMethod) {
          const hasPaymentMethod = sale.payments.some(payment => payment.method === filters.paymentMethod);
          if (!hasPaymentMethod) return;
        }

        sales.push(sale);
      });

      return sales;
    } catch (error) {
      console.error('Error getting sales data:', error);
      throw error;
    }
  }

  // Calculate overall sales metrics
  private calculateSalesMetrics(sales: Sale[], filters: AnalyticsFilters): SalesMetrics {
    const totalRevenue = sales.reduce((sum, sale) => sum + sale.total, 0);
    const totalProfit = sales.reduce((sum, sale) => sum + (sale.profitMargin || 0), 0);
    const totalSales = sales.length;
    const averageOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    // Calculate growth rate by comparing with previous period
    const growthRate = this.calculateGrowthRate(sales, filters);

    return {
      totalSales,
      totalRevenue,
      totalProfit,
      averageOrderValue,
      totalTransactions: totalSales,
      growthRate,
      profitMargin,
    };
  }

  // Calculate top selling products
  private calculateTopProducts(sales: Sale[]): TopProduct[] {
    const productMap = new Map<string, {
      productName: string;
      quantitySold: number;
      revenue: number;
      profit: number;
      salesCount: number;
    }>();

    sales.forEach(sale => {
      sale.items.forEach(item => {
        const existing = productMap.get(item.productId) || {
          productName: item.productName,
          quantitySold: 0,
          revenue: 0,
          profit: 0,
          salesCount: 0,
        };

        existing.quantitySold += item.quantity;
        existing.revenue += item.subtotal;
        existing.profit += (item.subtotal - (item.cost || 0) * item.quantity);
        existing.salesCount += 1;

        productMap.set(item.productId, existing);
      });
    });

    return Array.from(productMap.entries())
      .map(([productId, data]) => ({
        productId,
        productName: data.productName,
        quantitySold: data.quantitySold,
        revenue: data.revenue,
        profit: data.profit,
        profitMargin: data.revenue > 0 ? (data.profit / data.revenue) * 100 : 0,
        salesCount: data.salesCount,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }

  // Calculate staff performance metrics
  private calculateStaffPerformance(sales: Sale[]): StaffPerformance[] {
    const staffMap = new Map<string, {
      staffName: string;
      totalSales: number;
      totalRevenue: number;
      totalTransactions: number;
      topProducts: Map<string, number>;
    }>();

    sales.forEach(sale => {
      const existing = staffMap.get(sale.staffId) || {
        staffName: sale.staffName,
        totalSales: 0,
        totalRevenue: 0,
        totalTransactions: 0,
        topProducts: new Map(),
      };

      existing.totalSales += 1;
      existing.totalRevenue += sale.total;
      existing.totalTransactions += 1;

      // Track top products for each staff member
      sale.items.forEach(item => {
        const productRevenue = existing.topProducts.get(item.productName) || 0;
        existing.topProducts.set(item.productName, productRevenue + item.subtotal);
      });

      staffMap.set(sale.staffId, existing);
    });

    return Array.from(staffMap.entries())
      .map(([staffId, data]) => {
        const topProduct = Array.from(data.topProducts.entries())
          .sort((a, b) => b[1] - a[1])[0]?.[0] || '';

        return {
          staffId,
          staffName: data.staffName,
          totalSales: data.totalSales,
          totalRevenue: data.totalRevenue,
          totalTransactions: data.totalTransactions,
          averageOrderValue: data.totalTransactions > 0 ? data.totalRevenue / data.totalTransactions : 0,
          topProduct,
        };
      })
      .sort((a, b) => b.totalRevenue - a.totalRevenue);
  }

  // Calculate daily sales trends
  private calculateDailyTrends(sales: Sale[], filters: AnalyticsFilters): Array<{
    date: string;
    sales: number;
    revenue: number;
    transactions: number;
  }> {
    const dailyMap = new Map<string, {
      sales: number;
      revenue: number;
      transactions: number;
    }>();

    sales.forEach(sale => {
      const date = sale.createdAt.toDate().toISOString().split('T')[0];
      const existing = dailyMap.get(date) || {
        sales: 0,
        revenue: 0,
        transactions: 0,
      };

      existing.sales += 1;
      existing.revenue += sale.total;
      existing.transactions += 1;

      dailyMap.set(date, existing);
    });

    return Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date,
        sales: data.sales,
        revenue: data.revenue,
        transactions: data.transactions,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // Calculate payment method breakdown
  private calculatePaymentMethodBreakdown(sales: Sale[]): Record<string, {
    amount: number;
    percentage: number;
    transactionCount: number;
  }> {
    const paymentMap = new Map<string, { amount: number; transactionCount: number }>();
    let totalAmount = 0;

    sales.forEach(sale => {
      sale.payments.forEach(payment => {
        const existing = paymentMap.get(payment.method) || { amount: 0, transactionCount: 0 };
        existing.amount += payment.amount;
        existing.transactionCount += 1;
        paymentMap.set(payment.method, existing);
        totalAmount += payment.amount;
      });
    });

    const result: Record<string, { amount: number; percentage: number; transactionCount: number }> = {};
    
    paymentMap.forEach((data, method) => {
      result[method] = {
        amount: data.amount,
        percentage: totalAmount > 0 ? (data.amount / totalAmount) * 100 : 0,
        transactionCount: data.transactionCount,
      };
    });

    return result;
  }

  // Calculate hourly sales trends
  private calculateHourlyTrends(sales: Sale[]): Array<{
    hour: number;
    sales: number;
    transactions: number;
  }> {
    const hourlyMap = new Map<number, { sales: number; transactions: number }>();

    // Initialize all hours
    for (let hour = 0; hour < 24; hour++) {
      hourlyMap.set(hour, { sales: 0, transactions: 0 });
    }

    sales.forEach(sale => {
      const hour = sale.createdAt.toDate().getHours();
      const existing = hourlyMap.get(hour) || { sales: 0, transactions: 0 };
      existing.sales += sale.total;
      existing.transactions += 1;
      hourlyMap.set(hour, existing);
    });

    return Array.from(hourlyMap.entries())
      .map(([hour, data]) => ({
        hour,
        sales: data.sales,
        transactions: data.transactions,
      }))
      .sort((a, b) => a.hour - b.hour);
  }

  // Calculate growth rate compared to previous period
  private calculateGrowthRate(sales: Sale[], filters: AnalyticsFilters): number {
    // This is a simplified growth calculation
    // In a real implementation, you'd compare with the previous period
    const periodLength = filters.dateRange.endDate.getTime() - filters.dateRange.startDate.getTime();
    const daysInPeriod = periodLength / (1000 * 60 * 60 * 24);
    
    if (daysInPeriod <= 1) return 0;
    
    const recentSales = sales.filter(sale => {
      const saleDate = sale.createdAt.toDate();
      const midPoint = new Date(filters.dateRange.startDate.getTime() + periodLength / 2);
      return saleDate >= midPoint;
    });
    
    const olderSales = sales.filter(sale => {
      const saleDate = sale.createdAt.toDate();
      const midPoint = new Date(filters.dateRange.startDate.getTime() + periodLength / 2);
      return saleDate < midPoint;
    });
    
    const recentRevenue = recentSales.reduce((sum, sale) => sum + sale.total, 0);
    const olderRevenue = olderSales.reduce((sum, sale) => sum + sale.total, 0);
    
    if (olderRevenue === 0) return recentRevenue > 0 ? 100 : 0;
    
    return ((recentRevenue - olderRevenue) / olderRevenue) * 100;
  }

  // Get quick dashboard metrics
  async getDashboardMetrics(
    companyId: string,
    branchId?: string
  ): Promise<{
    today: SalesMetrics;
    thisWeek: SalesMetrics;
    thisMonth: SalesMetrics;
    topProductsToday: TopProduct[];
  }> {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisWeekStart = new Date(today);
      thisWeekStart.setDate(today.getDate() - today.getDay());
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const [todayAnalytics, weekAnalytics, monthAnalytics] = await Promise.all([
        this.getSalesAnalytics(companyId, {
          branchId,
          dateRange: { startDate: today, endDate: now },
        }),
        this.getSalesAnalytics(companyId, {
          branchId,
          dateRange: { startDate: thisWeekStart, endDate: now },
        }),
        this.getSalesAnalytics(companyId, {
          branchId,
          dateRange: { startDate: thisMonthStart, endDate: now },
        }),
      ]);

      return {
        today: todayAnalytics.metrics,
        thisWeek: weekAnalytics.metrics,
        thisMonth: monthAnalytics.metrics,
        topProductsToday: todayAnalytics.topProducts.slice(0, 5),
      };
    } catch (error) {
      console.error('Error getting dashboard metrics:', error);
      throw error;
    }
  }
}

export const analyticsService = new AnalyticsService();