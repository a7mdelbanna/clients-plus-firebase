import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  useTheme,
  Chip,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  ListItemAvatar,
  Avatar,
  Divider,
  IconButton,
  FormControlLabel,
  Switch,
  Menu,
  ListItemIcon,
  Autocomplete,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from '@mui/material';
import {
  Add,
  Receipt,
  TrendingUp,
  TrendingDown,
  SwapHoriz,
  Payment,
  AccountBalance,
  CreditCard,
  AccountBalanceWallet,
  LocalAtm,
  CalendarToday,
  FilterList,
  Download,
  Search,
  ArrowUpward,
  ArrowDownward,
  Edit,
  Delete,
  MoreVert,
  Print,
  Email,
  Phone,
  QrCode2,
  AttachMoney,
  Category,
  Person,
  Description,
  Schedule,
  CheckCircle,
  Cancel,
  Pending,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useAuth } from '../../contexts/AuthContext';
import { useBranch } from '../../contexts/BranchContext';
import { financeService } from '../../services/finance.service';
import { clientService } from '../../services/client.service';
import { productService } from '../../services/product.service';
import type {
  FinancialTransaction,
  TransactionType,
  PaymentMethod,
  FinancialAccount,
  TransactionCategory,
} from '../../types/finance.types';
import type { Client } from '../../services/client.service';
import type { Product } from '../../types/product.types';
import { Timestamp } from 'firebase/firestore';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
};

// Transaction categories
const expenseCategories: TransactionCategory[] = [
  { id: 'salary', name: 'Salary', nameAr: 'مرتبات', icon: '💰', color: '#FF6B6B' },
  { id: 'rent', name: 'Rent', nameAr: 'إيجار', icon: '🏠', color: '#4ECDC4' },
  { id: 'utilities', name: 'Utilities', nameAr: 'مرافق', icon: '💡', color: '#45B7D1' },
  { id: 'supplies', name: 'Supplies', nameAr: 'مستلزمات', icon: '📦', color: '#F7DC6F' },
  { id: 'marketing', name: 'Marketing', nameAr: 'تسويق', icon: '📢', color: '#BB8FCE' },
  { id: 'maintenance', name: 'Maintenance', nameAr: 'صيانة', icon: '🔧', color: '#85C1E2' },
  { id: 'other', name: 'Other', nameAr: 'أخرى', icon: '📌', color: '#AAB7B8' },
];

const incomeCategories: TransactionCategory[] = [
  { id: 'service', name: 'Service', nameAr: 'خدمة', icon: '✂️', color: '#27AE60' },
  { id: 'product', name: 'Product Sale', nameAr: 'بيع منتج', icon: '🛍️', color: '#E74C3C' },
  { id: 'appointment', name: 'Appointment', nameAr: 'موعد', icon: '📅', color: '#3498DB' },
  { id: 'package', name: 'Package', nameAr: 'باقة', icon: '🎁', color: '#9B59B6' },
  { id: 'membership', name: 'Membership', nameAr: 'عضوية', icon: '💳', color: '#F39C12' },
  { id: 'other', name: 'Other', nameAr: 'أخرى', icon: '💵', color: '#95A5A6' },
];

const FinanceTransactionsPage: React.FC = () => {
  const theme = useTheme();
  const { currentUser } = useAuth();
  const { currentBranch } = useBranch();
  const isRTL = theme.direction === 'rtl';

  // State
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<FinancialTransaction | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<FinancialTransaction | null>(null);

  // Filters
  const [filters, setFilters] = useState({
    dateRange: { start: new Date(new Date().setDate(1)), end: new Date() },
    type: 'all' as 'all' | TransactionType,
    accountId: '',
    categoryId: '',
    search: '',
    status: 'all' as 'all' | 'completed' | 'pending' | 'cancelled',
  });

  // Form state
  const [formData, setFormData] = useState({
    type: 'income' as TransactionType,
    amount: 0,
    accountId: '',
    categoryId: '',
    referenceType: '',
    referenceId: '',
    clientId: '',
    description: '',
    descriptionAr: '',
    date: new Date(),
    paymentMethod: 'cash' as PaymentMethod,
    digitalWalletFee: 0,
    attachments: [] as string[],
    tags: [] as string[],
    isRecurring: false,
    recurringInterval: 'monthly' as 'daily' | 'weekly' | 'monthly' | 'yearly',
    recurringEndDate: null as Date | null,
  });

  // Load data
  useEffect(() => {
    if (currentUser?.companyId) {
      loadData();
    }
  }, [currentUser?.companyId, currentBranch?.id, filters]);

  const loadData = async () => {
    if (!currentUser?.companyId) return;

    try {
      setLoading(true);

      // Load accounts
      const accountsData = await financeService.getAccounts(
        currentUser.companyId,
        { branchId: currentBranch?.id }
      );
      setAccounts(accountsData);

      // Load transactions
      const { transactions: transactionsData } = await financeService.getTransactions(
        currentUser.companyId,
        {
          branchId: currentBranch?.id,
          startDate: filters.dateRange.start,
          endDate: filters.dateRange.end,
          type: filters.type === 'all' ? undefined : filters.type,
          accountId: filters.accountId || undefined,
          categoryId: filters.categoryId || undefined,
        }
      );
      setTransactions(transactionsData);

      // Load clients and products for autocomplete
      const { clients: clientsData } = await clientService.getClients(currentUser.companyId);
      setClients(clientsData);

      const { products: productsData } = await productService.getProducts(currentUser.companyId);
      setProducts(productsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handlers
  const handleOpenDialog = (transaction?: FinancialTransaction) => {
    if (transaction) {
      setEditingTransaction(transaction);
      setFormData({
        type: transaction.type,
        amount: transaction.amount,
        accountId: transaction.accountId,
        categoryId: transaction.categoryId || '',
        referenceType: transaction.referenceType || '',
        referenceId: transaction.referenceId || '',
        clientId: transaction.clientId || '',
        description: transaction.description || '',
        descriptionAr: transaction.descriptionAr || '',
        date: transaction.date.toDate(),
        paymentMethod: transaction.paymentMethod,
        digitalWalletFee: transaction.digitalWalletFee || 0,
        attachments: transaction.attachments || [],
        tags: transaction.tags || [],
        isRecurring: transaction.isRecurring || false,
        recurringInterval: transaction.recurringInterval || 'monthly',
        recurringEndDate: transaction.recurringEndDate?.toDate() || null,
      });
    } else {
      setEditingTransaction(null);
      setFormData({
        type: 'income',
        amount: 0,
        accountId: accounts.find(a => a.isDefault)?.id || '',
        categoryId: '',
        referenceType: '',
        referenceId: '',
        clientId: '',
        description: '',
        descriptionAr: '',
        date: new Date(),
        paymentMethod: 'cash',
        digitalWalletFee: 0,
        attachments: [],
        tags: [],
        isRecurring: false,
        recurringInterval: 'monthly',
        recurringEndDate: null,
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingTransaction(null);
  };

  const handleSaveTransaction = async () => {
    if (!currentUser?.companyId || !currentBranch?.id) return;

    try {
      const transactionData: Omit<FinancialTransaction, 'id' | 'createdAt' | 'updatedAt'> = {
        companyId: currentUser.companyId,
        branchId: currentBranch.id,
        type: formData.type,
        amount: formData.amount,
        accountId: formData.accountId,
        categoryId: formData.categoryId || undefined,
        date: Timestamp.fromDate(formData.date),
        paymentMethod: formData.paymentMethod,
        status: 'completed',
        createdBy: currentUser.uid,
      };

      // Add optional fields
      if (formData.referenceType && formData.referenceId) {
        transactionData.referenceType = formData.referenceType;
        transactionData.referenceId = formData.referenceId;
      }
      if (formData.clientId) {
        transactionData.clientId = formData.clientId;
      }
      if (formData.description) {
        transactionData.description = formData.description;
      }
      if (formData.descriptionAr) {
        transactionData.descriptionAr = formData.descriptionAr;
      }
      if (formData.digitalWalletFee > 0) {
        transactionData.digitalWalletFee = formData.digitalWalletFee;
      }
      if (formData.attachments.length > 0) {
        transactionData.attachments = formData.attachments;
      }
      if (formData.tags.length > 0) {
        transactionData.tags = formData.tags;
      }
      if (formData.isRecurring) {
        transactionData.isRecurring = true;
        transactionData.recurringInterval = formData.recurringInterval;
        if (formData.recurringEndDate) {
          transactionData.recurringEndDate = Timestamp.fromDate(formData.recurringEndDate);
        }
      }

      if (editingTransaction?.id) {
        await financeService.updateTransaction(
          currentUser.companyId,
          editingTransaction.id,
          transactionData
        );
      } else {
        await financeService.createTransaction(transactionData);
      }

      handleCloseDialog();
      loadData();
    } catch (error) {
      console.error('Error saving transaction:', error);
    }
  };

  // Get filtered transactions
  const getFilteredTransactions = () => {
    return transactions.filter(transaction => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const client = clients.find(c => c.id === transaction.clientId);
        const matchesSearch = 
          transaction.description?.toLowerCase().includes(searchLower) ||
          transaction.descriptionAr?.toLowerCase().includes(searchLower) ||
          client?.name.toLowerCase().includes(searchLower) ||
          transaction.tags?.some(tag => tag.toLowerCase().includes(searchLower));
        if (!matchesSearch) return false;
      }

      // Status filter
      if (filters.status !== 'all' && transaction.status !== filters.status) {
        return false;
      }

      return true;
    });
  };

  // Get transaction icon
  const getTransactionIcon = (transaction: FinancialTransaction) => {
    const account = accounts.find(a => a.id === transaction.accountId);
    if (account?.type === 'cash' || account?.type === 'petty_cash') return <LocalAtm />;
    if (account?.type === 'bank') return <AccountBalance />;
    if (account?.type === 'credit_card') return <CreditCard />;
    if (account?.type === 'digital_wallet') return <AccountBalanceWallet />;
    return <Payment />;
  };

  // Get category
  const getCategory = (categoryId: string, type: TransactionType) => {
    const categories = type === 'expense' ? expenseCategories : incomeCategories;
    return categories.find(c => c.id === categoryId);
  };

  // Calculate totals
  const calculateTotals = () => {
    const filtered = getFilteredTransactions();
    const income = filtered
      .filter(t => t.type === 'income' && t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0);
    const expenses = filtered
      .filter(t => t.type === 'expense' && t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0);
    const transfers = filtered
      .filter(t => t.type === 'transfer' && t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0);

    return { income, expenses, transfers, net: income - expenses };
  };

  const totals = calculateTotals();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Container maxWidth="xl" sx={{ mt: 3 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h4" component="h1">
              {isRTL ? 'المعاملات المالية' : 'Financial Transactions'}
            </Typography>
            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                startIcon={<Download />}
                onClick={() => {
                  // TODO: Export transactions
                }}
              >
                {isRTL ? 'تصدير' : 'Export'}
              </Button>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => handleOpenDialog()}
              >
                {isRTL ? 'معاملة جديدة' : 'New Transaction'}
              </Button>
            </Stack>
          </Stack>

          {/* Stats Cards */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 3, mb: 3 }}>
            <Box>
              <Card>
                <CardContent>
                  <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <TrendingUp color="success" />
                      <Typography variant="h5" color="success.main">
                        +{totals.income.toLocaleString()}
                      </Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {isRTL ? 'الإيرادات' : 'Income'}
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Box>

            <Box>
              <Card>
                <CardContent>
                  <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <TrendingDown color="error" />
                      <Typography variant="h5" color="error.main">
                        -{totals.expenses.toLocaleString()}
                      </Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {isRTL ? 'المصروفات' : 'Expenses'}
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Box>

            <Box>
              <Card>
                <CardContent>
                  <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <SwapHoriz color="primary" />
                      <Typography variant="h5" color="primary.main">
                        {totals.transfers.toLocaleString()}
                      </Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {isRTL ? 'التحويلات' : 'Transfers'}
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Box>

            <Box>
              <Card sx={{ bgcolor: totals.net >= 0 ? 'success.main' : 'error.main', color: 'white' }}>
                <CardContent>
                  <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <AttachMoney sx={{ color: 'white' }} />
                      <Typography variant="h5" sx={{ color: 'white' }}>
                        {totals.net >= 0 ? '+' : ''}{totals.net.toLocaleString()}
                      </Typography>
                    </Stack>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                      {isRTL ? 'صافي الربح' : 'Net Profit'}
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Box>
          </Box>

          {/* Filters */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1.5fr 1fr 1fr 2fr' }, gap: 2, alignItems: 'center' }}>
              <Box>
                <Stack direction="row" spacing={1}>
                  <DatePicker
                    label={isRTL ? 'من' : 'From'}
                    value={filters.dateRange.start}
                    onChange={(newValue) => setFilters({
                      ...filters,
                      dateRange: { ...filters.dateRange, start: newValue || new Date() }
                    })}
                    slotProps={{ textField: { size: 'small', fullWidth: true } }}
                  />
                  <DatePicker
                    label={isRTL ? 'إلى' : 'To'}
                    value={filters.dateRange.end}
                    onChange={(newValue) => setFilters({
                      ...filters,
                      dateRange: { ...filters.dateRange, end: newValue || new Date() }
                    })}
                    slotProps={{ textField: { size: 'small', fullWidth: true } }}
                  />
                </Stack>
              </Box>

              <Box>
                <ToggleButtonGroup
                  value={filters.type}
                  exclusive
                  onChange={(_, newType) => setFilters({ ...filters, type: newType || 'all' })}
                  size="small"
                  fullWidth
                >
                  <ToggleButton value="all">{isRTL ? 'الكل' : 'All'}</ToggleButton>
                  <ToggleButton value="income" color="success">
                    <TrendingUp fontSize="small" sx={{ mr: 0.5 }} />
                    {isRTL ? 'إيرادات' : 'Income'}
                  </ToggleButton>
                  <ToggleButton value="expense" color="error">
                    <TrendingDown fontSize="small" sx={{ mr: 0.5 }} />
                    {isRTL ? 'مصروفات' : 'Expenses'}
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>

              <Box>
                <FormControl fullWidth size="small">
                  <InputLabel>{isRTL ? 'الحساب' : 'Account'}</InputLabel>
                  <Select
                    value={filters.accountId}
                    onChange={(e) => setFilters({ ...filters, accountId: e.target.value })}
                    label={isRTL ? 'الحساب' : 'Account'}
                  >
                    <MenuItem value="">{isRTL ? 'جميع الحسابات' : 'All Accounts'}</MenuItem>
                    {accounts.map((account) => (
                      <MenuItem key={account.id} value={account.id}>
                        {isRTL ? account.nameAr : account.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <Box>
                <FormControl fullWidth size="small">
                  <InputLabel>{isRTL ? 'الحالة' : 'Status'}</InputLabel>
                  <Select
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value as any })}
                    label={isRTL ? 'الحالة' : 'Status'}
                  >
                    <MenuItem value="all">{isRTL ? 'جميع الحالات' : 'All Status'}</MenuItem>
                    <MenuItem value="completed">{isRTL ? 'مكتملة' : 'Completed'}</MenuItem>
                    <MenuItem value="pending">{isRTL ? 'معلقة' : 'Pending'}</MenuItem>
                    <MenuItem value="cancelled">{isRTL ? 'ملغية' : 'Cancelled'}</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              <Box>
                <TextField
                  fullWidth
                  size="small"
                  placeholder={isRTL ? 'بحث...' : 'Search...'}
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search />
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
            </Box>
          </Paper>
        </Box>

        {/* Transactions List */}
        <List>
          {getFilteredTransactions().map((transaction) => {
            const account = accounts.find(a => a.id === transaction.accountId);
            const client = clients.find(c => c.id === transaction.clientId);
            const category = transaction.categoryId ? getCategory(transaction.categoryId, transaction.type) : null;

            return (
              <React.Fragment key={transaction.id}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <ListItem
                    sx={{
                      bgcolor: 'background.paper',
                      mb: 1,
                      borderRadius: 1,
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar
                        sx={{
                          bgcolor: transaction.type === 'income' ? 'success.light' :
                                  transaction.type === 'expense' ? 'error.light' : 'primary.light',
                        }}
                      >
                        {category ? (
                          <span style={{ fontSize: 24 }}>{category.icon}</span>
                        ) : (
                          getTransactionIcon(transaction)
                        )}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={2} alignItems="center">
                          <Typography variant="body1">
                            {transaction.description || (category ? (isRTL ? category.nameAr : category.name) : transaction.type)}
                          </Typography>
                          {client && (
                            <Chip
                              icon={<Person />}
                              label={client.name}
                              size="small"
                              variant="outlined"
                            />
                          )}
                          {transaction.status !== 'completed' && (
                            <Chip
                              label={transaction.status}
                              size="small"
                              color={transaction.status === 'pending' ? 'warning' : 'error'}
                              icon={transaction.status === 'pending' ? <Pending /> : <Cancel />}
                            />
                          )}
                          {transaction.isRecurring && (
                            <Chip
                              label={isRTL ? 'متكرر' : 'Recurring'}
                              size="small"
                              color="primary"
                              variant="outlined"
                              icon={<Schedule />}
                            />
                          )}
                        </Stack>
                      }
                      secondary={
                        <Box component="div">
                          <Stack spacing={0.5}>
                            <Stack direction="row" spacing={2} alignItems="center">
                              <Typography component="span" variant="body2" color="text.secondary">
                                {account && (isRTL ? account.nameAr : account.name)}
                              </Typography>
                              <Typography component="span" variant="caption" color="text.secondary">
                                {transaction.date.toDate().toLocaleDateString()}
                              </Typography>
                            </Stack>
                            {transaction.tags && transaction.tags.length > 0 && (
                              <Stack direction="row" spacing={0.5}>
                                {transaction.tags.map((tag, index) => (
                                  <Chip key={index} label={tag} size="small" variant="outlined" />
                                ))}
                              </Stack>
                            )}
                          </Stack>
                        </Box>
                      }
                      primaryTypographyProps={{ component: 'div' }}
                      secondaryTypographyProps={{ component: 'div' }}
                    />
                    <ListItemSecondaryAction>
                      <Stack alignItems="flex-end" spacing={1}>
                        <Typography
                          variant="h6"
                          color={transaction.type === 'income' ? 'success.main' : transaction.type === 'expense' ? 'error.main' : 'primary.main'}
                        >
                          {transaction.type === 'income' ? '+' : transaction.type === 'expense' ? '-' : ''}
                          {transaction.amount.toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            setAnchorEl(e.currentTarget);
                            setSelectedTransaction(transaction);
                          }}
                        >
                          <MoreVert />
                        </IconButton>
                      </Stack>
                    </ListItemSecondaryAction>
                  </ListItem>
                </motion.div>
              </React.Fragment>
            );
          })}
        </List>

        {getFilteredTransactions().length === 0 && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Receipt sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              {isRTL ? 'لا توجد معاملات' : 'No transactions found'}
            </Typography>
          </Box>
        )}

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
          <DialogTitle>
            {editingTransaction
              ? (isRTL ? 'تعديل المعاملة' : 'Edit Transaction')
              : (isRTL ? 'معاملة جديدة' : 'New Transaction')}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={3} sx={{ mt: 1 }}>
              {/* Transaction Type */}
              <ToggleButtonGroup
                value={formData.type}
                exclusive
                onChange={(_, newType) => setFormData({ ...formData, type: newType || 'income' })}
                fullWidth
              >
                <ToggleButton value="income" color="success">
                  <TrendingUp sx={{ mr: 1 }} />
                  {isRTL ? 'إيرادات' : 'Income'}
                </ToggleButton>
                <ToggleButton value="expense" color="error">
                  <TrendingDown sx={{ mr: 1 }} />
                  {isRTL ? 'مصروفات' : 'Expense'}
                </ToggleButton>
                <ToggleButton value="transfer" color="primary">
                  <SwapHoriz sx={{ mr: 1 }} />
                  {isRTL ? 'تحويل' : 'Transfer'}
                </ToggleButton>
              </ToggleButtonGroup>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
                {/* Amount */}
                <Box>
                  <TextField
                    fullWidth
                    required
                    type="number"
                    label={isRTL ? 'المبلغ' : 'Amount'}
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">{isRTL ? 'ج.م' : 'EGP'}</InputAdornment>,
                    }}
                  />
                </Box>

                {/* Date */}
                <Box>
                  <DatePicker
                    label={isRTL ? 'التاريخ' : 'Date'}
                    value={formData.date}
                    onChange={(newValue) => setFormData({ ...formData, date: newValue || new Date() })}
                    slotProps={{ textField: { fullWidth: true, required: true } }}
                  />
                </Box>

                {/* Account */}
                <Box>
                  <FormControl fullWidth required>
                    <InputLabel>{isRTL ? 'الحساب' : 'Account'}</InputLabel>
                    <Select
                      value={formData.accountId}
                      onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                      label={isRTL ? 'الحساب' : 'Account'}
                    >
                      {accounts.map((account) => (
                        <MenuItem key={account.id} value={account.id}>
                          {isRTL ? account.nameAr : account.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>

                {/* Category */}
                <Box>
                  <FormControl fullWidth>
                    <InputLabel>{isRTL ? 'الفئة' : 'Category'}</InputLabel>
                    <Select
                      value={formData.categoryId}
                      onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                      label={isRTL ? 'الفئة' : 'Category'}
                    >
                      <MenuItem value="">
                        <em>{isRTL ? 'بدون فئة' : 'No Category'}</em>
                      </MenuItem>
                      {(formData.type === 'expense' ? expenseCategories : incomeCategories).map((category) => (
                        <MenuItem key={category.id} value={category.id}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <span>{category.icon}</span>
                            <span>{isRTL ? category.nameAr : category.name}</span>
                          </Stack>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>

                {/* Client */}
                <Box sx={{ gridColumn: '1 / -1' }}>
                  <Autocomplete
                    options={clients}
                    getOptionLabel={(option) => option.name}
                    value={clients.find(c => c.id === formData.clientId) || null}
                    onChange={(_, newValue) => setFormData({ ...formData, clientId: newValue?.id || '' })}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label={isRTL ? 'العميل' : 'Client'}
                        placeholder={isRTL ? 'اختر عميل...' : 'Select client...'}
                      />
                    )}
                  />
                </Box>

                {/* Description */}
                <Box>
                  <TextField
                    fullWidth
                    label={isRTL ? 'الوصف' : 'Description'}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    multiline
                    rows={2}
                  />
                </Box>
                <Box>
                  <TextField
                    fullWidth
                    label={isRTL ? 'الوصف (عربي)' : 'Description (Arabic)'}
                    value={formData.descriptionAr}
                    onChange={(e) => setFormData({ ...formData, descriptionAr: e.target.value })}
                    multiline
                    rows={2}
                  />
                </Box>

                {/* Payment Method */}
                <Box>
                  <FormControl fullWidth>
                    <InputLabel>{isRTL ? 'طريقة الدفع' : 'Payment Method'}</InputLabel>
                    <Select
                      value={formData.paymentMethod}
                      onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value as PaymentMethod })}
                      label={isRTL ? 'طريقة الدفع' : 'Payment Method'}
                    >
                      <MenuItem value="cash">{isRTL ? 'نقدي' : 'Cash'}</MenuItem>
                      <MenuItem value="card">{isRTL ? 'بطاقة' : 'Card'}</MenuItem>
                      <MenuItem value="bank_transfer">{isRTL ? 'تحويل بنكي' : 'Bank Transfer'}</MenuItem>
                      <MenuItem value="digital_wallet">{isRTL ? 'محفظة رقمية' : 'Digital Wallet'}</MenuItem>
                      <MenuItem value="check">{isRTL ? 'شيك' : 'Check'}</MenuItem>
                    </Select>
                  </FormControl>
                </Box>

                {/* Digital Wallet Fee */}
                {formData.paymentMethod === 'digital_wallet' && (
                  <Box>
                    <TextField
                      fullWidth
                      type="number"
                      label={isRTL ? 'رسوم المحفظة' : 'Wallet Fee'}
                      value={formData.digitalWalletFee}
                      onChange={(e) => setFormData({ ...formData, digitalWalletFee: parseFloat(e.target.value) || 0 })}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">{isRTL ? 'ج.م' : 'EGP'}</InputAdornment>,
                      }}
                      helperText={isRTL ? 'رسوم المعاملة للمحفظة الرقمية' : 'Transaction fee for digital wallet'}
                    />
                  </Box>
                )}

                {/* Recurring */}
                <Box sx={{ gridColumn: '1 / -1' }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.isRecurring}
                        onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                      />
                    }
                    label={isRTL ? 'معاملة متكررة' : 'Recurring Transaction'}
                  />
                </Box>

                {formData.isRecurring && (
                  <>
                    <Box>
                      <FormControl fullWidth>
                        <InputLabel>{isRTL ? 'التكرار' : 'Interval'}</InputLabel>
                        <Select
                          value={formData.recurringInterval}
                          onChange={(e) => setFormData({ ...formData, recurringInterval: e.target.value as any })}
                          label={isRTL ? 'التكرار' : 'Interval'}
                        >
                          <MenuItem value="daily">{isRTL ? 'يومي' : 'Daily'}</MenuItem>
                          <MenuItem value="weekly">{isRTL ? 'أسبوعي' : 'Weekly'}</MenuItem>
                          <MenuItem value="monthly">{isRTL ? 'شهري' : 'Monthly'}</MenuItem>
                          <MenuItem value="yearly">{isRTL ? 'سنوي' : 'Yearly'}</MenuItem>
                        </Select>
                      </FormControl>
                    </Box>
                    <Box>
                      <DatePicker
                        label={isRTL ? 'تاريخ الانتهاء' : 'End Date'}
                        value={formData.recurringEndDate}
                        onChange={(newValue) => setFormData({ ...formData, recurringEndDate: newValue })}
                        slotProps={{ textField: { fullWidth: true } }}
                      />
                    </Box>
                  </>
                )}
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button
              onClick={handleSaveTransaction}
              variant="contained"
              disabled={!formData.amount || !formData.accountId}
            >
              {editingTransaction ? (isRTL ? 'حفظ' : 'Save') : (isRTL ? 'إضافة' : 'Add')}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Context Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => {
            setAnchorEl(null);
            setSelectedTransaction(null);
          }}
        >
          <MenuItem
            onClick={() => {
              if (selectedTransaction) {
                handleOpenDialog(selectedTransaction);
              }
              setAnchorEl(null);
            }}
          >
            <ListItemIcon>
              <Edit fontSize="small" />
            </ListItemIcon>
            <ListItemText>{isRTL ? 'تعديل' : 'Edit'}</ListItemText>
          </MenuItem>
          <MenuItem
            onClick={() => {
              // TODO: Print receipt
              setAnchorEl(null);
            }}
          >
            <ListItemIcon>
              <Print fontSize="small" />
            </ListItemIcon>
            <ListItemText>{isRTL ? 'طباعة' : 'Print'}</ListItemText>
          </MenuItem>
          <Divider />
          <MenuItem
            onClick={() => {
              // TODO: Delete transaction
              setAnchorEl(null);
            }}
            disabled
          >
            <ListItemIcon>
              <Delete fontSize="small" />
            </ListItemIcon>
            <ListItemText>{isRTL ? 'حذف' : 'Delete'}</ListItemText>
          </MenuItem>
        </Menu>
      </Container>
    </LocalizationProvider>
  );
};

export default FinanceTransactionsPage;