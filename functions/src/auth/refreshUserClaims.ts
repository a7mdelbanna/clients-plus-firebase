import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

export const refreshUserClaims = functions.https.onCall(async (request) => {
  // Check if requester is authenticated
  if (!request.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Must be authenticated"
    );
  }

  const userId = request.auth.uid;

  try {
    // Get user document
    const userDoc = await admin.firestore()
      .collection("users")
      .doc(userId)
      .get();

    if (!userDoc.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "User document not found"
      );
    }

    const userData = userDoc.data();
    const companyId = userData?.companyId;

    if (!companyId) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "User has no company associated"
      );
    }

    // Get company document to verify ownership
    const companyDoc = await admin.firestore()
      .collection("companies")
      .doc(companyId)
      .get();

    if (!companyDoc.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "Company not found"
      );
    }

    const companyData = companyDoc.data();
    
    // Check if user is the owner
    if (companyData?.ownerId !== userId) {
      // If not owner, check if they're in the members
      const members = companyData?.members || {};
      if (!members[userId]) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "User is not a member of this company"
        );
      }
    }

    // Prepare claims
    const claims = {
      companyId: companyId,
      role: userData?.role || (companyData?.ownerId === userId ? 'ADMIN' : 'USER'),
      setupCompleted: companyData?.setupCompleted || false,
    };

    // Update custom claims
    await admin.auth().setCustomUserClaims(userId, claims);

    functions.logger.info("User claims refreshed", { userId, claims });

    return {
      success: true,
      message: "User claims refreshed successfully",
      claims: claims
    };
  } catch (error: any) {
    functions.logger.error("Error refreshing user claims", error);
    throw new functions.https.HttpsError(
      "internal",
      error.message || "Failed to refresh user claims"
    );
  }
});