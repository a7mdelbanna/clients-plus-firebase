import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Grid,
  InputAdornment,
  Alert,
  Paper,
} from '@mui/material';
import {
  Person,
  Phone,
  Email,
  Comment,
  CheckCircle,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useBooking } from '../contexts/BookingContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useClientAuth } from '../contexts/ClientAuthContext';

interface CustomerFormData {
  name: string;
  phone: string;
  email?: string;
  comments?: string;
}

const schema = yup.object().shape({
  name: yup.string().required('Name is required').min(2, 'Name must be at least 2 characters'),
  phone: yup.string()
    .required('Phone number is required')
    .matches(/^[\d\s\-\+\(\)]+$/, 'Invalid phone number')
    .min(10, 'Phone number must be at least 10 digits'),
  email: yup.string().email('Invalid email address').optional(),
  comments: yup.string().max(500, 'Comments must be less than 500 characters').optional(),
});

const CustomerForm: React.FC = () => {
  const { bookingData, updateBookingData, nextStep, previousStep } = useBooking();
  const { t, isRTL } = useLanguage();
  const { session, isAuthenticated } = useClientAuth();
  const [loading, setLoading] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<CustomerFormData>({
    resolver: yupResolver(schema),
    defaultValues: {
      name: bookingData.customerName || '',
      phone: bookingData.customerPhone || '',
      email: bookingData.customerEmail || '',
      comments: bookingData.comments || '',
    },
  });

  // Pre-fill form if client is logged in
  useEffect(() => {
    if (isAuthenticated && session) {
      setValue('name', session.name);
      setValue('phone', session.phoneNumber);
      // Email would come from client data if available
    }
  }, [isAuthenticated, session, setValue]);

  const onSubmit = async (data: CustomerFormData) => {
    try {
      setLoading(true);
      
      updateBookingData({
        customerName: data.name,
        customerPhone: data.phone,
        customerEmail: data.email,
        comments: data.comments,
      });
      
      // Move to confirmation step
      nextStep();
    } catch (error) {
      console.error('Error submitting customer form:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        {t('customer_info')}
      </Typography>
      
      <Typography variant="body2" color="textSecondary" paragraph>
        {t('enter_contact_details')}
      </Typography>

      {/* Show logged in status */}
      {isAuthenticated && session && (
        <Paper 
          elevation={0} 
          sx={{ 
            p: 2, 
            mb: 3, 
            bgcolor: 'rgba(76, 175, 80, 0.1)',
            border: '1px solid',
            borderColor: 'success.main',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckCircle color="success" />
            <Typography variant="body2">
              {t('logged_in_as')} {session.name}
            </Typography>
          </Box>
        </Paper>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <Grid container spacing={3}>
          {/* Name */}
          <Grid item xs={12}>
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label={t('name')}
                  placeholder={t('enter_your_name')}
                  error={!!errors.name}
                  helperText={errors.name?.message}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Person />
                      </InputAdornment>
                    ),
                  }}
                />
              )}
            />
          </Grid>

          {/* Phone */}
          <Grid item xs={12}>
            <Controller
              name="phone"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label={t('phone')}
                  placeholder={t('enter_phone_number')}
                  error={!!errors.phone}
                  helperText={errors.phone?.message}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Phone />
                      </InputAdornment>
                    ),
                  }}
                />
              )}
            />
          </Grid>

          {/* Email */}
          <Grid item xs={12}>
            <Controller
              name="email"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  type="email"
                  label={`${t('email')} (${t('optional')})`}
                  placeholder={t('enter_email')}
                  error={!!errors.email}
                  helperText={errors.email?.message}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Email />
                      </InputAdornment>
                    ),
                  }}
                />
              )}
            />
          </Grid>

          {/* Comments */}
          <Grid item xs={12}>
            <Controller
              name="comments"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  multiline
                  rows={3}
                  label={`${t('comments')} (${t('optional')})`}
                  placeholder={t('any_special_requests')}
                  error={!!errors.comments}
                  helperText={errors.comments?.message}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1 }}>
                        <Comment />
                      </InputAdornment>
                    ),
                  }}
                />
              )}
            />
          </Grid>
        </Grid>

        {/* WhatsApp Confirmation Notice */}
        <Alert severity="info" sx={{ mt: 3 }}>
          <Typography variant="body2">
            {t('whatsapp_confirmation')}
          </Typography>
        </Alert>

        {/* Navigation */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
          <Button 
            variant="outlined" 
            onClick={previousStep}
            disabled={loading}
          >
            {t('previous')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading}
          >
            {loading ? t('loading') : t('confirm')}
          </Button>
        </Box>
      </form>
    </Box>
  );
};

export default CustomerForm;