import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
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
import BookingHeader from '../components/BookingHeader';

const BookingPage: React.FC = () => {
  const { companySlug, linkSlug } = useParams<{ companySlug: string; linkSlug: string }>();
  const [searchParams] = useSearchParams();
  const { currentStep, bookingData, updateBookingData, goToStep } = useBooking();
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linkData, setLinkData] = useState<BookingLink | null>(null);
  const [isReschedule, setIsReschedule] = useState(false);
  const [rescheduleData, setRescheduleData] = useState<any>(null);

  useEffect(() => {
    loadBookingLink();
  }, [companySlug, linkSlug, searchParams]);

  const loadBookingLink = async () => {
    console.log('Loading booking link:', { companySlug, linkSlug });
    
    // Check for reschedule data first
    console.log('=== CHECKING FOR RESCHEDULE DATA ===');
    const storedRescheduleData = sessionStorage.getItem('rescheduleData');
    console.log('Stored reschedule data:', storedRescheduleData);
    
    let localRescheduleData = null;
    let localIsReschedule = false;
    
    if (storedRescheduleData) {
      try {
        localRescheduleData = JSON.parse(storedRescheduleData);
        console.log('Parsed reschedule data:', localRescheduleData);
        localIsReschedule = true;
        setIsReschedule(true);
        setRescheduleData(localRescheduleData);
        console.log('Reschedule data loaded from storage');
      } catch (err) {
        console.error('Error parsing reschedule data:', err);
      }
    } else {
      console.log('No reschedule data found in session storage');
    }
    
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
      
      // Build initial booking data
      const initialData: any = { linkData: link };
      
      // Check for branch query parameter
      const branchParam = searchParams.get('branch');
      let preselectedBranchId: string | undefined;
      let shouldSkipBranchStep = false;
      
      // For single branch links, automatically set the branch
      if (link.branchSettings?.mode === 'single' && link.branchSettings?.defaultBranch) {
        initialData.branchId = link.branchSettings.defaultBranch;
        preselectedBranchId = link.branchSettings.defaultBranch;
      } else if (link.branchSettings?.allowedBranches?.length === 1) {
        // If only one branch is allowed, auto-select it
        initialData.branchId = link.branchSettings.allowedBranches[0];
        preselectedBranchId = link.branchSettings.allowedBranches[0];
      } else if (branchParam && link.branchSettings?.mode === 'multi') {
        // Check if the branch parameter is valid
        const branches = link.branchSettings.allowedBranches || [];
        if (branches.includes(branchParam)) {
          preselectedBranchId = branchParam;
          initialData.branchId = branchParam;
          // Skip branch selection step if valid branch is provided
          shouldSkipBranchStep = true;
        }
      } else {
        // Check localStorage for saved branch preference
        const savedBranchId = localStorage.getItem(`booking_branch_${link.companyId}`);
        if (savedBranchId && link.branchSettings?.allowedBranches?.includes(savedBranchId)) {
          initialData.branchId = savedBranchId;
        }
      }

      // Track view
      await bookingService.trackLinkView(link.id!);

      // Set default language
      if (link.settings.defaultLanguage && link.settings.defaultLanguage !== language) {
        // The language context will handle this
      }

      // If this is a reschedule, add reschedule info to initial data
      if (localIsReschedule && localRescheduleData) {
        console.log('=== SETTING RESCHEDULE INFO IN INITIAL DATA ===');
        console.log('localIsReschedule:', localIsReschedule);
        console.log('localRescheduleData:', localRescheduleData);
        
        const oldData = localRescheduleData.oldAppointmentData;
        
        // Override/add reschedule data
        initialData.customerName = oldData.clientName;
        initialData.customerPhone = oldData.clientPhone;
        initialData.customerEmail = oldData.clientEmail;
        initialData.branchId = oldData.branchId || preselectedBranchId;
        initialData.staffId = oldData.staffId;
        initialData.serviceIds = oldData.services?.map((s: any) => s.serviceId) || [];
        initialData.rescheduleInfo = {
          isReschedule: true,
          oldAppointmentId: localRescheduleData.oldAppointmentId,
        };
        
        console.log('Initial data with reschedule info:', initialData);
        
        // Clear reschedule data from storage after we've used it
        sessionStorage.removeItem('rescheduleData');
        console.log('Cleared reschedule data from session storage');
      }
      
      // Update booking data once with all initial data
      console.log('=== UPDATING BOOKING DATA WITH ALL INITIAL DATA ===');
      updateBookingData(initialData);
      console.log('Booking data updated');
      
      // Skip branch step if needed
      if (shouldSkipBranchStep) {
        goToStep(1); // Move to service selection
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
        {/* Header with Login */}
        <BookingHeader 
          logoUrl={linkData?.settings.logoUrl}
          businessName={linkData?.businessName}
        />
        
        {/* Page Title */}
        <Box sx={{ mb: 4, textAlign: 'center' }}>
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