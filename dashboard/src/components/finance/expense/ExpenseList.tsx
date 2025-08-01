import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  useTheme,
} from '@mui/material';
import { Add, Receipt } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

export default function ExpenseList() {
  const theme = useTheme();
  const navigate = useNavigate();
  const isRTL = theme.direction === 'rtl';

  return (
    <Box>
      <Card>
        <CardContent sx={{ textAlign: 'center', py: 8 }}>
          <Receipt sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            {isRTL ? 'قائمة المصروفات' : 'Expense List'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {isRTL 
              ? 'هنا ستظهر جميع المصروفات المسجلة مع إمكانية البحث والتصفية'
              : 'All recorded expenses will appear here with search and filter capabilities'
            }
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => navigate('/finance/expense/new')}
          >
            {isRTL ? 'إضافة مصروف' : 'Add Expense'}
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}