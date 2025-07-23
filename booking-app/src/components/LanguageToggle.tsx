import React from 'react';
import { Button, ButtonGroup } from '@mui/material';
import { useLanguage } from '../contexts/LanguageContext';

const LanguageToggle: React.FC = () => {
  const { language, setLanguage } = useLanguage();

  return (
    <ButtonGroup variant="outlined" size="small">
      <Button
        onClick={() => setLanguage('ar')}
        variant={language === 'ar' ? 'contained' : 'outlined'}
      >
        العربية
      </Button>
      <Button
        onClick={() => setLanguage('en')}
        variant={language === 'en' ? 'contained' : 'outlined'}
      >
        English
      </Button>
    </ButtonGroup>
  );
};

export default LanguageToggle;