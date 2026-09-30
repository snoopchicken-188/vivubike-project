import { NextRequest, NextResponse } from "next/server";
import { firebaseAdminDb, firebaseAdminStorage } from "../../../lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    
    // Parse form fields
    const fullName = formData.get("fullName") as string;
    const phone = formData.get("phone") as string;
    const email = formData.get("email") as string;
    const startDate = formData.get("startDate") as string;
    const endDate = formData.get("endDate") as string;
    const locationId = formData.get("locationId") as string;
    const note = formData.get("note") as string;
    const vehicleId = formData.get("vehicleId") as string;
    
    // Validate files
    const idCardFront = formData.get("idCardFront") as File;
    const idCardBack = formData.get("idCardBack") as File;
    const driverLicenseFront = formData.get("driverLicenseFront") as File;
    const driverLicenseBack = formData.get("driverLicenseBack") as File;

    if (!idCardFront || !idCardBack || !driverLicenseFront || !driverLicenseBack) {
      return NextResponse.json({ error: "Missing required documents" }, { status: 400 });
    }

    const bucket = firebaseAdminStorage.bucket();
    const timestamp = Date.now();
    const folder = `guest_verifications/${timestamp}_${phone}`;

    // Upload helper
    const uploadFile = async (file: File, filename: string) => {
      const buffer = Buffer.from(await file.arrayBuffer());
      const bucketFile = bucket.file(`${folder}/${filename}`);
      const token = globalThis.crypto.randomUUID();
      
      await bucketFile.save(buffer, {
        metadata: {
          contentType: file.type,
          metadata: {
            firebaseStorageDownloadTokens: token,
          },
        },
      });

      return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(bucketFile.name)}?alt=media&token=${token}`;
    };

    const [idFrontUrl, idBackUrl, dlFrontUrl, dlBackUrl] = await Promise.all([
      uploadFile(idCardFront, "idCardFront"),
      uploadFile(idCardBack, "idCardBack"),
      uploadFile(driverLicenseFront, "driverLicenseFront"),
      uploadFile(driverLicenseBack, "driverLicenseBack"),
    ]);

    // Fetch vehicle and location
    const vehicleSnap = await firebaseAdminDb.collection("vehicles").doc(vehicleId).get();
    const vehicleData = vehicleSnap.data();

    const locationSnap = await firebaseAdminDb.collection("locations").doc(locationId).get();
    const locationData = locationSnap.data();

    const days = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000);
    const dailyPrice = vehicleData?.dailyPrice || vehicleData?.price || 0;
    const totalAmount = days * dailyPrice;
    
    const code = `VVB-${timestamp.toString().slice(-6)}`;

    // Create booking document
    const docRef = firebaseAdminDb.collection("bookings").doc();
    await docRef.set({
      code,
      isGuest: true,
      customerId: null,
      customerInfo: { fullName, phone, email },
      verificationDocuments: {
        idCardFrontUrl: idFrontUrl,
        idCardBackUrl: idBackUrl,
        driverLicenseFrontUrl: dlFrontUrl,
        driverLicenseBackUrl: dlBackUrl,
      },
      vehicleId,
      vehicleName: vehicleData?.name || "Xe thuê",
      dailyPrice,
      pickupLocationId: locationId,
      pickupLocationName: locationData?.name || "",
      startDate,
      endDate,
      rentalDays: days,
      totalAmount,
      note,
      amenities: ["02 mũ bảo hiểm", "01 áo mưa"],
      status: "Chờ xác nhận", // stage 1 text representation
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, code });
  } catch (error: any) {
    console.error("Guest booking error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
