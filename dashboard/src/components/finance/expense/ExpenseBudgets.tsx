import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  useTheme,
} from '@mui/material';
import { Add, AccountBalance } from '@mui/icons-material';

export default function ExpenseBudgets() {
  const theme = useTheme();
  const isRTL = theme.direction === 'rtl';

  return (
    <Box>
      <Card>
        <CardContent sx={{ textAlign: 'center', py: 8 }}>
          <AccountBalance sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            {isRTL ? 'إدارة الميزانيات' : 'Budget Management'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {isRTL 
              ? 'تحديد ومراقبة الميزانيات لكل فئة من فئات المصروفات'
              : 'Set and monitor budgets for each expense category'
            }
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
          >
            {isRTL ? 'إنشاء ميزانية' : 'Create Budget'}
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}