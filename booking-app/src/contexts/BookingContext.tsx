import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { BookingLink } from '../types/booking';

interface BookingStep {
  id: 'branch' | 'service' | 'specialist' | 'datetime' | 'info' | 'confirmation';
  label: string;
  completed: boolean;
}

interface BookingData {
  linkData?: BookingLink;
  branchId?: string;
  serviceId?: string;
  serviceIds?: string[]; // For multiple services
  staffId?: string;
  date?: Date;
  time?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  comments?: string;
  rescheduleInfo?: {
    isReschedule: boolean;
    oldAppointmentId: string;
  };
}

interface BookingContextType {
  currentStep: number;
  steps: BookingStep[];
  bookingData: BookingData;
  updateBookingData: (data: Partial<BookingData>) => void;
  nextStep: () => void;
  previousStep: () => void;
  goToStep: (step: number) => void;
  resetBooking: () => void;
}

const BookingContext = createContext<BookingContextType | undefined>(undefined);

export const useBooking = () => {
  const context = useContext(BookingContext);
  if (!context) {
    throw new Error('useBooking must be used within a BookingProvider');
  }
  return context;
};

interface BookingProviderProps {
  children: ReactNode;
}

export const BookingProvider: React.FC<BookingProviderProps> = ({ children }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [bookingData, setBookingData] = useState<BookingData>({});

  // Dynamic steps based on booking link configuration
  const getSteps = (): BookingStep[] => {
    const baseSteps: BookingStep[] = [
      { id: 'service', label: 'select_service', completed: false },
      { id: 'specialist', label: 'select_specialist', completed: false },
      { id: 'datetime', label: 'select_date_time', completed: false },
      { id: 'info', label: 'customer_info', completed: false },
      { id: 'confirmation', label: 'confirmation', completed: false },
    ];

    // Add branch step if needed
    const needsBranchSelection = bookingData.linkData?.branchSettings?.mode === 'multi' || 
      (bookingData.linkData?.branchSettings?.allowedBranches && 
       bookingData.linkData.branchSettings.allowedBranches.length > 1);

    if (needsBranchSelection) {
      baseSteps.unshift({ id: 'branch', label: 'select_branch', completed: false });
    }

    return baseSteps;
  };

  const steps = getSteps();

  const updateBookingData = (data: Partial<BookingData>) => {
    console.log('=== updateBookingData called ===');
    console.log('Current bookingData:', bookingData);
    console.log('Update data:', data);
    
    setBookingData(prev => {
      // Preserve rescheduleInfo if it exists and not explicitly being updated
      const preservedRescheduleInfo = prev.rescheduleInfo && !data.rescheduleInfo 
        ? { rescheduleInfo: prev.rescheduleInfo } 
        : {};
      
      const newData = { ...prev, ...preservedRescheduleInfo, ...data };
      console.log('New bookingData will be:', newData);
      return newData;
    });
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const previousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const goToStep = (step: number) => {
    if (step >= 0 && step < steps.length) {
      setCurrentStep(step);
    }
  };

  const resetBooking = () => {
    setCurrentStep(0);
    setBookingData({});
  };

  const value: BookingContextType = {
    currentStep,
    steps,
    bookingData,
    updateBookingData,
    nextStep,
    previousStep,
    goToStep,
    resetBooking,
  };

  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
};