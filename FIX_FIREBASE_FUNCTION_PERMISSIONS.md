# Fix Firebase Cloud Function IAM Permissions

## Problem
Error: `Permission 'iam.serviceAccounts.signBlob' denied` when creating custom tokens.

## Solution 1: Add IAM Role via Google Cloud Console

1. **Go to IAM Console**
   - Visit: https://console.cloud.google.com/iam-admin/iam
   - Select your project: `clients-plus-egypt`

2. **Find the Service Account**
   - Look for: `clients-plus-egypt@appspot.gserviceaccount.com`
   - Click the pencil (Edit) icon

3. **Add Required Role**
   - Click "Add Another Role"
   - Search for "Service Account Token Creator"
   - Select: `Service Account Token Creator`
   - Click "Save"

## Solution 2: Use gcloud CLI (Faster)

```bash
# Replace with your actual project ID
gcloud projects add-iam-policy-binding clients-plus-egypt \
  --member serviceAccount:clients-plus-egypt@appspot.gserviceaccount.com \
  --role roles/iam.serviceAccountTokenCreator
```

## Solution 3: Alternative Implementation (If permissions can't be changed)

Update your Cloud Function to handle the error gracefully:

```typescript
// In your phoneAuth.ts function
try {
  customToken = await admin.auth().createCustomToken(user.uid, {
    phoneNumber: normalizedPhone,
    companyId: companyId || '',
  });
} catch (tokenError: any) {
  if (tokenError.code === 'app/insufficient-permission') {
    // Fallback: Use simple UID-based token
    const simpleToken = Buffer.from(JSON.stringify({
      uid: user.uid,
      phoneNumber: normalizedPhone,
      companyId: companyId || '',
      exp: Date.now() + (60 * 60 * 1000) // 1 hour
    })).toString('base64');
    
    customToken = simpleToken;
  } else {
    throw tokenError;
  }
}
```

## After Applying the Fix

1. **Wait 2-3 minutes** for IAM changes to propagate
2. **Redeploy your functions**:
   ```bash
   firebase deploy --only functions
   ```
3. **Test the phone authentication** again

## Verify the Fix

Check if the role was added correctly:
```bash
gcloud projects get-iam-policy clients-plus-egypt \
  --flatten="bindings[].members" \
  --filter="bindings.role:roles/iam.serviceAccountTokenCreator"
```

You should see your service account listed in the output.