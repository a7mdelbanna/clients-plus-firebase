# Booking App Services

## Appointment Service

The appointment service provides methods to fetch client appointments in the booking app's "My Appointments" section.

### Key Methods

1. **getClientAppointments(companyId, clientId, maxResults?)**
   - Fetches appointments by client ID (for registered clients)
   - Used when client has a real ID in the system

2. **getClientAppointmentsByPhone(companyId, phoneNumber, maxResults?)**
   - Fetches appointments by phone number
   - Used for mock clients or when client ID is not available

### Fallback Mechanism

Both methods implement a 3-tier fallback system to handle missing Firestore indexes:

1. **Primary Query**: Uses compound indexes for optimal performance
   - `companyId + clientId + date (desc)` 
   - `companyId + clientPhone + date (desc)`

2. **Fallback Query**: Removes ordering if index is missing
   - Queries without `orderBy`
   - Sorts results client-side

3. **Ultimate Fallback**: Fetches all company appointments
   - Queries only by `companyId`
   - Filters by client ID/phone client-side
   - Sorts client-side

This ensures the app works even while indexes are being created.

### Required Firestore Indexes

The following composite indexes are required for optimal performance:

```json
// For client ID queries
{
  "collectionGroup": "appointments",
  "fields": [
    {"fieldPath": "companyId", "order": "ASCENDING"},
    {"fieldPath": "clientId", "order": "ASCENDING"},
    {"fieldPath": "date", "order": "DESCENDING"}
  ]
}

// For phone number queries
{
  "collectionGroup": "appointments",
  "fields": [
    {"fieldPath": "companyId", "order": "ASCENDING"},
    {"fieldPath": "clientPhone", "order": "ASCENDING"},
    {"fieldPath": "date", "order": "DESCENDING"}
  ]
}
```

These indexes have been added to `firestore.indexes.json` and deployed.