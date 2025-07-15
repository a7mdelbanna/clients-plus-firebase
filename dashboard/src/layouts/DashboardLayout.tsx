import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Box, useTheme, useMediaQuery } from '@mui/material';
import AnimatedSidebar from '../components/AnimatedSidebar';

const DashboardLayout: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);

  const handleSidebarClose = () => {
    setSidebarOpen(false);
  };

  const handleSidebarOpen = () => {
    setSidebarOpen(true);
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AnimatedSidebar
        open={sidebarOpen}
        onClose={handleSidebarClose}
        onOpen={handleSidebarOpen}
      />
      
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          backgroundColor: theme.palette.background.default,
          minHeight: '100vh',
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
};

export default DashboardLayout;