import React, { useState } from 'react';
import {
  Box,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
  Typography,
  Divider,
  Dialog,
} from '@mui/material';
import {
  Login as LoginIcon,
  Logout as LogoutIcon,
  Person as PersonIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { useLanguage } from '../contexts/LanguageContext';
import { useClientAuth } from '../contexts/ClientAuthContext';
import ClientLoginModal from './ClientLoginModal';
import ClientAppointmentsList from './ClientAppointmentsList';
import LanguageToggle from './LanguageToggle';

interface BookingHeaderProps {
  logoUrl?: string;
  businessName?: string;
}

const BookingHeader: React.FC<BookingHeaderProps> = ({ logoUrl, businessName }) => {
  const { t } = useLanguage();
  const { session, isAuthenticated, logout } = useClientAuth();
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [appointmentsOpen, setAppointmentsOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  
  const handleMenuClose = () => {
    setAnchorEl(null);
  };
  
  const handleLogout = () => {
    logout();
    handleMenuClose();
  };
  
  return (
    <>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
          px: { xs: 2, md: 0 },
        }}
      >
        {/* Logo/Business Name */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {logoUrl && (
            <img
              src={logoUrl}
              alt={businessName || 'Logo'}
              style={{ maxHeight: 50, maxWidth: 150 }}
            />
          )}
          {businessName && !logoUrl && (
            <Typography variant="h5" component="h1">
              {businessName}
            </Typography>
          )}
        </Box>
        
        {/* Right side actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LanguageToggle />
          
          {isAuthenticated && session ? (
            <>
              <IconButton onClick={handleMenuOpen} size="large">
                <Avatar sx={{ width: 32, height: 32 }}>
                  {session.name.charAt(0).toUpperCase()}
                </Avatar>
              </IconButton>
              
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
                PaperProps={{
                  sx: { width: 200 },
                }}
              >
                <Box sx={{ px: 2, py: 1 }}>
                  <Typography variant="subtitle1" fontWeight="bold">
                    {session.name}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {session.phoneNumber}
                  </Typography>
                </Box>
                
                <Divider />
                
                <MenuItem onClick={handleMenuClose}>
                  <PersonIcon sx={{ mr: 1 }} fontSize="small" />
                  {t('my_profile')}
                </MenuItem>
                
                <MenuItem onClick={() => {
                  handleMenuClose();
                  setAppointmentsOpen(true);
                }}>
                  <HistoryIcon sx={{ mr: 1 }} fontSize="small" />
                  {t('my_appointments')}
                </MenuItem>
                
                <Divider />
                
                <MenuItem onClick={handleLogout}>
                  <LogoutIcon sx={{ mr: 1 }} fontSize="small" />
                  {t('logout')}
                </MenuItem>
              </Menu>
            </>
          ) : (
            <Button
              variant="outlined"
              startIcon={<LoginIcon />}
              onClick={() => setLoginModalOpen(true)}
              size="small"
            >
              {t('login')}
            </Button>
          )}
        </Box>
      </Box>
      
      <ClientLoginModal
        open={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
      />
      
      {/* Appointments Dialog */}
      <Dialog
        open={appointmentsOpen}
        onClose={() => setAppointmentsOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <ClientAppointmentsList />
        <Box sx={{ p: 2, textAlign: 'right' }}>
          <Button onClick={() => setAppointmentsOpen(false)}>
            {t('close')}
          </Button>
        </Box>
      </Dialog>
    </>
  );
};

export default BookingHeader;