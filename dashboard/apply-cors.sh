#!/bin/bash

# Apply CORS configuration to Firebase Storage bucket
echo "Applying CORS configuration to Firebase Storage..."

# Make sure you have gcloud CLI installed and authenticated
# Install: https://cloud.google.com/sdk/docs/install

gsutil cors set cors.json gs://clients-plus-egypt.appspot.com

echo "CORS configuration applied successfully!"
echo "Please restart your development server for changes to take effect."