import React from 'react';
import { Stepper, Step, StepLabel, Box, useTheme, useMediaQuery } from '@mui/material';
import { useBooking } from '../contexts/BookingContext';
import { useLanguage } from '../contexts/LanguageContext';

const BookingStepper: React.FC = () => {
  const { currentStep, steps, bookingData } = useBooking();
  const { t } = useLanguage();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Filter out branch step if not needed
  const needsBranchSelection = bookingData.linkData?.branchSettings?.mode === 'multi' || 
    (bookingData.linkData?.branchSettings?.allowedBranches && 
     bookingData.linkData.branchSettings.allowedBranches.length > 1);

  const displaySteps = needsBranchSelection ? steps : steps.filter(step => step.id !== 'branch');
  const adjustedCurrentStep = needsBranchSelection ? currentStep : currentStep - 1;

  return (
    <Box sx={{ width: '100%' }}>
      <Stepper 
        activeStep={adjustedCurrentStep} 
        alternativeLabel={!isMobile}
        orientation={isMobile ? 'vertical' : 'horizontal'}
      >
        {displaySteps.map((step) => (
          <Step key={step.id}>
            <StepLabel>{t(step.label)}</StepLabel>
          </Step>
        ))}
      </Stepper>
    </Box>
  );
};

export default BookingStepper;