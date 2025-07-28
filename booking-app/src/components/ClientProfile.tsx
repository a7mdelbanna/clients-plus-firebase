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
  Tabs,
  Tab,
  Chip,
  RadioGroup,
  Radio,
  Slider,
} from '@mui/material';
import {
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Home as HomeIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Schedule as ScheduleIcon,
  ChatBubbleOutline as ChatIcon,
  LocalDrink as DrinkIcon,
  MusicNote as MusicIcon,
  Thermostat as ThermostatIcon,
  Spa as SpaIcon,
  LocalHospital as MedicalIcon,
  Warning as WarningIcon,
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
  const [activeTab, setActiveTab] = useState(0);
  
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
    preferences: {
      preferredDays: [] as string[],
      preferredTimes: [] as string[],
      roomPreferences: '',
      communicationLanguage: '',
      communicationStyle: 'chatty' as 'silent' | 'minimal' | 'chatty' | 'very_social',
      favoriteDrinks: [] as string[],
      musicPreferences: {
        genres: [] as string[],
        volume: 'moderate' as 'quiet' | 'moderate' | 'loud',
        preference: 'background' as 'no_music' | 'background' | 'engaged',
      },
      temperaturePreference: 'moderate' as 'cold' | 'cool' | 'moderate' | 'warm' | 'hot',
      aromatherapy: [] as string[],
      specialRequests: '',
    },
    medical: {
      allergies: [] as string[],
      conditions: [] as string[],
      medications: [] as string[],
      notes: '',
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
          preferences: {
            preferredDays: clientData.preferences?.preferredDays || [],
            preferredTimes: clientData.preferences?.preferredTimes || [],
            roomPreferences: clientData.preferences?.roomPreferences || '',
            communicationLanguage: clientData.preferences?.communicationLanguage || '',
            communicationStyle: clientData.preferences?.communicationStyle || 'chatty',
            favoriteDrinks: clientData.preferences?.favoriteDrinks || [],
            musicPreferences: {
              genres: clientData.preferences?.musicPreferences?.genres || [],
              volume: clientData.preferences?.musicPreferences?.volume || 'moderate',
              preference: clientData.preferences?.musicPreferences?.preference || 'background',
            },
            temperaturePreference: clientData.preferences?.temperaturePreference || 'moderate',
            aromatherapy: clientData.preferences?.aromatherapy || [],
            specialRequests: clientData.preferences?.specialRequests || '',
          },
          medical: {
            allergies: clientData.medical?.allergies || [],
            conditions: clientData.medical?.conditions || [],
            medications: clientData.medical?.medications || [],
            notes: clientData.medical?.notes || '',
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
        preferences: formData.preferences,
        medical: formData.medical,
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
        preferences: {
          preferredDays: client.preferences?.preferredDays || [],
          preferredTimes: client.preferences?.preferredTimes || [],
          roomPreferences: client.preferences?.roomPreferences || '',
          communicationLanguage: client.preferences?.communicationLanguage || '',
          communicationStyle: client.preferences?.communicationStyle || 'chatty',
          favoriteDrinks: client.preferences?.favoriteDrinks || [],
          musicPreferences: {
            genres: client.preferences?.musicPreferences?.genres || [],
            volume: client.preferences?.musicPreferences?.volume || 'moderate',
            preference: client.preferences?.musicPreferences?.preference || 'background',
          },
          temperaturePreference: client.preferences?.temperaturePreference || 'moderate',
          aromatherapy: client.preferences?.aromatherapy || [],
          specialRequests: client.preferences?.specialRequests || '',
        },
        medical: {
          allergies: client.medical?.allergies || [],
          conditions: client.medical?.conditions || [],
          medications: client.medical?.medications || [],
          notes: client.medical?.notes || '',
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

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(_, newValue) => setActiveTab(newValue)}
        sx={{ mb: 3 }}
      >
        <Tab label={t('personal_information')} />
        <Tab label={t('preferences')} />
        <Tab label={t('medical')} />
      </Tabs>

      {/* Tab Panels */}
      {activeTab === 0 && (
        <Box>
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
        </Box>
      )}

      {/* Preferences Tab */}
      {activeTab === 1 && (
        <Box>
          {/* Service Preferences */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ScheduleIcon />
              {t('service_preferences')}
            </Typography>
            
            {/* Preferred Days */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" sx={{ mb: 1.5, fontWeight: 500 }}>
                {t('preferred_days')}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {[
                  { value: 'sunday', label: t('sunday') },
                  { value: 'monday', label: t('monday') },
                  { value: 'tuesday', label: t('tuesday') },
                  { value: 'wednesday', label: t('wednesday') },
                  { value: 'thursday', label: t('thursday') },
                  { value: 'friday', label: t('friday') },
                  { value: 'saturday', label: t('saturday') },
                ].map((day) => {
                  const isSelected = formData.preferences.preferredDays.includes(day.value);
                  return (
                    <Chip
                      key={day.value}
                      label={day.label}
                      onClick={() => {
                        if (!isEditing) return;
                        const newDays = isSelected
                          ? formData.preferences.preferredDays.filter(d => d !== day.value)
                          : [...formData.preferences.preferredDays, day.value];
                        setFormData({
                          ...formData,
                          preferences: { ...formData.preferences, preferredDays: newDays }
                        });
                      }}
                      color={isSelected ? 'primary' : 'default'}
                      variant={isSelected ? 'filled' : 'outlined'}
                      sx={{ cursor: isEditing ? 'pointer' : 'default' }}
                    />
                  );
                })}
              </Box>
            </Box>

            {/* Preferred Times */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" sx={{ mb: 1.5, fontWeight: 500 }}>
                {t('preferred_times')}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {[
                  { value: 'morning', label: t('morning') },
                  { value: 'afternoon', label: t('afternoon') },
                  { value: 'evening', label: t('evening') },
                ].map((time) => {
                  const isSelected = formData.preferences.preferredTimes.includes(time.value);
                  return (
                    <Chip
                      key={time.value}
                      label={time.label}
                      onClick={() => {
                        if (!isEditing) return;
                        const newTimes = isSelected
                          ? formData.preferences.preferredTimes.filter(t => t !== time.value)
                          : [...formData.preferences.preferredTimes, time.value];
                        setFormData({
                          ...formData,
                          preferences: { ...formData.preferences, preferredTimes: newTimes }
                        });
                      }}
                      color={isSelected ? 'primary' : 'default'}
                      variant={isSelected ? 'filled' : 'outlined'}
                      sx={{ cursor: isEditing ? 'pointer' : 'default' }}
                    />
                  );
                })}
              </Box>
            </Box>

            {/* Room Preferences */}
            <TextField
              fullWidth
              label={t('room_preferences')}
              value={formData.preferences.roomPreferences}
              onChange={(e) => setFormData({
                ...formData,
                preferences: { ...formData.preferences, roomPreferences: e.target.value }
              })}
              disabled={!isEditing}
              multiline
              rows={2}
            />
          </Box>

          {/* Communication Preferences */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ChatIcon />
              {t('communication_preferences')}
            </Typography>

            {/* Communication Style */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" sx={{ mb: 1.5, fontWeight: 500 }}>
                {t('communication_style')}
              </Typography>
              <RadioGroup
                value={formData.preferences.communicationStyle}
                onChange={(e) => setFormData({
                  ...formData,
                  preferences: { ...formData.preferences, communicationStyle: e.target.value as any }
                })}
                row
              >
                <FormControlLabel 
                  value="silent" 
                  control={<Radio />} 
                  label={`🤫 ${t('silent')}`}
                  disabled={!isEditing}
                />
                <FormControlLabel 
                  value="minimal" 
                  control={<Radio />} 
                  label={`😐 ${t('minimal')}`}
                  disabled={!isEditing}
                />
                <FormControlLabel 
                  value="chatty" 
                  control={<Radio />} 
                  label={`😊 ${t('chatty')}`}
                  disabled={!isEditing}
                />
                <FormControlLabel 
                  value="very_social" 
                  control={<Radio />} 
                  label={`😄 ${t('very_social')}`}
                  disabled={!isEditing}
                />
              </RadioGroup>
            </Box>

            {/* Communication Language */}
            <FormControl fullWidth>
              <InputLabel>{t('communication_language')}</InputLabel>
              <Select
                value={formData.preferences.communicationLanguage}
                onChange={(e) => setFormData({
                  ...formData,
                  preferences: { ...formData.preferences, communicationLanguage: e.target.value }
                })}
                label={t('communication_language')}
                disabled={!isEditing}
              >
                <MenuItem value="">-</MenuItem>
                <MenuItem value="ar">{language === 'ar' ? 'العربية' : 'Arabic'}</MenuItem>
                <MenuItem value="en">{language === 'ar' ? 'الإنجليزية' : 'English'}</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Lifestyle Preferences */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <DrinkIcon />
              {t('lifestyle_preferences')}
            </Typography>

            {/* Favorite Drinks */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" sx={{ mb: 1.5, fontWeight: 500 }}>
                {t('favorite_drinks')}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                {formData.preferences.favoriteDrinks.map((drink, index) => (
                  <Chip
                    key={index}
                    label={drink}
                    onDelete={isEditing ? () => {
                      const newDrinks = formData.preferences.favoriteDrinks.filter((_, i) => i !== index);
                      setFormData({
                        ...formData,
                        preferences: { ...formData.preferences, favoriteDrinks: newDrinks }
                      });
                    } : undefined}
                    color="primary"
                    variant="outlined"
                  />
                ))}
              </Box>
              {isEditing && (
                <TextField
                  fullWidth
                  placeholder={language === 'ar' ? 'أضف مشروبًا مفضلاً واضغط Enter' : 'Add favorite drink and press Enter'}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.target as any).value.trim()) {
                      e.preventDefault();
                      const newDrink = (e.target as any).value.trim();
                      if (!formData.preferences.favoriteDrinks.includes(newDrink)) {
                        setFormData({
                          ...formData,
                          preferences: {
                            ...formData.preferences,
                            favoriteDrinks: [...formData.preferences.favoriteDrinks, newDrink]
                          }
                        });
                        (e.target as any).value = '';
                      }
                    }
                  }}
                />
              )}
            </Box>

            {/* Music Preferences */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <MusicIcon />
                {t('music_preferences')}
              </Typography>

              <RadioGroup
                value={formData.preferences.musicPreferences.preference}
                onChange={(e) => setFormData({
                  ...formData,
                  preferences: {
                    ...formData.preferences,
                    musicPreferences: {
                      ...formData.preferences.musicPreferences,
                      preference: e.target.value as any
                    }
                  }
                })}
                row
                sx={{ mb: 2 }}
              >
                <FormControlLabel 
                  value="no_music" 
                  control={<Radio />} 
                  label={t('no_music')}
                  disabled={!isEditing}
                />
                <FormControlLabel 
                  value="background" 
                  control={<Radio />} 
                  label={t('background')}
                  disabled={!isEditing}
                />
                <FormControlLabel 
                  value="engaged" 
                  control={<Radio />} 
                  label={t('engaged')}
                  disabled={!isEditing}
                />
              </RadioGroup>

              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                {t('music_volume')}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography>🔇</Typography>
                <Slider
                  value={
                    formData.preferences.musicPreferences.volume === 'quiet' ? 1 :
                    formData.preferences.musicPreferences.volume === 'moderate' ? 2 : 3
                  }
                  onChange={(_, value) => {
                    if (!isEditing) return;
                    const volume = value === 1 ? 'quiet' : value === 2 ? 'moderate' : 'loud';
                    setFormData({
                      ...formData,
                      preferences: {
                        ...formData.preferences,
                        musicPreferences: {
                          ...formData.preferences.musicPreferences,
                          volume: volume as any
                        }
                      }
                    });
                  }}
                  min={1}
                  max={3}
                  marks
                  disabled={!isEditing}
                  sx={{ flex: 1 }}
                />
                <Typography>🔊</Typography>
              </Box>
            </Box>

            {/* Temperature Preference */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ThermostatIcon />
                {t('temperature_preference')}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography>❄️</Typography>
                <Slider
                  value={
                    formData.preferences.temperaturePreference === 'cold' ? 1 :
                    formData.preferences.temperaturePreference === 'cool' ? 2 :
                    formData.preferences.temperaturePreference === 'moderate' ? 3 :
                    formData.preferences.temperaturePreference === 'warm' ? 4 : 5
                  }
                  onChange={(_, value) => {
                    if (!isEditing) return;
                    const temp = 
                      value === 1 ? 'cold' :
                      value === 2 ? 'cool' :
                      value === 3 ? 'moderate' :
                      value === 4 ? 'warm' : 'hot';
                    setFormData({
                      ...formData,
                      preferences: { ...formData.preferences, temperaturePreference: temp as any }
                    });
                  }}
                  min={1}
                  max={5}
                  marks
                  disabled={!isEditing}
                  sx={{ flex: 1 }}
                />
                <Typography>🔥</Typography>
              </Box>
            </Box>

            {/* Special Requests */}
            <TextField
              fullWidth
              label={t('special_requests')}
              value={formData.preferences.specialRequests}
              onChange={(e) => setFormData({
                ...formData,
                preferences: { ...formData.preferences, specialRequests: e.target.value }
              })}
              disabled={!isEditing}
              multiline
              rows={3}
              placeholder={language === 'ar' ? 'أي طلبات أو ملاحظات خاصة...' : 'Any special requests or notes...'}
            />
          </Box>
        </Box>
      )}

      {/* Medical Tab */}
      {activeTab === 2 && (
        <Box>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
            <MedicalIcon />
            {t('medical_information')}
          </Typography>

          {/* Allergies */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="body1" sx={{ mb: 1.5, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 1 }}>
              <WarningIcon sx={{ color: 'error.main', fontSize: 20 }} />
              {t('allergies')}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
              {formData.medical.allergies.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {t('no_allergies')}
                </Typography>
              ) : (
                formData.medical.allergies.map((allergy, index) => (
                  <Chip
                    key={index}
                    label={allergy}
                    onDelete={isEditing ? () => {
                      const newAllergies = formData.medical.allergies.filter((_, i) => i !== index);
                      setFormData({
                        ...formData,
                        medical: { ...formData.medical, allergies: newAllergies }
                      });
                    } : undefined}
                    sx={{
                      backgroundColor: '#f44336' + '20',
                      color: '#f44336',
                      borderColor: '#f44336',
                      border: '1px solid',
                      '& .MuiChip-deleteIcon': {
                        color: '#f44336',
                      },
                    }}
                  />
                ))
              )}
            </Box>
            {isEditing && (
              <TextField
                fullWidth
                placeholder={t('add_allergy')}
                size="small"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.target as any).value.trim()) {
                    e.preventDefault();
                    const newAllergy = (e.target as any).value.trim();
                    if (!formData.medical.allergies.includes(newAllergy)) {
                      setFormData({
                        ...formData,
                        medical: {
                          ...formData.medical,
                          allergies: [...formData.medical.allergies, newAllergy]
                        }
                      });
                      (e.target as any).value = '';
                    }
                  }
                }}
              />
            )}
          </Box>

          {/* Chronic Conditions */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="body1" sx={{ mb: 1.5, fontWeight: 500 }}>
              {t('chronic_conditions')}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
              {formData.medical.conditions.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {t('no_conditions')}
                </Typography>
              ) : (
                formData.medical.conditions.map((condition, index) => (
                  <Chip
                    key={index}
                    label={condition}
                    onDelete={isEditing ? () => {
                      const newConditions = formData.medical.conditions.filter((_, i) => i !== index);
                      setFormData({
                        ...formData,
                        medical: { ...formData.medical, conditions: newConditions }
                      });
                    } : undefined}
                    sx={{
                      backgroundColor: '#ff9800' + '20',
                      color: '#ff9800',
                      borderColor: '#ff9800',
                      border: '1px solid',
                      '& .MuiChip-deleteIcon': {
                        color: '#ff9800',
                      },
                    }}
                  />
                ))
              )}
            </Box>
            {isEditing && (
              <TextField
                fullWidth
                placeholder={t('add_condition')}
                size="small"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.target as any).value.trim()) {
                    e.preventDefault();
                    const newCondition = (e.target as any).value.trim();
                    if (!formData.medical.conditions.includes(newCondition)) {
                      setFormData({
                        ...formData,
                        medical: {
                          ...formData.medical,
                          conditions: [...formData.medical.conditions, newCondition]
                        }
                      });
                      (e.target as any).value = '';
                    }
                  }
                }}
              />
            )}
          </Box>

          {/* Current Medications */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="body1" sx={{ mb: 1.5, fontWeight: 500 }}>
              {t('current_medications')}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
              {formData.medical.medications.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {t('no_medications')}
                </Typography>
              ) : (
                formData.medical.medications.map((medication, index) => (
                  <Chip
                    key={index}
                    label={medication}
                    onDelete={isEditing ? () => {
                      const newMedications = formData.medical.medications.filter((_, i) => i !== index);
                      setFormData({
                        ...formData,
                        medical: { ...formData.medical, medications: newMedications }
                      });
                    } : undefined}
                    sx={{
                      backgroundColor: '#2196f3' + '20',
                      color: '#2196f3',
                      borderColor: '#2196f3',
                      border: '1px solid',
                      '& .MuiChip-deleteIcon': {
                        color: '#2196f3',
                      },
                    }}
                  />
                ))
              )}
            </Box>
            {isEditing && (
              <TextField
                fullWidth
                placeholder={t('add_medication')}
                size="small"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.target as any).value.trim()) {
                    e.preventDefault();
                    const newMedication = (e.target as any).value.trim();
                    if (!formData.medical.medications.includes(newMedication)) {
                      setFormData({
                        ...formData,
                        medical: {
                          ...formData.medical,
                          medications: [...formData.medical.medications, newMedication]
                        }
                      });
                      (e.target as any).value = '';
                    }
                  }
                }}
              />
            )}
          </Box>

          {/* Medical Notes */}
          <Box>
            <Typography variant="body1" sx={{ mb: 1.5, fontWeight: 500 }}>
              {t('medical_notes')}
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={4}
              value={formData.medical.notes}
              onChange={(e) => setFormData({
                ...formData,
                medical: { ...formData.medical, notes: e.target.value }
              })}
              placeholder={t('medical_notes_placeholder')}
              disabled={!isEditing}
            />
          </Box>
        </Box>
      )}
    </Paper>
  );
};

export default ClientProfile;