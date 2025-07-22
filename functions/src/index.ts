import * as admin from "firebase-admin";

// Initialize Firebase Admin
admin.initializeApp();

// Export function groups
export * from "./auth";
export * from "./users";
export * from "./companies";
export * from "./whatsapp";