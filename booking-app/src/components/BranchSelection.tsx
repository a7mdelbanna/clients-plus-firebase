import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  Grid,
  CircularProgress,
  Alert,
  Chip,
  Button,
} from '@mui/material';
import {
  LocationOn,
  Phone,
  Email,
  Schedule,
} from '@mui/icons-material';
import { useBooking } from '../contexts/BookingContext';
import { useLanguage } from '../contexts/LanguageContext';
import { bookingService } from '../services/booking.service';
import type { Branch } from '../types/booking';

const BranchSelection: React.FC = () => {
  const { bookingData, updateBookingData, nextStep } = useBooking();
  const { t, isRTL } = useLanguage();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(bookingData.branchId || null);

  useEffect(() => {
    loadBranches();
  }, []);

  const loadBranches = async () => {
    if (!bookingData.linkData) return;

    try {
      setLoading(true);
      const branchIds = bookingData.linkData.branchSettings?.allowedBranches;
      const branchList = await bookingService.getBranchesForBooking(
        bookingData.linkData.companyId,
        branchIds
      );
      
      setBranches(branchList);
      
      // If only one branch, auto-select it
      if (branchList.length === 1) {
        setSelectedBranch(branchList[0].id);
        updateBookingData({ branchId: branchList[0].id });
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Error loading branches:', err);
      setError('Failed to load branches');
      setLoading(false);
    }
  };

  const handleBranchSelect = (branchId: string) => {
    setSelectedBranch(branchId);
    updateBookingData({ branchId });
  };

  const handleContinue = () => {
    if (selectedBranch) {
      nextStep();
    }
  };

  const formatPhone = (phones: any[]) => {
    const primary = phones?.find(p => p.isPrimary) || phones?.[0];
    return primary?.number || '';
  };

  const formatHours = (branch: Branch) => {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'lowercase' });
    const hours = branch.operatingHours?.[today];
    
    if (!hours?.isOpen) {
      return t('closed');
    }
    
    return `${hours.openTime} - ${hours.closeTime}`;
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

  if (branches.length === 0) {
    return (
      <Box sx={{ py: 4 }}>
        <Alert severity="warning">{t('no_branches_available')}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        {t('select_branch')}
      </Typography>
      
      <Typography variant="body2" color="textSecondary" paragraph>
        {t('choose_branch_to_continue')}
      </Typography>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        {branches.map((branch) => (
          <Grid item xs={12} md={6} key={branch.id}>
            <Card
              sx={{
                height: '100%',
                border: 2,
                borderColor: selectedBranch === branch.id ? 'primary.main' : 'divider',
                transition: 'all 0.3s',
                '&:hover': {
                  borderColor: 'primary.main',
                  transform: 'translateY(-4px)',
                  boxShadow: 4,
                },
              }}
            >
              <CardActionArea
                onClick={() => handleBranchSelect(branch.id)}
                sx={{ height: '100%' }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6" component="h3" sx={{ flexGrow: 1 }}>
                      {branch.name}
                    </Typography>
                    {branch.type === 'main' && (
                      <Chip
                        label={t('main_branch')}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    )}
                  </Box>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {/* Address */}
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                      <LocationOn fontSize="small" color="action" />
                      <Typography variant="body2" color="textSecondary">
                        {branch.address.street}, {branch.address.city}
                      </Typography>
                    </Box>

                    {/* Phone */}
                    {branch.contact.phones?.length > 0 && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Phone fontSize="small" color="action" />
                        <Typography variant="body2" color="textSecondary">
                          {formatPhone(branch.contact.phones)}
                        </Typography>
                      </Box>
                    )}

                    {/* Email */}
                    {branch.contact.email && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Email fontSize="small" color="action" />
                        <Typography variant="body2" color="textSecondary">
                          {branch.contact.email}
                        </Typography>
                      </Box>
                    )}

                    {/* Hours */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Schedule fontSize="small" color="action" />
                      <Typography variant="body2" color="textSecondary">
                        {formatHours(branch)}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Google Maps Link */}
                  {branch.coordinates && (
                    <Box sx={{ mt: 2 }}>
                      <Button
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(
                            `https://www.google.com/maps?q=${branch.coordinates!.lat},${branch.coordinates!.lng}`,
                            '_blank'
                          );
                        }}
                      >
                        {t('view_on_map')}
                      </Button>
                    </Box>
                  )}
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          size="large"
          onClick={handleContinue}
          disabled={!selectedBranch}
        >
          {t('next')}
        </Button>
      </Box>
    </Box>
  );
};

export default BranchSelection;