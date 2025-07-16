import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  Chip,
  CircularProgress,
  useMediaQuery,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  ArrowBack,
  Settings,
  ShoppingCart,
  Build,
  Inventory,
  Language,
  AccessTime,
  Save,
  Delete,
  PhotoLibrary,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { toast } from 'react-toastify';
import { useAuth } from '../../../contexts/AuthContext';
import { serviceService } from '../../../services/service.service';
import { setupService } from '../../../services/setup.service';
import type { ServiceCategory as ServiceCategoryType, Service } from '../../../services/service.service';
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

// Available languages
const availableLanguages = [
  { code: 'ar', name: 'العربية', nameAr: 'العربية', flag: '🇸🇦' },
  { code: 'en', name: 'English', nameAr: 'الإنجليزية', flag: '🇬🇧' },
  { code: 'fr', name: 'Français', nameAr: 'الفرنسية', flag: '🇫🇷' },
  { code: 'es', name: 'Español', nameAr: 'الإسبانية', flag: '🇪🇸' },
  { code: 'de', name: 'Deutsch', nameAr: 'الألمانية', flag: '🇩🇪' },
  { code: 'it', name: 'Italiano', nameAr: 'الإيطالية', flag: '🇮🇹' },
  { code: 'tr', name: 'Türkçe', nameAr: 'التركية', flag: '🇹🇷' },
  { code: 'ru', name: 'Русский', nameAr: 'الروسية', flag: '🇷🇺' },
  { code: 'zh', name: '中文', nameAr: 'الصينية', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', nameAr: 'اليابانية', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', nameAr: 'الكورية', flag: '🇰🇷' },
  { code: 'pt', name: 'Português', nameAr: 'البرتغالية', flag: '🇵🇹' },
  { code: 'hi', name: 'हिन्दी', nameAr: 'الهندية', flag: '🇮🇳' },
  { code: 'ur', name: 'اردو', nameAr: 'الأردية', flag: '🇵🇰' },
];

const ServiceEditPage: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { serviceId } = useParams<{ serviceId: string }>();
  const { currentUser } = useAuth();
  const isRTL = theme.direction === 'rtl';
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [tabValue, setTabValue] = useState(0);
  const [categories, setCategories] = useState<ServiceCategoryType[]>([]);
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingService, setLoadingService] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [showTranslation, setShowTranslation] = useState(false);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [translations, setTranslations] = useState<Record<string, { name: string; description?: string }>>({});
  const [serviceImages, setServiceImages] = useState<Service['images']>([]);

  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<ServiceFormData>({
    resolver: yupResolver(serviceSchema),
  });

  const onlineBookingEnabled = watch('onlineBookingEnabled');

  useEffect(() => {
    loadServiceAndCategories();
  }, [currentUser, serviceId]);

  const loadServiceAndCategories = async () => {
    if (!currentUser || !serviceId) return;

    try {
      // Get company ID
      const idTokenResult = await currentUser.getIdTokenResult();
      let companyId = idTokenResult.claims.companyId as string;
      
      if (!companyId) {
        companyId = await setupService.getUserCompanyId(currentUser.uid);
      }

      if (!companyId) {
        toast.error('لم يتم العثور على معرف الشركة');
        navigate('/settings/services');
        return;
      }

      // Load service
      const fetchedService = await serviceService.getService(serviceId);
      if (!fetchedService) {
        toast.error('الخدمة غير موجودة');
        navigate('/settings/services');
        return;
      }

      setService(fetchedService);
      
      // Set form values
      reset({
        name: fetchedService.name,
        categoryId: fetchedService.categoryId,
        startingPrice: fetchedService.startingPrice,
        durationHours: fetchedService.duration.hours,
        durationMinutes: fetchedService.duration.minutes,
        type: fetchedService.type,
        onlineBookingEnabled: fetchedService.onlineBooking.enabled,
        onlineBookingDisplayName: fetchedService.onlineBooking.displayName || '',
        onlineBookingDescription: fetchedService.onlineBooking.description || '',
        prepaymentRequired: fetchedService.onlineBooking.prepaymentRequired || false,
        membershipRequired: fetchedService.onlineBooking.membershipRequired || false,
        availabilityPeriod: fetchedService.onlineBooking.availabilityPeriod || 30,
        invoiceName: fetchedService.invoiceName || '',
        vat: fetchedService.vat || 0,
        followUpDays: fetchedService.followUpDays || 0,
        autoDeduction: fetchedService.autoDeduction || false,
      });

      // Load existing translations
      if (fetchedService.translations) {
        const langs = Object.keys(fetchedService.translations).filter(lang => fetchedService.translations![lang]);
        setSelectedLanguages(langs);
        
        const trans: Record<string, { name: string; description?: string }> = {};
        langs.forEach(lang => {
          trans[lang] = {
            name: fetchedService.translations![lang] || '',
            description: fetchedService.onlineBooking.translations?.[lang] || ''
          };
        });
        setTranslations(trans);
      }

      // Load existing images
      if (fetchedService.images) {
        setServiceImages(fetchedService.images);
      }

      // Check if translation is needed
      if (!fetchedService.translations || Object.keys(fetchedService.translations).length === 0) {
        setShowTranslation(true);
        setTabValue(5); // Switch to Languages tab
      }

      setLoadingService(false);

      // Load categories
      const fetchedCategories = await serviceService.getCategories(companyId);
      setCategories(fetchedCategories);
      setLoadingCategories(false);
    } catch (error) {
      console.error('Error loading service:', error);
      toast.error('فشل تحميل الخدمة');
      navigate('/settings/services');
    }
  };

  const onSubmit = async (data: ServiceFormData) => {
    if (!currentUser || !serviceId || !service) return;

    try {
      setLoading(true);

      // Build translations object
      const serviceTranslations: Record<string, string> = {};
      const descriptionTranslations: Record<string, string> = {};
      
      selectedLanguages.forEach(lang => {
        if (translations[lang]?.name) {
          serviceTranslations[lang] = translations[lang].name;
        }
        if (translations[lang]?.description && data.onlineBookingEnabled) {
          descriptionTranslations[lang] = translations[lang].description;
        }
      });

      const updatedService: Partial<Service> = {
        name: data.name,
        translations: Object.keys(serviceTranslations).length > 0 ? serviceTranslations : undefined,
        categoryId: data.categoryId,
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
          translations: Object.keys(descriptionTranslations).length > 0 ? descriptionTranslations : undefined,
          prepaymentRequired: data.prepaymentRequired,
          membershipRequired: data.membershipRequired,
          availabilityPeriod: data.availabilityPeriod,
        },
        invoiceName: data.invoiceName,
        vat: data.vat,
        followUpDays: data.followUpDays,
        autoDeduction: data.autoDeduction,
        images: serviceImages,
      };

      await serviceService.updateService(serviceId, updatedService);
      
      toast.success('تم تحديث الخدمة بنجاح');
      navigate(`/settings/services/category/${data.categoryId}`);
    } catch (error) {
      console.error('Error updating service:', error);
      toast.error('فشل تحديث الخدمة');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!serviceId || !service) return;

    if (window.confirm('هل أنت متأكد من حذف هذه الخدمة؟')) {
      try {
        await serviceService.deleteService(serviceId);
        toast.success('تم حذف الخدمة بنجاح');
        navigate(`/settings/services/category/${service.categoryId}`);
      } catch (error) {
        console.error('Error deleting service:', error);
        toast.error('فشل حذف الخدمة');
      }
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

  if (loadingService) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

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
            <IconButton onClick={() => navigate(-1)}>
              <ArrowBack />
            </IconButton>
            <Typography variant="h4" sx={{ fontWeight: 600 }}>
              تعديل الخدمة
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              color="error"
              startIcon={<Delete />}
              onClick={handleDelete}
            >
              حذف
            </Button>
            <Button
              variant="outlined"
              onClick={() => navigate(-1)}
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
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {tab.label}
                      {index === 5 && showTranslation && (
                        <Chip label="يحتاج ترجمة" size="small" color="warning" />
                      )}
                    </Box>
                  }
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
                      value={field.value || ''}
                    >
                      {!loadingCategories && categories.length === 0 && (
                        <MenuItem value="" disabled>
                          لا توجد فئات
                        </MenuItem>
                      )}
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
                يمكنك ربط الموارد المطلوبة لهذه الخدمة
              </Typography>
            </Box>
          </TabPanel>

          {/* Images Tab */}
          <TabPanel value={tabValue} index={4}>
            <Box sx={{ maxWidth: 800, mx: 'auto' }}>
              <Typography variant="h6" sx={{ mb: 3 }}>
                صور الخدمة
              </Typography>
              
              {service && (
                <ServiceImageUpload
                  serviceId={serviceId!}
                  companyId={service.companyId}
                  images={serviceImages || []}
                  onImagesChange={setServiceImages}
                  disabled={loading}
                />
              )}
            </Box>
          </TabPanel>

          {/* Languages Tab */}
          <TabPanel value={tabValue} index={5}>
            <Box sx={{ maxWidth: 800, mx: 'auto' }}>
              <Typography variant="h6" sx={{ mb: 3 }}>
                إدارة اللغات والترجمات
              </Typography>
              
              {/* Language Selection */}
              <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                  اختر اللغات المتاحة لعملائك
                </Typography>
                
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
                  {availableLanguages.map((lang) => (
                    <Chip
                      key={lang.code}
                      label={`${lang.flag} ${lang.name}`}
                      onClick={() => {
                        if (lang.code === 'ar') return; // Arabic is always selected
                        
                        if (selectedLanguages.includes(lang.code)) {
                          setSelectedLanguages(selectedLanguages.filter(l => l !== lang.code));
                          const newTranslations = { ...translations };
                          delete newTranslations[lang.code];
                          setTranslations(newTranslations);
                        } else {
                          setSelectedLanguages([...selectedLanguages, lang.code]);
                          setTranslations({
                            ...translations,
                            [lang.code]: {
                              name: translations[lang.code]?.name || '',
                              description: translations[lang.code]?.description || ''
                            }
                          });
                        }
                      }}
                      color={lang.code === 'ar' || selectedLanguages.includes(lang.code) ? 'primary' : 'default'}
                      variant={lang.code === 'ar' || selectedLanguages.includes(lang.code) ? 'filled' : 'outlined'}
                      disabled={lang.code === 'ar'}
                    />
                  ))}
                </Box>
                
                <Typography variant="caption" color="text.secondary">
                  انقر على اللغات التي تريد دعمها. العربية هي اللغة الأساسية ولا يمكن إلغاء تحديدها.
                </Typography>
              </Paper>

              {/* Translations */}
              <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="subtitle1" sx={{ mb: 3, fontWeight: 600 }}>
                  الترجمات
                </Typography>
                
                {/* Arabic - Primary Language */}
                <Box sx={{ mb: 4 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      🇸🇦 العربية
                    </Typography>
                    <Chip 
                      label="اللغة الأساسية" 
                      size="small" 
                      color="primary" 
                      sx={{ ml: 1 }}
                    />
                  </Box>
                  <TextField
                    fullWidth
                    value={watch('name')}
                    disabled
                    label="اسم الخدمة"
                    helperText="هذا هو الاسم الأساسي للخدمة"
                    sx={{ mb: 2 }}
                  />
                  {onlineBookingEnabled && (
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      value={watch('onlineBookingDescription')}
                      disabled
                      label="وصف الخدمة"
                      helperText="هذا هو الوصف الأساسي للخدمة"
                    />
                  )}
                </Box>

                {/* Selected Language Translations */}
                {selectedLanguages.map((langCode) => {
                  const lang = availableLanguages.find(l => l.code === langCode);
                  if (!lang) return null;
                  
                  return (
                    <Box key={langCode} sx={{ mb: 4 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {lang.flag} {lang.name}
                        </Typography>
                        {!translations[langCode]?.name && (
                          <Chip 
                            label="غير مترجم" 
                            size="small" 
                            color="warning" 
                            sx={{ ml: 1 }}
                          />
                        )}
                      </Box>
                      <TextField
                        fullWidth
                        value={translations[langCode]?.name || ''}
                        onChange={(e) => setTranslations({
                          ...translations,
                          [langCode]: {
                            ...translations[langCode],
                            name: e.target.value
                          }
                        })}
                        label={`اسم الخدمة بـ${lang.nameAr}`}
                        placeholder={`أدخل اسم الخدمة بـ${lang.nameAr}`}
                        sx={{ mb: 2 }}
                      />
                      {onlineBookingEnabled && (
                        <TextField
                          fullWidth
                          multiline
                          rows={2}
                          value={translations[langCode]?.description || ''}
                          onChange={(e) => setTranslations({
                            ...translations,
                            [langCode]: {
                              ...translations[langCode],
                              description: e.target.value
                            }
                          })}
                          label={`وصف الخدمة بـ${lang.nameAr}`}
                          placeholder={`أدخل وصف الخدمة بـ${lang.nameAr}`}
                        />
                      )}
                    </Box>
                  );
                })}

                {selectedLanguages.length === 0 && (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      اختر اللغات من الأعلى لإضافة الترجمات
                    </Typography>
                  </Box>
                )}
              </Paper>

              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                * سيتمكن العملاء من اختيار لغتهم المفضلة في التطبيق وسيتم عرض الخدمات بتلك اللغة
              </Typography>
            </Box>
          </TabPanel>
        </Paper>
      </Box>
    </Box>
  );
};

export default ServiceEditPage;