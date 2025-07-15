import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

export const setupSuperAdmin = functions.https.onCall(async (request) => {
  const { email, password, name } = request.data;

  // Validate input
  if (!email || !password || !name) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Email, password and name are required"
    );
  }

  // Check if any super admin already exists
  const superAdminsSnapshot = await admin.firestore()
    .collection("superAdmins")
    .limit(1)
    .get();

  if (!superAdminsSnapshot.empty) {
    throw new functions.https.HttpsError(
      "already-exists",
      "Super admin already exists"
    );
  }

  try {
    // Create super admin user
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: name,
      emailVerified: true,
    });

    // Set custom claims
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      role: "SUPER_ADMIN",
      isSuperAdmin: true,
      companyId: null,
      permissions: ["*"],
    });

    // Create super admin document
    await admin.firestore().collection("superAdmins").doc(userRecord.uid).set({
      id: userRecord.uid,
      email,
      name,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      active: true,
    });

    // Also create a user document for consistency
    await admin.firestore().collection("users").doc(userRecord.uid).set({
      id: userRecord.uid,
      email,
      name,
      role: "SUPER_ADMIN",
      active: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    functions.logger.info("Super admin created successfully", { email });

    return {
      success: true,
      uid: userRecord.uid,
      message: "Super admin created successfully",
    };
  } catch (error: any) {
    functions.logger.error("Error creating super admin", error);
    throw new functions.https.HttpsError(
      "internal",
      error.message || "Failed to create super admin"
    );
  }
});