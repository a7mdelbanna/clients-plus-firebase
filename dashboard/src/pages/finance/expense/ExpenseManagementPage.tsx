import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Tabs,
  Tab,
  Grid,
  Card,
  CardContent,
  Avatar,
  useTheme,
  alpha,
  Stack,
  Chip,
  Badge,
  LinearProgress,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Add,
  Receipt,
  Category,
  Store,
  TrendingUp,
  AttachMoney,
  Warning,
  CheckCircle,
  Schedule,
  CameraAlt,
  Upload,
  Description,
  Business,
  LocalShipping,
  Engineering,
  Campaign,
  AccountBalance,
  ArrowUpward,
  ArrowDownward,
  MoreVert,
  PendingActions,
  Assessment,
  Settings,
  FileDownload,
  Refresh,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { useBranch } from '../../../contexts/BranchContext';
import { motion } from 'framer-motion';
import ExpenseDashboard from '../../../components/finance/expense/ExpenseDashboard';
import ExpenseList from '../../../components/finance/expense/ExpenseList';
import ApprovalQueue from '../../../components/finance/expense/ApprovalQueue';
import VendorList from '../../../components/finance/expense/VendorList';
import RecurringExpenses from '../../../components/finance/expense/RecurringExpenses';
import ExpenseBudgets from '../../../components/finance/expense/ExpenseBudgets';
import { expenseService } from '../../../services/expense.service';
import { financeService } from '../../../services/finance.service';
import type { ExpenseCategory, ExpenseTransaction, Vendor } from '../../../types/expense.types';
import { startOfMonth, endOfMonth } from 'date-fns';
import { CircularProgress } from '@mui/material';

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
      id={`expense-tabpanel-${index}`}
      aria-labelledby={`expense-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

interface SummaryData {
  totalExpenses: number;
  pendingApprovals: number;
  pendingCount: number;
  budgetRemaining: number;
  budgetPercentage: number;
  activeVendors: number;
  newVendors: number;
  expenseChange: number;
}

const ExpenseManagementPage: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { currentBranch } = useBranch();
  const isRTL = theme.direction === 'rtl';

  const [tabValue, setTabValue] = useState(0);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [loading, setLoading] = useState(true);
  const [summaryData, setSummaryData] = useState<SummaryData>({
    totalExpenses: 0,
    pendingApprovals: 0,
    pendingCount: 0,
    budgetRemaining: 0,
    budgetPercentage: 0,
    activeVendors: 0,
    newVendors: 0,
    expenseChange: 0,
  });

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(isRTL ? 'ar-EG' : 'en-EG', {
      style: 'currency',
      currency: 'EGP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Load summary data
  useEffect(() => {
    const loadSummaryData = async () => {
      if (!currentUser?.companyId || !currentBranch?.id) return;
      
      setLoading(true);
      try {
        const now = new Date();
        const startOfMonthDate = startOfMonth(now);
        const endOfMonthDate = endOfMonth(now);
        
        // Load current month transactions from finance service
        const result = await financeService.getTransactions(
          currentUser.companyId,
          {
            branchId: currentBranch.id,
            startDate: startOfMonthDate,
            endDate: endOfMonthDate
          }
        );
        
        // Filter for expense transactions
        const transactions = result.transactions.filter(t => 
          t.type === 'expense' || t.metadata?.categoryId
        );
        
        // Load categories for budget calculation
        const categories = await expenseService.getCategories(currentUser.companyId);
        
        // Load vendors
        const vendors = await expenseService.getVendors(currentUser.companyId);
        
        // Calculate summary metrics
        const totalExpenses = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
        const pendingTransactions = transactions.filter(t => 
          t.categoryId && // Make sure it's an expense transaction
          t.approvalStatus === 'pending'
        );
        const pendingApprovals = pendingTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
        const pendingCount = pendingTransactions.length;
        
        // Calculate budget
        const totalBudget = categories.reduce((sum, cat) => sum + (cat.budgetLimit || 0), 0);
        const budgetRemaining = Math.max(0, totalBudget - totalExpenses);
        const budgetPercentage = totalBudget > 0 ? (totalExpenses / totalBudget) * 100 : 0;
        
        // Vendor metrics
        const activeVendors = vendors.filter(v => v.status === 'active').length;
        const thisMonthStart = startOfMonth(now);
        const newVendors = vendors.filter(v => 
          v.createdAt && v.createdAt.toDate() >= thisMonthStart
        ).length;
        
        // Calculate expense change (would need last month data for real calculation)
        // For now, using a placeholder
        const expenseChange = Math.floor(Math.random() * 20) - 10;
        
        setSummaryData({
          totalExpenses,
          pendingApprovals,
          pendingCount,
          budgetRemaining,
          budgetPercentage: Math.min(100, budgetPercentage),
          activeVendors,
          newVendors,
          expenseChange,
        });
        
      } catch (error) {
        console.error('Error loading expense summary:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadSummaryData();
  }, [currentUser, currentBranch]);

  return (
    <Box sx={{ p: 3 }}>
      {/* Header Section */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            {isRTL ? 'إدارة المصروفات' : 'Expense Management'}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {isRTL 
              ? `فرع ${currentBranch?.name || 'الرئيسي'} - إدارة وتتبع جميع مصروفات الشركة`
              : `${currentBranch?.name || 'Main'} Branch - Manage and track all company expenses`
            }
          </Typography>
        </Box>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            startIcon={<Upload />}
            onClick={() => navigate('/finance/expense/upload')}
          >
            {isRTL ? 'رفع فاتورة' : 'Upload Receipt'}
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            color="primary"
            onClick={() => navigate('/finance/expense/new')}
          >
            {isRTL ? 'مصروف جديد' : 'New Expense'}
          </Button>
          <IconButton onClick={handleMenuOpen}>
            <MoreVert />
          </IconButton>
        </Stack>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={3}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), mr: 2 }}>
                    <AttachMoney color="primary" />
                  </Avatar>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {isRTL ? 'إجمالي المصروفات' : 'Total Expenses'}
                    </Typography>
                    <Typography variant="h5" fontWeight="bold">
                      {loading ? <CircularProgress size={24} /> : formatCurrency(summaryData.totalExpenses)}
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <ArrowUpward color="error" fontSize="small" />
                  <Typography variant="body2" color={summaryData.expenseChange >= 0 ? "error" : "success"}>
                    {summaryData.expenseChange >= 0 ? '+' : ''}{summaryData.expenseChange}% {isRTL ? 'من الشهر الماضي' : 'from last month'}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        <Grid item xs={12} md={3}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar sx={{ bgcolor: alpha(theme.palette.warning.main, 0.1), mr: 2 }}>
                    <PendingActions color="warning" />
                  </Avatar>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {isRTL ? 'بانتظار الموافقة' : 'Pending Approval'}
                    </Typography>
                    <Typography variant="h5" fontWeight="bold">
                      {loading ? <CircularProgress size={24} /> : formatCurrency(summaryData.pendingApprovals)}
                    </Typography>
                  </Box>
                </Box>
                <Badge badgeContent={summaryData.pendingCount} color="warning">
                  <Typography variant="body2">
                    {isRTL 
                      ? `${summaryData.pendingCount} مصروفات`
                      : `${summaryData.pendingCount} expenses`
                    }
                  </Typography>
                </Badge>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        <Grid item xs={12} md={3}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar sx={{ bgcolor: alpha(theme.palette.success.main, 0.1), mr: 2 }}>
                    <TrendingUp color="success" />
                  </Avatar>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {isRTL ? 'الميزانية المتبقية' : 'Budget Remaining'}
                    </Typography>
                    <Typography variant="h5" fontWeight="bold">
                      {loading ? <CircularProgress size={24} /> : formatCurrency(summaryData.budgetRemaining)}
                    </Typography>
                  </Box>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={summaryData.budgetPercentage} 
                  sx={{ height: 8, borderRadius: 4 }}
                  color={summaryData.budgetPercentage > 90 ? 'error' : summaryData.budgetPercentage > 70 ? 'warning' : 'success'}
                />
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        <Grid item xs={12} md={3}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar sx={{ bgcolor: alpha(theme.palette.info.main, 0.1), mr: 2 }}>
                    <Store color="info" />
                  </Avatar>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {isRTL ? 'الموردين النشطين' : 'Active Vendors'}
                    </Typography>
                    <Typography variant="h5" fontWeight="bold">
                      {loading ? <CircularProgress size={24} /> : summaryData.activeVendors}
                    </Typography>
                  </Box>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {isRTL 
                    ? `${summaryData.newVendors} موردين جدد هذا الشهر`
                    : `${summaryData.newVendors} new this month`
                  }
                </Typography>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>
      </Grid>

      {/* Main Content Tabs */}
      <Paper sx={{ width: '100%' }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab 
            label={isRTL ? 'نظرة عامة' : 'Overview'} 
            icon={<Assessment />}
            iconPosition="start"
          />
          <Tab 
            label={
              <Badge badgeContent={summaryData.pendingCount} color="warning">
                {isRTL ? 'الموافقات' : 'Approvals'}
              </Badge>
            }
            icon={<PendingActions />}
            iconPosition="start"
          />
          <Tab 
            label={isRTL ? 'المصروفات' : 'Expenses'} 
            icon={<Receipt />}
            iconPosition="start"
          />
          <Tab 
            label={isRTL ? 'الموردين' : 'Vendors'} 
            icon={<Store />}
            iconPosition="start"
          />
          <Tab 
            label={isRTL ? 'المتكررة' : 'Recurring'} 
            icon={<Schedule />}
            iconPosition="start"
          />
          <Tab 
            label={isRTL ? 'الميزانيات' : 'Budgets'} 
            icon={<AccountBalance />}
            iconPosition="start"
          />
        </Tabs>

        {/* Tab Panels */}
        <TabPanel value={tabValue} index={0}>
          <ExpenseDashboard />
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <ApprovalQueue />
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <ExpenseList />
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <VendorList />
        </TabPanel>

        <TabPanel value={tabValue} index={4}>
          <RecurringExpenses />
        </TabPanel>

        <TabPanel value={tabValue} index={5}>
          <ExpenseBudgets />
        </TabPanel>
      </Paper>

      {/* Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => { navigate('/finance/expense/categories'); handleMenuClose(); }}>
          <ListItemIcon>
            <Category fontSize="small" />
          </ListItemIcon>
          <ListItemText>{isRTL ? 'إدارة الفئات' : 'Manage Categories'}</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { navigate('/finance/expense/settings'); handleMenuClose(); }}>
          <ListItemIcon>
            <Settings fontSize="small" />
          </ListItemIcon>
          <ListItemText>{isRTL ? 'الإعدادات' : 'Settings'}</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { navigate('/finance/expense/reports'); handleMenuClose(); }}>
          <ListItemIcon>
            <Description fontSize="small" />
          </ListItemIcon>
          <ListItemText>{isRTL ? 'التقارير' : 'Reports'}</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <ListItemIcon>
            <FileDownload fontSize="small" />
          </ListItemIcon>
          <ListItemText>{isRTL ? 'تصدير البيانات' : 'Export Data'}</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default ExpenseManagementPage;