import { NextRequest, NextResponse } from "next/server";
import { firebaseAdminDb } from "../../../lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

// Required: force Node.js runtime so firebase-admin, Buffer, fs all work correctly.
export const runtime = "nodejs";

// ── Helpers ────────────────────────────────────────────────────────────────

function jsonErr(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function isValidBase64Image(v: unknown): boolean {
  return typeof v === "string" && v.startsWith("data:image/") && v.includes(";base64,");
}

// ── POST handler ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // ── 1. Parse JSON body ────────────────────────────────────────────────
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch (e: any) {
      console.error("[guest-booking] Failed to parse JSON body:", e);
      return jsonErr(`Cannot parse request body: ${e?.message ?? String(e)}`, 400);
    }

    const fullName   = safeStr(body.fullName);
    const phone      = safeStr(body.phone);
    const email      = safeStr(body.email);
    const startDate  = safeStr(body.startDate);
    const endDate    = safeStr(body.endDate);
    const locationId = safeStr(body.locationId);
    const note       = safeStr(body.note);
    const vehicleId  = safeStr(body.vehicleId);
    const bikeType   = safeStr(body.bikeType);

    // ── 2. Validate required text fields ──────────────────────────────────
    const missing: string[] = [];
    if (!fullName)  missing.push("fullName");
    if (!phone)     missing.push("phone");
    if (!startDate) missing.push("startDate");
    if (!endDate)   missing.push("endDate");
    if (missing.length) {
      return jsonErr(`Thiếu các trường bắt buộc: ${missing.join(", ")}`, 400);
    }

    const days = Math.ceil(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000
    );
    if (days < 1) {
      return jsonErr("Ngày trả phải sau ngày nhận ít nhất 1 ngày.", 400);
    }

    // ── 3. Validate base64 document images ────────────────────────────────
    const idCardFrontUrl        = body.idCardFront;
    const idCardBackUrl         = body.idCardBack;
    const driverLicenseFrontUrl = body.driverLicenseFront;
    const driverLicenseBackUrl  = body.driverLicenseBack;

    const missingDocs: string[] = [];
    if (!isValidBase64Image(idCardFrontUrl))        missingDocs.push("idCardFront");
    if (!isValidBase64Image(idCardBackUrl))         missingDocs.push("idCardBack");
    if (!isValidBase64Image(driverLicenseFrontUrl)) missingDocs.push("driverLicenseFront");
    if (!isValidBase64Image(driverLicenseBackUrl))  missingDocs.push("driverLicenseBack");

    if (missingDocs.length) {
      return jsonErr(
        `Thiếu ảnh giấy tờ: ${missingDocs.join(", ")}. Vui lòng tải đủ 4 ảnh.`,
        400
      );
    }

    // ── 4. Fetch vehicle data (optional — graceful if missing) ────────────
    let vehicleName  = "Xe thuê";
    let vehicleImage = "";
    let vehicleType  = bikeType;
    let dailyPrice   = 0;

    if (vehicleId) {
      try {
        const snap = await firebaseAdminDb.collection("vehicles").doc(vehicleId).get();
        if (snap.exists) {
          const d = snap.data()!;
          vehicleName  = String(d.name  || vehicleName);
          vehicleImage = String(d.image || "");
          vehicleType  = bikeType || String(d.type || "");
          dailyPrice   = Number(d.dailyPrice || d.price || 0);
        }
      } catch (e: any) {
        console.warn("[guest-booking] Could not fetch vehicle data:", e?.message);
      }
    }

    // ── 5. Resolve pickup location name ───────────────────────────────────
    let pickupLocationName = "Vi Vu Bike - Cơ sở chính";
    if (locationId && locationId !== "default") {
      try {
        const locSnap = await firebaseAdminDb.collection("locations").doc(locationId).get();
        if (locSnap.exists) {
          pickupLocationName = String(locSnap.data()?.name || pickupLocationName);
        }
      } catch (e: any) {
        console.warn("[guest-booking] Could not fetch location data:", e?.message);
      }
    }

    // ── 6. Create Firestore booking document ──────────────────────────────
    const timestamp   = Date.now();
    const totalAmount = days * dailyPrice;
    const code        = `VVB-${timestamp.toString().slice(-6)}`;

    try {
      const docRef = firebaseAdminDb.collection("bookings").doc();
      await docRef.set({
        code,
        isGuest:    true,
        customerId: null,
        guestName:  fullName,
        guestPhone: phone,
        guestEmail: email,
        customerInfo:  { fullName, phone, email },
        // ✅ Images stored as base64 Data URLs directly in Firestore
        // No Firebase Storage needed — each image ~50-100KB after client compression
        verificationDocuments: {
          idCardFrontUrl:        idCardFrontUrl,
          idCardBackUrl:         idCardBackUrl,
          driverLicenseFrontUrl: driverLicenseFrontUrl,
          driverLicenseBackUrl:  driverLicenseBackUrl,
        },
        vehicleId:   vehicleId || null,
        vehicleName,
        vehicleImage,
        vehicleType,
        dailyPrice,
        pickupLocationId:   locationId || "default",
        pickupLocationName,
        startDate,
        endDate,
        rentalDays:   days,
        totalAmount,
        note,
        amenities:    ["02 mũ bảo hiểm", "01 áo mưa"],
        status:       "Chờ xác nhận",
        createdAt:    FieldValue.serverTimestamp(),
      });
    } catch (e: any) {
      console.error("[guest-booking] Firestore write failed:", e);
      return jsonErr(`Không thể lưu đơn: ${e?.message ?? String(e)}`);
    }

    console.info(`[guest-booking] Created booking ${code} for ${phone}`);
    return NextResponse.json({ success: true, code });

  } catch (error: any) {
    console.error("[guest-booking] Unhandled error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}


