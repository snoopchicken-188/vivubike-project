import { NextResponse } from "next/server";

import { FieldValue } from "firebase-admin/firestore";
import { firebaseAdminAuth, firebaseAdminDb } from "../../../lib/firebase-admin";

export const runtime = "nodejs";

const bucket = "verification-documents";
const validActions = new Set(["approved", "needs_update", "rejected"]);

async function getStaff(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) throw new Error("UNAUTHENTICATED");
  const decoded = await firebaseAdminAuth.verifyIdToken(token);
  const staff = await firebaseAdminDb.collection("users").doc(decoded.uid).get();
  if (!staff.exists || !["staff", "admin"].includes(String(staff.data()?.role || ""))) throw new Error("FORBIDDEN");
  return { uid: decoded.uid, fullName: String(staff.data()?.fullName || decoded.email || "Nhân viên") };
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  if (message === "UNAUTHENTICATED") return NextResponse.json({ error: "Bạn cần đăng nhập lại." }, { status: 401 });
  if (message === "FORBIDDEN") return NextResponse.json({ error: "Tài khoản này không có quyền Staff." }, { status: 403 });
  return NextResponse.json({ error: "Không thể xử lý hồ sơ. Hãy thử lại." }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    await getStaff(request);
    const customerId = new URL(request.url).searchParams.get("customerId");
    if (!customerId) return NextResponse.json({ error: "Thiếu mã khách hàng." }, { status: 400 });
    const customer = await firebaseAdminDb.collection("users").doc(customerId).get();
    const data = customer.data();
    if (!customer.exists || data?.role !== "customer") return NextResponse.json({ error: "Không tìm thấy hồ sơ khách hàng." }, { status: 404 });
    const paths = data?.verificationDocuments || {};
    const documents: Record<string, string> = {};
    for (const [key, val] of Object.entries(paths)) {
      if (typeof val === "string") documents[key] = val;
    }
    return NextResponse.json({
      customer: {
        id: customer.id,
        fullName: String(data?.fullName || "Chưa cập nhật"),
        email: String(data?.email || ""),
        phone: String(data?.phone || ""),
        identityNumber: String(data?.identityNumber || ""),
        verificationStatus: String(data?.verificationStatus || "not_submitted"),
        staffNote: String(data?.staffNote || ""),
      },
      documents,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const staff = await getStaff(request);
    const body = await request.json();
    const customerId = String(body.customerId || "");
    const action = String(body.action || "");
    const note = String(body.note || "").trim();
    if (!customerId || !validActions.has(action)) return NextResponse.json({ error: "Dữ liệu xử lý không hợp lệ." }, { status: 400 });
    if (["needs_update", "rejected"].includes(action) && !note) return NextResponse.json({ error: "Vui lòng nhập lý do để khách hàng biết cần xử lý gì." }, { status: 400 });
    const customerRef = firebaseAdminDb.collection("users").doc(customerId);
    const customer = await customerRef.get();
    if (!customer.exists || customer.data()?.role !== "customer") return NextResponse.json({ error: "Không tìm thấy hồ sơ khách hàng." }, { status: 404 });
    const proposal = action === "approved" ? "approved" : action;
    await customerRef.update({
      verificationStatus: action,
      staffProposal: proposal,
      staffId: staff.uid,
      staffName: staff.fullName,
      staffReviewedAt: FieldValue.serverTimestamp(),
      staffNote: note,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
