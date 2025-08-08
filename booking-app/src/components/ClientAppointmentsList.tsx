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
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Event as EventIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  LocalOffer as ServiceIcon,
  Store as StoreIcon,
  Cancel as CancelIcon,
  EventRepeat as RescheduleIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { useLanguage } from '../contexts/LanguageContext';
import { useClientAuth } from '../contexts/ClientAuthContext';
import { useBooking } from '../contexts/BookingContext';
import { appointmentService, type Appointment } from '../services/appointment.service';
import { debugAppointments } from '../utils/debugAppointments';
import { db } from '../config/firebase';
import { doc, getDoc, collection, getDocs, query, limit, where } from 'firebase/firestore';
import CancelAppointmentDialog from './CancelAppointmentDialog';
import RescheduleAppointmentDialog from './RescheduleAppointmentDialog';

const ClientAppointmentsList: React.FC = () => {
  const { t, language } = useLanguage();
  const { session } = useClientAuth();
  const { bookingData } = useBooking();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  useEffect(() => {
    if (session?.phoneNumber && bookingData?.linkData?.companyId) {
      loadAppointments();
    }
  }, [session, bookingData?.linkData?.companyId]);

  const enrichAppointmentWithStaffName = async (appointment: Appointment, companyId: string): Promise<Appointment> => {
    try {
      console.log('=== enrichAppointmentWithStaffName START ===');
      console.log('Appointment ID:', appointment.id);
      console.log('Current staffName:', appointment.staffName);
      console.log('Current staffId:', appointment.staffId);
      console.log('CompanyId:', companyId);
      
      // Debug the exact staffName value
      console.log('StaffName type:', typeof appointment.staffName);
      console.log('StaffName value (quoted):', `"${appointment.staffName}"`);
      console.log('StaffName length:', appointment.staffName?.length);
      console.log('StaffName charCodes:', appointment.staffName ? Array.from(appointment.staffName).map(c => c.charCodeAt(0)) : 'null');
      
      // If we already have a proper staff name, return as is
      const isAnyVariant = appointment.staffName && (
        appointment.staffName.toLowerCase() === 'any available' ||
        appointment.staffName.toLowerCase() === 'any available specialist' ||
        appointment.staffName === 'أي متخصص متاح' ||
        appointment.staffName === 'أي مختص متاح' ||
        appointment.staffName.trim() === ''
      );
      
      console.log('Is "Any" variant?', isAnyVariant);
      
      if (appointment.staffName && !isAnyVariant) {
        console.log('Already has proper staff name, returning as is');
        console.log('=== enrichAppointmentWithStaffName END (has name) ===');
        return appointment;
      }
    
    // Debug staffId value
    console.log('StaffId type:', typeof appointment.staffId);
    console.log('StaffId value (quoted):', `"${appointment.staffId}"`);
    console.log('StaffId === "any"?', appointment.staffId === 'any');
    console.log('StaffId === ""?', appointment.staffId === '');
    
    // If we have a staffId, try to fetch the staff name
    if (appointment.staffId && appointment.staffId !== 'any' && appointment.staffId.trim() !== '') {
      console.log('Has valid staffId, fetching staff data...');
      console.log('Fetching from path:', `staff/${appointment.staffId}`);
      
      try {
        // Staff is in top-level collection, not nested under companies
        const staffDoc = await getDoc(doc(db, 'staff', appointment.staffId));
        console.log('Staff doc exists?', staffDoc.exists());
        
        if (staffDoc.exists()) {
          const staffData = staffDoc.data();
          console.log('Staff data:', staffData);
          const staffName = staffData.name || staffData.firstName || staffData.fullName || '';
          console.log('Extracted staff name:', staffName);
          
          if (staffName) {
            const updatedAppointment = {
              ...appointment,
              staffName: staffName
            };
            console.log('Updated appointment with staff name:', updatedAppointment.staffName);
            return updatedAppointment;
          } else {
            console.log('Staff document exists but no name found');
          }
        } else {
          console.log('Staff document not found for ID:', appointment.staffId);
          console.log('Attempting to check if staff exists in different structure...');
          
          // Try to check the staff collection structure (top-level)
          const staffCollection = collection(db, 'staff');
          const staffQuery = query(staffCollection, where('companyId', '==', companyId), limit(1));
          const staffSnapshot = await getDocs(staffQuery);
          console.log('Sample staff doc for structure check:', staffSnapshot.empty ? 'No staff docs' : staffSnapshot.docs[0].data());
        }
      } catch (error) {
        console.error('Error fetching staff name for appointment:', appointment.id, error);
        console.error('Error details:', error);
      }
    } else {
      console.log('No valid staffId:', {
        staffId: appointment.staffId,
        isEmptyString: appointment.staffId === '',
        isTrimmedEmpty: appointment.staffId?.trim() === '',
        isAny: appointment.staffId === 'any'
      });
    }
    
    console.log('=== enrichAppointmentWithStaffName END ===');
    return appointment;
    } catch (error) {
      console.error('ERROR in enrichAppointmentWithStaffName:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : String(error),
        appointment: appointment.id,
        staffId: appointment.staffId
      });
      console.log('=== enrichAppointmentWithStaffName END (error) ===');
      return appointment;
    }
  };

  const debugStaffCollection = async (companyId: string) => {
    console.log('=== DEBUG STAFF COLLECTION ===');
    try {
      // Staff is in top-level collection
      const staffQuery = query(collection(db, 'staff'), where('companyId', '==', companyId), limit(3));
      const staffSnapshot = await getDocs(staffQuery);
      console.log('Staff collection size for company:', staffSnapshot.size);
      staffSnapshot.forEach((doc) => {
        console.log('Staff doc:', {
          id: doc.id,
          data: doc.data()
        });
      });
    } catch (error) {
      console.error('Error accessing staff collection:', error);
    }
    console.log('=== END DEBUG STAFF ===');
  };

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
      
      // Debug staff collection structure
      await debugStaffCollection(companyId);
      
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
      console.log('First 3 appointments before enrichment:');
      appointmentsList.slice(0, 3).forEach(apt => {
        console.log('- ID:', apt.id, 'StaffId:', apt.staffId, 'StaffName:', apt.staffName);
        console.log('  Full appointment:', JSON.stringify(apt, null, 2));
      });
      
      // Enrich appointments with staff names if needed
      const enrichedAppointments = await Promise.all(
        appointmentsList.map(apt => enrichAppointmentWithStaffName(apt, companyId))
      );
      
      console.log('Appointments enriched, total:', enrichedAppointments.length);
      console.log('First 3 appointments after enrichment:');
      enrichedAppointments.slice(0, 3).forEach(apt => {
        console.log('- ID:', apt.id, 'StaffId:', apt.staffId, 'StaffName:', apt.staffName);
      });
      setAppointments(enrichedAppointments);
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

  const handleCancelClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setCancelDialogOpen(true);
  };

  const handleCancelSuccess = () => {
    // Reload appointments after successful cancellation
    loadAppointments();
  };

  const handleRescheduleClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setRescheduleDialogOpen(true);
  };

  const handleRescheduleSuccess = () => {
    // Reload appointments after successful rescheduling
    loadAppointments();
  };

  const canCancelAppointment = (appointment: Appointment): boolean => {
    // Check if appointment can be cancelled
    if (!['pending', 'confirmed'].includes(appointment.status)) {
      return false;
    }
    
    // Check if appointment is in the future
    const appointmentDate = appointment.date.toDate 
      ? appointment.date.toDate() 
      : new Date(appointment.date);
    
    return appointmentDate > new Date();
  };

  const canRescheduleAppointment = (appointment: Appointment): boolean => {
    // Same logic as cancellation - can only reschedule pending/confirmed future appointments
    return canCancelAppointment(appointment);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'success';
      case 'completed':
        return 'info';
      case 'cancelled':
        return 'error';
      case 'rescheduled':
        return 'default';
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
      case 'rescheduled':
        return t('rescheduled');
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
              <ListItem sx={{ 
                py: 2,
                opacity: appointment.status === 'rescheduled' ? 0.6 : 1,
                backgroundColor: appointment.status === 'rescheduled' ? 'action.disabledBackground' : 'transparent'
              }}>
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
                      {(appointment.staffName || appointment.staffId) && (
                        <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <PersonIcon fontSize="small" />
                          <Typography component="span" variant="body2">
                            {(() => {
                              const isAnyStaff = !appointment.staffName || 
                                  appointment.staffName.toLowerCase() === 'any available' ||
                                  appointment.staffName.toLowerCase() === 'any available specialist' ||
                                  appointment.staffName === 'أي متخصص متاح' ||
                                  appointment.staffName === 'أي مختص متاح' ||
                                  appointment.staffName === t('any_specialist') ||
                                  appointment.staffName.trim() === '';
                              
                              if (!isAnyStaff) {
                                return appointment.staffName;
                              }
                              return t('any_specialist');
                            })()}
                          </Typography>
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
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <Typography variant="subtitle1" color="primary">
                    {appointment.totalPrice} {t('egp')}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {canRescheduleAppointment(appointment) && appointment.status !== 'rescheduled' && (
                      <Tooltip title={t('reschedule_appointment')}>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleRescheduleClick(appointment)}
                          sx={{ mt: 1 }}
                        >
                          <RescheduleIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                    {canCancelAppointment(appointment) && appointment.status !== 'rescheduled' && (
                      <Tooltip title={t('cancel_appointment')}>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleCancelClick(appointment)}
                          sx={{ mt: 1 }}
                        >
                          <CancelIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </Box>
              </ListItem>
              {index < appointments.length - 1 && <Divider />}
            </React.Fragment>
          );
        })}
      </List>
      
      {/* Cancel Appointment Dialog */}
      {selectedAppointment && session && (
        <CancelAppointmentDialog
          open={cancelDialogOpen}
          onClose={() => {
            setCancelDialogOpen(false);
            setSelectedAppointment(null);
          }}
          appointment={selectedAppointment}
          clientId={session.clientId}
          onSuccess={handleCancelSuccess}
        />
      )}
      
      {/* Reschedule Appointment Dialog */}
      {selectedAppointment && (
        <RescheduleAppointmentDialog
          open={rescheduleDialogOpen}
          onClose={() => {
            setRescheduleDialogOpen(false);
            setSelectedAppointment(null);
          }}
          appointment={selectedAppointment}
          onSuccess={handleRescheduleSuccess}
        />
      )}
    </Box>
  );
};

export default ClientAppointmentsList;