import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AnimatedLoader from './AnimatedLoader';
import { ensureUserDocument } from '../utils/fixUserDocument';

interface PrivateRouteProps {
  children: React.ReactNode;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const { currentUser, loading } = useAuth();
  const [checkingUser, setCheckingUser] = useState(true);

  useEffect(() => {
    const checkUserDocument = async () => {
      if (currentUser && !loading) {
        await ensureUserDocument();
      }
      setCheckingUser(false);
    };
    
    checkUserDocument();
  }, [currentUser, loading]);

  if (loading || checkingUser) {
    return <AnimatedLoader text="جاري التحقق من الصلاحيات..." />;
  }

  return currentUser ? <>{children}</> : <Navigate to="/login" />;
};

export default PrivateRoute;