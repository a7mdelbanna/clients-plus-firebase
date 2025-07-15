import React, { createContext, useContext, useState, useEffect } from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { lightTheme, darkTheme } from '../theme';
import { createBusinessTheme, businessThemes, defaultTheme } from '../themes';
import { useAuth } from './AuthContext';
import { setupService } from '../services/setup.service';

interface ThemeContextType {
  isDarkMode: boolean;
  toggleTheme: () => void;
  currentTheme: typeof defaultTheme;
  setCompanyTheme: (themeId: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useThemeMode = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });
  
  const [currentTheme, setCurrentTheme] = useState(defaultTheme);
  const [loading, setLoading] = useState(true);

  // Load company theme on mount and when user changes
  useEffect(() => {
    const loadCompanyTheme = async () => {
      // First try localStorage for immediate theme application
      const savedThemeId = localStorage.getItem('companyTheme');
      if (savedThemeId) {
        const savedTheme = businessThemes.find(t => t.id === savedThemeId);
        if (savedTheme) {
          setCurrentTheme(savedTheme);
        }
      }

      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        // Get company ID from user claims
        const idTokenResult = await currentUser.getIdTokenResult();
        let companyId = idTokenResult.claims.companyId as string;

        // Fallback to get companyId from users collection
        if (!companyId) {
          const userDoc = await setupService.getUserDoc(currentUser.uid);
          if (userDoc?.companyId) {
            companyId = userDoc.companyId;
          }
        }

        if (!companyId) {
          setLoading(false);
          return;
        }

        // Get company data to load theme
        const companyData = await setupService.getCompanyData(companyId);
        
        if (companyData?.theme?.id) {
          const selectedTheme = businessThemes.find(t => t.id === companyData.theme!.id);
          if (selectedTheme) {
            setCurrentTheme(selectedTheme);
            // Also save to localStorage for faster loading next time
            localStorage.setItem('companyTheme', selectedTheme.id);
          }
        }
      } catch (error) {
        console.error('Error loading company theme:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCompanyTheme();
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const setCompanyTheme = (themeId: string) => {
    const selectedTheme = businessThemes.find(t => t.id === themeId);
    if (selectedTheme) {
      setCurrentTheme(selectedTheme);
      localStorage.setItem('companyTheme', themeId);
    }
  };

  // Create theme based on current theme config and dark mode
  const theme = createBusinessTheme(currentTheme, isDarkMode ? 'dark' : 'light');

  // Always provide the context, even while loading
  const contextValue = {
    isDarkMode,
    toggleTheme,
    currentTheme,
    setCompanyTheme
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      <MuiThemeProvider theme={theme}>
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};