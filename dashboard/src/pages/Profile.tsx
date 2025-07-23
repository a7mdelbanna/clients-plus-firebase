import React, { useState, useRef, useEffect } from 'react';
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
  CircularProgress,
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
import { userService, type UserProfile } from '../services/user.service';
import { companyService } from '../services/company.service';

interface ProfileData {
  displayName: string;
  email: string;
  phoneNumber: string;
  location: string;
  bio: string;
  firstName: string;
  lastName: string;
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
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [userRole, setUserRole] = useState<string>('user');
  const [companyData, setCompanyData] = useState<any>(null);
  const isRTL = theme.direction === 'rtl';

  const { control: profileControl, handleSubmit: handleProfileSubmit, reset: resetProfile } = useForm<ProfileData>({
    defaultValues: {
      displayName: '',
      email: '',
      phoneNumber: '',
      location: '',
      bio: '',
      firstName: '',
      lastName: '',
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

  // Load user profile data and determine role
  useEffect(() => {
    const loadUserProfile = async () => {
      if (!currentUser) return;

      try {
        setLoadingProfile(true);
        
        // Get user profile
        const profile = await userService.getUserProfile(currentUser.uid);
        
        // Get company data to determine if user is owner
        const idTokenResult = await currentUser.getIdTokenResult();
        const companyId = idTokenResult.claims.companyId as string;
        
        console.log('🔍 Profile Debug - User ID:', currentUser.uid);
        console.log('🔍 Profile Debug - Company ID:', companyId);
        console.log('🔍 Profile Debug - Profile role:', profile?.role);
        
        let determinedRole = 'user';
        
        if (companyId) {
          try {
            const company = await companyService.getCompanyInfo(companyId);
            console.log('🔍 Profile Debug - Company data:', company);
            console.log('🔍 Profile Debug - Company owner ID:', company?.ownerId);
            console.log('🔍 Profile Debug - Is owner?', company?.ownerId === currentUser.uid);
            
            setCompanyData(company);
            
            // Check if user is company owner
            if (company?.ownerId === currentUser.uid) {
              determinedRole = 'owner';
              console.log('✅ Profile Debug - User is OWNER');
            } else if (profile?.role) {
              // Use role from profile if available
              determinedRole = profile.role;
              console.log('✅ Profile Debug - Using profile role:', profile.role);
            } else {
              // Default role logic based on company data
              determinedRole = 'admin'; // Assume admin if no specific role
              console.log('✅ Profile Debug - Defaulting to ADMIN');
            }
          } catch (error) {
            console.error('❌ Profile Debug - Company service error:', error);
            // Fallback to profile role or default
            determinedRole = profile?.role || 'admin'; // Default to admin instead of user
            console.log('✅ Profile Debug - Fallback role:', determinedRole);
          }
        } else if (profile?.role) {
          determinedRole = profile.role;
          console.log('✅ Profile Debug - Using profile role (no company):', profile.role);
        } else {
          determinedRole = 'admin'; // Default to admin for any user in system
          console.log('✅ Profile Debug - Final fallback to ADMIN');
        }
        
        console.log('🎯 Profile Debug - Final determined role:', determinedRole);
        setUserRole(determinedRole);
        
        if (profile) {
          setUserProfile(profile);
          // Update form with loaded data
          resetProfile({
            displayName: profile.displayName || currentUser.displayName || '',
            email: profile.email || currentUser.email || '',
            phoneNumber: profile.phoneNumber || '',
            location: profile.location || '',
            bio: profile.bio || '',
            firstName: profile.firstName || '',
            lastName: profile.lastName || '',
          });
        } else {
          // Set defaults from Firebase Auth
          resetProfile({
            displayName: currentUser.displayName || '',
            email: currentUser.email || '',
            phoneNumber: '',
            location: '',
            bio: '',
            firstName: '',
            lastName: '',
          });
        }
      } catch (error) {
        console.error('Error loading user profile:', error);
        toast.error(isRTL ? 'فشل تحميل بيانات المستخدم' : 'Failed to load user profile');
      } finally {
        setLoadingProfile(false);
      }
    };

    loadUserProfile();
  }, [currentUser, resetProfile, isRTL]);

  // Debug function for testing
  React.useEffect(() => {
    (window as any).debugProfileRole = () => {
      console.log('🐛 DEBUG - Current user:', currentUser?.uid);
      console.log('🐛 DEBUG - User role state:', userRole);
      console.log('🐛 DEBUG - User profile:', userProfile);
      console.log('🐛 DEBUG - Company data:', companyData);
    };
  }, [currentUser, userRole, userProfile, companyData]);

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentUser) return;

    setUploadingPhoto(true);
    try {
      // Upload to Firebase Storage
      const storageRef = ref(storage, `users/${currentUser.uid}/profile.jpg`);
      await uploadBytes(storageRef, file);
      const photoURL = await getDownloadURL(storageRef);

      // Update Firebase Auth profile
      await updateProfile(currentUser, { photoURL });
      
      // Update Firestore user document
      await userService.updatePhotoURL(currentUser.uid, photoURL);
      
      // Update local state
      if (userProfile) {
        setUserProfile({ ...userProfile, photoURL });
      }
      
      toast.success(isRTL ? 'تم تحديث الصورة بنجاح' : 'Photo updated successfully');
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
      // Update Firebase Auth display name
      await updateProfile(currentUser, {
        displayName: data.displayName,
      });
      
      // Update Firestore user document with all profile data
      await userService.updateUserProfile(currentUser.uid, {
        displayName: data.displayName,
        phoneNumber: data.phoneNumber,
        location: data.location,
        bio: data.bio,
        firstName: data.firstName,
        lastName: data.lastName,
        email: currentUser.email || '',
        emailVerified: currentUser.emailVerified,
      });
      
      // Update local state
      if (userProfile) {
        setUserProfile({
          ...userProfile,
          displayName: data.displayName,
          phoneNumber: data.phoneNumber,
          location: data.location,
          bio: data.bio,
          firstName: data.firstName,
          lastName: data.lastName,
        });
      }
      
      toast.success(isRTL ? 'تم تحديث المعلومات بنجاح' : 'Profile updated successfully');
      setEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
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

  const formatDate = (dateString: string) => {
    if (!dateString) return isRTL ? 'غير محدد' : 'N/A';
    return new Date(dateString).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const joinDate = currentUser?.metadata.creationTime ? formatDate(currentUser.metadata.creationTime) : '';
  const lastLoginDate = currentUser?.metadata.lastSignInTime ? formatDate(currentUser.metadata.lastSignInTime) : '';

  return (
    <Box sx={{ flexGrow: 1, minHeight: '100vh', bgcolor: 'background.default' }}>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Header Section */}
        <Box sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
          <motion.div variants={itemVariants}>
            <Grid container spacing={3} sx={{ p: 4 }}>
              {/* Profile Avatar Section */}
              <Grid item xs={12} md={3}>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
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
                          boxShadow: 2,
                        }}
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingPhoto}
                      >
                        <PhotoCamera fontSize="small" />
                      </IconButton>
                    }
                  >
                    <Avatar
                      src={userProfile?.photoURL || currentUser?.photoURL || undefined}
                      sx={{
                        width: 140,
                        height: 140,
                        fontSize: '3.5rem',
                        bgcolor: 'primary.main',
                        boxShadow: 4,
                        border: 4,
                        borderColor: 'background.paper',
                      }}
                    >
                      {userProfile?.displayName?.charAt(0) || currentUser?.displayName?.charAt(0) || currentUser?.email?.charAt(0)}
                    </Avatar>
                  </Badge>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={handlePhotoUpload}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
                    {isRTL ? 'انقر على الكاميرا لتغيير الصورة' : 'Click camera to change photo'}
                  </Typography>
                </Box>
              </Grid>

              {/* Profile Header Info */}
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                    {userProfile?.displayName || currentUser?.displayName || (isRTL ? 'المستخدم' : 'User')}
                  </Typography>
                  <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
                    {currentUser?.email}
                  </Typography>
                  
                  <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                    {currentUser?.emailVerified && (
                      <Chip
                        icon={<Verified />}
                        label={isRTL ? 'حساب موثق' : 'Verified Account'}
                        color="success"
                        size="small"
                      />
                    )}
                    {userProfile?.phoneNumber && (
                      <Chip
                        icon={<Phone />}
                        label={userProfile.phoneNumber}
                        variant="outlined"
                        size="small"
                      />
                    )}
                    {userProfile?.location && (
                      <Chip
                        icon={<LocationOn />}
                        label={userProfile.location}
                        variant="outlined"
                        size="small"
                      />
                    )}
                  </Box>

                  {userProfile?.bio && (
                    <Typography variant="body1" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      "{userProfile.bio}"
                    </Typography>
                  )}
                </Box>
              </Grid>

              {/* Quick Stats */}
              <Grid item xs={12} md={3}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'action.hover' }}>
                    <Typography variant="body2" color="text.secondary">
                      {isRTL ? 'تاريخ الانضمام' : 'Member Since'}
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {joinDate}
                    </Typography>
                  </Paper>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'action.hover' }}>
                    <Typography variant="body2" color="text.secondary">
                      {isRTL ? 'آخر دخول' : 'Last Active'}
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {lastLoginDate}
                    </Typography>
                  </Paper>
                </Box>
              </Grid>
            </Grid>
          </motion.div>
        </Box>

        {/* Main Content */}
        <Box sx={{ p: 4 }}>
          <Grid container spacing={4}>
            {/* Profile Information Form */}
            <Grid item xs={12} lg={8}>
              <motion.div variants={itemVariants}>
                <Card sx={{ boxShadow: 2 }}>
                  <CardContent sx={{ p: 4 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                      <Box>
                        <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
                          {isRTL ? 'المعلومات الشخصية' : 'Personal Information'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {isRTL ? 'قم بتحديث معلوماتك الشخصية' : 'Update your personal details'}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        {loadingProfile && <CircularProgress size={20} />}
                        <Button
                          startIcon={editing ? <Cancel /> : <Edit />}
                          onClick={() => {
                            setEditing(!editing);
                            if (!editing) {
                              resetProfile({
                                displayName: userProfile?.displayName || currentUser?.displayName || '',
                                email: currentUser?.email || '',
                                phoneNumber: userProfile?.phoneNumber || '',
                                location: userProfile?.location || '',
                                bio: userProfile?.bio || '',
                                firstName: userProfile?.firstName || '',
                                lastName: userProfile?.lastName || '',
                              });
                            }
                          }}
                          variant={editing ? 'outlined' : 'contained'}
                          size="large"
                        >
                          {editing
                            ? (isRTL ? 'إلغاء' : 'Cancel')
                            : (isRTL ? 'تعديل' : 'Edit')}
                        </Button>
                      </Box>
                    </Box>

                    <form onSubmit={handleProfileSubmit(onSubmitProfile)}>
                      <Box sx={{ mb: 3 }}>
                        <Typography variant="h6" sx={{ mb: 2, color: 'text.secondary' }}>
                          {isRTL ? 'المعلومات الأساسية' : 'Basic Information'}
                        </Typography>
                        <Grid container spacing={3}>
                          <Grid item xs={12} sm={6}>
                            <Controller
                              name="firstName"
                              control={profileControl}
                              render={({ field }) => (
                                <TextField
                                  {...field}
                                  fullWidth
                                  label={isRTL ? 'الاسم الأول' : 'First Name'}
                                  disabled={!editing}
                                  variant="outlined"
                                  sx={{ bgcolor: editing ? 'background.paper' : 'action.hover' }}
                                />
                              )}
                            />
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <Controller
                              name="lastName"
                              control={profileControl}
                              render={({ field }) => (
                                <TextField
                                  {...field}
                                  fullWidth
                                  label={isRTL ? 'اسم العائلة' : 'Last Name'}
                                  disabled={!editing}
                                  variant="outlined"
                                  sx={{ bgcolor: editing ? 'background.paper' : 'action.hover' }}
                                />
                              )}
                            />
                          </Grid>
                          <Grid item xs={12}>
                            <Controller
                              name="displayName"
                              control={profileControl}
                              render={({ field }) => (
                                <TextField
                                  {...field}
                                  fullWidth
                                  label={isRTL ? 'الاسم المعروض' : 'Display Name'}
                                  disabled={!editing}
                                  helperText={isRTL ? 'هذا الاسم سيظهر للآخرين' : 'This name will be visible to others'}
                                  variant="outlined"
                                  sx={{ bgcolor: editing ? 'background.paper' : 'action.hover' }}
                                />
                              )}
                            />
                          </Grid>
                          <Grid item xs={12}>
                            <Controller
                              name="email"
                              control={profileControl}
                              render={({ field }) => (
                                <TextField
                                  {...field}
                                  fullWidth
                                  label={isRTL ? 'البريد الإلكتروني' : 'Email'}
                                  disabled
                                  helperText={isRTL ? 'لا يمكن تغيير البريد الإلكتروني' : 'Email cannot be changed'}
                                  variant="outlined"
                                  sx={{ bgcolor: 'action.hover' }}
                                  InputProps={{
                                    startAdornment: <Email sx={{ mr: 1, color: 'action.active' }} />,
                                  }}
                                />
                              )}
                            />
                          </Grid>
                        </Grid>
                      </Box>

                      <Box sx={{ mb: 3 }}>
                        <Typography variant="h6" sx={{ mb: 2, color: 'text.secondary' }}>
                          {isRTL ? 'معلومات الاتصال' : 'Contact Information'}
                        </Typography>
                        <Grid container spacing={3}>
                          <Grid item xs={12} sm={6}>
                            <Controller
                              name="phoneNumber"
                              control={profileControl}
                              render={({ field }) => (
                                <TextField
                                  {...field}
                                  fullWidth
                                  label={isRTL ? 'رقم الهاتف' : 'Phone Number'}
                                  disabled={!editing}
                                  placeholder={isRTL ? '+20 1000000000' : '+20 1000000000'}
                                  variant="outlined"
                                  sx={{ bgcolor: editing ? 'background.paper' : 'action.hover' }}
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
                                  placeholder={isRTL ? 'القاهرة، مصر' : 'Cairo, Egypt'}
                                  variant="outlined"
                                  sx={{ bgcolor: editing ? 'background.paper' : 'action.hover' }}
                                  InputProps={{
                                    startAdornment: <LocationOn sx={{ mr: 1, color: 'action.active' }} />,
                                  }}
                                />
                              )}
                            />
                          </Grid>
                        </Grid>
                      </Box>

                      <Box sx={{ mb: 3 }}>
                        <Typography variant="h6" sx={{ mb: 2, color: 'text.secondary' }}>
                          {isRTL ? 'حول' : 'About'}
                        </Typography>
                        <Controller
                          name="bio"
                          control={profileControl}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              fullWidth
                              multiline
                              rows={4}
                              label={isRTL ? 'نبذة شخصية' : 'Bio'}
                              disabled={!editing}
                              placeholder={isRTL ? 'اكتب نبذة مختصرة عنك...' : 'Write a short bio about yourself...'}
                              helperText={isRTL ? 'أخبر الآخرين عن نفسك وخبراتك' : 'Tell others about yourself and your experience'}
                              variant="outlined"
                              sx={{ bgcolor: editing ? 'background.paper' : 'action.hover' }}
                            />
                          )}
                        />
                      </Box>

                      {editing && (
                        <Box sx={{ mt: 4, p: 3, bgcolor: 'action.hover', borderRadius: 2 }}>
                          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                            <Button
                              onClick={() => setEditing(false)}
                              variant="outlined"
                              size="large"
                              startIcon={<Cancel />}
                            >
                              {isRTL ? 'إلغاء' : 'Cancel'}
                            </Button>
                            <Button
                              type="submit"
                              variant="contained"
                              size="large"
                              startIcon={<Save />}
                              disabled={loading}
                            >
                              {loading ? (
                                <CircularProgress size={20} color="inherit" />
                              ) : (
                                isRTL ? 'حفظ التغييرات' : 'Save Changes'
                              )}
                            </Button>
                          </Box>
                        </Box>
                      )}
                    </form>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>

            {/* Sidebar - Security & Account */}
            <Grid item xs={12} lg={4}>
              <motion.div variants={itemVariants}>
                <Card sx={{ boxShadow: 2, mb: 3 }}>
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
                      <Security sx={{ mr: 1 }} />
                      {isRTL ? 'الأمان والحساب' : 'Security & Account'}
                    </Typography>
                    
                    <List disablePadding>
                      <ListItem
                        sx={{ 
                          px: 0,
                          py: 2,
                          borderBottom: 1,
                          borderColor: 'divider',
                          flexDirection: 'column',
                          alignItems: 'flex-start'
                        }}
                      >
                        <Box sx={{ width: '100%', mb: 2 }}>
                          <Typography variant="body1" sx={{ fontWeight: 500, color: 'text.primary', mb: 0.5 }}>
                            {isRTL ? 'كلمة المرور' : 'Password'}
                          </Typography>
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            {isRTL ? 'آخر تغيير منذ 30 يوم' : 'Last changed 30 days ago'}
                          </Typography>
                        </Box>
                        <Button
                          variant="contained"
                          size="small"
                          onClick={() => setPasswordDialogOpen(true)}
                          sx={{ 
                            minWidth: '80px',
                            px: 3,
                            py: 1,
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            backgroundColor: 'primary.main',
                            color: 'white',
                            border: 'none',
                            '&:hover': {
                              backgroundColor: 'primary.dark',
                              color: 'white'
                            },
                            textTransform: 'none',
                            borderRadius: 2
                          }}
                        >
                          {isRTL ? 'تغيير كلمة المرور' : 'Change Password'}
                        </Button>
                      </ListItem>

                      <ListItem sx={{ px: 0, py: 2 }}>
                        <ListItemText
                          primary={
                            <Typography variant="body1" sx={{ fontWeight: 500, color: 'text.primary' }}>
                              {isRTL ? 'المصادقة الثنائية' : 'Two-Factor Authentication'}
                            </Typography>
                          }
                          secondary={
                            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                              {isRTL ? 'غير مفعل' : 'Not enabled'}
                            </Typography>
                          }
                        />
                        <Chip 
                          label={isRTL ? 'قريباً' : 'Coming Soon'} 
                          size="small" 
                          variant="outlined"
                          sx={{ 
                            borderColor: 'text.secondary',
                            color: 'text.secondary',
                            fontSize: '0.75rem'
                          }}
                        />
                      </ListItem>
                    </List>
                  </CardContent>
                </Card>

                {/* Account Statistics */}
                <Card sx={{ boxShadow: 2 }}>
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="h6" sx={{ mb: 3 }}>
                      {isRTL ? 'إحصائيات الحساب' : 'Account Statistics'}
                    </Typography>
                    
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body1" sx={{ fontWeight: 500, color: 'text.primary' }}>
                          {isRTL ? 'عدد تسجيلات الدخول' : 'Total Logins'}
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main' }}>
                          {Math.floor(Math.random() * 100) + 50}
                        </Typography>
                      </Box>
                      
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body1" sx={{ fontWeight: 500, color: 'text.primary' }}>
                          {isRTL ? 'الملف مكتمل' : 'Profile Complete'}
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 600, color: 'success.main' }}>
                          {userProfile?.firstName && userProfile?.lastName && userProfile?.phoneNumber && userProfile?.bio 
                            ? '100%' : userProfile?.firstName || userProfile?.phoneNumber ? '75%' : '50%'}
                        </Typography>
                      </Box>
                      
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body1" sx={{ fontWeight: 500, color: 'text.primary' }}>
                          {isRTL ? 'نوع الحساب' : 'Account Type'}
                        </Typography>
                        <Chip 
                          label={
                            userRole === 'owner' 
                              ? (isRTL ? 'مالك' : 'Owner')
                              : userRole === 'admin'
                              ? (isRTL ? 'مدير' : 'Admin')
                              : userRole === 'manager'
                              ? (isRTL ? 'مدير فرع' : 'Manager')
                              : userRole === 'employee'
                              ? (isRTL ? 'موظف' : 'Employee')
                              : userRole === 'receptionist'
                              ? (isRTL ? 'موظف استقبال' : 'Receptionist')
                              : (isRTL ? 'مستخدم' : 'User')
                          }
                          size="small" 
                          color={
                            userRole === 'owner' || userRole === 'admin'
                              ? 'error'
                              : userRole === 'manager'
                              ? 'warning'
                              : 'primary'
                          }
                          sx={{ 
                            fontWeight: 600,
                            fontSize: '0.75rem'
                          }}
                        />
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
          </Grid>
        </Box>
      </motion.div>

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