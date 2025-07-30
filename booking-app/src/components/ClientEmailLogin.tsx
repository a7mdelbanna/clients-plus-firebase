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
  Divider,
} from '@mui/material';
import {
  Close as CloseIcon,
  Email as EmailIcon,
  Lock as LockIcon,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import { useLanguage } from '../contexts/LanguageContext';
import { useFirebaseAuth } from '../contexts/FirebaseAuthContext';
import { useBooking } from '../contexts/BookingContext';
import ClientSetupWizard from './ClientSetupWizard';

interface ClientEmailLoginProps {
  open: boolean;
  onClose: () => void;
  companyId: string;
}

const ClientEmailLogin: React.FC<ClientEmailLoginProps> = ({ open, onClose, companyId }) => {
  const { t } = useLanguage();
  const { signInWithEmail, signUpWithEmail, resetPassword, setCompanyId } = useFirebaseAuth();
  const { bookingData } = useBooking();
  
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showSetupWizard, setShowSetupWizard] = useState(false);

  // Set company ID when component mounts
  React.useEffect(() => {
    if (companyId) {
      setCompanyId(companyId);
    }
  }, [companyId, setCompanyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (mode === 'signin') {
        const result = await signInWithEmail(email, password);
        if (result.success) {
          onClose();
        } else {
          setError(result.message || 'Failed to sign in');
        }
      } else if (mode === 'signup') {
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          return;
        }
        const result = await signUpWithEmail(email, password, name);
        if (result.success) {
          setSuccess('Account created successfully! Please complete your profile.');
          // Show setup wizard instead of switching to signin
          setShowSetupWizard(true);
        } else {
          setError(result.message || 'Failed to create account');
        }
      } else if (mode === 'reset') {
        const result = await resetPassword(email);
        if (result.success) {
          setSuccess(result.message || 'Password reset email sent! Check your inbox.');
          setMode('signin');
        } else {
          setError(result.message || 'Failed to send reset email');
        }
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setMode('signin');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setName('');
      setError('');
      setSuccess('');
      setShowPassword(false);
      setShowSetupWizard(false);
      onClose();
    }
  };

  const handleSetupComplete = () => {
    setShowSetupWizard(false);
    onClose();
  };

  const getTitle = () => {
    switch (mode) {
      case 'signin': return 'Client Login';
      case 'signup': return 'Create Account';
      case 'reset': return 'Reset Password';
      default: return 'Login';
    }
  };

  const getSubmitText = () => {
    switch (mode) {
      case 'signin': return 'Sign In';
      case 'signup': return 'Create Account';
      case 'reset': return 'Send Reset Email';
      default: return 'Submit';
    }
  };

  // Show setup wizard if account was just created
  if (showSetupWizard) {
    return (
      <ClientSetupWizard
        open={showSetupWizard}
        onClose={handleSetupComplete}
        companyId={companyId}
        branchId={bookingData?.branchId}
      />
    );
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">{getTitle()}</Typography>
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
        
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}
        
        <Box component="form" onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <TextField
              fullWidth
              label="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              margin="normal"
              required
              disabled={loading}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon />
                  </InputAdornment>
                ),
              }}
            />
          )}
          
          <TextField
            fullWidth
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            margin="normal"
            required
            disabled={loading}
            autoComplete="email"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <EmailIcon />
                </InputAdornment>
              ),
            }}
          />
          
          {mode !== 'reset' && (
            <TextField
              fullWidth
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              margin="normal"
              required
              disabled={loading}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      disabled={loading}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          )}
          
          {mode === 'signup' && (
            <TextField
              fullWidth
              label="Confirm Password"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              margin="normal"
              required
              disabled={loading}
              autoComplete="new-password"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon />
                  </InputAdornment>
                ),
              }}
            />
          )}
        </Box>
        
        <Box sx={{ mt: 3 }}>
          <Button
            type="submit"
            fullWidth
            variant="contained"
            onClick={handleSubmit}
            disabled={loading}
            sx={{ py: 1.5 }}
          >
            {loading ? <CircularProgress size={24} /> : getSubmitText()}
          </Button>
        </Box>
        
        <Divider sx={{ my: 2 }} />
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {mode === 'signin' && (
            <>
              <Button
                variant="text"
                onClick={() => setMode('signup')}
                disabled={loading}
              >
                Don't have an account? Create one
              </Button>
              <Button
                variant="text"
                onClick={() => setMode('reset')}
                disabled={loading}
              >
                Forgot your password?
              </Button>
            </>
          )}
          
          {mode === 'signup' && (
            <Button
              variant="text"
              onClick={() => setMode('signin')}
              disabled={loading}
            >
              Already have an account? Sign in
            </Button>
          )}
          
          {mode === 'reset' && (
            <Button
              variant="text"
              onClick={() => setMode('signin')}
              disabled={loading}
            >
              Back to sign in
            </Button>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default ClientEmailLogin;