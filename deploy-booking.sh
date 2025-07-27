#!/bin/bash

# Deploy booking app to Firebase Hosting

echo "Building booking app..."
cd booking-app
npx vite build

echo "Copying booking app to public directory..."
cd ..
rm -rf public-booking
mkdir -p public-booking
cp -r booking-app/dist/* public-booking/

echo "Deploying to Firebase Hosting..."
firebase deploy --only hosting

echo "Booking app deployed successfully!"