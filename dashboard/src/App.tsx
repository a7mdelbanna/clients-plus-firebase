import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { CssBaseline } from '@mui/material';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Login from './components/Login';
import Signup from './components/Signup';
import ForgotPassword from './components/ForgotPassword';
import Dashboard from './pages/Dashboard';
import LandingPage from './pages/LandingPage';
import SetupWizardPage from './pages/SetupWizardPage';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import SetupWizard from './components/SetupWizard/SetupWizard';
import PrivateRoute from './components/PrivateRoute';
import AnimatedBackground from './components/AnimatedBackground';
import DashboardLayout from './layouts/DashboardLayout';
import PageTransition from './components/PageTransition';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './styles/toastify-rtl.css';

// RTL support
import rtlPlugin from 'stylis-plugin-rtl';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { prefixer } from 'stylis';

// Create rtl cache
const cacheRtl = createCache({
  key: 'muirtl',
  stylisPlugins: [prefixer, rtlPlugin],
});

function App() {
  return (
    <CacheProvider value={cacheRtl}>
      <Router>
        <AuthProvider>
          <ThemeProvider>
            <CssBaseline />
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/login" element={
                <PageTransition>
                  <Login />
                </PageTransition>
              } />
              <Route path="/signup" element={
                <PageTransition>
                  <Signup />
                </PageTransition>
              } />
              <Route path="/forgot-password" element={
                <PageTransition>
                  <ForgotPassword />
                </PageTransition>
              } />
              <Route
                element={
                  <PrivateRoute>
                    <DashboardLayout />
                  </PrivateRoute>
                }
              >
                <Route path="/dashboard" element={
                  <PageTransition>
                    <Dashboard />
                  </PageTransition>
                } />
                <Route path="/clients" element={
                  <PageTransition>
                    <div>Clients Page - Coming Soon</div>
                  </PageTransition>
                } />
                <Route path="/projects" element={
                  <PageTransition>
                    <div>Projects Page - Coming Soon</div>
                  </PageTransition>
                } />
                <Route path="/settings" element={
                  <PageTransition>
                    <Settings />
                  </PageTransition>
                } />
                <Route path="/profile" element={
                  <PageTransition>
                    <Profile />
                  </PageTransition>
                } />
              </Route>
              <Route path="/landing" element={
                <PageTransition>
                  <LandingPage />
                </PageTransition>
              } />
              <Route path="/setup" element={
                <PrivateRoute>
                  <PageTransition>
                    <SetupWizard />
                  </PageTransition>
                </PrivateRoute>
              } />
            </Routes>
            <ToastContainer
              position="top-center"
              autoClose={5000}
              hideProgressBar={false}
              newestOnTop
              closeOnClick
              rtl
              pauseOnFocusLoss
              draggable
              pauseOnHover
              theme="colored"
              style={{
                fontFamily: 'Tajawal, sans-serif',
              }}
            />
          </ThemeProvider>
        </AuthProvider>
      </Router>
    </CacheProvider>
  );
}

export default App;