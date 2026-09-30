import { NextResponse } from "next/server";
import { firebaseAdminAuth, firebaseAdminDb } from "../../../../lib/firebase-admin";

export async function POST(req: Request) {
  try {
    const { fullName, email, phone, password, role } = await req.json();

    if (!fullName || !email || !password || !role) {
      return NextResponse.json({ error: "Vui lòng điền đầy đủ các trường bắt buộc." }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Mật khẩu phải có ít nhất 6 ký tự." }, { status: 400 });
    }

    // Prepare create payload
    const createPayload: any = {
      email,
      password,
      displayName: fullName,
    };
    if (phone) {
      createPayload.phoneNumber = phone; // Format needs to be E.164 (e.g. +84...)
    }

    // Create user in Firebase Auth
    let userRecord;
    try {
      userRecord = await firebaseAdminAuth.createUser(createPayload);
    } catch (authError: any) {
      console.error("Auth error:", authError);
      return NextResponse.json({ error: authError.message || "Không thể tạo tài khoản trên Firebase Auth." }, { status: 400 });
    }

    // Save user profile in Firestore
    try {
      await firebaseAdminDb.collection("users").doc(userRecord.uid).set({
        uid: userRecord.uid,
        fullName,
        email,
        phone: phone || "",
        role: role,
        isBlocked: false,
        verificationStatus: "verified",
        createdAt: new Date(),
      });
    } catch (dbError: any) {
      console.error("Firestore error:", dbError);
      return NextResponse.json({ error: "Tài khoản đã tạo nhưng lỗi khi lưu Firestore." }, { status: 500 });
    }

    return NextResponse.json({ success: true, uid: userRecord.uid });
  } catch (error: any) {
    console.error("Server error:", error);
    return NextResponse.json({ error: "Lỗi máy chủ nội bộ." }, { status: 500 });
  }
}
