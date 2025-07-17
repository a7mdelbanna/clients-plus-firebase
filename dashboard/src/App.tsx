import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { CssBaseline } from '@mui/material';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Login from './components/Login';
import Signup from './components/Signup';
import ForgotPassword from './components/ForgotPassword';
import Dashboard from './pages/Dashboard';
import LandingPage from './pages/LandingPage';
import Settings from './pages/Settings';
import SettingsMain from './pages/settings/SettingsMain';
import ServicesPage from './pages/settings/services/ServicesPage';
import ServiceNewPage from './pages/settings/services/ServiceNewPage';
import ServiceCategoryPage from './pages/settings/services/ServiceCategoryPage';
import ServiceEditPage from './pages/settings/services/ServiceEditPage';
import PositionsPage from './pages/settings/positions/PositionsPage';
import PositionFormPage from './pages/settings/positions/PositionFormPage';
import StaffPage from './pages/settings/staff/StaffPage';
import StaffFormPage from './pages/settings/staff/StaffFormPage';
import EmployeeDetailPage from './pages/employee/EmployeeDetailPage';
import ResourcesPage from './pages/settings/resources/ResourcesPage';
import WorkSchedulePage from './pages/settings/work-schedule/WorkSchedulePage';
import CategoriesPage from './pages/settings/categories/CategoriesPage';
import ClientCategoriesPage from './pages/settings/categories/ClientCategoriesPage';
import AppointmentCategoriesPage from './pages/settings/categories/AppointmentCategoriesPage';
import EventCategoriesPage from './pages/settings/categories/EventCategoriesPage';
import Profile from './pages/Profile';
import Clients from './pages/Clients';
import SetupWizard from './components/SetupWizard/SetupWizard';
import PrivateRoute from './components/PrivateRoute';
import DashboardLayout from './layouts/DashboardLayout';
import PageTransition from './components/PageTransition';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './styles/toastify-rtl.css';
import { initializeUserOnAuth } from './utils/initializeUser';
import { checkAndMigrateUserClaims } from './utils/migrateUserClaims';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './config/firebase';

// Initialize user document creation on auth state change
initializeUserOnAuth();

// Check and migrate claims for existing users
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // Wait a moment for auth to stabilize
    setTimeout(async () => {
      const migrated = await checkAndMigrateUserClaims();
      if (migrated) {
        console.log('User claims migrated successfully');
      }
    }, 1000);
  }
});

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
                    <Clients />
                  </PageTransition>
                } />
                <Route path="/projects" element={
                  <PageTransition>
                    <div>Projects Page - Coming Soon</div>
                  </PageTransition>
                } />
                <Route path="/settings" element={
                  <PageTransition>
                    <SettingsMain />
                  </PageTransition>
                } />
                <Route path="/settings/company" element={
                  <PageTransition>
                    <Settings />
                  </PageTransition>
                } />
                <Route path="/settings/services" element={
                  <PageTransition>
                    <ServicesPage />
                  </PageTransition>
                } />
                <Route path="/settings/services/new" element={
                  <PageTransition>
                    <ServiceNewPage />
                  </PageTransition>
                } />
                <Route path="/settings/services/category/:categoryId" element={
                  <PageTransition>
                    <ServiceCategoryPage />
                  </PageTransition>
                } />
                <Route path="/settings/services/edit/:serviceId" element={
                  <PageTransition>
                    <ServiceEditPage />
                  </PageTransition>
                } />
                <Route path="/settings/positions" element={
                  <PageTransition>
                    <PositionsPage />
                  </PageTransition>
                } />
                <Route path="/settings/positions/new" element={
                  <PageTransition>
                    <PositionFormPage />
                  </PageTransition>
                } />
                <Route path="/settings/positions/edit/:positionId" element={
                  <PageTransition>
                    <PositionFormPage />
                  </PageTransition>
                } />
                <Route path="/settings/staff" element={
                  <PageTransition>
                    <StaffPage />
                  </PageTransition>
                } />
                <Route path="/settings/staff/new" element={
                  <PageTransition>
                    <StaffFormPage />
                  </PageTransition>
                } />
                <Route path="/settings/staff/edit/:staffId" element={
                  <PageTransition>
                    <StaffFormPage />
                  </PageTransition>
                } />
                <Route path="/employee/:employeeId" element={
                  <PageTransition>
                    <EmployeeDetailPage />
                  </PageTransition>
                } />
                <Route path="/settings/resources" element={
                  <PageTransition>
                    <ResourcesPage />
                  </PageTransition>
                } />
                <Route path="/settings/work-schedule" element={
                  <PageTransition>
                    <WorkSchedulePage />
                  </PageTransition>
                } />
                <Route path="/settings/categories" element={
                  <PageTransition>
                    <CategoriesPage />
                  </PageTransition>
                } />
                <Route path="/settings/categories/clients" element={
                  <PageTransition>
                    <ClientCategoriesPage />
                  </PageTransition>
                } />
                <Route path="/settings/categories/appointments" element={
                  <PageTransition>
                    <AppointmentCategoriesPage />
                  </PageTransition>
                } />
                <Route path="/settings/categories/events" element={
                  <PageTransition>
                    <EventCategoriesPage />
                  </PageTransition>
                } />
                <Route path="/employee/:employeeId/schedule" element={
                  <PageTransition>
                    <EmployeeDetailPage />
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