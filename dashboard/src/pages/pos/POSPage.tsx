import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  Card,
  CardContent,
  CardMedia,
  Stack,
  Chip,
  InputAdornment,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tab,
  Tabs,
  Alert,
  Badge,
  Drawer,
  useTheme,
  useMediaQuery,
  Autocomplete,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  Search,
  QrCodeScanner,
  Add,
  Remove,
  Delete,
  ShoppingCart,
  Payment,
  LocalOffer,
  Category,
  GridView,
  ViewList,
  FilterList,
  Clear,
  Receipt,
  Person,
  CreditCard,
  LocalAtm,
  AccountBalanceWallet,
  Calculate,
  Inventory2,
} from '@mui/icons-material';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { useBranch } from '../../contexts/BranchContext';
import { productService } from '../../services/product.service';
import { clientService } from '../../services/client.service';
import { financeService } from '../../services/finance.service';
import type { Product, ProductCategory } from '../../types/product.types';
import type { Client } from '../../types/client.types';
import type { PaymentMethod } from '../../types/finance.types';
import { Timestamp } from 'firebase/firestore';

interface CartItem {
  product: Product;
  quantity: number;
  price: number;
  discount: number;
  discountType: 'percentage' | 'fixed';
  subtotal: number;
}

interface PaymentDetails {
  method: PaymentMethod;
  amount: number;
  reference?: string;
}

const POSPage: React.FC = () => {
  const theme = useTheme();
  const { language, isRTL } = useLanguage();
  const { currentUser } = useAuth();
  const { currentBranch } = useBranch();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // State
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [payments, setPayments] = useState<PaymentDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [cartDrawer, setCartDrawer] = useState(false);
  const [barcodeDialog, setBarcodeDialog] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');

  // Load products and categories
  useEffect(() => {
    if (currentUser?.companyId && currentBranch?.id) {
      loadProducts();
      loadCategories();
      loadClients();
    }
  }, [currentUser?.companyId, currentBranch?.id]);

  const loadProducts = async () => {
    if (!currentUser?.companyId) return;
    
    try {
      const result = await productService.getProducts(currentUser.companyId, {
        status: 'active',
        branchId: currentBranch?.id,
      });
      setProducts(result.products);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const loadCategories = async () => {
    if (!currentUser?.companyId) return;
    
    try {
      const cats = await productService.getCategories(currentUser.companyId);
      setCategories(cats);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadClients = async () => {
    if (!currentUser?.companyId) return;
    
    try {
      const result = await clientService.getClients(currentUser.companyId, {
        limit: 1000,
      });
      setClients(result.clients);
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  // Filter products
  const filteredProducts = products.filter(product => {
    const matchesCategory = selectedCategory === 'all' || product.categoryId === selectedCategory;
    const matchesSearch = searchQuery === '' || 
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.nameAr?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.barcode?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesCategory && matchesSearch;
  });

  // Cart functions
  const addToCart = (product: Product) => {
    const existingItem = cart.find(item => item.product.id === product.id);
    
    if (existingItem) {
      updateQuantity(product.id!, existingItem.quantity + 1);
    } else {
      const newItem: CartItem = {
        product,
        quantity: 1,
        price: product.retailPrice,
        discount: 0,
        discountType: 'fixed',
        subtotal: product.retailPrice,
      };
      setCart([...cart, newItem]);
    }
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart(cart.map(item => {
      if (item.product.id === productId) {
        const subtotal = calculateItemSubtotal(item.price, quantity, item.discount, item.discountType);
        return { ...item, quantity, subtotal };
      }
      return item;
    }));
  };

  const updateDiscount = (productId: string, discount: number, discountType: 'percentage' | 'fixed') => {
    setCart(cart.map(item => {
      if (item.product.id === productId) {
        const subtotal = calculateItemSubtotal(item.price, item.quantity, discount, discountType);
        return { ...item, discount, discountType, subtotal };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setSelectedClient(null);
    setPayments([]);
  };

  const calculateItemSubtotal = (price: number, quantity: number, discount: number, discountType: 'percentage' | 'fixed') => {
    const total = price * quantity;
    if (discountType === 'percentage') {
      return total - (total * discount / 100);
    } else {
      return Math.max(0, total - discount);
    }
  };

  const calculateCartTotal = () => {
    return cart.reduce((total, item) => total + item.subtotal, 0);
  };

  const calculateTotalDiscount = () => {
    return cart.reduce((total, item) => {
      const originalPrice = item.price * item.quantity;
      return total + (originalPrice - item.subtotal);
    }, 0);
  };

  // Barcode handling
  const handleBarcodeScan = async () => {
    if (!barcodeInput) return;

    const product = products.find(p => p.barcode === barcodeInput);
    if (product) {
      addToCart(product);
      setBarcodeInput('');
      setBarcodeDialog(false);
    } else {
      alert(isRTL ? 'المنتج غير موجود' : 'Product not found');
    }
  };

  // Payment handling
  const handleCheckout = () => {
    if (cart.length === 0) {
      alert(isRTL ? 'السلة فارغة' : 'Cart is empty');
      return;
    }
    setPaymentDialog(true);
  };

  const addPayment = (method: PaymentMethod, amount: number, reference?: string) => {
    const payment: PaymentDetails = { method, amount, reference };
    setPayments([...payments, payment]);
  };

  const removePayment = (index: number) => {
    setPayments(payments.filter((_, i) => i !== index));
  };

  const getTotalPaid = () => {
    return payments.reduce((total, payment) => total + payment.amount, 0);
  };

  const getRemainingAmount = () => {
    return calculateCartTotal() - getTotalPaid();
  };

  const completeTransaction = async () => {
    if (!currentUser?.companyId || !currentBranch?.id) return;
    
    if (getRemainingAmount() > 0.01) {
      alert(isRTL ? 'المبلغ المدفوع غير كافي' : 'Insufficient payment amount');
      return;
    }

    setLoading(true);
    try {
      // TODO: Create sale transaction in finance service
      // TODO: Update inventory if tracking is enabled
      // TODO: Create receipt
      
      // For now, just clear the cart
      clearCart();
      setPaymentDialog(false);
      alert(isRTL ? 'تم إتمام البيع بنجاح' : 'Sale completed successfully');
    } catch (error) {
      console.error('Error completing transaction:', error);
      alert(isRTL ? 'خطأ في إتمام العملية' : 'Error completing transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth={false} sx={{ py: 3 }}>
      <Grid container spacing={3}>
        {/* Products Section */}
        <Grid item xs={12} md={isMobile ? 12 : 8}>
          <Paper sx={{ p: 2, height: '100%' }}>
            {/* Header */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="h5">
                {isRTL ? 'نقطة البيع' : 'Point of Sale'}
              </Typography>
              
              <Stack direction="row" spacing={1}>
                <ToggleButtonGroup
                  value={viewMode}
                  exclusive
                  onChange={(_, value) => value && setViewMode(value)}
                  size="small"
                >
                  <ToggleButton value="grid">
                    <GridView />
                  </ToggleButton>
                  <ToggleButton value="list">
                    <ViewList />
                  </ToggleButton>
                </ToggleButtonGroup>
                
                <IconButton onClick={() => setBarcodeDialog(true)}>
                  <QrCodeScanner />
                </IconButton>
              </Stack>
            </Stack>

            {/* Search Bar */}
            <TextField
              fullWidth
              placeholder={isRTL ? 'البحث عن منتج...' : 'Search for product...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
                endAdornment: searchQuery && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchQuery('')}>
                      <Clear />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            {/* Categories */}
            <Stack direction="row" spacing={1} sx={{ mb: 2, overflowX: 'auto', pb: 1 }}>
              <Chip
                label={isRTL ? 'الكل' : 'All'}
                color={selectedCategory === 'all' ? 'primary' : 'default'}
                onClick={() => setSelectedCategory('all')}
              />
              {categories.map(category => (
                <Chip
                  key={category.id}
                  label={isRTL ? category.nameAr : category.name}
                  color={selectedCategory === category.id ? 'primary' : 'default'}
                  onClick={() => setSelectedCategory(category.id!)}
                />
              ))}
            </Stack>

            {/* Products Grid/List */}
            {viewMode === 'grid' ? (
              <Grid container spacing={2}>
                {filteredProducts.map(product => (
                  <Grid item xs={6} sm={4} md={3} key={product.id}>
                    <Card 
                      sx={{ 
                        cursor: 'pointer',
                        '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 },
                        transition: 'all 0.2s',
                      }}
                      onClick={() => addToCart(product)}
                    >
                      {product.primaryImage && (
                        <CardMedia
                          component="img"
                          height="120"
                          image={product.primaryImage}
                          alt={product.name}
                        />
                      )}
                      <CardContent sx={{ p: 1.5 }}>
                        <Typography variant="body2" noWrap>
                          {isRTL ? product.nameAr || product.name : product.name}
                        </Typography>
                        <Typography variant="h6" color="primary">
                          {product.retailPrice.toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                        </Typography>
                        {product.trackInventory && (
                          <Chip
                            size="small"
                            label={`${isRTL ? 'المخزون:' : 'Stock:'} ${product.branchStock?.[currentBranch?.id || '']?.quantity || 0}`}
                            color={product.branchStock?.[currentBranch?.id || '']?.quantity > 0 ? 'success' : 'error'}
                          />
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            ) : (
              <List>
                {filteredProducts.map(product => (
                  <ListItem
                    key={product.id}
                    button
                    onClick={() => addToCart(product)}
                    divider
                  >
                    <ListItemText
                      primary={isRTL ? product.nameAr || product.name : product.name}
                      secondary={
                        <Stack direction="row" spacing={1}>
                          <Typography variant="body2" color="primary">
                            {product.retailPrice.toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                          </Typography>
                          {product.sku && (
                            <Typography variant="body2" color="text.secondary">
                              SKU: {product.sku}
                            </Typography>
                          )}
                        </Stack>
                      }
                    />
                    <ListItemSecondaryAction>
                      <IconButton edge="end" onClick={() => addToCart(product)}>
                        <Add />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>

        {/* Cart Section - Desktop */}
        {!isMobile && (
          <Grid item xs={12} md={4}>
            <CartSection />
          </Grid>
        )}
      </Grid>

      {/* Mobile Cart Drawer */}
      {isMobile && (
        <>
          <Box
            sx={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              bgcolor: 'background.paper',
              boxShadow: 3,
              p: 2,
              zIndex: 1200,
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Stack>
                <Typography variant="body2" color="text.secondary">
                  {isRTL ? 'الإجمالي' : 'Total'}
                </Typography>
                <Typography variant="h6">
                  {calculateCartTotal().toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                </Typography>
              </Stack>
              <Badge badgeContent={cart.length} color="primary">
                <Button
                  variant="contained"
                  startIcon={<ShoppingCart />}
                  onClick={() => setCartDrawer(true)}
                >
                  {isRTL ? 'السلة' : 'Cart'}
                </Button>
              </Badge>
            </Stack>
          </Box>

          <Drawer
            anchor={isRTL ? 'left' : 'right'}
            open={cartDrawer}
            onClose={() => setCartDrawer(false)}
          >
            <Box sx={{ width: 350, p: 2 }}>
              <CartSection />
            </Box>
          </Drawer>
        </>
      )}

      {/* Barcode Scanner Dialog */}
      <Dialog open={barcodeDialog} onClose={() => setBarcodeDialog(false)}>
        <DialogTitle>{isRTL ? 'مسح الباركود' : 'Scan Barcode'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label={isRTL ? 'الباركود' : 'Barcode'}
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleBarcodeScan()}
            sx={{ mt: 2 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <QrCodeScanner />
                </InputAdornment>
              ),
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBarcodeDialog(false)}>
            {isRTL ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button onClick={handleBarcodeScan} variant="contained">
            {isRTL ? 'إضافة' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Payment Dialog */}
      <PaymentDialog />
    </Container>
  );

  // Cart Section Component
  function CartSection() {
    return (
      <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6">
            {isRTL ? 'السلة' : 'Cart'}
          </Typography>
          <IconButton size="small" onClick={clearCart} disabled={cart.length === 0}>
            <Delete />
          </IconButton>
        </Stack>

        {/* Client Selection */}
        <Autocomplete
          options={clients}
          value={selectedClient}
          onChange={(_, client) => setSelectedClient(client)}
          getOptionLabel={(client) => `${client.name} - ${client.phoneNumber || client.email || ''}`}
          renderInput={(params) => (
            <TextField
              {...params}
              label={isRTL ? 'العميل' : 'Client'}
              placeholder={isRTL ? 'اختر عميل (اختياري)' : 'Select client (optional)'}
              InputProps={{
                ...params.InputProps,
                startAdornment: (
                  <InputAdornment position="start">
                    <Person />
                  </InputAdornment>
                ),
              }}
            />
          )}
          sx={{ mb: 2 }}
        />

        <Divider sx={{ mb: 2 }} />

        {/* Cart Items */}
        <Box sx={{ flexGrow: 1, overflowY: 'auto', mb: 2 }}>
          {cart.length === 0 ? (
            <Alert severity="info">
              {isRTL ? 'السلة فارغة' : 'Cart is empty'}
            </Alert>
          ) : (
            <Stack spacing={2}>
              {cart.map((item) => (
                <Paper key={item.product.id} variant="outlined" sx={{ p: 2 }}>
                  <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body1">
                        {isRTL ? item.product.nameAr || item.product.name : item.product.name}
                      </Typography>
                      <IconButton size="small" onClick={() => removeFromCart(item.product.id!)}>
                        <Clear />
                      </IconButton>
                    </Stack>

                    <Stack direction="row" spacing={1} alignItems="center">
                      <IconButton 
                        size="small"
                        onClick={() => updateQuantity(item.product.id!, item.quantity - 1)}
                      >
                        <Remove />
                      </IconButton>
                      <TextField
                        size="small"
                        value={item.quantity}
                        onChange={(e) => updateQuantity(item.product.id!, parseInt(e.target.value) || 0)}
                        sx={{ width: 60, textAlign: 'center' }}
                        inputProps={{ style: { textAlign: 'center' } }}
                      />
                      <IconButton 
                        size="small"
                        onClick={() => updateQuantity(item.product.id!, item.quantity + 1)}
                      >
                        <Add />
                      </IconButton>
                      <Typography variant="body2" color="text.secondary">
                        × {item.price.toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                      </Typography>
                    </Stack>

                    <Stack direction="row" spacing={1} alignItems="center">
                      <TextField
                        size="small"
                        label={isRTL ? 'الخصم' : 'Discount'}
                        value={item.discount}
                        onChange={(e) => updateDiscount(item.product.id!, parseFloat(e.target.value) || 0, item.discountType)}
                        sx={{ width: 100 }}
                        InputProps={{
                          endAdornment: (
                            <InputAdornment position="end">
                              {item.discountType === 'percentage' ? '%' : isRTL ? 'ج.م' : 'EGP'}
                            </InputAdornment>
                          ),
                        }}
                      />
                      <ToggleButtonGroup
                        size="small"
                        value={item.discountType}
                        exclusive
                        onChange={(_, value) => value && updateDiscount(item.product.id!, item.discount, value)}
                      >
                        <ToggleButton value="fixed">
                          {isRTL ? 'ثابت' : 'Fixed'}
                        </ToggleButton>
                        <ToggleButton value="percentage">
                          %
                        </ToggleButton>
                      </ToggleButtonGroup>
                    </Stack>

                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">
                        {isRTL ? 'المجموع' : 'Subtotal'}
                      </Typography>
                      <Typography variant="body1" fontWeight="medium">
                        {item.subtotal.toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                      </Typography>
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Totals */}
        <Stack spacing={1} sx={{ mb: 2 }}>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">
              {isRTL ? 'المجموع الفرعي' : 'Subtotal'}
            </Typography>
            <Typography variant="body2">
              {(calculateCartTotal() + calculateTotalDiscount()).toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
            </Typography>
          </Stack>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">
              {isRTL ? 'الخصم' : 'Discount'}
            </Typography>
            <Typography variant="body2" color="error">
              -{calculateTotalDiscount().toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
            </Typography>
          </Stack>
          <Divider />
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="h6">
              {isRTL ? 'الإجمالي' : 'Total'}
            </Typography>
            <Typography variant="h6" color="primary">
              {calculateCartTotal().toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
            </Typography>
          </Stack>
        </Stack>

        {/* Checkout Button */}
        <Button
          fullWidth
          variant="contained"
          size="large"
          startIcon={<Payment />}
          onClick={handleCheckout}
          disabled={cart.length === 0}
        >
          {isRTL ? 'الدفع' : 'Checkout'}
        </Button>
      </Paper>
    );
  }

  // Payment Dialog Component
  function PaymentDialog() {
    const [activeTab, setActiveTab] = useState(0);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentReference, setPaymentReference] = useState('');

    const paymentMethods: { method: PaymentMethod; icon: React.ReactNode; label: string; labelAr: string }[] = [
      { method: 'cash', icon: <LocalAtm />, label: 'Cash', labelAr: 'نقدي' },
      { method: 'card', icon: <CreditCard />, label: 'Card', labelAr: 'بطاقة' },
      { method: 'digital_wallet', icon: <AccountBalanceWallet />, label: 'Digital Wallet', labelAr: 'محفظة إلكترونية' },
    ];

    const handleAddPayment = () => {
      const amount = parseFloat(paymentAmount);
      if (amount > 0) {
        addPayment(paymentMethods[activeTab].method, amount, paymentReference);
        setPaymentAmount('');
        setPaymentReference('');
      }
    };

    const quickAmounts = [50, 100, 200, 500, 1000];

    return (
      <Dialog open={paymentDialog} onClose={() => setPaymentDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{isRTL ? 'الدفع' : 'Payment'}</DialogTitle>
        <DialogContent>
          <Stack spacing={3}>
            {/* Total Amount */}
            <Alert severity="info">
              <Stack direction="row" justifyContent="space-between">
                <Typography>{isRTL ? 'المبلغ المطلوب' : 'Amount Due'}</Typography>
                <Typography variant="h6">
                  {calculateCartTotal().toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                </Typography>
              </Stack>
            </Alert>

            {/* Payment Methods Tabs */}
            <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} variant="fullWidth">
              {paymentMethods.map((pm, index) => (
                <Tab
                  key={pm.method}
                  icon={pm.icon}
                  label={isRTL ? pm.labelAr : pm.label}
                  iconPosition="start"
                />
              ))}
            </Tabs>

            {/* Payment Amount Input */}
            <Stack spacing={2}>
              <TextField
                fullWidth
                type="number"
                label={isRTL ? 'المبلغ' : 'Amount'}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                InputProps={{
                  endAdornment: <InputAdornment position="end">{isRTL ? 'ج.م' : 'EGP'}</InputAdornment>,
                }}
              />

              {/* Quick Amount Buttons */}
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {quickAmounts.map(amount => (
                  <Chip
                    key={amount}
                    label={amount}
                    onClick={() => setPaymentAmount(amount.toString())}
                    clickable
                  />
                ))}
                <Chip
                  label={isRTL ? 'المبلغ الكامل' : 'Full Amount'}
                  onClick={() => setPaymentAmount(getRemainingAmount().toString())}
                  clickable
                  color="primary"
                />
              </Stack>

              {/* Reference Number for Card/Digital Wallet */}
              {activeTab > 0 && (
                <TextField
                  fullWidth
                  label={isRTL ? 'رقم المرجع' : 'Reference Number'}
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                />
              )}

              <Button
                fullWidth
                variant="contained"
                onClick={handleAddPayment}
                disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
              >
                {isRTL ? 'إضافة دفعة' : 'Add Payment'}
              </Button>
            </Stack>

            {/* Payment List */}
            {payments.length > 0 && (
              <>
                <Divider />
                <Stack spacing={1}>
                  {payments.map((payment, index) => (
                    <Stack key={index} direction="row" justifyContent="space-between" alignItems="center">
                      <Stack direction="row" spacing={1} alignItems="center">
                        {paymentMethods.find(pm => pm.method === payment.method)?.icon}
                        <Typography>
                          {payment.amount.toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                        </Typography>
                        {payment.reference && (
                          <Typography variant="body2" color="text.secondary">
                            ({payment.reference})
                          </Typography>
                        )}
                      </Stack>
                      <IconButton size="small" onClick={() => removePayment(index)}>
                        <Clear />
                      </IconButton>
                    </Stack>
                  ))}
                </Stack>
              </>
            )}

            {/* Summary */}
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2">{isRTL ? 'المطلوب' : 'Total Due'}</Typography>
                  <Typography>{calculateCartTotal().toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2">{isRTL ? 'المدفوع' : 'Total Paid'}</Typography>
                  <Typography color="success.main">{getTotalPaid().toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}</Typography>
                </Stack>
                <Divider />
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="h6">{isRTL ? 'المتبقي' : 'Remaining'}</Typography>
                  <Typography variant="h6" color={getRemainingAmount() > 0 ? 'error' : 'success.main'}>
                    {getRemainingAmount().toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                  </Typography>
                </Stack>
                {getRemainingAmount() < -0.01 && (
                  <Alert severity="warning">
                    {isRTL ? 'الباقي: ' : 'Change: '}
                    {Math.abs(getRemainingAmount()).toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                  </Alert>
                )}
              </Stack>
            </Paper>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentDialog(false)}>
            {isRTL ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button
            variant="contained"
            onClick={completeTransaction}
            disabled={loading || getRemainingAmount() > 0.01}
            startIcon={<Receipt />}
          >
            {isRTL ? 'إتمام البيع' : 'Complete Sale'}
          </Button>
        </DialogActions>
      </Dialog>
    );
  }
};

export default POSPage;