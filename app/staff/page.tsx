"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "../../lib/firebase";

type Status = "pending" | "needs_update" | "staff_approved" | "rejected" | "approved" | "not_submitted";
type Customer = { id: string; fullName: string; email: string; phone: string; verificationStatus: Status; staffName: string; staffNote: string };
type Detail = { customer: Customer & { identityNumber: string }; documents: Record<string, string> };
type Booking = { id: string; code: string; customerName: string; customerEmail: string; vehicleName: string; pickupLocationName: string; startDate: string; endDate: string; totalAmount: number; status: string; staffId: string };
type View = "overview" | "verification" | "assigned" | "handover" | "return" | "profile";

const menu: { id: View; icon: string; label: string; group?: string }[] = [
  { id: "overview", icon: "▦", label: "Tổng quan" },
  { id: "verification", icon: "✓", label: "Hồ sơ cần xác minh", group: "XỬ LÝ HỒ SƠ" },
  { id: "assigned", icon: "▤", label: "Đơn thuê được phân công" },
  { id: "handover", icon: "↗", label: "Giao xe", group: "VẬN HÀNH" },
  { id: "return", icon: "↙", label: "Nhận xe trả" },
  { id: "profile", icon: "◉", label: "Hồ sơ cá nhân", group: "TÀI KHOẢN" },
];

const label = (status: string) => ({ pending: "Chờ kiểm tra", needs_update: "Cần bổ sung", staff_approved: "Chờ Admin duyệt", approved: "Đã xác minh", rejected: "Đã từ chối", not_submitted: "Chưa gửi" }[status] || status);
const initials = (name: string) => name.split(" ").filter(Boolean).slice(-2).map((part) => part[0]).join("").toUpperCase() || "NV";

export default function StaffPage() {
  const router = useRouter();
  const [view, setView] = useState<View>("overview");
  const [staff, setStaff] = useState({ fullName: "", email: "" });
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [loadError, setLoadError] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [note, setNote] = useState("");
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  const notify = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 3500); };

  useEffect(() => onAuthStateChanged(auth, async (user) => {
    if (!user) { router.replace("/"); return; }
    try {
      const profile = await getDoc(doc(db, "users", user.uid));
      if (!profile.exists() || profile.data()?.role !== "staff") { router.replace("/"); return; }
      setStaff({ fullName: String(profile.data()?.fullName || user.email || "Nhân viên"), email: user.email || "" });
    } catch { router.replace("/"); }
    finally { setLoading(false); }
  }), [router]);

  useEffect(() => onSnapshot(collection(db, "users"), (snapshot) => {
    setLoadError("");
    setCustomers(snapshot.docs.map((item) => {
      const data = item.data();
      return { id: item.id, fullName: String(data.fullName || "Chưa cập nhật"), email: String(data.email || ""), phone: String(data.phone || ""), verificationStatus: String(data.verificationStatus || "not_submitted") as Status, staffName: String(data.staffName || ""), staffNote: String(data.staffNote || "") };
    }).filter((item) => String(snapshot.docs.find((docItem) => docItem.id === item.id)?.data().role || "").toLowerCase() === "customer"));
  }, () => setLoadError("Tài khoản Staff chưa có quyền đọc hồ sơ. Hãy cập nhật Firestore Rules.")), []);

  useEffect(() => onSnapshot(collection(db, "bookings"), (snapshot) => {
    setBookings(snapshot.docs.map((item) => {
      const data = item.data();
      return { id: item.id, code: String(data.code || item.id), customerName: String(data.customerName || "Khách hàng"), customerEmail: String(data.customerEmail || ""), vehicleName: String(data.vehicleName || "Xe thuê"), pickupLocationName: String(data.pickupLocationName || ""), startDate: String(data.startDate || ""), endDate: String(data.endDate || ""), totalAmount: Number(data.totalAmount || 0), status: String(data.status || "Chờ xác nhận"), staffId: String(data.staffId || "") };
    }));
  }, () => setLoadError("Tài khoản Staff chưa có quyền đọc đơn thuê. Hãy Publish Firestore Rules mới.")), []);

  const pending = customers.filter((item) => item.verificationStatus === "pending");
  const shown = filter === "all" ? customers.filter((item) => ["pending", "needs_update", "approved", "rejected"].includes(item.verificationStatus)) : pending;
  const reviewedToday = customers.filter((item) => item.staffName === staff.fullName && ["approved", "needs_update", "rejected"].includes(item.verificationStatus)).length;
  const pendingBookings = bookings.filter((item) => item.status === "Chờ xác nhận");
  const assignedBookings = bookings.filter((item) => item.staffId === auth.currentUser?.uid || (!item.staffId && item.status === "Chờ xác nhận"));
  const currentTitle = menu.find((item) => item.id === view)?.label || "Staff";

  const openDetail = async (customerId: string) => {
    const user = auth.currentUser;
    if (!user) return;
    setDetailLoading(true); setDetail(null); setNote("");
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/staff-verification?customerId=${customerId}`, { headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Không thể mở hồ sơ.");
      setDetail(result); setNote(result.customer.staffNote || "");
    } catch (error) { notify(error instanceof Error ? error.message : "Không thể mở hồ sơ."); }
    finally { setDetailLoading(false); }
  };

  const submitDecision = async (action: "approved" | "needs_update" | "rejected") => {
    const user = auth.currentUser;
    if (!user || !detail) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/staff-verification", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ customerId: detail.customer.id, action, note }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Không thể cập nhật hồ sơ.");
      setDetail(null);
      notify(action === "approved" ? "Đã duyệt hồ sơ. Customer có thể gửi yêu cầu thuê xe." : action === "needs_update" ? "Đã yêu cầu Customer bổ sung hồ sơ." : "Đã từ chối hồ sơ kèm lý do.");
    } catch (error) { notify(error instanceof Error ? error.message : "Không thể cập nhật hồ sơ."); }
  };

  const confirmBooking = async (booking: Booking) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await updateDoc(doc(db, "bookings", booking.id), { status: "Đã xác nhận", staffId: user.uid, staffName: staff.fullName, confirmedAt: new Date().toISOString() });
      notify(`Đã xác nhận đơn ${booking.code}.`);
    } catch { notify("Không thể xác nhận đơn. Kiểm tra lại Firestore Rules."); }
  };

  const menuItems = useMemo(() => menu, []);
  if (loading) return <main className="loading">Đang kiểm tra quyền truy cập…</main>;

  return <main className="staff-shell">
    {notice && <div className="toast">✓ {notice}</div>}
    <aside className="sidebar"><a href="/" className="brand"><span>V</span> VI VU <b>BIKE</b></a><div className="user"><div className="avatar">{initials(staff.fullName)}</div><div><b>{staff.fullName}</b><small>Staff</small></div></div><nav><a href="/">⌂ <span>Trang chủ</span></a>{menuItems.map((item, index) => <div key={item.id}>{item.group && <p>{item.group}</p>}<button className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}><i>{item.icon}</i>{item.label}</button></div>)}</nav><button className="logout" onClick={async () => { await signOut(auth); router.replace("/"); }}>↪ Đăng xuất</button></aside>
    <section className="main"><header><div><p>NHÂN VIÊN VẬN HÀNH</p><h1>{currentTitle}</h1></div><div className="header-user"><span className="role">STAFF</span><div className="avatar small">{initials(staff.fullName)}</div><b>{staff.fullName}</b></div></header>
      {view === "overview" && <div className="page"><div className="intro"><h2>Xin chào, {staff.fullName}</h2><p>Chỉ các dữ liệu hồ sơ và đơn thuê thực tế mới hiển thị tại đây.</p></div>{loadError && <div className="alert">{loadError}</div>}<div className="stats"><article><span>Hồ sơ chờ kiểm tra</span><b>{pending.length}</b><small>{pending.length ? "Cần mở hồ sơ để kiểm tra giấy tờ" : "Chưa có hồ sơ cần xử lý"}</small></article><article><span>Đã đề xuất xử lý</span><b>{reviewedToday}</b><small>Hiển thị theo dữ liệu đang có</small></article><article><span>Đơn thuê chờ xác nhận</span><b>{pendingBookings.length}</b><small>{pendingBookings.length ? "Cần kiểm tra lịch thuê và xác nhận" : "Chưa có đơn thuê mới"}</small></article></div><section className="panel"><div className="panel-head"><h2>Đơn thuê mới</h2><button onClick={() => setView("assigned")}>Xem tất cả →</button></div>{pendingBookings.length ? pendingBookings.slice(0, 4).map((item) => <div className="row" key={item.id}><div><b>{item.code} · {item.vehicleName}</b><small>{item.customerName} · {item.startDate} — {item.endDate}</small></div><span className="badge pending">Chờ xác nhận</span><button className="outline" onClick={() => { setView("assigned"); }}>Xử lý đơn</button></div>) : <Empty text="Chưa có đơn thuê mới." />}</section><section className="panel"><div className="panel-head"><h2>Hồ sơ cần xử lý sớm</h2><button onClick={() => setView("verification")}>Xem tất cả →</button></div>{pending.length ? pending.slice(0, 4).map((item) => <div className="row" key={item.id}><div><b>{item.fullName}</b><small>{item.email}</small></div><span className="badge pending">Chờ kiểm tra</span><button className="outline" onClick={() => { setView("verification"); openDetail(item.id); }}>Mở hồ sơ</button></div>) : <Empty text="Chưa có hồ sơ xác minh nào đang chờ." />}</section></div>}
      {view === "verification" && <div className="page"><div className="view-head"><div><h2>Hồ sơ cần xác minh</h2><p>Kiểm tra giấy tờ và duyệt hồ sơ hợp lệ để Customer có thể đặt xe.</p></div><select value={filter} onChange={(event) => setFilter(event.target.value as "pending" | "all")}><option value="pending">Chờ kiểm tra</option><option value="all">Tất cả hồ sơ đã xử lý</option></select></div>{loadError && <div className="alert">{loadError}</div>}<section className="panel table"><div className="table-head"><span>Khách hàng</span><span>Liên hệ</span><span>Trạng thái</span><span>Staff phụ trách</span><span></span></div>{shown.length ? shown.map((item) => <div className="table-row" key={item.id}><div><b>{item.fullName}</b><small>{item.email}</small></div><div>{item.phone || "Chưa cập nhật"}</div><div><span className={`badge ${item.verificationStatus}`}>{label(item.verificationStatus)}</span></div><div>{item.staffName || "Chưa phân công"}</div><button className="outline" onClick={() => openDetail(item.id)}>Xem hồ sơ</button></div>) : <Empty text="Không có hồ sơ phù hợp." />}</section></div>}
      {view === "assigned" && <div className="page"><div className="view-head"><div><h2>Đơn thuê cần xử lý</h2><p>Đơn mới do Customer gửi sẽ hiển thị tại đây. Staff xác nhận lịch thuê sau khi kiểm tra.</p></div></div>{loadError && <div className="alert">{loadError}</div>}<section className="panel table"><div className="table-head"><span>Mã đơn / Khách hàng</span><span>Xe và thời gian</span><span>Điểm nhận</span><span>Trạng thái</span><span></span></div>{assignedBookings.length ? assignedBookings.map((item) => <div className="table-row" key={item.id}><div><b>{item.code}</b><small>{item.customerName} · {item.customerEmail}</small></div><div><b>{item.vehicleName}</b><small>{item.startDate} — {item.endDate}</small></div><div>{item.pickupLocationName || "Chưa chọn"}</div><div><span className={`badge ${item.status === "Chờ xác nhận" ? "pending" : "approved"}`}>{item.status}</span></div>{item.status === "Chờ xác nhận" ? <button className="outline" onClick={() => confirmBooking(item)}>Xác nhận</button> : <span>Đã xử lý</span>}</div>) : <Empty text="Chưa có đơn thuê được gửi tới hệ thống." />}</section></div>}
      {["handover", "return"].includes(view) && <div className="page"><div className="view-head"><div><h2>{currentTitle}</h2><p>Giao xe và nhận xe trả sẽ hiển thị sau khi đơn thuê được Staff xác nhận.</p></div></div><section className="panel"><Empty text="Chưa có dữ liệu phù hợp để hiển thị." /></section></div>}
      {view === "profile" && <div className="page"><div className="view-head"><div><h2>Hồ sơ cá nhân</h2><p>Thông tin đang lấy từ tài khoản Staff.</p></div></div><section className="panel profile"><label>Họ và tên<input value={staff.fullName} readOnly /></label><label>Email<input value={staff.email} readOnly /></label></section></div>}
    </section>
    {(detail || detailLoading) && <div className="modal-backdrop"><section className="modal">{detailLoading ? <p>Đang tải ảnh giấy tờ…</p> : detail && <><div className="modal-head"><div><p>HỒ SƠ XÁC MINH</p><h2>{detail.customer.fullName}</h2></div><button onClick={() => setDetail(null)}>×</button></div><div className="customer-info"><span>Email: <b>{detail.customer.email || "Chưa cập nhật"}</b></span><span>Điện thoại: <b>{detail.customer.phone || "Chưa cập nhật"}</b></span><span>CCCD/CMND: <b>{detail.customer.identityNumber || "Chưa cập nhật"}</b></span></div><div className="document-grid"><Document label="CCCD/CMND mặt trước" url={detail.documents.cccdFront} /><Document label="CCCD/CMND mặt sau" url={detail.documents.cccdBack} /><Document label="Bằng lái xe" url={detail.documents.driverLicense} /></div><label className="note">Ghi chú xử lý<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Nhập lý do khi yêu cầu bổ sung hoặc từ chối hồ sơ." /></label><div className="decision"><button className="light" onClick={() => submitDecision("needs_update")}>Yêu cầu bổ sung</button><button className="danger" onClick={() => submitDecision("rejected")}>Từ chối</button><button className="primary" onClick={() => submitDecision("approved")}>Duyệt hồ sơ</button></div></>}</section></div>}
    <style jsx global>{`
      @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box}body{margin:0}.staff-shell{background:#f5f6f7;color:#171717;display:grid;font-family:"Be Vietnam Pro",Arial,sans-serif;grid-template-columns:278px 1fr;min-height:100vh}.sidebar{background:#151718;color:#fff;display:flex;flex-direction:column;height:100vh;padding:28px 18px;position:sticky;top:0}.brand{align-items:center;color:#fff;display:flex;font-size:16px;font-weight:800;gap:9px;letter-spacing:.07em;text-decoration:none;padding:0 9px}.brand>span{align-items:center;background:#f26522;clip-path:polygon(50% 0,100% 18%,82% 100%,18% 100%,0 18%);display:flex;height:34px;justify-content:center;width:34px}.brand b{color:#f26522}.user{align-items:center;border-bottom:1px solid #333;display:flex;gap:11px;margin:32px 9px 18px;padding-bottom:18px}.user b,.user small{display:block}.user small{color:#aaa;font-size:12px;margin-top:4px}.avatar{align-items:center;background:#f26522;border-radius:50%;color:#fff;display:flex;font-size:13px;font-weight:800;height:42px;justify-content:center;width:42px}.avatar.small{height:35px;width:35px;font-size:11px}nav{flex:1;overflow-y:auto}nav p{color:#777;font-size:10px;font-weight:800;letter-spacing:.12em;margin:22px 12px 7px}nav a,nav button{background:transparent;border:0;color:#aaa;display:block;font:600 14px "Be Vietnam Pro";padding:13px;text-align:left;text-decoration:none;width:100%}nav a{color:#fff;margin-bottom:5px}nav a span{margin-left:11px}nav button i{display:inline-block;font-size:17px;font-style:normal;margin-right:11px;width:20px}nav button.active,nav button:hover{background:#f26522;color:#fff}.logout{background:transparent;border:0;border-top:1px solid #333;color:#aaa;font:600 14px "Be Vietnam Pro";margin:18px 9px 0;padding:17px 0;text-align:left}.main{min-width:0}.main header{align-items:center;background:#fff;display:flex;justify-content:space-between;padding:25px clamp(25px,4vw,60px)}header p,.modal-head p{color:#f26522;font-size:11px;font-weight:800;letter-spacing:.13em;margin:0 0 7px}header h1{font-size:29px;letter-spacing:-.04em;margin:0}.header-user{align-items:center;display:flex;font-size:13px;gap:10px}.role{background:#fff0e9;color:#e95c20;font-size:11px;font-weight:800;padding:8px}.page{margin:auto;max-width:1320px;padding:34px clamp(25px,4vw,60px) 60px}.intro h2,.view-head h2{font-size:25px;letter-spacing:-.04em;margin:0 0 7px}.intro p,.view-head p{color:#666;font-size:14px;margin:0}.stats{display:grid;gap:18px;grid-template-columns:repeat(3,1fr);margin:26px 0}.stats article,.panel{background:#fff;border:1px solid #e3e5e7}.stats article{padding:21px}.stats span{color:#65717c;font-size:13px}.stats b{display:block;font-size:33px;letter-spacing:-.06em;margin:16px 0 7px}.stats small{color:#6e7d87;font-size:11px}.panel-head,.view-head{align-items:center;display:flex;justify-content:space-between}.panel-head{border-bottom:1px solid #e6e6e6;padding:20px 23px}.panel-head h2{font-size:17px;margin:0}.panel-head button{background:none;border:0;color:#e95c20;font:800 13px "Be Vietnam Pro"}.row{align-items:center;border-bottom:1px solid #eee;display:grid;gap:18px;grid-template-columns:1.4fr 170px 120px;padding:17px 23px}.row:last-child{border:0}.row b,.row small,.table-row b,.table-row small{display:block}.row b,.table-row b{font-size:14px}.row small,.table-row small{color:#69747e;font-size:11px;margin-top:4px}.badge{border-radius:20px;display:inline-block;font-size:11px;font-weight:800;padding:7px 10px}.badge.pending{background:#fff2dc;color:#996000}.badge.needs_update{background:#fff0e9;color:#c55720}.badge.staff_approved{background:#e8efff;color:#2960ae}.badge.rejected{background:#fde9e8;color:#b9312d}.badge.approved{background:#e1f7ea;color:#15834b}.outline,.light,.danger,.primary{background:#fff;border:1px solid #ddd;font:800 12px "Be Vietnam Pro";padding:10px 13px}.outline{justify-self:end}.view-head{margin-bottom:24px}.view-head select{border:1px solid #ddd;font:600 13px "Be Vietnam Pro";padding:10px}.table{overflow:hidden}.table-head,.table-row{align-items:center;display:grid;grid-template-columns:1.35fr 1fr 1fr 1fr auto;gap:16px;padding:16px 22px}.table-head{background:#fafafa;border-bottom:1px solid #e7e7e7;color:#7a848d;font-size:11px;font-weight:800;text-transform:uppercase}.table-row{border-bottom:1px solid #eee;font-size:13px}.table-row:last-child{border:0}.empty{align-items:center;color:#66727b;display:flex;gap:12px;padding:31px 23px}.empty span{align-items:center;background:#f2f3f4;border-radius:50%;color:#f26522;display:flex;font-size:20px;height:42px;justify-content:center;width:42px}.alert{background:#fff3ec;border:1px solid #ffd2bb;color:#965126;font-size:13px;margin-bottom:20px;padding:15px}.profile{display:grid;gap:18px;max-width:650px;padding:25px}.profile label,.note{display:grid;gap:8px;font-size:12px;font-weight:800}.profile input,.note textarea{border:1px solid #ddd;font:inherit;padding:11px}.note textarea{min-height:85px;resize:vertical}.loading{display:grid;font-family:"Be Vietnam Pro",Arial,sans-serif;min-height:100vh;place-items:center}.toast{background:#171717;box-shadow:0 12px 28px rgba(0,0,0,.2);color:#fff;font:600 14px "Be Vietnam Pro";left:50%;padding:14px 19px;position:fixed;top:20px;transform:translateX(-50%);z-index:30}.modal-backdrop{align-items:center;background:rgba(0,0,0,.58);display:flex;inset:0;justify-content:center;padding:25px;position:fixed;z-index:25}.modal{background:#fff;max-height:92vh;max-width:1020px;overflow:auto;padding:27px;width:100%}.modal-head{align-items:start;border-bottom:1px solid #eee;display:flex;justify-content:space-between;margin-bottom:19px;padding-bottom:17px}.modal-head h2{font-size:24px;margin:0}.modal-head button{background:#f4f4f4;border:0;border-radius:50%;font-size:24px;height:34px;width:34px}.customer-info{display:flex;flex-wrap:wrap;gap:11px 26px;margin-bottom:21px}.customer-info span{font-size:12px}.document-grid{display:grid;gap:15px;grid-template-columns:repeat(3,1fr);margin-bottom:21px}.document{border:1px solid #e1e1e1}.document b{display:block;font-size:12px;padding:11px}.document img{display:block;height:210px;object-fit:cover;width:100%}.document .no-image{align-items:center;background:#f5f5f5;color:#77828a;display:flex;font-size:12px;height:210px;justify-content:center}.decision{display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-end;margin-top:20px}.light{background:#fff}.danger{border-color:#e16f68;color:#b22f2b}.primary{background:#f26522;border-color:#f26522;color:#fff}@media(max-width:900px){.staff-shell{grid-template-columns:220px 1fr}.document-grid,.stats{grid-template-columns:1fr}.table-head{display:none}.table-row{gap:9px;grid-template-columns:1fr}.outline{justify-self:start}.row{grid-template-columns:1fr}.row .outline{justify-self:start}}@media(max-width:650px){.staff-shell{display:block}.sidebar{height:auto;position:static}.user,.logout{display:none}.sidebar nav{display:flex;margin-top:15px;overflow:auto}.sidebar nav>div,.sidebar nav a{flex:0 0 auto}.sidebar nav p{display:none}.main header{padding:18px}.header-user b,.role{display:none}.page{padding:25px 17px}.modal{padding:20px}.document-grid{grid-template-columns:1fr}.document img,.document .no-image{height:180px}}
    `}</style>
  </main>;
}

function Empty({ text }: { text: string }) { return <div className="empty"><span>○</span><div>{text}</div></div>; }
function Document({ label, url }: { label: string; url?: string }) { return <article className="document"><b>{label}</b>{url ? <img src={url} alt={label} /> : <div className="no-image">Chưa có ảnh để hiển thị</div>}</article>; }
