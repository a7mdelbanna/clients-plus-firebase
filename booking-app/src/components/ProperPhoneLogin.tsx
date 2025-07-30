import React, { useState, useEffect } from 'react';
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
import { useFirebaseAuth } from '../contexts/FirebaseAuthContext';
import { signInWithPhoneNumber, RecaptchaVerifier, ConfirmationResult } from 'firebase/auth';
import { auth } from '../config/firebase';

interface ProperPhoneLoginProps {
  open: boolean;
  onClose: () => void;
  companyId: string;
}

// Test phone numbers that work without SMS (for development)
const TEST_NUMBERS = {
  '+201070128711': '123456',
  '+201234567890': '123456',
  '+966123456789': '123456',
  '+971123456789': '123456',
};

const ProperPhoneLogin: React.FC<ProperPhoneLoginProps> = ({ open, onClose, companyId }) => {
  const { t } = useLanguage();
  const { setCompanyId } = useFirebaseAuth();
  
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [countryCode, setCountryCode] = useState('+20');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [isTestNumber, setIsTestNumber] = useState(false);

  // Set company ID when component mounts
  useEffect(() => {
    if (companyId) {
      setCompanyId(companyId);
    }
  }, [companyId, setCompanyId]);

  // Setup reCAPTCHA properly when dialog opens
  useEffect(() => {
    if (open && step === 'phone') {
      const setupRecaptcha = async () => {
        try {
          // Clear any existing verifier
          if (window.recaptchaVerifier) {
            try {
              window.recaptchaVerifier.clear();
            } catch (e) {
              console.log('Previous verifier cleanup error:', e);
            }
            window.recaptchaVerifier = null;
          }

          // Wait for DOM to be ready
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const container = document.getElementById('recaptcha-container');
          if (!container) {
            console.error('reCAPTCHA container not found');
            return;
          }

          console.log('Setting up reCAPTCHA verifier...');
          
          // Create new RecaptchaVerifier with proper configuration
          window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
            size: 'normal', // Visible reCAPTCHA to avoid MALFORMED errors
            callback: (response: any) => {
              console.log('reCAPTCHA solved successfully');
            },
            'expired-callback': () => {
              console.log('reCAPTCHA expired');
              setError('reCAPTCHA expired. Please try again.');
            },
            'error-callback': (error: any) => {
              console.error('reCAPTCHA error:', error);
              setError('reCAPTCHA failed. Please refresh and try again.');
            }
          });
          
          // Render the reCAPTCHA
          await window.recaptchaVerifier.render();
          console.log('reCAPTCHA rendered successfully');
          
        } catch (error) {
          console.error('reCAPTCHA setup error:', error);
          setError('Failed to initialize security verification. Please refresh the page.');
        }
      };

      setupRecaptcha();
    }
    
    // Cleanup on unmount or when dialog closes
    return () => {
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
          window.recaptchaVerifier = null;
        } catch (error) {
          console.log('Cleanup error:', error);
        }
      }
    };
  }, [open, step]);

  const countryCodes = [
    { code: '+20', name: 'Egypt', flag: '🇪🇬' },
    { code: '+966', name: 'Saudi Arabia', flag: '🇸🇦' },
    { code: '+971', name: 'UAE', flag: '🇦🇪' },
  ];

  const handlePhoneSubmit = async () => {
    if (!phone || phone.length < 8) {
      setError('Please enter a valid phone number');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // Format phone number
      let formattedPhone = phone.replace(/\D/g, '');
      if (formattedPhone.startsWith('0')) {
        formattedPhone = formattedPhone.substring(1);
      }
      formattedPhone = countryCode + formattedPhone;
      
      console.log('Attempting phone auth with:', formattedPhone);
      
      // Check if it's a test number
      if (TEST_NUMBERS[formattedPhone as keyof typeof TEST_NUMBERS]) {
        console.log('Using test number - skipping SMS');
        setIsTestNumber(true);
        sessionStorage.setItem('testPhoneNumber', formattedPhone);
        sessionStorage.setItem('testOtpCode', TEST_NUMBERS[formattedPhone as keyof typeof TEST_NUMBERS]);
        setStep('otp');
        setLoading(false);
        return;
      }
      
      // For real numbers, use Firebase Auth with reCAPTCHA
      setIsTestNumber(false);
      const appVerifier = window.recaptchaVerifier;
      if (!appVerifier) {
        throw new Error('Security verification not ready. Please refresh the page.');
      }
      
      console.log('Sending SMS via Firebase Auth...');
      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
      setConfirmationResult(confirmation);
      setStep('otp');
      console.log('SMS sent successfully');
      
    } catch (err: any) {
      console.error('Phone submit error:', err);
      
      // Provide specific error messages
      if (err.code === 'auth/captcha-check-failed') {
        setError('Security verification failed. Please complete the reCAPTCHA and try again.');
      } else if (err.code === 'auth/invalid-phone-number') {
        setError('Invalid phone number format');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many attempts. Please try again later.');
      } else if (err.code === 'auth/quota-exceeded') {
        setError('SMS quota exceeded. Please try again later.');
      } else {
        setError(err.message || 'Failed to send verification code. Please try again.');
      }
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
      setError('Please enter all 6 digits');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      if (isTestNumber) {
        // Handle test number verification
        const testCode = sessionStorage.getItem('testOtpCode');
        if (otpValue === testCode) {
          console.log('Test number verification successful');
          handleClose();
          return;
        } else {
          setError(`Invalid code. Use: ${testCode}`);
          return;
        }
      }
      
      // Handle real number verification
      if (confirmationResult) {
        await confirmationResult.confirm(otpValue);
        console.log('Phone verification successful');
        handleClose();
      } else {
        setError('No pending verification. Please try again.');
      }
      
    } catch (err: any) {
      console.error('OTP verification error:', err);
      
      if (err.code === 'auth/invalid-verification-code') {
        setError('Invalid verification code');
      } else if (err.code === 'auth/code-expired') {
        setError('Verification code expired. Please request a new one.');
      } else {
        setError('Verification failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setStep('phone');
      setCountryCode('+20');
      setPhone('');
      setOtp(['', '', '', '', '', '']);
      setError('');
      setConfirmationResult(null);
      setIsTestNumber(false);
      // Clear session storage
      sessionStorage.removeItem('testPhoneNumber');
      sessionStorage.removeItem('testOtpCode');
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">Phone Login</Typography>
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
        
        {process.env.NODE_ENV === 'development' && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Test Numbers (development only):</strong><br/>
              +201070128711 (code: 123456)<br/>
              +201234567890 (code: 123456)
            </Typography>
          </Alert>
        )}
        
        {step === 'phone' ? (
          <Box>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              Enter your phone number to receive a verification code
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <FormControl sx={{ minWidth: 120 }}>
                <Select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  disabled={loading}
                >
                  {countryCodes.map((country) => (
                    <MenuItem key={country.code} value={country.code}>
                      {country.flag} {country.code}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <TextField
                fullWidth
                label="Phone Number"
                value={phone}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  setPhone(value);
                }}
                placeholder="1070128711"
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
            
            {/* reCAPTCHA container - visible for real numbers */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
              <div id="recaptcha-container"></div>
            </Box>
          </Box>
        ) : (
          <Box>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              Enter the 6-digit code sent to {countryCode + phone}
            </Typography>
            
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
            >
              Change Phone Number
            </Button>
          </Box>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={step === 'phone' ? handlePhoneSubmit : handleOtpSubmit}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : <LockIcon />}
        >
          {step === 'phone' ? 'Send Code' : 'Verify'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ProperPhoneLogin;