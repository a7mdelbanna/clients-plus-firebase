#!/bin/bash
# Cloud Shell Deployment Script for Clients+ Firebase Functions

echo "🚀 Starting deployment process..."

# Clone the repository if not already cloned
if [ ! -d "clients-plus-firebase" ]; then
  echo "📥 Cloning repository..."
  git clone https://github.com/a7mdelbanna/clients-plus-firebase.git
fi

cd clients-plus-firebase

# Install dependencies
echo "📦 Installing dependencies..."
cd functions
npm install

# Build TypeScript
echo "🔨 Building TypeScript..."
npm run build

# Deploy functions
echo "☁️ Deploying Cloud Functions..."
cd ..
firebase use clients-plus-egypt
firebase deploy --only functions

echo "✅ Deployment complete!"
echo "📝 Function URLs will be displayed above"