# Debug Location Settings for WhatsApp

## The Issues:
1. Business name showing "Our Business" instead of "نادي الرجال السري"
2. No Google Maps link in the message
3. Business phone not showing

## Quick Debug in Browser Console:

```javascript
// Check your location settings
const { db } = await import('/src/config/firebase.js');
const { doc, getDoc } = await import('firebase/firestore');
const { locationService } = await import('/src/services/location.service.js');

// Your company ID
const companyId = 'au2wTbq7XDNcRGTtTkNm';
const branchId = 'main';

// Get location settings
const settings = await locationService.getLocationSettings(companyId, branchId);
console.log('Location Settings:', settings);

// Check specific fields
console.log('Business Name:', settings?.basicSettings?.locationName);
console.log('Map Coordinates:', settings?.map?.coordinates);
console.log('Phone Numbers:', settings?.contactDetails?.phoneNumbers);
```

## Check Company Data:

```javascript
// Check company data
const { companyService } = await import('/src/services/company.service.js');
const company = await companyService.getCompany(companyId);
console.log('Company Data:', company);
console.log('Company Business Name:', company?.businessName);
```

## To Fix:

1. **Update Location Settings**:
   - Go to Settings → Location Settings
   - Make sure you've saved:
     - Business name in Basic Settings
     - Map location in Map tab
     - Phone numbers in Contact Details

2. **Check Document ID**:
   The location settings might be saved with a different document ID.
   Check in Firebase Console:
   - Go to `locationSettings` collection
   - Look for documents with your company ID

## Console Logs to Check:

When creating an appointment, look for:
- `Getting location settings for branch: main`
- `Location settings loaded: {...}`
- `Company data: {...}`
- `Google Maps link created: ...`

If location settings show `null` or `undefined`, the document might not exist or have a different ID.