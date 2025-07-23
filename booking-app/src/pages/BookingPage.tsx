import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Container, Box, Typography, CircularProgress, Paper, Alert } from '@mui/material';
import { useBooking } from '../contexts/BookingContext';
import { useLanguage } from '../contexts/LanguageContext';
import { bookingService } from '../services/booking.service';
import type { BookingLink } from '../types/booking';

// Components
import BranchSelection from '../components/BranchSelection';
import ServiceSelection from '../components/ServiceSelection';
import StaffSelection from '../components/StaffSelection';
import DateTimeSelection from '../components/DateTimeSelection';
import CustomerForm from '../components/CustomerForm';
import BookingConfirmation from '../components/BookingConfirmation';
import BookingStepper from '../components/BookingStepper';
import LanguageToggle from '../components/LanguageToggle';

const BookingPage: React.FC = () => {
  const { companySlug, linkSlug } = useParams<{ companySlug: string; linkSlug: string }>();
  const { currentStep, bookingData, updateBookingData } = useBooking();
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linkData, setLinkData] = useState<BookingLink | null>(null);

  useEffect(() => {
    loadBookingLink();
  }, [companySlug, linkSlug]);

  const loadBookingLink = async () => {
    console.log('Loading booking link:', { companySlug, linkSlug });
    
    if (!companySlug || !linkSlug) {
      setError('invalid_link');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const link = await bookingService.getPublicBookingLink(companySlug, linkSlug);
      console.log('Booking link loaded:', link);
      
      if (!link || !link.isActive) {
        setError('link_not_found');
        setLoading(false);
        return;
      }

      setLinkData(link);
      
      // For single branch links, automatically set the branch
      if (link.branchSettings?.mode === 'single' && link.branchSettings?.defaultBranch) {
        updateBookingData({ 
          linkData: link,
          branchId: link.branchSettings.defaultBranch
        });
      } else if (link.branchSettings?.allowedBranches?.length === 1) {
        // If only one branch is allowed, auto-select it
        updateBookingData({ 
          linkData: link,
          branchId: link.branchSettings.allowedBranches[0]
        });
      } else {
        updateBookingData({ linkData: link });
      }

      // Track view
      await bookingService.trackLinkView(link.id!);

      // Set default language
      if (link.settings.defaultLanguage && link.settings.defaultLanguage !== language) {
        // The language context will handle this
      }

      setLoading(false);
    } catch (err) {
      console.error('Error loading booking link:', err);
      setError('error');
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    if (!linkData) return null;

    const needsBranchSelection = linkData.branchSettings?.mode === 'multi' || 
      (linkData.branchSettings?.allowedBranches && linkData.branchSettings.allowedBranches.length > 1);

    // Adjust step index if branch selection is not needed
    const adjustedStep = needsBranchSelection ? currentStep : currentStep + 1;

    switch (adjustedStep) {
      case 0:
        return <BranchSelection />;
      case 1:
        return <ServiceSelection />;
      case 2:
        return <StaffSelection />;
      case 3:
        return <DateTimeSelection />;
      case 4:
        return <CustomerForm />;
      case 5:
        return <BookingConfirmation />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          bgcolor: 'background.default',
        }}
      >
        <CircularProgress size={60} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          bgcolor: 'background.default',
          p: 2,
        }}
      >
        <Alert severity="error" sx={{ maxWidth: 500 }}>
          <Typography variant="h6" gutterBottom>
            {t('error')}
          </Typography>
          <Typography>{t(error)}</Typography>
        </Alert>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: linkData?.settings.theme === 'dark' ? 'grey.900' : 'grey.50',
        py: { xs: 2, md: 4 },
      }}
    >
      <Container maxWidth="md">
        {/* Header */}
        <Box sx={{ mb: 4, textAlign: 'center' }}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <LanguageToggle />
          </Box>
          
          {linkData?.settings.logoUrl && (
            <Box sx={{ mb: 2 }}>
              <img
                src={linkData.settings.logoUrl}
                alt="Logo"
                style={{ maxHeight: 80, maxWidth: 200 }}
              />
            </Box>
          )}
          
          <Typography variant="h4" component="h1" gutterBottom>
            {t('book_appointment')}
          </Typography>
          
          {linkData?.description && (
            <Typography variant="body1" color="textSecondary">
              {linkData.description}
            </Typography>
          )}
        </Box>

        {/* Stepper */}
        <Box sx={{ mb: 4 }}>
          <BookingStepper />
        </Box>

        {/* Content */}
        <Paper
          elevation={3}
          sx={{
            p: { xs: 2, md: 4 },
            borderRadius: 2,
            bgcolor: linkData?.settings.theme === 'dark' ? 'grey.800' : 'background.paper',
          }}
        >
          {renderStepContent()}
        </Paper>
      </Container>
    </Box>
  );
};

export default BookingPage;