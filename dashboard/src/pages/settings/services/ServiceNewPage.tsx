import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormControlLabel,
  Checkbox,
  Switch,
  InputAdornment,
  Tabs,
  Tab,
  IconButton,
  Autocomplete,
  Chip,
  useMediaQuery,
} from '@mui/material';
import {
  ArrowBack,
  Settings,
  ShoppingCart,
  Build,
  Inventory,
  Language,
  AccessTime,
  Save,
  PhotoLibrary,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { toast } from 'react-toastify';
import { useAuth } from '../../../contexts/AuthContext';
import { serviceService } from '../../../services/service.service';
import type { ServiceCategory as ServiceCategoryType, Service } from '../../../services/service.service';
import { setupService } from '../../../services/setup.service';
import ServiceImageUpload from '../../../components/services/ServiceImageUpload';

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
      id={`service-tabpanel-${index}`}
      aria-labelledby={`service-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

const serviceSchema = yup.object({
  name: yup.string().required('اسم الخدمة مطلوب'),
  categoryId: yup.string().required('فئة الخدمة مطلوبة'),
  startingPrice: yup.number().min(0, 'السعر يجب أن يكون موجباً').required('السعر مطلوب'),
  durationHours: yup.number().min(0).required('ساعات المدة مطلوبة'),
  durationMinutes: yup.number().min(0).max(59).required('دقائق المدة مطلوبة'),
  type: yup.string().oneOf(['appointment', 'group-event']).required('نوع الخدمة مطلوب'),
  // Online booking
  onlineBookingEnabled: yup.boolean(),
  onlineBookingDisplayName: yup.string().when('onlineBookingEnabled', {
    is: true,
    then: (schema) => schema.required('اسم العرض للحجز الإلكتروني مطلوب'),
  }),
  onlineBookingDescription: yup.string(),
  prepaymentRequired: yup.boolean(),
  membershipRequired: yup.boolean(),
  availabilityPeriod: yup.number().min(1),
  // Advanced options
  invoiceName: yup.string(),
  vat: yup.number().min(0).max(100),
  followUpDays: yup.number().min(0),
  autoDeduction: yup.boolean(),
});

type ServiceFormData = yup.InferType<typeof serviceSchema>;

const ServiceNewPage: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const isRTL = theme.direction === 'rtl';
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [tabValue, setTabValue] = useState(0);
  const [categories, setCategories] = useState<ServiceCategoryType[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [serviceImages, setServiceImages] = useState<Service['images']>([]);
  const [tempServiceId] = useState(`temp-${Date.now()}`); // Temporary ID for image uploads before service is created

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ServiceFormData>({
    resolver: yupResolver(serviceSchema),
    defaultValues: {
      name: '',
      categoryId: '',
      startingPrice: 0,
      durationHours: 0,
      durationMinutes: 30,
      type: 'appointment',
      onlineBookingEnabled: false,
      onlineBookingDisplayName: '',
      onlineBookingDescription: '',
      prepaymentRequired: false,
      membershipRequired: false,
      availabilityPeriod: 30,
      invoiceName: '',
      vat: 0,
      followUpDays: 0,
      autoDeduction: false,
    },
  });

  const onlineBookingEnabled = watch('onlineBookingEnabled');

  useEffect(() => {
    loadCategories();
  }, [currentUser]);

  const loadCategories = async () => {
    if (!currentUser) return;

    try {
      setLoadingCategories(true);
      
      // Get company ID using the same method as dashboard
      const idTokenResult = await currentUser.getIdTokenResult();
      let companyId = idTokenResult.claims.companyId as string;
      
      if (!companyId) {
        // Fallback to getting from user document
        companyId = await setupService.getUserCompanyId(currentUser.uid);
      }

      if (!companyId) {
        toast.error('لم يتم العثور على معرف الشركة');
        return;
      }

      const fetchedCategories = await serviceService.getCategories(companyId);
      setCategories(fetchedCategories);
    } catch (error) {
      console.error('Error loading categories:', error);
      toast.error('فشل تحميل الفئات');
    } finally {
      setLoadingCategories(false);
    }
  };

  const onSubmit = async (data: ServiceFormData) => {
    if (!currentUser) return;

    try {
      setLoading(true);

      // Get company ID using the same method as dashboard
      const idTokenResult = await currentUser.getIdTokenResult();
      let companyId = idTokenResult.claims.companyId as string;
      
      if (!companyId) {
        // Fallback to getting from user document
        companyId = await setupService.getUserCompanyId(currentUser.uid);
      }

      if (!companyId) {
        toast.error('لم يتم العثور على معرف الشركة');
        return;
      }

      const service: Omit<Service, 'id' | 'createdAt' | 'updatedAt'> = {
        companyId,
        categoryId: data.categoryId,
        name: data.name,
        startingPrice: data.startingPrice,
        duration: {
          hours: data.durationHours,
          minutes: data.durationMinutes,
        },
        type: data.type as 'appointment' | 'group-event',
        onlineBooking: {
          enabled: data.onlineBookingEnabled,
          displayName: data.onlineBookingEnabled ? data.onlineBookingDisplayName : undefined,
          description: data.onlineBookingEnabled ? data.onlineBookingDescription : undefined,
          prepaymentRequired: data.prepaymentRequired,
          membershipRequired: data.membershipRequired,
          availabilityPeriod: data.availabilityPeriod,
        },
        invoiceName: data.invoiceName,
        vat: data.vat,
        followUpDays: data.followUpDays,
        autoDeduction: data.autoDeduction,
        images: serviceImages,
        active: true,
      };

      await serviceService.createService(service, currentUser.uid);
      
      toast.success('تم إنشاء الخدمة بنجاح');
      navigate('/settings/services');
    } catch (error) {
      console.error('Error creating service:', error);
      toast.error('فشل إنشاء الخدمة');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const tabs = [
    { label: 'الإعدادات العامة', icon: <Settings /> },
    { label: 'الحجز الإلكتروني', icon: <ShoppingCart /> },
    { label: 'خيارات متقدمة', icon: <Build /> },
    { label: 'الموارد', icon: <Inventory /> },
    { label: 'الصور', icon: <PhotoLibrary /> },
    { label: 'اللغات', icon: <Language /> },
  ];

  return (
    <Box sx={{ flexGrow: 1, minHeight: '100vh' }}>
      {/* Header */}
      <Box
        sx={{
          p: 3,
          borderBottom: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.paper,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton onClick={() => navigate('/settings/services')}>
              <ArrowBack />
            </IconButton>
            <Typography variant="h4" sx={{ fontWeight: 600 }}>
              إنشاء خدمة جديدة
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              onClick={() => navigate('/settings/services')}
            >
              إلغاء
            </Button>
            <Button
              variant="contained"
              startIcon={<Save />}
              onClick={handleSubmit(onSubmit)}
              disabled={loading}
              sx={{
                backgroundColor: '#10B981',
                '&:hover': {
                  backgroundColor: '#059669',
                },
              }}
            >
              {loading ? 'جاري الحفظ...' : 'حفظ'}
            </Button>
          </Box>
        </Box>
      </Box>

      {/* Content */}
      <Box sx={{ p: 3 }}>
        <Paper sx={{ width: '100%' }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs
              value={tabValue}
              onChange={handleTabChange}
              variant={isMobile ? 'scrollable' : 'standard'}
              scrollButtons="auto"
              sx={{
                '& .MuiTab-root': {
                  minHeight: 64,
                  textTransform: 'none',
                },
              }}
            >
              {tabs.map((tab, index) => (
                <Tab
                  key={index}
                  label={tab.label}
                  icon={tab.icon}
                  iconPosition="start"
                />
              ))}
            </Tabs>
          </Box>

          {/* General Settings Tab */}
          <TabPanel value={tabValue} index={0}>
            <Box sx={{ maxWidth: 600, mx: 'auto' }}>
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="اسم الخدمة"
                    placeholder="مثال: قص شعر رجالي"
                    error={!!errors.name}
                    helperText={errors.name?.message}
                    sx={{ mb: 3 }}
                  />
                )}
              />

              <Controller
                name="categoryId"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth sx={{ mb: 3 }} error={!!errors.categoryId}>
                    <InputLabel>فئة الخدمة</InputLabel>
                    <Select
                      {...field}
                      label="فئة الخدمة"
                      disabled={loadingCategories}
                    >
                      {categories.map((category) => (
                        <MenuItem key={category.id} value={category.id}>
                          {isRTL ? category.nameAr || category.name : category.name}
                        </MenuItem>
                      ))}
                    </Select>
                    {errors.categoryId && (
                      <Typography variant="caption" color="error" sx={{ mt: 1, mx: 1.75 }}>
                        {errors.categoryId.message}
                      </Typography>
                    )}
                  </FormControl>
                )}
              />

              <Controller
                name="startingPrice"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    type="number"
                    label="السعر الأساسي"
                    InputProps={{
                      endAdornment: <InputAdornment position="end">جنيه</InputAdornment>,
                    }}
                    error={!!errors.startingPrice}
                    helperText={errors.startingPrice?.message}
                    sx={{ mb: 3 }}
                  />
                )}
              />

              <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                <Controller
                  name="durationHours"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      type="number"
                      label="المدة - ساعات"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <AccessTime />
                          </InputAdornment>
                        ),
                      }}
                      error={!!errors.durationHours}
                      helperText={errors.durationHours?.message}
                    />
                  )}
                />
                <Controller
                  name="durationMinutes"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      type="number"
                      label="المدة - دقائق"
                      inputProps={{ min: 0, max: 59 }}
                      error={!!errors.durationMinutes}
                      helperText={errors.durationMinutes?.message}
                    />
                  )}
                />
              </Box>

              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth error={!!errors.type}>
                    <InputLabel>نوع الخدمة</InputLabel>
                    <Select
                      {...field}
                      label="نوع الخدمة"
                    >
                      <MenuItem value="appointment">موعد فردي</MenuItem>
                      <MenuItem value="group-event">حدث جماعي</MenuItem>
                    </Select>
                    {errors.type && (
                      <Typography variant="caption" color="error" sx={{ mt: 1, mx: 1.75 }}>
                        {errors.type.message}
                      </Typography>
                    )}
                  </FormControl>
                )}
              />
            </Box>
          </TabPanel>

          {/* Online Booking Tab */}
          <TabPanel value={tabValue} index={1}>
            <Box sx={{ maxWidth: 600, mx: 'auto' }}>
              <Controller
                name="onlineBookingEnabled"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Switch
                        {...field}
                        checked={field.value}
                        color="primary"
                      />
                    }
                    label="تفعيل الحجز الإلكتروني"
                    sx={{ mb: 3 }}
                  />
                )}
              />

              {onlineBookingEnabled && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <Controller
                    name="onlineBookingDisplayName"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="اسم العرض للحجز الإلكتروني"
                        placeholder="اسم الخدمة كما سيظهر للعملاء"
                        error={!!errors.onlineBookingDisplayName}
                        helperText={errors.onlineBookingDisplayName?.message}
                        sx={{ mb: 3 }}
                      />
                    )}
                  />

                  <Controller
                    name="onlineBookingDescription"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        multiline
                        rows={3}
                        label="وصف الخدمة"
                        placeholder="وصف مفصل للخدمة"
                        sx={{ mb: 3 }}
                      />
                    )}
                  />

                  <Controller
                    name="prepaymentRequired"
                    control={control}
                    render={({ field }) => (
                      <FormControlLabel
                        control={
                          <Checkbox
                            {...field}
                            checked={field.value}
                          />
                        }
                        label="يتطلب دفع مقدم"
                        sx={{ mb: 2 }}
                      />
                    )}
                  />

                  <Controller
                    name="membershipRequired"
                    control={control}
                    render={({ field }) => (
                      <FormControlLabel
                        control={
                          <Checkbox
                            {...field}
                            checked={field.value}
                          />
                        }
                        label="متاح لأعضاء العضوية فقط"
                        sx={{ mb: 3 }}
                      />
                    )}
                  />

                  <Controller
                    name="availabilityPeriod"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        type="number"
                        label="فترة الإتاحة للحجز"
                        InputProps={{
                          endAdornment: <InputAdornment position="end">يوم</InputAdornment>,
                        }}
                        helperText="عدد الأيام المتاحة للحجز مقدماً"
                      />
                    )}
                  />
                </motion.div>
              )}
            </Box>
          </TabPanel>

          {/* Advanced Options Tab */}
          <TabPanel value={tabValue} index={2}>
            <Box sx={{ maxWidth: 600, mx: 'auto' }}>
              <Controller
                name="invoiceName"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="اسم الفاتورة"
                    placeholder="الاسم كما سيظهر في الفاتورة"
                    sx={{ mb: 3 }}
                  />
                )}
              />

              <Controller
                name="vat"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    type="number"
                    label="ضريبة القيمة المضافة"
                    InputProps={{
                      endAdornment: <InputAdornment position="end">%</InputAdornment>,
                    }}
                    error={!!errors.vat}
                    helperText={errors.vat?.message}
                    sx={{ mb: 3 }}
                  />
                )}
              />

              <Controller
                name="followUpDays"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    type="number"
                    label="أيام المتابعة"
                    InputProps={{
                      endAdornment: <InputAdornment position="end">يوم</InputAdornment>,
                    }}
                    helperText="عدد الأيام لتذكير العميل بالمتابعة"
                    sx={{ mb: 3 }}
                  />
                )}
              />

              <Controller
                name="autoDeduction"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Checkbox
                        {...field}
                        checked={field.value}
                      />
                    }
                    label="خصم تلقائي من رصيد العميل"
                  />
                )}
              />
            </Box>
          </TabPanel>

          {/* Resources Tab */}
          <TabPanel value={tabValue} index={3}>
            <Box sx={{ maxWidth: 600, mx: 'auto', textAlign: 'center', py: 4 }}>
              <Inventory sx={{ fontSize: 64, color: theme.palette.text.secondary, mb: 2 }} />
              <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                إدارة الموارد
              </Typography>
              <Typography variant="body2" color="text.secondary">
                يمكنك ربط الموارد المطلوبة لهذه الخدمة بعد إنشائها
              </Typography>
            </Box>
          </TabPanel>

          {/* Images Tab */}
          <TabPanel value={tabValue} index={4}>
            <Box sx={{ maxWidth: 800, mx: 'auto' }}>
              <Typography variant="h6" sx={{ mb: 3 }}>
                صور الخدمة
              </Typography>
              
              <ServiceImageUpload
                serviceId={tempServiceId}
                companyId={tempServiceId} // Use temp ID for now, images will be moved after service creation
                images={serviceImages || []}
                onImagesChange={setServiceImages}
                disabled={loading}
              />
            </Box>
          </TabPanel>

          {/* Languages Tab */}
          <TabPanel value={tabValue} index={5}>
            <Box sx={{ maxWidth: 600, mx: 'auto', textAlign: 'center', py: 4 }}>
              <Language sx={{ fontSize: 64, color: theme.palette.text.secondary, mb: 2 }} />
              <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                دعم متعدد اللغات
              </Typography>
              <Typography variant="body2" color="text.secondary">
                يمكنك إضافة ترجمات للخدمة بلغات مختلفة بعد إنشائها
              </Typography>
            </Box>
          </TabPanel>
        </Paper>
      </Box>
    </Box>
  );
};

export default ServiceNewPage;