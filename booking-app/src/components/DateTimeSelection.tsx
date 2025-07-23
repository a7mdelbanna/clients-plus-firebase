import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  CalendarToday,
  AccessTime,
  ChevronLeft,
  ChevronRight,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TextField } from '@mui/material';
import { format, addDays, isSameDay, startOfWeek, endOfWeek } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { useBooking } from '../contexts/BookingContext';
import { useLanguage } from '../contexts/LanguageContext';
import { bookingService } from '../services/booking.service';
import type { TimeSlot, Service } from '../types/booking';

const DateTimeSelection: React.FC = () => {
  const { bookingData, updateBookingData, nextStep, previousStep } = useBooking();
  const { t, isRTL, language } = useLanguage();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [selectedDate, setSelectedDate] = useState<Date>(bookingData.date || new Date());
  const [selectedTime, setSelectedTime] = useState<string>(bookingData.time || '');
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalDuration, setTotalDuration] = useState(0);
  const [weekDates, setWeekDates] = useState<Date[]>([]);

  const dateLocale = language === 'ar' ? ar : enUS;

  useEffect(() => {
    calculateTotalDuration();
  }, [bookingData.serviceIds]);

  useEffect(() => {
    generateWeekDates();
  }, [selectedDate]);

  useEffect(() => {
    if (bookingData.staffId && selectedDate) {
      loadTimeSlots();
    }
  }, [selectedDate, bookingData.staffId]);

  const calculateTotalDuration = async () => {
    if (!bookingData.linkData || !bookingData.serviceIds || bookingData.serviceIds.length === 0) {
      setTotalDuration(30); // Default 30 minutes
      return;
    }

    try {
      const services = await bookingService.getServicesForBooking(
        bookingData.linkData.companyId,
        bookingData.branchId!
      );
      
      const selectedServices = services.filter(s => bookingData.serviceIds?.includes(s.id));
      const total = selectedServices.reduce((sum, service) => {
        return sum + (service.duration.hours || 0) * 60 + (service.duration.minutes || 0);
      }, 0);
      
      setTotalDuration(total || 30);
    } catch (err) {
      console.error('Error calculating duration:', err);
      setTotalDuration(30);
    }
  };

  const generateWeekDates = () => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 0 });
    const dates = [];
    for (let i = 0; i < 7; i++) {
      dates.push(addDays(start, i));
    }
    setWeekDates(dates);
  };

  const loadTimeSlots = async () => {
    console.log('loadTimeSlots called with:', {
      branchId: bookingData.branchId,
      staffId: bookingData.staffId,
      selectedDate: selectedDate,
      dateString: selectedDate.toISOString(),
      dayOfWeek: selectedDate.toLocaleDateString('en-US', { weekday: 'long' })
    });
    
    if (!bookingData.linkData || !bookingData.branchId || !bookingData.staffId) {
      console.log('Missing required data for time slots');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const slots = await bookingService.getAvailableTimeSlots(
        bookingData.linkData.companyId,
        bookingData.branchId,
        bookingData.staffId, // Pass 'any' as is, don't convert to empty string
        selectedDate,
        totalDuration
      );
      
      console.log('Received time slots:', slots);
      setTimeSlots(slots);
      setLoading(false);
    } catch (err) {
      console.error('Error loading time slots:', err);
      setError('Failed to load available times');
      setLoading(false);
    }
  };

  const handleDateChange = (date: Date | null) => {
    if (date) {
      setSelectedDate(date);
      setSelectedTime(''); // Reset time when date changes
    }
  };

  const handleQuickDateSelect = (date: Date) => {
    setSelectedDate(date);
    setSelectedTime(''); // Reset time when date changes
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
  };

  const handleContinue = () => {
    if (selectedDate && selectedTime) {
      updateBookingData({ 
        date: selectedDate,
        time: selectedTime,
      });
      nextStep();
    }
  };

  const formatTimeSlot = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${period}`;
  };

  const groupTimeSlotsByPeriod = () => {
    const morning: TimeSlot[] = [];
    const afternoon: TimeSlot[] = [];
    const evening: TimeSlot[] = [];

    timeSlots.forEach(slot => {
      const hour = parseInt(slot.time.split(':')[0]);
      if (hour < 12) {
        morning.push(slot);
      } else if (hour < 17) {
        afternoon.push(slot);
      } else {
        evening.push(slot);
      }
    });

    return { morning, afternoon, evening };
  };

  const { morning, afternoon, evening } = groupTimeSlotsByPeriod();

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        {t('select_date_time')}
      </Typography>
      
      <Typography variant="body2" color="textSecondary" paragraph>
        {t('choose_preferred_date_time')}
      </Typography>

      {/* Date Selection */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CalendarToday fontSize="small" />
          {t('date')}
        </Typography>

        {/* Quick Date Selection */}
        <Box sx={{ mb: 2, overflowX: 'auto' }}>
          <Box sx={{ display: 'flex', gap: 1, minWidth: 'fit-content' }}>
            {weekDates.map((date) => (
              <Card
                key={date.toISOString()}
                sx={{
                  minWidth: 80,
                  cursor: 'pointer',
                  border: 2,
                  borderColor: isSameDay(date, selectedDate) ? 'primary.main' : 'divider',
                  transition: 'all 0.3s',
                  '&:hover': {
                    borderColor: 'primary.main',
                    transform: 'translateY(-2px)',
                  },
                }}
                onClick={() => handleQuickDateSelect(date)}
              >
                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="caption" display="block" textAlign="center">
                    {format(date, 'EEE', { locale: dateLocale })}
                  </Typography>
                  <Typography variant="h6" textAlign="center">
                    {format(date, 'd')}
                  </Typography>
                  <Typography variant="caption" display="block" textAlign="center">
                    {format(date, 'MMM', { locale: dateLocale })}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>
        </Box>

        {/* Date Picker */}
        <DatePicker
          value={selectedDate}
          onChange={handleDateChange}
          minDate={new Date()}
          renderInput={(params) => <TextField {...params} fullWidth />}
          slotProps={{
            textField: {
              fullWidth: true,
              sx: { mb: 2 }
            }
          }}
        />
      </Box>

      {/* Time Selection */}
      <Box>
        <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AccessTime fontSize="small" />
          {t('time')}
        </Typography>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        ) : timeSlots.length === 0 ? (
          <Alert severity="info">{t('no_available_times')}</Alert>
        ) : (
          <>
            {/* Morning Slots */}
            {morning.length > 0 && bookingData.linkData?.settings.showMorningSlots && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom color="textSecondary">
                  {t('morning')}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {morning.map((slot) => (
                    <Chip
                      key={slot.time}
                      label={formatTimeSlot(slot.time)}
                      onClick={() => slot.available && handleTimeSelect(slot.time)}
                      color={selectedTime === slot.time ? 'primary' : 'default'}
                      variant={selectedTime === slot.time ? 'filled' : 'outlined'}
                      disabled={!slot.available}
                      sx={{ 
                        cursor: slot.available ? 'pointer' : 'not-allowed',
                        opacity: slot.available ? 1 : 0.5,
                      }}
                    />
                  ))}
                </Box>
              </Box>
            )}

            {/* Afternoon Slots */}
            {afternoon.length > 0 && bookingData.linkData?.settings.showAfternoonSlots && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom color="textSecondary">
                  {t('afternoon')}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {afternoon.map((slot) => (
                    <Chip
                      key={slot.time}
                      label={formatTimeSlot(slot.time)}
                      onClick={() => slot.available && handleTimeSelect(slot.time)}
                      color={selectedTime === slot.time ? 'primary' : 'default'}
                      variant={selectedTime === slot.time ? 'filled' : 'outlined'}
                      disabled={!slot.available}
                      sx={{ 
                        cursor: slot.available ? 'pointer' : 'not-allowed',
                        opacity: slot.available ? 1 : 0.5,
                      }}
                    />
                  ))}
                </Box>
              </Box>
            )}

            {/* Evening Slots */}
            {evening.length > 0 && bookingData.linkData?.settings.showEveningSlots && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom color="textSecondary">
                  {t('evening')}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {evening.map((slot) => (
                    <Chip
                      key={slot.time}
                      label={formatTimeSlot(slot.time)}
                      onClick={() => slot.available && handleTimeSelect(slot.time)}
                      color={selectedTime === slot.time ? 'primary' : 'default'}
                      variant={selectedTime === slot.time ? 'filled' : 'outlined'}
                      disabled={!slot.available}
                      sx={{ 
                        cursor: slot.available ? 'pointer' : 'not-allowed',
                        opacity: slot.available ? 1 : 0.5,
                      }}
                    />
                  ))}
                </Box>
              </Box>
            )}
          </>
        )}
      </Box>

      {/* Navigation */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
        <Button variant="outlined" onClick={previousStep}>
          {t('previous')}
        </Button>
        <Button
          variant="contained"
          onClick={handleContinue}
          disabled={!selectedDate || !selectedTime}
        >
          {t('next')}
        </Button>
      </Box>
    </Box>
  );
};

export default DateTimeSelection;