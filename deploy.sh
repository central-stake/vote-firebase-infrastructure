#!/bin/bash

# Navigate to functions directory and deploy Cloud Functions
echo "Deploying Firebase Cloud Functions..."
cd functions || exit
npm install
firebase deploy --only functions
cd ..

# Deploy Firestore security rules
echo "Deploying Firestore Rules..."
firebase deploy --only firestore:rules

# Deploy Realtime Database security rules
echo "Deploying Realtime Database Rules..."
firebase deploy --only database:rules

echo "Deployment complete."
