# Firebase Authentication Testing Guide

This guide will walk you through testing the complete Firebase Authentication system for the Clients+ booking application.

## Prerequisites

1. **Services Running:**
   - Dashboard: http://localhost:5173
   - Booking App: http://localhost:5175
   - Firebase Emulators: http://localhost:4000

2. **Test Accounts:**
   - Superadmin: Login with your existing credentials
   - Test Company: You'll create this during testing

## Step 1: Create Test Company & Enable Authentication

### 1.1 Login to Dashboard
1. Open http://localhost:5173
2. Login with your superadmin credentials

### 1.2 Create a New Company (or use existing)
1. Go to "الشركات" (Companies) in the sidebar
2. Click "إضافة شركة" (Add Company)
3. Fill in:
   - Company Name: "Test Auth Company"
   - Slug: "test-auth"
   - Other required fields
4. Save the company

### 1.3 Configure Authentication Settings
1. Go to company settings: Settings → Authentication (الإعدادات → المصادقة)
2. Enable authentication methods:
   - ✅ SMS Authentication (رسائل SMS)
   - ✅ Email Authentication (البريد الإلكتروني)
   - Select SMS Provider: Firebase (not Twilio)
3. Configure SMS Settings:
   - Daily Limit: 100
   - Monthly Limit: 1000
   - Allowed Countries: Select the countries you want
4. Save settings

## Step 2: Create a Booking Link

### 2.1 Navigate to Booking Links
1. In the company dashboard, go to "روابط الحجز" (Booking Links)
2. Click "إضافة رابط" (Add Link)

### 2.2 Create a General Booking Link
1. Fill in:
   - Name: "Test Booking Link"
   - Slug: "test-booking"
   - Type: General (عام)
   - Branch Settings: Single Branch
2. Save the link
3. Copy the booking URL (it should look like: `/book/test-auth/test-booking`)

## Step 3: Test Phone Authentication (Firebase)

### 3.1 Open the Booking Link
1. Open a new browser tab
2. Navigate to: http://localhost:5175/book/test-auth/test-booking
3. You should see the booking page

### 3.2 Test Phone Login
1. Click "تسجيل الدخول" (Login) button
2. You should see authentication method selector (if both SMS and Email are enabled)
3. Click "المتابعة برقم الهاتف" (Continue with Phone)
4. Enter a test phone number:
   - For Egypt: 01234567890
   - For Saudi: 0512345678
5. Click "إرسال رمز التحقق" (Send OTP)

### 3.3 Handle Firebase Phone Auth
**Note:** In Firebase Emulator, phone authentication works differently:
- The emulator will auto-generate an OTP: `123456`
- You'll see a reCAPTCHA verification (invisible in production)
- Enter `123456` as the verification code
- Click "تحقق" (Verify)

### 3.4 Verify Login Success
- You should be logged in
- Your phone number should appear in the header
- Click on your avatar to see profile options

## Step 4: Test Email/Password Authentication

### 4.1 Logout First
1. Click on your avatar in the header
2. Select "تسجيل الخروج" (Logout)

### 4.2 Test Email Sign Up
1. Click "تسجيل الدخول" (Login)
2. Click "المتابعة بالبريد الإلكتروني" (Continue with Email)
3. Click on "إنشاء حساب" (Sign Up) tab
4. Fill in:
   - Full Name: "Test User"
   - Email: "testuser@example.com"
   - Password: "test123456"
   - Confirm Password: "test123456"
5. Click "إنشاء حساب" (Sign Up)

### 4.3 Verify Account Creation
- You should be automatically logged in
- For new users, you might see a registration form to complete profile

### 4.4 Test Email Sign In
1. Logout again
2. Click "تسجيل الدخول" (Login)
3. Click "المتابعة بالبريد الإلكتروني" (Continue with Email)
4. Stay on "تسجيل الدخول" (Sign In) tab
5. Enter:
   - Email: "testuser@example.com"
   - Password: "test123456"
6. Click "تسجيل الدخول" (Sign In)

### 4.5 Test Password Reset
1. On the login form, click "نسيت كلمة المرور؟" (Forgot Password?)
2. Enter email: "testuser@example.com"
3. Click "إرسال رابط إعادة التعيين" (Send Reset Email)
4. In Firebase Emulator, check the Auth tab for the reset link
5. Note: In production, this would send a real email

## Step 5: Test Authentication Settings

### 5.1 Test Disabling Methods
1. Go back to Dashboard → Company Settings → Authentication
2. Disable Email authentication
3. Save settings
4. Go to booking page and try to login
5. You should only see phone authentication option

### 5.2 Test Provider Switching
1. In Dashboard, change SMS Provider from Firebase to Twilio
2. Save settings
3. Try phone login in booking app
4. It should now use the old Twilio system (requires Twilio configuration)

## Step 6: Verify Firebase Console

### 6.1 Check Firebase Emulator
1. Open http://localhost:4000
2. Go to Authentication tab
3. You should see:
   - Users created with phone numbers
   - Users created with email/password
   - Sign-in methods and timestamps

### 6.2 Check Firestore Data
1. In Firebase Emulator, go to Firestore tab
2. Navigate to:
   - `companies/{companyId}/settings/authentication` - Check auth settings
   - `clients/{userId}` - Check client records
   - `companies/{companyId}/usage/sms` - Check SMS usage tracking

## Step 7: Test Multi-Company Scenarios

### 7.1 Different Auth Settings Per Company
1. Create another company with different auth settings:
   - Company A: Only SMS
   - Company B: Only Email
   - Company C: Both SMS and Email
2. Create booking links for each
3. Verify each shows appropriate auth methods

### 7.2 Test SMS Limits
1. For a company with low SMS daily limit (e.g., 5)
2. Try to send OTP multiple times
3. After hitting the limit, you should get an error

## Step 8: Test Edge Cases

### 8.1 Invalid Inputs
- Invalid phone numbers
- Invalid email formats
- Weak passwords
- Mismatched passwords

### 8.2 Existing User Scenarios
- Try signing up with an existing email
- Try phone auth with existing phone number
- Verify proper error messages

### 8.3 Session Persistence
- Login and refresh the page
- Verify you remain logged in
- Close browser and reopen
- Check if session persists

## Troubleshooting

### Common Issues:

1. **reCAPTCHA Error:**
   - Make sure you're using Firebase emulator
   - Check browser console for errors
   - Verify Firebase config in `/booking-app/src/config/firebase.ts`

2. **OTP Not Working:**
   - In emulator, always use `123456`
   - Check Firebase emulator Auth tab
   - Verify phone number format

3. **Email Auth Not Working:**
   - Check if email auth is enabled in company settings
   - Verify Firebase Auth settings allow email/password
   - Check for typos in email/password

4. **"Authentication Disabled" Message:**
   - Verify auth methods are enabled in company settings
   - Check that settings are saved properly
   - Refresh the page after changing settings

## Production Deployment Notes

Before deploying to production:

1. **Firebase Configuration:**
   - Update Firebase config with production credentials
   - Enable appropriate auth methods in Firebase Console
   - Configure authorized domains

2. **Security Rules:**
   - Review and update Firestore security rules
   - Ensure proper access controls

3. **SMS Configuration:**
   - For Firebase: Enable Phone auth in Firebase Console
   - For Twilio: Add production Twilio credentials
   - Set appropriate SMS rate limits

4. **Email Configuration:**
   - Configure email templates in Firebase
   - Set up custom domain for emails
   - Test email deliverability

## Testing Checklist

- [ ] Phone authentication with Firebase
- [ ] Email sign up
- [ ] Email sign in
- [ ] Password reset
- [ ] Authentication method selector
- [ ] Company-specific auth settings
- [ ] SMS usage limits
- [ ] Session persistence
- [ ] Logout functionality
- [ ] Profile completion for new users
- [ ] Error handling and messages
- [ ] Multi-language support (Arabic/English)
- [ ] Provider switching (Firebase/Twilio)