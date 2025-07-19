import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  useTheme,
  Paper,
  Chip,
} from '@mui/material';
import {
  Add,
  ChevronLeft,
  ChevronRight,
  Today,
  ViewDay,
  ViewWeek,
  ViewModule,
  FilterList,
} from '@mui/icons-material';
import { format, startOfWeek, endOfWeek, addDays, addWeeks, subWeeks, isSameDay, startOfDay, endOfDay } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { useAuth } from '../../contexts/AuthContext';
import { appointmentService } from '../../services/appointment.service';
import { staffService } from '../../services/staff.service';
import AppointmentCalendar from '../../components/appointments/AppointmentCalendar';
import AppointmentForm from '../../components/appointments/AppointmentForm';
import type { Appointment } from '../../services/appointment.service';
import type { Staff } from '../../services/staff.service';

type ViewType = 'day' | 'week' | 'month';

const AppointmentsPage: React.FC = () => {
  const theme = useTheme();
  const { currentUser } = useAuth();
  const isRTL = theme.direction === 'rtl';
  const locale = isRTL ? ar : enUS;

  // State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<ViewType>('week');
  const [selectedStaff, setSelectedStaff] = useState<string>('all');
  const [staff, setStaff] = useState<Staff[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [openAppointmentForm, setOpenAppointmentForm] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{ date: Date; time: string } | null>(null);
  const [companyId, setCompanyId] = useState<string>('');

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      if (!currentUser) return;

      try {
        // Add a small delay to ensure auth state is fully initialized
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const idTokenResult = await currentUser.getIdTokenResult();
        const userCompanyId = idTokenResult.claims.companyId as string;
        
        if (!userCompanyId) {
          console.error('No companyId found in user claims');
          return;
        }
        
        setCompanyId(userCompanyId);

        // Load staff
        try {
          const staffList = await staffService.getStaff(userCompanyId);
          setStaff(staffList);

          // Set first staff as default if available
          if (staffList.length > 0 && selectedStaff === 'all') {
            setSelectedStaff(staffList[0].id!);
          }
        } catch (staffError) {
          console.error('Error loading staff:', staffError);
          // Continue even if staff loading fails
          setStaff([]);
        }
      } catch (error) {
        console.error('Error loading initial data:', error);
      }
    };

    loadInitialData();
  }, [currentUser]);

  // Load appointments when date or staff changes
  useEffect(() => {
    if (companyId && selectedStaff !== 'all') {
      loadAppointments();
    }
  }, [companyId, currentDate, selectedStaff, viewType]);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      
      let startDate: Date;
      let endDate: Date;

      if (viewType === 'day') {
        startDate = startOfDay(currentDate);
        endDate = endOfDay(currentDate);
      } else if (viewType === 'week') {
        startDate = startOfWeek(currentDate, { locale });
        endDate = endOfWeek(currentDate, { locale });
      } else {
        // Month view - load 6 weeks to ensure full month display
        startDate = startOfWeek(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1), { locale });
        endDate = endOfWeek(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0), { locale });
      }

      const appointmentsList = await appointmentService.getAppointments(
        companyId,
        startDate,
        endDate,
        selectedStaff !== 'all' ? selectedStaff : undefined
      );

      setAppointments(appointmentsList);
    } catch (error) {
      console.error('Error loading appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  // Navigation handlers
  const handlePrevious = () => {
    if (viewType === 'day') {
      setCurrentDate(prev => addDays(prev, -1));
    } else if (viewType === 'week') {
      setCurrentDate(prev => subWeeks(prev, 1));
    } else {
      setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    }
  };

  const handleNext = () => {
    if (viewType === 'day') {
      setCurrentDate(prev => addDays(prev, 1));
    } else if (viewType === 'week') {
      setCurrentDate(prev => addWeeks(prev, 1));
    } else {
      setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Appointment handlers
  const handleTimeSlotClick = (date: Date, time: string) => {
    setSelectedTimeSlot({ date, time });
    setSelectedAppointment(null);
    setOpenAppointmentForm(true);
  };

  const handleAppointmentClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setSelectedTimeSlot(null);
    setOpenAppointmentForm(true);
  };

  const handleAppointmentFormClose = () => {
    setOpenAppointmentForm(false);
    setSelectedAppointment(null);
    setSelectedTimeSlot(null);
  };

  const handleAppointmentFormSuccess = async () => {
    await loadAppointments();
    handleAppointmentFormClose();
  };

  // Get current view date range text
  const getDateRangeText = () => {
    if (viewType === 'day') {
      return format(currentDate, 'EEEE, MMMM d, yyyy', { locale });
    } else if (viewType === 'week') {
      const start = startOfWeek(currentDate, { locale });
      const end = endOfWeek(currentDate, { locale });
      return `${format(start, 'MMM d', { locale })} - ${format(end, 'MMM d, yyyy', { locale })}`;
    } else {
      return format(currentDate, 'MMMM yyyy', { locale });
    }
  };

  // Get selected staff name
  const getSelectedStaffName = () => {
    if (selectedStaff === 'all') return isRTL ? 'جميع الموظفين' : 'All Staff';
    const staffMember = staff.find(s => s.id === selectedStaff);
    return staffMember?.name || '';
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper sx={{ p: 2, borderRadius: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5">
            {isRTL ? 'التقويم' : 'Calendar'}
          </Typography>
          
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => {
              setSelectedAppointment(null);
              setSelectedTimeSlot(null);
              setOpenAppointmentForm(true);
            }}
            sx={{ 
              backgroundColor: theme.palette.primary.main,
              '&:hover': {
                backgroundColor: theme.palette.primary.dark,
              }
            }}
          >
            {isRTL ? 'موعد جديد' : 'New Appointment'}
          </Button>
        </Box>

        {/* Controls */}
        <Box sx={{ 
          display: 'flex', 
          gap: 2, 
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          {/* Date Navigation */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              variant="outlined"
              onClick={handleToday}
              startIcon={<Today />}
            >
              {isRTL ? 'اليوم' : 'Today'}
            </Button>
            
            <IconButton onClick={handlePrevious}>
              {isRTL ? <ChevronRight /> : <ChevronLeft />}
            </IconButton>
            
            <Typography variant="h6" sx={{ minWidth: 200, textAlign: 'center' }}>
              {getDateRangeText()}
            </Typography>
            
            <IconButton onClick={handleNext}>
              {isRTL ? <ChevronLeft /> : <ChevronRight />}
            </IconButton>
          </Box>

          {/* View Type Toggle */}
          <ToggleButtonGroup
            value={viewType}
            exclusive
            onChange={(_, newView) => newView && setViewType(newView)}
            size="small"
          >
            <ToggleButton value="day">
              <ViewDay />
            </ToggleButton>
            <ToggleButton value="week">
              <ViewWeek />
            </ToggleButton>
            <ToggleButton value="month">
              <ViewModule />
            </ToggleButton>
          </ToggleButtonGroup>

          {/* Staff Selector */}
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>{isRTL ? 'الموظف' : 'Staff'}</InputLabel>
            <Select
              value={selectedStaff}
              onChange={(e) => setSelectedStaff(e.target.value)}
              label={isRTL ? 'الموظف' : 'Staff'}
            >
              <MenuItem value="all">{isRTL ? 'جميع الموظفين' : 'All Staff'}</MenuItem>
              {staff.map((member) => (
                <MenuItem key={member.id} value={member.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {member.name}
                    {member.position && (
                      <Chip label={member.position} size="small" />
                    )}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Filter Button */}
          <IconButton>
            <FilterList />
          </IconButton>
        </Box>
      </Paper>

      {/* Calendar */}
      <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
        <AppointmentCalendar
          appointments={appointments}
          currentDate={currentDate}
          viewType={viewType}
          selectedStaff={selectedStaff}
          staff={staff}
          loading={loading}
          onTimeSlotClick={handleTimeSlotClick}
          onAppointmentClick={handleAppointmentClick}
        />
      </Box>

      {/* Appointment Form Dialog */}
      <AppointmentForm
        open={openAppointmentForm}
        appointment={selectedAppointment}
        defaultDate={selectedTimeSlot?.date}
        defaultTime={selectedTimeSlot?.time}
        defaultStaffId={selectedStaff !== 'all' ? selectedStaff : undefined}
        companyId={companyId}
        onClose={handleAppointmentFormClose}
        onSuccess={handleAppointmentFormSuccess}
      />
    </Box>
  );
};

export default AppointmentsPage;