import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Collapse,
  Avatar,
  Typography,
  Tooltip,
  useTheme,
  useMediaQuery,
  Divider,
  Badge,
} from '@mui/material';
import {
  Dashboard,
  People,
  Assignment,
  AttachMoney,
  CalendarMonth,
  Analytics,
  Settings,
  Support,
  Inventory,
  ExpandLess,
  ExpandMore,
  Menu as MenuIcon,
  Close,
  PersonOutline,
  BusinessCenter,
  Receipt,
  Groups,
  Notifications,
  TrendingUp,
  ExitToApp,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';

interface MenuItem {
  id: string;
  title: string;
  titleAr: string;
  icon: React.ReactNode;
  path?: string;
  badge?: number;
  subItems?: MenuItem[];
}

const menuItems: MenuItem[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    titleAr: 'لوحة التحكم',
    icon: <Dashboard />,
    path: '/dashboard',
  },
  {
    id: 'clients',
    title: 'Clients',
    titleAr: 'العملاء',
    icon: <People />,
    badge: 150,
    subItems: [
      {
        id: 'all-clients',
        title: 'All Clients',
        titleAr: 'جميع العملاء',
        icon: <Groups />,
        path: '/clients',
      },
      {
        id: 'add-client',
        title: 'Add New',
        titleAr: 'إضافة عميل',
        icon: <PersonOutline />,
        path: '/clients/new',
      },
    ],
  },
  {
    id: 'projects',
    title: 'Projects',
    titleAr: 'المشاريع',
    icon: <Assignment />,
    badge: 23,
    subItems: [
      {
        id: 'all-projects',
        title: 'All Projects',
        titleAr: 'جميع المشاريع',
        icon: <BusinessCenter />,
        path: '/projects',
      },
      {
        id: 'add-project',
        title: 'New Project',
        titleAr: 'مشروع جديد',
        icon: <Assignment />,
        path: '/projects/new',
      },
    ],
  },
  {
    id: 'invoices',
    title: 'Invoices',
    titleAr: 'الفواتير',
    icon: <AttachMoney />,
    subItems: [
      {
        id: 'all-invoices',
        title: 'All Invoices',
        titleAr: 'جميع الفواتير',
        icon: <Receipt />,
        path: '/invoices',
      },
      {
        id: 'create-invoice',
        title: 'Create Invoice',
        titleAr: 'إنشاء فاتورة',
        icon: <AttachMoney />,
        path: '/invoices/new',
      },
    ],
  },
  {
    id: 'calendar',
    title: 'Calendar',
    titleAr: 'التقويم',
    icon: <CalendarMonth />,
    path: '/calendar',
  },
  {
    id: 'reports',
    title: 'Reports',
    titleAr: 'التقارير',
    icon: <Analytics />,
    subItems: [
      {
        id: 'financial',
        title: 'Financial',
        titleAr: 'المالية',
        icon: <TrendingUp />,
        path: '/reports/financial',
      },
      {
        id: 'performance',
        title: 'Performance',
        titleAr: 'الأداء',
        icon: <Analytics />,
        path: '/reports/performance',
      },
    ],
  },
  {
    id: 'inventory',
    title: 'Inventory',
    titleAr: 'المخزون',
    icon: <Inventory />,
    path: '/inventory',
  },
];

const bottomMenuItems: MenuItem[] = [
  {
    id: 'settings',
    title: 'Settings',
    titleAr: 'الإعدادات',
    icon: <Settings />,
    path: '/settings',
  },
  {
    id: 'support',
    title: 'Support',
    titleAr: 'الدعم',
    icon: <Support />,
    path: '/support',
  },
];

interface AnimatedSidebarProps {
  open: boolean;
  onClose: () => void;
  onOpen: () => void;
}

const AnimatedSidebar: React.FC<AnimatedSidebarProps> = ({ open, onClose, onOpen }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, logout } = useAuth();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isRTL = theme.direction === 'rtl';
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const drawerWidth = open ? 240 : 70;

  const handleToggleExpand = (itemId: string) => {
    setExpandedItems((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleNavigate = (path?: string) => {
    if (path) {
      navigate(path);
      if (isMobile) {
        onClose();
      }
    }
  };

  const isActive = (path?: string) => {
    if (!path) return false;
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const sidebarVariants = {
    open: {
      width: 240,
      transition: {
        duration: 0.3,
        ease: 'easeInOut',
      },
    },
    closed: {
      width: 70,
      transition: {
        duration: 0.3,
        ease: 'easeInOut',
      },
    },
  };

  const listItemVariants = {
    hover: {
      x: isRTL ? -5 : 5,
      backgroundColor: theme.palette.action.hover,
      transition: {
        duration: 0.2,
      },
    },
  };

  const renderMenuItem = (item: MenuItem, depth = 0) => {
    const hasSubItems = item.subItems && item.subItems.length > 0;
    const isExpanded = expandedItems.includes(item.id);
    const isItemActive = isActive(item.path);
    const isHovered = hoveredItem === item.id;

    return (
      <React.Fragment key={item.id}>
        <motion.div
          variants={listItemVariants}
          whileHover="hover"
          onHoverStart={() => setHoveredItem(item.id)}
          onHoverEnd={() => setHoveredItem(null)}
        >
          <ListItem
            onClick={() => {
              if (hasSubItems) {
                handleToggleExpand(item.id);
              } else {
                handleNavigate(item.path);
              }
            }}
            sx={{
              pl: depth > 0 ? 3 : 1.5,
              pr: 1.5,
              py: 1,
              cursor: 'pointer',
              borderRadius: 1.5,
              mx: 0.5,
              mb: 0.25,
              position: 'relative',
              backgroundColor: isItemActive
                ? theme.palette.action.selected
                : 'transparent',
              '&::before': {
                content: '""',
                position: 'absolute',
                left: isRTL ? 'auto' : 0,
                right: isRTL ? 0 : 'auto',
                top: '50%',
                transform: 'translateY(-50%)',
                width: 4,
                height: isItemActive ? '70%' : 0,
                backgroundColor: theme.palette.primary.main,
                borderRadius: '0 4px 4px 0',
                transition: 'height 0.3s ease',
              },
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: 36,
                color: isItemActive
                  ? theme.palette.primary.main
                  : theme.palette.text.secondary,
              }}
            >
              {item.badge ? (
                <Badge
                  badgeContent={open ? item.badge : null}
                  color="primary"
                  max={99}
                >
                  {item.icon}
                </Badge>
              ) : (
                item.icon
              )}
            </ListItemIcon>
            <AnimatePresence>
              {open && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  style={{ display: 'flex', alignItems: 'center', flex: 1 }}
                >
                  <ListItemText
                    primary={isRTL ? item.titleAr : item.title}
                    primaryTypographyProps={{
                      fontSize: '0.95rem',
                      fontWeight: isItemActive ? 600 : 400,
                    }}
                  />
                  {hasSubItems && (
                    <motion.div
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ExpandMore />
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            {!open && item.badge && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: theme.palette.error.main,
                }}
              />
            )}
          </ListItem>
        </motion.div>

        {hasSubItems && (
          <Collapse in={isExpanded && open} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {item.subItems!.map((subItem) => renderMenuItem(subItem, depth + 1))}
            </List>
          </Collapse>
        )}
      </React.Fragment>
    );
  };

  return (
    <>
      {/* Mobile Toggle Button */}
      {isMobile && !open && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            position: 'fixed',
            top: 20,
            [isRTL ? 'right' : 'left']: 20,
            zIndex: theme.zIndex.drawer + 2,
          }}
        >
          <IconButton
            onClick={onOpen}
            sx={{
              backgroundColor: theme.palette.primary.main,
              color: 'white',
              '&:hover': {
                backgroundColor: theme.palette.primary.dark,
              },
            }}
          >
            <MenuIcon />
          </IconButton>
        </motion.div>
      )}

      <Drawer
        variant={isMobile ? 'temporary' : 'permanent'}
        open={isMobile ? open : true}
        onClose={onClose}
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            borderRight: isRTL ? 'none' : `1px solid ${theme.palette.divider}`,
            borderLeft: isRTL ? `1px solid ${theme.palette.divider}` : 'none',
            background: theme.palette.background.paper,
            transition: theme.transitions.create('width', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
          },
        }}
      >
        <motion.div
          animate={open ? 'open' : 'closed'}
          variants={sidebarVariants}
          style={{ 
            height: '100vh', 
            display: 'flex', 
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {/* Header */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: open ? 'space-between' : 'center',
              p: 1.5,
              minHeight: 64,
            }}
          >
            <AnimatePresence>
              {open && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 12 }}
                >
                  <Avatar
                    sx={{
                      width: 40,
                      height: 40,
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    }}
                  >
                    C+
                  </Avatar>
                  <Box>
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>
                      Clients+
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                      {currentUser?.email}
                    </Typography>
                  </Box>
                </motion.div>
              )}
            </AnimatePresence>
            {!isMobile && (
              <IconButton onClick={open ? onClose : onOpen} size="small">
                {open ? <Close /> : <MenuIcon />}
              </IconButton>
            )}
          </Box>

          <Divider />

          {/* Main Menu */}
          <Box sx={{ 
            flex: 1, 
            overflowY: 'auto', 
            overflowX: 'hidden', 
            py: 1,
            '&::-webkit-scrollbar': {
              width: '6px',
            },
            '&::-webkit-scrollbar-track': {
              background: 'transparent',
            },
            '&::-webkit-scrollbar-thumb': {
              background: theme.palette.divider,
              borderRadius: '3px',
            },
            '&::-webkit-scrollbar-thumb:hover': {
              background: theme.palette.action.hover,
            },
          }}>
            <List>
              {menuItems.map((item) => renderMenuItem(item))}
            </List>
          </Box>

          <Divider />

          {/* Bottom Menu */}
          <Box sx={{ py: 0.5, flexShrink: 0 }}>
            <List sx={{ py: 0 }}>
              {bottomMenuItems.map((item) => renderMenuItem(item))}
            </List>
          </Box>

          {/* User Section */}
          <Box
            sx={{
              p: 1.5,
              borderTop: `1px solid ${theme.palette.divider}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: open ? 'space-between' : 'center',
              flexShrink: 0,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Avatar
                sx={{
                  width: open ? 36 : 32,
                  height: open ? 36 : 32,
                  backgroundColor: theme.palette.primary.main,
                  fontSize: open ? '1rem' : '0.875rem',
                }}
              >
                {currentUser?.displayName?.charAt(0) || currentUser?.email?.charAt(0)}
              </Avatar>
              <AnimatePresence>
                {open && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {currentUser?.displayName || 'المستخدم'}
                    </Typography>
                  </motion.div>
                )}
              </AnimatePresence>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {open && (
                <Tooltip title="الإشعارات">
                  <IconButton size="small">
                    <Badge badgeContent={3} color="error">
                      <Notifications fontSize="small" />
                    </Badge>
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title={isRTL ? 'تسجيل الخروج' : 'Logout'}>
                <IconButton 
                  size="small"
                  onClick={async () => {
                    try {
                      await logout();
                      toast.success(isRTL ? 'تم تسجيل الخروج بنجاح' : 'Logged out successfully');
                      navigate('/login');
                    } catch (error) {
                      toast.error(isRTL ? 'فشل تسجيل الخروج' : 'Logout failed');
                    }
                  }}
                  sx={{
                    color: theme.palette.text.secondary,
                    '&:hover': {
                      color: theme.palette.error.main,
                    },
                  }}
                >
                  <ExitToApp fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </motion.div>
      </Drawer>
    </>
  );
};

export default AnimatedSidebar;