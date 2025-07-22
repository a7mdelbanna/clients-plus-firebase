# Firestore Indexes Deployment Guide

## Overview
This document outlines the Firestore composite indexes required for the appointment system and related features to function properly.

## Why These Indexes Are Needed

Firestore requires composite indexes for queries that:
- Filter on multiple fields
- Combine filters with sorting
- Use array-contains with other conditions
- Use 'in' or 'not-in' operators with other conditions

Without these indexes, queries will fail with "The query requires an index" errors.

## Newly Added Indexes

### 1. Appointment Resource Availability Check
```json
{
  "collectionGroup": "appointments",
  "fields": [
    { "fieldPath": "companyId", "order": "ASCENDING" },
    { "fieldPath": "resources", "arrayConfig": "CONTAINS" },
    { "fieldPath": "date", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" }
  ]
}
```
**Purpose**: Checks if resources are available for appointments on specific dates

### 2. Resource Service Filtering
```json
{
  "collectionGroup": "resources",
  "fields": [
    { "fieldPath": "companyId", "order": "ASCENDING" },
    { "fieldPath": "services", "arrayConfig": "CONTAINS" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "active", "order": "ASCENDING" }
  ]
}
```
**Purpose**: Finds resources that can be used for specific services

### 3. Staff Position Filtering
```json
{
  "collectionGroup": "staff",
  "fields": [
    { "fieldPath": "companyId", "order": "ASCENDING" },
    { "fieldPath": "positionId", "order": "ASCENDING" },
    { "fieldPath": "active", "order": "ASCENDING" }
  ]
}
```
**Purpose**: Gets staff members by their position

### 4. Staff Service Filtering
```json
{
  "collectionGroup": "staff",
  "fields": [
    { "fieldPath": "companyId", "order": "ASCENDING" },
    { "fieldPath": "services", "arrayConfig": "CONTAINS" },
    { "fieldPath": "active", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" }
  ]
}
```
**Purpose**: Finds staff members who can provide specific services

### 5. Staff Email Lookup
```json
{
  "collectionGroup": "staff",
  "fields": [
    { "fieldPath": "companyId", "order": "ASCENDING" },
    { "fieldPath": "email", "order": "ASCENDING" },
    { "fieldPath": "active", "order": "ASCENDING" }
  ]
}
```
**Purpose**: Checks for existing staff members by email

### 6. Contact Sorting (Subcollection)
```json
{
  "collectionGroup": "contacts",
  "fields": [
    { "fieldPath": "isPrimary", "order": "DESCENDING" },
    { "fieldPath": "name", "order": "ASCENDING" }
  ]
}
```
**Purpose**: Sorts client contacts with primary contacts first

### 7. Project Status Filtering
```json
{
  "collectionGroup": "projects",
  "fields": [
    { "fieldPath": "companyId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" }
  ]
}
```
**Purpose**: Gets active/in-progress projects for dashboard stats

### 8. Projects by Client
```json
{
  "collectionGroup": "projects",
  "fields": [
    { "fieldPath": "clientId", "order": "ASCENDING" },
    { "fieldPath": "companyId", "order": "ASCENDING" }
  ]
}
```
**Purpose**: Gets all projects for a specific client

### 9. Invoice Status Filtering
```json
{
  "collectionGroup": "invoices",
  "fields": [
    { "fieldPath": "clientId", "order": "ASCENDING" },
    { "fieldPath": "companyId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" }
  ]
}
```
**Purpose**: Gets paid invoices for client stats

### 10. Position Name Check
```json
{
  "collectionGroup": "positions",
  "fields": [
    { "fieldPath": "companyId", "order": "ASCENDING" },
    { "fieldPath": "name", "order": "ASCENDING" },
    { "fieldPath": "active", "order": "ASCENDING" }
  ]
}
```
**Purpose**: Checks for duplicate position names

## Deployment Instructions

### Option 1: Deploy via Firebase CLI (Recommended)

1. Make sure you're in the project root directory
2. Run the deployment command:
```bash
firebase deploy --only firestore:indexes
```

3. Monitor the deployment:
   - The CLI will show the progress
   - Index creation can take 5-10 minutes
   - You'll see "✔ Deploy complete!" when finished

### Option 2: Deploy via Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Navigate to Firestore Database → Indexes
4. Click "Create Index" for each index manually
5. Fill in the fields exactly as specified in the JSON

### Option 3: Automatic Index Creation

Firebase can automatically create indexes when queries fail:
1. Run the application in development
2. When a query fails, check the browser console
3. Firebase provides a direct link to create the missing index
4. Click the link and confirm index creation

## Monitoring Index Status

### Via Firebase Console:
1. Go to Firestore Database → Indexes
2. Check the status column:
   - **Building**: Index is being created (5-10 minutes)
   - **Ready**: Index is active and queries will work
   - **Failed**: Index creation failed (check configuration)

### Via Firebase CLI:
```bash
firebase firestore:indexes
```

## Troubleshooting

### Common Issues:

1. **"The query requires an index" error**
   - Check if all indexes from firestore.indexes.json are deployed
   - Wait for index status to be "Ready"
   - Verify the query matches the index definition exactly

2. **Index creation fails**
   - Check Firebase quota limits
   - Verify field names match exactly (case-sensitive)
   - Ensure arrayConfig is only used for array fields

3. **Slow queries after index creation**
   - Indexes need time to warm up
   - First queries may be slower
   - Performance improves with usage

### Best Practices:

1. **Always deploy indexes before deploying code** that uses new queries
2. **Test queries locally first** to catch missing indexes early
3. **Keep firestore.indexes.json in version control**
4. **Document why each index exists** (as done above)
5. **Remove unused indexes** to stay within quotas

## Index Limits

- **Maximum composite indexes**: 200 per database
- **Maximum single-field indexes**: 200 per database
- **Maximum fields per composite index**: 100
- **Array fields**: Can only use one array field per composite index

## Current Index Count

- **Composite indexes**: 42 (including new ones)
- **Field overrides**: 5
- **Remaining capacity**: ~158 composite indexes

## Next Steps

1. Deploy these indexes using Firebase CLI
2. Wait for all indexes to reach "Ready" status
3. Test appointment booking with resource filtering
4. Monitor query performance in production