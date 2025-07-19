import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Tabs,
  Tab,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Typography,
  IconButton,
  Chip,
  FormHelperText,
} from '@mui/material';
import { Close, ContentCopy } from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useTheme } from '@mui/material/styles';
import { useAuth } from '../../contexts/AuthContext';
import { bookingLinkService } from '../../services/bookingLink.service';
import type { BookingLink } from '../../services/bookingLink.service';
import { staffService } from '../../services/staff.service';
import type { Staff } from '../../services/staff.service';
import { db } from '../../config/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface BookingLinkFormProps {
  open: boolean;
  link: BookingLink | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`booking-link-tabpanel-${index}`}
      aria-labelledby={`booking-link-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
};

const schema = yup.object().shape({
  name: yup.string().required('Name is required'),
  slug: yup.string().required('URL slug is required').matches(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens allowed'),
  type: yup.string().oneOf(['company', 'general', 'employee']).required('Type is required'),
  employeeId: yup.string().when('type', {
    is: 'employee',
    then: (schema) => schema.required('Employee is required'),
    otherwise: (schema) => schema.optional(),
  }),
  description: yup.string().optional(),
  isMain: yup.boolean(),
  isActive: yup.boolean(),
  settings: yup.object().shape({
    defaultLanguage: yup.string().required('Default language is required'),
    mapType: yup.string().oneOf(['google', 'osm']).required(),
    bookingFlow: yup.string().oneOf(['stepByStep', 'shortStep', 'menu']).required(),
    stepsOrder: yup.array().of(yup.string()),
    theme: yup.string().oneOf(['light', 'dark']).required(),
    primaryColor: yup.string().required(),
    coverImage: yup.string().optional(),
    allowMultipleBookings: yup.boolean(),
    maxBookingsPerSession: yup.number().min(1).max(10),
    showGroupEvents: yup.boolean(),
    groupEventsDisplay: yup.string().oneOf(['allOnPage', 'byDays']),
  }),
});

type FormData = yup.InferType<typeof schema>;

const BookingLinkForm: React.FC<BookingLinkFormProps> = ({
  open,
  link,
  onClose,
  onSuccess,
}) => {
  const theme = useTheme();
  const { currentUser } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [employees, setEmployees] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState('');
  const isRTL = theme.direction === 'rtl';

  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: yupResolver(schema),
    defaultValues: {
      name: '',
      slug: '',
      type: 'general',
      employeeId: '',
      description: '',
      isMain: false,
      isActive: true,
      settings: {
        defaultLanguage: isRTL ? 'ar' : 'en',
        mapType: 'google',
        bookingFlow: 'stepByStep',
        stepsOrder: ['service', 'employee', 'datetime'],
        theme: 'light',
        primaryColor: '#FF6B00',
        coverImage: '',
        allowMultipleBookings: false,
        maxBookingsPerSession: 1,
        showGroupEvents: false,
        groupEventsDisplay: 'allOnPage',
      },
    },
  });

  const watchedType = watch('type');
  const watchedSlug = watch('slug');

  useEffect(() => {
    if (link) {
      reset({
        ...link,
        settings: {
          ...link.settings,
        },
      });
      setGeneratedUrl(link.fullUrl || '');
    }
  }, [link, reset]);

  useEffect(() => {
    loadEmployees();
  }, [currentUser]);

  useEffect(() => {
    // Generate URL preview
    if (watchedSlug && currentUser) {
      generateUrlPreview();
    }
  }, [watchedSlug, currentUser]);

  const loadEmployees = async () => {
    if (!currentUser) return;

    try {
      const idTokenResult = await currentUser.getIdTokenResult();
      const companyId = idTokenResult.claims.companyId as string;

      if (companyId) {
        const staffList = await staffService.getStaff(companyId);
        setEmployees(staffList);
      }
    } catch (error) {
      console.error('Error loading employees:', error);
    }
  };

  const generateUrlPreview = async () => {
    if (!currentUser) return;

    try {
      const idTokenResult = await currentUser.getIdTokenResult();
      const companyId = idTokenResult.claims.companyId as string;
      
      // Get company document to get the slug
      const companyDoc = await getDoc(doc(db, 'companies', companyId));
      const companyData = companyDoc.data();
      
      if (companyData && companyData.slug) {
        setGeneratedUrl(`https://bookings.clientsplus.com/c/${companyData.slug}/${watchedSlug}`);
      }
    } catch (error) {
      console.error('Error generating URL preview:', error);
    }
  };

  const onSubmit = async (data: FormData) => {
    if (!currentUser) return;

    try {
      setLoading(true);
      const idTokenResult = await currentUser.getIdTokenResult();
      const companyId = idTokenResult.claims.companyId as string;

      // Map form data to full BookingLink structure
      const bookingLinkData = {
        ...data,
        createdBy: currentUser.uid,
        settings: {
          ...data.settings,
          // Add default values for required settings fields
          serviceDisplay: 'horizontal' as const,
          showServiceCategories: true,
          showServicePrices: true,
          showServiceDuration: true,
          showEmployeePhotos: true,
          showEmployeeRatings: true,
          allowAnyEmployee: true,
          timeSlotInterval: 30,
          showMorningSlots: true,
          showAfternoonSlots: true,
          showEveningSlots: true,
        },
      };

      if (link) {
        await bookingLinkService.updateBookingLink(link.id!, bookingLinkData);
      } else {
        await bookingLinkService.createBookingLink(companyId, bookingLinkData);
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving booking link:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(generatedUrl);
    // TODO: Show success snackbar
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">
            {link
              ? isRTL ? 'تعديل رابط الحجز' : 'Edit Booking Link'
              : isRTL ? 'رابط حجز جديد' : 'New Booking Link'}
          </Typography>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <form onSubmit={handleSubmit(onSubmit as any)}>
        <DialogContent dividers>
          <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
            <Tab label={isRTL ? 'معلومات أساسية' : 'Basic Information'} />
            <Tab label={isRTL ? 'التصميم' : 'Design'} />
            <Tab label={isRTL ? 'تدفق الحجز' : 'Booking Flow'} />
            <Tab label={isRTL ? 'الإعدادات المتقدمة' : 'Advanced Settings'} />
          </Tabs>

          {/* Basic Information Tab */}
          <TabPanel value={tabValue} index={0}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              <Box sx={{ flex: '1 1 100%' }}>
                <Controller
                  name="name"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label={isRTL ? 'اسم الرابط' : 'Link Name'}
                      error={!!errors.name}
                      helperText={errors.name?.message}
                    />
                  )}
                />
              </Box>

              <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 calc(50% - 12px)' } }}>
                <Controller
                  name="slug"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label={isRTL ? 'معرف URL' : 'URL Slug'}
                      error={!!errors.slug}
                      helperText={errors.slug?.message}
                      onChange={(e) => {
                        const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                        field.onChange(value);
                      }}
                    />
                  )}
                />
              </Box>

              <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 calc(50% - 12px)' } }}>
                <Controller
                  name="type"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.type}>
                      <InputLabel>{isRTL ? 'نوع الرابط' : 'Link Type'}</InputLabel>
                      <Select {...field} label={isRTL ? 'نوع الرابط' : 'Link Type'}>
                        <MenuItem value="company">{isRTL ? 'رابط الشركة' : 'Company Link'}</MenuItem>
                        <MenuItem value="general">{isRTL ? 'رابط عام' : 'General Link'}</MenuItem>
                        <MenuItem value="employee">{isRTL ? 'رابط موظف' : 'Employee Link'}</MenuItem>
                      </Select>
                      {errors.type && <FormHelperText>{errors.type.message}</FormHelperText>}
                    </FormControl>
                  )}
                />
              </Box>

              {watchedType === 'employee' && (
                <Box sx={{ flex: '1 1 100%' }}>
                  <Controller
                    name="employeeId"
                    control={control}
                    render={({ field }) => (
                      <FormControl fullWidth error={!!errors.employeeId}>
                        <InputLabel>{isRTL ? 'الموظف' : 'Employee'}</InputLabel>
                        <Select {...field} label={isRTL ? 'الموظف' : 'Employee'}>
                          {employees.map((employee) => (
                            <MenuItem key={employee.id} value={employee.id}>
                              {employee.name}
                            </MenuItem>
                          ))}
                        </Select>
                        {errors.employeeId && <FormHelperText>{errors.employeeId.message}</FormHelperText>}
                      </FormControl>
                    )}
                  />
                </Box>
              )}

              <Box sx={{ flex: '1 1 100%' }}>
                <Controller
                  name="description"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      multiline
                      rows={3}
                      label={isRTL ? 'الوصف' : 'Description'}
                      error={!!errors.description}
                      helperText={errors.description?.message}
                    />
                  )}
                />
              </Box>

              <Box sx={{ flex: '1 1 100%' }}>
                <Box sx={{ 
                  p: 2, 
                  bgcolor: 'background.default', 
                  borderRadius: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}>
                  <Typography variant="body2" color="textSecondary">
                    {isRTL ? 'رابط الحجز:' : 'Booking URL:'}
                  </Typography>
                  <Typography variant="body2" sx={{ flex: 1, fontFamily: 'monospace' }}>
                    {generatedUrl || '...'}
                  </Typography>
                  <IconButton size="small" onClick={handleCopyUrl} disabled={!generatedUrl}>
                    <ContentCopy fontSize="small" />
                  </IconButton>
                </Box>
              </Box>

              <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 calc(50% - 12px)' } }}>
                <Controller
                  name="isMain"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Switch {...field} checked={field.value} />}
                      label={isRTL ? 'رابط رئيسي' : 'Main Link'}
                    />
                  )}
                />
              </Box>

              <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 calc(50% - 12px)' } }}>
                <Controller
                  name="isActive"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Switch {...field} checked={field.value} />}
                      label={isRTL ? 'نشط' : 'Active'}
                    />
                  )}
                />
              </Box>
            </Box>
          </TabPanel>

          {/* Design Tab */}
          <TabPanel value={tabValue} index={1}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 calc(50% - 12px)' } }}>
                <Controller
                  name="settings.theme"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>{isRTL ? 'المظهر' : 'Theme'}</InputLabel>
                      <Select {...field} label={isRTL ? 'المظهر' : 'Theme'}>
                        <MenuItem value="light">{isRTL ? 'فاتح' : 'Light'}</MenuItem>
                        <MenuItem value="dark">{isRTL ? 'داكن' : 'Dark'}</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />
              </Box>

              <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 calc(50% - 12px)' } }}>
                <Controller
                  name="settings.primaryColor"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label={isRTL ? 'اللون الأساسي' : 'Primary Color'}
                      type="color"
                      slotProps={{ inputLabel: { shrink: true } }}
                    />
                  )}
                />
              </Box>

              <Box sx={{ flex: '1 1 100%' }}>
                <Controller
                  name="settings.coverImage"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label={isRTL ? 'صورة الغلاف URL' : 'Cover Image URL'}
                      placeholder="https://example.com/image.jpg"
                    />
                  )}
                />
              </Box>
            </Box>
          </TabPanel>

          {/* Booking Flow Tab */}
          <TabPanel value={tabValue} index={2}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              <Box sx={{ flex: '1 1 100%' }}>
                <Controller
                  name="settings.bookingFlow"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>{isRTL ? 'تدفق الحجز' : 'Booking Flow'}</InputLabel>
                      <Select {...field} label={isRTL ? 'تدفق الحجز' : 'Booking Flow'}>
                        <MenuItem value="stepByStep">{isRTL ? 'خطوة بخطوة' : 'Step by Step'}</MenuItem>
                        <MenuItem value="shortStep">{isRTL ? 'خطوات قصيرة' : 'Short Steps'}</MenuItem>
                        <MenuItem value="menu">{isRTL ? 'قائمة' : 'Menu'}</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />
              </Box>

              <Box sx={{ flex: '1 1 100%' }}>
                <Typography variant="subtitle2" gutterBottom>
                  {isRTL ? 'ترتيب الخطوات' : 'Steps Order'}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {watch('settings.stepsOrder')?.map((step, index) => (
                    <Chip
                      key={index}
                      label={step}
                      color="primary"
                      variant="outlined"
                    />
                  ))}
                </Box>
              </Box>

              <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 calc(50% - 12px)' } }}>
                <Controller
                  name="settings.allowMultipleBookings"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Switch {...field} checked={field.value} />}
                      label={isRTL ? 'السماح بحجوزات متعددة' : 'Allow Multiple Bookings'}
                    />
                  )}
                />
              </Box>

              {watch('settings.allowMultipleBookings') && (
                <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 calc(50% - 12px)' } }}>
                  <Controller
                    name="settings.maxBookingsPerSession"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        type="number"
                        label={isRTL ? 'الحد الأقصى للحجوزات' : 'Max Bookings Per Session'}
                        slotProps={{ htmlInput: { min: 1, max: 10 } }}
                      />
                    )}
                  />
                </Box>
              )}
            </Box>
          </TabPanel>

          {/* Advanced Settings Tab */}
          <TabPanel value={tabValue} index={3}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 calc(50% - 12px)' } }}>
                <Controller
                  name="settings.defaultLanguage"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>{isRTL ? 'اللغة الافتراضية' : 'Default Language'}</InputLabel>
                      <Select {...field} label={isRTL ? 'اللغة الافتراضية' : 'Default Language'}>
                        <MenuItem value="en">English</MenuItem>
                        <MenuItem value="ar">العربية</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />
              </Box>

              <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 calc(50% - 12px)' } }}>
                <Controller
                  name="settings.mapType"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>{isRTL ? 'نوع الخريطة' : 'Map Type'}</InputLabel>
                      <Select {...field} label={isRTL ? 'نوع الخريطة' : 'Map Type'}>
                        <MenuItem value="google">Google Maps</MenuItem>
                        <MenuItem value="osm">OpenStreetMap</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />
              </Box>

              <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 calc(50% - 12px)' } }}>
                <Controller
                  name="settings.showGroupEvents"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Switch {...field} checked={field.value} />}
                      label={isRTL ? 'عرض الأحداث الجماعية' : 'Show Group Events'}
                    />
                  )}
                />
              </Box>

              {watch('settings.showGroupEvents') && (
                <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 calc(50% - 12px)' } }}>
                  <Controller
                    name="settings.groupEventsDisplay"
                    control={control}
                    render={({ field }) => (
                      <FormControl fullWidth>
                        <InputLabel>{isRTL ? 'عرض الأحداث الجماعية' : 'Group Events Display'}</InputLabel>
                        <Select {...field} label={isRTL ? 'عرض الأحداث الجماعية' : 'Group Events Display'}>
                          <MenuItem value="allOnPage">{isRTL ? 'الكل في صفحة واحدة' : 'All on Page'}</MenuItem>
                          <MenuItem value="byDays">{isRTL ? 'حسب الأيام' : 'By Days'}</MenuItem>
                        </Select>
                      </FormControl>
                    )}
                  />
                </Box>
              )}
            </Box>
          </TabPanel>
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose}>
            {isRTL ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button type="submit" variant="contained" disabled={loading}>
            {loading
              ? isRTL ? 'جاري الحفظ...' : 'Saving...'
              : link
              ? isRTL ? 'تحديث' : 'Update'
              : isRTL ? 'إنشاء' : 'Create'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default BookingLinkForm;