import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Typography,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  IconButton,
  Chip,
  InputAdornment,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Search,
  Add,
  Remove,
  ShoppingCart,
  Category,
} from '@mui/icons-material';
import { serviceService } from '../../services/service.service';
import type { Service, ServiceCategory } from '../../services/service.service';
import type { Appointment } from '../../services/appointment.service';

interface ServiceSelectionProps {
  appointment: Appointment | null;
  companyId: string;
  staffId?: string;
  onServicesChange?: (services: Service[]) => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
};

const ServiceSelection: React.FC<ServiceSelectionProps> = ({
  appointment,
  companyId,
  staffId,
  onServicesChange,
}) => {
  const theme = useTheme();
  const isRTL = theme.direction === 'rtl';

  const [tabValue, setTabValue] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [companyId]);

  useEffect(() => {
    if (appointment?.services) {
      // Load selected services from appointment
      loadAppointmentServices();
    }
  }, [appointment]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [servicesData, categoriesData] = await Promise.all([
        serviceService.getServices(companyId),
        serviceService.getCategories(companyId),
      ]);
      setServices(servicesData);
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error loading services:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAppointmentServices = async () => {
    if (!appointment?.services) return;
    
    try {
      const serviceIds = appointment.services.map(s => s.serviceId);
      const loadedServices = await Promise.all(
        serviceIds.map(id => serviceService.getService(id))
      );
      setSelectedServices(loadedServices.filter(s => s !== null) as Service[]);
    } catch (error) {
      console.error('Error loading appointment services:', error);
    }
  };

  const handleServiceToggle = (service: Service) => {
    const isSelected = selectedServices.some(s => s.id === service.id);
    
    if (isSelected) {
      const newServices = selectedServices.filter(s => s.id !== service.id);
      setSelectedServices(newServices);
      onServicesChange?.(newServices);
    } else {
      const newServices = [...selectedServices, service];
      setSelectedServices(newServices);
      onServicesChange?.(newServices);
    }
  };

  const filteredServices = services.filter(service => {
    const matchesSearch = service.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || service.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const calculateTotals = () => {
    const totalDuration = selectedServices.reduce((sum, service) => {
      const durationInMinutes = service.duration 
        ? (service.duration.hours || 0) * 60 + (service.duration.minutes || 0)
        : 0;
      return sum + durationInMinutes;
    }, 0);

    const totalPrice = selectedServices.reduce((sum, service) => 
      sum + (service.startingPrice || 0), 0
    );

    return { totalDuration, totalPrice };
  };

  const { totalDuration, totalPrice } = calculateTotals();

  return (
    <Box>
      {/* Search Bar */}
      <TextField
        fullWidth
        placeholder={isRTL ? 'البحث عن الخدمات...' : 'Search by services'}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search />
            </InputAdornment>
          ),
        }}
        sx={{ mb: 2 }}
      />

      {/* Info Text */}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        {isRTL 
          ? 'سيتم عرض المزيد من الخدمات هنا كلما حصل الموظف على المزيد من المواعيد'
          : 'More services will be displayed here as employee gets more appointments'}
      </Typography>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab 
            icon={<Category />} 
            label={isRTL ? 'الخدمات' : 'Services'} 
            iconPosition="start"
          />
          <Tab 
            icon={<ShoppingCart />} 
            label={isRTL ? 'المنتجات' : 'Products'} 
            iconPosition="start"
          />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        {/* Category Filter */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <Button
            variant="text"
            size="small"
            onClick={() => setSelectedCategory('')}
            sx={{ 
              color: !selectedCategory ? theme.palette.primary.main : theme.palette.text.secondary,
              fontWeight: !selectedCategory ? 600 : 400,
            }}
          >
            {isRTL ? 'جميع الخدمات' : 'All services'}
          </Button>
          
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>{isRTL ? 'فئة الخدمة' : 'Service Category'}</InputLabel>
            <Select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              label={isRTL ? 'فئة الخدمة' : 'Service Category'}
            >
              <MenuItem value="">
                <em>{isRTL ? 'جميع الفئات' : 'All Categories'}</em>
              </MenuItem>
              {categories.map((category) => (
                <MenuItem key={category.id} value={category.id}>
                  {category.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Services List */}
        <List sx={{ bgcolor: theme.palette.background.paper, borderRadius: 1 }}>
          {filteredServices.map((service) => {
            const isSelected = selectedServices.some(s => s.id === service.id);
            const durationInMinutes = service.duration 
              ? (service.duration.hours || 0) * 60 + (service.duration.minutes || 0)
              : 0;

            return (
              <ListItem
                key={service.id}
                disablePadding
                sx={{ mb: 1 }}
                secondaryAction={
                  <IconButton
                    edge="end"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleServiceToggle(service);
                    }}
                    color={isSelected ? 'primary' : 'default'}
                  >
                    {isSelected ? <Remove /> : <Add />}
                  </IconButton>
                }
              >
                <ListItemButton
                  onClick={() => handleServiceToggle(service)}
                  sx={{
                    borderRadius: 1,
                    backgroundColor: isSelected 
                      ? alpha(theme.palette.primary.main, 0.1)
                      : 'transparent',
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.primary.main, 0.05),
                    },
                  }}
                >
                  <ListItemText
                    primary={service.name}
                    secondary={
                      <>
                        <Chip 
                          label={`${durationInMinutes} ${isRTL ? 'دقيقة' : 'min'}`}
                          size="small"
                          variant="outlined"
                          component="span"
                          sx={{ mr: 1 }}
                        />
                        <Chip 
                          label={`${service.startingPrice} ${isRTL ? 'ج.م' : 'EGP'}`}
                          size="small"
                          variant="outlined"
                          color="primary"
                          component="span"
                        />
                      </>
                    }
                    secondaryTypographyProps={{
                      component: 'div',
                      sx: { display: 'flex', gap: 1, mt: 0.5 }
                    }}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>

        {/* Totals */}
        {selectedServices.length > 0 && (
          <Box
            sx={{
              mt: 2,
              p: 2,
              backgroundColor: theme.palette.background.default,
              borderRadius: 1,
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Typography variant="subtitle2" gutterBottom>
              {isRTL ? 'الملخص' : 'Summary'}
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {isRTL ? 'الخدمات المحددة:' : 'Selected services:'}
              </Typography>
              <Typography variant="body2">
                {selectedServices.length}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {isRTL ? 'إجمالي المدة:' : 'Total duration:'}
              </Typography>
              <Typography variant="body2">
                {totalDuration} {isRTL ? 'دقيقة' : 'minutes'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">
                {isRTL ? 'إجمالي السعر:' : 'Total price:'}
              </Typography>
              <Typography variant="body2" fontWeight={600}>
                {totalPrice} {isRTL ? 'ج.م' : 'EGP'}
              </Typography>
            </Box>
          </Box>
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
          {isRTL ? 'المنتجات قيد التطوير' : 'Products coming soon'}
        </Typography>
      </TabPanel>
    </Box>
  );
};

export default ServiceSelection;