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
  TextField,
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
  const [testPhone, setTestPhone] = useState('');

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
      
      
      const appointmentData: any = {
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
      

      console.log('Creating appointment with data:', JSON.stringify(appointmentData, null, 2));
      const id = await bookingService.createAppointment(appointmentData);
      console.log('Appointment created with ID:', id);
      setAppointmentId(id);
      
      // Send WhatsApp notification using the same logic as test button
      try {
          console.log('Sending WhatsApp notification for appointment:', id);
          
          // Import required Firebase functions
          const { doc, getDoc, addDoc, collection, serverTimestamp } = await import('firebase/firestore');
          const { db } = await import('../config/firebase');
          const { getFunctions, httpsCallable } = await import('firebase/functions');
          const functions = getFunctions();
          
          const companyId = bookingData.linkData?.companyId;
          
          // 1. Get WhatsApp config from Firestore
          console.log('Getting WhatsApp config for company:', companyId);
          const configDoc = await getDoc(doc(db, 'whatsappConfigs', companyId));
          
          if (configDoc.exists() && configDoc.data().enabled) {
          const config = configDoc.data();
          console.log('WhatsApp config found and enabled');
          
          // Format phone number
          let formattedPhone = bookingData.customerPhone!.replace(/[\s\-\(\)]/g, '');
          if (!formattedPhone.startsWith('+')) {
            formattedPhone = '+20' + formattedPhone.replace(/^0+/, '');
          }
          
          // Get service names
          let serviceName = 'خدمة';
          if (selectedServices && selectedServices.length > 0) {
            serviceName = selectedServices.map(s => s.name).join(', ');
            console.log('Service names:', serviceName);
          } else {
            console.log('No services found, using default');
          }
          
          // Get staff name
          let staffName = 'الفريق';
          if (bookingData.staffId && bookingData.staffId !== 'any') {
            // Load staff if not already loaded
            if (!staff) {
              const staffList = await bookingService.getStaffForBooking(
                bookingData.linkData.companyId,
                bookingData.branchId!
              );
              const selectedStaff = staffList.find(s => s.id === bookingData.staffId);
              if (selectedStaff) {
                staffName = selectedStaff.name;
                console.log('Staff name loaded:', staffName);
              }
            } else {
              staffName = staff.name;
            }
          }
          
          // Get location settings for better business info
          let locationSettings: any = null;
          let googleMapsLink = '';
          let businessPhone = '';
          let businessAddress = '';
          let businessName = branch?.name || 'الصالون';
          
          try {
            // Try to get location settings
            const branchId = bookingData.branchId || 'main';
            const locationDoc = await getDoc(doc(db, 'locationSettings', `${companyId}_${branchId}`));
            
            if (!locationDoc.exists() && branchId === 'main') {
              // Try branch 1 as fallback
              const locationDoc1 = await getDoc(doc(db, 'locationSettings', `${companyId}_1`));
              if (locationDoc1.exists()) {
                locationSettings = locationDoc1.data();
              }
            } else if (locationDoc.exists()) {
              locationSettings = locationDoc.data();
            }
            
            // Get business details from location settings
            if (locationSettings) {
              businessName = locationSettings.basic?.businessName || 
                            locationSettings.basic?.locationName || 
                            branch?.name || 
                            'الصالون';
              
              // Get coordinates for Google Maps link
              if (locationSettings.contact?.coordinates?.lat && locationSettings.contact?.coordinates?.lng) {
                const { lat, lng } = locationSettings.contact.coordinates;
                googleMapsLink = `https://maps.google.com/?q=${lat},${lng}`;
              }
              
              // Get phone with country code
              if (locationSettings.contact?.phones && locationSettings.contact.phones.length > 0) {
                const phone = locationSettings.contact.phones[0];
                businessPhone = `${phone.countryCode || ''}${phone.number || ''}`.trim();
              }
              
              // Get address
              if (locationSettings.contact?.address) {
                // Try formatted first, then build from parts
                if (locationSettings.contact.address.formatted) {
                  businessAddress = locationSettings.contact.address.formatted;
                } else if (locationSettings.contact.address.street || locationSettings.contact.address.city) {
                  const parts = [];
                  if (locationSettings.contact.address.street) parts.push(locationSettings.contact.address.street);
                  if (locationSettings.contact.address.city) parts.push(locationSettings.contact.address.city);
                  if (locationSettings.contact.address.state) parts.push(locationSettings.contact.address.state);
                  businessAddress = parts.join(', ');
                }
                console.log('Business address from location settings:', businessAddress);
              }
            }
          } catch (error) {
            console.error('Error loading location settings:', error);
          }
          
          // Fallback to branch data if no location settings
          if (!businessPhone && branch?.contact?.phones?.[0]) {
            businessPhone = branch.contact.phones[0].number;
          }
          
          if (!businessAddress && branch?.address) {
            businessAddress = `${branch.address.street}, ${branch.address.city}`;
          }
          
          // 2. Create message in Firestore (like dashboard does)
          const messageData = {
            companyId,
            clientId: clientId,
            appointmentId: id,
            to: formattedPhone,
            type: 'appointment_confirmation' as const,
            templateName: 'appointment_confirmation',
            templateLanguage: 'ar' as const,
            parameters: {
              clientName: bookingData.customerName,
              date: bookingData.date!.toLocaleDateString('ar-EG', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              }),
              time: bookingData.time || appointmentData.startTime,
              service: serviceName,
              staffName: staffName,
              businessName,
              businessAddress,
              businessPhone,
              googleMapsLink,
              language: 'ar'
            },
            status: 'pending' as const,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          };
          
          console.log('WhatsApp message parameters:', {
            service: serviceName,
            staffName: staffName,
            businessName,
            businessAddress,
            businessPhone,
            googleMapsLink
          });
          
          console.log('Saving WhatsApp message to Firestore...');
          const docRef = await addDoc(
            collection(db, 'companies', companyId, 'whatsappMessages'),
            messageData
          );
          console.log('Message saved with ID:', docRef.id);
          
          // 3. Call Cloud Function with message ID and full config
          const sendWhatsApp = httpsCallable(functions, 'sendWhatsAppMessage');
          
          const functionData = {
            messageId: docRef.id,
            companyId,
            config,
            message: {
              ...messageData,
              id: docRef.id
            }
          };
          
          console.log('Calling Cloud Function to send WhatsApp...');
          
          const result = await sendWhatsApp(functionData);
          console.log('WhatsApp notification sent:', result.data);
        } else {
          console.log('WhatsApp not configured or not enabled for company');
        }
      } catch (error) {
        console.error('Error sending WhatsApp notification:', error);
        // Don't throw - we don't want to break the booking flow
      }
      
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

      {/* WhatsApp Test Section - Remove in production */}
      {process.env.NODE_ENV === 'development' && (
        <Box sx={{ mt: 4, p: 3, bgcolor: 'grey.100', borderRadius: 2 }}>
          <Typography variant="h6" gutterBottom>Test WhatsApp Notification</Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Test WhatsApp message sending without creating an appointment
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
            <TextField
              label="Phone Number"
              placeholder="01234567890"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              size="small"
              sx={{ flex: 1 }}
              helperText="Egyptian number without country code"
            />
            
            <Button 
              variant="contained" 
              onClick={async () => {
                if (!testPhone) {
                  alert('Please enter a phone number');
                  return;
                }
                
                try {
                  console.log('Testing WhatsApp to:', testPhone);
                  
                  // Import required Firebase functions
                  const { doc, getDoc, addDoc, collection, serverTimestamp } = await import('firebase/firestore');
                  const { db } = await import('../config/firebase');
                  const { getFunctions, httpsCallable } = await import('firebase/functions');
                  const functions = getFunctions();
                  
                  const companyId = bookingData.linkData?.companyId || 'au2wTbq7XDNcRGTtTkNm';
                  
                  // Format phone number
                  let formattedPhone = testPhone.replace(/[\s\-\(\)]/g, '');
                  if (!formattedPhone.startsWith('+')) {
                    formattedPhone = '+20' + formattedPhone.replace(/^0+/, '');
                  }
                  
                  // 1. Get WhatsApp config from Firestore
                  console.log('Getting WhatsApp config for company:', companyId);
                  const configDoc = await getDoc(doc(db, 'whatsappConfigs', companyId));
                  
                  if (!configDoc.exists()) {
                    alert('WhatsApp is not configured for this company');
                    return;
                  }
                  
                  const config = configDoc.data();
                  console.log('Config found:', { 
                    enabled: config.enabled, 
                    provider: config.provider,
                    hasAccountSid: !!config.accountSid,
                    hasAuthToken: !!config.authToken,
                    hasWhatsAppNumber: !!config.twilioWhatsAppNumber
                  });
                  
                  if (!config.enabled) {
                    alert('WhatsApp is not enabled for this company');
                    return;
                  }
                  
                  // Get location settings for test
                  let testGoogleMapsLink = '';
                  let testBusinessName = 'صالون تجريبي';
                  let testBusinessAddress = 'عنوان تجريبي';
                  let testBusinessPhone = '+201234567890';
                  
                  try {
                    const branchId = bookingData.branchId || 'main';
                    const locationDoc = await getDoc(doc(db, 'locationSettings', `${companyId}_${branchId}`));
                    
                    if (!locationDoc.exists() && branchId === 'main') {
                      const locationDoc1 = await getDoc(doc(db, 'locationSettings', `${companyId}_1`));
                      if (locationDoc1.exists()) {
                        const locData = locationDoc1.data();
                        if (locData.contact?.coordinates?.lat && locData.contact?.coordinates?.lng) {
                          testGoogleMapsLink = `https://maps.google.com/?q=${locData.contact.coordinates.lat},${locData.contact.coordinates.lng}`;
                        }
                        testBusinessName = locData.basic?.businessName || testBusinessName;
                        if (locData.contact?.phones?.[0]) {
                          testBusinessPhone = `${locData.contact.phones[0].countryCode || ''}${locData.contact.phones[0].number || ''}`.trim();
                        }
                        if (locData.contact?.address) {
                          testBusinessAddress = locData.contact.address.formatted || testBusinessAddress;
                        }
                      }
                    } else if (locationDoc.exists()) {
                      const locData = locationDoc.data();
                      if (locData.contact?.coordinates?.lat && locData.contact?.coordinates?.lng) {
                        testGoogleMapsLink = `https://maps.google.com/?q=${locData.contact.coordinates.lat},${locData.contact.coordinates.lng}`;
                      }
                      testBusinessName = locData.basic?.businessName || testBusinessName;
                      if (locData.contact?.phones?.[0]) {
                        testBusinessPhone = `${locData.contact.phones[0].countryCode || ''}${locData.contact.phones[0].number || ''}`.trim();
                      }
                      if (locData.contact?.address) {
                        testBusinessAddress = locData.contact.address.formatted || testBusinessAddress;
                      }
                    }
                  } catch (error) {
                    console.error('Error loading location for test:', error);
                  }
                  
                  // 2. Create message in Firestore (like dashboard does)
                  const messageData = {
                    companyId,
                    clientId: 'test-client',
                    appointmentId: appointmentId || 'test-appointment',
                    to: formattedPhone,
                    type: 'appointment_confirmation' as const,
                    templateName: 'appointment_confirmation',
                    templateLanguage: 'ar' as const,
                    parameters: {
                      clientName: 'عميل تجريبي',
                      date: new Date().toLocaleDateString('ar-EG'),
                      time: '10:00',
                      service: 'خدمة تجريبية',
                      staffName: 'موظف تجريبي',
                      businessName: testBusinessName,
                      businessAddress: testBusinessAddress,
                      businessPhone: testBusinessPhone,
                      googleMapsLink: testGoogleMapsLink,
                      language: 'ar'
                    },
                    status: 'pending' as const,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                  };
                  
                  console.log('Saving message to Firestore...');
                  const docRef = await addDoc(
                    collection(db, 'companies', companyId, 'whatsappMessages'),
                    messageData
                  );
                  console.log('Message saved with ID:', docRef.id);
                  
                  // 3. Call Cloud Function with message ID and full config
                  const sendWhatsApp = httpsCallable(functions, 'sendWhatsAppMessage');
                  
                  const functionData = {
                    messageId: docRef.id,
                    companyId,
                    config,
                    message: {
                      ...messageData,
                      id: docRef.id
                    }
                  };
                  
                  console.log('Calling Cloud Function with:', functionData);
                  
                  const result = await sendWhatsApp(functionData);
                  console.log('Cloud Function result:', result.data);
                  
                  alert('WhatsApp message sent successfully! Check your phone.');
                  
                } catch (error) {
                  console.error('WhatsApp test error:', error);
                  alert('Error: ' + (error as any).message);
                }
              }}
            >
              Send Test WhatsApp
            </Button>
          </Box>
          
          {appointmentId && (
            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #ddd' }}>
              <Typography variant="caption" color="textSecondary">
                Appointment ID: {appointmentId} | Company: {bookingData.linkData?.companyId}
              </Typography>
              <Button 
                size="small"
                sx={{ ml: 2 }}
                onClick={() => {
                  console.log('Debug Info:', {
                    appointmentId,
                    bookingData,
                    linkData: bookingData.linkData
                  });
                }}
              >
                Log Debug Info
              </Button>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export default BookingConfirmation;