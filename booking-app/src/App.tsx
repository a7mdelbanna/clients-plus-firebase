import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { SnackbarProvider } from 'notistack';
import { createTheme } from '@mui/material/styles';
import arSA from 'date-fns/locale/ar-SA';
import enUS from 'date-fns/locale/en-US';

// Pages
import BookingPage from './pages/BookingPage';
import NotFoundPage from './pages/NotFoundPage';

// Contexts
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { BookingProvider } from './contexts/BookingContext';

const App: React.FC = () => {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
};

const AppContent: React.FC = () => {
  const { isRTL, language } = useLanguage();

  const theme = React.useMemo(
    () =>
      createTheme({
        direction: isRTL ? 'rtl' : 'ltr',
        typography: {
          fontFamily: language === 'ar' ? 'Tajawal, Arial, sans-serif' : 'Roboto, Arial, sans-serif',
        },
        palette: {
          primary: {
            main: '#FF6B00',
          },
          secondary: {
            main: '#1976d2',
          },
        },
      }),
    [isRTL, language]
  );

  const dateLocale = language === 'ar' ? arSA : enUS;

  React.useEffect(() => {
    document.dir = isRTL ? 'rtl' : 'ltr';
  }, [isRTL]);

  return (
    <ThemeProvider theme={theme}>
      <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={dateLocale}>
        <SnackbarProvider maxSnack={3} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
          <CssBaseline />
          <BookingProvider>
            <Router>
              <Routes>
                <Route path="/book/:companySlug/:linkSlug" element={<BookingPage />} />
                <Route path="/" element={<Navigate to="/404" replace />} />
                <Route path="/404" element={<NotFoundPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Router>
          </BookingProvider>
        </SnackbarProvider>
      </LocalizationProvider>
    </ThemeProvider>
  );
};

export default App;