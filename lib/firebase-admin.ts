import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import fs from "node:fs";
import path from "node:path";

const serviceAccountPath = path.join(process.cwd(), "firebase-admin-service-account.json");

function loadServiceAccount() {
  // Vercel: set FIREBASE_SERVICE_ACCOUNT_JSON as one JSON environment variable.
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  }

  // Local development: keep the credential file outside Git.
  if (fs.existsSync(serviceAccountPath)) {
    return JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
  }

  throw new Error("Missing Firebase Admin credentials. Set FIREBASE_SERVICE_ACCOUNT_JSON.");
}

if (!getApps().length) {
  initializeApp({ 
    credential: cert(loadServiceAccount()),
    storageBucket: "vivubike-86b86.firebasestorage.app"
  });
}

export const firebaseAdminAuth = getAuth();
export const firebaseAdminDb = getFirestore();
export const firebaseAdminStorage = getStorage();
