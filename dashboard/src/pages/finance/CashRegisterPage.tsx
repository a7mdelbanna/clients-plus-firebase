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
  ListItemIcon,
  Divider,
  IconButton,
  FormControlLabel,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stepper,
  Step,
  StepLabel,
  Avatar,
  Badge,
  Grid,
  AlertTitle,
} from '@mui/material';
import {
  PointOfSale,
  AttachMoney,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  Cancel,
  Warning,
  Print,
  Download,
  LockOpen,
  Lock,
  History,
  Receipt,
  LocalAtm,
  CreditCard,
  AccountBalanceWallet,
  Add,
  Remove,
  Edit,
  CalendarToday,
  AccessTime,
  Person,
  Notes,
  Calculate,
  Inventory,
  Payment,
  AccountBalance,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useAuth } from '../../contexts/AuthContext';
import { useBranch } from '../../contexts/BranchContext';
import { financeService } from '../../services/finance.service';
import type {
  CashRegisterSession,
  CashRegisterAccountMappings,
  CashRegisterClosingSummary,
  FinancialAccount,
  TransactionSummary,
  PaymentMethodAmounts,
} from '../../types/finance.types';
import { Timestamp } from 'firebase/firestore';

interface SessionFilters {
  dateRange: { start: Date; end: Date };
  staffId: string;
  status: 'all' | 'open' | 'closed';
}

const CashRegisterPage: React.FC = () => {
  const theme = useTheme();
  const { currentUser } = useAuth();
  const { currentBranch } = useBranch();
  const isRTL = theme.direction === 'rtl';

  // State
  const [loading, setLoading] = useState(true);
  const [currentSession, setCurrentSession] = useState<CashRegisterSession | null>(null);
  const [sessions, setSessions] = useState<CashRegisterSession[]>([]);
  const [availableAccounts, setAvailableAccounts] = useState<FinancialAccount[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [closeDialog, setCloseDialog] = useState(false);
  const [closingSummary, setClosingSummary] = useState<CashRegisterClosingSummary | null>(null);
  const [countDialog, setCountDialog] = useState(false);
  const [adjustmentDialog, setAdjustmentDialog] = useState(false);
  const [historyDialog, setHistoryDialog] = useState(false);

  // Enhanced form states
  const [openingForm, setOpeningForm] = useState({
    accountMappings: {
      cashAccountId: '',
      cardAccountId: '',
      bankAccountId: '',
      digitalWalletAccountId: '',
      pettyAccountId: '',
    } as CashRegisterAccountMappings,
    openingAmounts: {
      cash: 0,
      card: 0,
      bankTransfer: 0,
      digitalWallet: 0,
      check: 0,
      total: 0,
    } as PaymentMethodAmounts,
    notes: '',
  });

  const [closingForm, setClosingForm] = useState({
    actualAccountBalances: {} as { [accountId: string]: number },
    notes: '',
    denominations: {
      200: 0,
      100: 0,
      50: 0,
      20: 0,
      10: 0,
      5: 0,
      1: 0,
      0.5: 0,
      0.25: 0,
    },
  });

  const [adjustmentForm, setAdjustmentForm] = useState({
    amount: 0,
    reason: '',
    type: 'add' as 'add' | 'remove',
  });

  const [filters, setFilters] = useState<SessionFilters>({
    dateRange: { start: new Date(new Date().setDate(1)), end: new Date() },
    staffId: '',
    status: 'all',
  });

  // Load data
  useEffect(() => {
    if (currentUser?.companyId && currentBranch?.id) {
      loadData();
    }
  }, [currentUser?.companyId, currentBranch?.id]);

  const loadData = async () => {
    if (!currentUser?.companyId || !currentBranch?.id) return;

    try {
      setLoading(true);

      // Get all available accounts for this branch
      const allAccounts = await financeService.getAccounts(
        currentUser.companyId,
        { branchId: currentBranch.id, status: 'active' }
      );
      setAvailableAccounts(allAccounts);

      // Set default cash account in opening form
      const cashAccount = allAccounts.find(a => a.type === 'cash');
      if (cashAccount?.id && !openingForm.accountMappings.cashAccountId) {
        setOpeningForm(prev => ({
          ...prev,
          accountMappings: {
            ...prev.accountMappings,
            cashAccountId: cashAccount.id!,
          },
        }));
      }

      // Get current session (use first cash account as register ID for backward compatibility)
      if (cashAccount?.id) {
        const session = await financeService.getCurrentCashRegisterSession(
          currentUser.companyId,
          currentBranch.id,
          cashAccount.id
        );
        setCurrentSession(session);

        // Initialize closing form with current session's accounts
        if (session?.accountMovements) {
          const actualBalances: { [accountId: string]: number } = {};
          Object.keys(session.accountMovements).forEach(accountId => {
            actualBalances[accountId] = session.accountMovements[accountId].expectedBalance;
          });
          
          setClosingForm(prev => ({
            ...prev,
            actualAccountBalances: actualBalances,
          }));
        }

        // Get recent sessions
        const recentSessions = await financeService.getCashRegisterSessions(
          currentUser.companyId,
          {
            branchId: currentBranch.id,
            accountId: cashAccount.id,
            startDate: filters.dateRange.start,
            endDate: filters.dateRange.end,
          }
        );
        setSessions(recentSessions);
      }
    } catch (error) {
      console.error('Error loading cash register data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handlers
  const handleOpenRegister = async () => {
    if (!currentUser?.companyId || !currentBranch?.id) return;

    // Validate required cash account
    if (!openingForm.accountMappings.cashAccountId) {
      alert(isRTL ? 'يرجى اختيار حساب نقدي' : 'Please select a cash account');
      return;
    }

    try {
      // Calculate total opening amount
      const updatedOpeningAmounts = {
        ...openingForm.openingAmounts,
        total: openingForm.openingAmounts.cash + 
               openingForm.openingAmounts.card + 
               openingForm.openingAmounts.bankTransfer + 
               openingForm.openingAmounts.digitalWallet + 
               openingForm.openingAmounts.check,
      };

      await financeService.openCashRegisterWithAccounts(
        currentUser.companyId,
        currentBranch.id,
        openingForm.accountMappings.cashAccountId, // Use cash account as register ID
        openingForm.accountMappings,
        updatedOpeningAmounts,
        currentUser.uid,
        openingForm.notes
      );

      setOpenDialog(false);
      // Reset form
      setOpeningForm({
        accountMappings: openingForm.accountMappings, // Keep account mappings
        openingAmounts: {
          cash: 0,
          card: 0,
          bankTransfer: 0,
          digitalWallet: 0,
          check: 0,
          total: 0,
        },
        notes: '',
      });
      loadData();
    } catch (error) {
      console.error('Error opening cash register:', error);
      alert(isRTL ? 'خطأ في فتح الصندوق' : 'Error opening cash register');
    }
  };

  const handleCloseRegister = async () => {
    if (!currentUser?.companyId || !currentSession?.id) return;

    try {
      // Calculate actual cash count from denominations
      const actualCashCount = Object.entries(closingForm.denominations).reduce(
        (total, [denomination, count]) => total + (parseFloat(denomination) * count),
        0
      );

      // Update cash account balance in the form
      const updatedActualBalances = {
        ...closingForm.actualAccountBalances,
      };

      // Set the cash account balance from denomination count
      if (currentSession.accountMappings?.cashAccountId) {
        updatedActualBalances[currentSession.accountMappings.cashAccountId] = actualCashCount;
      }

      // Use enhanced closing method
      const summary = await financeService.closeCashRegisterWithAccountUpdates(
        currentUser.companyId,
        currentSession.id,
        updatedActualBalances,
        closingForm.notes,
        currentUser.uid
      );

      setClosingSummary(summary);
      setCloseDialog(false);
      
      // Reset form
      setClosingForm({
        actualAccountBalances: {},
        notes: '',
        denominations: {
          200: 0,
          100: 0,
          50: 0,
          20: 0,
          10: 0,
          5: 0,
          1: 0,
          0.5: 0,
          0.25: 0,
        },
      });
      
      loadData();

      // Show success message with summary
      if (summary.hasDiscrepancies) {
        alert(
          isRTL 
            ? `تم إغلاق الصندوق مع فروقات. إجمالي الفرق: ${summary.totalDiscrepancy.toLocaleString()} ج.م`
            : `Register closed with discrepancies. Total difference: ${summary.totalDiscrepancy.toLocaleString()} EGP`
        );
      } else {
        alert(isRTL ? 'تم إغلاق الصندوق بنجاح بدون فروقات' : 'Register closed successfully with no discrepancies');
      }
    } catch (error) {
      console.error('Error closing cash register:', error);
      alert(isRTL ? 'خطأ في إغلاق الصندوق' : 'Error closing cash register');
    }
  };

  const handleAdjustment = async () => {
    if (!currentUser?.companyId || !currentBranch?.id || !cashAccount?.id) return;

    try {
      await financeService.createTransaction({
        companyId: currentUser.companyId,
        branchId: currentBranch.id,
        type: adjustmentForm.type === 'add' ? 'income' : 'expense',
        amount: Math.abs(adjustmentForm.amount),
        accountId: cashAccount.id,
        categoryId: 'cash_adjustment',
        date: Timestamp.now(),
        paymentMethod: 'cash',
        status: 'completed',
        description: adjustmentForm.reason,
        createdBy: currentUser.uid,
      });

      setAdjustmentDialog(false);
      setAdjustmentForm({ amount: 0, reason: '', type: 'add' });
      loadData();
    } catch (error) {
      console.error('Error creating adjustment:', error);
    }
  };

  // Calculate denominations total
  const calculateDenominationsTotal = () => {
    return Object.entries(closingForm.denominations).reduce(
      (total, [denomination, count]) => total + (parseFloat(denomination) * count),
      0
    );
  };


  // Get session status color
  const getSessionStatusColor = (status: CashRegisterSession['status']) => {
    switch (status) {
      case 'open': return 'success';
      case 'closed': return 'default';
      case 'reconciled': return 'primary';
      default: return 'default';
    }
  };

  // Get payment method icon
  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'cash': return <LocalAtm />;
      case 'card': return <CreditCard />;
      case 'digital_wallet': return <AccountBalanceWallet />;
      default: return <Payment />;
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Check if we have at least one cash account
  const hasCashAccount = availableAccounts.some(account => account.type === 'cash');
  
  if (!loading && !hasCashAccount) {
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Alert severity="warning">
          <Typography variant="h6" gutterBottom>
            {isRTL ? 'لا يوجد حساب نقدي' : 'No Cash Account Found'}
          </Typography>
          <Typography>
            {isRTL
              ? 'يرجى إنشاء حساب نقدي من صفحة الحسابات المالية أولاً'
              : 'Please create a cash account from the Financial Accounts page first'}
          </Typography>
          <Button
            variant="contained"
            sx={{ mt: 2 }}
            onClick={() => window.location.href = '/finance/accounts'}
          >
            {isRTL ? 'إدارة الحسابات' : 'Manage Accounts'}
          </Button>
        </Alert>
      </Container>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Container maxWidth="xl">
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h4" component="h1">
              {isRTL ? 'الورديه' : 'Cash Register'}
            </Typography>
            <Stack direction="row" spacing={2}>
              {currentSession?.status === 'open' ? (
                <>
                  <Button
                    variant="outlined"
                    startIcon={<Calculate />}
                    onClick={() => setCountDialog(true)}
                  >
                    {isRTL ? 'عد النقدية' : 'Count Cash'}
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<Edit />}
                    onClick={() => setAdjustmentDialog(true)}
                  >
                    {isRTL ? 'تعديل' : 'Adjustment'}
                  </Button>
                  <Button
                    variant="contained"
                    color="error"
                    startIcon={<Lock />}
                    onClick={() => setCloseDialog(true)}
                  >
                    {isRTL ? 'إغلاق الصندوق' : 'Close Register'}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outlined"
                    startIcon={<History />}
                    onClick={() => setHistoryDialog(true)}
                  >
                    {isRTL ? 'السجل' : 'History'}
                  </Button>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<LockOpen />}
                    onClick={() => setOpenDialog(true)}
                  >
                    {isRTL ? 'فتح الصندوق' : 'Open Register'}
                  </Button>
                </>
              )}
            </Stack>
          </Stack>

          {/* Current Session Status */}
          {currentSession ? (
            <Paper sx={{ p: 3, mb: 3 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, gap: 3 }}>
                <Box>
                  <Stack spacing={1}>
                    <Typography variant="body2" color="text.secondary">
                      {isRTL ? 'الحالة' : 'Status'}
                    </Typography>
                    <Chip
                      label={
                        currentSession.status === 'open' ? (isRTL ? 'مفتوح' : 'Open') :
                        currentSession.status === 'closed' ? (isRTL ? 'مغلق' : 'Closed') :
                        (isRTL ? 'مطابق' : 'Reconciled')
                      }
                      color={getSessionStatusColor(currentSession.status)}
                      icon={currentSession.status === 'open' ? <LockOpen /> : <Lock />}
                    />
                  </Stack>
                </Box>

                <Box>
                  <Stack spacing={1}>
                    <Typography variant="body2" color="text.secondary">
                      {isRTL ? 'وقت الفتح' : 'Opening Time'}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <AccessTime fontSize="small" color="action" />
                      <Typography variant="body1">
                        {currentSession?.openedAt?.toDate?.()?.toLocaleString() || (isRTL ? 'غير محدد' : 'Not specified')}
                      </Typography>
                    </Stack>
                  </Stack>
                </Box>

                <Box>
                  <Stack spacing={1}>
                    <Typography variant="body2" color="text.secondary">
                      {isRTL ? 'الرصيد الافتتاحي' : 'Opening Balance'}
                    </Typography>
                    <Typography variant="h6">
                      {(currentSession?.openingAmounts?.cash || 0).toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                    </Typography>
                  </Stack>
                </Box>

                <Box>
                  <Stack spacing={1}>
                    <Typography variant="body2" color="text.secondary">
                      {isRTL ? 'الرصيد المتوقع' : 'Expected Balance'}
                    </Typography>
                    <Typography variant="h6" color="primary">
                      {(currentSession?.expectedAmounts?.total || 0).toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                    </Typography>
                  </Stack>
                </Box>
              </Box>

              {currentSession.status === 'closed' && (
                <Box sx={{ mt: 3 }}>
                  <Divider sx={{ mb: 2 }} />
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, gap: 3 }}>
                    <Box>
                      <Stack spacing={1}>
                        <Typography variant="body2" color="text.secondary">
                          {isRTL ? 'الرصيد الفعلي' : 'Actual Balance'}
                        </Typography>
                        <Typography variant="h6">
                          {(currentSession?.actualAmounts?.cash || 0).toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                        </Typography>
                      </Stack>
                    </Box>

                    <Box>
                      <Stack spacing={1}>
                        <Typography variant="body2" color="text.secondary">
                          {isRTL ? 'الفرق' : 'Difference'}
                        </Typography>
                        <Typography
                          variant="h6"
                          color={(currentSession?.discrepancies?.cash || 0) === 0 ? 'success.main' : 'error.main'}
                        >
                          {(currentSession?.discrepancies?.cash || 0) > 0 ? '+' : ''}{(currentSession?.discrepancies?.cash || 0).toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                        </Typography>
                      </Stack>
                    </Box>

                    <Box>
                      <Stack spacing={1}>
                        <Typography variant="body2" color="text.secondary">
                          {isRTL ? 'وقت الإغلاق' : 'Closing Time'}
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <AccessTime fontSize="small" color="action" />
                          <Typography variant="body1">
                            {currentSession?.closedAt?.toDate?.()?.toLocaleString() || (isRTL ? 'غير محدد' : 'Not specified')}
                          </Typography>
                        </Stack>
                      </Stack>
                    </Box>

                    <Box>
                      <Stack spacing={1}>
                        <Typography variant="body2" color="text.secondary">
                          {isRTL ? 'أغلق بواسطة' : 'Closed By'}
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Person fontSize="small" color="action" />
                          <Typography variant="body1">
                            {currentSession.closedBy || '-'}
                          </Typography>
                        </Stack>
                      </Stack>
                    </Box>
                  </Box>
                </Box>
              )}
            </Paper>
          ) : (
            <Alert severity="info" sx={{ mb: 3 }}>
              {isRTL
                ? 'لا يوجد جلسة صندوق مفتوحة حالياً. اضغط على "فتح الصندوق" للبدء.'
                : 'No open cash register session. Click "Open Register" to start.'}
            </Alert>
          )}

          {/* Money Movement Summary - Show where money went */}
          {currentSession && currentSession.accountMovements && (
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                {isRTL ? 'حركة الأموال بين الحسابات' : 'Money Movement Between Accounts'}
              </Typography>
              
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }, gap: 2 }}>
                {Object.entries(currentSession.accountMovements).map(([accountId, movement]) => (
                  <Card key={accountId} variant="outlined">
                    <CardContent>
                      <Stack spacing={2}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="subtitle1" fontWeight="medium">
                            {movement.accountName}
                          </Typography>
                          {movement.accountType === 'cash' && <LocalAtm color="primary" />}
                          {movement.accountType === 'bank' && <AccountBalance color="primary" />}
                          {movement.accountType === 'credit_card' && <CreditCard color="primary" />}
                          {movement.accountType === 'digital_wallet' && <AccountBalanceWallet color="primary" />}
                        </Stack>
                        
                        <Divider />
                        
                        <Box>
                          <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                              {isRTL ? 'الرصيد الافتتاحي' : 'Opening'}
                            </Typography>
                            <Typography variant="body2">
                              {movement.openingBalance.toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                            </Typography>
                          </Stack>
                          
                          {movement.transactionTotal !== 0 && (
                            <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                              <Typography variant="body2" color="text.secondary">
                                {isRTL ? 'المعاملات' : 'Transactions'}
                              </Typography>
                              <Typography 
                                variant="body2" 
                                color={movement.transactionTotal > 0 ? 'success.main' : 'error.main'}
                              >
                                {movement.transactionTotal > 0 ? '+' : ''}{movement.transactionTotal.toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                              </Typography>
                            </Stack>
                          )}
                          
                          {movement.adjustments !== 0 && (
                            <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                              <Typography variant="body2" color="text.secondary">
                                {isRTL ? 'التعديلات' : 'Adjustments'}
                              </Typography>
                              <Typography variant="body2" color="warning.main">
                                {movement.adjustments > 0 ? '+' : ''}{movement.adjustments.toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                              </Typography>
                            </Stack>
                          )}
                          
                          <Divider sx={{ my: 1 }} />
                          
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2" fontWeight="medium">
                              {isRTL ? 'الرصيد المتوقع' : 'Expected'}
                            </Typography>
                            <Typography variant="body1" fontWeight="medium" color="primary">
                              {movement.expectedBalance.toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                            </Typography>
                          </Stack>
                          
                          {currentSession.status === 'closed' && movement.actualBalance !== undefined && (
                            <>
                              <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
                                <Typography variant="body2" fontWeight="medium">
                                  {isRTL ? 'الرصيد الفعلي' : 'Actual'}
                                </Typography>
                                <Typography variant="body1" fontWeight="medium">
                                  {movement.actualBalance.toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                                </Typography>
                              </Stack>
                              
                              {movement.discrepancy !== undefined && movement.discrepancy !== 0 && (
                                <Alert 
                                  severity={movement.discrepancy > 0 ? 'info' : 'warning'} 
                                  sx={{ mt: 1, py: 0.5 }}
                                >
                                  <Typography variant="caption">
                                    {isRTL ? 'الفرق: ' : 'Difference: '}
                                    {movement.discrepancy > 0 ? '+' : ''}{movement.discrepancy.toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                                  </Typography>
                                </Alert>
                              )}
                            </>
                          )}
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            </Paper>
          )}

          {/* Transaction Summary */}
          {currentSession?.status === 'open' && currentSession.transactionSummary && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, gap: 3 }}>
              <Box>
                <Card>
                  <CardContent>
                    <Stack spacing={1}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <TrendingUp color="success" />
                        <Typography variant="h5" color="success.main">
                          +{(currentSession?.transactionSummary?.totalIncome || 0).toLocaleString()}
                        </Typography>
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {isRTL ? 'إجمالي الإيرادات' : 'Total Income'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {currentSession.transactionSummary.incomeCount} {isRTL ? 'معاملة' : 'transactions'}
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
                          -{(currentSession?.transactionSummary?.totalExpenses || 0).toLocaleString()}
                        </Typography>
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {isRTL ? 'إجمالي المصروفات' : 'Total Expenses'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {currentSession.transactionSummary.expenseCount} {isRTL ? 'معاملة' : 'transactions'}
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
                        <AttachMoney color="primary" />
                        <Typography variant="h5" color="primary.main">
                          {(currentSession?.transactionSummary?.netTotal || 0).toLocaleString()}
                        </Typography>
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {isRTL ? 'صافي المبلغ' : 'Net Amount'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {currentSession.transactionSummary.totalCount} {isRTL ? 'إجمالي المعاملات' : 'total transactions'}
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              </Box>

              <Box>
                <Card sx={{ bgcolor: 'primary.main', color: 'white' }}>
                  <CardContent>
                    <Stack spacing={1}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <PointOfSale sx={{ color: 'white' }} />
                        <Typography variant="h5" sx={{ color: 'white' }}>
                          {(currentSession?.expectedAmounts?.total || 0).toLocaleString()}
                        </Typography>
                      </Stack>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                        {isRTL ? 'الرصيد المتوقع' : 'Expected Balance'}
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              </Box>
            </Box>
          )}

          {/* Payment Method Breakdown */}
          {currentSession?.status === 'open' && currentSession.paymentBreakdown && (
            <Paper sx={{ p: 3, mt: 3 }}>
              <Typography variant="h6" gutterBottom>
                {isRTL ? 'تفاصيل طرق الدفع' : 'Payment Method Breakdown'}
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2 }}>
                {Object.entries(currentSession.paymentBreakdown).map(([method, breakdown]) => (
                  <Box key={method}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      {getPaymentMethodIcon(method)}
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          {method.charAt(0).toUpperCase() + method.slice(1).replace('_', ' ')}
                        </Typography>
                        <Typography variant="h6">
                          {breakdown.amount.toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {breakdown.count} {isRTL ? 'معاملة' : 'transactions'}
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>
                ))}
              </Box>
            </Paper>
          )}
        </Box>

        {/* Recent Sessions */}
        <Typography variant="h5" gutterBottom>
          {isRTL ? 'الجلسات الأخيرة' : 'Recent Sessions'}
        </Typography>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{isRTL ? 'التاريخ' : 'Date'}</TableCell>
                <TableCell>{isRTL ? 'الموظف' : 'Staff'}</TableCell>
                <TableCell>{isRTL ? 'الافتتاحي' : 'Opening'}</TableCell>
                <TableCell>{isRTL ? 'الإيرادات' : 'Income'}</TableCell>
                <TableCell>{isRTL ? 'المصروفات' : 'Expenses'}</TableCell>
                <TableCell>{isRTL ? 'المتوقع' : 'Expected'}</TableCell>
                <TableCell>{isRTL ? 'الفعلي' : 'Actual'}</TableCell>
                <TableCell>{isRTL ? 'الفرق' : 'Difference'}</TableCell>
                <TableCell>{isRTL ? 'الحالة' : 'Status'}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sessions.map((session) => (
                <TableRow key={session.id}>
                  <TableCell>
                    {session?.openedAt?.toDate?.()?.toLocaleDateString() || (isRTL ? 'غير محدد' : 'Not specified')}
                  </TableCell>
                  <TableCell>{session.openedBy}</TableCell>
                  <TableCell>{session?.openingAmounts?.cash?.toLocaleString() || '0'}</TableCell>
                  <TableCell>
                    <Typography color="success.main">
                      +{session.transactionSummary?.totalIncome.toLocaleString() || 0}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography color="error.main">
                      -{session.transactionSummary?.totalExpenses.toLocaleString() || 0}
                    </Typography>
                  </TableCell>
                  <TableCell>{(session?.expectedAmounts?.total || 0).toLocaleString()}</TableCell>
                  <TableCell>{(session?.actualAmounts?.cash || 0).toLocaleString()}</TableCell>
                  <TableCell>
                    {session?.discrepancies?.cash !== undefined ? (
                      <Typography color={(session?.discrepancies?.cash || 0) === 0 ? 'success.main' : 'error.main'}>
                        {(session?.discrepancies?.cash || 0) > 0 ? '+' : ''}{(session?.discrepancies?.cash || 0).toLocaleString()}
                      </Typography>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={
                        session.status === 'open' ? (isRTL ? 'مفتوح' : 'Open') :
                        session.status === 'closed' ? (isRTL ? 'مغلق' : 'Closed') :
                        (isRTL ? 'مطابق' : 'Reconciled')
                      }
                      size="small"
                      color={getSessionStatusColor(session.status)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Enhanced Open Register Dialog */}
        <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
          <DialogTitle>{isRTL ? 'فتح ورديه' : 'Open Cash Register'}</DialogTitle>
          <DialogContent>
            <Stack spacing={3} sx={{ mt: 1 }}>
              {/* Account Selection Section */}
              <Typography variant="h6">{isRTL ? 'اختيار الحسابات' : 'Select Accounts'}</Typography>
              
              {/* Cash Account (Required) */}
              <FormControl fullWidth required>
                <InputLabel>{isRTL ? 'الحساب النقدي' : 'Cash Account'}</InputLabel>
                <Select
                  value={openingForm.accountMappings.cashAccountId}
                  onChange={(e) => setOpeningForm(prev => ({
                    ...prev,
                    accountMappings: {
                      ...prev.accountMappings,
                      cashAccountId: e.target.value,
                    },
                  }))}
                  label={isRTL ? 'الحساب النقدي' : 'Cash Account'}
                >
                  {availableAccounts
                    .filter(acc => acc.type === 'cash')
                    .map(account => (
                      <MenuItem key={account.id} value={account.id}>
                        <Stack direction="row" justifyContent="space-between" width="100%">
                          <span>{isRTL ? account.nameAr : account.name}</span>
                          <Typography variant="body2" color="text.secondary">
                            {account.currentBalance.toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                          </Typography>
                        </Stack>
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>

              {/* Card Account (Optional) */}
              <FormControl fullWidth>
                <InputLabel>{isRTL ? 'حساب البطاقات' : 'Card Account'}</InputLabel>
                <Select
                  value={openingForm.accountMappings.cardAccountId || ''}
                  onChange={(e) => setOpeningForm(prev => ({
                    ...prev,
                    accountMappings: {
                      ...prev.accountMappings,
                      cardAccountId: e.target.value,
                    },
                  }))}
                  label={isRTL ? 'حساب البطاقات' : 'Card Account'}
                >
                  <MenuItem value="">
                    <em>{isRTL ? 'لا يوجد' : 'None'}</em>
                  </MenuItem>
                  {availableAccounts
                    .filter(acc => acc.type === 'bank' || acc.type === 'credit_card')
                    .map(account => (
                      <MenuItem key={account.id} value={account.id}>
                        <Stack direction="row" justifyContent="space-between" width="100%">
                          <span>{isRTL ? account.nameAr : account.name}</span>
                          <Typography variant="body2" color="text.secondary">
                            {account.currentBalance.toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                          </Typography>
                        </Stack>
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>

              {/* Bank Account (Optional) */}
              <FormControl fullWidth>
                <InputLabel>{isRTL ? 'الحساب البنكي' : 'Bank Account'}</InputLabel>
                <Select
                  value={openingForm.accountMappings.bankAccountId || ''}
                  onChange={(e) => setOpeningForm(prev => ({
                    ...prev,
                    accountMappings: {
                      ...prev.accountMappings,
                      bankAccountId: e.target.value,
                    },
                  }))}
                  label={isRTL ? 'الحساب البنكي' : 'Bank Account'}
                >
                  <MenuItem value="">
                    <em>{isRTL ? 'لا يوجد' : 'None'}</em>
                  </MenuItem>
                  {availableAccounts
                    .filter(acc => acc.type === 'bank')
                    .map(account => (
                      <MenuItem key={account.id} value={account.id}>
                        <Stack direction="row" justifyContent="space-between" width="100%">
                          <span>{isRTL ? account.nameAr : account.name}</span>
                          <Typography variant="body2" color="text.secondary">
                            {account.currentBalance.toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                          </Typography>
                        </Stack>
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>

              {/* Digital Wallet Account (Optional) */}
              <FormControl fullWidth>
                <InputLabel>{isRTL ? 'حساب المحفظة الإلكترونية' : 'Digital Wallet Account'}</InputLabel>
                <Select
                  value={openingForm.accountMappings.digitalWalletAccountId || ''}
                  onChange={(e) => setOpeningForm(prev => ({
                    ...prev,
                    accountMappings: {
                      ...prev.accountMappings,
                      digitalWalletAccountId: e.target.value,
                    },
                  }))}
                  label={isRTL ? 'حساب المحفظة الإلكترونية' : 'Digital Wallet Account'}
                >
                  <MenuItem value="">
                    <em>{isRTL ? 'لا يوجد' : 'None'}</em>
                  </MenuItem>
                  {availableAccounts
                    .filter(acc => acc.type === 'digital_wallet')
                    .map(account => (
                      <MenuItem key={account.id} value={account.id}>
                        <Stack direction="row" justifyContent="space-between" width="100%">
                          <span>{isRTL ? account.nameAr : account.name}</span>
                          <Typography variant="body2" color="text.secondary">
                            {account.currentBalance.toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                          </Typography>
                        </Stack>
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>

              <Divider />

              {/* Opening Amounts Section */}
              <Typography variant="h6">{isRTL ? 'المبالغ الافتتاحية' : 'Opening Amounts'}</Typography>
              
              {/* Cash Amount */}
              <TextField
                fullWidth
                type="number"
                label={isRTL ? 'النقد في الصندوق' : 'Cash in Register'}
                value={openingForm.openingAmounts.cash}
                onChange={(e) => setOpeningForm(prev => ({
                  ...prev,
                  openingAmounts: {
                    ...prev.openingAmounts,
                    cash: parseFloat(e.target.value) || 0,
                  },
                }))}
                InputProps={{
                  endAdornment: <InputAdornment position="end">{isRTL ? 'ج.م' : 'EGP'}</InputAdornment>,
                  startAdornment: <InputAdornment position="start"><LocalAtm /></InputAdornment>,
                }}
                helperText={isRTL ? 'المبلغ النقدي الموجود في الصندوق' : 'Physical cash amount in the register'}
              />

              {/* Card Vouchers/Receipts */}
              {openingForm.accountMappings.cardAccountId && (
                <TextField
                  fullWidth
                  type="number"
                  label={isRTL ? 'إيصالات البطاقات' : 'Card Receipts'}
                  value={openingForm.openingAmounts.card}
                  onChange={(e) => setOpeningForm(prev => ({
                    ...prev,
                    openingAmounts: {
                      ...prev.openingAmounts,
                      card: parseFloat(e.target.value) || 0,
                    },
                  }))}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">{isRTL ? 'ج.م' : 'EGP'}</InputAdornment>,
                    startAdornment: <InputAdornment position="start"><CreditCard /></InputAdornment>,
                  }}
                  helperText={isRTL ? 'إيصالات بطاقات من اليوم السابق' : 'Card receipts from previous day'}
                />
              )}

              {/* Bank Deposits */}
              {openingForm.accountMappings.bankAccountId && (
                <TextField
                  fullWidth
                  type="number"
                  label={isRTL ? 'الإيداعات البنكية' : 'Bank Deposits'}
                  value={openingForm.openingAmounts.bankTransfer}
                  onChange={(e) => setOpeningForm(prev => ({
                    ...prev,
                    openingAmounts: {
                      ...prev.openingAmounts,
                      bankTransfer: parseFloat(e.target.value) || 0,
                    },
                  }))}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">{isRTL ? 'ج.م' : 'EGP'}</InputAdornment>,
                    startAdornment: <InputAdornment position="start"><AccountBalance /></InputAdornment>,
                  }}
                  helperText={isRTL ? 'إيداعات بنكية معلقة' : 'Pending bank deposits'}
                />
              )}

              {/* Digital Wallet Balance */}
              {openingForm.accountMappings.digitalWalletAccountId && (
                <TextField
                  fullWidth
                  type="number"
                  label={isRTL ? 'رصيد المحفظة الإلكترونية' : 'Digital Wallet Balance'}
                  value={openingForm.openingAmounts.digitalWallet}
                  onChange={(e) => setOpeningForm(prev => ({
                    ...prev,
                    openingAmounts: {
                      ...prev.openingAmounts,
                      digitalWallet: parseFloat(e.target.value) || 0,
                    },
                  }))}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">{isRTL ? 'ج.م' : 'EGP'}</InputAdornment>,
                    startAdornment: <InputAdornment position="start"><AccountBalanceWallet /></InputAdornment>,
                  }}
                  helperText={isRTL ? 'رصيد المحفظة من اليوم السابق' : 'Digital wallet balance from previous day'}
                />
              )}

              {/* Total Opening Amount */}
              <Alert severity="info">
                <Typography>
                  {isRTL ? 'إجمالي المبلغ الافتتاحي: ' : 'Total Opening Amount: '}
                  <strong>
                    {(openingForm.openingAmounts.cash + 
                     openingForm.openingAmounts.card + 
                     openingForm.openingAmounts.bankTransfer +
                     openingForm.openingAmounts.digitalWallet).toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                  </strong>
                </Typography>
              </Alert>

              {/* Notes */}
              <TextField
                fullWidth
                multiline
                rows={3}
                label={isRTL ? 'ملاحظات' : 'Notes'}
                value={openingForm.notes}
                onChange={(e) => setOpeningForm({ ...openingForm, notes: e.target.value })}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDialog(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button 
              onClick={handleOpenRegister} 
              variant="contained" 
              color="success"
              disabled={!openingForm.accountMappings.cashAccountId}
            >
              {isRTL ? 'فتح الصندوق' : 'Open Register'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Enhanced Close Register Dialog with Account Reconciliation */}
        <Dialog open={closeDialog} onClose={() => setCloseDialog(false)} maxWidth="lg" fullWidth>
          <DialogTitle>{isRTL ? 'إغلاق الورديه - تسوية الحسابات' : 'Close Cash Register - Account Reconciliation'}</DialogTitle>
          <DialogContent>
            <Stack spacing={3} sx={{ mt: 1 }}>
              {/* Account-by-Account Reconciliation */}
              <Typography variant="h6">{isRTL ? 'تسوية الحسابات' : 'Account Reconciliation'}</Typography>
              
              {currentSession?.accountMovements && Object.entries(currentSession.accountMovements).map(([accountId, movement]) => {
                const accountBalance = closingForm.actualAccountBalances[accountId] || 0;
                const discrepancy = accountBalance - movement.expectedBalance;
                
                return (
                  <Paper key={accountId} sx={{ p: 3 }} elevation={2}>
                    <Stack spacing={2}>
                      {/* Account Header */}
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Box>
                          <Typography variant="h6">{movement.accountName}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {movement.accountType === 'cash' && <LocalAtm sx={{ fontSize: 16, mr: 0.5 }} />}
                            {movement.accountType === 'bank' && <AccountBalance sx={{ fontSize: 16, mr: 0.5 }} />}
                            {movement.accountType === 'credit_card' && <CreditCard sx={{ fontSize: 16, mr: 0.5 }} />}
                            {movement.accountType === 'digital_wallet' && <AccountBalanceWallet sx={{ fontSize: 16, mr: 0.5 }} />}
                            {isRTL ? 
                              (movement.accountType === 'cash' ? 'نقدي' : 
                               movement.accountType === 'bank' ? 'بنكي' : 
                               movement.accountType === 'credit_card' ? 'بطاقة ائتمان' :
                               movement.accountType === 'digital_wallet' ? 'محفظة إلكترونية' : 
                               movement.accountType) :
                              movement.accountType
                            }
                          </Typography>
                        </Box>
                        <Chip
                          label={discrepancy === 0 ? 
                            (isRTL ? 'متطابق' : 'Balanced') : 
                            (isRTL ? 'فرق' : 'Discrepancy')
                          }
                          color={discrepancy === 0 ? 'success' : 'warning'}
                          size="small"
                        />
                      </Stack>
                      
                      {/* Account Movement Details */}
                      <Grid container spacing={2}>
                        <Grid item xs={6} md={3}>
                          <Typography variant="body2" color="text.secondary">
                            {isRTL ? 'الرصيد الافتتاحي' : 'Opening Balance'}
                          </Typography>
                          <Typography variant="body1" fontWeight="medium">
                            {movement.openingBalance.toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                          </Typography>
                        </Grid>
                        <Grid item xs={6} md={3}>
                          <Typography variant="body2" color="text.secondary">
                            {isRTL ? 'المعاملات' : 'Transactions'}
                          </Typography>
                          <Typography variant="body1" fontWeight="medium" color={movement.transactionTotal >= 0 ? 'success.main' : 'error.main'}>
                            {movement.transactionTotal >= 0 ? '+' : ''}{movement.transactionTotal.toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                          </Typography>
                        </Grid>
                        <Grid item xs={6} md={3}>
                          <Typography variant="body2" color="text.secondary">
                            {isRTL ? 'التعديلات' : 'Adjustments'}
                          </Typography>
                          <Typography variant="body1" fontWeight="medium">
                            {movement.adjustments.toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                          </Typography>
                        </Grid>
                        <Grid item xs={6} md={3}>
                          <Typography variant="body2" color="text.secondary">
                            {isRTL ? 'الرصيد المتوقع' : 'Expected Balance'}
                          </Typography>
                          <Typography variant="body1" fontWeight="medium" color="primary.main">
                            {movement.expectedBalance.toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                          </Typography>
                        </Grid>
                      </Grid>
                      
                      {/* Actual Count Input */}
                      <Box>
                        <TextField
                          fullWidth
                          type="number"
                          label={isRTL ? 'الرصيد الفعلي' : 'Actual Balance'}
                          value={accountBalance}
                          onChange={(e) => setClosingForm(prev => ({
                            ...prev,
                            actualAccountBalances: {
                              ...prev.actualAccountBalances,
                              [accountId]: parseFloat(e.target.value) || 0,
                            },
                          }))}
                          InputProps={{
                            endAdornment: <InputAdornment position="end">{isRTL ? 'ج.م' : 'EGP'}</InputAdornment>,
                          }}
                          error={discrepancy !== 0}
                          helperText={
                            discrepancy !== 0 ? 
                              `${isRTL ? 'الفرق: ' : 'Difference: '}${discrepancy > 0 ? '+' : ''}${discrepancy.toLocaleString()} ${isRTL ? 'ج.م' : 'EGP'}` : 
                              (isRTL ? 'الرصيد متطابق' : 'Balance matches')
                          }
                        />
                      </Box>
                      
                      {/* Cash Denomination Count (only for cash accounts) */}
                      {movement.accountType === 'cash' && (
                        <Box>
                          <Typography variant="subtitle2" gutterBottom>
                            {isRTL ? 'عد الفئات النقدية' : 'Cash Denomination Count'}
                          </Typography>
                          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 1 }}>
                            {Object.entries(closingForm.denominations).map(([denomination, count]) => (
                              <TextField
                                key={denomination}
                                size="small"
                                type="number"
                                label={`${denomination} ${isRTL ? 'ج.م' : 'EGP'}`}
                                value={count}
                                onChange={(e) => {
                                  const newDenominations = {
                                    ...closingForm.denominations,
                                    [denomination]: parseInt(e.target.value) || 0,
                                  };
                                  const totalCash = Object.entries(newDenominations).reduce(
                                    (sum, [denom, cnt]) => sum + (parseFloat(denom) * cnt), 0
                                  );
                                  setClosingForm(prev => ({
                                    ...prev,
                                    denominations: newDenominations,
                                    actualAccountBalances: {
                                      ...prev.actualAccountBalances,
                                      [accountId]: totalCash,
                                    },
                                  }));
                                }}
                                InputProps={{
                                  startAdornment: <InputAdornment position="start">×</InputAdornment>,
                                }}
                              />
                            ))}
                          </Box>
                        </Box>
                      )}
                    </Stack>
                  </Paper>
                );
              })}
              
              {/* Summary Section */}
              <Paper sx={{ p: 3, bgcolor: 'primary.main', color: 'primary.contrastText' }} elevation={3}>
                <Stack spacing={2}>
                  <Typography variant="h6">
                    {isRTL ? 'ملخص الإغلاق' : 'Closing Summary'}
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2" sx={{ opacity: 0.8 }}>
                        {isRTL ? 'إجمالي المتوقع' : 'Total Expected'}
                      </Typography>
                      <Typography variant="h5">
                        {(currentSession?.accountMovements ? 
                          Object.values(currentSession.accountMovements).reduce((sum, m) => sum + m.expectedBalance, 0) : 
                          0
                        ).toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" sx={{ opacity: 0.8 }}>
                        {isRTL ? 'إجمالي الفعلي' : 'Total Actual'}
                      </Typography>
                      <Typography variant="h5">
                        {Object.values(closingForm.actualAccountBalances).reduce((sum, val) => sum + val, 0).toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                      </Typography>
                    </Grid>
                  </Grid>
                  
                  {Object.values(closingForm.actualAccountBalances).reduce((sum, val) => sum + val, 0) !== 
                   (currentSession?.accountMovements ? 
                     Object.values(currentSession.accountMovements).reduce((sum, m) => sum + m.expectedBalance, 0) : 
                     0
                   ) && (
                    <Alert severity="warning" sx={{ bgcolor: 'rgba(255, 255, 255, 0.9)' }}>
                      <AlertTitle>{isRTL ? 'يوجد فروقات' : 'Discrepancies Found'}</AlertTitle>
                      <Typography variant="body2">
                        {isRTL ? 
                          'سيتم إنشاء قيود تسوية تلقائية للفروقات في حساب الفروقات النقدية.' : 
                          'Automatic adjustment entries will be created for discrepancies in the Cash Over/Short account.'
                        }
                      </Typography>
                    </Alert>
                  )}
                </Stack>
              </Paper>
              
              {/* Notes */}
              <TextField
                fullWidth
                multiline
                rows={3}
                label={isRTL ? 'ملاحظات الإغلاق' : 'Closing Notes'}
                value={closingForm.notes}
                onChange={(e) => setClosingForm({ ...closingForm, notes: e.target.value })}
                placeholder={isRTL ? 
                  'أي ملاحظات عن الفروقات أو الأحداث المهمة خلال الورديه...' : 
                  'Any notes about discrepancies or important events during the session...'
                }
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCloseDialog(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button 
              onClick={handleCloseRegister} 
              variant="contained" 
              color="error"
              disabled={Object.keys(closingForm.actualAccountBalances).length === 0}
            >
              {isRTL ? 'إغلاق الصندوق' : 'Close Register'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Count Cash Dialog */}
        <Dialog open={countDialog} onClose={() => setCountDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>{isRTL ? 'عد النقدية' : 'Count Cash'}</DialogTitle>
          <DialogContent>
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                {isRTL ? 'الرصيد المتوقع حالياً: ' : 'Current Expected Balance: '}
                <strong>{(currentSession?.expectedAmounts?.total || 0).toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}</strong>
              </Typography>
            </Alert>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              {isRTL
                ? 'يمكنك عد النقدية في أي وقت للتأكد من المبلغ الموجود في الصندوق.'
                : 'You can count the cash at any time to verify the amount in the register.'}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCountDialog(false)}>{isRTL ? 'إغلاق' : 'Close'}</Button>
          </DialogActions>
        </Dialog>

        {/* Adjustment Dialog */}
        <Dialog open={adjustmentDialog} onClose={() => setAdjustmentDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>{isRTL ? 'تعديل الصندوق' : 'Cash Adjustment'}</DialogTitle>
          <DialogContent>
            <Stack spacing={3} sx={{ mt: 1 }}>
              <FormControl fullWidth>
                <InputLabel>{isRTL ? 'نوع التعديل' : 'Adjustment Type'}</InputLabel>
                <Select
                  value={adjustmentForm.type}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, type: e.target.value as 'add' | 'remove' })}
                  label={isRTL ? 'نوع التعديل' : 'Adjustment Type'}
                >
                  <MenuItem value="add">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Add color="success" />
                      <span>{isRTL ? 'إضافة نقدية' : 'Add Cash'}</span>
                    </Stack>
                  </MenuItem>
                  <MenuItem value="remove">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Remove color="error" />
                      <span>{isRTL ? 'سحب نقدية' : 'Remove Cash'}</span>
                    </Stack>
                  </MenuItem>
                </Select>
              </FormControl>

              <TextField
                fullWidth
                type="number"
                label={isRTL ? 'المبلغ' : 'Amount'}
                value={adjustmentForm.amount}
                onChange={(e) => setAdjustmentForm({ ...adjustmentForm, amount: parseFloat(e.target.value) || 0 })}
                InputProps={{
                  endAdornment: <InputAdornment position="end">{isRTL ? 'ج.م' : 'EGP'}</InputAdornment>,
                }}
              />

              <TextField
                fullWidth
                required
                multiline
                rows={3}
                label={isRTL ? 'السبب' : 'Reason'}
                value={adjustmentForm.reason}
                onChange={(e) => setAdjustmentForm({ ...adjustmentForm, reason: e.target.value })}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAdjustmentDialog(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button
              onClick={handleAdjustment}
              variant="contained"
              disabled={!adjustmentForm.amount || !adjustmentForm.reason}
            >
              {isRTL ? 'تأكيد' : 'Confirm'}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </LocalizationProvider>
  );
};

export default CashRegisterPage;