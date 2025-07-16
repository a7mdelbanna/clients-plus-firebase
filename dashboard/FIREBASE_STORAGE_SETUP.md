# Firebase Storage Setup Instructions

## IMPORTANT: First Time Setup

Before you can upload images, you need to activate Firebase Storage:

1. **Go to Firebase Console**: https://console.firebase.google.com/project/clients-plus-egypt/storage
2. **Click "Get Started"**
3. **Select a location** (Choose the closest to your users)
4. **Click "Done"**

## Fixing CORS Error for Image Uploads

After activating Firebase Storage, follow these steps:

### 1. Install Google Cloud SDK (if not already installed)
```bash
# macOS (using Homebrew)
brew install google-cloud-sdk

# Or download from: https://cloud.google.com/sdk/docs/install
```

### 2. Authenticate with Google Cloud
```bash
gcloud auth login
```

### 3. Set your project
```bash
gcloud config set project clients-plus-egypt
```

### 4. Apply CORS configuration
```bash
# From the dashboard directory
./apply-cors.sh
```

### 5. Deploy Storage Security Rules
```bash
firebase deploy --only storage
```

### 6. Restart your development server
```bash
npm run dev
```

## Alternative Method (Using Firebase Console)

If you prefer using the Firebase Console:

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project (clients-plus-egypt)
3. Go to Storage → Rules
4. Replace the rules with the content from `storage.rules` file
5. Click "Publish"

## Troubleshooting

If you still see CORS errors:

1. **Clear browser cache** and restart the browser
2. **Check the storage bucket name** in Firebase Console → Storage
3. **Verify authentication** - make sure you're logged in
4. **Check browser console** for more specific error messages

## Storage Bucket Configuration

The correct storage bucket URL should be:
- `clients-plus-egypt.appspot.com` (not `clients-plus-egypt.firebasestorage.app`)

This has been updated in the Firebase configuration file.