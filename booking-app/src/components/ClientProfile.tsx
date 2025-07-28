import React, { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Grid,
  Avatar,
  IconButton,
} from '@mui/material';
import {
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Home as HomeIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Timestamp } from 'firebase/firestore';
import { ar, enUS } from 'date-fns/locale';
import { useLanguage } from '../contexts/LanguageContext';
import { useClientAuth } from '../contexts/ClientAuthContext';
import { clientService, type Client } from '../services/client.service';
import { format } from 'date-fns';

const ClientProfile: React.FC = () => {
  const { t, language } = useLanguage();
  const { session } = useClientAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [client, setClient] = useState<Client | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    gender: 'not_specified' as 'male' | 'female' | 'other' | 'not_specified',
    dateOfBirth: null as Date | null,
    address: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'Egypt',
    },
    marketing: {
      acceptsSMS: false,
      acceptsEmail: false,
      acceptsPromotions: false,
    },
  });

  useEffect(() => {
    if (session?.clientId) {
      loadClientData();
    }
  }, [session]);

  const loadClientData = async () => {
    if (!session?.clientId || session.clientId === 'mock-client-123') {
      setError(t('profile_not_available_mock'));
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const clientData = await clientService.getClient(session.clientId);
      
      if (clientData) {
        setClient(clientData);
        setFormData({
          firstName: clientData.firstName || '',
          lastName: clientData.lastName || '',
          email: clientData.email || '',
          phone: clientData.phone || '',
          gender: clientData.gender || 'not_specified',
          dateOfBirth: clientData.dateOfBirth ? clientData.dateOfBirth.toDate() : null,
          address: {
            street: clientData.address?.street || '',
            city: clientData.address?.city || '',
            state: clientData.address?.state || '',
            zipCode: clientData.address?.zipCode || '',
            country: clientData.address?.country || 'Egypt',
          },
          marketing: {
            acceptsSMS: clientData.marketing?.acceptsSMS || false,
            acceptsEmail: clientData.marketing?.acceptsEmail || false,
            acceptsPromotions: clientData.marketing?.acceptsPromotions || false,
          },
        });
      }
    } catch (err) {
      console.error('Error loading client data:', err);
      setError(t('error_loading_profile'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!session?.clientId || !client) return;
    
    setSaving(true);
    setError(null);
    setSuccess(false);
    
    try {
      const updates: Partial<Client> = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        gender: formData.gender,
        dateOfBirth: formData.dateOfBirth ? Timestamp.fromDate(formData.dateOfBirth) : undefined,
        address: formData.address,
        marketing: formData.marketing,
      };
      
      await clientService.updateClient(session.clientId, updates);
      
      setSuccess(true);
      setIsEditing(false);
      
      // Reload data to get updated values
      await loadClientData();
      
      // Update session name if changed
      if (formData.firstName !== session.name) {
        // Update local session with new name
        const updatedSession = {
          ...session,
          name: `${formData.firstName} ${formData.lastName}`.trim()
        };
        localStorage.setItem('clientPortalSession', JSON.stringify(updatedSession));
      }
    } catch (err) {
      console.error('Error saving profile:', err);
      setError(t('error_saving_profile'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setError(null);
    // Reset form to original data
    if (client) {
      setFormData({
        firstName: client.firstName || '',
        lastName: client.lastName || '',
        email: client.email || '',
        phone: client.phone || '',
        gender: client.gender || 'not_specified',
        dateOfBirth: client.dateOfBirth ? client.dateOfBirth.toDate() : null,
        address: {
          street: client.address?.street || '',
          city: client.address?.city || '',
          state: client.address?.state || '',
          zipCode: client.address?.zipCode || '',
          country: client.address?.country || 'Egypt',
        },
        marketing: {
          acceptsSMS: client.marketing?.acceptsSMS || false,
          acceptsEmail: client.marketing?.acceptsEmail || false,
          acceptsPromotions: client.marketing?.acceptsPromotions || false,
        },
      });
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && !client) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  const getInitials = () => {
    const first = formData.firstName?.charAt(0) || '';
    const last = formData.lastName?.charAt(0) || '';
    return (first + last).toUpperCase() || '?';
  };

  return (
    <Paper sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Avatar sx={{ width: 80, height: 80, mr: 2, bgcolor: 'primary.main' }}>
          <Typography variant="h4">{getInitials()}</Typography>
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5">
            {formData.firstName} {formData.lastName}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {session?.phoneNumber}
          </Typography>
        </Box>
        {!isEditing ? (
          <IconButton
            color="primary"
            onClick={() => setIsEditing(true)}
            size="large"
          >
            <EditIcon />
          </IconButton>
        ) : (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={saving}
            >
              {t('save')}
            </Button>
            <Button
              variant="outlined"
              startIcon={<CancelIcon />}
              onClick={handleCancel}
              disabled={saving}
            >
              {t('cancel')}
            </Button>
          </Box>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {t('profile_updated_successfully')}
        </Alert>
      )}

      <Divider sx={{ mb: 3 }} />

      {/* Personal Information */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PersonIcon />
          {t('personal_information')}
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label={t('first_name')}
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              disabled={!isEditing}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label={t('last_name')}
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              disabled={!isEditing}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth disabled={!isEditing}>
              <InputLabel>{t('gender')}</InputLabel>
              <Select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                label={t('gender')}
              >
                <MenuItem value="male">{t('male')}</MenuItem>
                <MenuItem value="female">{t('female')}</MenuItem>
                <MenuItem value="other">{t('other')}</MenuItem>
                <MenuItem value="not_specified">{t('prefer_not_to_say')}</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <LocalizationProvider dateAdapter={AdapterDateFns} locale={language === 'ar' ? ar : enUS}>
              <DatePicker
                label={t('date_of_birth')}
                value={formData.dateOfBirth}
                onChange={(date) => setFormData({ ...formData, dateOfBirth: date })}
                disabled={!isEditing}
                slotProps={{ textField: { fullWidth: true } }}
                maxDate={new Date()}
              />
            </LocalizationProvider>
          </Grid>
        </Grid>
      </Box>

      {/* Contact Information */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PhoneIcon />
          {t('contact_information')}
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label={t('phone')}
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              disabled={!isEditing}
              helperText={isEditing ? t('phone_will_be_normalized') : ''}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label={t('email')}
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              disabled={!isEditing}
            />
          </Grid>
        </Grid>
      </Box>

      {/* Address */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HomeIcon />
          {t('address')}
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label={t('street')}
              value={formData.address.street}
              onChange={(e) => setFormData({
                ...formData,
                address: { ...formData.address, street: e.target.value }
              })}
              disabled={!isEditing}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label={t('city')}
              value={formData.address.city}
              onChange={(e) => setFormData({
                ...formData,
                address: { ...formData.address, city: e.target.value }
              })}
              disabled={!isEditing}
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              fullWidth
              label={t('state')}
              value={formData.address.state}
              onChange={(e) => setFormData({
                ...formData,
                address: { ...formData.address, state: e.target.value }
              })}
              disabled={!isEditing}
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              fullWidth
              label={t('zip_code')}
              value={formData.address.zipCode}
              onChange={(e) => setFormData({
                ...formData,
                address: { ...formData.address, zipCode: e.target.value }
              })}
              disabled={!isEditing}
            />
          </Grid>
        </Grid>
      </Box>

      {/* Marketing Preferences */}
      <Box>
        <Typography variant="h6" gutterBottom>
          {t('marketing_preferences')}
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={formData.marketing.acceptsSMS}
                onChange={(e) => setFormData({
                  ...formData,
                  marketing: { ...formData.marketing, acceptsSMS: e.target.checked }
                })}
                disabled={!isEditing}
              />
            }
            label={t('receive_sms_notifications')}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={formData.marketing.acceptsEmail}
                onChange={(e) => setFormData({
                  ...formData,
                  marketing: { ...formData.marketing, acceptsEmail: e.target.checked }
                })}
                disabled={!isEditing}
              />
            }
            label={t('receive_email_notifications')}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={formData.marketing.acceptsPromotions}
                onChange={(e) => setFormData({
                  ...formData,
                  marketing: { ...formData.marketing, acceptsPromotions: e.target.checked }
                })}
                disabled={!isEditing}
              />
            }
            label={t('receive_promotional_offers')}
          />
        </Box>
      </Box>
    </Paper>
  );
};

export default ClientProfile;