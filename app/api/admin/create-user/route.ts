import { NextResponse } from "next/server";
import { firebaseAdminAuth, firebaseAdminDb } from "../../../../lib/firebase-admin";

export const runtime = "nodejs";

const CREATABLE_ROLES = new Set(["staff", "business_manager"]);

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";

  if (!token) {
    return jsonError("Bạn cần đăng nhập để thực hiện thao tác này.", 401);
  }

  try {
    const decodedToken = await firebaseAdminAuth.verifyIdToken(token);
    const requester = await firebaseAdminDb
      .collection("users")
      .doc(decodedToken.uid)
      .get();

    if (!requester.exists || requester.data()?.role !== "admin") {
      return jsonError("Chỉ quản trị viên mới được cấp tài khoản nhân sự.", 403);
    }

    const body = (await request.json()) as Record<string, unknown>;
    const fullName = String(body.fullName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim();
    const password = String(body.password || "");
    const role = String(body.role || "").trim();

    if (!fullName || !email || !phone || !password || !role) {
      return jsonError("Vui lòng nhập đầy đủ thông tin tài khoản.", 400);
    }

    if (!CREATABLE_ROLES.has(role)) {
      return jsonError("Vai trò được chọn không hợp lệ.", 400);
    }

    if (password.length < 6) {
      return jsonError("Mật khẩu phải có ít nhất 6 ký tự.", 400);
    }

    const createdUser = await firebaseAdminAuth.createUser({
      email,
      password,
      displayName: fullName,
      disabled: false,
    });

    try {
      await firebaseAdminDb.collection("users").doc(createdUser.uid).set({
        uid: createdUser.uid,
        fullName,
        email,
        phone,
        role,
        isBlocked: false,
        verificationStatus: "not_required",
        createdAt: new Date(),
        createdBy: decodedToken.uid,
      });
    } catch (databaseError) {
      await firebaseAdminAuth.deleteUser(createdUser.uid);
      throw databaseError;
    }

    return NextResponse.json(
      {
        message: "Cấp tài khoản thành công.",
        user: {
          uid: createdUser.uid,
          fullName,
          email,
          role,
        },
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    const code =
      typeof error === "object" && error && "code" in error
        ? String((error as { code: string }).code)
        : "";

    if (code === "auth/id-token-expired" || code === "auth/argument-error") {
      return jsonError("Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.", 401);
    }

    if (code === "auth/email-already-exists") {
      return jsonError("Email này đã được sử dụng cho một tài khoản khác.", 409);
    }

    if (code === "auth/invalid-email") {
      return jsonError("Email không hợp lệ.", 400);
    }

    if (code === "auth/invalid-password") {
      return jsonError("Mật khẩu không hợp lệ.", 400);
    }

    console.error("Không thể cấp tài khoản nhân sự:", error);
    return jsonError("Không thể cấp tài khoản. Vui lòng thử lại.", 500);
  }
}
