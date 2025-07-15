import React, { useState } from 'react';
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  Button,
  Typography,
  Paper,
  Container,
  useTheme,
  useMediaQuery,
  Stack,
  CircularProgress,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm, FormProvider } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import type { CompanySetupData } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { setupService } from '../../services/setup.service';
import { db } from '../../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import BusinessInfo from './BusinessInfo';
import LocationsStep from './LocationsStep';
import TeamSizeStep from './TeamSizeStep';
import ThemeSelector from './ThemeSelector';
import ReviewStep from './ReviewStep';
import { businessThemes, defaultTheme } from '../../themes';
import { useThemeMode } from '../../contexts/ThemeContext';

const steps = [
  { label: 'Business Info', labelAr: 'معلومات النشاط' },
  { label: 'Locations', labelAr: 'المواقع' },
  { label: 'Team Size', labelAr: 'حجم الفريق' },
  { label: 'Choose Theme', labelAr: 'اختر التصميم' },
  { label: 'Review', labelAr: 'المراجعة' },
];

const SetupWizard: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isRTL = theme.direction === 'rtl';
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { setCompanyTheme } = useThemeMode();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const methods = useForm<CompanySetupData>({
    defaultValues: {
      businessName: '',
      businessType: '',
      mainServices: [],
      ownerPosition: '',
      branches: [
        {
          id: '1',
          name: '',
          address: '',
          phone: '',
          isMain: true,
        },
      ],
      employeeCount: 1,
      themeId: defaultTheme.id,
      setupCompleted: false,
    },
  });

  const { handleSubmit, trigger, watch } = methods;
  
  // Watch for theme changes and update in real-time
  const selectedThemeId = watch('themeId');
  
  React.useEffect(() => {
    if (selectedThemeId) {
      setCompanyTheme(selectedThemeId);
    }
  }, [selectedThemeId, setCompanyTheme]);

  const handleNext = async () => {
    let fieldsToValidate: (keyof CompanySetupData)[] = [];
    
    switch (activeStep) {
      case 0:
        fieldsToValidate = ['businessName', 'businessType', 'mainServices', 'ownerPosition'];
        break;
      case 1:
        fieldsToValidate = ['branches'];
        break;
      case 2:
        fieldsToValidate = ['employeeCount'];
        break;
      case 3:
        fieldsToValidate = ['themeId'];
        break;
    }

    const isValid = await trigger(fieldsToValidate);
    
    if (isValid) {
      setActiveStep((prevActiveStep) => prevActiveStep + 1);

      // Optionally save progress (non-blocking)
      if (currentUser) {
        try {
          const idTokenResult = await currentUser.getIdTokenResult();
          const companyId = idTokenResult.claims.companyId as string;
          if (companyId) {
            const currentData = methods.getValues();
            setupService.saveSetupProgress(companyId, activeStep + 1, currentData);
          }
        } catch (error) {
          // Silently ignore progress save errors
          console.debug('Could not save progress:', error);
        }
      }
    }
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const onSubmit = async (data: CompanySetupData) => {
    if (!currentUser) {
      toast.error(isRTL ? 'يجب تسجيل الدخول أولاً' : 'You must be logged in');
      return;
    }

    setLoading(true);

    try {
      // Get company ID from user claims
      const idTokenResult = await currentUser.getIdTokenResult();
      let companyId = idTokenResult.claims.companyId as string;

      if (!companyId) {
        // Try to get companyId from user document in Firestore
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          companyId = userDoc.data().companyId;
        }
        
        if (!companyId) {
          // If still no company ID, create the company now
          console.log('No company found, creating one now...');
          try {
            companyId = await setupService.createCompanyForUser(
              currentUser.uid, 
              currentUser.email || '', 
              currentUser.displayName || 'User'
            );
            // Refresh token to get new claims
            await currentUser.getIdToken(true);
          } catch (createError) {
            console.error('Failed to create company in setup:', createError);
            throw new Error(isRTL ? 'فشل في إنشاء الشركة. يرجى تحديث الصفحة والمحاولة مرة أخرى.' : 'Failed to create company. Please refresh and try again.');
          }
        }
      }

      // Find the selected theme to get its colors
      const selectedTheme = businessThemes.find(t => t.id === data.themeId) || defaultTheme;

      // Update the theme in the data with color values
      const setupData: CompanySetupData = {
        ...data,
        setupCompleted: true,
        setupCompletedAt: new Date(),
      };

      // Save to Firebase
      await setupService.completeSetup(companyId, setupData);

      // Force refresh the user token to get updated claims
      await currentUser.getIdToken(true);
      
      // Mark that setup was just completed
      sessionStorage.setItem('setup-just-completed', 'true');
      
      // Show success message
      toast.success(
        isRTL 
          ? 'تم إعداد حسابك بنجاح! سيتم توجيهك إلى لوحة التحكم...' 
          : 'Your account has been set up successfully! Redirecting to dashboard...'
      );

      // Navigate to dashboard
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 1000);

    } catch (error) {
      console.error('Setup error:', error);
      
      // Show more specific error messages
      let errorMessage = isRTL 
        ? 'حدث خطأ أثناء إعداد حسابك. يرجى المحاولة مرة أخرى.' 
        : 'An error occurred while setting up your account. Please try again.';
      
      if (error instanceof Error) {
        if (error.message.includes('Missing or insufficient permissions')) {
          errorMessage = isRTL 
            ? 'خطأ في الصلاحيات. يرجى تحديث الصفحة والمحاولة مرة أخرى.' 
            : 'Permission error. Please refresh the page and try again.';
        } else if (error.message.includes('Network')) {
          errorMessage = isRTL 
            ? 'خطأ في الاتصال. يرجى التحقق من اتصالك بالإنترنت.' 
            : 'Network error. Please check your internet connection.';
        } else {
          errorMessage = error.message;
        }
      }
      
      toast.error(errorMessage, {
        position: 'top-center',
        autoClose: 7000,
      });
    } finally {
      setLoading(false);
    }
  };

  const getStepContent = (step: number) => {
    switch (step) {
      case 0:
        return <BusinessInfo />;
      case 1:
        return <LocationsStep />;
      case 2:
        return <TeamSizeStep />;
      case 3:
        return <ThemeSelector />;
      case 4:
        return <ReviewStep />;
      default:
        return 'Unknown step';
    }
  };

  const pageVariants = {
    initial: { opacity: 0, x: isRTL ? -50 : 50 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: isRTL ? 50 : -50 },
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Typography
            variant="h3"
            component="h1"
            align="center"
            gutterBottom
            sx={{
              fontWeight: 700,
              background: `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${theme.palette.secondary.main} 90%)`,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: 4,
            }}
          >
            {isRTL ? 'إعداد حسابك' : 'Setup Your Account'}
          </Typography>
        </motion.div>

        <Paper
          elevation={3}
          sx={{
            p: { xs: 2, sm: 4 },
            borderRadius: 3,
            background: theme.palette.background.paper,
          }}
        >
          <Stepper 
            activeStep={activeStep} 
            alternativeLabel={!isMobile}
            orientation={isMobile ? 'vertical' : 'horizontal'}
            sx={{ mb: 4 }}
          >
            {steps.map((step, index) => (
              <Step key={index}>
                <StepLabel>
                  <Typography variant="body2">
                    {isRTL ? step.labelAr : step.label}
                  </Typography>
                </StepLabel>
              </Step>
            ))}
          </Stepper>

          <FormProvider {...methods}>
            <form onSubmit={handleSubmit(onSubmit)}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStep}
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ duration: 0.3 }}
                >
                  <Box sx={{ minHeight: 400, mb: 4 }}>
                    {getStepContent(activeStep)}
                  </Box>
                </motion.div>
              </AnimatePresence>

              <Stack
                direction="row"
                spacing={2}
                justifyContent="space-between"
                sx={{ mt: 4 }}
              >
                <Button
                  disabled={activeStep === 0 || loading}
                  onClick={handleBack}
                  variant="outlined"
                  size="large"
                >
                  {isRTL ? 'السابق' : 'Back'}
                </Button>

                {activeStep === steps.length - 1 ? (
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={loading}
                    sx={{
                      background: `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${theme.palette.secondary.main} 90%)`,
                      color: 'white',
                      px: 4,
                      minWidth: 150,
                    }}
                  >
                    {loading ? (
                      <CircularProgress size={24} sx={{ color: 'white' }} />
                    ) : (
                      isRTL ? 'إنهاء الإعداد' : 'Complete Setup'
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={handleNext}
                    variant="contained"
                    size="large"
                    disabled={loading}
                    sx={{
                      background: `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${theme.palette.secondary.main} 90%)`,
                      color: 'white',
                      px: 4,
                    }}
                  >
                    {isRTL ? 'التالي' : 'Next'}
                  </Button>
                )}
              </Stack>
            </form>
          </FormProvider>
        </Paper>
      </Box>
    </Container>
  );
};

export default SetupWizard;