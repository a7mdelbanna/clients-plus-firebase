#!/bin/bash

# Deploy Firestore indexes to fix cash register and other query errors
# Run this script to deploy all required compound indexes

echo "🚀 Deploying Firestore indexes..."
echo "This will fix the cash register closing errors and other query issues."
echo ""

# Check if firebase CLI is installed
if ! command -v firebase &> /dev/null
then
    echo "❌ Firebase CLI not found. Please install it first:"
    echo "npm install -g firebase-tools"
    exit 1
fi

# Deploy indexes
echo "📝 Deploying indexes from firestore.indexes.json..."
firebase deploy --only firestore:indexes

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Indexes deployed successfully!"
    echo ""
    echo "⏰ Note: It may take 5-10 minutes for the indexes to be fully built."
    echo "   You can monitor the progress in the Firebase Console:"
    echo "   https://console.firebase.google.com/project/_/firestore/indexes"
    echo ""
    echo "📌 The following critical indexes were deployed:"
    echo "   • cashMovements: sessionId + timestamp (fixes cash register closing)"
    echo "   • transactions: branchId + date + status (fixes revenue reports)"
    echo "   • sales: branchId + createdAt (fixes sales reports)"
    echo "   • And many more..."
else
    echo ""
    echo "❌ Index deployment failed. Please check your Firebase configuration."
    echo "   Make sure you're logged in: firebase login"
    echo "   And you've selected the correct project: firebase use <project-id>"
fi