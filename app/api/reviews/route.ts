import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const isCompleted = (value: unknown) => ["completed", "returned", "done", "đã hoàn thành", "hoàn thành", "đã trả xe"].includes(text(value).toLowerCase());
class ReviewError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
async function authorize(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new ReviewError("Bạn cần đăng nhập để sử dụng chức năng đánh giá.", 401);
  const { firebaseAdminAuth, firebaseAdminDb: db } = await import("../../../lib/firebase-admin");
  let uid: string;
  try { uid = (await firebaseAdminAuth.verifyIdToken(token, true)).uid; }
  catch { throw new ReviewError("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.", 401); }
  const profile = (await db.collection("users").doc(uid).get()).data();
  if (!profile || profile.isBlocked === true || ["locked", "blocked", "disabled"].includes(text(profile.status).toLowerCase())) {
    throw new ReviewError("Tài khoản không có quyền truy cập.", 403);
  }
  if (!["customer", "staff", "admin"].includes(profile.role)) throw new ReviewError("Tài khoản không có quyền sử dụng chức năng này.", 403);
  return { db, uid, profile, isStaff: ["staff", "admin"].includes(profile.role) };
}
function failure(error: unknown) {
  if (!(error instanceof ReviewError)) console.error("[reviews]", error instanceof Error ? error.message : "Unknown error");
  return NextResponse.json({ error: error instanceof ReviewError ? error.message : "Không xử lý được đánh giá. Hãy kiểm tra cấu hình Firebase Admin hoặc thử lại." }, { status: error instanceof ReviewError ? error.status : 500 });
}
async function readBody(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { throw new ReviewError("Dữ liệu gửi lên không hợp lệ.", 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ReviewError("Dữ liệu gửi lên không hợp lệ.", 400);
  return body as Record<string, unknown>;
}
function id(value: unknown) {
  const result = text(value);
  if (!result || result.includes("/") || result === "." || result === ".." || Buffer.byteLength(result, "utf8") > 1500) throw new ReviewError("Mã đơn thuê không hợp lệ.", 400);
  return result;
}
const iso = (value: unknown) => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") return value.toDate().toISOString();
  return "";
};

export async function GET(request: Request) {
  try {
    const { db, uid, isStaff } = await authorize(request);
    const snapshot = await (isStaff ? db.collection("reviews") : db.collection("reviews").where("customerId", "==", uid)).get();
    const reviews = snapshot.docs.map(item => {
      const data = item.data();
      return {
        id: item.id, bookingId: text(data.bookingId), bookingCode: text(data.bookingCode),
        vehicleName: text(data.vehicleName), customerName: text(data.customerName),
        rating: Number(data.rating) || 0, comment: text(data.comment), createdAt: iso(data.createdAt),
        reply: data.reply && typeof data.reply === "object" ? {
          content: text(data.reply.content), staffName: text(data.reply.staffName), updatedAt: iso(data.reply.updatedAt),
        } : null,
      };
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return NextResponse.json({ reviews }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    const { db, uid, profile, isStaff } = await authorize(request);
    if (isStaff) throw new ReviewError("Chỉ khách hàng có đơn thuê hoàn thành mới được gửi đánh giá.", 403);
    const body = await readBody(request);
    const bookingId = id(body.bookingId);
    const rating = body.rating;
    const comment = text(body.comment);
    if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) throw new ReviewError("Vui lòng chọn từ 1 đến 5 sao.", 400);
    if (!comment || comment.length > 2000) throw new ReviewError("Nhận xét cần từ 1 đến 2.000 ký tự.", 400);
    const bookingRef = db.collection("bookings").doc(bookingId);
    const reviewRef = db.collection("reviews").doc(bookingId);
    await db.runTransaction(async transaction => {
      const bookingSnapshot = await transaction.get(bookingRef);
      const reviewSnapshot = await transaction.get(reviewRef);
      if (!bookingSnapshot.exists) throw new ReviewError("Không tìm thấy đơn thuê.", 404);
      const booking = bookingSnapshot.data()!;
      if (booking.customerId !== uid || booking.isGuest === true) throw new ReviewError("Bạn chỉ được đánh giá đơn thuê của chính mình.", 403);
      if (!isCompleted(booking.status)) throw new ReviewError("Chỉ đánh giá được sau khi đơn thuê hoàn thành.", 409);
      if (reviewSnapshot.exists) throw new ReviewError("Đơn này đã được đánh giá. Mỗi đơn chỉ gửi đánh giá một lần.", 409);
      transaction.create(reviewRef, {
        bookingId, bookingCode: text(booking.code) || bookingId,
        vehicleId: text(booking.vehicleId), vehicleName: text(booking.vehicleName) || "Xe thuê",
        customerId: uid, customerName: text(profile.fullName) || text(booking.customerName) || "Khách hàng",
        rating, comment, createdAt: FieldValue.serverTimestamp(), reply: null,
      });
    });
    return NextResponse.json({ success: true, message: "Đã gửi đánh giá. Cảm ơn bạn đã chia sẻ trải nghiệm!" }, { status: 201 });
  } catch (error) { return failure(error); }
}

export async function PATCH(request: Request) {
  try {
    const { db, uid, profile, isStaff } = await authorize(request);
    if (!isStaff) throw new ReviewError("Chỉ nhân viên hoặc quản trị viên được phản hồi đánh giá.", 403);
    const body = await readBody(request);
    const reviewId = id(body.reviewId);
    const content = text(body.content);
    if (!content || content.length > 2000) throw new ReviewError("Phản hồi cần từ 1 đến 2.000 ký tự.", 400);
    const ref = db.collection("reviews").doc(reviewId);
    await db.runTransaction(async transaction => {
      if (!(await transaction.get(ref)).exists) throw new ReviewError("Không tìm thấy đánh giá.", 404);
      transaction.update(ref, { reply: { content, staffId: uid, staffName: text(profile.fullName) || "Nhân viên Vi Vu Bike", updatedAt: FieldValue.serverTimestamp() } });
    });
    return NextResponse.json({ success: true, message: "Đã lưu phản hồi cho khách hàng." });
  } catch (error) { return failure(error); }
}
