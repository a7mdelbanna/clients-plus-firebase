import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { Company } from "../types";

interface RegisterCompanyData {
  companyName: string;
  adminEmail: string;
  adminPassword: string;
  adminName: string;
  country?: string;
  phone?: string;
}

export const registerCompany = functions.https.onCall(async (request) => {
  const { companyName, adminEmail, adminPassword, adminName, country = "EG", phone } = request.data as RegisterCompanyData;

  // Validate input
  if (!companyName || !adminEmail || !adminPassword || !adminName) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "All fields are required"
    );
  }

  const db = admin.firestore();
  const batch = db.batch();

  try {
    // Create company document
    const companyRef = db.collection("companies").doc();
    const companyId = companyRef.id;

    const companyData: Company = {
      id: companyId,
      name: companyName,
      country,
      currency: country === "EG" ? "EGP" : "USD",
      createdAt: admin.firestore.FieldValue.serverTimestamp() as any,
      active: true,
      subscription: {
        plan: "TRIAL",
        status: "ACTIVE",
        startDate: admin.firestore.FieldValue.serverTimestamp() as any,
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days trial
      },
      settings: {
        language: "ar",
        timezone: "Africa/Cairo",
        workingHours: {
          sunday: { open: "09:00", close: "21:00", isOpen: true },
          monday: { open: "09:00", close: "21:00", isOpen: true },
          tuesday: { open: "09:00", close: "21:00", isOpen: true },
          wednesday: { open: "09:00", close: "21:00", isOpen: true },
          thursday: { open: "09:00", close: "21:00", isOpen: true },
          friday: { open: "09:00", close: "21:00", isOpen: false },
          saturday: { open: "09:00", close: "21:00", isOpen: true },
        },
      },
    };

    batch.set(companyRef, companyData);

    // Create admin user
    const userRecord = await admin.auth().createUser({
      email: adminEmail,
      password: adminPassword,
      displayName: adminName,
      phoneNumber: phone,
    });

    // Set custom claims
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      companyId,
      role: "ADMIN",
      permissions: ["manage_all"],
    });

    // Create user document in company subcollection
    const userRef = companyRef.collection("users").doc(userRecord.uid);
    batch.set(userRef, {
      id: userRecord.uid,
      email: adminEmail,
      name: adminName,
      role: "ADMIN",
      active: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      phone,
      permissions: ["manage_all"],
    });

    // Also create in global users collection for easy access
    const globalUserRef = db.collection("users").doc(userRecord.uid);
    batch.set(globalUserRef, {
      id: userRecord.uid,
      email: adminEmail,
      name: adminName,
      role: "ADMIN",
      companyId,
      active: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      phone,
    });

    // Create default location
    const locationRef = companyRef.collection("locations").doc();
    batch.set(locationRef, {
      id: locationRef.id,
      name: "الفرع الرئيسي",
      address: "",
      phone: phone || "",
      active: true,
      isMain: true,
      workingHours: companyData.settings.workingHours,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Commit all changes
    await batch.commit();

    functions.logger.info("Company registered successfully", { companyName, companyId });

    return {
      success: true,
      companyId,
      userId: userRecord.uid,
      message: "Company registered successfully",
    };
  } catch (error: any) {
    functions.logger.error("Error registering company", error);
    
    // Clean up if user was created but batch failed
    if (error.userRecord) {
      await admin.auth().deleteUser(error.userRecord.uid);
    }

    throw new functions.https.HttpsError(
      "internal",
      error.message || "Failed to register company"
    );
  }
});