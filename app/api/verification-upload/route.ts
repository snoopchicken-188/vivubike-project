import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { firebaseAdminAuth } from "../../../lib/firebase-admin";

export const runtime = "nodejs";

const bucket = "verification-documents";
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Bạn cần đăng nhập để gửi hồ sơ." }, { status: 401 });
    const decoded = await firebaseAdminAuth.verifyIdToken(token);
    const form = await request.formData();
    const keys = ["cccdFront", "cccdBack", "driverLicense"] as const;
    const files = keys.map((key) => form.get(key));
    if (files.some((file) => !(file instanceof File))) return NextResponse.json({ error: "Vui lòng chọn đủ ba ảnh giấy tờ." }, { status: 400 });
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const paths: Record<string, string> = {};
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index] as File;
      if (!allowedTypes.has(file.type) || file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Ảnh phải là JPG, PNG hoặc WEBP và không quá 5MB." }, { status: 400 });
      const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const filePath = `${decoded.uid}/${Date.now()}-${keys[index]}.${extension}`;
      const { error } = await supabase.storage.from(bucket).upload(filePath, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      paths[keys[index]] = filePath;
    }
    return NextResponse.json({ paths });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Không thể tải hồ sơ. Hãy thử lại." }, { status: 500 });
  }
}
