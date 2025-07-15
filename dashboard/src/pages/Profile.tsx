import React, { useState, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  TextField,
  Button,
  Avatar,
  Card,
  CardContent,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  Badge,
  Tooltip,
} from '@mui/material';
import {
  PhotoCamera,
  Email,
  Phone,
  LocationOn,
  CalendarMonth,
  Edit,
  Save,
  Cancel,
  Security,
  Notifications,
  Language,
  Verified,
  Close,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import { auth, storage } from '../config/firebase';
import { updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

interface ProfileData {
  displayName: string;
  email: string;
  phone: string;
  location: string;
}

interface PasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const Profile: React.FC = () => {
  const theme = useTheme();
  const { currentUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isRTL = theme.direction === 'rtl';

  const { control: profileControl, handleSubmit: handleProfileSubmit, reset: resetProfile } = useForm<ProfileData>({
    defaultValues: {
      displayName: currentUser?.displayName || '',
      email: currentUser?.email || '',
      phone: '',
      location: '',
    },
  });

  const { control: passwordControl, handleSubmit: handlePasswordSubmit, reset: resetPassword, watch } = useForm<PasswordData>({
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const newPassword = watch('newPassword');

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentUser) return;

    setUploadingPhoto(true);
    try {
      // Upload to Firebase Storage
      const storageRef = ref(storage, `users/${currentUser.uid}/profile.jpg`);
      await uploadBytes(storageRef, file);
      const photoURL = await getDownloadURL(storageRef);

      // Update user profile
      await updateProfile(currentUser, { photoURL });
      
      toast.success(isRTL ? 'تم تحديث الصورة بنجاح' : 'Photo updated successfully');
      
      // Force refresh
      window.location.reload();
    } catch (error) {
      toast.error(isRTL ? 'فشل تحديث الصورة' : 'Failed to update photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const onSubmitProfile = async (data: ProfileData) => {
    if (!currentUser) return;
    
    setLoading(true);
    try {
      // Update display name
      await updateProfile(currentUser, {
        displayName: data.displayName,
      });
      
      toast.success(isRTL ? 'تم تحديث المعلومات بنجاح' : 'Profile updated successfully');
      setEditing(false);
    } catch (error) {
      toast.error(isRTL ? 'فشل تحديث المعلومات' : 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const onSubmitPassword = async (data: PasswordData) => {
    if (!currentUser || !currentUser.email) return;
    
    setLoading(true);
    try {
      // Re-authenticate user
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        data.currentPassword
      );
      await reauthenticateWithCredential(currentUser, credential);
      
      // Update password
      await updatePassword(currentUser, data.newPassword);
      
      toast.success(isRTL ? 'تم تغيير كلمة المرور بنجاح' : 'Password changed successfully');
      setPasswordDialogOpen(false);
      resetPassword();
    } catch (error: any) {
      if (error.code === 'auth/wrong-password') {
        toast.error(isRTL ? 'كلمة المرور الحالية غير صحيحة' : 'Current password is incorrect');
      } else {
        toast.error(isRTL ? 'فشل تغيير كلمة المرور' : 'Failed to change password');
      }
    } finally {
      setLoading(false);
    }
  };

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

  const joinDate = currentUser?.metadata.creationTime
    ? new Date(currentUser.metadata.creationTime).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';

  return (
    <Box sx={{ flexGrow: 1, minHeight: '100vh' }}>
      {/* Header */}
      <Box
        sx={{
          p: 3,
          borderBottom: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.paper,
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          {isRTL ? 'الملف الشخصي' : 'Profile'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {isRTL ? 'إدارة معلوماتك الشخصية وإعدادات الحساب' : 'Manage your personal information and account settings'}
        </Typography>
      </Box>

      <Box sx={{ p: 3 }}>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <Grid container spacing={3}>
            {/* Profile Card */}
            <Grid item xs={12} md={4}>
              <motion.div variants={itemVariants}>
                <Card>
                  <CardContent sx={{ textAlign: 'center', py: 4 }}>
                    <Badge
                      overlap="circular"
                      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                      badgeContent={
                        <IconButton
                          sx={{
                            bgcolor: 'primary.main',
                            color: 'white',
                            '&:hover': { bgcolor: 'primary.dark' },
                            width: 40,
                            height: 40,
                          }}
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingPhoto}
                        >
                          <PhotoCamera fontSize="small" />
                        </IconButton>
                      }
                    >
                      <Avatar
                        src={currentUser?.photoURL || undefined}
                        sx={{
                          width: 120,
                          height: 120,
                          fontSize: '3rem',
                          bgcolor: 'primary.main',
                          mb: 2,
                        }}
                      >
                        {currentUser?.displayName?.charAt(0) || currentUser?.email?.charAt(0)}
                      </Avatar>
                    </Badge>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={handlePhotoUpload}
                    />
                    <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
                      {currentUser?.displayName || isRTL ? 'المستخدم' : 'User'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {currentUser?.email}
                    </Typography>
                    {currentUser?.emailVerified && (
                      <Chip
                        icon={<Verified />}
                        label={isRTL ? 'حساب موثق' : 'Verified Account'}
                        color="success"
                        size="small"
                      />
                    )}
                    
                    <Divider sx={{ my: 3 }} />
                    
                    <List>
                      <ListItem>
                        <ListItemIcon>
                          <CalendarMonth color="action" />
                        </ListItemIcon>
                        <ListItemText
                          primary={isRTL ? 'تاريخ الانضمام' : 'Joined'}
                          secondary={joinDate}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <Security color="action" />
                        </ListItemIcon>
                        <ListItemText
                          primary={isRTL ? 'آخر تسجيل دخول' : 'Last Sign In'}
                          secondary={
                            currentUser?.metadata.lastSignInTime
                              ? new Date(currentUser.metadata.lastSignInTime).toLocaleString(
                                  isRTL ? 'ar-EG' : 'en-US'
                                )
                              : ''
                          }
                        />
                      </ListItem>
                    </List>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>

            {/* Profile Information */}
            <Grid item xs={12} md={8}>
              <motion.div variants={itemVariants}>
                <Paper sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                    <Typography variant="h6">
                      {isRTL ? 'المعلومات الشخصية' : 'Personal Information'}
                    </Typography>
                    <Button
                      startIcon={editing ? <Cancel /> : <Edit />}
                      onClick={() => {
                        setEditing(!editing);
                        if (!editing) {
                          resetProfile({
                            displayName: currentUser?.displayName || '',
                            email: currentUser?.email || '',
                            phone: '',
                            location: '',
                          });
                        }
                      }}
                      variant={editing ? 'outlined' : 'contained'}
                    >
                      {editing
                        ? (isRTL ? 'إلغاء' : 'Cancel')
                        : (isRTL ? 'تعديل' : 'Edit')}
                    </Button>
                  </Box>

                  <form onSubmit={handleProfileSubmit(onSubmitProfile)}>
                    <Grid container spacing={3}>
                      <Grid item xs={12} sm={6}>
                        <Controller
                          name="displayName"
                          control={profileControl}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              fullWidth
                              label={isRTL ? 'الاسم الكامل' : 'Full Name'}
                              disabled={!editing}
                              InputProps={{
                                startAdornment: <Edit sx={{ mr: 1, color: 'action.active' }} />,
                              }}
                            />
                          )}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Controller
                          name="email"
                          control={profileControl}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              fullWidth
                              label={isRTL ? 'البريد الإلكتروني' : 'Email'}
                              disabled
                              InputProps={{
                                startAdornment: <Email sx={{ mr: 1, color: 'action.active' }} />,
                              }}
                            />
                          )}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Controller
                          name="phone"
                          control={profileControl}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              fullWidth
                              label={isRTL ? 'رقم الهاتف' : 'Phone Number'}
                              disabled={!editing}
                              InputProps={{
                                startAdornment: <Phone sx={{ mr: 1, color: 'action.active' }} />,
                              }}
                            />
                          )}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Controller
                          name="location"
                          control={profileControl}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              fullWidth
                              label={isRTL ? 'الموقع' : 'Location'}
                              disabled={!editing}
                              InputProps={{
                                startAdornment: <LocationOn sx={{ mr: 1, color: 'action.active' }} />,
                              }}
                            />
                          )}
                        />
                      </Grid>
                    </Grid>

                    {editing && (
                      <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                        <Button
                          type="submit"
                          variant="contained"
                          startIcon={<Save />}
                          disabled={loading}
                        >
                          {isRTL ? 'حفظ التغييرات' : 'Save Changes'}
                        </Button>
                      </Box>
                    )}
                  </form>
                </Paper>
              </motion.div>

              {/* Security Settings */}
              <motion.div variants={itemVariants}>
                <Paper sx={{ p: 3, mt: 3 }}>
                  <Typography variant="h6" sx={{ mb: 3 }}>
                    {isRTL ? 'إعدادات الأمان' : 'Security Settings'}
                  </Typography>
                  
                  <List>
                    <ListItem
                      secondaryAction={
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => setPasswordDialogOpen(true)}
                        >
                          {isRTL ? 'تغيير' : 'Change'}
                        </Button>
                      }
                    >
                      <ListItemIcon>
                        <Security />
                      </ListItemIcon>
                      <ListItemText
                        primary={isRTL ? 'كلمة المرور' : 'Password'}
                        secondary={isRTL ? 'آخر تغيير منذ 30 يوم' : 'Last changed 30 days ago'}
                      />
                    </ListItem>
                  </List>
                </Paper>
              </motion.div>
            </Grid>
          </Grid>
        </motion.div>
      </Box>

      {/* Change Password Dialog */}
      <Dialog
        open={passwordDialogOpen}
        onClose={() => setPasswordDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {isRTL ? 'تغيير كلمة المرور' : 'Change Password'}
            <IconButton onClick={() => setPasswordDialogOpen(false)} size="small">
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <form onSubmit={handlePasswordSubmit(onSubmitPassword)}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Controller
                  name="currentPassword"
                  control={passwordControl}
                  rules={{ required: isRTL ? 'هذا الحقل مطلوب' : 'This field is required' }}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      fullWidth
                      type="password"
                      label={isRTL ? 'كلمة المرور الحالية' : 'Current Password'}
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <Controller
                  name="newPassword"
                  control={passwordControl}
                  rules={{
                    required: isRTL ? 'هذا الحقل مطلوب' : 'This field is required',
                    minLength: {
                      value: 6,
                      message: isRTL ? 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' : 'Password must be at least 6 characters',
                    },
                  }}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      fullWidth
                      type="password"
                      label={isRTL ? 'كلمة المرور الجديدة' : 'New Password'}
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <Controller
                  name="confirmPassword"
                  control={passwordControl}
                  rules={{
                    required: isRTL ? 'هذا الحقل مطلوب' : 'This field is required',
                    validate: value =>
                      value === newPassword || (isRTL ? 'كلمات المرور غير متطابقة' : 'Passwords do not match'),
                  }}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      fullWidth
                      type="password"
                      label={isRTL ? 'تأكيد كلمة المرور' : 'Confirm Password'}
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                    />
                  )}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPasswordDialogOpen(false)}>
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button type="submit" variant="contained" disabled={loading}>
              {isRTL ? 'تغيير كلمة المرور' : 'Change Password'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default Profile;