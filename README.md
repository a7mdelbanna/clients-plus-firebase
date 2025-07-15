# Clients+ Firebase Project

A comprehensive business management system for service-based businesses (salons, barbershops, spas, clinics) built with Firebase, targeting the Egyptian market.

## 🏗️ Project Structure

```
clients-plus-firebase/
├── dashboard/        # React Dashboard (Web Admin Panel)
├── mobile-app/       # Flutter Mobile App
├── functions/        # Firebase Cloud Functions
└── firebase-docs/    # Documentation
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Firebase CLI
- Flutter SDK 3.x
- Git

### Setup Instructions

1. **Firebase Setup**
   ```bash
   firebase login
   firebase init
   ```

2. **Functions Setup**
   ```bash
   cd functions
   npm install
   ```

3. **Dashboard Setup**
   ```bash
   cd dashboard
   npm install
   npm start
   ```

4. **Mobile App Setup**
   ```bash
   cd mobile-app
   flutter pub get
   flutter run
   ```

## 📋 Features

- ✅ Multi-tenant architecture
- ✅ Arabic-first interface with RTL support
- ✅ Appointment booking system
- ✅ Staff and client management
- ✅ Egyptian payment integration (Paymob, Fawry)
- ✅ Real-time notifications
- ✅ Offline support
- ✅ Analytics and reporting

## 🌍 Localization

Primary language: Arabic (ar)
Secondary language: English (en)
Target market: Egypt (EG)

## 📱 Platforms

- Web Dashboard (React + TypeScript)
- Mobile App (Flutter - iOS & Android)
- Backend (Firebase Cloud Functions)

## 🔒 Security

- Role-based access control (RBAC)
- Firebase Security Rules
- Custom authentication claims
- Data encryption

## 📊 Development Phases

### Phase 1: Foundation (Current)
- Firebase project setup
- Authentication system
- Core database structure

### Phase 2: Core Business Logic
- Company management
- User management
- Client management

### Phase 3: Service Operations
- Services & categories
- Basic appointment system
- Location management

See [FEATURES_PRIORITY.md](../firebase-docs/FEATURES_PRIORITY.md) for complete roadmap.

## 🤝 Contributing

1. Create feature branch
2. Commit changes
3. Push to branch
4. Create Pull Request

## 📄 License

Private project - All rights reserved