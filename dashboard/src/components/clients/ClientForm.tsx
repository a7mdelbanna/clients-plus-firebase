import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Box,
  IconButton,
  Typography,
  CircularProgress,
  useTheme,
  Tab,
  Tabs,
  Stack,
} from '@mui/material';
import {
  Close,
  Save,
  Business,
  Email,
  Phone,
  LocationOn,
  Label,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { clientService } from '../../services/client.service';
import type { Client } from '../../services/client.service';
import { useAuth } from '../../contexts/AuthContext';
import { useBranch } from '../../contexts/BranchContext';
import { toast } from 'react-toastify';

interface ClientFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  client?: Client | null;
  mode: 'add' | 'edit';
}

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
      id={`client-tabpanel-${index}`}
      aria-labelledby={`client-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

// Create schema inside component to access isRTL
const createSchema = (isRTL: boolean) => yup.object({
  name: yup.string().required(isRTL ? 'اسم العميل مطلوب' : 'Client name is required'),
  nameAr: yup.string(),
  email: yup.string()
    .email(isRTL ? 'البريد الإلكتروني غير صالح' : 'Invalid email')
    .required(isRTL ? 'البريد الإلكتروني مطلوب' : 'Email is required'),
  phone: yup.string().required(isRTL ? 'رقم الهاتف مطلوب' : 'Phone number is required'),
  mobile: yup.string(),
  address: yup.string().required(isRTL ? 'العنوان مطلوب' : 'Address is required'),
  addressAr: yup.string(),
  city: yup.string(),
  country: yup.string(),
  postalCode: yup.string(),
  website: yup.string().url(isRTL ? 'الموقع الإلكتروني غير صالح' : 'Invalid website URL'),
  industry: yup.string(),
  taxNumber: yup.string(),
  status: yup.string().oneOf(['active', 'inactive', 'prospect']).required(isRTL ? 'الحالة مطلوبة' : 'Status is required'),
  tags: yup.array().of(yup.string()),
  notes: yup.string(),
});

type FormData = {
  name: string;
  nameAr?: string;
  email: string;
  phone: string;
  mobile?: string;
  address: string;
  addressAr?: string;
  city?: string;
  country?: string;
  postalCode?: string;
  website?: string;
  industry?: string;
  taxNumber?: string;
  status: 'active' | 'inactive' | 'prospect';
  tags?: string[];
  notes?: string;
};


const ClientForm: React.FC<ClientFormProps> = ({
  open,
  onClose,
  onSuccess,
  client,
  mode,
}) => {
  const theme = useTheme();
  const { currentUser } = useAuth();
  const { currentBranch } = useBranch();
  const isRTL = theme.direction === 'rtl';
  const [loading, setLoading] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [tagInput, setTagInput] = useState('');

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isValid },
  } = useForm<FormData>({
    resolver: yupResolver(createSchema(isRTL)),
    defaultValues: {
      name: '',
      nameAr: '',
      email: '',
      phone: '',
      mobile: '',
      address: '',
      addressAr: '',
      city: '',
      country: 'Saudi Arabia',
      postalCode: '',
      website: '',
      industry: '',
      taxNumber: '',
      status: 'active',
      tags: [],
      notes: '',
    },
  });

  const watchedTags = watch('tags') || [];

  useEffect(() => {
    if (client && mode === 'edit') {
      reset({
        name: client.name,
        nameAr: client.nameAr || '',
        email: client.email,
        phone: client.phone,
        mobile: client.mobile || '',
        address: client.address,
        addressAr: client.addressAr || '',
        city: client.city || '',
        country: client.country || 'Saudi Arabia',
        postalCode: client.postalCode || '',
        website: client.website || '',
        industry: client.industry || '',
        taxNumber: client.taxNumber || '',
        status: client.status,
        tags: client.tags || [],
        notes: client.notes || '',
      });
    } else {
      reset();
    }
  }, [client, mode, reset]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleAddTag = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && tagInput.trim()) {
      event.preventDefault();
      const newTag = tagInput.trim();
      if (!watchedTags.includes(newTag)) {
        setValue('tags', [...watchedTags, newTag]);
      }
      setTagInput('');
    }
  };

  const handleDeleteTag = (tagToDelete: string) => {
    setValue('tags', watchedTags.filter((tag: string) => tag !== tagToDelete));
  };

  const onSubmit = async (data: FormData) => {
    console.log('Form submitted with data:', data);
    console.log('Form errors:', errors);
    console.log('Current user:', currentUser);
    console.log('All form values:', watch());
    console.log('Form state:', { isValid: formState.isValid, errors: formState.errors });
    
    if (!currentUser) {
      console.error('No current user');
      return;
    }

    try {
      setLoading(true);
      const idTokenResult = await currentUser.getIdTokenResult();
      const companyId = idTokenResult.claims.companyId as string;
      console.log('Company ID:', companyId);

      if (!companyId) {
        toast.error(isRTL ? 'لم يتم العثور على معرف الشركة' : 'Company ID not found');
        return;
      }

      if (mode === 'add') {
        console.log('Creating client with data:', { ...data, companyId });
        await clientService.createClient(
          {
            ...data,
            companyId,
            branchId: currentBranch?.id,
          },
          currentUser.uid,
          currentBranch?.id
        );
        toast.success(isRTL ? 'تم إضافة العميل بنجاح' : 'Client added successfully');
      } else if (mode === 'edit' && client?.id) {
        await clientService.updateClient(client.id, data);
        toast.success(isRTL ? 'تم تحديث العميل بنجاح' : 'Client updated successfully');
      }

      onSuccess?.();
      handleClose();
    } catch (error) {
      console.error('Error saving client:', error);
      toast.error(
        mode === 'add'
          ? (isRTL ? 'فشل إضافة العميل' : 'Failed to add client')
          : (isRTL ? 'فشل تحديث العميل' : 'Failed to update client')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    reset();
    setTabValue(0);
    setTagInput('');
    onClose();
  };

  const FieldRow = ({ children }: { children: React.ReactNode }) => (
    <Box
      sx={{
        display: 'flex',
        gap: 3,
        flexWrap: { xs: 'wrap', md: 'nowrap' },
        '& > *': {
          flex: '1 1 300px',
          minWidth: 0,
        },
      }}
    >
      {children}
    </Box>
  );

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        component: motion.div,
        initial: { opacity: 0, scale: 0.9 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.9 },
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Business />
            <Typography variant="h6">
              {mode === 'add'
                ? (isRTL ? 'إضافة عميل جديد' : 'Add New Client')
                : (isRTL ? 'تعديل بيانات العميل' : 'Edit Client')}
            </Typography>
          </Box>
          <IconButton onClick={handleClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          {/* Debug: Show validation errors */}
          {Object.keys(errors).length > 0 && (
            <Box sx={{ mb: 2, p: 2, bgcolor: 'error.light', borderRadius: 1 }}>
              <Typography variant="body2" color="error.contrastText">
                {isRTL ? 'يرجى تصحيح الأخطاء التالية:' : 'Please fix the following errors:'}
              </Typography>
              {Object.entries(errors).map(([field, error]) => (
                <Typography key={field} variant="caption" color="error.contrastText">
                  • {field}: {error.message}
                </Typography>
              ))}
            </Box>
          )}
          <Tabs value={tabValue} onChange={handleTabChange} sx={{ mb: 2 }}>
            <Tab
              icon={<Business />}
              label={isRTL ? 'المعلومات الأساسية' : 'Basic Info'}
              iconPosition="start"
            />
            <Tab
              icon={<LocationOn />}
              label={isRTL ? 'العنوان' : 'Address'}
              iconPosition="start"
            />
            <Tab
              icon={<Label />}
              label={isRTL ? 'إضافية' : 'Additional'}
              iconPosition="start"
            />
          </Tabs>

          {/* Basic Info Tab */}
          <TabPanel value={tabValue} index={0}>
            <Stack spacing={3}>
              <FieldRow>
                <Controller
                  name="name"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label={isRTL ? 'اسم العميل (English)' : 'Client Name (English)'}
                      error={!!errors.name}
                      helperText={errors.name?.message}
                      InputProps={{
                        startAdornment: <Business sx={{ mr: 1, color: 'text.secondary' }} />,
                      }}
                    />
                  )}
                />
                <Controller
                  name="nameAr"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label={isRTL ? 'اسم العميل (عربي)' : 'Client Name (Arabic)'}
                      dir="rtl"
                    />
                  )}
                />
              </FieldRow>

              <FieldRow>
                <Controller
                  name="email"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      type="email"
                      label={isRTL ? 'البريد الإلكتروني' : 'Email'}
                      error={!!errors.email}
                      helperText={errors.email?.message}
                      InputProps={{
                        startAdornment: <Email sx={{ mr: 1, color: 'text.secondary' }} />,
                      }}
                    />
                  )}
                />
                <Controller
                  name="phone"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label={isRTL ? 'رقم الهاتف' : 'Phone'}
                      error={!!errors.phone}
                      helperText={errors.phone?.message}
                      InputProps={{
                        startAdornment: <Phone sx={{ mr: 1, color: 'text.secondary' }} />,
                      }}
                    />
                  )}
                />
              </FieldRow>

              <FieldRow>
                <Controller
                  name="mobile"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label={isRTL ? 'رقم الجوال' : 'Mobile'}
                      InputProps={{
                        startAdornment: <Phone sx={{ mr: 1, color: 'text.secondary' }} />,
                      }}
                    />
                  )}
                />
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.status}>
                      <InputLabel>{isRTL ? 'الحالة' : 'Status'}</InputLabel>
                      <Select {...field} label={isRTL ? 'الحالة' : 'Status'}>
                        <MenuItem value="active">{isRTL ? 'نشط' : 'Active'}</MenuItem>
                        <MenuItem value="inactive">{isRTL ? 'غير نشط' : 'Inactive'}</MenuItem>
                        <MenuItem value="prospect">{isRTL ? 'محتمل' : 'Prospect'}</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />
              </FieldRow>
            </Stack>
          </TabPanel>

          {/* Address Tab */}
          <TabPanel value={tabValue} index={1}>
            <Stack spacing={3}>
              <Controller
                name="address"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    multiline
                    rows={2}
                    label={isRTL ? 'العنوان (English)' : 'Address (English)'}
                    error={!!errors.address}
                    helperText={errors.address?.message}
                  />
                )}
              />
              <Controller
                name="addressAr"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    multiline
                    rows={2}
                    label={isRTL ? 'العنوان (عربي)' : 'Address (Arabic)'}
                    dir="rtl"
                  />
                )}
              />
              <Box
                sx={{
                  display: 'flex',
                  gap: 3,
                  flexWrap: { xs: 'wrap', md: 'nowrap' },
                  '& > *': {
                    flex: '1 1 200px',
                    minWidth: 0,
                  },
                }}
              >
                <Controller
                  name="city"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label={isRTL ? 'المدينة' : 'City'}
                    />
                  )}
                />
                <Controller
                  name="country"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label={isRTL ? 'الدولة' : 'Country'}
                    />
                  )}
                />
                <Controller
                  name="postalCode"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label={isRTL ? 'الرمز البريدي' : 'Postal Code'}
                    />
                  )}
                />
              </Box>
            </Stack>
          </TabPanel>

          {/* Additional Tab */}
          <TabPanel value={tabValue} index={2}>
            <Stack spacing={3}>
              <FieldRow>
                <Controller
                  name="website"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label={isRTL ? 'الموقع الإلكتروني' : 'Website'}
                      error={!!errors.website}
                      helperText={errors.website?.message}
                    />
                  )}
                />
                <Controller
                  name="industry"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label={isRTL ? 'الصناعة' : 'Industry'}
                    />
                  )}
                />
              </FieldRow>

              <FieldRow>
                <Controller
                  name="taxNumber"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label={isRTL ? 'الرقم الضريبي' : 'Tax Number'}
                    />
                  )}
                />
                <TextField
                  fullWidth
                  label={isRTL ? 'العلامات' : 'Tags'}
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={handleAddTag}
                  placeholder={isRTL ? 'اضغط Enter لإضافة علامة' : 'Press Enter to add tag'}
                />
              </FieldRow>

              {watchedTags.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {watchedTags.map((tag) => (
                    <Chip
                      key={tag}
                      label={tag}
                      size="small"
                      onDelete={() => handleDeleteTag(tag)}
                    />
                  ))}
                </Box>
              )}

              <Controller
                name="notes"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    multiline
                    rows={4}
                    label={isRTL ? 'ملاحظات' : 'Notes'}
                  />
                )}
              />
            </Stack>
          </TabPanel>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} disabled={loading}>
            {isRTL ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button
            type="submit"
            variant="contained"
            startIcon={loading ? <CircularProgress size={20} /> : <Save />}
            disabled={loading}
            onClick={() => console.log('Button clicked, form errors:', errors)}
          >
            {mode === 'add'
              ? (isRTL ? 'إضافة' : 'Add')
              : (isRTL ? 'حفظ' : 'Save')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default ClientForm;