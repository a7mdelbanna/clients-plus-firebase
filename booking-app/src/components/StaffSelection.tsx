import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  CircularProgress,
  Alert,
  Avatar,
  Chip,
  Rating,
} from '@mui/material';
import {
  Person,
  CheckCircle,
} from '@mui/icons-material';
import { useBooking } from '../contexts/BookingContext';
import { useLanguage } from '../contexts/LanguageContext';
import { bookingService } from '../services/booking.service';
import type { Staff, Service } from '../types/booking';

const StaffSelection: React.FC = () => {
  const { bookingData, updateBookingData, nextStep, previousStep } = useBooking();
  const { t, isRTL } = useLanguage();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<string>(bookingData.staffId || '');
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);

  useEffect(() => {
    loadStaff();
    loadSelectedServices();
  }, [bookingData.branchId, bookingData.serviceIds]);

  const loadSelectedServices = async () => {
    if (!bookingData.linkData || !bookingData.serviceIds || bookingData.serviceIds.length === 0) return;

    try {
      const services = await bookingService.getServicesForBooking(
        bookingData.linkData.companyId,
        bookingData.branchId!
      );
      const selected = services.filter(s => bookingData.serviceIds?.includes(s.id));
      setSelectedServices(selected);
    } catch (err) {
      console.error('Error loading selected services:', err);
    }
  };

  const loadStaff = async () => {
    if (!bookingData.linkData || !bookingData.branchId) return;

    try {
      setLoading(true);
      
      // Get staff that can perform all selected services
      let staffList: Staff[] = [];
      
      if (bookingData.serviceIds && bookingData.serviceIds.length > 0) {
        // For each service, get staff that can perform it
        const staffSets = await Promise.all(
          bookingData.serviceIds.map(serviceId =>
            bookingService.getStaffForBooking(
              bookingData.linkData!.companyId,
              bookingData.branchId!,
              serviceId
            )
          )
        );
        
        // Find staff that can perform ALL selected services
        if (staffSets.length > 0) {
          const firstSet = staffSets[0];
          staffList = firstSet.filter(staffMember =>
            staffSets.every(set => set.some(s => s.id === staffMember.id))
          );
        }
      } else {
        // No services selected, show all staff
        staffList = await bookingService.getStaffForBooking(
          bookingData.linkData.companyId,
          bookingData.branchId
        );
      }
      
      setStaff(staffList);
      
      // If only one staff member, auto-select
      if (staffList.length === 1 && !bookingData.linkData.settings.allowAnyEmployee) {
        setSelectedStaff(staffList[0].id);
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Error loading staff:', err);
      setError('Failed to load specialists');
      setLoading(false);
    }
  };

  const handleStaffSelect = (staffId: string) => {
    setSelectedStaff(staffId);
  };

  const handleContinue = () => {
    if (selectedStaff || bookingData.linkData?.settings.allowAnyEmployee) {
      updateBookingData({ staffId: selectedStaff || 'any' });
      nextStep();
    }
  };

  const getStaffServices = (staffMember: Staff): string => {
    if (!selectedServices.length) return '';
    
    const staffServiceIds = staffMember.services || [];
    const providedServices = selectedServices
      .filter(service => staffServiceIds.includes(service.id))
      .map(service => service.name);
    
    return providedServices.join(', ');
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ py: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        {t('select_specialist')}
      </Typography>
      
      <Typography variant="body2" color="textSecondary" paragraph>
        {t('choose_specialist_for_service')}
      </Typography>

      {/* Any Specialist Option */}
      {bookingData.linkData?.settings.allowAnyEmployee && (
        <Card
          sx={{
            mb: 3,
            border: 2,
            borderColor: selectedStaff === 'any' ? 'primary.main' : 'divider',
            transition: 'all 0.3s',
            '&:hover': {
              borderColor: 'primary.main',
              transform: 'translateY(-2px)',
              boxShadow: 2,
            },
          }}
        >
          <CardActionArea onClick={() => handleStaffSelect('any')}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'primary.main', width: 60, height: 60 }}>
                  <Person fontSize="large" />
                </Avatar>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="h6">
                    {t('any_specialist')}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {t('first_available_specialist')}
                  </Typography>
                </Box>
                {selectedStaff === 'any' && (
                  <CheckCircle color="primary" fontSize="large" />
                )}
              </Box>
            </CardContent>
          </CardActionArea>
        </Card>
      )}

      {/* Staff Grid */}
      <Grid container spacing={2}>
        {staff.map((staffMember) => (
          <Grid item xs={12} md={6} key={staffMember.id}>
            <Card
              sx={{
                height: '100%',
                border: 2,
                borderColor: selectedStaff === staffMember.id ? 'primary.main' : 'divider',
                transition: 'all 0.3s',
                '&:hover': {
                  borderColor: 'primary.main',
                  transform: 'translateY(-2px)',
                  boxShadow: 2,
                },
              }}
            >
              <CardActionArea
                onClick={() => handleStaffSelect(staffMember.id)}
                sx={{ height: '100%' }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Avatar
                      src={staffMember.avatar}
                      sx={{ width: 80, height: 80 }}
                    >
                      {!staffMember.avatar && staffMember.name.charAt(0)}
                    </Avatar>
                    
                    <Box sx={{ flexGrow: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="h6">
                          {staffMember.name}
                        </Typography>
                        {selectedStaff === staffMember.id && (
                          <CheckCircle color="primary" fontSize="small" />
                        )}
                      </Box>
                      
                      {staffMember.position && (
                        <Typography variant="body2" color="textSecondary" gutterBottom>
                          {staffMember.position}
                        </Typography>
                      )}
                      
                      {staffMember.onlineBooking?.profile?.description && (
                        <Typography variant="body2" color="textSecondary" paragraph>
                          {staffMember.onlineBooking.profile.description}
                        </Typography>
                      )}
                      
                      {/* Services this staff can provide */}
                      {selectedServices.length > 0 && (
                        <Typography variant="caption" color="textSecondary">
                          {getStaffServices(staffMember)}
                        </Typography>
                      )}
                      
                      {/* Rating */}
                      {bookingData.linkData?.settings.showEmployeeRatings && 
                       staffMember.onlineBooking?.profile?.showRating && (
                        <Box sx={{ mt: 1 }}>
                          <Rating value={4.5} readOnly size="small" />
                        </Box>
                      )}
                    </Box>
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>

      {staff.length === 0 && !bookingData.linkData?.settings.allowAnyEmployee && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography color="textSecondary">
            {t('no_specialists_available')}
          </Typography>
        </Box>
      )}

      {/* Navigation */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
        <Button variant="outlined" onClick={previousStep}>
          {t('previous')}
        </Button>
        <Button
          variant="contained"
          onClick={handleContinue}
          disabled={!selectedStaff && !bookingData.linkData?.settings.allowAnyEmployee}
        >
          {t('next')}
        </Button>
      </Box>
    </Box>
  );
};

export default StaffSelection;