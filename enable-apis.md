# Enable Required APIs

Please go to the Google Cloud Console and enable these APIs manually:

1. **Cloud Functions API**
   - https://console.cloud.google.com/apis/library/cloudfunctions.googleapis.com?project=clients-plus-egypt
   - Click "Enable"

2. **Cloud Build API**
   - https://console.cloud.google.com/apis/library/cloudbuild.googleapis.com?project=clients-plus-egypt
   - Click "Enable"

3. **Artifact Registry API**
   - https://console.cloud.google.com/apis/library/artifactregistry.googleapis.com?project=clients-plus-egypt
   - Click "Enable"

4. **Firebase Storage API** (for later)
   - https://console.cloud.google.com/apis/library/firebasestorage.googleapis.com?project=clients-plus-egypt
   - Click "Enable"

Once all APIs are enabled, we can try deploying again.

## Alternative: Deploy from Cloud Shell

If the local deployment continues to fail, you can:

1. Go to https://console.cloud.google.com/home/dashboard?project=clients-plus-egypt
2. Click the Cloud Shell icon (>_) in the top right
3. Clone your repository:
   ```bash
   git clone https://github.com/a7mdelbanna/clients-plus-firebase.git
   cd clients-plus-firebase
   firebase deploy --only functions
   ```