import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  CalendarToday as CalendarIcon,
  AccessTime as TimeIcon,
  Person as PersonIcon,
  MedicalServices as ServiceIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { useLanguage } from '../contexts/LanguageContext';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../config/firebase';

interface RescheduleAppointmentDialogProps {
  open: boolean;
  onClose: () => void;
  appointment: any;
  onSuccess: () => void;
}

const RescheduleAppointmentDialog: React.FC<RescheduleAppointmentDialogProps> = ({
  open,
  onClose,
  appointment,
  onSuccess,
}) => {
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Format time for display
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${period}`;
  };

  // Get appointment date
  const getAppointmentDate = () => {
    if (!appointment?.date) return null;
    return appointment.date.toDate ? appointment.date.toDate() : new Date(appointment.date);
  };

  const handleReschedule = async () => {
    if (!appointment) return;

    setLoading(true);
    setError(null);

    try {
      // Get the booking link information
      let bookingLinkId = appointment.bookingLinkId;
      let companySlug = '';
      let linkSlug = '';

      // If we have bookingLinkId, get the link info
      if (bookingLinkId) {
        const linkDoc = await getDoc(doc(db, 'bookingLinks', bookingLinkId));
        if (linkDoc.exists()) {
          const linkData = linkDoc.data();
          companySlug = linkData.companySlug || '';
          linkSlug = linkData.slug || '';
        }
      }

      // If we don't have the link info, try to get it from the company
      if (!companySlug || !linkSlug) {
        const companyDoc = await getDoc(doc(db, 'companies', appointment.companyId));
        if (companyDoc.exists()) {
          const companyData = companyDoc.data();
          companySlug = companyData.slug || '';
          
          // Get the first active booking link for this company
          const bookingLinksQuery = query(
            collection(db, 'bookingLinks'),
            where('companyId', '==', appointment.companyId),
            where('status', '==', 'active'),
            limit(1)
          );
          
          const bookingLinksSnapshot = await getDocs(bookingLinksQuery);
          if (!bookingLinksSnapshot.empty) {
            const activeLink = bookingLinksSnapshot.docs[0].data();
            linkSlug = activeLink.slug || '';
            bookingLinkId = bookingLinksSnapshot.docs[0].id;
          }
        }
      }

      if (!companySlug || !linkSlug) {
        throw new Error(t('booking_link_not_found'));
      }

      // Store reschedule data in session storage
      const rescheduleData = {
        oldAppointmentId: appointment.id,
        oldAppointmentData: {
          branchId: appointment.branchId,
          services: appointment.services,
          staffId: appointment.staffId,
          clientName: appointment.clientName,
          clientPhone: appointment.clientPhone,
          clientEmail: appointment.clientEmail,
        },
        isReschedule: true,
      };
      
      sessionStorage.setItem('rescheduleData', JSON.stringify(rescheduleData));

      // Redirect to booking page
      const bookingUrl = `/book/${companySlug}/${linkSlug}`;
      window.location.href = bookingUrl;
      
    } catch (err: any) {
      console.error('Error initiating reschedule:', err);
      setError(err.message || t('error_rescheduling_appointment'));
      setLoading(false);
    }
  };

  const appointmentDate = getAppointmentDate();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="h6" component="div">
          {t('reschedule_appointment')}
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Current Appointment Details */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            {t('current_appointment')}
          </Typography>
          <Box sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <CalendarIcon fontSize="small" color="action" />
              <Typography variant="body2">
                {appointmentDate ? format(appointmentDate, 'PPP', { locale: language === 'ar' ? ar : enUS }) : ''}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <TimeIcon fontSize="small" color="action" />
              <Typography variant="body2">
                {appointment?.startTime ? formatTime(appointment.startTime) : ''}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <PersonIcon fontSize="small" color="action" />
              <Typography variant="body2">
                {appointment?.staffName || t('any_specialist')}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ServiceIcon fontSize="small" color="action" />
              <Typography variant="body2">
                {appointment?.services?.map((s: any) => s.serviceName).join(', ')}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Reschedule Information */}
        <Alert severity="info" icon={<CalendarIcon />}>
          <Typography variant="body2">
            {t('reschedule_info_message')}
          </Typography>
        </Alert>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={loading}>
          {t('cancel')}
        </Button>
        <Button
          onClick={handleReschedule}
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : <CalendarIcon />}
        >
          {loading ? t('loading') : t('continue_to_reschedule')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RescheduleAppointmentDialog;