import React from 'react';
import {
  Box,
  Typography,
  TextField,
  useTheme,
  Paper,
} from '@mui/material';
import ServiceSelection from './ServiceSelection';
import type { Appointment } from '../../services/appointment.service';
import type { Service } from '../../services/service.service';

interface BasicInfoProps {
  appointment: Appointment | null;
  companyId: string;
  staffId?: string;
  notes: string;
  onNotesChange: (notes: string) => void;
  onServicesChange?: (services: Service[]) => void;
}

const BasicInfo: React.FC<BasicInfoProps> = ({
  appointment,
  companyId,
  staffId,
  notes,
  onNotesChange,
  onServicesChange,
}) => {
  const theme = useTheme();
  const isRTL = theme.direction === 'rtl';

  return (
    <Box>
      {/* Services Section */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
          {isRTL ? 'الخدمات' : 'Services'}
        </Typography>
        <Paper 
          elevation={0} 
          sx={{ 
            p: 2, 
            backgroundColor: theme.palette.mode === 'dark'
              ? theme.palette.background.paper
              : theme.palette.background.default,
            border: `1px solid ${theme.palette.divider}`,
          }}
        >
          <ServiceSelection
            appointment={appointment}
            companyId={companyId}
            staffId={staffId}
            onServicesChange={onServicesChange}
          />
        </Paper>
      </Box>

      {/* Notes Section */}
      <Box>
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
          {isRTL ? 'ملاحظات' : 'Notes'}
        </Typography>
        <TextField
          fullWidth
          multiline
          rows={4}
          placeholder={isRTL ? 'أضف ملاحظات حول الموعد...' : 'Add notes about the appointment...'}
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          sx={{
            '& .MuiOutlinedInput-root': {
              backgroundColor: theme.palette.background.paper,
            },
          }}
        />
      </Box>
    </Box>
  );
};

export default BasicInfo;