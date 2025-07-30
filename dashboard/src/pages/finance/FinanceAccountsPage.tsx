import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
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
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Menu,
  ListItemIcon,
  Alert,
} from '@mui/material';
import {
  Add,
  AccountBalance,
  Payment,
  CreditCard,
  AccountBalanceWallet,
  LocalAtm,
  Edit,
  Delete,
  MoreVert,
  TrendingUp,
  TrendingDown,
  SwapHoriz,
  Phone,
  QrCode2,
  Warning,
  Check,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { useBranch } from '../../contexts/BranchContext';
import { financeService } from '../../services/finance.service';
import type { 
  FinancialAccount, 
  AccountType, 
  DigitalWalletType,
  AccountSummary 
} from '../../types/finance.types';
import { Timestamp } from 'firebase/firestore';
import { toast } from 'react-toastify';

// Digital wallet configurations
const digitalWalletConfigs: Record<DigitalWalletType, {
  name: string;
  nameAr: string;
  icon: string;
  color: string;
}> = {
  instapay: { name: 'InstaPay', nameAr: 'انستا باي', icon: '💳', color: '#FF6B00' },
  vodafone_cash: { name: 'Vodafone Cash', nameAr: 'فودافون كاش', icon: '📱', color: '#E60000' },
  orange_cash: { name: 'Orange Cash', nameAr: 'أورانج كاش', icon: '📱', color: '#FF6900' },
  etisalat_cash: { name: 'Etisalat Cash', nameAr: 'اتصالات كاش', icon: '📱', color: '#00A650' },
  fawry: { name: 'Fawry', nameAr: 'فوري', icon: '💰', color: '#FDB813' },
  we_pay: { name: 'WE Pay', nameAr: 'وي باي', icon: '📱', color: '#6A1B9A' },
  halan: { name: 'Halan', nameAr: 'هالة', icon: '💳', color: '#00BCD4' },
  bm_wallet: { name: 'BM Wallet', nameAr: 'محفظة بنك مصر', icon: '🏦', color: '#003F7F' },
  shahry: { name: 'Shahry', nameAr: 'شهري', icon: '🏦', color: '#006847' },
  phone_cash: { name: 'Phone Cash', nameAr: 'فون كاش', icon: '📱', color: '#1B5E20' },
  meeza: { name: 'Meeza', nameAr: 'ميزة', icon: '💳', color: '#ED1C24' },
  other: { name: 'Other', nameAr: 'أخرى', icon: '💳', color: '#757575' },
};

const FinanceAccountsPage: React.FC = () => {
  const theme = useTheme();
  const { currentUser } = useAuth();
  const { currentBranch } = useBranch();
  const isRTL = theme.direction === 'rtl';

  // State
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [accountSummaries, setAccountSummaries] = useState<Map<string, AccountSummary>>(new Map());
  const [selectedTab, setSelectedTab] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FinancialAccount | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedAccount, setSelectedAccount] = useState<FinancialAccount | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    nameAr: '',
    type: 'cash' as AccountType,
    digitalWalletType: 'vodafone_cash' as DigitalWalletType,
    phoneNumber: '',
    accountNumber: '',
    merchantCode: '',
    bankName: '',
    bankAccountNumber: '',
    iban: '',
    openingBalance: 0,
    openingDate: new Date(),
    isDefault: false,
    allowNegativeBalance: false,
    lowBalanceThreshold: 0,
  });

  // Load accounts
  useEffect(() => {
    if (currentUser?.companyId) {
      loadAccounts();
    }
  }, [currentUser?.companyId, currentBranch?.id]);

  const loadAccounts = async () => {
    if (!currentUser?.companyId) return;

    try {
      setLoading(true);
      const filters = currentBranch?.id ? { branchId: currentBranch.id } : undefined;
      const accountsData = await financeService.getAccounts(currentUser.companyId, filters);
      setAccounts(accountsData);

      // Load summaries for each account
      const summaries = new Map<string, AccountSummary>();
      for (const account of accountsData) {
        if (account.id) {
          const summary = await financeService.getAccountSummary(
            currentUser.companyId,
            account.id
          );
          if (summary) {
            summaries.set(account.id, summary);
          }
        }
      }
      setAccountSummaries(summaries);
    } catch (error) {
      console.error('Error loading accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get filtered accounts by type
  const getFilteredAccounts = () => {
    switch (selectedTab) {
      case 0: // All
        return accounts;
      case 1: // Cash
        return accounts.filter(a => a.type === 'cash' || a.type === 'petty_cash');
      case 2: // Bank
        return accounts.filter(a => a.type === 'bank');
      case 3: // Digital Wallets
        return accounts.filter(a => a.type === 'digital_wallet');
      case 4: // Credit Cards
        return accounts.filter(a => a.type === 'credit_card');
      default:
        return accounts;
    }
  };

  // Handlers
  const handleOpenDialog = (account?: FinancialAccount) => {
    if (account) {
      setEditingAccount(account);
      setFormData({
        name: account.name,
        nameAr: account.nameAr,
        type: account.type,
        digitalWalletType: account.digitalWalletType || 'vodafone_cash',
        phoneNumber: account.digitalWalletDetails?.phoneNumber || '',
        accountNumber: account.digitalWalletDetails?.accountId || '',
        merchantCode: account.digitalWalletDetails?.merchantCode || '',
        bankName: account.bankDetails?.bankName || '',
        bankAccountNumber: account.bankDetails?.accountNumber || '',
        iban: account.bankDetails?.iban || '',
        openingBalance: account.openingBalance,
        openingDate: account.openingDate.toDate(),
        isDefault: account.isDefault,
        allowNegativeBalance: account.allowNegativeBalance,
        lowBalanceThreshold: account.lowBalanceThreshold || 0,
      });
    } else {
      setEditingAccount(null);
      setFormData({
        name: '',
        nameAr: '',
        type: 'cash',
        digitalWalletType: 'vodafone_cash',
        phoneNumber: '',
        accountNumber: '',
        merchantCode: '',
        bankName: '',
        bankAccountNumber: '',
        iban: '',
        openingBalance: 0,
        openingDate: new Date(),
        isDefault: false,
        allowNegativeBalance: false,
        lowBalanceThreshold: 0,
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingAccount(null);
  };

  const handleSaveAccount = async () => {
    if (!currentUser?.companyId || saving) return;

    try {
      setSaving(true);
      const accountData: Omit<FinancialAccount, 'id' | 'createdAt' | 'updatedAt'> = {
        companyId: currentUser.companyId,
        branchId: currentBranch?.id,
        name: formData.name,
        nameAr: formData.nameAr,
        type: formData.type,
        currentBalance: formData.openingBalance,
        openingBalance: formData.openingBalance,
        openingDate: Timestamp.fromDate(formData.openingDate),
        isDefault: formData.isDefault,
        allowNegativeBalance: formData.allowNegativeBalance,
        lowBalanceThreshold: formData.lowBalanceThreshold,
        status: 'active',
        createdBy: currentUser.uid,
      };

      // Add type-specific details
      if (formData.type === 'digital_wallet') {
        accountData.digitalWalletType = formData.digitalWalletType;
        accountData.digitalWalletDetails = {
          phoneNumber: formData.phoneNumber,
          accountId: formData.accountNumber,
          merchantCode: formData.merchantCode,
        };
      } else if (formData.type === 'bank') {
        accountData.bankDetails = {
          bankName: formData.bankName,
          accountNumber: formData.bankAccountNumber,
          iban: formData.iban,
        };
      }

      if (editingAccount?.id) {
        await financeService.updateAccount(
          currentUser.companyId,
          editingAccount.id,
          accountData
        );
        toast.success(isRTL ? 'تم تحديث الحساب بنجاح' : 'Account updated successfully');
      } else {
        await financeService.createAccount(accountData);
        toast.success(isRTL ? 'تم إنشاء الحساب بنجاح' : 'Account created successfully');
      }

      handleCloseDialog();
      loadAccounts();
    } catch (error) {
      console.error('Error saving account:', error);
      toast.error(isRTL ? 'خطأ في حفظ الحساب' : 'Error saving account');
    } finally {
      setSaving(false);
    }
  };

  // Account icon helper
  const getAccountIcon = (account: FinancialAccount) => {
    switch (account.type) {
      case 'cash':
      case 'petty_cash':
        return <LocalAtm />;
      case 'bank':
        return <AccountBalance />;
      case 'credit_card':
        return <CreditCard />;
      case 'digital_wallet':
        return <AccountBalanceWallet />;
      default:
        return <Payment />;
    }
  };

  // Account card component
  const AccountCard: React.FC<{ account: FinancialAccount }> = ({ account }) => {
    const summary = account.id ? accountSummaries.get(account.id) : null;
    const isDigitalWallet = account.type === 'digital_wallet';
    const walletConfig = isDigitalWallet && account.digitalWalletType
      ? digitalWalletConfigs[account.digitalWalletType]
      : null;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card
          sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            '&:hover': { boxShadow: theme.shadows[4] },
          }}
        >
          <CardContent sx={{ flexGrow: 1 }}>
            {/* Header */}
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Avatar
                  sx={{
                    bgcolor: walletConfig ? walletConfig.color : theme.palette.primary.main,
                    width: 48,
                    height: 48,
                  }}
                >
                  {isDigitalWallet && walletConfig ? (
                    <span style={{ fontSize: 24 }}>{walletConfig.icon}</span>
                  ) : (
                    getAccountIcon(account)
                  )}
                </Avatar>
                <Box>
                  <Typography variant="h6">
                    {isRTL ? account.nameAr : account.name}
                  </Typography>
                  {isDigitalWallet && walletConfig && (
                    <Typography variant="body2" color="text.secondary">
                      {isRTL ? walletConfig.nameAr : walletConfig.name}
                    </Typography>
                  )}
                  {account.isDefault && (
                    <Chip
                      label={isRTL ? 'افتراضي' : 'Default'}
                      size="small"
                      color="primary"
                      sx={{ mt: 0.5 }}
                    />
                  )}
                </Box>
              </Stack>
              <IconButton
                size="small"
                onClick={(e) => {
                  setAnchorEl(e.currentTarget);
                  setSelectedAccount(account);
                }}
              >
                <MoreVert />
              </IconButton>
            </Stack>

            {/* Balance */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {isRTL ? 'الرصيد الحالي' : 'Current Balance'}
              </Typography>
              <Typography
                variant="h4"
                color={account.currentBalance >= 0 ? 'success.main' : 'error.main'}
              >
                {account.currentBalance.toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
              </Typography>
            </Box>

            {/* Account Details */}
            {isDigitalWallet && account.digitalWalletDetails && (
              <Stack spacing={1} sx={{ mb: 2 }}>
                {account.digitalWalletDetails.phoneNumber && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Phone fontSize="small" color="action" />
                    <Typography variant="body2">
                      {account.digitalWalletDetails.phoneNumber}
                    </Typography>
                  </Stack>
                )}
                {account.digitalWalletDetails.merchantCode && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <QrCode2 fontSize="small" color="action" />
                    <Typography variant="body2">
                      {account.digitalWalletDetails.merchantCode}
                    </Typography>
                  </Stack>
                )}
              </Stack>
            )}

            {account.type === 'bank' && account.bankDetails && (
              <Stack spacing={1} sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  {account.bankDetails.bankName}
                </Typography>
                {account.bankDetails.accountNumber && (
                  <Typography variant="body2">
                    {isRTL ? 'رقم الحساب: ' : 'Account: '}{account.bankDetails.accountNumber}
                  </Typography>
                )}
              </Stack>
            )}

            {/* Summary Stats */}
            {summary && (
              <Stack spacing={1}>
                <Divider />
                <Stack direction="row" justifyContent="space-between">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TrendingUp fontSize="small" color="success" />
                    <Typography variant="body2" color="text.secondary">
                      {isRTL ? 'الإيرادات' : 'Income'}
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="success.main">
                    +{summary.periodIncome.toLocaleString()}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TrendingDown fontSize="small" color="error" />
                    <Typography variant="body2" color="text.secondary">
                      {isRTL ? 'المصروفات' : 'Expenses'}
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="error.main">
                    -{summary.periodExpenses.toLocaleString()}
                  </Typography>
                </Stack>
              </Stack>
            )}

            {/* Low Balance Warning */}
            {account.lowBalanceThreshold && account.currentBalance <= account.lowBalanceThreshold && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                {isRTL ? 'الرصيد منخفض' : 'Low balance'}
              </Alert>
            )}
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  return (
    <Container maxWidth="xl">
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h4" component="h1">
            {isRTL ? 'الحسابات المالية' : 'Financial Accounts'}
          </Typography>
          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              startIcon={<SwapHoriz />}
              onClick={() => {
                // TODO: Navigate to transfers page
              }}
            >
              {isRTL ? 'التحويلات' : 'Transfers'}
            </Button>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => handleOpenDialog()}
            >
              {isRTL ? 'إضافة حساب' : 'Add Account'}
            </Button>
          </Stack>
        </Stack>

        {/* Tabs */}
        <Tabs value={selectedTab} onChange={(_, newValue) => setSelectedTab(newValue)}>
          <Tab label={isRTL ? 'الكل' : 'All'} />
          <Tab label={isRTL ? 'النقدية' : 'Cash'} />
          <Tab label={isRTL ? 'البنوك' : 'Banks'} />
          <Tab label={isRTL ? 'المحافظ الرقمية' : 'Digital Wallets'} />
          <Tab label={isRTL ? 'بطاقات الائتمان' : 'Credit Cards'} />
        </Tabs>
      </Box>

      {/* Content */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : getFilteredAccounts().length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <AccountBalance sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {isRTL ? 'لا توجد حسابات' : 'No accounts found'}
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => handleOpenDialog()}
            sx={{ mt: 2 }}
          >
            {isRTL ? 'إضافة أول حساب' : 'Add First Account'}
          </Button>
        </Box>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(3, 1fr)',
            },
            gap: 3,
          }}
        >
          {getFilteredAccounts().map((account) => (
            <AccountCard key={account.id} account={account} />
          ))}
        </Box>
      )}

      {/* Add/Edit Dialog */}
      <Dialog 
        open={dialogOpen} 
        onClose={handleCloseDialog} 
        maxWidth="sm" 
        fullWidth
        disableEnforceFocus
        disableAutoFocus={false}
      >
        <DialogTitle>
          {editingAccount
            ? (isRTL ? 'تعديل الحساب' : 'Edit Account')
            : (isRTL ? 'إضافة حساب جديد' : 'Add New Account')}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {/* Account Type */}
            <FormControl fullWidth>
              <InputLabel>{isRTL ? 'نوع الحساب' : 'Account Type'}</InputLabel>
              <Select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as AccountType })}
                label={isRTL ? 'نوع الحساب' : 'Account Type'}
                disabled={!!editingAccount}
              >
                <MenuItem value="cash">{isRTL ? 'نقدي' : 'Cash'}</MenuItem>
                <MenuItem value="bank">{isRTL ? 'بنك' : 'Bank'}</MenuItem>
                <MenuItem value="digital_wallet">{isRTL ? 'محفظة رقمية' : 'Digital Wallet'}</MenuItem>
                <MenuItem value="credit_card">{isRTL ? 'بطاقة ائتمان' : 'Credit Card'}</MenuItem>
                <MenuItem value="petty_cash">{isRTL ? 'مصروفات نثرية' : 'Petty Cash'}</MenuItem>
              </Select>
            </FormControl>

            {/* Digital Wallet Type */}
            {formData.type === 'digital_wallet' && (
              <FormControl fullWidth>
                <InputLabel>{isRTL ? 'نوع المحفظة' : 'Wallet Type'}</InputLabel>
                <Select
                  value={formData.digitalWalletType}
                  onChange={(e) => setFormData({ ...formData, digitalWalletType: e.target.value as DigitalWalletType })}
                  label={isRTL ? 'نوع المحفظة' : 'Wallet Type'}
                >
                  {Object.entries(digitalWalletConfigs).map(([key, config]) => (
                    <MenuItem key={key} value={key}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <span>{config.icon}</span>
                        <span>{isRTL ? config.nameAr : config.name}</span>
                      </Stack>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {/* Account Name */}
            <TextField
              fullWidth
              label={isRTL ? 'اسم الحساب' : 'Account Name'}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <TextField
              fullWidth
              label={isRTL ? 'اسم الحساب (عربي)' : 'Account Name (Arabic)'}
              value={formData.nameAr}
              onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
              required
            />

            {/* Digital Wallet Fields */}
            {formData.type === 'digital_wallet' && (
              <>
                <TextField
                  fullWidth
                  label={isRTL ? 'رقم الهاتف' : 'Phone Number'}
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">+20</InputAdornment>,
                  }}
                />
                <TextField
                  fullWidth
                  label={isRTL ? 'رقم الحساب/المحفظة' : 'Account/Wallet Number'}
                  value={formData.accountNumber}
                  onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                />
                <TextField
                  fullWidth
                  label={isRTL ? 'كود التاجر' : 'Merchant Code'}
                  value={formData.merchantCode}
                  onChange={(e) => setFormData({ ...formData, merchantCode: e.target.value })}
                  helperText={isRTL ? 'اختياري - للحسابات التجارية' : 'Optional - For business accounts'}
                />
              </>
            )}

            {/* Bank Fields */}
            {formData.type === 'bank' && (
              <>
                <TextField
                  fullWidth
                  label={isRTL ? 'اسم البنك' : 'Bank Name'}
                  value={formData.bankName}
                  onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                  required
                />
                <TextField
                  fullWidth
                  label={isRTL ? 'رقم الحساب' : 'Account Number'}
                  value={formData.bankAccountNumber}
                  onChange={(e) => setFormData({ ...formData, bankAccountNumber: e.target.value })}
                  required
                />
                <TextField
                  fullWidth
                  label={isRTL ? 'IBAN' : 'IBAN'}
                  value={formData.iban}
                  onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                />
              </>
            )}

            {/* Opening Balance */}
            {!editingAccount && (
              <>
                <TextField
                  fullWidth
                  type="number"
                  label={isRTL ? 'الرصيد الافتتاحي' : 'Opening Balance'}
                  value={formData.openingBalance}
                  onChange={(e) => setFormData({ ...formData, openingBalance: parseFloat(e.target.value) || 0 })}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">{isRTL ? 'ج.م' : 'EGP'}</InputAdornment>,
                  }}
                />
                <TextField
                  fullWidth
                  type="date"
                  label={isRTL ? 'تاريخ الافتتاح' : 'Opening Date'}
                  value={formData.openingDate.toISOString().split('T')[0]}
                  onChange={(e) => setFormData({ ...formData, openingDate: new Date(e.target.value) })}
                  InputLabelProps={{ shrink: true }}
                />
              </>
            )}

            {/* Settings */}
            <TextField
              fullWidth
              type="number"
              label={isRTL ? 'حد الرصيد المنخفض' : 'Low Balance Threshold'}
              value={formData.lowBalanceThreshold}
              onChange={(e) => setFormData({ ...formData, lowBalanceThreshold: parseFloat(e.target.value) || 0 })}
              InputProps={{
                endAdornment: <InputAdornment position="end">{isRTL ? 'ج.م' : 'EGP'}</InputAdornment>,
              }}
              helperText={isRTL ? 'سيتم التنبيه عند انخفاض الرصيد' : 'Alert when balance falls below'}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={saving}>
            {isRTL ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button 
            onClick={handleSaveAccount} 
            variant="contained"
            disabled={saving}
            startIcon={saving ? <CircularProgress size={20} /> : null}
          >
            {saving 
              ? (isRTL ? 'جاري الحفظ...' : 'Saving...') 
              : editingAccount 
                ? (isRTL ? 'حفظ' : 'Save') 
                : (isRTL ? 'إضافة' : 'Add')
            }
          </Button>
        </DialogActions>
      </Dialog>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => {
          setAnchorEl(null);
          setSelectedAccount(null);
        }}
      >
        <MenuItem
          onClick={() => {
            if (selectedAccount) {
              handleOpenDialog(selectedAccount);
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
            // TODO: Navigate to account transactions
            setAnchorEl(null);
          }}
        >
          <ListItemIcon>
            <Payment fontSize="small" />
          </ListItemIcon>
          <ListItemText>{isRTL ? 'المعاملات' : 'Transactions'}</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            // TODO: Implement account deletion/closing
            setAnchorEl(null);
          }}
          disabled
        >
          <ListItemIcon>
            <Delete fontSize="small" />
          </ListItemIcon>
          <ListItemText>{isRTL ? 'إغلاق الحساب' : 'Close Account'}</ListItemText>
        </MenuItem>
      </Menu>
    </Container>
  );
};

export default FinanceAccountsPage;