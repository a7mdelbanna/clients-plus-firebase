import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Divider,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import { Timestamp } from 'firebase/firestore';
import {
  CheckCircle,
  CalendarToday,
  AccessTime,
  Person,
  Phone,
  Email,
  LocationOn,
  WhatsApp,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { useBooking } from '../contexts/BookingContext';
import { useLanguage } from '../contexts/LanguageContext';
import { bookingService } from '../services/booking.service';
import type { Branch, Service, Staff } from '../types/booking';

const BookingConfirmation: React.FC = () => {
  const { bookingData, resetBooking } = useBooking();
  const { t, language, isRTL } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const dateLocale = language === 'ar' ? ar : enUS;

  useEffect(() => {
    if (!isCreating) {
      createAppointment();
    }
  }, []);

  const loadBookingDetails = async () => {
    if (!bookingData.linkData) return;

    try {
      // Load branch details
      if (bookingData.branchId) {
        const branches = await bookingService.getBranchesForBooking(
          bookingData.linkData.companyId,
          [bookingData.branchId]
        );
        if (branches.length > 0) {
          setBranch(branches[0]);
        }
      }

      // Load services
      if (bookingData.serviceIds && bookingData.serviceIds.length > 0) {
        const allServices = await bookingService.getServicesForBooking(
          bookingData.linkData.companyId,
          bookingData.branchId!
        );
        const selectedServices = allServices.filter(s => 
          bookingData.serviceIds?.includes(s.id)
        );
        setServices(selectedServices);
      }

      // Load staff details
      if (bookingData.staffId && bookingData.staffId !== 'any') {
        const staffList = await bookingService.getStaffForBooking(
          bookingData.linkData.companyId,
          bookingData.branchId!
        );
        const selectedStaff = staffList.find(s => s.id === bookingData.staffId);
        if (selectedStaff) {
          setStaff(selectedStaff);
        }
      }
    } catch (err) {
      console.error('Error loading booking details:', err);
    }
  };

  const createAppointment = async () => {
    if (!bookingData.linkData || !bookingData.date || !bookingData.time) {
      setError('Missing booking information');
      setLoading(false);
      return;
    }

    // Prevent duplicate creation
    if (isCreating || appointmentId) {
      return;
    }

    setIsCreating(true);

    try {
      // Load services first
      let selectedServices: Service[] = [];
      if (bookingData.serviceIds && bookingData.serviceIds.length > 0) {
        const allServices = await bookingService.getServicesForBooking(
          bookingData.linkData.companyId,
          bookingData.branchId!
        );
        selectedServices = allServices.filter(s => 
          bookingData.serviceIds?.includes(s.id)
        );
        setServices(selectedServices);
      }

      await loadBookingDetails();

      // Calculate total duration and price
      let totalDuration = 30; // Default
      let totalPrice = 0;
      const appointmentServices = [];
      
      if (selectedServices.length > 0) {
        totalDuration = 0;
        for (const service of selectedServices) {
          const duration = (service.duration.hours || 0) * 60 + (service.duration.minutes || 0);
          totalDuration += duration;
          totalPrice += service.startingPrice || 0;
          
          // Create service object in dashboard format
          appointmentServices.push({
            serviceId: service.id,
            serviceName: service.name,
            duration: duration,
            price: service.startingPrice || 0
          });
        }
      }
      

      // Calculate end time
      const [hours, minutes] = bookingData.time!.split(':').map(Number);
      const startMinutes = hours * 60 + minutes;
      const endMinutes = startMinutes + totalDuration;
      const endHours = Math.floor(endMinutes / 60);
      const endMins = endMinutes % 60;
      const endTime = `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;

      // Create appointment with proper date format
      const appointmentDate = Timestamp.fromDate(bookingData.date!);
      
      // Find or create client
      const clientId = await bookingService.findOrCreateClient(
        bookingData.linkData.companyId,
        bookingData.branchId!,
        bookingData.customerName!,
        bookingData.customerPhone!,
        bookingData.customerEmail
      );
      
      
      const appointmentData = {
        companyId: bookingData.linkData.companyId,
        branchId: bookingData.branchId!,
        clientId: clientId,
        clientPhone: bookingData.customerPhone!,
        clientName: bookingData.customerName!,
        clientEmail: bookingData.customerEmail || '',
        staffId: bookingData.staffId === 'any' ? '' : bookingData.staffId!,
        staffName: staff?.name || 'Any Available',
        services: appointmentServices,
        date: appointmentDate,
        time: bookingData.time,
        startTime: bookingData.time,
        endTime: endTime,
        duration: totalDuration,
        totalDuration: totalDuration,
        totalPrice: totalPrice,
        status: 'pending' as const,
        source: 'online' as const,
        notes: bookingData.comments || '',
        bookingLinkId: bookingData.linkData.id,
        isNewClient: clientId !== 'guest', // Mark as new client if we created one
        createdBy: 'online-booking', // Add createdBy field
        categoryId: '', // No category for online bookings
        resources: [], // No resources
        // Add missing fields that dashboard might expect
        paymentStatus: 'none' as const,
        prepaidAmount: 0,
        // Add notifications array to trigger WhatsApp confirmation
        notifications: [{
          type: 'confirmation' as const,
          method: ['whatsapp'],
          sent: false
        }]
      };
      

      const id = await bookingService.createAppointment(appointmentData);
      setAppointmentId(id);
      setSuccess(true);
      setLoading(false);
      setIsCreating(false);
    } catch (err) {
      console.error('Error creating appointment:', err);
      setError('Failed to create booking. Please try again.');
      setLoading(false);
      setIsCreating(false);
    }
  };

  const handleBookAnother = () => {
    resetBooking();
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${period}`;
  };

  const getTotalPrice = () => {
    return services.reduce((sum, service) => sum + (service.startingPrice || 0), 0);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
        <CircularProgress size={60} />
        <Typography variant="body1" sx={{ mt: 2 }}>
          {t('creating_booking')}
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Button variant="contained" onClick={resetBooking}>
            {t('try_again')}
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      {/* Success Icon */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
        <CheckCircle color="success" sx={{ fontSize: 80 }} />
      </Box>

      <Typography variant="h4" align="center" gutterBottom>
        {t('booking_confirmed')}
      </Typography>
      
      <Typography variant="body1" align="center" color="textSecondary" paragraph>
        {t('booking_success_message')}
      </Typography>

      {/* Booking Details */}
      <Card sx={{ mt: 4, mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('booking_summary')}
          </Typography>
          
          <Divider sx={{ my: 2 }} />

          <Grid container spacing={2}>
            {/* Date & Time */}
            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <CalendarToday fontSize="small" color="action" />
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    {t('date')}
                  </Typography>
                  <Typography variant="body1">
                    {bookingData.date && format(bookingData.date, 'EEEE, dd MMMM yyyy', { locale: dateLocale })}
                  </Typography>
                </Box>
              </Box>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <AccessTime fontSize="small" color="action" />
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    {t('time')}
                  </Typography>
                  <Typography variant="body1">
                    {bookingData.time && formatTime(bookingData.time)}
                  </Typography>
                </Box>
              </Box>
            </Grid>

            {/* Branch */}
            {branch && (
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 2 }}>
                  <LocationOn fontSize="small" color="action" />
                  <Box>
                    <Typography variant="body2" color="textSecondary">
                      {t('branch')}
                    </Typography>
                    <Typography variant="body1">
                      {branch.name}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {branch.address.street}, {branch.address.city}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            )}

            {/* Services */}
            <Grid item xs={12}>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                {t('services')}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {services.map(service => (
                  <Chip
                    key={service.id}
                    label={`${service.name} (${service.startingPrice} ${t('egp')})`}
                    variant="outlined"
                  />
                ))}
              </Box>
              <Typography variant="h6" sx={{ mt: 2 }}>
                {t('total')}: {getTotalPrice()} {t('egp')}
              </Typography>
            </Grid>

            {/* Specialist */}
            {staff && (
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Person fontSize="small" color="action" />
                  <Box>
                    <Typography variant="body2" color="textSecondary">
                      {t('specialist')}
                    </Typography>
                    <Typography variant="body1">
                      {staff.name}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            )}

            <Divider sx={{ width: '100%', my: 2 }} />

            {/* Customer Info */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                {t('customer_info')}
              </Typography>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Person fontSize="small" color="action" />
                <Typography variant="body2">{bookingData.customerName}</Typography>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Phone fontSize="small" color="action" />
                <Typography variant="body2">{bookingData.customerPhone}</Typography>
              </Box>
              
              {bookingData.customerEmail && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Email fontSize="small" color="action" />
                  <Typography variant="body2">{bookingData.customerEmail}</Typography>
                </Box>
              )}
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* WhatsApp Notice */}
      <Alert 
        severity="success" 
        icon={<WhatsApp />}
        sx={{ mb: 3 }}
      >
        <Typography variant="body2">
          {t('whatsapp_confirmation_sent')}
        </Typography>
      </Alert>

      {/* Actions */}
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
        <Button 
          variant="contained" 
          size="large"
          onClick={handleBookAnother}
        >
          {t('book_another')}
        </Button>
      </Box>
    </Box>
  );
};

export default BookingConfirmation;