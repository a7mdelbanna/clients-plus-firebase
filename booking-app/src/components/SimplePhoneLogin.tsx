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
import { ConfirmationResult } from 'firebase/auth';
import { auth } from '../config/firebase';

interface SimplePhoneLoginProps {
  open: boolean;
  onClose: () => void;
  companyId: string;
}

// Test phone numbers that work without SMS
const TEST_NUMBERS = {
  '+201070128711': '123456',
  '+201234567890': '123456',
  '+966123456789': '123456',
  '+971123456789': '123456',
};

const SimplePhoneLogin: React.FC<SimplePhoneLoginProps> = ({ open, onClose, companyId }) => {
  const { t } = useLanguage();
  const { setCompanyId, authSettings } = useFirebaseAuth();
  
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [countryCode, setCountryCode] = useState('+20');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  // Set company ID when component mounts
  useEffect(() => {
    if (companyId) {
      setCompanyId(companyId);
    }
  }, [companyId, setCompanyId]);

  // No reCAPTCHA setup needed - using Cloud Function approach

  const countryCodes = [
    { code: '+20', name: 'Egypt', flag: '🇪🇬' },
    { code: '+966', name: 'Saudi Arabia', flag: '🇸🇦' },
    { code: '+971', name: 'UAE', flag: '🇦🇪' },
  ];

  const handlePhoneSubmit = async () => {
    // Basic validation
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
        // Store test number info for verification
        sessionStorage.setItem('testPhoneNumber', formattedPhone);
        sessionStorage.setItem('testOtpCode', TEST_NUMBERS[formattedPhone as keyof typeof TEST_NUMBERS]);
        setStep('otp');
        setLoading(false);
        return;
      }
      
      // For all numbers (including real ones), use Cloud Function approach to avoid reCAPTCHA issues
      console.log('Using Cloud Function for OTP');
      const response = await fetch('https://europe-west1-clients-plus-egypt.cloudfunctions.net/createPhoneAuthSession', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: {
            phoneNumber: formattedPhone,
            companyId
          }
        })
      });
      
      const responseData = await response.json();
      console.log('Cloud Function response:', responseData);
      
      if (response.ok && responseData.result?.success) {
        // Store the custom token for verification
        sessionStorage.setItem('firebaseCustomToken', responseData.result.customToken);
        sessionStorage.setItem('firebaseAuthUid', responseData.result.uid);
        setStep('otp');
        console.log('OTP sent successfully via Cloud Function');
      } else if (responseData.error) {
        console.error('Cloud Function error:', responseData.error);
        
        // Handle specific IAM permission error
        if (responseData.error.code === 'internal' && 
            responseData.error.message?.includes('iam.serviceAccounts.signBlob')) {
          setError('Service temporarily unavailable. Please contact support or try again later.');
        } else {
          setError(responseData.error.message || 'Failed to send OTP');
        }
      } else {
        throw new Error('Invalid response from server');
      }
      
    } catch (err: any) {
      console.error('Phone submit error:', err);
      setError('Failed to send code. Please try again or use test number: +201070128711');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length <= 1 && /^\d*$/.test(value)) {
      const newOtp = [...otp];
      newOtp[index] = value;
      setOtp(newOtp);
      
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
      // Check if it's a test number
      const testPhone = sessionStorage.getItem('testPhoneNumber');
      const testCode = sessionStorage.getItem('testOtpCode');
      
      if (testPhone && testCode) {
        if (otpValue === testCode) {
          console.log('Test number verification successful');
          // For test numbers, we'll just close the dialog
          // In a real app, you'd create a session or token here
          onClose();
          return;
        } else {
          setError('Invalid code. Use: ' + testCode);
          return;
        }
      }
      
      // For real numbers with Cloud Function tokens
      const customToken = sessionStorage.getItem('firebaseCustomToken');
      const authUid = sessionStorage.getItem('firebaseAuthUid');
      
      if (customToken && authUid) {
        // Verify OTP with Cloud Function
        const response = await fetch('https://europe-west1-clients-plus-egypt.cloudfunctions.net/verifyClientOTPV2', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            data: {
              uid: authUid,
              otp: otpValue,
              companyId
            }
          })
        });
        
        const responseData = await response.json();
        console.log('OTP verification response:', responseData);
        
        if (response.ok && responseData.result?.success) {
          // Sign in with the custom token
          const { signInWithCustomToken } = await import('firebase/auth');
          await signInWithCustomToken(auth, customToken);
          console.log('Phone verification successful via Cloud Function');
          onClose();
        } else {
          setError(responseData.error?.message || 'Invalid verification code');
        }
      } else if (confirmationResult) {
        // Fallback for Firebase confirmation (shouldn't happen with current flow)
        await confirmationResult.confirm(otpValue);
        console.log('Phone verification successful');
        onClose();
      } else {
        setError('No pending verification. Please try again.');
      }
      
    } catch (err: any) {
      console.error('OTP verification error:', err);
      
      if (err.code === 'auth/invalid-verification-code') {
        setError('Invalid verification code');
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
      // Clear all session storage items
      sessionStorage.removeItem('testPhoneNumber');
      sessionStorage.removeItem('testOtpCode');
      sessionStorage.removeItem('firebaseCustomToken');
      sessionStorage.removeItem('firebaseAuthUid');
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
        
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>Test Numbers (no SMS required):</strong><br/>
            +201070128711 (code: 123456)<br/>
            +201234567890 (code: 123456)
          </Typography>
        </Alert>
        
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

export default SimplePhoneLogin;