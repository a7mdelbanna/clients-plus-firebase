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
  Grid,
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
  FinancialAccount,
  TransactionSummary,
  PaymentBreakdown,
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
  const [cashAccount, setCashAccount] = useState<FinancialAccount | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [closeDialog, setCloseDialog] = useState(false);
  const [countDialog, setCountDialog] = useState(false);
  const [adjustmentDialog, setAdjustmentDialog] = useState(false);
  const [historyDialog, setHistoryDialog] = useState(false);

  // Form states
  const [openingForm, setOpeningForm] = useState({
    openingBalance: 0,
    notes: '',
  });

  const [closingForm, setClosingForm] = useState({
    actualCashCount: 0,
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

      // Get cash account
      const accounts = await financeService.getAccounts(
        currentUser.companyId,
        { branchId: currentBranch.id, type: 'cash' }
      );
      const cashAcc = accounts.find(a => a.type === 'cash');
      setCashAccount(cashAcc || null);

      if (cashAcc?.id) {
        // Get current session
        const session = await financeService.getCurrentCashRegisterSession(
          currentUser.companyId,
          currentBranch.id,
          cashAcc.id
        );
        setCurrentSession(session);

        // Get recent sessions
        const recentSessions = await financeService.getCashRegisterSessions(
          currentUser.companyId,
          {
            branchId: currentBranch.id,
            accountId: cashAcc.id,
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
    if (!currentUser?.companyId || !currentBranch?.id || !cashAccount?.id) return;

    try {
      await financeService.openCashRegister(
        currentUser.companyId,
        currentBranch.id,
        cashAccount.id,
        openingForm.openingBalance,
        currentUser.uid,
        openingForm.notes
      );

      setOpenDialog(false);
      setOpeningForm({ openingBalance: 0, notes: '' });
      loadData();
    } catch (error) {
      console.error('Error opening cash register:', error);
    }
  };

  const handleCloseRegister = async () => {
    if (!currentUser?.companyId || !currentSession?.id) return;

    try {
      await financeService.closeCashRegister(
        currentUser.companyId,
        currentSession.id,
        closingForm.actualCashCount,
        closingForm.notes,
        closingForm.denominations
      );

      setCloseDialog(false);
      setClosingForm({
        actualCashCount: 0,
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
    } catch (error) {
      console.error('Error closing cash register:', error);
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

  // Update actual cash count when denominations change
  useEffect(() => {
    setClosingForm(prev => ({
      ...prev,
      actualCashCount: calculateDenominationsTotal(),
    }));
  }, [closingForm.denominations]);

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

  if (!cashAccount) {
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
              {isRTL ? 'الصندوق النقدي' : 'Cash Register'}
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
              <Grid container spacing={3}>
                <Grid item xs={12} md={3}>
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
                </Grid>

                <Grid item xs={12} md={3}>
                  <Stack spacing={1}>
                    <Typography variant="body2" color="text.secondary">
                      {isRTL ? 'وقت الفتح' : 'Opening Time'}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <AccessTime fontSize="small" color="action" />
                      <Typography variant="body1">
                        {currentSession.openingTime.toDate().toLocaleString()}
                      </Typography>
                    </Stack>
                  </Stack>
                </Grid>

                <Grid item xs={12} md={3}>
                  <Stack spacing={1}>
                    <Typography variant="body2" color="text.secondary">
                      {isRTL ? 'الرصيد الافتتاحي' : 'Opening Balance'}
                    </Typography>
                    <Typography variant="h6">
                      {currentSession.openingBalance.toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                    </Typography>
                  </Stack>
                </Grid>

                <Grid item xs={12} md={3}>
                  <Stack spacing={1}>
                    <Typography variant="body2" color="text.secondary">
                      {isRTL ? 'الرصيد المتوقع' : 'Expected Balance'}
                    </Typography>
                    <Typography variant="h6" color="primary">
                      {currentSession.expectedBalance.toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                    </Typography>
                  </Stack>
                </Grid>
              </Grid>

              {currentSession.status === 'closed' && (
                <Box sx={{ mt: 3 }}>
                  <Divider sx={{ mb: 2 }} />
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={3}>
                      <Stack spacing={1}>
                        <Typography variant="body2" color="text.secondary">
                          {isRTL ? 'الرصيد الفعلي' : 'Actual Balance'}
                        </Typography>
                        <Typography variant="h6">
                          {currentSession.actualCashCount?.toLocaleString() || 0} {isRTL ? 'ج.م' : 'EGP'}
                        </Typography>
                      </Stack>
                    </Grid>

                    <Grid item xs={12} md={3}>
                      <Stack spacing={1}>
                        <Typography variant="body2" color="text.secondary">
                          {isRTL ? 'الفرق' : 'Difference'}
                        </Typography>
                        <Typography
                          variant="h6"
                          color={currentSession.difference === 0 ? 'success.main' : 'error.main'}
                        >
                          {currentSession.difference > 0 ? '+' : ''}{currentSession.difference.toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                        </Typography>
                      </Stack>
                    </Grid>

                    <Grid item xs={12} md={3}>
                      <Stack spacing={1}>
                        <Typography variant="body2" color="text.secondary">
                          {isRTL ? 'وقت الإغلاق' : 'Closing Time'}
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <AccessTime fontSize="small" color="action" />
                          <Typography variant="body1">
                            {currentSession.closingTime?.toDate().toLocaleString()}
                          </Typography>
                        </Stack>
                      </Stack>
                    </Grid>

                    <Grid item xs={12} md={3}>
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
                    </Grid>
                  </Grid>
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

          {/* Transaction Summary */}
          {currentSession?.status === 'open' && currentSession.transactionSummary && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Stack spacing={1}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <TrendingUp color="success" />
                        <Typography variant="h5" color="success.main">
                          +{currentSession.transactionSummary.totalIncome.toLocaleString()}
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
              </Grid>

              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Stack spacing={1}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <TrendingDown color="error" />
                        <Typography variant="h5" color="error.main">
                          -{currentSession.transactionSummary.totalExpenses.toLocaleString()}
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
              </Grid>

              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Stack spacing={1}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <AttachMoney color="primary" />
                        <Typography variant="h5" color="primary.main">
                          {currentSession.transactionSummary.netAmount.toLocaleString()}
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
              </Grid>

              <Grid item xs={12} md={3}>
                <Card sx={{ bgcolor: 'primary.main', color: 'white' }}>
                  <CardContent>
                    <Stack spacing={1}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <PointOfSale sx={{ color: 'white' }} />
                        <Typography variant="h5" sx={{ color: 'white' }}>
                          {currentSession.expectedBalance.toLocaleString()}
                        </Typography>
                      </Stack>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                        {isRTL ? 'الرصيد المتوقع' : 'Expected Balance'}
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}

          {/* Payment Method Breakdown */}
          {currentSession?.status === 'open' && currentSession.paymentBreakdown && (
            <Paper sx={{ p: 3, mt: 3 }}>
              <Typography variant="h6" gutterBottom>
                {isRTL ? 'تفاصيل طرق الدفع' : 'Payment Method Breakdown'}
              </Typography>
              <Grid container spacing={2}>
                {Object.entries(currentSession.paymentBreakdown).map(([method, breakdown]) => (
                  <Grid item xs={12} sm={6} md={3} key={method}>
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
                  </Grid>
                ))}
              </Grid>
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
                    {session.openingTime.toDate().toLocaleDateString()}
                  </TableCell>
                  <TableCell>{session.openedBy}</TableCell>
                  <TableCell>{session.openingBalance.toLocaleString()}</TableCell>
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
                  <TableCell>{session.expectedBalance.toLocaleString()}</TableCell>
                  <TableCell>{session.actualCashCount?.toLocaleString() || '-'}</TableCell>
                  <TableCell>
                    {session.difference !== undefined ? (
                      <Typography color={session.difference === 0 ? 'success.main' : 'error.main'}>
                        {session.difference > 0 ? '+' : ''}{session.difference.toLocaleString()}
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

        {/* Open Register Dialog */}
        <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>{isRTL ? 'فتح الصندوق النقدي' : 'Open Cash Register'}</DialogTitle>
          <DialogContent>
            <Stack spacing={3} sx={{ mt: 1 }}>
              <TextField
                fullWidth
                type="number"
                label={isRTL ? 'الرصيد الافتتاحي' : 'Opening Balance'}
                value={openingForm.openingBalance}
                onChange={(e) => setOpeningForm({ ...openingForm, openingBalance: parseFloat(e.target.value) || 0 })}
                InputProps={{
                  endAdornment: <InputAdornment position="end">{isRTL ? 'ج.م' : 'EGP'}</InputAdornment>,
                }}
                helperText={isRTL ? 'المبلغ النقدي الموجود في الصندوق حالياً' : 'The cash amount currently in the register'}
              />
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
            <Button onClick={handleOpenRegister} variant="contained" color="success">
              {isRTL ? 'فتح الصندوق' : 'Open Register'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Close Register Dialog */}
        <Dialog open={closeDialog} onClose={() => setCloseDialog(false)} maxWidth="md" fullWidth>
          <DialogTitle>{isRTL ? 'إغلاق الصندوق النقدي' : 'Close Cash Register'}</DialogTitle>
          <DialogContent>
            <Stack spacing={3} sx={{ mt: 1 }}>
              <Alert severity="info">
                <Typography variant="body2">
                  {isRTL ? 'الرصيد المتوقع: ' : 'Expected Balance: '}
                  <strong>{currentSession?.expectedBalance.toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}</strong>
                </Typography>
              </Alert>

              <Typography variant="h6">{isRTL ? 'عد النقدية' : 'Cash Count'}</Typography>
              
              <Grid container spacing={2}>
                {Object.entries(closingForm.denominations).map(([denomination, count]) => (
                  <Grid item xs={6} sm={4} md={3} key={denomination}>
                    <TextField
                      fullWidth
                      type="number"
                      label={`${denomination} ${isRTL ? 'ج.م' : 'EGP'}`}
                      value={count}
                      onChange={(e) => setClosingForm({
                        ...closingForm,
                        denominations: {
                          ...closingForm.denominations,
                          [denomination]: parseInt(e.target.value) || 0,
                        },
                      })}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">×</InputAdornment>,
                      }}
                    />
                  </Grid>
                ))}
              </Grid>

              <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="h6">
                    {isRTL ? 'إجمالي النقدية' : 'Total Cash'}
                  </Typography>
                  <Typography variant="h5" color="primary">
                    {closingForm.actualCashCount.toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                  </Typography>
                </Stack>
                {currentSession && closingForm.actualCashCount !== currentSession.expectedBalance && (
                  <Typography
                    variant="body2"
                    color={closingForm.actualCashCount > currentSession.expectedBalance ? 'success.main' : 'error.main'}
                    sx={{ mt: 1 }}
                  >
                    {isRTL ? 'الفرق: ' : 'Difference: '}
                    {closingForm.actualCashCount > currentSession.expectedBalance ? '+' : ''}
                    {(closingForm.actualCashCount - currentSession.expectedBalance).toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                  </Typography>
                )}
              </Paper>

              <TextField
                fullWidth
                multiline
                rows={3}
                label={isRTL ? 'ملاحظات الإغلاق' : 'Closing Notes'}
                value={closingForm.notes}
                onChange={(e) => setClosingForm({ ...closingForm, notes: e.target.value })}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCloseDialog(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={handleCloseRegister} variant="contained" color="error">
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
                <strong>{currentSession?.expectedBalance.toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}</strong>
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