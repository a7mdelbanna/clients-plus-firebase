import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  IconButton,
  Stepper,
  Step,
  StepLabel,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  CircularProgress,
  InputAdornment,
} from '@mui/material';
import {
  Close as CloseIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  Cake as CakeIcon,
  Settings as SettingsIcon,
  LocalHospital as MedicalIcon,
  NavigateNext as NextIcon,
  NavigateBefore as BackIcon,
} from '@mui/icons-material';
import { useLanguage } from '../contexts/LanguageContext';
import { useFirebaseAuth } from '../contexts/FirebaseAuthContext';
import { useBooking } from '../contexts/BookingContext';

interface ClientSetupWizardProps {
  open: boolean;
  onClose: () => void;
  companyId: string;
  branchId?: string;
}

interface SetupData {
  // Basic Info
  firstName: string;
  lastName: string;
  phone: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | '';
  
  // Address
  address: string;
  city: string;
  
  // Preferences
  preferredLanguage: 'ar' | 'en';
  communicationPreferences: {
    sms: boolean;
    email: boolean;
    whatsapp: boolean;
  };
  
  // Medical Info
  allergies: string[];
  medicalConditions: string[];
  medications: string[];
  notes: string;
}

const steps = ['Basic Information', 'Preferences', 'Medical Information'];

const ClientSetupWizard: React.FC<ClientSetupWizardProps> = ({ 
  open, 
  onClose, 
  companyId,
  branchId 
}) => {
  const { t } = useLanguage();
  const { user, completeRegistration } = useFirebaseAuth();
  const { bookingData } = useBooking();
  
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState<SetupData>({
    firstName: user?.displayName?.split(' ')[0] || '',
    lastName: user?.displayName?.split(' ').slice(1).join(' ') || '',
    phone: '',
    dateOfBirth: '',
    gender: '',
    address: '',
    city: '',
    preferredLanguage: 'ar',
    communicationPreferences: {
      sms: true,
      email: true,
      whatsapp: true,
    },
    allergies: [],
    medicalConditions: [],
    medications: [],
    notes: '',
  });
  
  const [newAllergy, setNewAllergy] = useState('');
  const [newCondition, setNewCondition] = useState('');
  const [newMedication, setNewMedication] = useState('');

  const handleInputChange = (field: keyof SetupData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePreferenceChange = (key: keyof SetupData['communicationPreferences']) => {
    setFormData(prev => ({
      ...prev,
      communicationPreferences: {
        ...prev.communicationPreferences,
        [key]: !prev.communicationPreferences[key]
      }
    }));
  };

  const addToArray = (field: 'allergies' | 'medicalConditions' | 'medications', value: string) => {
    if (value.trim() && !formData[field].includes(value.trim())) {
      setFormData(prev => ({
        ...prev,
        [field]: [...prev[field], value.trim()]
      }));
      
      if (field === 'allergies') setNewAllergy('');
      if (field === 'medicalConditions') setNewCondition('');
      if (field === 'medications') setNewMedication('');
    }
  };

  const removeFromArray = (field: 'allergies' | 'medicalConditions' | 'medications', value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter(item => item !== value)
    }));
  };

  const handleNext = () => {
    if (activeStep === 0) {
      // Validate basic info
      if (!formData.firstName || !formData.lastName || !formData.phone) {
        setError('Please fill in all required fields');
        return;
      }
    }
    
    setError('');
    setActiveStep(prev => prev + 1);
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };

  const handleComplete = async () => {
    setLoading(true);
    setError('');
    
    try {
      const profileData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        dateOfBirth: formData.dateOfBirth ? new Date(formData.dateOfBirth) : null,
        gender: formData.gender || null,
        address: {
          street: formData.address,
          city: formData.city,
        },
        preferences: {
          language: formData.preferredLanguage,
          notifications: formData.communicationPreferences,
          marketingConsent: false,
        },
        medicalInfo: {
          allergies: formData.allergies,
          conditions: formData.medicalConditions,
          medications: formData.medications,
          notes: formData.notes,
        },
        companyId,
        branchId: branchId || bookingData?.branchId || 'main',
      };

      const result = await completeRegistration(profileData);
      
      if (result.success) {
        onClose();
      } else {
        setError(result.message || 'Failed to complete setup');
      }
    } catch (err: any) {
      console.error('Setup error:', err);
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const renderBasicInfo = () => (
    <Box sx={{ mt: 2 }}>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="First Name *"
            value={formData.firstName}
            onChange={(e) => handleInputChange('firstName', e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PersonIcon />
                </InputAdornment>
              ),
            }}
          />
        </Grid>
        
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Last Name *"
            value={formData.lastName}
            onChange={(e) => handleInputChange('lastName', e.target.value)}
          />
        </Grid>
        
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Phone Number *"
            value={formData.phone}
            onChange={(e) => handleInputChange('phone', e.target.value)}
            placeholder="+201070128710"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PhoneIcon />
                </InputAdornment>
              ),
            }}
          />
        </Grid>
        
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Date of Birth"
            type="date"
            value={formData.dateOfBirth}
            onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
            InputLabelProps={{ shrink: true }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <CakeIcon />
                </InputAdornment>
              ),
            }}
          />
        </Grid>
        
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth>
            <InputLabel>Gender</InputLabel>
            <Select
              value={formData.gender}
              onChange={(e) => handleInputChange('gender', e.target.value)}
            >
              <MenuItem value="male">Male</MenuItem>
              <MenuItem value="female">Female</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Address"
            value={formData.address}
            onChange={(e) => handleInputChange('address', e.target.value)}
            multiline
            rows={2}
          />
        </Grid>
        
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="City"
            value={formData.city}
            onChange={(e) => handleInputChange('city', e.target.value)}
          />
        </Grid>
      </Grid>
    </Box>
  );

  const renderPreferences = () => (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h6" gutterBottom>
        <SettingsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Communication Preferences
      </Typography>
      
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <FormControl fullWidth>
            <InputLabel>Preferred Language</InputLabel>
            <Select
              value={formData.preferredLanguage}
              onChange={(e) => handleInputChange('preferredLanguage', e.target.value)}
            >
              <MenuItem value="ar">العربية (Arabic)</MenuItem>
              <MenuItem value="en">English</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        
        <Grid item xs={12}>
          <Typography variant="body2" sx={{ mb: 2 }}>
            How would you like to receive notifications?
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant={formData.communicationPreferences.sms ? 'contained' : 'outlined'}
              onClick={() => handlePreferenceChange('sms')}
              startIcon={<PhoneIcon />}
            >
              SMS
            </Button>
            
            <Button
              variant={formData.communicationPreferences.email ? 'contained' : 'outlined'}
              onClick={() => handlePreferenceChange('email')}
              startIcon={<PersonIcon />}
            >
              Email
            </Button>
            
            <Button
              variant={formData.communicationPreferences.whatsapp ? 'contained' : 'outlined'}
              onClick={() => handlePreferenceChange('whatsapp')}
              startIcon={<PhoneIcon />}
            >
              WhatsApp
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );

  const renderMedicalInfo = () => (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h6" gutterBottom>
        <MedicalIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Medical Information (Optional)
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Box sx={{ mb: 2 }}>
            <TextField
              fullWidth
              label="Add Allergy"
              value={newAllergy}
              onChange={(e) => setNewAllergy(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  addToArray('allergies', newAllergy);
                }
              }}
              InputProps={{
                endAdornment: (
                  <Button onClick={() => addToArray('allergies', newAllergy)}>
                    Add
                  </Button>
                ),
              }}
            />
            <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {formData.allergies.map((allergy) => (
                <Chip
                  key={allergy}
                  label={allergy}
                  onDelete={() => removeFromArray('allergies', allergy)}
                  color="error"
                />
              ))}
            </Box>
          </Box>
        </Grid>
        
        <Grid item xs={12}>
          <Box sx={{ mb: 2 }}>
            <TextField
              fullWidth
              label="Add Medical Condition"
              value={newCondition}
              onChange={(e) => setNewCondition(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  addToArray('medicalConditions', newCondition);
                }
              }}
              InputProps={{
                endAdornment: (
                  <Button onClick={() => addToArray('medicalConditions', newCondition)}>
                    Add
                  </Button>
                ),
              }}
            />
            <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {formData.medicalConditions.map((condition) => (
                <Chip
                  key={condition}
                  label={condition}
                  onDelete={() => removeFromArray('medicalConditions', condition)}
                  color="warning"
                />
              ))}
            </Box>
          </Box>
        </Grid>
        
        <Grid item xs={12}>
          <Box sx={{ mb: 2 }}>
            <TextField
              fullWidth
              label="Add Medication"
              value={newMedication}
              onChange={(e) => setNewMedication(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  addToArray('medications', newMedication);
                }
              }}
              InputProps={{
                endAdornment: (
                  <Button onClick={() => addToArray('medications', newMedication)}>
                    Add
                  </Button>
                ),
              }}
            />
            <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {formData.medications.map((medication) => (
                <Chip
                  key={medication}
                  label={medication}
                  onDelete={() => removeFromArray('medications', medication)}
                  color="info"
                />
              ))}
            </Box>
          </Box>
        </Grid>
        
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Additional Notes"
            value={formData.notes}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            multiline
            rows={3}
            placeholder="Any additional medical information or notes..."
          />
        </Grid>
      </Grid>
    </Box>
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">Complete Your Profile</Typography>
          <IconButton onClick={onClose} disabled={loading}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
        
        {activeStep === 0 && renderBasicInfo()}
        {activeStep === 1 && renderPreferences()}
        {activeStep === 2 && renderMedicalInfo()}
      </DialogContent>
      
      <DialogActions>
        <Button
          onClick={handleBack}
          disabled={activeStep === 0 || loading}
          startIcon={<BackIcon />}
        >
          Back
        </Button>
        
        <Box sx={{ flex: 1 }} />
        
        {activeStep === steps.length - 1 ? (
          <Button
            variant="contained"
            onClick={handleComplete}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : undefined}
          >
            Complete Setup
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={loading}
            endIcon={<NextIcon />}
          >
            Next
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ClientSetupWizard;