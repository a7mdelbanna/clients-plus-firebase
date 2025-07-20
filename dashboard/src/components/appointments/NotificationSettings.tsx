import React, { useState } from 'react';
import {
  Box,
  Typography,
  FormControl,
  FormControlLabel,
  Switch,
  Select,
  MenuItem,
  TextField,
  Button,
  Divider,
  Radio,
  RadioGroup,
  Checkbox,
  Chip,
  useTheme,
  Paper,
  Alert,
} from '@mui/material';
import {
  Email,
  Sms,
  Send,
  Notifications,
} from '@mui/icons-material';
import type { Appointment } from '../../services/appointment.service';

interface NotificationSettingsProps {
  appointment: Appointment | null;
  onNotificationChange?: (notifications: any) => void;
}

const NotificationSettings: React.FC<NotificationSettingsProps> = ({
  appointment,
  onNotificationChange,
}) => {
  const theme = useTheme();
  const isRTL = theme.direction === 'rtl';

  // Notification states
  const [bookingConfirmation, setBookingConfirmation] = useState(true);
  const [preVisitReminder, setPreVisitReminder] = useState({
    enabled: true,
    sms: true,
    email: true,
    timing: '1',
  });
  const [repeatVisitReminder, setRepeatVisitReminder] = useState({
    enabled: false,
    service: '',
    timing: '14',
  });
  const [customMessage, setCustomMessage] = useState('');
  const [sendVia, setSendVia] = useState({
    sms: false,
    push: false,
    email: false,
  });

  const handleSendMessage = () => {
    console.log('Sending custom message:', customMessage, sendVia);
    // Implement send logic
  };

  return (
    <Box>
      {/* Booking Confirmation */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          {isRTL ? 'تأكيد الحجز' : 'Booking confirmation'}
        </Typography>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {isRTL 
            ? 'سيتم إرسال الإشعار إلى العملاء عبر قنوات التوصيل المحددة.'
            : 'The notification will be sent to clients via the selected delivery channels.'}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Chip
            icon={<Email />}
            label={isRTL ? 'بريد إلكتروني' : 'Email'}
            size="small"
            variant="outlined"
          />
          <Button variant="text" size="small">
            {isRTL ? 'إرسال' : 'Send'}
          </Button>
        </Box>
      </Paper>

      <Divider sx={{ my: 2 }} />

      {/* Pre-visit Reminder */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          {isRTL ? 'تذكير ما قبل الزيارة' : 'Pre-visit reminder'}
        </Typography>

        <Box sx={{ display: 'flex', gap: 4, mb: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {isRTL ? 'طريقة الإشعار' : 'Notification method'}
            </Typography>
            <FormControlLabel
              control={
                <Checkbox
                  checked={preVisitReminder.sms}
                  onChange={(e) => setPreVisitReminder({
                    ...preVisitReminder,
                    sms: e.target.checked,
                  })}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Sms sx={{ fontSize: 20, color: theme.palette.warning.main }} />
                  SMS
                </Box>
              }
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={preVisitReminder.email}
                  onChange={(e) => setPreVisitReminder({
                    ...preVisitReminder,
                    email: e.target.checked,
                  })}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Email sx={{ fontSize: 20, color: theme.palette.info.main }} />
                  {isRTL ? 'بريد إلكتروني' : 'Email'}
                </Box>
              }
            />
          </Box>

          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {isRTL ? 'متى قبل الزيارة' : 'How long before the visit'}
            </Typography>
            <Select
              fullWidth
              size="small"
              value={preVisitReminder.timing}
              onChange={(e) => setPreVisitReminder({
                ...preVisitReminder,
                timing: e.target.value,
              })}
            >
              <MenuItem value="1">{isRTL ? 'ساعة واحدة' : '1 hour'}</MenuItem>
              <MenuItem value="2">{isRTL ? 'ساعتان' : '2 hours'}</MenuItem>
              <MenuItem value="6">{isRTL ? '6 ساعات' : '6 hours'}</MenuItem>
              <MenuItem value="12">{isRTL ? '12 ساعة' : '12 hours'}</MenuItem>
              <MenuItem value="24">{isRTL ? '24 ساعة' : '24 hours'}</MenuItem>
            </Select>
          </Box>
        </Box>
      </Paper>

      <Divider sx={{ my: 2 }} />

      {/* Repeat Visit Reminder */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          {isRTL ? 'تذكير الزيارة المتكررة' : 'Repeat visit reminder'}
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {isRTL 
            ? 'سيتم إرسال الإشعار إلى العملاء عبر قنوات التوصيل المحددة.'
            : 'The notification will be sent to clients via the selected delivery channels.'}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Chip
            icon={<Email />}
            label={isRTL ? 'بريد إلكتروني' : 'Email'}
            size="small"
            variant="outlined"
          />
        </Box>

        <Box sx={{ display: 'flex', gap: 4 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {isRTL ? 'الخدمة المقدمة' : 'Provided service'}
            </Typography>
            <TextField
              fullWidth
              size="small"
              placeholder={isRTL ? 'الخدمة' : 'Service'}
              value={repeatVisitReminder.service}
              onChange={(e) => setRepeatVisitReminder({
                ...repeatVisitReminder,
                service: e.target.value,
              })}
            />
          </Box>

          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {isRTL ? 'كم من الوقت بعد الزيارة' : 'How long after the visit'}
            </Typography>
            <Select
              fullWidth
              size="small"
              value={repeatVisitReminder.timing}
              onChange={(e) => setRepeatVisitReminder({
                ...repeatVisitReminder,
                timing: e.target.value,
              })}
            >
              <MenuItem value="7">{isRTL ? '7 أيام' : '7 days'}</MenuItem>
              <MenuItem value="14">{isRTL ? '14 يوم' : '14 days'}</MenuItem>
              <MenuItem value="30">{isRTL ? '30 يوم' : '30 days'}</MenuItem>
              <MenuItem value="60">{isRTL ? '60 يوم' : '60 days'}</MenuItem>
              <MenuItem value="90">{isRTL ? '90 يوم' : '90 days'}</MenuItem>
            </Select>
          </Box>
        </Box>
      </Paper>

      <Divider sx={{ my: 2 }} />

      {/* Send a Message */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          {isRTL ? 'إرسال رسالة' : 'Send a message'}
        </Typography>

        <TextField
          fullWidth
          multiline
          rows={4}
          placeholder={isRTL ? 'أدخل نص الرسالة' : 'Enter the message text'}
          value={customMessage}
          onChange={(e) => setCustomMessage(e.target.value)}
          sx={{ mb: 2 }}
        />

        <Typography variant="body2" color="text.secondary" gutterBottom>
          {isRTL ? 'إرسال عبر' : 'Send via'}
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={sendVia.sms}
                onChange={(e) => setSendVia({ ...sendVia, sms: e.target.checked })}
              />
            }
            label="SMS"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={sendVia.push}
                onChange={(e) => setSendVia({ ...sendVia, push: e.target.checked })}
              />
            }
            label={isRTL ? 'إشعار فوري' : 'Push'}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={sendVia.email}
                onChange={(e) => setSendVia({ ...sendVia, email: e.target.checked })}
              />
            }
            label={isRTL ? 'بريد إلكتروني' : 'Email'}
          />
        </Box>

        <Button
          variant="outlined"
          startIcon={<Send />}
          onClick={handleSendMessage}
          disabled={!customMessage || (!sendVia.sms && !sendVia.push && !sendVia.email)}
        >
          {isRTL ? 'إرسال الرسالة' : 'Send message'}
        </Button>
      </Paper>
    </Box>
  );
};

export default NotificationSettings;