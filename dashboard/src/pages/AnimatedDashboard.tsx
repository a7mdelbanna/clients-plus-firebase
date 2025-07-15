import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useThemeMode } from '../contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';
import CountUp from 'react-countup';
import { useInView } from 'react-intersection-observer';
import { toast } from 'react-toastify';
import { setupService } from '../services/setup.service';
import {
  Box,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Grid,
  Card,
  CardContent,
  Avatar,
  Button,
  Fab,
  Tooltip,
  LinearProgress,
  CircularProgress,
} from '@mui/material';
import {
  AccountCircle,
  ExitToApp,
  People,
  Assignment,
  AttachMoney,
  TrendingUp,
  DarkMode,
  LightMode,
  Add,
  Settings,
  Analytics,
  Folder,
  CalendarMonth,
} from '@mui/icons-material';

const AnimatedDashboard: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useThemeMode();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const theme = useTheme();
  const [ref, inView] = useInView({ triggerOnce: true });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSetup = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      // Check if we're already checking or if check was done
      const checkInProgress = sessionStorage.getItem('setup-check-in-progress');
      if (checkInProgress === 'true') {
        setLoading(false);
        return;
      }

      try {
        // Mark that we're checking
        sessionStorage.setItem('setup-check-in-progress', 'true');

        // Check if setup was just completed
        const justCompleted = sessionStorage.getItem('setup-just-completed');
        if (justCompleted === 'true') {
          sessionStorage.removeItem('setup-just-completed');
          sessionStorage.removeItem('setup-check-in-progress');
          setLoading(false);
          return;
        }

        // Get company ID
        const idTokenResult = await currentUser.getIdTokenResult();
        let companyId = idTokenResult.claims.companyId as string;
        
        if (!companyId) {
          companyId = await setupService.getUserCompanyId(currentUser.uid);
        }

        if (!companyId) {
          // No company, redirect to setup
          sessionStorage.removeItem('setup-check-in-progress');
          navigate('/setup', { replace: true });
          return;
        }

        // Check if setup is completed
        const isCompleted = await setupService.checkSetupStatus(companyId);
        
        if (!isCompleted) {
          // Company exists but setup not completed
          sessionStorage.removeItem('setup-check-in-progress');
          navigate('/setup', { replace: true });
          return;
        }

        sessionStorage.removeItem('setup-check-in-progress');
        setLoading(false);
      } catch (error) {
        console.error('Error checking setup:', error);
        // On error, allow access to dashboard
        sessionStorage.removeItem('setup-check-in-progress');
        setLoading(false);
      }
    };

    checkSetup();
  }, [currentUser, navigate]);

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
        <CircularProgress size={48} />
      </Box>
    );
  }

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('تم تسجيل الخروج بنجاح', {
        position: 'top-center',
      });
      navigate('/login');
    } catch (error) {
      toast.error('فشل تسجيل الخروج', {
        position: 'top-center',
      });
    }
  };

  const stats = [
    { 
      title: 'العملاء', 
      value: 150, 
      icon: <People />, 
      color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      suffix: '',
      growth: '+12%',
    },
    { 
      title: 'المشاريع النشطة', 
      value: 23, 
      icon: <Assignment />, 
      color: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      suffix: '',
      growth: '+5%',
    },
    { 
      title: 'الإيرادات الشهرية', 
      value: 45000, 
      icon: <AttachMoney />, 
      color: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      suffix: ' ر.س',
      growth: '+18%',
    },
    { 
      title: 'نسبة النمو', 
      value: 15, 
      icon: <TrendingUp />, 
      color: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      suffix: '%',
      growth: '+3%',
    },
  ];

  const activities = [
    { title: 'عميل جديد تم إضافته', time: 'منذ 5 دقائق', icon: <People /> },
    { title: 'مشروع جديد تم إنشاؤه', time: 'منذ 15 دقيقة', icon: <Folder /> },
    { title: 'فاتورة تم دفعها', time: 'منذ ساعة', icon: <AttachMoney /> },
    { title: 'اجتماع مجدول', time: 'منذ ساعتين', icon: <CalendarMonth /> },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 100,
      },
    },
  };

  return (
    <Box sx={{ flexGrow: 1, minHeight: '100vh' }}>
      {/* Top Bar */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            p: 3,
            borderBottom: `1px solid ${theme.palette.divider}`,
            backgroundColor: theme.palette.background.paper,
          }}
        >
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            لوحة التحكم
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title={isDarkMode ? 'الوضع النهاري' : 'الوضع الليلي'}>
              <IconButton onClick={toggleTheme}>
                {isDarkMode ? <LightMode /> : <DarkMode />}
              </IconButton>
            </Tooltip>
            <IconButton onClick={handleMenu}>
              <AccountCircle />
            </IconButton>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleClose}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              <MenuItem disabled>
                <Typography variant="body2">{currentUser?.email}</Typography>
              </MenuItem>
              <MenuItem onClick={() => {
                navigate('/profile');
                handleClose();
              }}>
                <AccountCircle sx={{ mr: 1 }} />
                الملف الشخصي
              </MenuItem>
              <MenuItem onClick={() => {
                navigate('/settings');
                handleClose();
              }}>
                <Settings sx={{ mr: 1 }} />
                الإعدادات
              </MenuItem>
              <MenuItem onClick={handleLogout}>
                <ExitToApp sx={{ mr: 1 }} />
                تسجيل الخروج
              </MenuItem>
            </Menu>
          </Box>
        </Box>
      </motion.div>

      <Box sx={{ px: 2, py: 3 }}>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Welcome Section */}
          <motion.div variants={itemVariants}>
            <Paper
              sx={{
                p: 4,
                mb: 4,
                background: isDarkMode
                  ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%)'
                  : 'linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, rgba(236, 72, 153, 0.05) 100%)',
                border: '1px solid',
                borderColor: isDarkMode ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.1)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <Avatar
                      sx={{
                        width: 80,
                        height: 80,
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        fontSize: '2rem',
                      }}
                    >
                      {currentUser?.displayName?.charAt(0) || currentUser?.email?.charAt(0)}
                    </Avatar>
                  </motion.div>
                  <Box>
                    <Typography variant="h4" gutterBottom>
                      مرحباً، {currentUser?.displayName || 'المستخدم'} 👋
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      {currentUser?.email}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      آخر دخول: اليوم في 09:30 صباحاً
                    </Typography>
                  </Box>
                </Box>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<Analytics />}
                    onClick={() => toast.info('صفحة التقارير قيد التطوير')}
                  >
                    عرض التقارير
                  </Button>
                </motion.div>
              </Box>
            </Paper>
          </motion.div>

          {/* Stats Cards */}
          <Grid container spacing={3} sx={{ mb: 4 }} ref={ref}>
            {stats.map((stat, index) => (
              <Grid item xs={12} sm={6} md={3} key={index}>
                <motion.div
                  variants={itemVariants}
                  whileHover={{ y: -8 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                >
                  <Card
                    sx={{
                      height: '100%',
                      background: isDarkMode ? '#1E293B' : '#FFFFFF',
                      overflow: 'visible',
                    }}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <Box sx={{ flex: 1 }}>
                          <Typography color="text.secondary" gutterBottom variant="body2">
                            {stat.title}
                          </Typography>
                          <Typography variant="h3" component="div" sx={{ my: 2 }}>
                            {inView && (
                              <CountUp
                                end={stat.value}
                                duration={2}
                                separator=","
                                suffix={stat.suffix}
                              />
                            )}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography
                              variant="body2"
                              sx={{
                                color: 'success.main',
                                fontWeight: 600,
                              }}
                            >
                              {stat.growth}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              مقارنة بالشهر السابق
                            </Typography>
                          </Box>
                        </Box>
                        <motion.div
                          whileHover={{ rotate: 360 }}
                          transition={{ duration: 0.5 }}
                        >
                          <Avatar
                            sx={{
                              background: stat.color,
                              width: 56,
                              height: 56,
                              boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
                            }}
                          >
                            {stat.icon}
                          </Avatar>
                        </motion.div>
                      </Box>
                      <Box sx={{ mt: 2 }}>
                        <LinearProgress
                          variant="determinate"
                          value={75}
                          sx={{
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                            '& .MuiLinearProgress-bar': {
                              background: stat.color,
                              borderRadius: 3,
                            },
                          }}
                        />
                      </Box>
                    </CardContent>
                  </Card>
                </motion.div>
              </Grid>
            ))}
          </Grid>

          {/* Action Buttons and Activities */}
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <motion.div variants={itemVariants}>
                <Paper sx={{ p: 3, height: '100%' }}>
                  <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
                    الإجراءات السريعة
                  </Typography>
                  <Grid container spacing={2}>
                    {[
                      { title: 'إضافة عميل جديد', icon: <People />, color: '#8B5CF6' },
                      { title: 'إنشاء مشروع', icon: <Assignment />, color: '#EC4899' },
                      { title: 'إضافة فاتورة', icon: <AttachMoney />, color: '#10B981' },
                      { title: 'جدولة اجتماع', icon: <CalendarMonth />, color: '#F59E0B' },
                    ].map((action, index) => (
                      <Grid item xs={6} key={index}>
                        <motion.div
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <Button
                            fullWidth
                            variant="outlined"
                            startIcon={action.icon}
                            onClick={() => toast.info(`${action.title} - قريباً`)}
                            sx={{
                              py: 2,
                              borderColor: action.color,
                              color: action.color,
                              '&:hover': {
                                borderColor: action.color,
                                backgroundColor: `${action.color}10`,
                              },
                            }}
                          >
                            {action.title}
                          </Button>
                        </motion.div>
                      </Grid>
                    ))}
                  </Grid>
                </Paper>
              </motion.div>
            </Grid>

            <Grid item xs={12} md={4}>
              <motion.div variants={itemVariants}>
                <Paper sx={{ p: 3, height: '100%' }}>
                  <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
                    النشاطات الأخيرة
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <AnimatePresence>
                      {activities.map((activity, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          transition={{ delay: index * 0.1 }}
                        >
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 2,
                              p: 2,
                              borderRadius: 2,
                              backgroundColor: isDarkMode
                                ? 'rgba(255,255,255,0.05)'
                                : 'rgba(0,0,0,0.02)',
                              transition: 'all 0.3s',
                              '&:hover': {
                                backgroundColor: isDarkMode
                                  ? 'rgba(255,255,255,0.1)'
                                  : 'rgba(0,0,0,0.05)',
                              },
                            }}
                          >
                            <Avatar
                              sx={{
                                width: 40,
                                height: 40,
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                              }}
                            >
                              {activity.icon}
                            </Avatar>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="body2">{activity.title}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {activity.time}
                              </Typography>
                            </Box>
                          </Box>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </Box>
                </Paper>
              </motion.div>
            </Grid>
          </Grid>
        </motion.div>
      </Box>

      {/* Floating Action Button */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.5, type: 'spring', stiffness: 200 }}
        style={{
          position: 'fixed',
          bottom: 24,
          right: theme.direction === 'rtl' ? 'auto' : 24,
          left: theme.direction === 'rtl' ? 24 : 'auto',
          zIndex: theme.zIndex.speedDial,
        }}
      >
        <Tooltip title="إضافة جديد">
          <Fab
            color="primary"
            aria-label="add"
            onClick={() => toast.info('قائمة الإضافة - قريباً')}
            sx={{
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
              '&:hover': {
                background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.secondary.dark} 100%)`,
              },
            }}
          >
            <Add />
          </Fab>
        </Tooltip>
      </motion.div>
    </Box>
  );
};

export default AnimatedDashboard;