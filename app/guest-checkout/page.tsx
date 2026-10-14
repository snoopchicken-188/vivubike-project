"use client";

import { FormEvent, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";

/* ─── Types ─────────────────────────────────────────────── */
type BikeDoc = { id: string; name: string; type: string; dailyPrice: number; image: string };

type DocSlot = {
  key: "idCardFront" | "idCardBack" | "driverLicenseFront" | "driverLicenseBack";
  label: string;
  hint: string;
};

const DOC_SLOTS: DocSlot[] = [
  { key: "idCardFront",        label: "CCCD / Hộ chiếu — Mặt trước", hint: "Ảnh rõ nét, đủ 4 góc" },
  { key: "idCardBack",         label: "CCCD / Hộ chiếu — Mặt sau",   hint: "Ảnh rõ nét, đủ 4 góc" },
  { key: "driverLicenseFront", label: "Bằng lái xe — Mặt trước",     hint: "Bằng lái còn hiệu lực" },
  { key: "driverLicenseBack",  label: "Bằng lái xe — Mặt sau",       hint: "Bằng lái còn hiệu lực" },
];

const BIKE_TYPES = [
  { value: "Xe số",     label: "Xe số (Wave Alpha, Sirius...)" },
  { value: "Tay ga",    label: "Xe tay ga (Air Blade, Vision...)" },
  { value: "Côn tay",   label: "Xe côn tay (Winner, Exciter...)" },
];

/* ─── Dropzone component ─────────────────────────────────── */
function Dropzone({
  slot, file, onFile, onClear,
}: {
  slot: DocSlot;
  file: File | null;
  onFile: (f: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const preview = file ? URL.createObjectURL(file) : null;

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith("image/")) onFile(f);
  }, [onFile]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: "#374151", letterSpacing: ".02em" }}>
        {slot.label}
      </span>
      <span style={{ fontSize: 11, color: "#9ca3af" }}>{slot.hint}</span>

      {preview ? (
        <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: "2px solid #f26522" }}>
          <img
            src={preview}
            alt={slot.label}
            style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }}
          />
          <button
            type="button"
            onClick={onClear}
            style={{
              position: "absolute", top: 6, right: 6,
              background: "rgba(0,0,0,.55)", color: "#fff",
              border: "none", borderRadius: "50%", width: 26, height: 26,
              cursor: "pointer", fontSize: 14, display: "flex",
              alignItems: "center", justifyContent: "center",
            }}
            title="Xóa ảnh"
          >
            ×
          </button>
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            background: "rgba(242,101,34,.85)", color: "#fff",
            fontSize: 11, fontWeight: 700, padding: "3px 8px",
          }}>
            ✓ Đã chọn: {file!.name.slice(0, 28)}{file!.name.length > 28 ? "…" : ""}
          </div>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${dragging ? "#f26522" : "#d1d5db"}`,
            borderRadius: 10,
            height: 140,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            cursor: "pointer",
            background: dragging ? "#fff5f0" : "#fafafa",
            transition: "all .2s",
          }}
        >
          <span style={{ fontSize: 28, opacity: .4 }}>📷</span>
          <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>Kéo thả hoặc bấm để chọn</span>
          <span style={{ fontSize: 11, color: "#9ca3af" }}>JPG / PNG / HEIC</span>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
    </div>
  );
}

/* ─── Upload progress bar ────────────────────────────────── */
function ProgressBar({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div style={{ margin: "0 0 18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        {steps.map((s, i) => (
          <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: i < current ? "#15803d" : i === current ? "#f26522" : "#e5e7eb",
              color: i <= current ? "#fff" : "#9ca3af",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 800, marginBottom: 4,
            }}>
              {i < current ? "✓" : i + 1}
            </div>
            <span style={{ fontSize: 10, color: i === current ? "#f26522" : "#9ca3af", fontWeight: 600, textAlign: "center" }}>
              {s}
            </span>
          </div>
        ))}
      </div>
      <div style={{ height: 4, background: "#e5e7eb", borderRadius: 4, overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: 4,
          background: "linear-gradient(90deg, #f26522, #ff8c42)",
          width: `${Math.round((current / (steps.length - 1)) * 100)}%`,
          transition: "width .5s ease",
        }} />
      </div>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────── */
export default function GuestCheckoutPage() {
  return (
    <Suspense fallback={
      <div role="status" style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "Arial, sans-serif" }}>
        Đang tải thông tin đặt xe…
      </div>
    }>
      <GuestCheckoutContent />
    </Suspense>
  );
}

function GuestCheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const vehicleId = searchParams.get("vehicleId");

  /* Bike data */
  const [bike, setBike] = useState<BikeDoc | null>(null);

  /* Form fields */
  const [fullName, setFullName]   = useState("");
  const [phone, setPhone]         = useState("");
  const [email, setEmail]         = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate]     = useState("");
  const [bikeType, setBikeType]   = useState("Tay ga");
  const [note, setNote]           = useState("");

  /* Documents */
  const [docs, setDocs] = useState<Record<DocSlot["key"], File | null>>({
    idCardFront: null,
    idCardBack: null,
    driverLicenseFront: null,
    driverLicenseBack: null,
  });

  /* Submit state */
  const [loading, setLoading]         = useState(false);
  const [uploadStep, setUploadStep]   = useState(0); // 0–4
  const [error, setError]             = useState("");
  const [bookingCode, setBookingCode] = useState("");

  /* Load bike info */
  useEffect(() => {
    if (!vehicleId) return;
    getDoc(doc(db, "vehicles", vehicleId)).then((snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setBike({
          id: snap.id,
          name: String(d.name || ""),
          type: String(d.type || ""),
          dailyPrice: Number(d.dailyPrice || 0),
          image: String(d.image || ""),
        });
        if (d.type) setBikeType(String(d.type));
      }
    });
  }, [vehicleId]);

  /* Computed */
  const today = new Date().toISOString().slice(0, 10);
  const days  =
    startDate && endDate
      ? Math.max(0, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000))
      : 0;
  const totalAmount = bike ? days * bike.dailyPrice : 0;
  const allDocsSet  = DOC_SLOTS.every((s) => docs[s.key]);

  /* Submit */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!allDocsSet) { setError("Vui lòng tải lên đầy đủ 4 ảnh giấy tờ trước khi tiếp tục."); return; }
    if (days < 1)    { setError("Ngày trả phải sau ngày nhận ít nhất 1 ngày."); return; }
    if (!phone.match(/^\d{9,11}$/)) { setError("Số điện thoại không hợp lệ (9–11 chữ số)."); return; }

    setLoading(true);
    setError("");
    setUploadStep(1);

    /** Compress a File to a JPEG base64 Data URL using canvas (client-side) */
    const compressToBase64 = (file: File, maxWidth = 900, quality = 0.72): Promise<string> =>
      new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(url);
          const scale = maxWidth / Math.max(img.width, maxWidth);
          const w = Math.round(img.width  * scale);
          const h = Math.round(img.height * scale);
          const canvas = document.createElement("canvas");
          canvas.width  = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.onerror = reject;
        img.src = url;
      });

    try {
      setUploadStep(2);
      const [idCardFrontB64, idCardBackB64] = await Promise.all([
        compressToBase64(docs.idCardFront!),
        compressToBase64(docs.idCardBack!),
      ]);

      setUploadStep(3);
      const [driverLicenseFrontB64, driverLicenseBackB64] = await Promise.all([
        compressToBase64(docs.driverLicenseFront!),
        compressToBase64(docs.driverLicenseBack!),
      ]);

      setUploadStep(4);
      const payload = {
        fullName,
        phone,
        email,
        startDate,
        endDate,
        bikeType,
        locationId: "default",
        note,
        vehicleId: bike?.id ?? "",
        // Base64-compressed images — stored directly in Firestore, no Storage needed
        idCardFront:        idCardFrontB64,
        idCardBack:         idCardBackB64,
        driverLicenseFront: driverLicenseFrontB64,
        driverLicenseBack:  driverLicenseBackB64,
      };

      const res = await fetch("/api/guest-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // Always read body as text first, then try JSON parse.
      const rawText = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(rawText);
      } catch {
        const preview = rawText.slice(0, 200).replace(/<[^>]*>/g, " ").trim();
        throw new Error(
          `Lỗi máy chủ ${res.status}: ${preview || "Phản hồi không hợp lệ từ server."}`
        );
      }

      if (!res.ok) {
        throw new Error(data?.error || `Lỗi máy chủ (${res.status})`);
      }

      setUploadStep(5);
      setBookingCode(data.code);
    } catch (err: any) {
      console.error("Guest booking error:", err);
      setError(err.message || "Đã xảy ra lỗi. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };


  /* ── Success screen ─────────────────────────────────────── */
  if (bookingCode) {
    return (
      <main style={{ minHeight: "100vh", background: "#0f1117", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif", padding: 20 }}>
        <div style={{ maxWidth: 540, width: "100%", textAlign: "center" }}>
          {/* Confetti ring */}
          <div style={{ width: 96, height: 96, borderRadius: "50%", background: "linear-gradient(135deg,#f26522,#ff8c42)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 28px", fontSize: 44 }}>
            🎉
          </div>

          <p className="text-xs font-semibold tracking-wider text-orange-500 font-sans" style={{ margin: "0 0 8px" }}>ĐẶT XE THÀNH CÔNG</p>
          <h1 className="text-3xl font-extrabold text-white font-sans tracking-tight" style={{ margin: "0 0 6px" }}>
            Đơn đã được gửi!
          </h1>
          <p style={{ color: "#9ca3af", margin: "0 0 32px", fontSize: 15, fontFamily: "sans-serif" }}>
            Nhân viên Vi Vu Bike sẽ xác nhận đơn và liên hệ bạn sớm nhất.
          </p>

          {/* Booking code card */}
          <div style={{
            background: "#1a1f2e", border: "1px solid #2d3748",
            borderRadius: 16, padding: "28px 32px", marginBottom: 24,
          }}>
            <p style={{ color: "#6b7280", fontSize: 12, fontWeight: 700, letterSpacing: ".1em", margin: "0 0 12px" }}>MÃ PHIẾU THUÊ CỦA BẠN</p>
            <div style={{
              fontFamily: "monospace", fontSize: "clamp(32px,8vw,52px)",
              fontWeight: 900, color: "#f26522", letterSpacing: ".08em",
              textShadow: "0 0 24px rgba(242,101,34,.4)",
            }}>
              {bookingCode}
            </div>
            <p style={{ color: "#9ca3af", fontSize: 13, margin: "12px 0 0" }}>
              Lưu lại mã này để tra cứu đơn hàng của bạn.
            </p>
          </div>

          {/* Contact notice */}
          <div style={{
            background: "#1a2f1a", border: "1px solid #166534",
            borderRadius: 12, padding: "16px 20px", marginBottom: 28,
            display: "flex", gap: 12, alignItems: "flex-start", textAlign: "left",
          }}>
            <span style={{ fontSize: 20 }}>📞</span>
            <p style={{ color: "#86efac", fontSize: 14, margin: 0, lineHeight: 1.6, fontFamily: "sans-serif" }}>
              Nhân viên Vi Vu Bike sẽ liên hệ qua số{" "}
              <strong style={{ color: "#4ade80" }}>{phone}</strong>{" "}
              để xác nhận đơn.
            </p>
          </div>

          {/* Steps */}
          <div style={{ background: "#1a1f2e", borderRadius: 12, padding: "16px 20px", marginBottom: 28, textAlign: "left" }}>
            <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 800, letterSpacing: ".1em", margin: "0 0 12px", fontFamily: "sans-serif" }}>BƯỚC TIẾP THEO</p>
            {[
              "Chờ nhân viên gọi xác nhận đơn (trong vòng 1–2 giờ)",
              "Chuẩn bị CCCD và BLX gốc để đối chiếu khi nhận xe",
              "Đến nhận xe tại Vi Vu Bike - 96A Trần Phú, Hà Đông",
            ].map((step, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
                <span style={{
                  width: 20, height: 20, borderRadius: "50%",
                  background: "#f26522", color: "#fff",
                  fontSize: 11, fontWeight: 800,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, marginTop: 1,
                }}>{i + 1}</span>
                <span style={{ color: "#d1d5db", fontSize: 13, lineHeight: 1.5 }}>{step}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => router.push("/")}
            className="font-semibold text-white font-sans"
            style={{
              width: "100%", padding: "14px 24px",
              background: "linear-gradient(135deg, #f26522, #ff8c42)",
              border: "none", borderRadius: 12,
              fontSize: 16, cursor: "pointer",
              letterSpacing: ".02em",
            }}
          >
            Trở về trang chủ →
          </button>
        </div>
      </main>
    );
  }

  /* ── Form ───────────────────────────────────────────────── */
  const uploadSteps = ["Chuẩn bị", "Tải CCCD", "Tải BLX", "Đang lưu", "Hoàn tất"];

  return (
    <main style={{ minHeight: "100vh", background: "#f5f6f7", fontFamily: "'Be Vietnam Pro', Arial, sans-serif" }}>
      {/* Header bar */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "rgba(255,255,255,.95)", backdropFilter: "blur(8px)",
        borderBottom: "1px solid #e5e7eb",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px", height: 60,
      }}>
        <button
          onClick={() => router.push("/")}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#f26522", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}
        >
          ← Quay lại
        </button>
        <span style={{ fontWeight: 800, fontSize: 15, color: "#171717", letterSpacing: ".03em" }}>
          Khách đặt nhanh
        </span>
        <button
          onClick={() => {
            localStorage.setItem("returnTo", `/guest-checkout?vehicleId=${vehicleId}`);
            router.push("/?login=true");
          }}
          style={{
            background: "none", border: "1px solid #f26522",
            color: "#f26522", padding: "6px 14px", borderRadius: 8,
            cursor: "pointer", fontSize: 13, fontWeight: 700,
          }}
        >
          Đăng nhập →
        </button>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "28px 20px 60px" }}>
        {/* Page title */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span style={{
              background: "#f3e8ff", color: "#7e22ce",
              fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 20,
              letterSpacing: ".06em",
            }}>KHÁCH VÃNG LAI</span>
            <span style={{ color: "#9ca3af", fontSize: 13 }}>Không cần tài khoản</span>
          </div>
          <h1 style={{ margin: "0 0 6px", fontSize: "clamp(22px,4vw,30px)", fontWeight: 800, color: "#111" }}>
            Hoàn tất đặt xe {bike && <span style={{ color: "#f26522" }}>{bike.name}</span>}
          </h1>
          <p style={{ margin: 0, color: "#6b7280", fontSize: 14 }}>
            Điền đầy đủ thông tin và tải lên ảnh giấy tờ để gửi yêu cầu thuê xe.
          </p>
        </div>

        {/* Upload progress (shown while submitting) */}
        {loading && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 20, marginBottom: 20, boxShadow: "0 2px 12px rgba(0,0,0,.06)" }}>
            <p style={{ margin: "0 0 12px", fontWeight: 700, fontSize: 13 }}>Đang xử lý đơn của bạn…</p>
            <ProgressBar steps={uploadSteps} current={uploadStep} />
            <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>
              {uploadSteps[Math.min(uploadStep, uploadSteps.length - 1)]} — Vui lòng không đóng trang này.
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            background: "#fef2f2", border: "1px solid #fca5a5",
            color: "#b91c1c", padding: "12px 16px", borderRadius: 10, marginBottom: 20,
            fontSize: 14, display: "flex", gap: 8, alignItems: "flex-start",
          }}>
            <span>⚠️</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* ── Section 1: Thông tin cá nhân ── */}
          <section style={sectionStyle}>
            <div style={sectionHeadStyle}>
              <span style={badgeNumStyle}>1</span>
              <div>
                <h2 style={sectionTitleStyle}>Thông tin cá nhân liên hệ</h2>
                <p style={sectionSubStyle}>Nhân viên sẽ dùng số điện thoại này để xác nhận đơn.</p>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <label style={labelStyle}>
                <span style={labelTextStyle}>Họ và tên *</span>
                <input
                  type="text" required
                  value={fullName} onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                <span style={labelTextStyle}>Số điện thoại *</span>
                <input
                  type="tel" required
                  value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder="0912 345 678"
                  style={inputStyle}
                />
              </label>
              <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
                <span style={labelTextStyle}>Email nhận thông tin đơn hàng *</span>
                <input
                  type="email" required
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  style={inputStyle}
                />
              </label>
            </div>
          </section>

          {/* ── Section 2: Thông tin thuê xe ── */}
          <section style={sectionStyle}>
            <div style={sectionHeadStyle}>
              <span style={badgeNumStyle}>2</span>
              <div>
                <h2 style={sectionTitleStyle}>Thông tin thuê xe</h2>
                <p style={sectionSubStyle}>Chọn ngày nhận/trả và loại xe mong muốn.</p>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <label style={labelStyle}>
                <span style={labelTextStyle}>Ngày nhận xe *</span>
                <input
                  type="date" required min={today}
                  value={startDate} onChange={(e) => setStartDate(e.target.value)}
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                <span style={labelTextStyle}>Ngày trả xe *</span>
                <input
                  type="date" required min={startDate || today}
                  value={endDate} onChange={(e) => setEndDate(e.target.value)}
                  style={inputStyle}
                />
              </label>

              {/* Duration & price summary */}
              {days > 0 && (
                <div style={{
                  gridColumn: "1 / -1",
                  background: "#fff5f0", border: "1px solid #fed7aa",
                  borderRadius: 10, padding: "12px 16px",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <span style={{ fontSize: 13, color: "#92400e", fontWeight: 600 }}>
                    🗓 {days} ngày thuê
                  </span>
                  {bike && (
                    <span style={{ fontSize: 14, fontWeight: 800, color: "#f26522" }}>
                      Tạm tính: {new Intl.NumberFormat("vi-VN").format(totalAmount)}đ
                    </span>
                  )}
                </div>
              )}

              <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
                <span style={labelTextStyle}>Địa điểm nhận xe</span>
                <input
                  value="Vi Vu Bike - Cơ sở chính"
                  readOnly
                  style={{ ...inputStyle, background: "#f9fafb", color: "#6b7280", cursor: "default" }}
                />
              </label>

              {!vehicleId && (
                <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
                  <span style={labelTextStyle}>Loại xe mong muốn</span>
                  <select
                    value={bikeType}
                    onChange={(e) => setBikeType(e.target.value)}
                    style={inputStyle}
                  >
                    {BIKE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </label>
              )}

              <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
                <span style={labelTextStyle}>Ghi chú cho nhân viên <span style={{ color: "#9ca3af", fontWeight: 400 }}>(không bắt buộc)</span></span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Ví dụ: giờ dự kiến đến nhận xe, yêu cầu đặc biệt..."
                  style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
                />
              </label>
            </div>
          </section>

          {/* ── Section 3: Giấy tờ ── */}
          <section style={sectionStyle}>
            <div style={sectionHeadStyle}>
              <span style={badgeNumStyle}>3</span>
              <div>
                <h2 style={sectionTitleStyle}>Xác minh giấy tờ <span style={{ color: "#ef4444", fontSize: 13 }}>*</span></h2>
                <p style={sectionSubStyle}>Upload 4 ảnh rõ nét. Ảnh sẽ được đối chiếu khi nhận xe.</p>
              </div>
            </div>

            {/* Progress indicators */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              {DOC_SLOTS.map((s) => (
                <span key={s.key} style={{
                  fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                  background: docs[s.key] ? "#d1fae5" : "#f3f4f6",
                  color: docs[s.key] ? "#065f46" : "#9ca3af",
                }}>
                  {docs[s.key] ? "✓" : "○"} {s.label.split("—")[0].trim()}
                </span>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
              {DOC_SLOTS.map((slot) => (
                <Dropzone
                  key={slot.key}
                  slot={slot}
                  file={docs[slot.key]}
                  onFile={(f) => setDocs((prev) => ({ ...prev, [slot.key]: f }))}
                  onClear={() => setDocs((prev) => ({ ...prev, [slot.key]: null }))}
                />
              ))}
            </div>

            {!allDocsSet && (
              <div style={{ marginTop: 12, padding: "10px 14px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, fontSize: 12, color: "#92400e" }}>
                💡 Cần tải đủ {DOC_SLOTS.length - DOC_SLOTS.filter((s) => docs[s.key]).length} ảnh nữa để hoàn tất.
              </div>
            )}
          </section>

          {/* ── Submit ── */}
          <button
            type="submit"
            disabled={loading || !allDocsSet}
            style={{
              padding: "16px 24px",
              background: loading || !allDocsSet
                ? "#e5e7eb"
                : "linear-gradient(135deg, #f26522, #ff8c42)",
              color: loading || !allDocsSet ? "#9ca3af" : "#fff",
              fontSize: 16, fontWeight: 800,
              border: "none", borderRadius: 14,
              cursor: loading || !allDocsSet ? "not-allowed" : "pointer",
              transition: "all .2s",
              letterSpacing: ".02em",
            }}
          >
            {loading ? "Đang xử lý đơn của bạn…" : allDocsSet ? "Gửi yêu cầu thuê xe →" : `Cần tải thêm ${DOC_SLOTS.filter((s) => !docs[s.key]).length} ảnh giấy tờ`}
          </button>

          <p style={{ textAlign: "center", fontSize: 12, color: "#9ca3af", margin: 0 }}>
            Bằng cách gửi đơn, bạn đồng ý với{" "}
            <a href="/policies" style={{ color: "#f26522", textDecoration: "none" }}>chính sách thuê xe</a> của Vi Vu Bike.
          </p>
        </form>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        input, select, textarea {
          font-family: 'Be Vietnam Pro', Arial, sans-serif;
          transition: border-color .15s, box-shadow .15s;
        }
        input:focus, select:focus, textarea:focus {
          outline: none;
          border-color: #f26522 !important;
          box-shadow: 0 0 0 3px rgba(242,101,34,.12);
        }
      `}</style>
    </main>
  );
}

/* ─── Shared styles ──────────────────────────────────────── */
const sectionStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 16,
  padding: "24px",
  boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)",
};
const sectionHeadStyle: React.CSSProperties = {
  display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 20,
};
const badgeNumStyle: React.CSSProperties = {
  width: 30, height: 30, borderRadius: "50%",
  background: "linear-gradient(135deg,#f26522,#ff8c42)",
  color: "#fff", fontWeight: 900, fontSize: 14,
  display: "flex", alignItems: "center", justifyContent: "center",
  flexShrink: 0,
};
const sectionTitleStyle: React.CSSProperties = {
  margin: 0, fontSize: 17, fontWeight: 800, color: "#111",
};
const sectionSubStyle: React.CSSProperties = {
  margin: "4px 0 0", fontSize: 13, color: "#9ca3af",
};
const labelStyle: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: 6,
};
const labelTextStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: "#374151", letterSpacing: ".02em",
};
const inputStyle: React.CSSProperties = {
  padding: "10px 14px",
  border: "1.5px solid #e5e7eb",
  borderRadius: 10,
  fontSize: 14,
  color: "#111",
  background: "#fff",
  width: "100%",
};
