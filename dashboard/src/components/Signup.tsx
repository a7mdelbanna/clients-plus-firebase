import React, { useState } from 'react';
import AnimatedBackground from './AnimatedBackground';
import { setupService } from '../services/setup.service';
import { auth } from '../config/firebase';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import {
  Container,
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  IconButton,
  InputAdornment,
  CircularProgress,
  useTheme
} from '@mui/material';
import { Visibility, VisibilityOff, Person, Email, Lock } from '@mui/icons-material';

interface SignupFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const Signup: React.FC = () => {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const theme = useTheme();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm<SignupFormData>();

  const password = watch('password');

  const onSubmit = async (data: SignupFormData) => {
    try {
      setLoading(true);
      await signup(data.email, data.password, data.name);
      
      // Wait a moment for auth state to fully propagate
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get fresh auth instance
      const user = auth.currentUser;
      if (user) {
        try {
          // Reload user to ensure we have the latest auth state
          await user.reload();
          
          // Create company for the new user
          const companyId = await setupService.createCompanyForUser(user.uid, data.email, data.name);
          console.log('Company created with ID:', companyId);
          
          // Force token refresh to get new claims
          await user.getIdToken(true);
        } catch (companyError) {
          console.error('Error during company creation:', companyError);
          // If company creation fails, still show success for account creation
          toast.warning('تم إنشاء الحساب ولكن حدث خطأ في إعداد الشركة. سيتم توجيهك لإعادة المحاولة.', {
            position: 'top-center',
            autoClose: 5000,
          });
          navigate('/setup');
          return;
        }
      }
      
      toast.success('تم إنشاء الحساب بنجاح!', {
        position: 'top-center',
      });
      navigate('/setup');
    } catch (error: any) {
      const errorMessage = error.code === 'auth/email-already-in-use'
        ? 'البريد الإلكتروني مستخدم بالفعل'
        : error.code === 'auth/invalid-email'
        ? 'البريد الإلكتروني غير صالح'
        : error.code === 'auth/weak-password'
        ? 'كلمة المرور ضعيفة جداً'
        : 'حدث خطأ في إنشاء الحساب';
      
      toast.error(errorMessage, {
        position: 'top-center',
      });
    } finally {
      setLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.3 },
    },
  };

  return (
    <>
      <AnimatedBackground />
      <Container component="main" maxWidth="xs">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          style={{ width: '100%' }}
        >
          <Paper
            elevation={0}
            sx={{
              padding: 4,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: '100%',
              background: theme.palette.mode === 'dark' 
                ? 'rgba(30, 41, 59, 0.8)'
                : 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(10px)',
              border: '1px solid',
              borderColor: theme.palette.mode === 'dark'
                ? 'rgba(236, 72, 153, 0.2)'
                : 'rgba(236, 72, 153, 0.1)',
            }}
          >
            <motion.div variants={itemVariants}>
              <Typography 
                component="h1" 
                variant="h4" 
                sx={{ 
                  mb: 3,
                  background: 'linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  fontWeight: 700,
                }}
              >
                إنشاء حساب جديد
              </Typography>
            </motion.div>

            <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ mt: 1, width: '100%' }}>
              <motion.div variants={itemVariants}>
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  id="name"
                  label="الاسم الكامل"
                  autoComplete="name"
                  autoFocus
                  {...register('name', {
                    required: 'الاسم مطلوب',
                    minLength: {
                      value: 3,
                      message: 'الاسم يجب أن يكون 3 أحرف على الأقل'
                    }
                  })}
                  error={!!errors.name}
                  helperText={errors.name?.message}
                  disabled={loading}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Person sx={{ color: 'action.active' }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </motion.div>

              <motion.div variants={itemVariants}>
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  id="email"
                  label="البريد الإلكتروني"
                  autoComplete="email"
                  {...register('email', {
                    required: 'البريد الإلكتروني مطلوب',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'البريد الإلكتروني غير صحيح'
                    }
                  })}
                  error={!!errors.email}
                  helperText={errors.email?.message}
                  disabled={loading}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Email sx={{ color: 'action.active' }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </motion.div>

              <motion.div variants={itemVariants}>
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  label="كلمة المرور"
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  autoComplete="new-password"
                  {...register('password', {
                    required: 'كلمة المرور مطلوبة',
                    minLength: {
                      value: 6,
                      message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'
                    }
                  })}
                  error={!!errors.password}
                  helperText={errors.password?.message}
                  disabled={loading}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Lock sx={{ color: 'action.active' }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label="toggle password visibility"
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />
              </motion.div>

              <motion.div variants={itemVariants}>
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  label="تأكيد كلمة المرور"
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  autoComplete="new-password"
                  {...register('confirmPassword', {
                    required: 'تأكيد كلمة المرور مطلوب',
                    validate: value => value === password || 'كلمات المرور غير متطابقة'
                  })}
                  error={!!errors.confirmPassword}
                  helperText={errors.confirmPassword?.message}
                  disabled={loading}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Lock sx={{ color: 'action.active' }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label="toggle confirm password visibility"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          edge="end"
                        >
                          {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />
              </motion.div>

              <motion.div variants={itemVariants}>
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  sx={{ 
                    mt: 3, 
                    mb: 2,
                    py: 1.5,
                    fontSize: '1.1rem',
                    fontWeight: 600,
                  }}
                  disabled={loading}
                >
                  {loading ? (
                    <CircularProgress size={24} sx={{ color: 'white' }} />
                  ) : (
                    'إنشاء حساب'
                  )}
                </Button>
              </motion.div>

              <motion.div variants={itemVariants}>
                <Box sx={{ textAlign: 'center' }}>
                  <Link to="/login" style={{ textDecoration: 'none' }}>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: 'primary.main',
                        transition: 'all 0.3s',
                        '&:hover': {
                          textDecoration: 'underline',
                        },
                      }}
                    >
                      لديك حساب بالفعل؟ سجل دخولك
                    </Typography>
                  </Link>
                </Box>
              </motion.div>
            </Box>
          </Paper>
        </motion.div>
      </Box>
    </Container>
    </>
  );
};

export default Signup;