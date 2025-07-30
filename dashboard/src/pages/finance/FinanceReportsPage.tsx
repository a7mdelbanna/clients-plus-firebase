import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  useTheme,
  CircularProgress,
  Divider,
  Chip,
  FormControl,
  InputLabel,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  AccountBalance,
  Assessment,
  DateRange,
  FileDownload,
  Print,
  CalendarToday,
  ShowChart,
  PieChart as PieChartIcon,
  BarChart as BarChartIcon,
  AttachMoney,
  Receipt,
  AccountBalanceWallet,
  FilterList,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { motion } from 'framer-motion';
import CountUp from 'react-countup';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';
import { useBranch } from '../../contexts/BranchContext';
import { financeService } from '../../services/finance.service';
import type {
  FinancialTransaction,
  FinancialAccount,
  TransactionType,
  PaymentMethod,
} from '../../types/finance.types';

interface ReportData {
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  cashFlow: number;
  transactionCount: number;
  averageTransactionValue: number;
  topCategories: { category: string; amount: number; type: TransactionType }[];
  paymentMethodBreakdown: { method: PaymentMethod; amount: number; count: number }[];
  monthlyTrends: { month: string; income: number; expenses: number; profit: number }[];
  dailyTransactions: { date: string; income: number; expenses: number }[];
  accountBalances: { account: FinancialAccount; balance: number; transactions: number }[];
}

const FinanceReportsPage: React.FC = () => {
  const theme = useTheme();
  const { currentUser } = useAuth();
  const { currentBranch } = useBranch();
  const isRTL = theme.direction === 'rtl';

  // State
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState(0);
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'year' | 'custom'>('month');
  const [startDate, setStartDate] = useState(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState(endOfMonth(new Date()));
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');

  // Load data on component mount and when filters change
  useEffect(() => {
    if (currentUser?.companyId) {
      loadReportData();
    }
  }, [currentUser?.companyId, currentBranch?.id, startDate, endDate]);

  // Handle date range changes
  useEffect(() => {
    const now = new Date();
    switch (dateRange) {
      case 'today':
        setStartDate(new Date(now.setHours(0, 0, 0, 0)));
        setEndDate(new Date(now.setHours(23, 59, 59, 999)));
        break;
      case 'week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        setStartDate(weekStart);
        setEndDate(weekEnd);
        break;
      case 'month':
        setStartDate(startOfMonth(now));
        setEndDate(endOfMonth(now));
        break;
      case 'year':
        setStartDate(new Date(now.getFullYear(), 0, 1));
        setEndDate(new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999));
        break;
      // 'custom' case is handled by the date pickers
    }
  }, [dateRange]);

  const loadReportData = async () => {
    if (!currentUser?.companyId) return;

    try {
      setLoading(true);

      // Load transactions and accounts
      const [transactionsResult, accountsData] = await Promise.all([
        financeService.getTransactions(currentUser.companyId, {
          branchId: currentBranch?.id,
          startDate,
          endDate,
          status: 'completed',
        }),
        financeService.getAccounts(currentUser.companyId, {
          branchId: currentBranch?.id,
        }),
      ]);

      const allTransactions = transactionsResult.transactions;
      setTransactions(allTransactions);
      setAccounts(accountsData);

      // Process report data
      const processedData = await processReportData(allTransactions, accountsData);
      setReportData(processedData);
    } catch (error) {
      console.error('Error loading report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const processReportData = async (
    transactions: FinancialTransaction[],
    accounts: FinancialAccount[]
  ): Promise<ReportData> => {
    // Calculate totals
    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.totalAmount, 0);

    const totalExpenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.totalAmount, 0);

    const netProfit = totalIncome - totalExpenses;
    const cashFlow = netProfit; // Simplified cash flow calculation

    // Transaction count and average
    const transactionCount = transactions.length;
    const averageTransactionValue = transactionCount > 0
      ? (totalIncome + totalExpenses) / transactionCount
      : 0;

    // Top categories
    const categoryMap = new Map<string, { amount: number; type: TransactionType }>();
    transactions.forEach(t => {
      const key = `${t.category}_${t.type}`;
      const existing = categoryMap.get(key) || { amount: 0, type: t.type };
      categoryMap.set(key, {
        amount: existing.amount + t.totalAmount,
        type: t.type,
      });
    });

    const topCategories = Array.from(categoryMap.entries())
      .map(([key, value]) => ({
        category: key.split('_')[0],
        amount: value.amount,
        type: value.type,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // Payment method breakdown
    const paymentMethodMap = new Map<PaymentMethod, { amount: number; count: number }>();
    transactions.forEach(t => {
      const existing = paymentMethodMap.get(t.paymentMethod) || { amount: 0, count: 0 };
      paymentMethodMap.set(t.paymentMethod, {
        amount: existing.amount + t.totalAmount,
        count: existing.count + 1,
      });
    });

    const paymentMethodBreakdown = Array.from(paymentMethodMap.entries())
      .map(([method, data]) => ({
        method,
        ...data,
      }));

    // Monthly trends (last 6 months)
    const monthlyTrends = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = startOfMonth(subMonths(new Date(), i));
      const monthEnd = endOfMonth(monthStart);
      
      const monthTransactions = transactions.filter(t => {
        const transactionDate = t.date.toDate();
        return transactionDate >= monthStart && transactionDate <= monthEnd;
      });

      const monthIncome = monthTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.totalAmount, 0);

      const monthExpenses = monthTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.totalAmount, 0);

      monthlyTrends.push({
        month: format(monthStart, 'MMM yyyy'),
        income: monthIncome,
        expenses: monthExpenses,
        profit: monthIncome - monthExpenses,
      });
    }

    // Daily transactions for the selected period
    const dailyMap = new Map<string, { income: number; expenses: number }>();
    transactions.forEach(t => {
      const dateKey = format(t.date.toDate(), 'yyyy-MM-dd');
      const existing = dailyMap.get(dateKey) || { income: 0, expenses: 0 };
      
      if (t.type === 'income') {
        existing.income += t.totalAmount;
      } else if (t.type === 'expense') {
        existing.expenses += t.totalAmount;
      }
      
      dailyMap.set(dateKey, existing);
    });

    const dailyTransactions = Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date,
        ...data,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Account balances with transaction counts
    const accountBalances = accounts.map(account => {
      const accountTransactions = transactions.filter(t => t.accountId === account.id);
      return {
        account,
        balance: account.currentBalance,
        transactions: accountTransactions.length,
      };
    });

    return {
      totalIncome,
      totalExpenses,
      netProfit,
      cashFlow,
      transactionCount,
      averageTransactionValue,
      topCategories,
      paymentMethodBreakdown,
      monthlyTrends,
      dailyTransactions,
      accountBalances,
    };
  };

  // Chart colors
  const CHART_COLORS = [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.success.main,
    theme.palette.warning.main,
    theme.palette.error.main,
    theme.palette.grey[500],
  ];

  // Render metric card
  const MetricCard = ({
    title,
    value,
    change,
    icon,
    color,
    prefix = '',
    suffix = '',
  }: {
    title: string;
    value: number;
    change?: number;
    icon: React.ReactNode;
    color: string;
    prefix?: string;
    suffix?: string;
  }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Typography color="text.secondary" gutterBottom variant="body2">
                {title}
              </Typography>
              <Typography variant="h4" component="div" sx={{ mb: 1 }}>
                {prefix}
                <CountUp
                  end={value}
                  duration={1}
                  separator=","
                  decimals={suffix === '%' ? 1 : 0}
                />
                {suffix}
              </Typography>
              {change !== undefined && (
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  {change >= 0 ? (
                    <TrendingUp sx={{ fontSize: 16, color: 'success.main' }} />
                  ) : (
                    <TrendingDown sx={{ fontSize: 16, color: 'error.main' }} />
                  )}
                  <Typography
                    variant="body2"
                    color={change >= 0 ? 'success.main' : 'error.main'}
                  >
                    {Math.abs(change)}%
                  </Typography>
                </Stack>
              )}
            </Box>
            <Box
              sx={{
                backgroundColor: `${color}.50`,
                borderRadius: 2,
                p: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {React.cloneElement(icon as React.ReactElement, {
                sx: { fontSize: 32, color: `${color}.main` },
              })}
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </motion.div>
  );

  // Tab panels
  const renderOverviewTab = () => (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)', lg: 'repeat(4, 1fr) 2fr 1fr' }, gap: 3 }}>
      {/* Metric Cards */}
      <Box>
        <MetricCard
          title={isRTL ? 'إجمالي الإيرادات' : 'Total Income'}
          value={reportData?.totalIncome || 0}
          icon={<TrendingUp />}
          color="success"
          suffix={` ${isRTL ? 'ج.م' : 'EGP'}`}
        />
      </Box>
      <Box>
        <MetricCard
          title={isRTL ? 'إجمالي المصروفات' : 'Total Expenses'}
          value={reportData?.totalExpenses || 0}
          icon={<TrendingDown />}
          color="error"
          suffix={` ${isRTL ? 'ج.م' : 'EGP'}`}
        />
      </Box>
      <Box>
        <MetricCard
          title={isRTL ? 'صافي الربح' : 'Net Profit'}
          value={reportData?.netProfit || 0}
          icon={<AttachMoney />}
          color={reportData?.netProfit >= 0 ? 'success' : 'error'}
          suffix={` ${isRTL ? 'ج.م' : 'EGP'}`}
        />
      </Box>
      <Box>
        <MetricCard
          title={isRTL ? 'عدد المعاملات' : 'Transactions'}
          value={reportData?.transactionCount || 0}
          icon={<Receipt />}
          color="primary"
        />
      </Box>

      {/* Revenue vs Expenses Chart */}
      <Box sx={{ gridColumn: { xs: 'span 1', lg: 'span 2' } }}>
        <Paper sx={{ p: 3, height: '400px' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6">
              {isRTL ? 'الإيرادات مقابل المصروفات' : 'Revenue vs Expenses'}
            </Typography>
            <ToggleButtonGroup
              value={chartType}
              exclusive
              onChange={(_, value) => value && setChartType(value)}
              size="small"
            >
              <ToggleButton value="line">
                <ShowChart />
              </ToggleButton>
              <ToggleButton value="bar">
                <BarChartIcon />
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>
          <Box sx={{ height: 'calc(100% - 60px)' }}>
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'line' ? (
                <LineChart data={reportData?.monthlyTrends || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="income"
                    stroke={theme.palette.success.main}
                    name={isRTL ? 'الإيرادات' : 'Income'}
                  />
                  <Line
                    type="monotone"
                    dataKey="expenses"
                    stroke={theme.palette.error.main}
                    name={isRTL ? 'المصروفات' : 'Expenses'}
                  />
                </LineChart>
              ) : (
                <BarChart data={reportData?.monthlyTrends || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="income"
                    fill={theme.palette.success.main}
                    name={isRTL ? 'الإيرادات' : 'Income'}
                  />
                  <Bar
                    dataKey="expenses"
                    fill={theme.palette.error.main}
                    name={isRTL ? 'المصروفات' : 'Expenses'}
                  />
                </BarChart>
              )}
            </ResponsiveContainer>
          </Box>
        </Paper>
      </Box>

      {/* Payment Methods Breakdown */}
      <Box>
        <Paper sx={{ p: 3, height: '400px' }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            {isRTL ? 'طرق الدفع' : 'Payment Methods'}
          </Typography>
          <Box sx={{ height: 'calc(100% - 40px)' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={reportData?.paymentMethodBreakdown.map(d => {
                    const labels: Record<PaymentMethod, string> = {
                      cash: isRTL ? 'نقدي' : 'Cash',
                      card: isRTL ? 'بطاقة' : 'Card',
                      bank_transfer: isRTL ? 'تحويل بنكي' : 'Bank Transfer',
                      digital_wallet: isRTL ? 'محفظة رقمية' : 'Digital Wallet',
                      check: isRTL ? 'شيك' : 'Check',
                      other: isRTL ? 'أخرى' : 'Other',
                    };
                    return {
                      name: labels[d.method] || d.method,
                      value: d.amount,
                    };
                  }) || []}
                  cx="50%"
                  cy="50%"
                  outerRadius="80%"
                  dataKey="value"
                  label
                >
                  {reportData?.paymentMethodBreakdown.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Box>
        </Paper>
      </Box>

      {/* Top Categories */}
      <Box sx={{ gridColumn: '1 / -1' }}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            {isRTL ? 'أعلى الفئات' : 'Top Categories'}
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 2 }}>
            {reportData?.topCategories.map((category, index) => (
              <Box key={index}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{
                    p: 2,
                    borderRadius: 1,
                    bgcolor: category.type === 'income' ? 'success.50' : 'error.50',
                  }}
                >
                  <Box>
                    <Typography variant="body1" fontWeight="medium">
                      {category.category}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {category.type === 'income'
                        ? isRTL ? 'إيراد' : 'Income'
                        : isRTL ? 'مصروف' : 'Expense'}
                    </Typography>
                  </Box>
                  <Typography variant="h6" color={category.type === 'income' ? 'success.main' : 'error.main'}>
                    {category.amount.toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                  </Typography>
                </Stack>
              </Box>
            ))}
          </Box>
        </Paper>
      </Box>
    </Box>
  );

  const renderCashFlowTab = () => (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 3 }}>
      {/* Cash Flow Summary */}
      <Box>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
          <Paper sx={{ p: 3, flex: 1 }}>
            <Stack spacing={2}>
              <Typography variant="h6">
                {isRTL ? 'ملخص التدفق النقدي' : 'Cash Flow Summary'}
              </Typography>
              <Stack direction="row" justifyContent="space-between">
                <Typography color="text.secondary">
                  {isRTL ? 'رصيد البداية' : 'Opening Balance'}
                </Typography>
                <Typography>
                  {accounts.reduce((sum, acc) => sum + acc.openingBalance, 0).toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography color="success.main">
                  {isRTL ? '+ الإيرادات' : '+ Income'}
                </Typography>
                <Typography color="success.main">
                  +{reportData?.totalIncome.toLocaleString() || 0} {isRTL ? 'ج.م' : 'EGP'}
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography color="error.main">
                  {isRTL ? '- المصروفات' : '- Expenses'}
                </Typography>
                <Typography color="error.main">
                  -{reportData?.totalExpenses.toLocaleString() || 0} {isRTL ? 'ج.م' : 'EGP'}
                </Typography>
              </Stack>
              <Divider />
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="h6">
                  {isRTL ? 'الرصيد الحالي' : 'Current Balance'}
                </Typography>
                <Typography variant="h6" color={reportData?.cashFlow >= 0 ? 'success.main' : 'error.main'}>
                  {accounts.reduce((sum, acc) => sum + acc.currentBalance, 0).toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                </Typography>
              </Stack>
            </Stack>
          </Paper>

          {/* Account Balances */}
          <Paper sx={{ p: 3, flex: 1 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {isRTL ? 'أرصدة الحسابات' : 'Account Balances'}
            </Typography>
            <Stack spacing={1}>
              {reportData?.accountBalances.slice(0, 5).map(({ account, balance, transactions }) => (
                <Stack key={account.id} direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="body1">
                      {isRTL ? account.nameAr : account.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {transactions} {isRTL ? 'معاملة' : 'transactions'}
                    </Typography>
                  </Box>
                  <Typography
                    variant="body1"
                    color={balance >= 0 ? 'success.main' : 'error.main'}
                    fontWeight="medium"
                  >
                    {balance.toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Paper>
        </Stack>
      </Box>

      {/* Daily Cash Flow Chart */}
      <Box>
        <Paper sx={{ p: 3, height: '400px' }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            {isRTL ? 'التدفق النقدي اليومي' : 'Daily Cash Flow'}
          </Typography>
          <Box sx={{ height: 'calc(100% - 40px)' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={reportData?.dailyTransactions.map(d => ({
                  ...d,
                  date: format(new Date(d.date), 'MMM dd'),
                  expenses: -d.expenses, // Make expenses negative for visual effect
                })) || []}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="income"
                  stackId="a"
                  fill={theme.palette.success.main}
                  name={isRTL ? 'الإيرادات' : 'Income'}
                />
                <Bar
                  dataKey="expenses"
                  stackId="a"
                  fill={theme.palette.error.main}
                  name={isRTL ? 'المصروفات' : 'Expenses'}
                />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Paper>
      </Box>
    </Box>
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl">
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Typography variant="h4" component="h1">
            {isRTL ? 'التقارير المالية' : 'Financial Reports'}
          </Typography>
          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              startIcon={<Print />}
              onClick={() => window.print()}
            >
              {isRTL ? 'طباعة' : 'Print'}
            </Button>
            <Button
              variant="contained"
              startIcon={<FileDownload />}
              onClick={() => {
                // TODO: Implement export functionality
                console.log('Export report');
              }}
            >
              {isRTL ? 'تصدير' : 'Export'}
            </Button>
          </Stack>
        </Stack>

        {/* Date Range Selector */}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>{isRTL ? 'الفترة' : 'Period'}</InputLabel>
            <Select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              label={isRTL ? 'الفترة' : 'Period'}
            >
              <MenuItem value="today">{isRTL ? 'اليوم' : 'Today'}</MenuItem>
              <MenuItem value="week">{isRTL ? 'هذا الأسبوع' : 'This Week'}</MenuItem>
              <MenuItem value="month">{isRTL ? 'هذا الشهر' : 'This Month'}</MenuItem>
              <MenuItem value="year">{isRTL ? 'هذه السنة' : 'This Year'}</MenuItem>
              <MenuItem value="custom">{isRTL ? 'مخصص' : 'Custom'}</MenuItem>
            </Select>
          </FormControl>

          {dateRange === 'custom' && (
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label={isRTL ? 'من تاريخ' : 'From Date'}
                value={startDate}
                onChange={(date) => date && setStartDate(date)}
                slotProps={{ textField: { fullWidth: true } }}
              />
              <DatePicker
                label={isRTL ? 'إلى تاريخ' : 'To Date'}
                value={endDate}
                onChange={(date) => date && setEndDate(date)}
                slotProps={{ textField: { fullWidth: true } }}
              />
            </LocalizationProvider>
          )}

          <Box sx={{ flex: 1 }} />

          <Chip
            icon={<CalendarToday />}
            label={`${format(startDate, 'MMM dd, yyyy')} - ${format(endDate, 'MMM dd, yyyy')}`}
            color="primary"
            variant="outlined"
          />
        </Stack>

        {/* Tabs */}
        <Tabs value={selectedTab} onChange={(_, value) => setSelectedTab(value)}>
          <Tab label={isRTL ? 'نظرة عامة' : 'Overview'} />
          <Tab label={isRTL ? 'التدفق النقدي' : 'Cash Flow'} />
          <Tab label={isRTL ? 'التحليل' : 'Analysis'} />
        </Tabs>
      </Box>

      {/* Tab Content */}
      <Box sx={{ mt: 3 }}>
        {selectedTab === 0 && renderOverviewTab()}
        {selectedTab === 1 && renderCashFlowTab()}
        {selectedTab === 2 && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" color="text.secondary">
              {isRTL ? 'قريباً: تحليلات متقدمة' : 'Coming Soon: Advanced Analytics'}
            </Typography>
          </Box>
        )}
      </Box>
    </Container>
  );
};

export default FinanceReportsPage;