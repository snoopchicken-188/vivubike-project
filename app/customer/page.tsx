"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { addDoc, collection, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

type View = "overview" | "rent" | "bookings" | "verify" | "reviews" | "profile";
type BookingStatus = "Chờ xác nhận" | "Đã xác nhận" | "Đang thuê" | "Đã hoàn thành";
type DocumentKey = "cccdFront" | "cccdBack" | "driverLicense";

type Bike = { id: string; name: string; type: string; price: number; image: string; note: string };
type Location = { id: string; name: string };
type Booking = { code: string; bike: string; dates: string; location: string; total: string; status: BookingStatus };

const menu: { id: View; icon: string; label: string }[] = [
  { id: "overview", icon: "▦", label: "Tổng quan" },
  { id: "rent", icon: "⌁", label: "Thuê xe" },
  { id: "bookings", icon: "▤", label: "Đơn thuê của tôi" },
  { id: "verify", icon: "✓", label: "Xác minh tài khoản" },
  { id: "reviews", icon: "★", label: "Đánh giá của tôi" },
  { id: "profile", icon: "◉", label: "Hồ sơ cá nhân" },
];

const statusClass = (status: string) => status === "Đã hoàn thành" ? "done" : status === "Đang thuê" ? "active" : status === "Đã xác nhận" ? "confirmed" : "pending";
const initials = (name: string) => name.split(" ").filter(Boolean).slice(-2).map((word) => word[0]).join("").toUpperCase() || "KH";
const verificationLabel = (status: string) => status === "approved" ? "Đã xác minh" : status === "staff_approved" ? "Chờ Admin duyệt cuối" : status === "pending" ? "Đang chờ Staff kiểm tra" : status === "needs_update" ? "Cần bổ sung hồ sơ" : status === "rejected" ? "Hồ sơ bị từ chối" : "Chưa xác minh";

export default function CustomerPage() {
  const searchParams = useSearchParams();
  const [view, setView] = useState<View>("overview");
  const [notice, setNotice] = useState("");
  const [verificationSent, setVerificationSent] = useState(false);
  const [documentPreviews, setDocumentPreviews] = useState<Record<DocumentKey, string>>({ cccdFront: "", cccdBack: "", driverLicense: "" });
  const [bookingFilter, setBookingFilter] = useState("Tất cả");
  const [account, setAccount] = useState({ fullName: "Khách hàng", email: "", phone: "", role: "Customer", verificationStatus: "not_submitted" });
  const [uid, setUid] = useState("");
  const [bikes, setBikes] = useState<Bike[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedBikeId, setSelectedBikeId] = useState("");

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      setUid(user.uid);
      try {
        const profile = await getDoc(doc(db, "users", user.uid));
        if (!profile.exists()) {
          const fullName = user.displayName || user.email || "Khách hàng";
          await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            fullName,
            email: user.email || "",
            phone: "",
            role: "customer",
            verificationStatus: "not_submitted",
            createdAt: serverTimestamp(),
          });
        }
        const currentProfile = profile.exists() ? profile.data() : { fullName: user.displayName || user.email || "Khách hàng", email: user.email || "", phone: "", verificationStatus: "not_submitted" };
        setAccount({
          fullName: String(currentProfile.fullName || user.displayName || user.email || "Khách hàng"),
          email: String(currentProfile.email || user.email || ""),
          phone: String(currentProfile.phone || ""),
          role: "Customer",
          verificationStatus: String(currentProfile.verificationStatus || "not_submitted"),
        });
      } catch {
        setAccount({ fullName: user.displayName || user.email || "Khách hàng", email: user.email || "", phone: "", role: "Customer", verificationStatus: "not_submitted" });
      }
    });
  }, []);

  useEffect(() => {
    return onSnapshot(
      collection(db, "vehicles"),
      (snapshot) => {
        setBikes(snapshot.docs.map((item) => {
          const data = item.data();
          return { id: item.id, name: String(data.name || "Xe chưa đặt tên"), type: String(data.type || "Khác"), price: Number(data.dailyPrice || 0), image: String(data.image || ""), note: String(data.description || "") };
        }).filter((bike) => bike.price > 0));
      },
      () => notify("Không thể tải danh sách xe.")
    );
  }, []);

  useEffect(() => {
    return onSnapshot(
      collection(db, "locations"),
      (snapshot) => {
        setLocations(snapshot.docs.filter((item) => item.data().isActive !== false).map((item) => ({ id: item.id, name: String(item.data().name || "") })).filter((item) => item.name));
      },
      () => notify("Không thể tải địa điểm nhận xe.")
    );
  }, []);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      query(collection(db, "bookings"), where("customerId", "==", uid)),
      (snapshot) => {
        setBookings(snapshot.docs.map((item) => {
          const data = item.data();
          return { code: String(data.code || item.id), bike: String(data.vehicleName || "Xe thuê"), dates: `${String(data.startDate || "")} — ${String(data.endDate || "")}`, location: String(data.pickupLocationName || ""), total: `${new Intl.NumberFormat("vi-VN").format(Number(data.totalAmount || 0))}đ`, status: String(data.status || "Chờ xác nhận") as BookingStatus };
        }));
      },
      () => notify("Không thể tải đơn thuê. Hãy kiểm tra Firestore Rules cho collection bookings.")
    );
  }, [uid]);

  useEffect(() => {
    const vehicleId = searchParams.get("vehicleId");
    if (searchParams.get("view") === "rent") setView("rent");
    if (vehicleId) setSelectedBikeId(vehicleId);
  }, [searchParams]);

  const notify = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3300);
  };

  const previewDocument = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    const key = event.currentTarget.name as DocumentKey;
    if (!file || !key) return;
    const reader = new FileReader();
    reader.onload = () => setDocumentPreviews((current) => ({ ...current, [key]: String(reader.result || "") }));
    reader.readAsDataURL(file);
  };

  const sendVerification = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const user = auth.currentUser;
    if (!user) { notify("Bạn cần đăng nhập lại trước khi gửi hồ sơ."); return; }
    const form = new FormData(event.currentTarget);
    const fullName = String(form.get("fullName") || "").trim();
    const identityNumber = String(form.get("identityNumber") || "").trim();
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/verification-upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Không thể tải hồ sơ.");
      await updateDoc(doc(db, "users", user.uid), { fullName, identityNumber, verificationDocuments: result.paths, verificationStatus: "pending", staffProposal: "Chưa có" });
      setAccount((current) => ({ ...current, fullName, verificationStatus: "pending" }));
      setVerificationSent(true);
      notify("Đã gửi hồ sơ. Staff sẽ kiểm tra giấy tờ của bạn.");
    } catch (error) { notify(error instanceof Error ? error.message : "Không thể gửi hồ sơ."); }
  };

  const saveProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    notify("Thông tin hồ sơ đã được cập nhật.");
  };

  const filteredBookings = bookingFilter === "Tất cả" ? bookings : bookings.filter((booking) => booking.status === bookingFilter);

  const createBooking = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const user = auth.currentUser;
    if (!user) return notify("Bạn cần đăng nhập lại.");
    if (account.verificationStatus !== "approved") { setView("verify"); return notify("Tài khoản cần được Staff duyệt trước khi gửi đơn thuê."); }
    const form = new FormData(event.currentTarget);
    const vehicleId = String(form.get("vehicleId") || "");
    const locationId = String(form.get("locationId") || "");
    const startDate = String(form.get("startDate") || "");
    const endDate = String(form.get("endDate") || "");
    const bike = bikes.find((item) => item.id === vehicleId);
    const location = locations.find((item) => item.id === locationId);
    const days = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000);
    if (!bike || !location || !startDate || !endDate || days < 1) return notify("Hãy chọn xe, điểm nhận và ngày trả sau ngày nhận.");
    try {
      const code = `VVB-${Date.now().toString().slice(-6)}`;
      await addDoc(collection(db, "bookings"), { code, customerId: user.uid, customerName: account.fullName, customerEmail: account.email, vehicleId: bike.id, vehicleName: bike.name, dailyPrice: bike.price, pickupLocationId: location.id, pickupLocationName: location.name, startDate, endDate, rentalDays: days, totalAmount: days * bike.price, note: String(form.get("note") || "").trim(), amenities: ["02 mũ bảo hiểm", "01 áo mưa"], status: "Chờ xác nhận", createdAt: serverTimestamp() });
      setView("bookings");
      notify(`Đã tạo đơn ${code}. Staff sẽ liên hệ xác nhận.`);
    } catch { notify("Không thể tạo đơn. Hãy kiểm tra Firestore Rules cho collection bookings."); }
  };

  return (
    <main className="customer-app">
      {notice && <div className="toast">✓ {notice}</div>}

      <aside className="sidebar">
        <a href="/" className="brand"><span>V</span> VI VU <b>BIKE</b></a>
        <div className="customer-card"><div className="avatar">{initials(account.fullName)}</div><div><b>{account.fullName}</b><small>{account.role}</small></div></div>
        <div className="verify-mini"><span>!</span><div><b>{verificationLabel(account.verificationStatus)}</b><small>{account.verificationStatus === "approved" ? "Tài khoản có thể gửi yêu cầu thuê xe." : "Gửi CCCD và bằng lái để đặt xe."}</small></div></div>
        <nav><a className="home-link" href="/">⌂ <span>Trang chủ</span></a><p className="nav-label">HOẠT ĐỘNG THUÊ XE</p>{menu.slice(0, 3).map((item) => <button key={item.id} className={view === item.id ? "selected" : ""} onClick={() => setView(item.id)}><span>{item.icon}</span>{item.label}</button>)}<p className="nav-label">TÀI KHOẢN</p>{menu.slice(3).map((item) => <button key={item.id} className={view === item.id ? "selected" : ""} onClick={() => setView(item.id)}><span>{item.icon}</span>{item.label}</button>)}</nav>
        <button className="logout" onClick={async () => { await signOut(auth); window.location.href = "/"; }}>↪ Đăng xuất</button>
      </aside>

      <section className="content">
        <header className="topbar"><div><p>KHÁCH HÀNG</p><h1>{menu.find((item) => item.id === view)?.label}</h1></div><div className="top-user"><span className="bell">♧</span><div className="avatar small">{initials(account.fullName)}</div><span>{account.fullName}</span></div></header>

        {view === "overview" && <Overview onChangeView={setView} fullName={account.fullName} verificationStatus={account.verificationStatus} />}
        {view === "rent" && <Rent bikes={bikes} locations={locations} selectedBikeId={selectedBikeId} setSelectedBikeId={setSelectedBikeId} verified={account.verificationStatus === "approved"} onBooking={createBooking} />}
        {view === "bookings" && <Bookings filter={bookingFilter} setFilter={setBookingFilter} data={filteredBookings} onDetail={() => notify("Trang chi tiết đơn thuê sẽ được nối với Firestore ở bước tiếp theo.")} />}
        {view === "verify" && <Verification verificationSent={verificationSent} onSubmit={sendVerification} fullName={account.fullName} verificationStatus={account.verificationStatus} previews={documentPreviews} onPreview={previewDocument} />}
        {view === "reviews" && <Reviews />}
        {view === "profile" && <Profile onSubmit={saveProfile} fullName={account.fullName} email={account.email} phone={account.phone} />}
      </section>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box}.customer-app{min-height:100vh;background:#f5f6f7;color:#171717;font-family:"Be Vietnam Pro",Arial,sans-serif;display:grid;grid-template-columns:268px 1fr}.sidebar{background:#151515;color:#fff;padding:26px 16px;display:flex;flex-direction:column;min-height:100vh;position:sticky;top:0;height:100vh}.brand{align-items:center;color:#fff;display:flex;font-size:15px;font-weight:800;gap:8px;letter-spacing:.06em;text-decoration:none;padding:0 8px}.brand>span{background:#f26522;clip-path:polygon(50% 0,100% 18%,82% 100%,18% 100%,0 18%);display:grid;height:31px;place-items:center;width:31px}.brand b{color:#f26522}.customer-card{align-items:center;border-bottom:1px solid #333;display:flex;gap:11px;margin:31px 8px 15px;padding-bottom:17px}.customer-card b,.customer-card small{display:block}.customer-card small{color:#999;font-size:12px;margin-top:3px}.avatar{align-items:center;background:#f26522;border-radius:50%;color:#fff;display:flex;font-size:13px;font-weight:800;height:42px;justify-content:center;width:42px}.avatar.small{height:34px;width:34px;font-size:11px}.verify-mini{background:#292725;display:flex;gap:10px;margin:0 8px 25px;padding:12px}.verify-mini>span{align-items:center;background:#f26522;border-radius:50%;display:flex;font-size:12px;font-weight:800;height:20px;justify-content:center;width:20px}.verify-mini b,.verify-mini small{display:block}.verify-mini b{font-size:12px}.verify-mini small{color:#bbb;font-size:11px;line-height:1.5;margin-top:3px}nav{display:grid;gap:5px}.home-link{color:#fff;font-size:14px;font-weight:700;margin:0 0 4px;padding:12px;text-decoration:none}.home-link span{margin-left:11px}.home-link:hover{background:#292929}.nav-label{color:#777;font-size:10px;font-weight:800;letter-spacing:.11em;margin:17px 12px 5px}nav button,.logout{background:transparent;border:0;color:#aaa;font-size:14px;font-weight:600;padding:12px;text-align:left}nav button span{display:inline-block;font-size:17px;margin-right:12px;width:18px}nav button:hover,nav button.selected{background:#f26522;color:#fff}.logout{border-top:1px solid #333;margin:25px 8px 0;padding-left:4px}.content{min-width:0}.topbar{align-items:center;background:#fff;display:flex;justify-content:space-between;padding:22px clamp(22px,4vw,56px)}.topbar p{color:#f26522;font-size:11px;font-weight:800;letter-spacing:.13em;margin:0 0 5px}.topbar h1{font-size:27px;letter-spacing:-.04em;margin:0}.top-user{align-items:center;display:flex;font-size:13px;font-weight:700;gap:10px}.bell{font-size:22px;margin-right:10px}.page{margin:auto;max-width:1250px;padding:32px clamp(22px,4vw,56px) 60px}.notice-box{align-items:center;background:#fff4ed;border:1px solid #ffd5bd;display:flex;gap:16px;justify-content:space-between;margin-bottom:28px;padding:18px 20px}.notice-box h3{font-size:15px;margin:0 0 5px}.notice-box p{color:#6c5a51;font-size:13px;margin:0}.notice-icon{background:#f26522;border-radius:50%;color:#fff;display:grid;font-weight:800;height:30px;place-items:center;width:30px}.button{background:#f26522;border:0;color:#fff;font-size:13px;font-weight:800;padding:12px 16px;white-space:nowrap}.button:hover{background:#d94c0f}.button.light{background:#fff;border:1px solid #dadada;color:#222}.button.light:hover{background:#f2f2f2}.overview-title{margin:0 0 24px}.overview-title h2{font-size:25px;letter-spacing:-.04em;margin:0 0 7px}.overview-title p{color:#666;font-size:14px;margin:0}.stats{display:grid;gap:18px;grid-template-columns:repeat(3,1fr);margin-bottom:30px}.stat{background:#fff;border:1px solid #e8e8e8;padding:21px}.stat p{color:#666;font-size:13px;margin:0 0 16px}.stat b{font-size:29px;letter-spacing:-.05em}.stat span{color:#20a66a;display:block;font-size:11px;font-weight:700;margin-top:7px}.panel{background:#fff;border:1px solid #e5e5e5;margin-top:20px}.panel-head{align-items:center;border-bottom:1px solid #e8e8e8;display:flex;justify-content:space-between;padding:20px 23px}.panel-head h2{font-size:17px;margin:0}.panel-head button{background:none;border:0;color:#e95c20;font-size:13px;font-weight:800}.booking-preview{align-items:center;display:grid;gap:18px;grid-template-columns:auto 1.4fr 1fr 1fr auto;padding:21px 23px}.bike-round{align-items:center;background:#f3f3f3;border-radius:50%;display:flex;height:47px;justify-content:center;width:47px}.bike-round span{font-size:22px}.booking-preview b,.booking-preview small{display:block}.booking-preview b{font-size:14px}.booking-preview small{color:#777;font-size:12px;line-height:1.5;margin-top:5px}.tag{border-radius:50px;display:inline-block;font-size:11px;font-weight:800;padding:7px 10px}.tag.pending{background:#fff2dc;color:#a56600}.tag.confirmed{background:#e8efff;color:#2058a6}.tag.active{background:#dff6ea;color:#0f8a4a}.tag.done{background:#edf0f2;color:#5b6268}.quick-actions{display:grid;gap:18px;grid-template-columns:repeat(3,1fr)}.quick-actions button{background:#fff;border:1px solid #e5e5e5;font-size:14px;font-weight:800;padding:20px;text-align:left}.quick-actions button:hover{border-color:#f26522;color:#e95c20}.quick-actions span{color:#f26522;display:block;font-size:20px;margin-bottom:15px}.section-title{align-items:end;display:flex;justify-content:space-between;margin-bottom:23px}.section-title h2{font-size:25px;letter-spacing:-.04em;margin:0 0 7px}.section-title p{color:#666;font-size:14px;margin:0}.bike-grid{display:grid;gap:20px;grid-template-columns:repeat(3,1fr)}.bike-card{background:#fff;border:1px solid #e5e5e5}.bike-card img{display:block;height:175px;object-fit:cover;width:100%}.bike-card main{padding:18px}.bike-card small{color:#f26522;font-size:12px;font-weight:800}.bike-card h3{font-size:18px;margin:8px 0}.bike-card p{color:#666;font-size:12px;line-height:1.5;margin:0 0 17px}.price-row{align-items:center;border-top:1px solid #eee;display:flex;justify-content:space-between;padding-top:15px}.price-row b{color:#e95c20;font-size:14px}.table-filters{display:flex;gap:8px}.table-filters button{background:#fff;border:1px solid #ddd;font-size:12px;padding:9px 12px}.table-filters button.active{background:#171717;border-color:#171717;color:#fff}.booking-table{width:100%;border-collapse:collapse}.booking-table th{background:#f7f7f7;color:#777;font-size:12px;text-align:left}.booking-table td,.booking-table th{border-bottom:1px solid #eee;padding:16px}.booking-table td{font-size:13px}.booking-table b{display:block}.booking-table small{color:#777;display:block;font-size:11px;margin-top:4px}.text-button{background:none;border:0;color:#e95c20;font-size:12px;font-weight:800}.verify-layout{display:grid;gap:22px;grid-template-columns:1.25fr .75fr}.verify-form{background:#fff;border:1px solid #e5e5e5;padding:26px}.verify-form h2{font-size:20px;margin:0 0 8px}.verify-form>p{color:#666;font-size:13px;line-height:1.6;margin:0 0 23px}.form-grid{display:grid;gap:16px;grid-template-columns:1fr 1fr}.field{display:grid;gap:7px;font-size:12px;font-weight:800}.field input{border:1px solid #ddd;font:inherit;padding:11px}.upload-grid{display:grid;gap:14px;grid-template-columns:repeat(3,1fr);margin:21px 0}.upload{border:1px dashed #bdbdbd;cursor:pointer;display:grid;min-height:116px;place-items:center;padding:15px;text-align:center}.upload input{display:none}.upload span{color:#e95c20;display:block;font-size:20px}.upload b{display:block;font-size:12px;margin-top:8px}.upload small{color:#777;font-size:10px;margin-top:5px}.upload.has-preview{border-color:#f26522;padding:5px;position:relative}.upload.has-preview img{height:104px;object-fit:cover;width:100%}.upload.has-preview em{background:rgba(0,0,0,.7);bottom:5px;color:#fff;font-size:10px;font-style:normal;font-weight:700;left:5px;padding:5px 7px;position:absolute;right:5px}.verify-side{background:#171717;color:#fff;padding:25px}.verify-side h3{font-size:18px;margin:0 0 20px}.verify-step{border-top:1px solid #444;display:flex;gap:12px;padding:15px 0}.verify-step span{color:#f26522;font-size:13px;font-weight:800}.verify-step b,.verify-step small{display:block}.verify-step b{font-size:13px}.verify-step small{color:#bbb;font-size:11px;line-height:1.5;margin-top:4px}.review-card{background:#fff;border:1px solid #e5e5e5;padding:24px}.review-card h3{font-size:17px;margin:0 0 7px}.review-card p{color:#666;font-size:13px;margin:0 0 20px}.stars{display:flex;gap:5px;margin-bottom:20px}.stars button{background:none;border:0;color:#f26522;font-size:26px;padding:0}.review-card textarea{border:1px solid #ddd;font:inherit;min-height:100px;padding:12px;resize:vertical;width:100%}.review-card .button{margin-top:14px}.profile-form{background:#fff;border:1px solid #e5e5e5;max-width:720px;padding:27px}.profile-form h2{font-size:20px;margin:0 0 23px}.profile-form .form-grid{margin-bottom:20px}.toast{background:#171717;box-shadow:0 12px 28px rgba(0,0,0,.2);color:#fff;font-size:14px;left:50%;padding:14px 19px;position:fixed;top:20px;transform:translateX(-50%);z-index:20}@media(max-width:1000px){.customer-app{grid-template-columns:220px 1fr}.bike-grid{grid-template-columns:1fr 1fr}.booking-preview{grid-template-columns:auto 1fr 1fr}.booking-preview .button{grid-column:2}.verify-layout{grid-template-columns:1fr}}@media(max-width:720px){.customer-app{display:block}.sidebar{height:auto;min-height:auto;position:static}.sidebar nav{display:flex;overflow:auto}.sidebar nav button{flex:0 0 auto}.sidebar nav button span{display:none}.customer-card,.verify-mini,.logout{display:none}.content{min-width:0}.topbar{padding:17px 20px}.top-user>span:not(.bell){display:none}.topbar h1{font-size:22px}.page{padding:25px 18px}.notice-box{align-items:start;flex-wrap:wrap}.stats,.quick-actions,.bike-grid{grid-template-columns:1fr}.booking-preview{grid-template-columns:auto 1fr}.booking-preview>div:nth-of-type(2),.booking-preview>div:nth-of-type(3){grid-column:2}.booking-preview .button{grid-column:1/-1}.section-title{align-items:start;flex-direction:column;gap:15px}.table-filters{overflow:auto;width:100%}.booking-table{min-width:650px}.panel{overflow-x:auto}.form-grid,.upload-grid{grid-template-columns:1fr}.top-user .bell{margin:0}.sidebar{padding:18px 12px}.brand{padding:0}.sidebar nav{margin-top:18px}.nav-label{display:none}.home-link{display:none}}
      `}</style>
    </main>
  );
}

function Overview({ onChangeView, fullName, verificationStatus }: { onChangeView: (view: View) => void; fullName: string; verificationStatus: string }) {
  const verified = verificationStatus === "approved";
  return <div className="page">{!verified && <div className="notice-box"><div className="notice-icon">!</div><div><h3>{verificationLabel(verificationStatus)}</h3><p>Gửi CCCD/CMND và bằng lái để có thể gửi yêu cầu thuê xe.</p></div><button className="button" onClick={() => onChangeView("verify")}>Xác minh ngay</button></div>}<div className="overview-title"><h2>Chào {fullName},</h2><p>Các số liệu dưới đây sẽ được cập nhật khi bạn có đơn thuê thực tế.</p></div><div className="stats"><article className="stat"><p>Đơn đang chờ</p><b>0</b><span>Chưa có dữ liệu đơn thuê</span></article><article className="stat"><p>Lượt thuê hoàn thành</p><b>0</b><span>Chưa có lượt thuê hoàn thành</span></article><article className="stat"><p>Trạng thái tài khoản</p><b>{verificationLabel(verificationStatus)}</b><span>{verified ? "Tài khoản đã đủ điều kiện thuê xe" : "Cập nhật từ hồ sơ xác minh"}</span></article></div><section className="panel"><div className="panel-head"><h2>Đơn thuê gần nhất</h2><button onClick={() => onChangeView("bookings")}>Xem đơn thuê →</button></div><div className="booking-preview"><div className="bike-round"><span>⌁</span></div><div><b>Bạn chưa có đơn thuê nào</b><small>Chọn xe để gửi yêu cầu thuê đầu tiên của bạn.</small></div><button className="button light" onClick={() => onChangeView("rent")}>Xem xe cho thuê</button></div></section><section className="panel"><div className="panel-head"><h2>Thao tác nhanh</h2></div><div className="quick-actions"><button onClick={() => onChangeView("rent")}><span>⌁</span>Thuê xe mới</button><button onClick={() => onChangeView("verify")}><span>✓</span>Gửi hồ sơ xác minh</button><button onClick={() => onChangeView("profile")}><span>◉</span>Cập nhật hồ sơ</button></div></section></div>;
}

function Rent({ bikes, locations, selectedBikeId, setSelectedBikeId, verified, onBooking }: { bikes: Bike[]; locations: Location[]; selectedBikeId: string; setSelectedBikeId: (id: string) => void; verified: boolean; onBooking: (event: FormEvent<HTMLFormElement>) => Promise<void> }) {
  const selectedBike = bikes.find((bike) => bike.id === selectedBikeId);
  const money = (value: number) => `${new Intl.NumberFormat("vi-VN").format(value)}đ/ngày`;
  return <div className="page"><div className="section-title"><div><h2>Xe cho thuê</h2><p>Chọn xe, lịch nhận/trả và gửi yêu cầu thuê trực tiếp.</p></div></div>{bikes.length === 0 ? <section className="panel"><div className="booking-preview"><div className="bike-round"><span>⌁</span></div><div><b>Chưa có xe để hiển thị</b><small>Admin chưa thêm xe đang hoạt động.</small></div></div></section> : <div className="bike-grid">{bikes.map((bike) => <article className="bike-card" key={bike.id}><img src={bike.image} alt={bike.name} /><main><small>{bike.type}</small><h3>{bike.name}</h3><p>{bike.note || "Xe sẵn sàng phục vụ hành trình của bạn."}</p><div className="price-row"><b>{money(bike.price)}</b><button className="button" onClick={() => setSelectedBikeId(bike.id)}>Chọn xe</button></div></main></article>)}</div>}{selectedBike && <form className="booking-form" onSubmit={onBooking}><h2>Đặt {selectedBike.name}</h2><p>Đơn sẽ ở trạng thái <b>Chờ xác nhận</b> cho đến khi Staff xử lý.</p><input type="hidden" name="vehicleId" value={selectedBike.id} /><div className="form-grid"><label className="field">Xe đã chọn<input value={`${selectedBike.name} · ${money(selectedBike.price)}`} readOnly /></label><label className="field">Điểm nhận xe<select name="locationId" required defaultValue=""><option value="" disabled>Chọn địa điểm</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label><label className="field">Ngày nhận<input name="startDate" type="date" required /></label><label className="field">Ngày trả<input name="endDate" type="date" required /></label></div><label className="field">Ghi chú cho Staff<textarea name="note" placeholder="Ví dụ: thời gian dự kiến đến nhận xe" /></label><small className="included">Đi kèm: 02 mũ bảo hiểm · 01 áo mưa</small><div><button className="button" disabled={!verified}>{verified ? "Gửi yêu cầu thuê xe" : "Cần xác minh tài khoản"}</button><button type="button" className="text-button cancel-choice" onClick={() => setSelectedBikeId("")}>Bỏ chọn</button></div></form>}<section className="panel"><div className="panel-head"><h2>Lưu ý khi đặt xe</h2></div><div className="booking-preview"><div className="bike-round"><span>!</span></div><div><b>{verified ? "Hồ sơ đã xác minh" : "Tài khoản cần được xác minh"}</b><small>{verified ? "Bạn có thể gửi yêu cầu; Staff sẽ xác nhận lịch và tình trạng xe." : "Staff chỉ xác nhận đơn sau khi hồ sơ xác minh hợp lệ."}</small></div></div></section></div>;
}

function Bookings({ filter, setFilter, data, onDetail }: { filter: string; setFilter: (value: string) => void; data: Booking[]; onDetail: () => void }) {
  const filters = ["Tất cả", "Chờ xác nhận", "Đã xác nhận", "Đang thuê", "Đã hoàn thành"];
  return <div className="page"><div className="section-title"><div><h2>Đơn thuê của tôi</h2><p>Theo dõi trạng thái và thông tin nhận/trả xe.</p></div><div className="table-filters">{filters.map((item) => <button className={filter === item ? "active" : ""} key={item} onClick={() => setFilter(item)}>{item}</button>)}</div></div><section className="panel"><table className="booking-table"><thead><tr><th>Mã đơn / Xe</th><th>Thời gian thuê</th><th>Điểm nhận xe</th><th>Tổng tiền</th><th>Trạng thái</th><th></th></tr></thead><tbody>{data.map((booking) => <tr key={booking.code}><td><b>{booking.code}</b><small>{booking.bike}</small></td><td>{booking.dates}</td><td>{booking.location}</td><td>{booking.total}</td><td><span className={`tag ${statusClass(booking.status)}`}>{booking.status}</span></td><td><button className="text-button" onClick={onDetail}>Chi tiết</button></td></tr>)}{data.length === 0 && <tr><td colSpan={6}>Không có đơn thuê phù hợp.</td></tr>}</tbody></table></section></div>;
}

function Verification({ verificationSent, onSubmit, fullName, verificationStatus, previews, onPreview }: { verificationSent: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>; fullName: string; verificationStatus: string; previews: Record<DocumentKey, string>; onPreview: (event: ChangeEvent<HTMLInputElement>) => void }) {
  const isPending = verificationSent || verificationStatus === "pending";
  return <div className="page"><div className="section-title"><div><h2>Xác minh tài khoản</h2><p>Hồ sơ được Staff kiểm tra trước khi bạn nhận xe.</p></div><span className={`tag ${isPending ? "pending" : "done"}`}>{isPending ? "Đang chờ xác minh" : verificationLabel(verificationStatus)}</span></div><div className="verify-layout"><form className="verify-form" onSubmit={onSubmit}><h2>Thông tin xác minh</h2><p>Vui lòng dùng ảnh rõ nét, đủ bốn góc. Giấy tờ chỉ phục vụ cho việc xác minh thuê xe.</p><div className="form-grid"><label className="field">Họ và tên<input name="fullName" defaultValue={fullName === "Khách hàng" ? "" : fullName} required /></label><label className="field">Số CCCD/CMND<input name="identityNumber" required placeholder="Nhập số giấy tờ" /></label></div><div className="upload-grid"><label className={`upload ${previews.cccdFront ? "has-preview" : ""}`}><input name="cccdFront" type="file" accept="image/jpeg,image/png,image/webp" required onChange={onPreview} />{previews.cccdFront ? <><img src={previews.cccdFront} alt="Xem trước CCCD mặt trước" /><em>Đổi ảnh CCCD mặt trước</em></> : <><span>↑</span><b>CCCD/CMND mặt trước</b><small>JPG, PNG · tối đa 5MB</small></>}</label><label className={`upload ${previews.cccdBack ? "has-preview" : ""}`}><input name="cccdBack" type="file" accept="image/jpeg,image/png,image/webp" required onChange={onPreview} />{previews.cccdBack ? <><img src={previews.cccdBack} alt="Xem trước CCCD mặt sau" /><em>Đổi ảnh CCCD mặt sau</em></> : <><span>↑</span><b>CCCD/CMND mặt sau</b><small>JPG, PNG · tối đa 5MB</small></>}</label><label className={`upload ${previews.driverLicense ? "has-preview" : ""}`}><input name="driverLicense" type="file" accept="image/jpeg,image/png,image/webp" required onChange={onPreview} />{previews.driverLicense ? <><img src={previews.driverLicense} alt="Xem trước bằng lái xe" /><em>Đổi ảnh bằng lái</em></> : <><span>↑</span><b>Bằng lái xe</b><small>JPG, PNG · tối đa 5MB</small></>}</label></div><button className="button" disabled={isPending}>{isPending ? "Hồ sơ đang chờ kiểm tra" : "Gửi hồ sơ xác minh"}</button></form><aside className="verify-side"><h3>Quy trình duyệt hồ sơ</h3><div className="verify-step"><span>01</span><div><b>Gửi giấy tờ</b><small>Điền thông tin và chọn đủ ba ảnh giấy tờ.</small></div></div><div className="verify-step"><span>02</span><div><b>Staff kiểm tra</b><small>Nhân viên đối chiếu thông tin và chất lượng ảnh.</small></div></div><div className="verify-step"><span>03</span><div><b>Nhận kết quả</b><small>Bạn có thể đặt xe khi hồ sơ được duyệt.</small></div></div></aside></div></div>;
}

function Reviews() {
  return <div className="page"><div className="section-title"><div><h2>Đánh giá của tôi</h2><p>Bạn có thể đánh giá sau khi hoàn thành một đơn thuê.</p></div></div><section className="review-card"><h3>Chưa có đơn thuê đủ điều kiện đánh giá</h3><p>Khi Staff hoàn tất đơn thuê, đơn đó sẽ xuất hiện tại đây để bạn gửi phản hồi.</p></section></div>;
}

function Profile({ onSubmit, fullName, email, phone }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void; fullName: string; email: string; phone: string }) {
  return <div className="page"><div className="section-title"><div><h2>Hồ sơ cá nhân</h2><p>Cập nhật thông tin liên hệ của bạn.</p></div></div><form className="profile-form" onSubmit={onSubmit}><h2>Thông tin cơ bản</h2><div className="form-grid"><label className="field">Họ và tên<input defaultValue={fullName} required /></label><label className="field">Số điện thoại<input defaultValue={phone} required placeholder="Nhập số điện thoại" /></label><label className="field">Email<input defaultValue={email} type="email" required /></label><label className="field">Địa chỉ<input placeholder="Nhập địa chỉ của bạn" /></label></div><button className="button">Lưu thay đổi</button></form></div>;
}
