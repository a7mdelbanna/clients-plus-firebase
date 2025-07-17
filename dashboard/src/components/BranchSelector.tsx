import React, { useState } from 'react';
import {
  Box,
  Button,
  Menu,
  MenuItem,
  Typography,
  Chip,
  CircularProgress,
  Divider,
  ListItemIcon,
  ListItemText,
  useTheme,
  alpha,
} from '@mui/material';
import {
  KeyboardArrowDown,
  Store,
  LocationOn,
  Phone,
  CheckCircle,
  Add,
} from '@mui/icons-material';
import { useBranch } from '../contexts/BranchContext';

const BranchSelector: React.FC = () => {
  const theme = useTheme();
  const isRTL = theme.direction === 'rtl';
  const { branches, currentBranch, switchBranch, loading } = useBranch();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleBranchSelect = (branchId: string) => {
    switchBranch(branchId);
    handleClose();
  };

  // Don't show selector if only one branch or still loading
  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CircularProgress size={20} />
      </Box>
    );
  }

  // Always show the branch selector if we have at least one branch
  // This helps users understand which branch they're viewing
  if (!currentBranch || branches.length === 0) {
    return null;
  }

  return (
    <>
      <Button
        onClick={handleClick}
        startIcon={<Store />}
        endIcon={<KeyboardArrowDown />}
        sx={{
          color: theme.palette.text.primary,
          backgroundColor: alpha(theme.palette.primary.main, 0.08),
          '&:hover': {
            backgroundColor: alpha(theme.palette.primary.main, 0.12),
          },
          textTransform: 'none',
          borderRadius: 2,
          px: 2,
          py: 1,
          minHeight: 40,
        }}
      >
        <Box sx={{ textAlign: isRTL ? 'right' : 'left' }}>
          <Typography variant="body2" component="span" sx={{ fontWeight: 600 }}>
            {currentBranch.businessName ? `${currentBranch.businessName} - ${currentBranch.name}` : currentBranch.name}
          </Typography>
          {currentBranch.isMain && (
            <Chip
              label={isRTL ? 'الفرع الرئيسي' : 'Main Branch'}
              size="small"
              sx={{
                height: 16,
                fontSize: '0.7rem',
                backgroundColor: theme.palette.primary.main,
                color: 'white',
                mt: 0.5,
              }}
            />
          )}
        </Box>
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        PaperProps={{
          sx: {
            mt: 1,
            minWidth: 300,
            maxWidth: 400,
            boxShadow: theme.shadows[8],
            border: `1px solid ${theme.palette.divider}`,
          },
        }}
        transformOrigin={{ horizontal: isRTL ? 'right' : 'left', vertical: 'top' }}
        anchorOrigin={{ horizontal: isRTL ? 'right' : 'left', vertical: 'bottom' }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="subtitle2" color="text.secondary">
            {isRTL ? 'اختر الفرع' : 'Select Branch'}
          </Typography>
        </Box>
        
        <Divider />
        
        {branches.map((branch) => (
          <MenuItem
            key={branch.id}
            onClick={() => handleBranchSelect(branch.id)}
            selected={branch.id === currentBranch.id}
            sx={{
              py: 2,
              '&.Mui-selected': {
                backgroundColor: alpha(theme.palette.primary.main, 0.08),
                '&:hover': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.12),
                },
              },
            }}
          >
            <ListItemIcon>
              {branch.id === currentBranch.id ? (
                <CheckCircle color="primary" />
              ) : (
                <Store />
              )}
            </ListItemIcon>
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {branch.businessName ? `${branch.businessName} - ${branch.name}` : branch.name}
                  </Typography>
                  {branch.isMain && (
                    <Chip
                      label={isRTL ? 'رئيسي' : 'Main'}
                      size="small"
                      color="primary"
                      sx={{ height: 20, fontSize: '0.75rem' }}
                    />
                  )}
                </Box>
              }
              secondary={
                <Box sx={{ mt: 0.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                    <LocationOn sx={{ fontSize: 14, color: 'text.secondary' }} />
                    <Typography variant="caption" color="text.secondary">
                      {branch.address}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Phone sx={{ fontSize: 14, color: 'text.secondary' }} />
                    <Typography variant="caption" color="text.secondary">
                      {branch.phone}
                    </Typography>
                  </Box>
                </Box>
              }
              secondaryTypographyProps={{ component: 'div' }}
              sx={{ my: 0 }}
            />
          </MenuItem>
        ))}
        
        <Divider />
        
        <MenuItem
          onClick={handleClose}
          disabled={branches.length >= 2} // Trial limitation: max 2 branches
          sx={{
            py: 1.5,
            color: branches.length >= 2 ? 'text.disabled' : 'primary.main',
            '&:hover': {
              backgroundColor: branches.length >= 2 ? 'transparent' : alpha(theme.palette.primary.main, 0.08),
            },
          }}
        >
          <ListItemIcon>
            <Add sx={{ color: branches.length >= 2 ? 'text.disabled' : 'primary.main' }} />
          </ListItemIcon>
          <ListItemText
            primary={
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {isRTL ? 'إضافة فرع جديد' : 'Add New Branch'}
              </Typography>
            }
            secondary={
              branches.length >= 2 ? (
                <Typography variant="caption" color="text.secondary">
                  {isRTL ? 'الحد الأقصى للفترة التجريبية: 2 فروع' : 'Trial limit: 2 branches'}
                </Typography>
              ) : null
            }
          />
        </MenuItem>
      </Menu>
    </>
  );
};

export default BranchSelector;