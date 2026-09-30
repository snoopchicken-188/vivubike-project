"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc, collection, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../lib/firebase";

export default function GuestCheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const vehicleId = searchParams.get("vehicleId");

  const [bike, setBike] = useState<any>(null);
  const [locations, setLocations] = useState<any[]>([]);
  
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [locationId, setLocationId] = useState("");
  const [note, setNote] = useState("");

  const [idCardFront, setIdCardFront] = useState<File | null>(null);
  const [idCardBack, setIdCardBack] = useState<File | null>(null);
  const [driverLicenseFront, setDriverLicenseFront] = useState<File | null>(null);
  const [driverLicenseBack, setDriverLicenseBack] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [bookingCode, setBookingCode] = useState("");

  useEffect(() => {
    if (!vehicleId) return;
    getDoc(doc(db, "vehicles", vehicleId)).then((snap) => {
      if (snap.exists()) setBike({ id: snap.id, ...snap.data() });
    });
  }, [vehicleId]);

  useEffect(() => {
    return onSnapshot(collection(db, "locations"), (snapshot) => {
      const items = snapshot.docs
        .filter((item) => item.data().isActive)
        .map((item) => ({ id: item.id, name: item.data().name }));
      setLocations(items);
      if (items.length > 0) setLocationId(items[0].id);
    });
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (f: File | null) => void) => {
    if (e.target.files && e.target.files[0]) {
      setter(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!idCardFront || !idCardBack || !driverLicenseFront || !driverLicenseBack) {
      setError("Vui lòng tải lên đầy đủ 4 mặt của giấy tờ.");
      return;
    }
    const days = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000);
    if (days < 1) {
      setError("Ngày trả phải sau ngày nhận.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("fullName", fullName);
      formData.append("phone", phone);
      formData.append("email", email);
      formData.append("startDate", startDate);
      formData.append("endDate", endDate);
      formData.append("locationId", locationId);
      formData.append("note", note);
      if (bike?.id) formData.append("vehicleId", bike.id);

      formData.append("idCardFront", idCardFront);
      formData.append("idCardBack", idCardBack);
      formData.append("driverLicenseFront", driverLicenseFront);
      formData.append("driverLicenseBack", driverLicenseBack);

      const res = await fetch("/api/guest-booking", {
        method: "POST",
        body: formData,
      });

      let data;
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(text ? `Lỗi máy chủ: ${text}` : `Lỗi máy chủ (${res.status}): Không thể kết nối hoặc payload quá lớn.`);
      }

      if (!res.ok) {
        throw new Error(data.error || "Có lỗi xảy ra khi tạo đơn.");
      }

      setBookingCode(data.code);
    } catch (err: any) {
      console.error("Lỗi khi tải ảnh hoặc tạo đơn vãng lai:", err);
      setError(err.message || "Đã xảy ra lỗi khi tạo đơn. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  if (bookingCode) {
    return (
      <div style={{ maxWidth: 600, margin: "50px auto", padding: 20, textAlign: "center", fontFamily: "sans-serif" }}>
        <h2>Đặt xe thành công!</h2>
        <p>Mã phiếu thuê của bạn là:</p>
        <h1 style={{ color: "#f26522", fontSize: "3rem" }}>{bookingCode}</h1>
        <p>Nhân viên Vi Vu Bike sẽ liên hệ qua SĐT <strong>{phone}</strong> để xác nhận đơn và kiểm tra giấy tờ trước khi giao xe.</p>
        <button onClick={() => router.push("/")} style={{ padding: "10px 20px", background: "#f26522", color: "white", border: "none", borderRadius: 8, marginTop: 20, cursor: "pointer" }}>Trở về trang chủ</button>
      </div>
    );
  }

  return (
    <main style={{ maxWidth: 800, margin: "50px auto", padding: 20, fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <button onClick={() => router.push("/")} style={{ background: "none", border: "none", cursor: "pointer", color: "#f26522" }}>← Quay lại trang chủ</button>
        <button onClick={() => { localStorage.setItem("returnTo", `/guest-checkout?vehicleId=${vehicleId}`); router.push("/?login=true"); }} style={{ background: "none", border: "1px solid #f26522", color: "#f26522", padding: "8px 16px", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: "bold" }}>
          Đã có tài khoản? Đăng nhập
        </button>
      </div>
      <h2>Khách đặt nhanh (Không cần tài khoản)</h2>
      <p style={{ color: "#666" }}>Vui lòng điền thông tin bên dưới để hoàn tất đặt xe.</p>
      
      {error && <div style={{ background: "#fee2e2", color: "#b91c1c", padding: "10px", borderRadius: "8px", marginBottom: "20px" }}>{error}</div>}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <fieldset style={{ border: "1px solid #ddd", padding: 20, borderRadius: 8 }}>
          <legend style={{ fontWeight: "bold" }}>Thông tin cá nhân liên hệ</legend>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 15 }}>
            <label style={{ display: "flex", flexDirection: "column" }}>Họ và tên
              <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)} style={{ padding: 8, marginTop: 5, border: "1px solid #ccc", borderRadius: 4 }} />
            </label>
            <label style={{ display: "flex", flexDirection: "column" }}>Số điện thoại
              <input type="tel" required value={phone} onChange={e => setPhone(e.target.value)} style={{ padding: 8, marginTop: 5, border: "1px solid #ccc", borderRadius: 4 }} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gridColumn: "1 / -1" }}>Email nhận thông tin
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} style={{ padding: 8, marginTop: 5, border: "1px solid #ccc", borderRadius: 4 }} />
            </label>
          </div>
        </fieldset>

        <fieldset style={{ border: "1px solid #ddd", padding: 20, borderRadius: 8 }}>
          <legend style={{ fontWeight: "bold" }}>Thông tin thuê xe {bike && `(${bike.name})`}</legend>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 15 }}>
            <label style={{ display: "flex", flexDirection: "column" }}>Ngày nhận
              <input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: 8, marginTop: 5, border: "1px solid #ccc", borderRadius: 4 }} />
            </label>
            <label style={{ display: "flex", flexDirection: "column" }}>Ngày trả
              <input type="date" required value={endDate} onChange={e => setEndDate(e.target.value)} style={{ padding: 8, marginTop: 5, border: "1px solid #ccc", borderRadius: 4 }} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gridColumn: "1 / -1" }}>Địa điểm nhận xe
              <select value={locationId} onChange={e => setLocationId(e.target.value)} style={{ padding: 8, marginTop: 5, border: "1px solid #ccc", borderRadius: 4 }}>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gridColumn: "1 / -1" }}>Ghi chú đơn hàng
              <textarea value={note} onChange={e => setNote(e.target.value)} style={{ padding: 8, marginTop: 5, border: "1px solid #ccc", borderRadius: 4 }} rows={3} />
            </label>
          </div>
        </fieldset>

        <fieldset style={{ border: "1px solid #ddd", padding: 20, borderRadius: 8 }}>
          <legend style={{ fontWeight: "bold" }}>Xác minh giấy tờ trực tiếp (Bắt buộc)</legend>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 15 }}>
            <div>
              <p style={{ margin: "0 0 10px 0", fontSize: 14 }}>Ảnh CCCD (Mặt trước)</p>
              <input type="file" accept="image/*" required onChange={e => handleFileChange(e, setIdCardFront)} />
              {idCardFront && <img src={URL.createObjectURL(idCardFront)} alt="Preview" style={{ width: 100, height: 60, objectFit: "cover", marginTop: 10, display: "block" }} />}
            </div>
            <div>
              <p style={{ margin: "0 0 10px 0", fontSize: 14 }}>Ảnh CCCD (Mặt sau)</p>
              <input type="file" accept="image/*" required onChange={e => handleFileChange(e, setIdCardBack)} />
              {idCardBack && <img src={URL.createObjectURL(idCardBack)} alt="Preview" style={{ width: 100, height: 60, objectFit: "cover", marginTop: 10, display: "block" }} />}
            </div>
            <div>
              <p style={{ margin: "0 0 10px 0", fontSize: 14 }}>Bằng lái xe (Mặt trước)</p>
              <input type="file" accept="image/*" required onChange={e => handleFileChange(e, setDriverLicenseFront)} />
              {driverLicenseFront && <img src={URL.createObjectURL(driverLicenseFront)} alt="Preview" style={{ width: 100, height: 60, objectFit: "cover", marginTop: 10, display: "block" }} />}
            </div>
            <div>
              <p style={{ margin: "0 0 10px 0", fontSize: 14 }}>Bằng lái xe (Mặt sau)</p>
              <input type="file" accept="image/*" required onChange={e => handleFileChange(e, setDriverLicenseBack)} />
              {driverLicenseBack && <img src={URL.createObjectURL(driverLicenseBack)} alt="Preview" style={{ width: 100, height: 60, objectFit: "cover", marginTop: 10, display: "block" }} />}
            </div>
          </div>
        </fieldset>

        <button type="submit" disabled={loading} style={{ padding: 15, background: "#f26522", color: "white", fontSize: 16, fontWeight: "bold", border: "none", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer" }}>
          {loading ? "Đang xử lý..." : "Hoàn tất đặt xe"}
        </button>
      </form>
    </main>
  );
}
