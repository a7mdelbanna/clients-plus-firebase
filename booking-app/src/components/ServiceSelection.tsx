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
  Chip,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Search,
  AccessTime,
  AttachMoney,
} from '@mui/icons-material';
import { useBooking } from '../contexts/BookingContext';
import { useLanguage } from '../contexts/LanguageContext';
import { bookingService } from '../services/booking.service';
import type { Service } from '../types/booking';

interface ServiceCategory {
  id: string;
  name: string;
  services: Service[];
}

const ServiceSelection: React.FC = () => {
  const { bookingData, updateBookingData, nextStep, previousStep } = useBooking();
  const { t, isRTL } = useLanguage();
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedServices, setSelectedServices] = useState<string[]>(bookingData.serviceIds || []);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    loadServices();
  }, [bookingData.branchId]);

  const loadServices = async () => {
    console.log('Loading services - Branch ID:', bookingData.branchId, 'Link Data:', bookingData.linkData);
    
    if (!bookingData.linkData || !bookingData.branchId) {
      console.log('Missing data - cannot load services');
      return;
    }

    try {
      setLoading(true);
      const serviceList = await bookingService.getServicesForBooking(
        bookingData.linkData.companyId,
        bookingData.branchId
      );
      
      console.log('Services loaded:', serviceList);
      setServices(serviceList);
      
      // Group services by category
      const categoryMap = new Map<string, ServiceCategory>();
      serviceList.forEach(service => {
        const catId = service.categoryId || 'uncategorized';
        if (!categoryMap.has(catId)) {
          categoryMap.set(catId, {
            id: catId,
            name: catId === 'uncategorized' ? t('uncategorized') : catId,
            services: [],
          });
        }
        categoryMap.get(catId)!.services.push(service);
      });
      
      setCategories(Array.from(categoryMap.values()));
      setLoading(false);
    } catch (err) {
      console.error('Error loading services:', err);
      setError('Failed to load services');
      setLoading(false);
    }
  };

  const handleServiceToggle = (serviceId: string) => {
    if (bookingData.linkData?.settings.allowMultipleBookings) {
      setSelectedServices(prev => 
        prev.includes(serviceId)
          ? prev.filter(id => id !== serviceId)
          : [...prev, serviceId]
      );
    } else {
      setSelectedServices([serviceId]);
    }
  };

  const handleContinue = () => {
    if (selectedServices.length > 0) {
      updateBookingData({ 
        serviceIds: selectedServices,
        serviceId: selectedServices[0], // For backward compatibility
      });
      nextStep();
    }
  };

  const formatDuration = (duration: { hours: number; minutes: number }) => {
    const totalMinutes = (duration.hours || 0) * 60 + (duration.minutes || 0);
    if (totalMinutes >= 60) {
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
    return `${totalMinutes}m`;
  };

  const filteredServices = services.filter(service => {
    const matchesSearch = service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (service.onlineBooking?.displayName?.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || service.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

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
        {t('select_service')}
      </Typography>
      
      <Typography variant="body2" color="textSecondary" paragraph>
        {bookingData.linkData?.settings.allowMultipleBookings 
          ? t('select_multiple_services')
          : t('select_one_service')}
      </Typography>

      {/* Search */}
      <TextField
        fullWidth
        placeholder={t('search_services')}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        sx={{ mb: 3 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search />
            </InputAdornment>
          ),
        }}
      />

      {/* Category Tabs */}
      {categories.length > 1 && bookingData.linkData?.settings.showServiceCategories && (
        <Box sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={selectedCategory}
            onChange={(_, value) => setSelectedCategory(value)}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab label={t('all')} value="all" />
            {categories.map(category => (
              <Tab key={category.id} label={category.name} value={category.id} />
            ))}
          </Tabs>
        </Box>
      )}

      {/* Services Grid */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {filteredServices.map((service) => (
          <Grid item xs={12} md={6} key={service.id}>
            <Card
              sx={{
                height: '100%',
                border: 2,
                borderColor: selectedServices.includes(service.id) ? 'primary.main' : 'divider',
                transition: 'all 0.3s',
                '&:hover': {
                  borderColor: 'primary.main',
                  transform: 'translateY(-2px)',
                  boxShadow: 2,
                },
              }}
            >
              <CardActionArea
                onClick={() => handleServiceToggle(service.id)}
                sx={{ height: '100%' }}
              >
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {service.onlineBooking?.displayName || service.name}
                  </Typography>
                  
                  {service.onlineBooking?.description && (
                    <Typography variant="body2" color="textSecondary" paragraph>
                      {service.onlineBooking.description}
                    </Typography>
                  )}

                  <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                    {/* Duration */}
                    {bookingData.linkData?.settings.showServiceDuration && (
                      <Chip
                        icon={<AccessTime />}
                        label={formatDuration(service.duration)}
                        size="small"
                        variant="outlined"
                      />
                    )}
                    
                    {/* Price */}
                    {bookingData.linkData?.settings.showServicePrices && (
                      <Chip
                        icon={<AttachMoney />}
                        label={`${service.startingPrice} ${t('egp')}`}
                        size="small"
                        variant="outlined"
                        color="primary"
                      />
                    )}
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>

      {filteredServices.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography color="textSecondary">
            {t('no_services_found')}
          </Typography>
        </Box>
      )}

      {/* Selected Services Summary */}
      {selectedServices.length > 0 && (
        <Box sx={{ mb: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            {t('selected_services')}: {selectedServices.length}
          </Typography>
          {selectedServices.map(id => {
            const service = services.find(s => s.id === id);
            if (!service) return null;
            const duration = (service.duration.hours || 0) * 60 + (service.duration.minutes || 0);
            return (
              <Chip
                key={id}
                label={`${service.name} (${formatDuration(service.duration)})`}
                onDelete={() => handleServiceToggle(id)}
                sx={{ m: 0.5 }}
              />
            );
          })}
        </Box>
      )}

      {/* Navigation */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button variant="outlined" onClick={previousStep}>
          {t('previous')}
        </Button>
        <Button
          variant="contained"
          onClick={handleContinue}
          disabled={selectedServices.length === 0}
        >
          {t('next')}
        </Button>
      </Box>
    </Box>
  );
};

export default ServiceSelection;