import { App, cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import fs from "fs";
import path from "path";

function initAdminApp(): App {
  if (getApps().length) {
    return getApp();
  }

  let serviceAccount: any = null;

  // 1️⃣ Ưu tiên đọc trực tiếp từ file firebase-admin-service-account.json ở thư mục gốc dự án
  try {
    const serviceAccountPath = path.join(process.cwd(), "firebase-admin-service-account.json");
    if (fs.existsSync(serviceAccountPath)) {
      const fileData = fs.readFileSync(serviceAccountPath, "utf8");
      serviceAccount = JSON.parse(fileData);
    }
  } catch (err) {
    console.warn("[firebase-admin] Không thể đọc file firebase-admin-service-account.json:", err);
  }

  // 2️⃣ Dự phòng: Đọc từ biến môi trường FIREBASE_SERVICE_ACCOUNT_JSON
  if (!serviceAccount && process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } catch (err) {
      console.warn("[firebase-admin] Biến môi trường FIREBASE_SERVICE_ACCOUNT_JSON không hợp lệ:", err);
    }
  }

  if (!serviceAccount) {
    throw new Error(
      "[firebase-admin] Không tìm thấy thông tin cấu hình hợp lệ.\n" +
      "Vui lòng đặt file firebase-admin-service-account.json tại thư mục gốc dự án."
    );
  }

  const storageBucket =
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    "vivubike-86b86.firebasestorage.app";

  return initializeApp({
    credential: cert(serviceAccount),
    storageBucket,
  });
}

// Khởi tạo app
const adminApp = initAdminApp();

// Exports theo chuẩn mới và tương thích với toàn bộ project
export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
export const firebaseAdminAuth = adminAuth;
export const firebaseAdminDb = adminDb;
export const firebaseAdminStorage = getStorage(adminApp);

const admin = {
  app: () => adminApp,
  auth: () => adminAuth,
  firestore: () => adminDb,
  storage: () => firebaseAdminStorage,
  credential: { cert },
};

export default admin;
