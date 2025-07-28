import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';
import {
  Event as EventIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  LocalOffer as ServiceIcon,
  Store as StoreIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { useLanguage } from '../contexts/LanguageContext';
import { useClientAuth } from '../contexts/ClientAuthContext';
import { useBooking } from '../contexts/BookingContext';
import { appointmentService, type Appointment } from '../services/appointment.service';
import { debugAppointments } from '../utils/debugAppointments';

const ClientAppointmentsList: React.FC = () => {
  const { t, language } = useLanguage();
  const { session } = useClientAuth();
  const { bookingData } = useBooking();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session?.phoneNumber && bookingData?.linkData?.companyId) {
      loadAppointments();
    }
  }, [session, bookingData?.linkData?.companyId]);

  const loadAppointments = async () => {
    console.log('=== ClientAppointmentsList: loadAppointments START ===');
    console.log('Session:', session);
    console.log('BookingData:', bookingData);
    
    if (!session?.phoneNumber || !bookingData?.linkData?.companyId) {
      console.log('Missing required data:', { 
        hasPhone: !!session?.phoneNumber, 
        hasCompanyId: !!bookingData?.linkData?.companyId 
      });
      return;
    }

    try {
      setLoading(true);
      const companyId = bookingData.linkData.companyId;
      console.log('Company ID:', companyId);
      console.log('Client phone:', session.phoneNumber);
      console.log('Client ID:', session.clientId);
      
      let appointmentsList: Appointment[] = [];
      
      // If we have a real client ID, use it
      if (session.clientId && session.clientId !== 'mock-client-123') {
        console.log('Using clientId query for real client:', session.clientId);
        appointmentsList = await appointmentService.getClientAppointments(
          companyId,
          session.clientId
        );
      } else {
        // For mock clients, search by phone number
        console.log('Using phone query for mock client:', session.phoneNumber);
        
        // Debug appointments data
        await debugAppointments(companyId, session.phoneNumber);
        
        appointmentsList = await appointmentService.getClientAppointmentsByPhone(
          companyId,
          session.phoneNumber
        );
      }

      console.log('Appointments loaded:', appointmentsList.length);
      console.log('Appointments data:', appointmentsList);
      setAppointments(appointmentsList);
    } catch (err) {
      console.error('=== ClientAppointmentsList: ERROR ===');
      console.error('Error type:', err instanceof Error ? err.constructor.name : typeof err);
      console.error('Error message:', err instanceof Error ? err.message : err);
      console.error('Full error:', err);
      setError(t('error_loading_appointments'));
    } finally {
      setLoading(false);
      console.log('=== ClientAppointmentsList: loadAppointments END ===');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'success';
      case 'completed':
        return 'info';
      case 'cancelled':
        return 'error';
      default:
        return 'warning';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmed':
        return t('confirmed');
      case 'completed':
        return t('completed');
      case 'cancelled':
        return t('cancelled');
      default:
        return t('pending');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  if (appointments.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', p: 3 }}>
        <Typography variant="body2" color="textSecondary">
          {t('no_appointments_yet')}
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ px: 2, pt: 2 }}>
        {t('my_appointments')}
      </Typography>
      
      <List>
        {appointments.map((appointment, index) => {
          // Parse the date properly
          const appointmentDate = appointment.date.toDate 
            ? appointment.date.toDate() 
            : new Date(appointment.date);
          
          // Extract service names from the services array
          const serviceNames = appointment.services?.map(s => s.serviceName) || [];
          
          return (
            <React.Fragment key={appointment.id}>
              <ListItem sx={{ py: 2 }}>
                <ListItemIcon>
                  <EventIcon color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography component="span" variant="subtitle1">
                        {format(appointmentDate, 'EEEE, d MMMM yyyy', {
                          locale: language === 'ar' ? ar : enUS,
                        })}
                      </Typography>
                      <Chip
                        label={getStatusLabel(appointment.status)}
                        color={getStatusColor(appointment.status)}
                        size="small"
                      />
                    </Box>
                  }
                  secondary={
                    <Box component="span" sx={{ display: 'block', mt: 1 }}>
                      <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <ScheduleIcon fontSize="small" />
                        <Typography component="span" variant="body2">{appointment.startTime}</Typography>
                      </Box>
                      <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <ServiceIcon fontSize="small" />
                        <Typography component="span" variant="body2">
                          {serviceNames.join(', ')}
                        </Typography>
                      </Box>
                      {appointment.staffName && (
                        <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <PersonIcon fontSize="small" />
                          <Typography component="span" variant="body2">{appointment.staffName}</Typography>
                        </Box>
                      )}
                      {appointment.branchName && (
                        <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <StoreIcon fontSize="small" />
                          <Typography component="span" variant="body2">{appointment.branchName}</Typography>
                        </Box>
                      )}
                    </Box>
                  }
                />
                <Typography variant="subtitle1" color="primary">
                  {appointment.totalPrice} {t('egp')}
                </Typography>
              </ListItem>
              {index < appointments.length - 1 && <Divider />}
            </React.Fragment>
          );
        })}
      </List>
    </Box>
  );
};

export default ClientAppointmentsList;