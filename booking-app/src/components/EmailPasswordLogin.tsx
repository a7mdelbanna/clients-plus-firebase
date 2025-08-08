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
  Tabs,
  Tab,
  Link,
} from '@mui/material';
import {
  Close as CloseIcon,
  Email as EmailIcon,
  Lock as LockIcon,
  Visibility,
  VisibilityOff,
  Person as PersonIcon,
} from '@mui/icons-material';
import { useLanguage } from '../contexts/LanguageContext';
import { useFirebaseAuth } from '../contexts/FirebaseAuthContext';

interface EmailPasswordLoginProps {
  open: boolean;
  onClose: () => void;
  onSwitchToPhone?: () => void;
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
      id={`auth-tabpanel-${index}`}
      aria-labelledby={`auth-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

const EmailPasswordLogin: React.FC<EmailPasswordLoginProps> = ({ open, onClose, onSwitchToPhone }) => {
  const { t } = useLanguage();
  const { signInWithEmail, signUpWithEmail, resetPassword, authSettings } = useFirebaseAuth();
  
  const [tabValue, setTabValue] = useState(0); // 0: Sign In, 1: Sign Up
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    setError('');
    setSuccess('');
  };
  
  const handleSignIn = async () => {
    if (!email || !password) {
      setError(t('please_fill_all_fields'));
      return;
    }
    
    setLoading(true);
    setError('');
    
    const result = await signInWithEmail(email, password);
    
    if (result.success) {
      onClose();
    } else {
      setError(result.message || t('login_failed'));
    }
    
    setLoading(false);
  };
  
  const handleSignUp = async () => {
    if (!email || !password || !name) {
      setError(t('please_fill_all_fields'));
      return;
    }
    
    if (password !== confirmPassword) {
      setError(t('passwords_do_not_match'));
      return;
    }
    
    if (password.length < 6) {
      setError(t('password_too_short'));
      return;
    }
    
    setLoading(true);
    setError('');
    
    const result = await signUpWithEmail(email, password, name);
    
    if (result.success) {
      onClose();
    } else {
      setError(result.message || t('signup_failed'));
    }
    
    setLoading(false);
  };
  
  const handleForgotPassword = async () => {
    if (!email) {
      setError(t('please_enter_email'));
      return;
    }
    
    setLoading(true);
    setError('');
    
    const result = await resetPassword(email);
    
    if (result.success) {
      setSuccess(result.message || t('password_reset_sent'));
      setShowForgotPassword(false);
    } else {
      setError(result.message || t('password_reset_failed'));
    }
    
    setLoading(false);
  };
  
  const handleClose = () => {
    if (!loading) {
      setTabValue(0);
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setName('');
      setError('');
      setSuccess('');
      setShowPassword(false);
      setShowConfirmPassword(false);
      setShowForgotPassword(false);
      onClose();
    }
  };

  // Check if email auth is enabled
  if (!authSettings?.enabledMethods.email) {
    return (
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogContent>
          <Alert severity="warning">
            {t('email_authentication_disabled')}
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>{t('close')}</Button>
        </DialogActions>
      </Dialog>
    );
  }
  
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
        
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}
        
        {!showForgotPassword ? (
          <>
            <Tabs value={tabValue} onChange={handleTabChange} variant="fullWidth">
              <Tab label={t('sign_in')} />
              <Tab label={t('sign_up')} />
            </Tabs>
            
            <TabPanel value={tabValue} index={0}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  fullWidth
                  label={t('email')}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailIcon />
                      </InputAdornment>
                    ),
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !loading) {
                      handleSignIn();
                    }
                  }}
                />
                
                <TextField
                  fullWidth
                  label={t('password')}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
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
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !loading) {
                      handleSignIn();
                    }
                  }}
                />
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Link
                    component="button"
                    variant="body2"
                    onClick={() => setShowForgotPassword(true)}
                    disabled={loading}
                  >
                    {t('forgot_password')}
                  </Link>
                  
                  {authSettings?.enabledMethods.sms && onSwitchToPhone && (
                    <Link
                      component="button"
                      variant="body2"
                      onClick={onSwitchToPhone}
                      disabled={loading}
                    >
                      {t('use_phone_instead')}
                    </Link>
                  )}
                </Box>
              </Box>
            </TabPanel>
            
            <TabPanel value={tabValue} index={1}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  fullWidth
                  label={t('full_name')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonIcon />
                      </InputAdornment>
                    ),
                  }}
                />
                
                <TextField
                  fullWidth
                  label={t('email')}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailIcon />
                      </InputAdornment>
                    ),
                  }}
                />
                
                <TextField
                  fullWidth
                  label={t('password')}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  helperText={t('password_requirements')}
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
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                
                <TextField
                  fullWidth
                  label={t('confirm_password')}
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockIcon />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          edge="end"
                        >
                          {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !loading) {
                      handleSignUp();
                    }
                  }}
                />
              </Box>
            </TabPanel>
          </>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <Typography variant="body2" color="textSecondary">
              {t('enter_email_for_password_reset')}
            </Typography>
            
            <TextField
              fullWidth
              label={t('email')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon />
                  </InputAdornment>
                ),
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !loading) {
                  handleForgotPassword();
                }
              }}
            />
            
            <Button
              variant="text"
              onClick={() => setShowForgotPassword(false)}
              disabled={loading}
            >
              {t('back_to_login')}
            </Button>
          </Box>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          {t('cancel')}
        </Button>
        {!showForgotPassword && (
          <Button
            variant="contained"
            onClick={tabValue === 0 ? handleSignIn : handleSignUp}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : <LockIcon />}
          >
            {tabValue === 0 ? t('sign_in') : t('sign_up')}
          </Button>
        )}
        {showForgotPassword && (
          <Button
            variant="contained"
            onClick={handleForgotPassword}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : <EmailIcon />}
          >
            {t('send_reset_email')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default EmailPasswordLogin;