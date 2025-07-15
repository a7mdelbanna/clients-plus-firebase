import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

export const updateUserClaims = functions.https.onCall(async (request) => {
  // Check if requester is authenticated
  if (!request.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Must be authenticated"
    );
  }

  // Check if requester is super admin or company admin
  const isSuperAdmin = request.auth.token.isSuperAdmin === true;
  const isCompanyAdmin = request.auth.token.role === "ADMIN";

  if (!isSuperAdmin && !isCompanyAdmin) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Insufficient permissions"
    );
  }

  const { userId, claims } = request.data;

  if (!userId || !claims) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "userId and claims are required"
    );
  }

  try {
    // If not super admin, verify the user belongs to the same company
    if (!isSuperAdmin) {
      const userDoc = await admin.firestore()
        .collection("users")
        .doc(userId)
        .get();

      if (!userDoc.exists) {
        throw new functions.https.HttpsError(
          "not-found",
          "User not found"
        );
      }

      const userData = userDoc.data();
      if (userData?.companyId !== request.auth.token.companyId) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Cannot update users from other companies"
        );
      }

      // Company admin cannot create another admin or super admin
      if (claims.role === "ADMIN" || claims.role === "SUPER_ADMIN") {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Cannot assign admin roles"
        );
      }
    }

    // Update custom claims
    await admin.auth().setCustomUserClaims(userId, claims);

    // Update user document with new role if provided
    if (claims.role) {
      await admin.firestore()
        .collection("users")
        .doc(userId)
        .update({
          role: claims.role,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      // Also update in company subcollection if companyId exists
      if (claims.companyId) {
        await admin.firestore()
          .collection("companies")
          .doc(claims.companyId)
          .collection("users")
          .doc(userId)
          .update({
            role: claims.role,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
      }
    }

    functions.logger.info("User claims updated", { userId, claims });

    return {
      success: true,
      message: "User claims updated successfully",
    };
  } catch (error: any) {
    functions.logger.error("Error updating user claims", error);
    throw new functions.https.HttpsError(
      "internal",
      error.message || "Failed to update user claims"
    );
  }
});