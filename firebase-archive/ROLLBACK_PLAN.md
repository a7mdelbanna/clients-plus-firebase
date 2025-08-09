# Firebase Migration Rollback Plan

**Created:** 2025-01-09  
**Purpose:** Safe rollback procedures for Firebase to Express API migration  
**System:** Clients+ Dashboard & Booking Application

## Emergency Rollback (Immediate)

### 1. Quick Switch to Firebase Mode
If API mode is causing issues, immediately switch back to Firebase:

```bash
# Dashboard
cd dashboard/
echo "VITE_USE_API=false" > .env.rollback
echo "REACT_APP_FORCE_EXPRESS_MODE=false" >> .env.rollback
cp .env.rollback .env

# Booking App
cd booking-app/
echo "VITE_USE_API=false" > .env.rollback
echo "REACT_APP_FORCE_EXPRESS_MODE=false" >> .env.rollback
cp .env.rollback .env

# Restart applications
npm run dev
```

### 2. Verify Firebase Services
```bash
# Check Firebase connectivity
firebase login
firebase projects:list
firebase use --add  # Select your project
```

## Partial Rollback (Component-Specific)

### Service-Level Rollback
If specific services are failing in API mode:

```bash
# Dashboard - Rollback specific services
REACT_APP_USE_EXPRESS_SERVICES=false     # Revert services to Firebase
REACT_APP_USE_EXPRESS_STAFF=false        # Revert staff to Firebase
REACT_APP_USE_EXPRESS_BRANCHES=false     # Revert branches to Firebase
# etc.

# Booking App - Rollback specific services
REACT_APP_USE_EXPRESS_APPOINTMENTS=false # Revert appointments to Firebase
REACT_APP_USE_EXPRESS_CLIENTS=false      # Revert clients to Firebase
```

### Component-Level Rollback
For individual components with issues:

```typescript
// In component file, force Firebase mode
const useFirebaseForThisComponent = true;
if (useFirebaseForThisComponent) {
  // Use Firebase service directly
  const { originalService } = await import('../services/original.service');
  return originalService.method();
}
```

## Full System Rollback

### 1. Restore Firebase Functions
```bash
cd /path/to/project/root
rm -rf functions
cp -r firebase-archive/functions-backup/functions ./
```

### 2. Restore Configuration Files
```bash
# Root level
cp firebase-archive/firebase.json .
cp firebase-archive/.firebaserc .
cp firebase-archive/firestore.rules .
cp firebase-archive/firestore.indexes.json .
cp firebase-archive/storage.rules .

# Dashboard level
cd dashboard/
cp ../firebase-archive/firebase.json .
cp ../firebase-archive/.firebaserc .
cp ../firebase-archive/firestore.rules .
cp ../firebase-archive/firestore.indexes.json .
cp ../firebase-archive/storage.rules .
```

### 3. Restore Package Dependencies
```bash
# Dashboard
cd dashboard/
cp package.json.backup package.json
npm install

# Booking App
cd booking-app/
cp package.json.backup package.json
npm install

# Functions
cd functions/
npm install
```

### 4. Redeploy Firebase Functions (if needed)
```bash
cd functions/
npm run build
firebase deploy --only functions
```

## Verification Steps After Rollback

### 1. Application Health Check
```bash
# Start all services
cd dashboard/ && npm run dev &
cd booking-app/ && npm run dev &
cd functions/ && npm run serve &
```

### 2. Feature Testing Checklist
- [ ] User authentication works
- [ ] Client management functional
- [ ] Appointment booking works
- [ ] Real-time updates working
- [ ] File uploads successful
- [ ] Payment processing functional
- [ ] WhatsApp notifications working

### 3. Firebase Services Status
```bash
# Check Firestore
firebase firestore:indexes:list

# Check Functions
firebase functions:list

# Check Auth
firebase auth:export --format=csv users.csv
```

## Data Consistency Check

### 1. Compare Data Between Systems
```javascript
// Run this script to compare Firebase vs API data
const compareData = async () => {
  const firebaseData = await getFirebaseClients();
  const apiData = await getAPIClients();
  
  const differences = findDifferences(firebaseData, apiData);
  console.log('Data differences:', differences);
};
```

### 2. Reconcile Data Differences
```bash
# Export from Express DB
pg_dump clients_plus > api_backup.sql

# Export from Firebase
firebase firestore:export firebase_backup/

# Compare and reconcile
node scripts/data-reconciliation.js
```

## Rollback Testing

### 1. Pre-Rollback Testing
Always test rollback in development first:

```bash
# Create test environment
cp .env .env.backup
cp .env.test .env

# Test rollback procedures
# Verify all functionality
# Document any issues
```

### 2. Post-Rollback Monitoring
Monitor for 24-48 hours after rollback:

- Application performance metrics
- Error rates and logs
- User feedback and reports
- Database integrity checks

## Prevention for Future Migrations

### 1. Staged Rollout
- Development environment first
- Staging environment testing
- Limited production users
- Full production rollout

### 2. Monitoring and Alerts
```bash
# Set up monitoring
npm install @sentry/react
npm install @sentry/node

# Configure alerts for:
# - High error rates
# - API response time increases
# - Database connection issues
# - Authentication failures
```

### 3. Feature Flag Management
```javascript
// Implement dynamic feature flags
const featureFlags = {
  useApiForService: (serviceName, userId) => {
    // Check user percentage rollout
    // Check service stability
    // Return boolean decision
  }
};
```

## Emergency Contacts and Resources

### Internal Resources
- **Firebase Project Console**: https://console.firebase.google.com/
- **Express API Health Check**: http://localhost:3000/api/health
- **Application Logs**: `/logs/` directory

### External Resources
- **Firebase Status Page**: https://status.firebase.google.com/
- **Firebase Support**: https://firebase.google.com/support/
- **Documentation**: Stored in `/docs/` directory

## Rollback Decision Matrix

| Issue Type | Severity | Action | Timeline |
|------------|----------|--------|----------|
| API Errors > 5% | Critical | Emergency rollback | Immediate |
| Performance degradation > 50% | High | Service-specific rollback | Within 15 minutes |
| Authentication issues | Critical | Full rollback | Immediate |
| Data inconsistency | High | Stop migration, investigate | Within 30 minutes |
| User complaints | Medium | Monitor, prepare rollback | Within 1 hour |

## Post-Rollback Steps

1. **Document the issue** that caused rollback
2. **Analyze root cause** in development environment
3. **Fix the issue** before attempting migration again
4. **Update migration plan** based on lessons learned
5. **Schedule next migration attempt** after thorough testing

## Archive Integrity Verification

Before relying on this rollback plan, verify archive integrity:

```bash
# Check archive completeness
ls -la firebase-archive/
du -sh firebase-archive/

# Verify backups can be restored
cp firebase-archive/functions-backup/functions /tmp/test-restore
cd /tmp/test-restore && npm install && npm run build
```

---

**Remember**: This rollback plan should be tested regularly in development environments to ensure it works when needed in production.