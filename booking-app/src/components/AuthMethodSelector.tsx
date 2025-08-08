import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useFirebaseAuth } from '../contexts/FirebaseAuthContext';
import ClientEmailLogin from './ClientEmailLogin';

interface AuthMethodSelectorProps {
  open: boolean;
  onClose: () => void;
  companyId: string;
}

const AuthMethodSelector: React.FC<AuthMethodSelectorProps> = ({ open, onClose, companyId }) => {
  const { t } = useLanguage();
  const { authSettings } = useFirebaseAuth();
  const [showEmailAuth, setShowEmailAuth] = useState(false);
  
  // Auto-open email login when dialog opens (simplified approach)
  React.useEffect(() => {
    if (open) {
      setShowEmailAuth(true);
    }
  }, [open]);
  
  const handleClose = () => {
    setShowEmailAuth(false);
    onClose();
  };
  
  
  // Show email login directly (simplified approach)
  if (showEmailAuth) {
    return (
      <ClientEmailLogin
        open={open}
        onClose={handleClose}
        companyId={companyId}
      />
    );
  }
  
  // Fallback - should not reach here as we auto-open email login
  return null;
};

export default AuthMethodSelector;