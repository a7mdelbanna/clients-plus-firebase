# Testing Firebase Functions

## 1. Create Super Admin

Use this curl command or Postman:

```bash
curl -X POST \
  https://us-central1-clients-plus-egypt.cloudfunctions.net/setupSuperAdmin \
  -H 'Content-Type: application/json' \
  -d '{
    "data": {
      "email": "super@clientsplus.com",
      "password": "SuperAdmin123!",
      "name": "Super Admin"
    }
  }'
```

Or using JavaScript in browser console:

```javascript
fetch('https://us-central1-clients-plus-egypt.cloudfunctions.net/setupSuperAdmin', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    data: {
      email: 'super@clientsplus.com',
      password: 'SuperAdmin123!',
      name: 'Super Admin'
    }
  })
})
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.error('Error:', error));
```

## 2. Register a Company

After creating super admin:

```bash
curl -X POST \
  https://us-central1-clients-plus-egypt.cloudfunctions.net/registerCompany \
  -H 'Content-Type: application/json' \
  -d '{
    "data": {
      "companyName": "صالون الجمال",
      "adminEmail": "admin@salon.com",
      "adminPassword": "Admin123!",
      "adminName": "أحمد محمد",
      "country": "EG",
      "phone": "+201234567890"
    }
  }'
```

## 3. Check Firestore

After running these commands, check:
1. https://console.firebase.google.com/project/clients-plus-egypt/firestore
2. Look for:
   - `superAdmins` collection
   - `companies` collection
   - `users` collection

## Expected Responses

### Success:
```json
{
  "result": {
    "success": true,
    "uid": "user-id-here",
    "message": "Super admin created successfully"
  }
}
```

### Error (if already exists):
```json
{
  "error": {
    "message": "Super admin already exists",
    "status": "ALREADY_EXISTS"
  }
}
```