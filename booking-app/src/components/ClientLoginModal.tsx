import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  Alert,
  IconButton,
  InputAdornment,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
} from '@mui/material';
import {
  Close as CloseIcon,
  Phone as PhoneIcon,
  Lock as LockIcon,
} from '@mui/icons-material';
import { useLanguage } from '../contexts/LanguageContext';
import { useClientAuth } from '../contexts/ClientAuthContext';
import { useBooking } from '../contexts/BookingContext';

interface ClientLoginModalProps {
  open: boolean;
  onClose: () => void;
}

const ClientLoginModal: React.FC<ClientLoginModalProps> = ({ open, onClose }) => {
  const { t, isRTL } = useLanguage();
  const { login, verifyOTP, setCompanyId } = useClientAuth();
  const { bookingData } = useBooking();
  
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [countryCode, setCountryCode] = useState('+20');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Common country codes
  const countryCodes = [
    { code: '+20', country: 'Egypt', flag: '🇪🇬' },
    { code: '+966', country: 'Saudi Arabia', flag: '🇸🇦' },
    { code: '+971', country: 'UAE', flag: '🇦🇪' },
    { code: '+965', country: 'Kuwait', flag: '🇰🇼' },
    { code: '+974', country: 'Qatar', flag: '🇶🇦' },
    { code: '+973', country: 'Bahrain', flag: '🇧🇭' },
    { code: '+968', country: 'Oman', flag: '🇴🇲' },
    { code: '+962', country: 'Jordan', flag: '🇯🇴' },
    { code: '+961', country: 'Lebanon', flag: '🇱🇧' },
    { code: '+1', country: 'USA/Canada', flag: '🇺🇸' },
    { code: '+44', country: 'UK', flag: '🇬🇧' },
  ];
  
  const handlePhoneSubmit = async () => {
    // Basic validation - adjust minimum length based on country
    const minLength = countryCode === '+20' ? 10 : 7; // Egypt has 10 digits, others vary
    if (!phone || phone.length < minLength) {
      setError(t('invalid_phone'));
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // Set company ID if available from booking context
      if (bookingData?.linkData?.companyId) {
        setCompanyId(bookingData.linkData.companyId);
      }
      
      // Format phone number with selected country code
      let formattedPhone = phone.replace(/\D/g, '');
      
      // Remove leading 0 if present
      if (formattedPhone.startsWith('0')) {
        formattedPhone = formattedPhone.substring(1);
      }
      
      // Combine country code with phone number
      formattedPhone = countryCode + formattedPhone;
      
      const result = await login(formattedPhone);
      
      if (result.success) {
        setStep('otp');
      } else {
        setError(result.message || t('login_failed'));
      }
    } catch (err) {
      setError(t('login_failed'));
    } finally {
      setLoading(false);
    }
  };
  
  const handleOtpChange = (index: number, value: string) => {
    if (value.length <= 1 && /^\d*$/.test(value)) {
      const newOtp = [...otp];
      newOtp[index] = value;
      setOtp(newOtp);
      
      // Auto-focus next input
      if (value && index < 5) {
        const nextInput = document.getElementById(`otp-${index + 1}`);
        nextInput?.focus();
      }
    }
  };
  
  const handleOtpSubmit = async () => {
    const otpValue = otp.join('');
    if (otpValue.length !== 6) {
      setError(t('invalid_otp'));
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // Pass company ID to verifyOTP
      const companyId = bookingData?.linkData?.companyId;
      const result = await verifyOTP(otpValue, companyId);
      
      if (result.success) {
        onClose();
      } else {
        setError(result.message || t('invalid_otp'));
      }
    } catch (err) {
      setError(t('verification_failed'));
    } finally {
      setLoading(false);
    }
  };
  
  const handleClose = () => {
    if (!loading) {
      setStep('phone');
      setCountryCode('+20'); // Reset to Egypt default
      setPhone('');
      setOtp(['', '', '', '', '', '']);
      setError('');
      onClose();
    }
  };
  
  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
        },
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">{t('client_login')}</Typography>
          <IconButton onClick={handleClose} disabled={loading}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        {step === 'phone' ? (
          <Box>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
              {t('enter_phone_to_login')}
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 1 }}>
              <FormControl sx={{ minWidth: 120 }}>
                <Select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  disabled={loading}
                  displayEmpty
                  sx={{ height: '56px' }}
                >
                  {countryCodes.map((country) => (
                    <MenuItem key={country.code} value={country.code}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <span>{country.flag}</span>
                        <span>{country.code}</span>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <TextField
                fullWidth
                label={t('phone_number')}
                value={phone}
                onChange={(e) => {
                  // Only allow numbers
                  const value = e.target.value.replace(/\D/g, '');
                  setPhone(value);
                }}
                placeholder={countryCode === '+20' ? '1234567890' : '234567890'}
                disabled={loading}
                type="tel"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PhoneIcon />
                    </InputAdornment>
                  ),
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !loading) {
                    handlePhoneSubmit();
                  }
                }}
              />
            </Box>
          </Box>
        ) : (
          <Box>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
              {t('enter_otp_sent_to')} {countryCode + phone}
            </Typography>
            
            {/* Development mode hint */}
            {import.meta.env.DEV && (
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="caption">
                  Development Mode: Use OTP: <strong>123456</strong>
                </Typography>
              </Alert>
            )}
            
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mb: 2 }}>
              {otp.map((digit, index) => (
                <TextField
                  key={index}
                  id={`otp-${index}`}
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  inputProps={{
                    maxLength: 1,
                    style: { textAlign: 'center', fontSize: '1.5rem' },
                  }}
                  disabled={loading}
                  sx={{
                    width: 50,
                    '& .MuiOutlinedInput-root': {
                      height: 50,
                    },
                  }}
                />
              ))}
            </Box>
            
            <Button
              variant="text"
              onClick={() => setStep('phone')}
              disabled={loading}
              sx={{ textDecoration: 'underline' }}
            >
              {t('change_phone')}
            </Button>
          </Box>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          {t('cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={step === 'phone' ? handlePhoneSubmit : handleOtpSubmit}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : <LockIcon />}
        >
          {step === 'phone' ? t('send_otp') : t('verify')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ClientLoginModal;