import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { setupService } from '../services/setup.service';
import AnimatedLoader from './AnimatedLoader';
import { Box } from '@mui/material';

interface SetupGuardProps {
  children: React.ReactNode;
}

const SetupGuard: React.FC<SetupGuardProps> = ({ children }) => {
  const { currentUser } = useAuth();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [setupCompleted, setSetupCompleted] = useState<boolean | null>(null);

  useEffect(() => {
    const checkSetup = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        // Check if we just completed setup
        const justCompletedSetup = sessionStorage.getItem('setup-just-completed') === 'true';
        if (justCompletedSetup && location.pathname === '/dashboard') {
          // Clear the flag and trust that setup is complete
          sessionStorage.removeItem('setup-just-completed');
          setSetupCompleted(true);
          setLoading(false);
          return;
        }

        // Get company ID from user claims
        const idTokenResult = await currentUser.getIdTokenResult();
        const companyId = idTokenResult.claims.companyId as string;

        if (!companyId) {
          // Try to get from user document
          const userDoc = await setupService.getUserCompanyId(currentUser.uid);
          if (!userDoc) {
            setSetupCompleted(false);
            setLoading(false);
            return;
          }
        }

        // Check if setup is completed - force fresh read
        const isCompleted = await setupService.checkSetupStatus(companyId || await setupService.getUserCompanyId(currentUser.uid));
        setSetupCompleted(isCompleted);
      } catch (error) {
        console.error('Error checking setup status:', error);
        setSetupCompleted(true); // Default to completed on error
      } finally {
        setLoading(false);
      }
    };

    checkSetup();
  }, [currentUser, location.pathname]);

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <AnimatedLoader />
      </Box>
    );
  }

  // If on setup page and setup is completed, redirect to dashboard
  if (location.pathname === '/setup' && setupCompleted) {
    return <Navigate to="/dashboard" replace />;
  }

  // If not on setup page and setup is not completed, redirect to setup
  if (location.pathname !== '/setup' && setupCompleted === false) {
    return <Navigate to="/setup" replace />;
  }

  return <>{children}</>;
};

export default SetupGuard;