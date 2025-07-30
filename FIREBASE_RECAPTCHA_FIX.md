# Firebase reCAPTCHA "MALFORMED" Error Fix

## Issue
Test numbers work but real phone numbers fail with "Recaptcha verification failed - MALFORMED (auth/captcha-check-failed)"

## Solution

### 1. Add localhost ports to Authorized Domains

In Firebase Console:
1. Go to **Authentication** → **Settings**
2. Under **Authorized domains**, add:
   - `localhost:5174`
   - `localhost:5175`
   - Any other ports your app uses

### 2. Check Browser Extensions

Some ad blockers or privacy extensions can interfere with reCAPTCHA:
- Try in incognito mode
- Temporarily disable extensions
- Use a different browser

### 3. Clear Browser Data

Clear cookies and site data for:
- `localhost`
- `firebaseapp.com`
- `google.com`

### 4. Alternative: Use Normal reCAPTCHA

If invisible reCAPTCHA continues to fail, you can switch to normal reCAPTCHA:

```javascript
// In FirebaseAuthContext.tsx
const verifier = new RecaptchaVerifier(auth, containerId, {
  size: 'normal', // Change from 'invisible' to 'normal'
  callback: (response) => {
    console.log('reCAPTCHA solved');
  }
});
```

### 5. Production Setup

For production:
1. Add your production domain to authorized domains
2. Ensure SSL certificate is valid
3. Configure proper CORS headers
4. Use a custom reCAPTCHA site key if needed

## Debugging Tips

1. Check browser console for:
   - CORS errors
   - CSP (Content Security Policy) errors
   - Network errors

2. Verify in Network tab:
   - reCAPTCHA scripts are loading
   - No 403/404 errors

3. Test with:
   - Different phone numbers
   - Different browsers
   - VPN disabled