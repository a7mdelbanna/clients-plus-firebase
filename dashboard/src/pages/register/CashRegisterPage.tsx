import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Chip,
  IconButton,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Tab,
  Tabs,
  CircularProgress,
} from '@mui/material';
import {
  PointOfSale,
  AccountBalance,
  Assessment,
  Settings,
  PlayArrow,
  Stop,
  Pause,
  AttachMoney,
  RemoveCircleOutline,
  AddCircleOutline,
  Receipt,
  ArrowDownward,
  ArrowUpward,
  Warning,
  CheckCircle,
  Timer,
  Person,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { registerService } from '../../services/register.service';
import { financeService } from '../../services/finance.service';
import type { ShiftSession, DenominationCount, RegisterTransaction } from '../../types/register.types';
import type { FinancialAccount } from '../../types/finance.types';
import { Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`register-tabpanel-${index}`}
      aria-labelledby={`register-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const CashRegisterPage: React.FC = () => {
  const { currentUser, company } = useAuth();
  const isArabic = true; // Force Arabic for now
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentShift, setCurrentShift] = useState<ShiftSession | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<RegisterTransaction[]>([]);
  const [cashAccounts, setCashAccounts] = useState<FinancialAccount[]>([]);
  const [digitalWalletAccounts, setDigitalWalletAccounts] = useState<FinancialAccount[]>([]);
  const [bankAccounts, setBankAccounts] = useState<FinancialAccount[]>([]);
  const [allAccounts, setAllAccounts] = useState<FinancialAccount[]>([]);
  
  // Dialog states
  const [openShiftDialog, setOpenShiftDialog] = useState(false);
  const [closeShiftDialog, setCloseShiftDialog] = useState(false);
  const [cashDropDialog, setCashDropDialog] = useState(false);
  const [adjustmentDialog, setAdjustmentDialog] = useState(false);
  
  // Form states
  const [openingCash, setOpeningCash] = useState<DenominationCount>({
    bills: { 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0 },
    coins: { 1: 0, 0.5: 0, 0.25: 0 },
    total: 0,
  });
  
  // Track opening balances for each account
  const [accountOpeningBalances, setAccountOpeningBalances] = useState<Record<string, number>>({});
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [showOtherAccounts, setShowOtherAccounts] = useState(false);
  
  const [closingCash, setClosingCash] = useState<DenominationCount>({
    bills: { 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0 },
    coins: { 1: 0, 0.5: 0, 0.25: 0 },
    total: 0,
  });

  const [shiftNotes, setShiftNotes] = useState('');
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [adjustmentType, setAdjustmentType] = useState<'pay_in' | 'pay_out'>('pay_in');

  const registerId = 'main-register'; // TODO: Support multiple registers
  const branchId = 'main'; // Default to 'main' branch

  useEffect(() => {
    loadInitialData();
  }, [company]);

  useEffect(() => {
    if (currentShift?.id && company?.id) {
      // Subscribe to shift updates
      const unsubscribe = registerService.subscribeToShift(
        company.id,
        currentShift.id,
        (shift) => {
          if (shift) {
            setCurrentShift(shift);
          }
        }
      );
      
      // Load transactions
      loadShiftTransactions();
      
      return () => unsubscribe();
    }
  }, [currentShift?.id, company?.id]);

  const loadInitialData = async () => {
    console.log('Loading initial data...', { company, currentUser });
    
    if (!company?.id || !currentUser?.uid) {
      console.log('No company or user, skipping load');
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      // Check for active shifts
      console.log('Checking for active shifts...');
      const activeShifts = await registerService.getActiveShiftsForEmployee(
        company.id,
        currentUser.uid
      );
      
      console.log('Active shifts found:', activeShifts);
      if (activeShifts.length > 0) {
        setCurrentShift(activeShifts[0]);
      }
      
      // Load all active financial accounts
      console.log('Loading all active financial accounts for company:', company.id);
      const accounts = await financeService.getAccounts(company.id, {
        status: 'active',
      });
      console.log('All accounts loaded:', accounts);
      console.log('Account details:', accounts.map(a => ({ id: a.id, name: a.name, type: a.type, status: a.status })));
      
      // Group accounts by type
      const cashAccs = accounts.filter(acc => acc.type === 'cash');
      const digitalWalletAccs = accounts.filter(acc => acc.type === 'digital_wallet');
      const bankAccs = accounts.filter(acc => acc.type === 'bank');
      
      setCashAccounts(cashAccs);
      setDigitalWalletAccounts(digitalWalletAccs);
      setBankAccounts(bankAccs);
      setAllAccounts(accounts);
      
      console.log('Grouped accounts:', {
        cash: cashAccs.length,
        digitalWallets: digitalWalletAccs.length,
        bank: bankAccs.length,
        total: accounts.length
      });
      
      // Initialize opening balances with current balances
      const initialBalances: Record<string, number> = {};
      accounts.forEach(acc => {
        if (acc.id) {
          initialBalances[acc.id] = acc.currentBalance || 0;
        }
      });
      setAccountOpeningBalances(initialBalances);
      console.log('Initialized opening balances:', initialBalances);
    } catch (error: any) {
      console.error('Error loading initial data:', error);
      setError(error?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadShiftTransactions = async () => {
    if (!company?.id || !currentShift?.id) return;
    
    try {
      const transactions = await registerService.getShiftTransactions(
        company.id,
        currentShift.id
      );
      setRecentTransactions(transactions.slice(0, 10));
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  };

  const calculateDenominationTotal = (denominations: DenominationCount): number => {
    let total = 0;
    
    // Bills
    Object.entries(denominations.bills).forEach(([denom, count]) => {
      total += parseFloat(denom) * count;
    });
    
    // Coins
    Object.entries(denominations.coins).forEach(([denom, count]) => {
      total += parseFloat(denom) * count;
    });
    
    return total;
  };

  const handleDenominationChange = (
    type: 'opening' | 'closing',
    category: 'bills' | 'coins',
    denomination: string,
    value: string
  ) => {
    const count = parseInt(value) || 0;
    const denominations = type === 'opening' ? { ...openingCash } : { ...closingCash };
    
    denominations[category][parseFloat(denomination)] = count;
    denominations.total = calculateDenominationTotal(denominations);
    
    if (type === 'opening') {
      setOpeningCash(denominations);
    } else {
      setClosingCash(denominations);
    }
  };

  const handleOpenShift = async () => {
    if (!company?.id || !currentUser?.uid || !currentUser?.displayName) return;
    
    try {
      // Prepare account data with opening balances
      const accountsData = Object.entries(accountOpeningBalances).map(([accountId, balance]) => {
        const account = allAccounts.find(a => a.id === accountId);
        return {
          accountId,
          accountName: account?.name || '',
          accountType: account?.type || '',
          openingBalance: balance || account?.currentBalance || 0,
          currentBalance: account?.currentBalance || 0,
        };
      });
      
      const shiftId = await registerService.openShift(
        company.id,
        branchId,
        registerId,
        currentUser.uid,
        currentUser.displayName,
        openingCash,
        shiftNotes
      );
      
      // TODO: Save account associations with the shift
      console.log('Shift opened with accounts:', accountsData);
      console.log('Total across all accounts:', {
        cashTotal: openingCash.total,
        accountsTotal: Object.entries(accountOpeningBalances).reduce((sum, [id, val]) => {
          return sum + (val || allAccounts.find(a => a.id === id)?.currentBalance || 0);
        }, 0),
      });
      
      const shift = await registerService.getShift(company.id, shiftId);
      setCurrentShift(shift);
      setOpenShiftDialog(false);
      setShiftNotes('');
      setShowOtherAccounts(false);
      
      // Reset opening cash
      setOpeningCash({
        bills: { 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0 },
        coins: { 1: 0, 0.5: 0, 0.25: 0 },
        total: 0,
      });
      
      // Reset account opening balances
      setAccountOpeningBalances({});
      setSelectedAccounts(new Set());
    } catch (error: any) {
      console.error('Error opening shift:', error);
      alert(error.message || 'Failed to open shift');
    }
  };

  const handleCloseShift = async () => {
    if (!company?.id || !currentShift?.id) return;
    
    try {
      await registerService.closeShift(
        company.id,
        currentShift.id,
        closingCash,
        shiftNotes
      );
      
      setCurrentShift(null);
      setCloseShiftDialog(false);
      setShiftNotes('');
      
      // Reset closing cash
      setClosingCash({
        bills: { 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0 },
        coins: { 1: 0, 0.5: 0, 0.25: 0 },
        total: 0,
      });
    } catch (error: any) {
      console.error('Error closing shift:', error);
      alert(error.message || 'Failed to close shift');
    }
  };

  const handleCashDrop = async () => {
    if (!company?.id || !currentShift?.id || !currentUser?.uid) return;
    
    const amount = parseFloat(adjustmentAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    
    try {
      await registerService.performCashDrop(
        company.id,
        currentShift.id,
        amount,
        {
          bills: { 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0 },
          coins: { 1: 0, 0.5: 0, 0.25: 0 },
          total: amount,
        },
        currentUser.uid,
        undefined,
        adjustmentReason
      );
      
      setCashDropDialog(false);
      setAdjustmentAmount('');
      setAdjustmentReason('');
      
      // Reload shift data
      const updatedShift = await registerService.getShift(company.id, currentShift.id);
      setCurrentShift(updatedShift);
    } catch (error: any) {
      console.error('Error performing cash drop:', error);
      alert(error.message || 'Failed to perform cash drop');
    }
  };

  const handleAdjustment = async () => {
    if (!company?.id || !currentShift?.id || !currentUser?.uid) return;
    
    const amount = parseFloat(adjustmentAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    
    try {
      await registerService.recordCashAdjustment(
        company.id,
        currentShift.id,
        {
          type: adjustmentType,
          amount,
          reason: adjustmentReason,
          authorizedBy: user.uid,
          performedBy: user.uid,
        }
      );
      
      setAdjustmentDialog(false);
      setAdjustmentAmount('');
      setAdjustmentReason('');
      
      // Reload shift data
      const updatedShift = await registerService.getShift(company.id, currentShift.id);
      setCurrentShift(updatedShift);
    } catch (error: any) {
      console.error('Error recording adjustment:', error);
      alert(error.message || 'Failed to record adjustment');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-EG', {
      style: 'currency',
      currency: 'EGP',
    }).format(amount);
  };

  const getVarianceColor = (variance: number) => {
    if (Math.abs(variance) < 0.01) return 'success';
    if (Math.abs(variance) < 10) return 'warning';
    return 'error';
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {isArabic ? 'حدث خطأ: ' : 'Error: '}{error}
        </Alert>
        <Button 
          variant="contained" 
          onClick={() => {
            setError(null);
            loadInitialData();
          }}
        >
          {isArabic ? 'إعادة المحاولة' : 'Retry'}
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          الوردية النقدية
        </Typography>
        <Typography variant="body2" color="text.secondary">
          إدارة الورديات والمعاملات النقدية
        </Typography>
      </Box>

      {/* Shift Status Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={2}>
              <PointOfSale fontSize="large" color={currentShift ? 'success' : 'disabled'} />
              <Box>
                <Typography variant="h6">
                  {currentShift ? 'الوردية نشطة' : 'لا توجد وردية نشطة'}
                </Typography>
                {currentShift && (
                  <>
                    <Typography variant="body2" color="text.secondary">
                      <Person fontSize="small" sx={{ verticalAlign: 'middle', mr: isArabic ? 0 : 0.5, ml: isArabic ? 0.5 : 0 }} />
                      {currentShift.employeeName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      <Timer fontSize="small" sx={{ verticalAlign: 'middle', mr: isArabic ? 0 : 0.5, ml: isArabic ? 0.5 : 0 }} />
                      بدأت {format(currentShift.openedAt.toDate(), 'h:mm a')}
                    </Typography>
                  </>
                )}
              </Box>
            </Box>
            
            <Box display="flex" gap={1}>
              {!currentShift ? (
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={isArabic ? null : <PlayArrow />}
                  endIcon={isArabic ? <PlayArrow /> : null}
                  onClick={() => {
                    loadInitialData(); // Reload accounts when opening dialog
                    setOpenShiftDialog(true);
                  }}
                >
                  فتح وردية
                </Button>
              ) : (
                <>
                  <Button
                    variant="outlined"
                    color="warning"
                    startIcon={isArabic ? null : <ArrowDownward />}
                    endIcon={isArabic ? <ArrowDownward /> : null}
                    onClick={() => setCashDropDialog(true)}
                  >
                    إيداع نقدي
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={isArabic ? null : <AttachMoney />}
                    endIcon={isArabic ? <AttachMoney /> : null}
                    onClick={() => setAdjustmentDialog(true)}
                  >
                    تعديل
                  </Button>
                  <Button
                    variant="contained"
                    color="error"
                    startIcon={isArabic ? null : <Stop />}
                    endIcon={isArabic ? <Stop /> : null}
                    onClick={() => setCloseShiftDialog(true)}
                  >
                    إغلاق الوردية
                  </Button>
                </>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>

      {currentShift && (
        <>
          {/* Summary Cards */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 3 }}>
            <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)', md: '1 1 calc(25% - 18px)' } }}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    {isArabic ? 'النقد الافتتاحي' : 'Opening Cash'}
                  </Typography>
                  <Typography variant="h5">
                    {formatCurrency(currentShift.openingCashTotal)}
                  </Typography>
                </CardContent>
              </Card>
            </Box>
            
            <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)', md: '1 1 calc(25% - 18px)' } }}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    {isArabic ? 'إجمالي المبيعات' : 'Total Sales'}
                  </Typography>
                  <Typography variant="h5" color="success.main">
                    {formatCurrency(currentShift.totalSales)}
                  </Typography>
                </CardContent>
              </Card>
            </Box>
            
            <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)', md: '1 1 calc(25% - 18px)' } }}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    {isArabic ? 'الإيداعات النقدية' : 'Cash Drops'}
                  </Typography>
                  <Typography variant="h5" color="warning.main">
                    {formatCurrency(currentShift.totalCashDrops)}
                  </Typography>
                </CardContent>
              </Card>
            </Box>
            
            <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)', md: '1 1 calc(25% - 18px)' } }}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    {isArabic ? 'النقد الحالي' : 'Current Cash'}
                  </Typography>
                  <Typography variant="h5" color="primary.main">
                    {formatCurrency(currentShift.netCashFlow)}
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          </Box>

          {/* Tabs */}
          <Paper sx={{ width: '100%' }}>
            <Tabs
              value={activeTab}
              onChange={(e, newValue) => setActiveTab(newValue)}
              indicatorColor="primary"
              textColor="primary"
            >
              <Tab label={isArabic ? 'المعاملات الأخيرة' : 'Recent Transactions'} />
              <Tab label={isArabic ? 'تفاصيل الوردية' : 'Shift Details'} />
              <Tab label={isArabic ? 'حركات النقد' : 'Cash Movements'} />
            </Tabs>

            <TabPanel value={activeTab} index={0}>
              <List>
                {recentTransactions.length === 0 ? (
                  <ListItem>
                    <ListItemText 
                      primary="No transactions yet"
                      secondary="Transactions will appear here as they are processed"
                    />
                  </ListItem>
                ) : (
                  recentTransactions.map((transaction) => (
                    <React.Fragment key={transaction.id}>
                      <ListItem>
                        <ListItemText
                          primary={
                            <Box display="flex" alignItems="center" gap={1}>
                              {transaction.type === 'sale' && <AddCircleOutline color="success" />}
                              {transaction.type === 'refund' && <RemoveCircleOutline color="error" />}
                              {transaction.type === 'pay_in' && <ArrowUpward color="primary" />}
                              {transaction.type === 'pay_out' && <ArrowDownward color="warning" />}
                              <Typography>
                                {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                              </Typography>
                              {transaction.isVoided && (
                                <Chip label="VOID" size="small" color="error" />
                              )}
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                {format(transaction.timestamp.toDate(), 'h:mm a')}
                                {transaction.customerName && ` • ${transaction.customerName}`}
                              </Typography>
                              {transaction.notes && (
                                <Typography variant="body2" color="text.secondary">
                                  {transaction.notes}
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                        <ListItemSecondaryAction>
                          <Typography variant="h6" color={transaction.type === 'refund' || transaction.type === 'pay_out' ? 'error' : 'success'}>
                            {transaction.type === 'refund' || transaction.type === 'pay_out' ? '-' : '+'}
                            {formatCurrency(transaction.totalAmount)}
                          </Typography>
                        </ListItemSecondaryAction>
                      </ListItem>
                      <Divider />
                    </React.Fragment>
                  ))
                )}
              </List>
            </TabPanel>

            <TabPanel value={activeTab} index={1}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 calc(50% - 8px)' } }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Shift Information
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    <Typography>Register: {currentShift.registerId}</Typography>
                    <Typography>Employee: {currentShift.employeeName}</Typography>
                    <Typography>
                      Started: {format(currentShift.openedAt.toDate(), 'PPp')}
                    </Typography>
                    {currentShift.openingNotes && (
                      <Typography>Notes: {currentShift.openingNotes}</Typography>
                    )}
                  </Box>
                </Box>
                
                <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 calc(50% - 8px)' } }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Financial Summary
                  </Typography>
                  <Box>
                    <Typography>Opening Cash: {formatCurrency(currentShift.openingCashTotal)}</Typography>
                    <Typography>+ Sales: {formatCurrency(currentShift.totalSales)}</Typography>
                    <Typography>- Refunds: {formatCurrency(currentShift.totalRefunds)}</Typography>
                    <Typography>+ Pay Ins: {formatCurrency(currentShift.totalPayIns)}</Typography>
                    <Typography>- Pay Outs: {formatCurrency(currentShift.totalPayOuts)}</Typography>
                    <Typography>- Cash Drops: {formatCurrency(currentShift.totalCashDrops)}</Typography>
                    <Divider sx={{ my: 1 }} />
                    <Typography variant="h6">
                      Expected Cash: {formatCurrency(currentShift.netCashFlow)}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </TabPanel>

            <TabPanel value={activeTab} index={2}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Cash Movement History
              </Typography>
              <List>
                <ListItem>
                  <ListItemText
                    primary="Opening Balance"
                    secondary={format(currentShift.openedAt.toDate(), 'h:mm a')}
                  />
                  <ListItemSecondaryAction>
                    <Typography variant="h6">
                      {formatCurrency(currentShift.openingCashTotal)}
                    </Typography>
                  </ListItemSecondaryAction>
                </ListItem>
                {/* TODO: Load and display cash drops and adjustments */}
              </List>
            </TabPanel>
          </Paper>
        </>
      )}

      {/* Open Shift Dialog */}
      <Dialog open={openShiftDialog} onClose={() => setOpenShiftDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>{isArabic ? 'فتح وردية جديدة' : 'Open New Shift'}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              {isArabic ? 'عد النقد الافتتاحي' : 'Count Opening Cash'}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {isArabic ? 'من فضلك قم بعد جميع النقود في الصندوق وأدخل الكميات أدناه' : 'Please count all cash in the register and enter the quantities below'}
            </Typography>
            
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" gutterBottom>{isArabic ? 'الأوراق النقدية' : 'Bills'}</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {Object.keys(openingCash.bills).map((denom) => (
                  <Box key={denom} sx={{ width: { xs: 'calc(50% - 8px)', sm: 'calc(33.333% - 10.667px)', md: 'calc(25% - 12px)' } }}>
                    <TextField
                      fullWidth
                      label={`${denom} ${isArabic ? 'جنيه' : 'EGP'}`}
                      type="number"
                      value={openingCash.bills[parseFloat(denom)] || ''}
                      onChange={(e) => handleDenominationChange('opening', 'bills', denom, e.target.value)}
                      InputProps={{ inputProps: { min: 0 } }}
                    />
                  </Box>
                ))}
              </Box>
              
              <Typography variant="subtitle2" gutterBottom sx={{ mt: 3 }}>
                {isArabic ? 'العملات المعدنية' : 'Coins'}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {Object.keys(openingCash.coins).map((denom) => (
                  <Box key={denom} sx={{ width: { xs: 'calc(50% - 8px)', sm: 'calc(33.333% - 10.667px)', md: 'calc(25% - 12px)' } }}>
                    <TextField
                      fullWidth
                      label={`${denom} ${isArabic ? 'جنيه' : 'EGP'}`}
                      type="number"
                      value={openingCash.coins[parseFloat(denom)] || ''}
                      onChange={(e) => handleDenominationChange('opening', 'coins', denom, e.target.value)}
                      InputProps={{ inputProps: { min: 0 } }}
                    />
                  </Box>
                ))}
              </Box>
              
              <Box sx={{ mt: 3, p: 2, bgcolor: 'primary.main', color: 'white', borderRadius: 1 }}>
                <Typography variant="h6">
                  {isArabic ? 'إجمالي النقد: ' : 'Cash Total: '}{formatCurrency(openingCash.total)}
                </Typography>
              </Box>
              
              {/* Financial Accounts */}
              <Box sx={{ mt: 3 }}>
                <Button 
                  variant="outlined"
                  onClick={() => setShowOtherAccounts(!showOtherAccounts)}
                  sx={{ mb: 2 }}
                >
                  {showOtherAccounts 
                    ? (isArabic ? 'إخفاء الحسابات المالية' : 'Hide Financial Accounts')
                    : (isArabic ? 'إضافة الحسابات المالية (المحافظ الرقمية، البنوك، إلخ)' : 'Add Financial Accounts (Digital Wallets, Banks, etc.)')}
                </Button>
                
                {showOtherAccounts && (
                  <Box>
                    {/* Cash Accounts */}
                    {cashAccounts.length > 0 && (
                      <>
                        <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                          {isArabic ? 'حسابات النقد' : 'Cash Accounts'}
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
                          {cashAccounts.map((account) => (
                            <Box key={account.id} sx={{ width: { xs: 'calc(50% - 8px)', sm: 'calc(33.333% - 10.667px)' } }}>
                              <TextField
                                fullWidth
                                label={isArabic ? account.nameAr || account.name : account.name}
                                type="number"
                                value={accountOpeningBalances[account.id!] ?? account.currentBalance}
                                onChange={(e) => setAccountOpeningBalances({
                                  ...accountOpeningBalances,
                                  [account.id!]: parseFloat(e.target.value) || 0
                                })}
                                helperText={`${isArabic ? 'الرصيد الحالي: ' : 'Current: '}${formatCurrency(account.currentBalance)}`}
                                InputProps={{ 
                                  startAdornment: isArabic ? 'جنيه' : 'EGP',
                                  inputProps: { min: 0, step: 0.01 }
                                }}
                              />
                            </Box>
                          ))}
                        </Box>
                      </>
                    )}
                    
                    {/* Digital Wallet Accounts */}
                    {digitalWalletAccounts.length > 0 && (
                      <>
                        <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                          {isArabic ? 'المحافظ الرقمية' : 'Digital Wallets'}
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
                          {digitalWalletAccounts.map((account) => (
                            <Box key={account.id} sx={{ width: { xs: 'calc(50% - 8px)', sm: 'calc(33.333% - 10.667px)' } }}>
                              <TextField
                                fullWidth
                                label={isArabic ? account.nameAr || account.name : account.name}
                                type="number"
                                value={accountOpeningBalances[account.id!] ?? account.currentBalance}
                                onChange={(e) => setAccountOpeningBalances({
                                  ...accountOpeningBalances,
                                  [account.id!]: parseFloat(e.target.value) || 0
                                })}
                                helperText={`${isArabic ? 'الرصيد الحالي: ' : 'Current: '}${formatCurrency(account.currentBalance)}`}
                                InputProps={{ 
                                  startAdornment: isArabic ? 'جنيه' : 'EGP',
                                  inputProps: { min: 0, step: 0.01 }
                                }}
                              />
                            </Box>
                          ))}
                        </Box>
                      </>
                    )}
                    
                    {/* Bank Accounts */}
                    {bankAccounts.length > 0 && (
                      <>
                        <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                          {isArabic ? 'الحسابات البنكية' : 'Bank Accounts'}
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
                          {bankAccounts.map((account) => (
                            <Box key={account.id} sx={{ width: { xs: 'calc(50% - 8px)', sm: 'calc(33.333% - 10.667px)' } }}>
                              <TextField
                                fullWidth
                                label={isArabic ? account.nameAr || account.name : account.name}
                                type="number"
                                value={accountOpeningBalances[account.id!] ?? account.currentBalance}
                                onChange={(e) => setAccountOpeningBalances({
                                  ...accountOpeningBalances,
                                  [account.id!]: parseFloat(e.target.value) || 0
                                })}
                                helperText={`${isArabic ? 'الرصيد الحالي: ' : 'Current: '}${formatCurrency(account.currentBalance)}`}
                                InputProps={{ 
                                  startAdornment: isArabic ? 'جنيه' : 'EGP',
                                  inputProps: { min: 0, step: 0.01 }
                                }}
                              />
                            </Box>
                          ))}
                        </Box>
                      </>
                    )}
                    
                    {/* No accounts message */}
                    {allAccounts.length === 0 && (
                      <Box>
                        <Alert severity="info" sx={{ mb: 2 }}>
                          {isArabic 
                            ? 'لا توجد حسابات مالية نشطة. يرجى إنشاء حسابات من صفحة المالية أولاً.'
                            : 'No active financial accounts found. Please create accounts from the Finance page first.'}
                        </Alert>
                        <Button 
                          variant="outlined" 
                          onClick={loadInitialData}
                          sx={{ mb: 2 }}
                        >
                          {isArabic ? 'إعادة تحميل الحسابات' : 'Reload Accounts'}
                        </Button>
                      </Box>
                    )}
                    
                    {/* Total for all accounts */}
                    {allAccounts.length > 0 && (
                      <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                        <Typography variant="body1">
                          {isArabic ? 'إجمالي الحسابات المالية: ' : 'Financial Accounts Total: '}
                          {formatCurrency(
                            Object.entries(accountOpeningBalances).reduce((sum, [id, val]) => {
                              return sum + (val || allAccounts.find(a => a.id === id)?.currentBalance || 0);
                            }, 0)
                          )}
                        </Typography>
                        <Typography variant="h6" sx={{ mt: 1 }}>
                          {isArabic ? 'الإجمالي الكلي: ' : 'Grand Total: '}
                          {formatCurrency(
                            openingCash.total + 
                            Object.entries(accountOpeningBalances).reduce((sum, [id, val]) => {
                              return sum + (val || allAccounts.find(a => a.id === id)?.currentBalance || 0);
                            }, 0)
                          )}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
              
              <TextField
                fullWidth
                label={isArabic ? 'ملاحظات (اختياري)' : 'Notes (Optional)'}
                multiline
                rows={2}
                value={shiftNotes}
                onChange={(e) => setShiftNotes(e.target.value)}
                sx={{ mt: 2 }}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenShiftDialog(false)}>{isArabic ? 'إلغاء' : 'Cancel'}</Button>
          <Button 
            onClick={handleOpenShift} 
            variant="contained" 
            disabled={
              openingCash.total <= 0 && 
              Object.entries(accountOpeningBalances).reduce((sum, [id, val]) => {
                return sum + (val || allAccounts.find(a => a.id === id)?.currentBalance || 0);
              }, 0) <= 0
            }
          >
            {isArabic ? 'فتح الوردية' : 'Open Shift'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Close Shift Dialog */}
      <Dialog open={closeShiftDialog} onClose={() => setCloseShiftDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>{isArabic ? 'إغلاق الوردية' : 'Close Shift'}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            {currentShift && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Expected Cash: {formatCurrency(currentShift.netCashFlow)}
              </Alert>
            )}
            
            <Typography variant="subtitle1" gutterBottom>
              Count Closing Cash
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Please count all cash in the register and enter the quantities below
            </Typography>
            
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" gutterBottom>Bills</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {Object.keys(closingCash.bills).map((denom) => (
                  <Box key={denom} sx={{ width: { xs: 'calc(50% - 8px)', sm: 'calc(33.333% - 10.667px)', md: 'calc(25% - 12px)' } }}>
                    <TextField
                      fullWidth
                      label={`${denom} EGP`}
                      type="number"
                      value={closingCash.bills[parseFloat(denom)] || ''}
                      onChange={(e) => handleDenominationChange('closing', 'bills', denom, e.target.value)}
                      InputProps={{ inputProps: { min: 0 } }}
                    />
                  </Box>
                ))}
              </Box>
              
              <Typography variant="subtitle2" gutterBottom sx={{ mt: 3 }}>
                Coins
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {Object.keys(closingCash.coins).map((denom) => (
                  <Box key={denom} sx={{ width: { xs: 'calc(50% - 8px)', sm: 'calc(33.333% - 10.667px)', md: 'calc(25% - 12px)' } }}>
                    <TextField
                      fullWidth
                      label={`${denom} EGP`}
                      type="number"
                      value={closingCash.coins[parseFloat(denom)] || ''}
                      onChange={(e) => handleDenominationChange('closing', 'coins', denom, e.target.value)}
                      InputProps={{ inputProps: { min: 0 } }}
                    />
                  </Box>
                ))}
              </Box>
              
              <Box sx={{ mt: 3, p: 2, bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="h6">
                  Actual: {formatCurrency(closingCash.total)}
                </Typography>
                {currentShift && (
                  <>
                    <Typography>
                      Expected: {formatCurrency(currentShift.netCashFlow)}
                    </Typography>
                    <Typography color={getVarianceColor(closingCash.total - currentShift.netCashFlow)}>
                      Variance: {formatCurrency(closingCash.total - currentShift.netCashFlow)}
                    </Typography>
                  </>
                )}
              </Box>
              
              <TextField
                fullWidth
                label="Closing Notes (Optional)"
                multiline
                rows={2}
                value={shiftNotes}
                onChange={(e) => setShiftNotes(e.target.value)}
                sx={{ mt: 2 }}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCloseShiftDialog(false)}>Cancel</Button>
          <Button onClick={handleCloseShift} variant="contained" color="error">
            Close Shift
          </Button>
        </DialogActions>
      </Dialog>

      {/* Cash Drop Dialog */}
      <Dialog open={cashDropDialog} onClose={() => setCashDropDialog(false)}>
        <DialogTitle>{isArabic ? 'إيداع نقدي' : 'Cash Drop'}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {isArabic ? 'نقل النقود الزائدة من الصندوق إلى الخزنة' : 'Move excess cash from register to safe'}
            </Typography>
            
            <TextField
              fullWidth
              label={isArabic ? 'المبلغ' : 'Amount'}
              type="number"
              value={adjustmentAmount}
              onChange={(e) => setAdjustmentAmount(e.target.value)}
              InputProps={{ 
                startAdornment: isArabic ? 'جنيه' : 'EGP',
                inputProps: { min: 0, step: 0.01 }
              }}
              sx={{ mt: 2 }}
            />
            
            <TextField
              fullWidth
              label={isArabic ? 'ملاحظات (اختياري)' : 'Notes (Optional)'}
              multiline
              rows={2}
              value={adjustmentReason}
              onChange={(e) => setAdjustmentReason(e.target.value)}
              sx={{ mt: 2 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCashDropDialog(false)}>{isArabic ? 'إلغاء' : 'Cancel'}</Button>
          <Button onClick={handleCashDrop} variant="contained" color="warning">
            {isArabic ? 'تنفيذ الإيداع' : 'Perform Drop'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Adjustment Dialog */}
      <Dialog open={adjustmentDialog} onClose={() => setAdjustmentDialog(false)}>
        <DialogTitle>{isArabic ? 'تعديل النقد' : 'Cash Adjustment'}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Button
                  fullWidth
                  variant={adjustmentType === 'pay_in' ? 'contained' : 'outlined'}
                  color="success"
                  onClick={() => setAdjustmentType('pay_in')}
                  startIcon={isArabic ? null : <AddCircleOutline />}
                  endIcon={isArabic ? <AddCircleOutline /> : null}
                >
                  {isArabic ? 'إضافة نقد' : 'Pay In'}
                </Button>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Button
                  fullWidth
                  variant={adjustmentType === 'pay_out' ? 'contained' : 'outlined'}
                  color="error"
                  onClick={() => setAdjustmentType('pay_out')}
                  startIcon={isArabic ? null : <RemoveCircleOutline />}
                  endIcon={isArabic ? <RemoveCircleOutline /> : null}
                >
                  {isArabic ? 'سحب نقد' : 'Pay Out'}
                </Button>
              </Box>
            </Box>
            
            <TextField
              fullWidth
              label={isArabic ? 'المبلغ' : 'Amount'}
              type="number"
              value={adjustmentAmount}
              onChange={(e) => setAdjustmentAmount(e.target.value)}
              InputProps={{ 
                startAdornment: isArabic ? 'جنيه' : 'EGP',
                inputProps: { min: 0, step: 0.01 }
              }}
              sx={{ mt: 2 }}
            />
            
            <TextField
              fullWidth
              label={isArabic ? 'السبب' : 'Reason'}
              value={adjustmentReason}
              onChange={(e) => setAdjustmentReason(e.target.value)}
              sx={{ mt: 2 }}
              required
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdjustmentDialog(false)}>{isArabic ? 'إلغاء' : 'Cancel'}</Button>
          <Button 
            onClick={handleAdjustment} 
            variant="contained" 
            color={adjustmentType === 'pay_in' ? 'success' : 'error'}
            disabled={!adjustmentAmount || !adjustmentReason}
          >
            {isArabic 
              ? (adjustmentType === 'pay_in' ? 'تسجيل الإضافة' : 'تسجيل السحب')
              : `Record ${adjustmentType === 'pay_in' ? 'Pay In' : 'Pay Out'}`}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default CashRegisterPage;