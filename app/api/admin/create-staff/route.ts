import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { firebaseAdminAuth, firebaseAdminDb } from "../../../../lib/firebase-admin";

export const runtime = "nodejs";

const CREATABLE_ROLES = new Set(["staff", "business_manager"]);

function jsonResponse(data: { success: boolean; [key: string]: unknown }, status: number) {
  return NextResponse.json(data, { status });
}

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";

  if (!token) {
    return jsonResponse(
      { success: false, error: "Bạn cần đăng nhập để thực hiện thao tác này." },
      401
    );
  }

  try {
    // 1. Verify token & check admin permissions
    const decodedToken = await firebaseAdminAuth.verifyIdToken(token);
    const requester = await firebaseAdminDb
      .collection("users")
      .doc(decodedToken.uid)
      .get();

    if (!requester.exists || requester.data()?.role !== "admin") {
      return jsonResponse(
        { success: false, error: "Chỉ quản trị viên mới được cấp tài khoản nhân sự." },
        403
      );
    }

    // 2. Validate request body
    const body = (await request.json()) as Record<string, unknown>;
    const fullName = String(body.fullName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const rawPhone = String(body.phoneNumber || body.phone || "").trim();
    const password = String(body.password || "");
    const role = String(body.role || "staff").trim();
    const roleTitle = String(
      body.roleTitle ||
      (role === "business_manager" ? "Quản lý kinh doanh" : "Nhân viên vận hành")
    ).trim();

    if (!fullName || !email || !rawPhone || !password) {
      return jsonResponse(
        { success: false, error: "Vui lòng nhập đầy đủ họ tên, email, số điện thoại và mật khẩu." },
        400
      );
    }

    if (role && !CREATABLE_ROLES.has(role)) {
      return jsonResponse(
        { success: false, error: "Vai trò được chọn không hợp lệ." },
        400
      );
    }

    if (password.length < 6) {
      return jsonResponse(
        { success: false, code: "auth/weak-password", error: "Mật khẩu khởi tạo phải có ít nhất 6 ký tự." },
        400
      );
    }

    // Format phone to E.164 if possible (+84xxxxxxxxx)
    let formattedPhone: string | undefined = undefined;
    const cleanPhone = rawPhone.replace(/\s+/g, "");
    if (cleanPhone.startsWith("+") && /^\+[1-9]\d{6,14}$/.test(cleanPhone)) {
      formattedPhone = cleanPhone;
    } else if (/^0\d{9,10}$/.test(cleanPhone)) {
      formattedPhone = `+84${cleanPhone.slice(1)}`;
    }

    // 3. Create user in Firebase Authentication
    let userRecord;
    try {
      userRecord = await firebaseAdminAuth.createUser({
        email,
        password,
        displayName: fullName,
        ...(formattedPhone ? { phoneNumber: formattedPhone } : {}),
        disabled: false,
      });
    } catch (authError: any) {
      // If phone number error occurs (e.g. invalid format in Auth or phone already in use in Auth),
      // fallback to creating without phoneNumber on Auth and save phone strictly to Firestore
      if (
        formattedPhone &&
        (authError?.code === "auth/invalid-phone-number" ||
          authError?.code === "auth/phone-number-already-exists")
      ) {
        userRecord = await firebaseAdminAuth.createUser({
          email,
          password,
          displayName: fullName,
          disabled: false,
        });
      } else {
        throw authError;
      }
    }

    // 4. Save staff profile to Firestore 'users' collection
    try {
      await firebaseAdminDb.collection("users").doc(userRecord.uid).set({
        uid: userRecord.uid,
        email,
        fullName,
        phoneNumber: rawPhone,
        phone: rawPhone,
        role: role || "staff",
        roleTitle: roleTitle || "Nhân viên vận hành",
        status: "active",
        isBlocked: false,
        verificationStatus: "not_required",
        createdAt: FieldValue.serverTimestamp(),
        createdBy: decodedToken.uid,
      });
    } catch (dbError) {
      // Rollback Auth user if database write fails
      try {
        await firebaseAdminAuth.deleteUser(userRecord.uid);
      } catch (deleteError) {
        console.error("Lỗi khi rollback user:", deleteError);
      }
      throw dbError;
    }

    return jsonResponse(
      {
        success: true,
        message: "Cấp tài khoản nhân sự thành công.",
        user: {
          uid: userRecord.uid,
          fullName,
          email,
          phoneNumber: rawPhone,
          phone: rawPhone,
          role: role || "staff",
          roleTitle,
        },
      },
      201
    );
  } catch (error: any) {
    const code = error?.code || "";
    let message = error?.message || "Không thể cấp tài khoản. Vui lòng thử lại.";
    let status = 500;

    if (code === "auth/email-already-exists") {
      message = "Email này đã được sử dụng trên hệ thống.";
      status = 409;
    } else if (code === "auth/weak-password" || code === "auth/invalid-password") {
      message = "Mật khẩu khởi tạo phải có ít nhất 6 ký tự.";
      status = 400;
    } else if (code === "auth/invalid-email") {
      message = "Email không hợp lệ.";
      status = 400;
    } else if (code === "auth/phone-number-already-exists") {
      message = "Số điện thoại này đã được liên kết với một tài khoản khác.";
      status = 409;
    } else if (code === "auth/id-token-expired" || code === "auth/argument-error") {
      message = "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.";
      status = 401;
    }

    console.error("Lỗi khi cấp tài khoản nhân sự:", error);

    return jsonResponse(
      {
        success: false,
        code,
        error: message,
        message,
      },
      status
    );
  }
}
