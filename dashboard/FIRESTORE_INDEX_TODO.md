# Firestore Index TODO

## Branches Index (Needed for Optimization)

Currently, we're using a client-side filtering workaround in `branch.service.ts` to avoid index errors. Once you have access to the Firebase Console, please create this index:

### Index Details:
- **Collection Group**: branches
- **Query Scope**: COLLECTION  
- **Fields**:
  1. active (ASCENDING)
  2. createdAt (ASCENDING)

### How to Create:
1. Go to Firebase Console > Firestore Database > Indexes
2. Click "Create Index"
3. Enter the details above
4. Click "Create"

### Or use this direct link (from the error message):
```
https://console.firebase.google.com/v1/r/project/clients-plus-egypt/firestore/indexes?create_composite=ClNwcm9qZWN0cy9jbGllbnRzLXBsdXMtZWd5cHQvZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL2JyYW5jaGVzL2luZGV4ZXMvXxABGgoKBmFjdGl2ZRABGg0KCWNyZWF0ZWRBdBABGgwKCF9fbmFtZV9fEAE
```

### After Creating the Index:
Once the index is created, you can revert the workaround in `branch.service.ts` by changing the `getBranches` method back to use proper Firestore queries.