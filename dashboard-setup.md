# Dashboard Setup Guide

## 1. Get Firebase Configuration

1. Go to: https://console.firebase.google.com/project/clients-plus-egypt/settings/general
2. Scroll down to "Your apps"
3. Click "</> Web" to add a web app
4. Register app with nickname: "Dashboard"
5. Copy the firebaseConfig object

## 2. Update Firebase Configuration

Replace the config in `dashboard/src/config/firebase.ts` with your actual config:

```typescript
const firebaseConfig = {
  apiKey: "your-actual-api-key",
  authDomain: "clients-plus-egypt.firebaseapp.com",
  projectId: "clients-plus-egypt",
  storageBucket: "clients-plus-egypt.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
};
```

## 3. Install Dependencies

```bash
cd dashboard
npm install firebase react-router-dom
npm install @mui/material @emotion/react @emotion/styled @mui/icons-material
npm install react-hook-form axios dayjs
npm install --save-dev @types/react-router-dom
```

## 4. Project Structure

```
dashboard/
├── src/
│   ├── components/        # Reusable components
│   │   ├── Layout/
│   │   └── common/
│   ├── pages/            # Page components
│   │   ├── auth/
│   │   ├── dashboard/
│   │   └── settings/
│   ├── hooks/            # Custom React hooks
│   ├── services/         # API services
│   ├── utils/            # Utility functions
│   ├── types/            # TypeScript types
│   ├── config/           # Configuration files
│   └── styles/           # Global styles
```

## 5. Run Development Server

```bash
npm run dev
```

The dashboard will be available at http://localhost:5173