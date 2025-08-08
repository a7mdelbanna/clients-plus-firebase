# Firebase Phone Authentication Setup Guide

## Enable Phone Authentication in Firebase Console

1. **Go to Firebase Console**
   - Visit https://console.firebase.google.com/
   - Select your project: `clients-plus-egypt`

2. **Enable Phone Authentication**
   - In the left sidebar, click **Authentication**
   - Click on the **Sign-in method** tab
   - Find **Phone** in the list of providers
   - Click on it and toggle **Enable**
   - Click **Save**

3. **Configure reCAPTCHA Settings**
   - While in Phone authentication settings, scroll down
   - Under **Authorized domains**, make sure your domains are listed:
     - `localhost` (for development)
     - Your production domain(s)
   - Add any missing domains

4. **Check API Key Restrictions**
   - Go to Google Cloud Console: https://console.cloud.google.com/
   - Select your project
   - Go to **APIs & Services** → **Credentials**
   - Find your Web API key (should match the one in your Firebase config)
   - Click on it to edit
   - Under **Application restrictions**:
     - For development: Set to **None** temporarily
     - For production: Use **HTTP referrers** and add your domains
   - Under **API restrictions**:
     - Make sure **Identity Toolkit API** is allowed
   - Save changes

5. **Enable Required APIs**
   Make sure these APIs are enabled in Google Cloud Console:
   - Identity Toolkit API
   - Firebase Authentication API

## Test Phone Authentication

After enabling phone authentication:

1. Refresh your booking app
2. Try to login with a phone number
3. You should receive an SMS with a verification code

## Troubleshooting

### "auth/api-key-not-valid" Error
- Make sure Phone authentication is enabled in Firebase Console
- Check API key restrictions in Google Cloud Console
- Verify that Identity Toolkit API is enabled

### reCAPTCHA Issues
- Make sure your domain is in the authorized domains list
- For localhost development, use `localhost` not `127.0.0.1`
- Clear browser cache and cookies

### No SMS Received
- Check Firebase Console → Authentication → Usage tab for SMS quota
- Verify the phone number format includes country code
- Try with a different phone number