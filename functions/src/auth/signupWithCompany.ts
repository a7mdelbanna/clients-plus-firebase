import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

interface SignupWithCompanyData {
  email: string;
  password: string;
  displayName: string;
}

export const signupWithCompany = functions.https.onCall(async (request) => {
  const { email, password, displayName } = request.data as SignupWithCompanyData;

  // Validate input
  if (!email || !password || !displayName) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Email, password, and display name are required"
    );
  }

  if (password.length < 6) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Password must be at least 6 characters"
    );
  }

  const db = admin.firestore();
  const batch = db.batch();
  
  let userRecord: admin.auth.UserRecord | null = null;
  let companyId: string | null = null;

  try {
    // Create the user account
    userRecord = await admin.auth().createUser({
      email,
      password,
      displayName,
      emailVerified: false,
    });

    // Create company document
    const companyRef = db.collection("companies").doc();
    companyId = companyRef.id;

    const companyData = {
      id: companyId,
      name: `شركة ${displayName}`, // Default company name
      ownerId: userRecord.uid,
      ownerName: displayName,
      ownerEmail: email,
      ownerPosition: 'manager',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      active: true,
      setupCompleted: false,
      country: "EG",
      currency: "EGP",
      businessType: "",
      teamSize: "",
      subscription: {
        plan: "TRIAL",
        status: "ACTIVE",
        startDate: admin.firestore.FieldValue.serverTimestamp(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days trial
      },
      settings: {
        language: "ar",
        timezone: "Africa/Cairo",
        dateFormat: "DD/MM/YYYY",
        theme: "primary",
        darkMode: false,
        notifications: {
          email: true,
          push: true,
          sms: false,
        },
      },
      members: {
        [userRecord.uid]: true
      }
    };

    batch.set(companyRef, companyData);

    // Create user document in global users collection
    const globalUserRef = db.collection("users").doc(userRecord.uid);
    batch.set(globalUserRef, {
      id: userRecord.uid,
      email,
      displayName,
      role: "ADMIN",
      companyId,
      active: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      setupCompleted: false,
    });

    // Create user document in company's users subcollection
    const companyUserRef = companyRef.collection("users").doc(userRecord.uid);
    batch.set(companyUserRef, {
      id: userRecord.uid,
      email,
      displayName,
      role: "ADMIN",
      active: true,
      joinedAt: admin.firestore.FieldValue.serverTimestamp(),
      permissions: ["manage_all"],
    });

    // Set custom claims on the user
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      companyId,
      role: "ADMIN",
      setupCompleted: false,
    });

    // Commit all Firestore changes
    await batch.commit();

    functions.logger.info("User signed up with company successfully", { 
      userId: userRecord.uid, 
      companyId,
      email 
    });

    return {
      success: true,
      userId: userRecord.uid,
      companyId,
      message: "تم إنشاء الحساب بنجاح",
    };

  } catch (error: any) {
    functions.logger.error("Error in signupWithCompany", error);
    
    // Clean up if user was created but something else failed
    if (userRecord) {
      try {
        await admin.auth().deleteUser(userRecord.uid);
        functions.logger.info("Cleaned up user after error", { userId: userRecord.uid });
      } catch (deleteError) {
        functions.logger.error("Error deleting user during cleanup", deleteError);
      }
    }

    // Return appropriate error message
    if (error.code === "auth/email-already-exists") {
      throw new functions.https.HttpsError(
        "already-exists",
        "البريد الإلكتروني مستخدم بالفعل"
      );
    } else if (error.code === "auth/invalid-email") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "البريد الإلكتروني غير صالح"
      );
    } else if (error.code === "auth/invalid-password") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "كلمة المرور غير صالحة"
      );
    }

    throw new functions.https.HttpsError(
      "internal",
      error.message || "حدث خطأ في إنشاء الحساب"
    );
  }
});