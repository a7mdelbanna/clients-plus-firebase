import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import { Warning as WarningIcon } from '@mui/icons-material';
import { useLanguage } from '../contexts/LanguageContext';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { appointmentService, type Appointment } from '../services/appointment.service';

interface CancelAppointmentDialogProps {
  open: boolean;
  onClose: () => void;
  appointment: Appointment;
  clientId: string;
  onSuccess: () => void;
}

const CancelAppointmentDialog: React.FC<CancelAppointmentDialogProps> = ({
  open,
  onClose,
  appointment,
  clientId,
  onSuccess,
}) => {
  const { t, language } = useLanguage();
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCancel = async () => {
    if (!appointment.id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      await appointmentService.cancelAppointment(
        appointment.id,
        clientId,
        reason.trim()
      );
      
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error cancelling appointment:', err);
      setError(
        err instanceof Error 
          ? err.message 
          : t('error_cancelling_appointment')
      );
    } finally {
      setLoading(false);
    }
  };

  const appointmentDate = appointment.date.toDate 
    ? appointment.date.toDate() 
    : new Date(appointment.date);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      dir={language === 'ar' ? 'rtl' : 'ltr'}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon color="warning" />
          <Typography variant="h6">{t('cancel_appointment')}</Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Alert severity="warning" sx={{ mb: 2 }}>
            {t('cancel_appointment_warning')}
          </Alert>
          
          <Typography variant="body2" color="textSecondary" gutterBottom>
            {t('appointment_details')}:
          </Typography>
          
          <Box sx={{ pl: 2, mb: 2 }}>
            <Typography variant="body2">
              <strong>{t('date')}:</strong>{' '}
              {format(appointmentDate, 'EEEE, d MMMM yyyy', {
                locale: language === 'ar' ? ar : enUS,
              })}
            </Typography>
            <Typography variant="body2">
              <strong>{t('time')}:</strong> {appointment.startTime}
            </Typography>
            <Typography variant="body2">
              <strong>{t('services')}:</strong>{' '}
              {appointment.services?.map(s => s.serviceName).join(', ')}
            </Typography>
            {appointment.staffName && (
              <Typography variant="body2">
                <strong>{t('specialist')}:</strong> {appointment.staffName}
              </Typography>
            )}
          </Box>
          
          <TextField
            fullWidth
            multiline
            rows={3}
            label={t('cancellation_reason_optional')}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('cancellation_reason_placeholder')}
          />
        </Box>
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          {t('keep_appointment')}
        </Button>
        <Button
          onClick={handleCancel}
          color="error"
          variant="contained"
          disabled={loading}
          startIcon={loading && <CircularProgress size={20} />}
        >
          {t('confirm_cancellation')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CancelAppointmentDialog;