/**
 * Firebase Admin SDK — lazy initialisation.
 *
 * The app is initialised on the FIRST call to getAdminApp() rather than at
 * module-load time.  This prevents Next.js from crashing during the module
 * import phase (which would return an HTML 500 page instead of a JSON error)
 * when credentials are missing or malformed.
 */

import { App, cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const APP_NAME = "vivubike-admin";

// ── Credential loader ──────────────────────────────────────────────────────

function loadCredential(): object {
  // 1️⃣  Single-JSON env var (Vercel / CI / .env.local)
  const envJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (envJson) {
    try {
      return JSON.parse(envJson);
    } catch {
      throw new Error(
        "[firebase-admin] FIREBASE_SERVICE_ACCOUNT_JSON contains invalid JSON."
      );
    }
  }

  // 2️⃣  Local file (gitignored, for local development)
  try {
    // Dynamic require so the module doesn't crash at parse-time on Vercel
    // where the file never exists.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs   = require("node:fs")  as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    const filePath = path.join(process.cwd(), "firebase-admin-service-account.json");
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
  } catch {
    // ignore — will fall through to the error below
  }

  throw new Error(
    "[firebase-admin] No credentials found.\n" +
    "  LOCAL  → place firebase-admin-service-account.json in the project root.\n" +
    "  VERCEL → set the FIREBASE_SERVICE_ACCOUNT_JSON environment variable.\n" +
    "  Download: Firebase Console → Project Settings → Service Accounts → Generate new private key."
  );
}

// ── Lazy singleton ─────────────────────────────────────────────────────────

function getAdminApp(): App {
  // Return existing instance (safe across Next.js hot-reloads)
  const existing = getApps().find((a) => a.name === APP_NAME);
  if (existing) return existing;

  const storageBucket =
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    "vivubike-86b86.firebasestorage.app";

  return initializeApp(
    { credential: cert(loadCredential() as any), storageBucket },
    APP_NAME
  );
}

// ── Lazy-exported helpers ──────────────────────────────────────────────────
// Each property getter calls getAdminApp() only when first accessed.

export const firebaseAdminAuth = new Proxy({} as ReturnType<typeof getAuth>, {
  get(_, prop) {
    return (getAuth(getAdminApp()) as any)[prop];
  },
});

export const firebaseAdminDb = new Proxy({} as ReturnType<typeof getFirestore>, {
  get(_, prop) {
    return (getFirestore(getAdminApp()) as any)[prop];
  },
});

export const firebaseAdminStorage = new Proxy(
  {} as ReturnType<typeof getStorage>,
  {
    get(_, prop) {
      return (getStorage(getAdminApp()) as any)[prop];
    },
  }
);
