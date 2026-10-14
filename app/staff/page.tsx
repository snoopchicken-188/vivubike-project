"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { collection, doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "../../lib/firebase";

/* ─── Types ─────────────────────────────────────────────────────────── */
type VerifStatus = "pending" | "needs_update" | "staff_approved" | "rejected" | "approved" | "not_submitted";
type Customer = { id: string; fullName: string; email: string; phone: string; verificationStatus: VerifStatus; staffName: string; staffNote: string };
type Detail = { customer: Customer & { identityNumber: string }; documents: Record<string, string> };

type RentalStatus = "pending_approval" | "ready_for_pickup" | "in_progress" | "returning" | "completed";
type Rental = {
  id: string; code: string;
  customerId?: string;
  customerName: string; customerEmail: string; customerPhone: string;
  vehicleName: string; licensePlate: string;
  startDate: string; endDate: string;
  actualPickupAt?: string; actualReturnAt?: string;
  totalAmount: number; depositAmount: number;
  additionalFee?: number; feeReason?: string;
  status: RentalStatus | string;
  staffId: string;
  isGuest?: boolean;
  customerInfo?: { fullName: string; phone: string; email: string };
  verificationDocuments?: { idCardFrontUrl: string; idCardBackUrl: string; driverLicenseFrontUrl: string; driverLicenseBackUrl: string };
};

type View = "overview" | "verification" | "rentals" | "profile";

/* ─── Menu ───────────────────────────────────────────────────────────── */
const menu: { id: View; icon: string; label: string; group?: string }[] = [
  { id: "overview",      icon: "▦", label: "Tổng quan" },
  { id: "verification",  icon: "✓", label: "Hồ sơ cần xác minh", group: "XỬ LÝ HỒ SƠ" },
  { id: "rentals",       icon: "≡", label: "Phiếu thuê",          group: "VẬN HÀNH" },
  { id: "profile",       icon: "◉", label: "Hồ sơ cá nhân",      group: "TÀI KHOẢN" },
];

/* ─── Rental stages ──────────────────────────────────────────────────── */
type Stage = { key: RentalStatus; label: string; actionLabel?: string; nextStatus?: RentalStatus; rejectLabel?: string };
const STAGES: Stage[] = [
  { key: "pending_approval",  label: "Chờ duyệt đơn",     actionLabel: "Duyệt đơn",            nextStatus: "ready_for_pickup", rejectLabel: "Từ chối" },
  { key: "ready_for_pickup",  label: "Chờ bàn giao",     actionLabel: "Xác nhận giao xe",      nextStatus: "in_progress" },
  { key: "in_progress",       label: "Đang thuê",         actionLabel: "Tiếp nhận trả xe",      nextStatus: "returning" },
  { key: "returning",         label: "Tiếp nhận trả xe", actionLabel: "Kiểm tra & Quyết toán" },
  { key: "completed",         label: "Hoàn thành" },
];

/* ─── Helpers ────────────────────────────────────────────────────────── */
const verifLabel = (s: string) => ({ pending: "Chờ kiểm tra", needs_update: "Cần bổ sung", staff_approved: "Chờ Admin duyệt", approved: "Đã xác minh", rejected: "Đã từ chối", not_submitted: "Chưa gửi" }[s] || s);
const initials   = (name: string) => name.split(" ").filter(Boolean).slice(-2).map(p => p[0]).join("").toUpperCase() || "NV";
const money      = (n: number) => n.toLocaleString("vi-VN") + "₫";
const stageOf    = (r: Rental): RentalStatus => (STAGES.some(s => s.key === r.status) ? r.status as RentalStatus : "pending_approval");

/** Parse an ISO string or Firestore Timestamp-like object to Date (or null) */
const parseDate = (v: unknown): Date | null => {
  if (!v) return null;
  if (v instanceof Date) return v;
  // Firestore Timestamp shape: { seconds, nanoseconds }
  if (typeof v === "object" && "seconds" in (v as object)) return new Date((v as { seconds: number }).seconds * 1000);
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
};

/** Format date to "DD/MM/YYYY" */
const fmtD = (v: unknown): string => {
  const d = parseDate(v);
  if (!d) return String(v || "—");
  const dd = String(d.getDate()).padStart(2, "0");
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}/${mo}/${yy}`;
};

/** Format date to "HH:mm DD/MM/YYYY" */
const fmtDT = (v: unknown): string => {
  const d = parseDate(v);
  if (!d) return String(v || "—");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${hh}:${mm} ${dd}/${mo}/${yy}`;
};

/** Human-readable duration between two dates: "X ngày Y giờ" */
const duration = (start: unknown, end: unknown): string => {
  const s = parseDate(start); const e = parseDate(end);
  if (!s || !e) return "";
  const mins = Math.round((e.getTime() - s.getTime()) / 60000);
  if (mins <= 0) return "";
  const days = Math.floor(mins / 1440); const hrs = Math.floor((mins % 1440) / 60); const rem = mins % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} ngày`);
  if (hrs > 0) parts.push(`${hrs} giờ`);
  if (rem > 0 && days === 0) parts.push(`${rem} phút`);
  return parts.length ? `(Tổng: ${parts.join(" ")})` : "";
};

/** Late minutes: positive means late */
const lateMinutes = (end: unknown, actual: Date): number => {
  const e = parseDate(end);
  if (!e) return 0;
  return Math.round((actual.getTime() - e.getTime()) / 60000);
};

const lateText = (mins: number): string => {
  if (mins <= 0) return "";
  const h = Math.floor(mins / 60); const m = mins % 60;
  return h > 0 ? `Trễ ${h} giờ${m > 0 ? ` ${m} phút` : ""}` : `Trễ ${m} phút`;
};

const normalizeRentalSearch = (value: unknown): string => String(value ?? "")
  .trim()
  .toLocaleLowerCase("vi")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/đ/g, "d")
  .replace(/\s+/g, " ");

const matchesRentalSearch = (rental: Rental, searchValue: string, profile?: Customer): boolean => {
  const query = normalizeRentalSearch(searchValue);
  if (!query) return true;

  const nameAndCode = [rental.code, rental.customerName, rental.customerInfo?.fullName];
  if (!rental.isGuest) nameAndCode.push(profile?.fullName);
  const matchesText = nameAndCode.some(value => normalizeRentalSearch(value).includes(query));
  if (rental.isGuest) return matchesText;

  const matchesEmail = [rental.customerEmail, rental.customerInfo?.email, profile?.email]
    .some(value => normalizeRentalSearch(value).includes(query));
  const phoneQuery = searchValue.replace(/\D/g, "");
  const isPhoneQuery = /^[+\d\s().-]+$/.test(searchValue.trim()) && phoneQuery.length > 0;
  const matchesPhone = isPhoneQuery && [rental.customerPhone, rental.customerInfo?.phone, profile?.phone]
    .some(value => String(value ?? "").replace(/\D/g, "").includes(phoneQuery));

  return matchesText || matchesEmail || matchesPhone;
};

/* ─── Page ───────────────────────────────────────────────────────────── */
export default function StaffPage() {
  const router = useRouter();
  const [view, setView]         = useState<View>("overview");
  const [staff, setStaff]       = useState({ fullName: "", email: "", phone: "" });
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [rentals, setRentals]   = useState<Rental[]>([]);
  const [loading, setLoading]   = useState(true);
  const [notice, setNotice]     = useState("");
  const [loadError, setLoadError] = useState("");
  const [detail, setDetail]     = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [note, setNote]         = useState("");
  const [verifFilter, setVerifFilter] = useState<"pending" | "all">("pending");
  const [activeStage, setActiveStage] = useState<RentalStatus>("pending_approval");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [returnModal, setReturnModal] = useState<Rental | null>(null);
  const [detailModal, setDetailModal] = useState<Rental | null>(null);
  const [checkItems, setCheckItems] = useState({ voXe: false, mayMoc: false, xang: false, muBaoHiem: false, giayTo: false });
  const [additionalFee, setAdditionalFee] = useState(0);
  const [feeReason, setFeeReason] = useState("");
  const [returnSaving, setReturnSaving] = useState(false);
  const [showBill, setShowBill] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passError, setPassError] = useState("");
  const [passSaving, setPassSaving] = useState(false);
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);
  const [rentalSearch, setRentalSearch] = useState("");

  const notify = (msg: string) => { setNotice(msg); window.setTimeout(() => setNotice(""), 3500); };

  const closePassModal = () => {
    setShowPassModal(false);
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPassError("");
  };

  /* Auth */
  useEffect(() => onAuthStateChanged(auth, async (user) => {
    if (!user) { router.replace("/"); return; }
    try {
      const profile = await getDoc(doc(db, "users", user.uid));
      if (!profile.exists() || profile.data()?.role !== "staff") { router.replace("/"); return; }
      setStaff({ fullName: String(profile.data()?.fullName || user.displayName || "Nhân viên"), email: user.email || "", phone: String(profile.data()?.phone || "") });
    } catch { router.replace("/"); }
    finally { setLoading(false); }
  }), [router]);

  /* Customers */
  useEffect(() => onSnapshot(collection(db, "users"), (snap) => {
    setLoadError("");
    setCustomers(snap.docs.map(d => {
      const data = d.data();
      return { id: d.id, fullName: String(data.fullName || "Chưa cập nhật"), email: String(data.email || ""), phone: String(data.phone || ""), verificationStatus: String(data.verificationStatus || "not_submitted") as VerifStatus, staffName: String(data.staffName || ""), staffNote: String(data.staffNote || "") };
    }).filter(c => String(snap.docs.find(d => d.id === c.id)?.data().role || "").toLowerCase() === "customer"));
  }, () => setLoadError("Tài khoản Staff chưa có quyền đọc hồ sơ. Hãy cập nhật Firestore Rules.")), []);

  /* Rentals — listen to bookings collection */
  useEffect(() => onSnapshot(collection(db, "bookings"), (snap) => {
    setRentals(snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        code: String(data.code || d.id),
        customerId: data.customerId ? String(data.customerId) : undefined,
        customerName: String(data.customerName || data.guestName || data.customerInfo?.fullName || "Khách hàng"),
        customerEmail: String(data.customerEmail || data.guestEmail || data.customerInfo?.email || ""),
        customerPhone: String(data.customerPhone || data.guestPhone || data.phone || data.customerInfo?.phone || ""),
        vehicleName: String(data.vehicleName || "Xe thuê"),
        licensePlate: String(data.licensePlate || ""),
        startDate: String(data.startDate || ""),
        endDate: String(data.endDate || ""),
        actualPickupAt: data.actualPickupAt ? String(data.actualPickupAt) : undefined,
        actualReturnAt: data.actualReturnAt ? String(data.actualReturnAt) : undefined,
        totalAmount: Number(data.totalAmount || 0),
        depositAmount: Number(data.depositAmount || 0),
        additionalFee: data.additionalFee ? Number(data.additionalFee) : undefined,
        feeReason: data.feeReason ? String(data.feeReason) : undefined,
        status: String(data.status || "pending_approval"),
        staffId: String(data.staffId || ""),
        isGuest: Boolean(data.isGuest),
        customerInfo: data.customerInfo,
        verificationDocuments: data.verificationDocuments,
      };
    }));
  }, () => setLoadError("Tài khoản Staff chưa có quyền đọc đơn thuê. Hãy Publish Firestore Rules mới.")), []);

  /* Derived */
  const pending      = customers.filter(c => c.verificationStatus === "pending");
  const shownVerif   = verifFilter === "all" ? customers.filter(c => ["pending","needs_update","approved","rejected"].includes(c.verificationStatus)) : pending;
  const reviewedToday = customers.filter(c => c.staffName === staff.fullName && ["approved","needs_update","rejected"].includes(c.verificationStatus)).length;

  const rentalsByStage = useMemo(() => {
    const map: Record<RentalStatus, Rental[]> = { pending_approval: [], ready_for_pickup: [], in_progress: [], returning: [], completed: [] };
    rentals.forEach(r => { const s = stageOf(r); if (map[s]) map[s].push(r); });
    return map;
  }, [rentals]);

  const visibleRentals = useMemo(() => {
    const profilesById = new Map(customers.map(customer => [customer.id, customer]));
    return (rentalsByStage[activeStage] || []).filter(rental =>
      matchesRentalSearch(rental, rentalSearch, rental.customerId ? profilesById.get(rental.customerId) : undefined)
    );
  }, [rentalsByStage, activeStage, rentalSearch, customers]);

  const currentStage   = STAGES.find(s => s.key === activeStage)!;
  const currentTitle   = menu.find(m => m.id === view)?.label || "Staff";

  /* Actions */
  const openDetail = async (customerId?: string) => {
    if (!customerId) return;
    const user = auth.currentUser; if (!user) return;
    setDetailLoading(true); setDetail(null); setNote("");
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/staff-verification?customerId=${customerId}`, { headers: { Authorization: `Bearer ${token}` } });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Không thể mở hồ sơ, hãy thử lại.");
      setDetail(result); setNote(result.customer.staffNote || "");
    } catch (e) {
      console.error("Lỗi khi mở hồ sơ:", e);
      notify(e instanceof Error ? e.message : "Không thể xử lý hồ sơ, hãy thử lại.");
    } finally { setDetailLoading(false); }
  };

  const submitDecision = async (action: "approved" | "needs_update" | "rejected") => {
    const user = auth.currentUser; if (!user || !detail) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/staff-verification", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ customerId: detail.customer.id, action, note }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Không thể cập nhật hồ sơ.");
      setDetail(null);
      notify(action === "approved" ? "Đã duyệt hồ sơ." : action === "needs_update" ? "Đã yêu cầu bổ sung hồ sơ." : "Đã từ chối hồ sơ.");
    } catch (e) { notify(e instanceof Error ? e.message : "Không thể cập nhật hồ sơ."); }
  };

  const saveProfile = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setProfileSaving(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        fullName: staff.fullName,
        phone: staff.phone,
      });
      notify("Đã cập nhật hồ sơ cá nhân.");
    } catch {
      notify("Không thể cập nhật hồ sơ. Hãy thử lại.");
    } finally {
      setProfileSaving(false);
    }
  };

  const changePassword = async () => {
    setPassError("");
    if (!oldPassword || !newPassword || !confirmPassword) {
      setPassError("Vui lòng điền đầy đủ các trường mật khẩu.");
      return;
    }
    if (newPassword.length < 6) {
      setPassError("Mật khẩu mới phải có ít nhất 6 ký tự.");
      return;
    }
    if (newPassword === oldPassword) {
      setPassError("Mật khẩu mới không được trùng với mật khẩu cũ.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassError("Xác nhận mật khẩu mới không khớp.");
      return;
    }
    
    const user = auth.currentUser;
    if (!user || !user.email) return;

    setPassSaving(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, oldPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      closePassModal();
      notify("Đổi mật khẩu thành công!");
    } catch (e: any) {
      const code = e.code;
      if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        setPassError("Mật khẩu hiện tại không chính xác.");
      } else {
        setPassError("Không thể đổi mật khẩu. Hãy thử lại.");
      }
    } finally {
      setPassSaving(false);
    }
  };

  const advanceRental = async (rental: Rental, toStatus: RentalStatus) => {
    setActionLoading(rental.id);
    try {
      await updateDoc(doc(db, "bookings", rental.id), {
        status: toStatus,
        staffId: auth.currentUser?.uid || "",
        staffName: staff.fullName,
        [`${toStatus}At`]: new Date().toISOString(),
        ...(toStatus === "in_progress" && !rental.actualPickupAt ? { actualPickupAt: new Date().toISOString() } : {})
      });
      notify(`Phiếu ${rental.code} đã chuyển sang: ${STAGES.find(s => s.key === toStatus)?.label}`);
      if (toStatus === "completed") return; // stay on completed tab
      setActiveStage(toStatus);
    } catch { notify("Không thể cập nhật phiếu thuê. Kiểm tra lại Firestore Rules."); }
    finally { setActionLoading(null); }
  };

  const rejectRental = async (rental: Rental) => {
    setActionLoading(rental.id);
    try {
      await updateDoc(doc(db, "bookings", rental.id), { status: "rejected", staffId: auth.currentUser?.uid || "", rejectedAt: new Date().toISOString() });
      notify(`Đã từ chối phiếu ${rental.code}.`);
    } catch { notify("Không thể từ chối phiếu thuê."); }
    finally { setActionLoading(null); }
  };

  const openReturnModal = (rental: Rental) => {
    setReturnModal(rental);
    if (rental.status === "completed") {
      setAdditionalFee(rental.additionalFee || 0);
      setFeeReason(rental.feeReason || "");
      setShowBill(true);
    } else {
      setCheckItems({ voXe: false, mayMoc: false, xang: false, muBaoHiem: false, giayTo: false });
      setAdditionalFee(0);
      setFeeReason("");
      setShowBill(false);
    }
  };

  // Step 1: validate and show bill preview
  const previewBill = () => {
    if (additionalFee > 0 && !feeReason.trim()) {
      notify("Vui lòng nhập lý do phụ phí phát sinh.");
      return;
    }
    setShowBill(true);
  };

  // Step 2: confirm payment and write to Firestore
  const confirmPayment = async () => {
    if (!returnModal) return;
    setReturnSaving(true);
    try {
      const finalAmount = returnModal.totalAmount + additionalFee - returnModal.depositAmount;
      await updateDoc(doc(db, "bookings", returnModal.id), {
        status: "completed",
        additionalFee,
        feeReason: feeReason.trim(),
        finalAmount,
        totalBill: finalAmount,
        checkItems,
        returnedAt: new Date().toISOString(),
        actualReturnAt: new Date().toISOString(),
        staffId: auth.currentUser?.uid || "",
        staffName: staff.fullName,
      });
      notify(`Phếu ${returnModal.code} đã hoàn tất quyết toán.`);
      setReturnModal(null);
      setShowBill(false);
      setActiveStage("completed");
    } catch { notify("Không thể lưu quyết toán. Kiểm tra lại Firestore Rules."); }
    finally { setReturnSaving(false); }
  };

  if (loading) return <main className="loading">Đang kiểm tra quyền truy cập…</main>;

  return (
    <main className="staff-shell">
      {notice && <div className="toast">✓ {notice}</div>}

      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <a href="/" className="brand"><span>V</span> VI VU <b>BIKE</b></a>
        <div className="user">
          <div className="avatar">{initials(staff.fullName)}</div>
          <div><b>{staff.fullName}</b><small>Staff</small></div>
        </div>
        <nav>
          <a href="/">⌂ <span>Trang chủ</span></a>
          {menu.map(item => (
            <div key={item.id}>
              {item.group && <p>{item.group}</p>}
              <button className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}>
                <i>{item.icon}</i>{item.label}
                {item.id === "rentals" && rentals.filter(r => stageOf(r) === "pending_approval").length > 0 && (
                  <span className="nav-badge">{rentals.filter(r => stageOf(r) === "pending_approval").length}</span>
                )}
                {item.id === "verification" && pending.length > 0 && (
                  <span className="nav-badge">{pending.length}</span>
                )}
              </button>
            </div>
          ))}
        </nav>
        <button className="logout" onClick={async () => { await signOut(auth); router.replace("/"); }}>↪ Đăng xuất</button>
      </aside>

      {/* ── Main workspace ── */}
      <section className="main">
        <header>
          <div><p>NHÂN VIÊN VẬN HÀNH</p><h1>{currentTitle}</h1></div>
          <div className="header-user"><span className="role">STAFF</span><div className="avatar small">{initials(staff.fullName)}</div><b>{staff.fullName}</b></div>
        </header>

        {/* ── Overview ── */}
        {view === "overview" && (
          <div className="page">
            <div className="intro"><h2>Xin chào, {staff.fullName}</h2></div>
            {loadError && <div className="alert">{loadError}</div>}
            <div className="task-cards">
              <div className="task-card group" onClick={() => { setView("rentals"); setActiveStage("pending_approval"); }}>
                <div className="task-card-icon pending">📋</div>
                <div className="task-card-content">
                  <span className="task-count">{rentalsByStage.pending_approval.length}</span>
                  <b>Phiếu chờ duyệt</b>
                  <small>Phiếu thuê mới cần xác nhận thông tin</small>
                </div>
                <div className="task-action">Xem chi tiết →</div>
              </div>

              <div className="task-card group" onClick={() => setView("verification")}>
                <div className="task-card-icon verification">✓</div>
                <div className="task-card-content">
                  <span className="task-count">{pending.length}</span>
                  <b>Hồ sơ cần xác minh</b>
                  <small>Khách hàng đang chờ duyệt hồ sơ thuê xe</small>
                </div>
                <div className="task-action">Xem chi tiết →</div>
              </div>
            </div>
            <section className="panel">
              <div className="panel-head"><h2>Phiếu thuê chờ duyệt</h2><button onClick={() => { setView("rentals"); setActiveStage("pending_approval"); }}>Xem tất cả →</button></div>
              {rentalsByStage.pending_approval.length ? rentalsByStage.pending_approval.slice(0, 4).map(r => (
                <div className="row" key={r.id}>
                  <div><b>{r.code} · {r.vehicleName}</b><small>{r.customerName} · {r.startDate} — {r.endDate}</small></div>
                  <span className="badge pending">Chờ duyệt</span>
                  <button className="outline" onClick={() => { setView("rentals"); setActiveStage("pending_approval"); }}>Xử lý</button>
                </div>
              )) : <Empty text="Chưa có phiếu thuê mới." />}
            </section>
            <section className="panel" style={{ marginTop: 18 }}>
              <div className="panel-head"><h2>Hồ sơ cần xử lý sớm</h2><button onClick={() => setView("verification")}>Xem tất cả →</button></div>
              {pending.length ? pending.slice(0, 4).map(c => (
                <div className="row" key={c.id}>
                  <div><b>{c.fullName}</b><small>{c.email}</small></div>
                  <span className="badge pending">Chờ kiểm tra</span>
                  <button className="outline" onClick={() => { setView("verification"); openDetail(c.id); }}>Mở hồ sơ</button>
                </div>
              )) : <Empty text="Chưa có hồ sơ xác minh nào đang chờ." />}
            </section>
          </div>
        )}

        {/* ── Verification ── */}
        {view === "verification" && (
          <div className="page">
            <div className="view-head">
              <div><h2>Hồ sơ cần xác minh</h2><p>Kiểm tra giấy tờ và duyệt hồ sơ hợp lệ để Customer có thể đặt xe.</p></div>
              <select value={verifFilter} onChange={e => setVerifFilter(e.target.value as "pending" | "all")}>
                <option value="pending">Chờ kiểm tra</option>
                <option value="all">Tất cả hồ sơ đã xử lý</option>
              </select>
            </div>
            {loadError && <div className="alert">{loadError}</div>}
            <section className="panel table">
              <div className="table-head"><span>Khách hàng</span><span>Liên hệ</span><span>Trạng thái</span><span>Staff phụ trách</span><span></span></div>
              {shownVerif.length ? shownVerif.map(c => (
                <div className="table-row" key={c.id}>
                  <div><b>{c.fullName}</b><small>{c.email}</small></div>
                  <div>{c.phone || "Chưa cập nhật"}</div>
                  <div><span className={`badge ${c.verificationStatus}`}>{verifLabel(c.verificationStatus)}</span></div>
                  <div>{c.staffName || "Chưa phân công"}</div>
                  <button className="outline" onClick={() => openDetail(c.id)}>Xem hồ sơ</button>
                </div>
              )) : <Empty text="Không có hồ sơ phù hợp." />}
            </section>
          </div>
        )}

        {/* ── Rentals (Phiếu thuê) — Timeline Stepper ── */}
        {view === "rentals" && (
          <div className="page">
            <div className="view-head">
              <div><h2>Quản lý phiếu thuê</h2><p>Theo dõi và xử lý toàn bộ vòng đời phiếu thuê xe theo từng giai đoạn.</p></div>
            </div>
            {loadError && <div className="alert">{loadError}</div>}

            {/* Timeline Stepper */}
            <div className="timeline">
              {STAGES.map((stage, idx) => {
                const count = rentalsByStage[stage.key]?.length || 0;
                const isActive = activeStage === stage.key;
                return (
                  <button key={stage.key} className={`timeline-step${isActive ? " active" : ""}`} onClick={() => { setActiveStage(stage.key); setRentalSearch(""); }}>
                    <div className="step-circle">{idx + 1}</div>
                    <div className="step-info">
                      <span className="step-label">{stage.label}</span>
                      {count > 0 && <span className="step-count">{count}</span>}
                    </div>
                    {idx < STAGES.length - 1 && <div className="step-line" />}
                  </button>
                );
              })}
            </div>

            {/* Rental Table */}
            <section className="panel" style={{ marginTop: 18 }}>
              <div className="panel-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2>{currentStage.label} <span style={{ color: "#f26522", fontSize: 13 }}>({visibleRentals.length})</span></h2>
                <div style={{ position: "relative", width: "350px" }}>
                  <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }}>
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                  </span>
                  <input
                    type="text"
                    placeholder="Tìm theo mã phiếu, tên, email hoặc số điện thoại"
                    value={rentalSearch}
                    onChange={(e) => setRentalSearch(e.target.value)}
                    style={{ width: "100%", padding: "8px 32px", border: "1px solid #e5e7eb", borderRadius: "8px", outline: "none", fontSize: "14px" }}
                  />
                  {rentalSearch && (
                    <button
                      onClick={() => setRentalSearch("")}
                      style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#9ca3af", cursor: "pointer", padding: "4px" }}
                      title="Xóa"
                    >
                      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                  )}
                </div>
              </div>
              {visibleRentals.length ? (
                <div className="rental-table">
                  <div className="rental-head">
                    <span>Mã phiếu / Khách hàng</span>
                    <span>Xe thuê</span>
                    <span>Thời gian thuê</span>
                    <span>Thành tiền</span>
                    <span>Thao tác</span>
                  </div>
                  {visibleRentals.map(r => (
                    <div className="rental-row" key={r.id}>
                      <div>
                        <b>
                          {r.code}
                          {r.isGuest && <span style={{ display: "inline-block", padding: "2px 6px", background: "#f3e8ff", color: "#7e22ce", fontSize: 10, borderRadius: 4, marginLeft: 6, verticalAlign: "middle" }}>Khách vãng lai</span>}
                        </b>
                        <small>{r.customerInfo?.fullName || r.customerName}</small>
                        <small>{r.customerInfo?.phone || r.customerPhone || r.customerEmail}</small>
                      </div>
                      <div>
                        <b>{r.vehicleName}</b>
                        {r.licensePlate && <small>{r.licensePlate}</small>}
                      </div>
                      <div>
                        {(() => {
                          const s = stageOf(r);
                          if (s === "pending_approval" || s === "ready_for_pickup") {
                            return <><small>{fmtD(r.startDate)} — {fmtD(r.endDate)}</small></>;
                          }
                          if (s === "in_progress" || s === "returning") {
                            return <><small>{fmtDT(r.actualPickupAt || r.startDate)} — {fmtD(r.endDate)}</small></>;
                          }
                          return (
                            <>
                              <small>{fmtDT(r.actualPickupAt || r.startDate)} — {fmtDT(r.actualReturnAt || r.endDate)}</small>
                              {duration(r.actualPickupAt || r.startDate, r.actualReturnAt || r.endDate) && (
                                <small style={{ color: "#f26522", fontStyle: "italic" }}>
                                  {duration(r.actualPickupAt || r.startDate, r.actualReturnAt || r.endDate)}
                                </small>
                              )}
                            </>
                          );
                        })()}
                      </div>
                      <div><b>{r.totalAmount ? money(r.totalAmount) : "—"}</b></div>
                      <div
                        className={`rental-actions${activeStage === "pending_approval" ? " pending-rental-actions" : ""}`}
                        style={activeStage === "pending_approval" ? { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 } : undefined}
                      >
                        {/* Stage returning: open settlement modal instead of direct advance */}
                        {activeStage === "returning" ? (
                          <button
                            className="btn-action"
                            disabled={actionLoading === r.id}
                            onClick={() => openReturnModal(r)}
                          >
                            Kiểm tra & Quyết toán
                          </button>
                        ) : activeStage === "pending_approval" ? (
                          <button
                            className="btn-action"
                            style={{ width: "100%", minWidth: 0, boxSizing: "border-box", paddingLeft: 6, paddingRight: 6, whiteSpace: "nowrap", fontSize: 11 }}
                            disabled={actionLoading === r.id}
                            onClick={() => {
                              if (r.isGuest) {
                                setDetailModal(r);
                              } else {
                                advanceRental(r, currentStage.nextStatus!);
                              }
                            }}
                          >
                            {actionLoading === r.id ? "…" : (r.isGuest ? "👁 Duyệt đơn" : currentStage.actionLabel)}
                          </button>
                        ) : (
                          currentStage.nextStatus && (
                            <button
                              className="btn-action"
                              disabled={actionLoading === r.id}
                              onClick={() => advanceRental(r, currentStage.nextStatus!)}
                            >
                              {actionLoading === r.id ? "…" : currentStage.actionLabel}
                            </button>
                          )
                        )}
                        {currentStage.rejectLabel && (
                          <button
                            className="btn-reject"
                            style={activeStage === "pending_approval" ? { width: "100%", minWidth: 0, boxSizing: "border-box", paddingLeft: 6, paddingRight: 6, whiteSpace: "nowrap", fontSize: 11 } : undefined}
                            disabled={actionLoading === r.id}
                            onClick={() => rejectRental(r)}
                          >
                            {currentStage.rejectLabel}
                          </button>
                        )}
                        {activeStage === "completed" && (
                          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            <button
                              className="btn-action"
                              style={{ background: "transparent", color: "#2563eb", fontWeight: 600, padding: 0 }}
                              onClick={() => openReturnModal(r)}
                            >
                              👁 Chi tiết
                            </button>
                            <span className="badge approved">Hoàn thành</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty text={rentalSearch.trim() ? `Không tìm thấy phiếu thuê nào khớp với từ khóa '${rentalSearch}'.` : `Không có phiếu thuê nào ở giai đoạn "${currentStage.label}".`} />
              )}
            </section>
          </div>
        )}

        {/* ── Profile ── */}
        {view === "profile" && (
          <div className="page">
            <div className="view-head"><div><h2>Hồ sơ cá nhân</h2><p>Cập nhật thông tin tài khoản của bạn.</p></div></div>
            <section className="panel profile">
              <label>Họ và tên
                <input value={staff.fullName} onChange={e => setStaff({ ...staff, fullName: e.target.value })} />
              </label>
              <label>Chức vụ
                <input value="Nhân viên vận hành" readOnly disabled style={{ background: "#f5f5f5", color: "#666" }} />
              </label>
              <label>Email (Đăng nhập)
                <input value={staff.email} readOnly disabled style={{ background: "#f5f5f5", color: "#666" }} />
              </label>
              <label>Số điện thoại liên hệ
                <input value={staff.phone} onChange={e => setStaff({ ...staff, phone: e.target.value })} placeholder="Chưa cập nhật" />
              </label>
              <div style={{ marginTop: "10px", display: "flex", gap: "10px" }}>
                <button className="primary" onClick={saveProfile} disabled={profileSaving}>
                  {profileSaving ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
                <button className="outline" onClick={() => setShowPassModal(true)} style={{ color: "#333" }}>
                  Đổi mật khẩu
                </button>
              </div>
            </section>
          </div>
        )}
      </section>

      {/* ── Password Modal ── */}
      {showPassModal && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) closePassModal(); }}>
          <section className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-head">
              <div>
                <h2>Đổi mật khẩu tài khoản</h2>
                <p style={{ margin: "4px 0 0", fontSize: "14px", color: "#666" }}>Để bảo mật tài khoản, vui lòng cập nhật mật khẩu định kỳ.</p>
              </div>
              <button onClick={closePassModal}>×</button>
            </div>
            
            <div className="profile" style={{ display: "grid", gap: "15px", margin: "20px 0" }}>
              <label style={{ display: "grid", gap: "7px" }}>Email xác thực
                <input value={staff.email} readOnly disabled style={{ background: "#f5f5f5", color: "#666", width: "100%", padding: "10px", border: "1px solid #ddd", borderRadius: "8px" }} />
              </label>
              
              <label style={{ display: "grid", gap: "7px" }}>Mật khẩu hiện tại (Mật khẩu cũ)
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <input type={showOldPass ? "text" : "password"} value={oldPassword} onChange={e => setOldPassword(e.target.value)} style={{ width: "100%", padding: "10px", paddingRight: "40px", border: "1px solid #ddd", borderRadius: "8px" }} />
                  <button onClick={() => setShowOldPass(!showOldPass)} style={{ position: "absolute", right: "8px", background: "none", border: "none", cursor: "pointer", color: "#666" }} title="Hiện/ẩn mật khẩu">
                    {showOldPass ? "👁" : "👁‍🗨"}
                  </button>
                </div>
              </label>

              <label style={{ display: "grid", gap: "7px" }}>Mật khẩu mới
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <input type={showNewPass ? "text" : "password"} value={newPassword} onChange={e => setNewPassword(e.target.value)} style={{ width: "100%", padding: "10px", paddingRight: "40px", border: "1px solid #ddd", borderRadius: "8px" }} />
                  <button onClick={() => setShowNewPass(!showNewPass)} style={{ position: "absolute", right: "8px", background: "none", border: "none", cursor: "pointer", color: "#666" }} title="Hiện/ẩn mật khẩu">
                    {showNewPass ? "👁" : "👁‍🗨"}
                  </button>
                </div>
              </label>

              <label style={{ display: "grid", gap: "7px" }}>Xác nhận mật khẩu mới
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <input type={showConfirmPass ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={{ width: "100%", padding: "10px", paddingRight: "40px", border: "1px solid #ddd", borderRadius: "8px" }} />
                  <button onClick={() => setShowConfirmPass(!showConfirmPass)} style={{ position: "absolute", right: "8px", background: "none", border: "none", cursor: "pointer", color: "#666" }} title="Hiện/ẩn mật khẩu">
                    {showConfirmPass ? "👁" : "👁‍🗨"}
                  </button>
                </div>
              </label>
              
              {passError && <div style={{ color: "#d93025", fontSize: "13px", marginTop: "-5px" }}>⚠️ {passError}</div>}
            </div>

            <div className="decision">
              <button className="light" onClick={closePassModal}>Hủy</button>
              <button className="primary" onClick={changePassword} disabled={passSaving} style={{ background: "#f26522" }}>
                {passSaving ? "Đang xử lý..." : "Cập nhật mật khẩu"}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ── Return / Settlement Modal ── */}
      {returnModal && (
        <div className="modal-backdrop">
          {!showBill ? (
            /* ─ Step 1: Inspection form ─ */
            <section className="modal" style={{ maxWidth: 620 }}>
              <div className="modal-head">
                <div><p>NGHIỆM THU TRẢ XE</p><h2>{returnModal.code} — {returnModal.vehicleName}</h2></div>
                <button onClick={() => setReturnModal(null)}>×</button>
              </div>

              <div className="customer-info">
                <span>Khách hàng: <b>{returnModal.customerName}</b></span>
                <span>Điện thoại: <b>{returnModal.customerPhone || returnModal.customerEmail}</b></span>
                <span>Nhận xe: <b>{fmtDT(returnModal.actualPickupAt || returnModal.startDate)}</b></span>
                <span>Hẹn trả: <b>{fmtDT(returnModal.endDate)}</b></span>
                {duration(returnModal.actualPickupAt || returnModal.startDate, returnModal.endDate) && (
                  <span style={{ color: "#777" }}>{duration(returnModal.actualPickupAt || returnModal.startDate, returnModal.endDate)}</span>
                )}
              </div>

              {/* Late alert */}
              {(() => {
                const now = new Date();
                const late = lateMinutes(returnModal.endDate, now);
                return late > 0 ? (
                  <div className="late-alert">
                    ⚠️ {lateText(late)} so với giờ hẹn trả — nên tính phụ phí trễ giờ
                  </div>
                ) : null;
              })()}

              <div className="return-section">
                <p className="return-section-title">✅ Tình trạng trả xe</p>
                <div className="check-grid">
                  {([
                    ["voXe",      "Vỏ xe & không hư hỏng"],
                    ["mayMoc",    "Máy móc hoạt động tốt"],
                    ["xang",      "Xăng đầy / theo thoả thuận"],
                    ["muBaoHiem", "Mũ bảo hiểm đủ số"],
                    ["giayTo",    "Giấy tờ kèm theo đầy đủ"],
                  ] as [keyof typeof checkItems, string][]).map(([key, label]) => (
                    <label key={key} className="check-item">
                      <input type="checkbox" checked={checkItems[key]} onChange={e => setCheckItems({ ...checkItems, [key]: e.target.checked })} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="return-section">
                <p className="return-section-title">💰 Phụ phí phát sinh</p>
                <label className="return-field">
                  <span>Số tiền phụ phí (VNĐ)</span>
                  <input type="number" min={0} step={1000} value={additionalFee} onChange={e => setAdditionalFee(Number(e.target.value) || 0)} className="fee-input" />
                  <small className="field-hint">Bao gồm phí trễ giờ, hao hụt xăng, hư hỏng hoặc vi phạm hợp đồng (nếu có)</small>
                </label>
                <label className="return-field" style={{ marginTop: 12 }}>
                  <span>Lý do & chi tiết phụ phí {additionalFee > 0 && <span className="required">*</span>}</span>
                  <textarea rows={3} value={feeReason} onChange={e => setFeeReason(e.target.value)} placeholder="Trả xe muộn 2 tiếng, xước nhẹ yếm trước bên phải, thiếu 1 vạch xăng..." className="fee-reason" />
                </label>
              </div>

              <div className="settlement-box">
                <p className="return-section-title">🧾 Tổng kết sơ bộ</p>
                <div className="settlement-row"><span>Tiền thuê gốc</span><b>{money(returnModal.totalAmount)}</b></div>
                {returnModal.depositAmount > 0 && <div className="settlement-row"><span>Tiền cọc đã thu</span><b style={{ color: "#15834b" }}>- {money(returnModal.depositAmount)}</b></div>}
                {additionalFee > 0 && <div className="settlement-row"><span>Phụ phí phát sinh</span><b style={{ color: "#c55720" }}>+ {money(additionalFee)}</b></div>}
                <div className="settlement-row total"><span>Tổng phải thu</span><b>{money(returnModal.totalAmount + additionalFee - returnModal.depositAmount)}</b></div>
              </div>

              <div className="decision">
                <button className="light" onClick={() => setReturnModal(null)}>Hủy</button>
                <button className="primary" onClick={previewBill}>📄 Xem hóa đơn →</button>
              </div>
            </section>
          ) : (
            /* ─ Step 2: Bill preview ─ */
            <section className="modal bill-modal">
              <div className="bill-wrap" id="bill-print-area">
                {/* Bill header */}
                <div className="bill-header">
                  <div className="bill-logo">
                    <span className="bill-logo-mark">V</span>
                    <div>
                      <div className="bill-brand">VI VU BIKE</div>
                      <div className="bill-brand-sub">Dịch vụ cho thuê xe máy</div>
                    </div>
                  </div>
                  <div className="bill-title-block">
                    <h2 className="bill-title">HÓA ĐƠN QUYẾT TOÁN THUÊ XE</h2>
                    <div className="bill-meta">
                      <span>Mã phiếu: <b>{returnModal.code}</b></span>
                      <span>Ngày: <b>{new Date().toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</b></span>
                      <span>Nhân viên: <b>{staff.fullName}</b></span>
                    </div>
                  </div>
                </div>

                {/* Info grid */}
                <div className="bill-info-grid">
                  <div className="bill-info-col">
                    <p className="bill-section-label">THÔNG TIN KHÁCH HÀNG</p>
                    <p className="bill-info-line"><span>Họ tên:</span><b>{returnModal.customerName}</b></p>
                    <p className="bill-info-line"><span>Liên hệ:</span><b>{returnModal.customerPhone || returnModal.customerEmail}</b></p>
                  </div>
                  <div className="bill-info-col">
                    <p className="bill-section-label">THÔNG TIN XE THUÊ</p>
                    <p className="bill-info-line"><span>Dòng xe:</span><b>{returnModal.vehicleName}</b></p>
                    {returnModal.licensePlate && <p className="bill-info-line"><span>Biển số:</span><b>{returnModal.licensePlate}</b></p>}
                    <p className="bill-info-line"><span>Nhận xe:</span><b>{fmtDT(returnModal.actualPickupAt || returnModal.startDate)}</b></p>
                    <p className="bill-info-line"><span>Hẹn trả:</span><b>{fmtDT(returnModal.endDate)}</b></p>
                    <p className="bill-info-line"><span>Trả thực tế:</span><b style={{ color: (() => { const late = lateMinutes(returnModal.endDate, returnModal.actualReturnAt ? new Date(returnModal.actualReturnAt) : new Date()); return late > 0 ? "#c55720" : "#15834b"; })() }}>{fmtDT(returnModal.actualReturnAt || new Date())}</b></p>
                    {(() => { const late = lateMinutes(returnModal.endDate, returnModal.actualReturnAt ? new Date(returnModal.actualReturnAt) : new Date()); return (late > 0 && returnModal.status !== "completed") ? <p className="bill-info-line"><span style={{ color: "#c55720", fontWeight: 700 }}>{lateText(late)}</span><b style={{ color: "#c55720" }}>! Phụ phí gợi ý</b></p> : null; })()}
                    {duration(returnModal.actualPickupAt || returnModal.startDate, returnModal.actualReturnAt || new Date()) && <p className="bill-info-line"><span>Thời lượng:</span><b>{duration(returnModal.actualPickupAt || returnModal.startDate, returnModal.actualReturnAt || new Date()).replace(/[()]/g, "")}</b></p>}
                  </div>
                </div>

                {/* Cost breakdown */}
                <table className="bill-table">
                  <thead>
                    <tr><th>Diễn giải</th><th style={{ textAlign: "right" }}>Số tiền</th></tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Tiền thuê xe ({returnModal.vehicleName})</td>
                      <td className="bill-amount">{money(returnModal.totalAmount)}</td>
                    </tr>
                    {returnModal.depositAmount > 0 && (
                      <tr className="bill-row-deduct">
                        <td>Tiền cọc ban đầu (giảm trừ)</td>
                        <td className="bill-amount">- {money(returnModal.depositAmount)}</td>
                      </tr>
                    )}
                    {additionalFee > 0 && (
                      <>
                        <tr className="bill-row-penalty">
                          <td>Phụ phí phát sinh</td>
                          <td className="bill-amount">+ {money(additionalFee)}</td>
                        </tr>
                        {feeReason && (
                          <tr className="bill-row-reason">
                            <td colSpan={2}><i>└ Lý do: {feeReason}</i></td>
                          </tr>
                        )}
                      </>
                    )}
                  </tbody>
                </table>

                {/* Grand total */}
                {(() => {
                  const grand = returnModal.totalAmount + additionalFee - returnModal.depositAmount;
                  const isRefund = grand < 0;
                  const isCompleted = returnModal.status === "completed";
                  return (
                    <div className={`bill-grand${isRefund && !isCompleted ? " refund" : ""}${isCompleted ? " completed" : ""}`}>
                      <span>{isCompleted ? "ĐÃ QUYẾT TOÁN" : (isRefund ? "TIỀN HOÀN LẠI CHO KHÁCH" : "SỐ TIỀN CẦN THANH TOÁN")}</span>
                      <b>{money(Math.abs(grand))}</b>
                    </div>
                  );
                })()}

                {/* Footer */}
                <div className="bill-footer">
                  <p>Cảm ơn quý khách đã sử dụng dịch vụ <b>Vi Vu Bike</b>!</p>
                  <p className="bill-footer-sub">Hồ sơ và chi tiết thuê xe được lưu trữ trong hệ thống.</p>
                </div>
              </div>

              {/* Actions */}
              <div className="bill-actions">
                {returnModal.status !== "completed" && (
                  <button className="light" onClick={() => setShowBill(false)}>← Quay lại chỉnh sửa</button>
                )}
                <button className="light" onClick={() => window.print()}>🖨 In hóa đơn</button>
                {returnModal.status !== "completed" ? (
                  <button className="primary" onClick={confirmPayment} disabled={returnSaving}>
                    {returnSaving ? "Đang lưu..." : "✓ Xác nhận & Hoàn tất đơn"}
                  </button>
                ) : (
                  <button className="primary" onClick={() => setReturnModal(null)}>Đóng</button>
                )}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ── Verification Detail Modal ── */}
      {(detail || detailLoading) && (
        <div className="modal-backdrop">
          <section className="modal">
            {detailLoading ? <p>Đang tải ảnh giấy tờ…</p> : detail && <>
              <div className="modal-head">
                <div><p>HỒ SƠ XÁC MINH</p><h2>{detail.customer.fullName}</h2></div>
                <button onClick={() => setDetail(null)}>×</button>
              </div>
              <div className="customer-info">
                <span>Email: <b>{detail.customer.email || "Chưa cập nhật"}</b></span>
                <span>Điện thoại: <b>{detail.customer.phone || "Chưa cập nhật"}</b></span>
                <span>CCCD/CMND: <b>{detail.customer.identityNumber || "Chưa cập nhật"}</b></span>
              </div>
              <div className="document-grid">
                <DocCard label="CCCD/CMND mặt trước" url={detail.documents.cccdFront} />
                <DocCard label="CCCD/CMND mặt sau"   url={detail.documents.cccdBack} />
                <DocCard label="Bằng lái xe"          url={detail.documents.driverLicense} />
              </div>
              <label className="note">Ghi chú xử lý
                <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Nhập lý do khi yêu cầu bổ sung hoặc từ chối hồ sơ." />
              </label>
              <div className="decision">
                <button className="light"   onClick={() => submitDecision("needs_update")}>Yêu cầu bổ sung</button>
                <button className="danger"  onClick={() => submitDecision("rejected")}>Từ chối</button>
                <button className="primary" onClick={() => submitDecision("approved")}>Duyệt hồ sơ</button>
              </div>
            </>}
          </section>
        </div>
      )}

      {/* ── Detail Modal for Guest ── */}
      {detailModal && (
        <div className="modal-backdrop">
          <section className="modal" style={{ maxWidth: 800 }}>
            <div className="modal-head">
              <div><p>DUYỆT ĐƠN KHÁCH VÃNG LAI</p><h2>{detailModal.code}</h2></div>
              <button onClick={() => setDetailModal(null)}>×</button>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
              <div>
                <p><strong>Khách hàng:</strong> {detailModal.customerInfo?.fullName || detailModal.customerName}</p>
                <p><strong>Điện thoại:</strong> {detailModal.customerInfo?.phone || detailModal.customerPhone}</p>
                <p><strong>Email:</strong> {detailModal.customerInfo?.email || detailModal.customerEmail}</p>
              </div>
              <div>
                <p><strong>Xe thuê:</strong> {detailModal.vehicleName}</p>
                <p><strong>Thời gian:</strong> {fmtD(detailModal.startDate)} — {fmtD(detailModal.endDate)}</p>
                <p><strong>Thành tiền:</strong> {detailModal.totalAmount ? money(detailModal.totalAmount) : "—"}</p>
              </div>
            </div>

            <div className="return-section">
              <p className="return-section-title">Hồ sơ giấy tờ đính kèm</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 15 }}>
                <div>
                  <p style={{ margin: "0 0 5px 0", fontSize: 13, fontWeight: "bold" }}>CCCD Mặt trước</p>
                  <img src={detailModal.verificationDocuments?.idCardFrontUrl || ""} alt="CCCD Trước" style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 8, border: "1px solid #ddd" }} />
                </div>
                <div>
                  <p style={{ margin: "0 0 5px 0", fontSize: 13, fontWeight: "bold" }}>CCCD Mặt sau</p>
                  <img src={detailModal.verificationDocuments?.idCardBackUrl || ""} alt="CCCD Sau" style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 8, border: "1px solid #ddd" }} />
                </div>
                <div>
                  <p style={{ margin: "0 0 5px 0", fontSize: 13, fontWeight: "bold" }}>Bằng lái xe Mặt trước</p>
                  <img src={detailModal.verificationDocuments?.driverLicenseFrontUrl || ""} alt="BLX Trước" style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 8, border: "1px solid #ddd" }} />
                </div>
                <div>
                  <p style={{ margin: "0 0 5px 0", fontSize: 13, fontWeight: "bold" }}>Bằng lái xe Mặt sau</p>
                  <img src={detailModal.verificationDocuments?.driverLicenseBackUrl || ""} alt="BLX Sau" style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 8, border: "1px solid #ddd" }} />
                </div>
              </div>
            </div>

            <div className="decision">
              <button className="light" onClick={() => setDetailModal(null)}>Đóng</button>
              <button
                className="primary"
                disabled={actionLoading === detailModal.id}
                onClick={() => {
                  advanceRental(detailModal, "ready_for_pickup");
                  setDetailModal(null);
                }}
              >
                {actionLoading === detailModal.id ? "Đang xử lý..." : "Chấp nhận duyệt đơn"}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ── Styles ── */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box}body{margin:0}
        .staff-shell{background:#f5f6f7;color:#171717;display:grid;font-family:"Be Vietnam Pro",Arial,sans-serif;grid-template-columns:278px 1fr;min-height:100vh}

        /* Sidebar */
        .sidebar{background:#151718;color:#fff;display:flex;flex-direction:column;height:100vh;padding:28px 18px;position:sticky;top:0}
        .brand{align-items:center;color:#fff;display:flex;font-size:16px;font-weight:800;gap:9px;letter-spacing:.07em;text-decoration:none;padding:0 9px}
        .brand>span{align-items:center;background:#f26522;clip-path:polygon(50% 0,100% 18%,82% 100%,18% 100%,0 18%);display:flex;height:34px;justify-content:center;width:34px}
        .brand b{color:#f26522}
        .user{align-items:center;border-bottom:1px solid #333;display:flex;gap:11px;margin:32px 9px 18px;padding-bottom:18px}
        .user b,.user small{display:block}.user small{color:#aaa;font-size:12px;margin-top:4px}
        .avatar{align-items:center;background:#f26522;border-radius:50%;color:#fff;display:flex;font-size:13px;font-weight:800;height:42px;justify-content:center;width:42px}
        .avatar.small{height:35px;width:35px;font-size:11px}
        nav{flex:1;overflow-y:auto}nav p{color:#777;font-size:10px;font-weight:800;letter-spacing:.12em;margin:22px 12px 7px}
        nav a,nav button{background:transparent;border:0;color:#aaa;display:flex;align-items:center;font:600 14px "Be Vietnam Pro";padding:13px;text-align:left;text-decoration:none;width:100%}
        nav a{color:#fff;margin-bottom:5px}nav a span{margin-left:11px}
        nav button i{display:inline-block;font-size:17px;font-style:normal;margin-right:11px;width:20px}
        nav button.active,nav button:hover{background:#f26522;color:#fff;border-radius:6px}
        .nav-badge{margin-left:auto;background:#fff;color:#f26522;border-radius:20px;font-size:10px;font-weight:800;padding:2px 7px;min-width:18px;text-align:center}
        nav button.active .nav-badge{background:rgba(255,255,255,.25);color:#fff}
        .logout{background:transparent;border:0;border-top:1px solid #333;color:#aaa;font:600 14px "Be Vietnam Pro";margin:18px 9px 0;padding:17px 0;text-align:left;cursor:pointer}

        /* Main */
        .main{min-width:0}
        .main header{align-items:center;background:#fff;display:flex;justify-content:space-between;padding:25px clamp(25px,4vw,60px)}
        header p,.modal-head p{color:#f26522;font-size:11px;font-weight:800;letter-spacing:.13em;margin:0 0 7px}
        header h1{font-size:29px;letter-spacing:-.04em;margin:0}
        .header-user{align-items:center;display:flex;font-size:13px;gap:10px}
        .role{background:#fff0e9;color:#e95c20;font-size:11px;font-weight:800;padding:8px}
        .page{margin:auto;max-width:1320px;padding:34px clamp(25px,4vw,60px) 60px}
        .intro h2,.view-head h2{font-size:25px;letter-spacing:-.04em;margin:0 0 7px}
        .intro p,.view-head p{color:#666;font-size:14px;margin:0}
        .task-cards{display:grid;gap:18px;grid-template-columns:repeat(2,1fr);margin:26px 0}
        .task-card{background:#fff;border:1px solid #e3e5e7;border-radius:8px;padding:20px;cursor:pointer;display:flex;flex-direction:column;gap:14px;transition:all .2s;text-align:left}
        .task-card:hover{border-color:#f26522;box-shadow:0 6px 16px rgba(242,101,34,.08);transform:translateY(-2px)}
        .task-card-icon{align-items:center;border-radius:12px;display:flex;font-size:18px;height:42px;justify-content:center;width:42px;font-weight:800}
        .task-card-icon.verification{background:#e8efff;color:#2960ae}
        .task-card-icon.pending{background:#fff2dc;color:#996000}
        .task-card-icon.ready{background:#fff0e9;color:#c55720}
        .task-card-icon.returning{background:#fde9e8;color:#b9312d}
        .task-card-content b{display:block;font-size:15px;margin:4px 0;color:#171717;transition:.2s}
        .task-card:hover .task-card-content b{color:#f26522}
        .task-card-content small{color:#6e7d87;font-size:12px;line-height:1.4;display:block}
        .task-count{display:block;font-size:32px;font-weight:900;letter-spacing:-.04em;color:#171717}
        .task-action{color:#f26522;font-size:12px;font-weight:700;margin-top:auto;opacity:0;transform:translateX(-10px);transition:all .2s}
        .task-card:hover .task-action{opacity:1;transform:translateX(0)}
        .panel{background:#fff;border:1px solid #e3e5e7}
        .panel-head,.view-head{align-items:center;display:flex;justify-content:space-between}
        .panel-head{border-bottom:1px solid #e6e6e6;padding:20px 23px}
        .panel-head h2{font-size:17px;margin:0}
        .panel-head button{background:none;border:0;color:#e95c20;font:800 13px "Be Vietnam Pro";cursor:pointer}
        .row{align-items:center;border-bottom:1px solid #eee;display:grid;gap:18px;grid-template-columns:1.4fr 170px 120px;padding:17px 23px}
        .row:last-child{border:0}
        .row b,.row small,.table-row b,.table-row small{display:block}
        .row b,.table-row b{font-size:14px}
        .row small,.table-row small{color:#69747e;font-size:11px;margin-top:4px}
        .badge{border-radius:20px;display:inline-block;font-size:11px;font-weight:800;padding:7px 10px}
        .badge.pending{background:#fff2dc;color:#996000}
        .badge.needs_update{background:#fff0e9;color:#c55720}
        .badge.staff_approved{background:#e8efff;color:#2960ae}
        .badge.rejected{background:#fde9e8;color:#b9312d}
        .badge.approved{background:#e1f7ea;color:#15834b}
        .outline,.light,.danger,.primary{background:#fff;border:1px solid #ddd;font:800 12px "Be Vietnam Pro";padding:10px 13px;cursor:pointer}
        .outline{justify-self:end}
        .view-head{margin-bottom:24px}
        .view-head select{border:1px solid #ddd;font:600 13px "Be Vietnam Pro";padding:10px}
        .table{overflow:hidden}
        .table-head,.table-row{align-items:center;display:grid;grid-template-columns:1.35fr 1fr 1fr 1fr auto;gap:16px;padding:16px 22px}
        .table-head{background:#fafafa;border-bottom:1px solid #e7e7e7;color:#7a848d;font-size:11px;font-weight:800;text-transform:uppercase}
        .table-row{border-bottom:1px solid #eee;font-size:13px}.table-row:last-child{border:0}

        /* Timeline stepper */
        .timeline{display:flex;align-items:center;background:#fff;border:1px solid #e3e5e7;padding:20px 24px;gap:0;overflow-x:auto}
        .timeline-step{background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:0;flex:1;min-width:130px;padding:0;position:relative}
        .step-circle{align-items:center;background:#eee;border-radius:50%;color:#888;display:flex;flex-shrink:0;font-size:12px;font-weight:800;height:34px;justify-content:center;width:34px;transition:.2s}
        .timeline-step.active .step-circle{background:#f26522;color:#fff;box-shadow:0 4px 12px rgba(242,101,34,.35)}
        .step-info{display:flex;flex-direction:column;align-items:flex-start;margin-left:10px;gap:4px}
        .step-label{font-size:12px;font-weight:700;color:#555;text-align:left}
        .timeline-step.active .step-label{color:#f26522}
        .step-count{background:#f26522;color:#fff;border-radius:10px;font-size:10px;font-weight:800;padding:2px 7px}
        .step-line{flex:1;height:2px;background:#e5e5e5;margin:0 10px;min-width:20px}
        .timeline-step.active~.timeline-step .step-circle{background:#eee;color:#888}

        /* Rental table */
        .rental-table{overflow:hidden}
        .rental-head{display:grid;grid-template-columns:1.6fr 1fr 1.1fr .8fr 1fr;gap:14px;padding:13px 22px;background:#fafafa;border-bottom:1px solid #e7e7e7;color:#7a848d;font-size:11px;font-weight:800;text-transform:uppercase}
        .rental-row{display:grid;grid-template-columns:1.6fr 1fr 1.1fr .8fr 1fr;gap:14px;padding:16px 22px;border-bottom:1px solid #eee;font-size:13px;align-items:center}
        .rental-row:last-child{border:0}
        .rental-row b{display:block;font-size:14px}
        .rental-row small{display:block;color:#69747e;font-size:11px;margin-top:3px}
        .rental-actions{display:flex;gap:8px;flex-wrap:wrap}
        .pending-rental-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
        .pending-rental-actions .btn-action,.pending-rental-actions .btn-reject{width:100%;min-width:0;white-space:nowrap}
        .btn-action{background:#f26522;border:none;color:#fff;font:800 12px "Be Vietnam Pro";padding:9px 14px;border-radius:4px;cursor:pointer;transition:.15s}
        .btn-action:hover{background:#d9541a}.btn-action:disabled{opacity:.6;cursor:not-allowed}
        .btn-reject{background:#fff;border:1px solid #e16f68;color:#b22f2b;font:800 12px "Be Vietnam Pro";padding:9px 14px;border-radius:4px;cursor:pointer}
        .btn-reject:disabled{opacity:.6;cursor:not-allowed}

        /* Misc */
        .alert{background:#fff3ec;border:1px solid #ffd2bb;color:#965126;font-size:13px;margin-bottom:20px;padding:15px}
        .empty{align-items:center;color:#66727b;display:flex;gap:12px;padding:31px 23px}
        .empty span{align-items:center;background:#f2f3f4;border-radius:50%;color:#f26522;display:flex;font-size:20px;height:42px;justify-content:center;width:42px}
        .profile{display:grid;gap:18px;max-width:650px;padding:25px}
        .profile label,.note{display:grid;gap:8px;font-size:12px;font-weight:800}
        .profile input,.note textarea{border:1px solid #ddd;font:inherit;padding:11px}
        .note textarea{min-height:85px;resize:vertical}
        .loading{display:grid;font-family:"Be Vietnam Pro",Arial,sans-serif;min-height:100vh;place-items:center}
        .toast{background:#171717;box-shadow:0 12px 28px rgba(0,0,0,.2);color:#fff;font:600 14px "Be Vietnam Pro";left:50%;padding:14px 19px;position:fixed;top:20px;transform:translateX(-50%);z-index:30}

        /* Modal */
        .modal-backdrop{align-items:center;background:rgba(0,0,0,.58);display:flex;inset:0;justify-content:center;padding:25px;position:fixed;z-index:25}
        .modal{background:#fff;max-height:92vh;max-width:1020px;overflow:auto;padding:27px;width:100%}
        .modal-head{align-items:start;border-bottom:1px solid #eee;display:flex;justify-content:space-between;margin-bottom:19px;padding-bottom:17px}
        .modal-head h2{font-size:24px;margin:0}
        .modal-head button{background:#f4f4f4;border:0;border-radius:50%;font-size:24px;height:34px;width:34px;cursor:pointer}
        .customer-info{display:flex;flex-wrap:wrap;gap:11px 26px;margin-bottom:21px}
        .customer-info span{font-size:12px}
        .document-grid{display:grid;gap:15px;grid-template-columns:repeat(3,1fr);margin-bottom:21px}
        .document{border:1px solid #e1e1e1}
        .document b{display:block;font-size:12px;padding:11px}
        .document img{display:block;height:210px;object-fit:cover;width:100%}
        .document .no-image{align-items:center;background:#f5f5f5;color:#77828a;display:flex;font-size:12px;height:210px;justify-content:center}
        .decision{display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-end;margin-top:20px}
        .light{background:#fff}.danger{border-color:#e16f68;color:#b22f2b}.primary{background:#f26522;border-color:#f26522;color:#fff}

        @media(max-width:900px){
          .staff-shell{grid-template-columns:220px 1fr}
          .document-grid,.stats{grid-template-columns:1fr}
          .rental-head{display:none}
          .rental-row{grid-template-columns:1fr;gap:6px}
          .table-head{display:none}
          .table-row{gap:9px;grid-template-columns:1fr}
          .outline{justify-self:start}
          .row{grid-template-columns:1fr}
          .row .outline{justify-self:start}
        }
        @media(max-width:650px){
          .staff-shell{display:block}
          .sidebar{height:auto;position:static}
          .user,.logout{display:none}
          .sidebar nav{display:flex;margin-top:15px;overflow:auto}
          .sidebar nav>div,.sidebar nav a{flex:0 0 auto}
          .sidebar nav p{display:none}
          .main header{padding:18px}
          .header-user b,.role{display:none}
          .page{padding:25px 17px}
          .modal{padding:20px}
          .document-grid{grid-template-columns:1fr}
          .document img,.document .no-image{height:180px}
          .timeline{gap:6px;padding:14px}
          .step-line{display:none}
        }

        /* Return/settlement modal */
        .return-section{border:1px solid #eee;border-radius:6px;margin-bottom:16px;padding:16px}
        .return-section-title{color:#555;font-size:11px;font-weight:800;letter-spacing:.1em;margin:0 0 12px;text-transform:uppercase}
        .check-grid{display:grid;gap:10px;grid-template-columns:repeat(2,1fr)}
        .check-item{align-items:center;cursor:pointer;display:flex;font-size:13px;font-weight:600;gap:8px}
        .check-item input[type=checkbox]{accent-color:#f26522;height:16px;width:16px;flex-shrink:0}
        .return-field{display:grid;font-size:12px;font-weight:800;gap:7px}
        .return-field span{color:#444}
        .fee-input{border:1px solid #ddd;font:600 15px "Be Vietnam Pro";padding:11px 14px;width:100%;border-radius:4px}
        .fee-input:focus{border-color:#f26522;outline:none}
        .fee-reason{border:1px solid #ddd;font:400 13px "Be Vietnam Pro";padding:11px;resize:vertical;width:100%;border-radius:4px}
        .fee-reason:focus{border-color:#f26522;outline:none}
        .field-hint{color:#888;font-size:11px;font-weight:400;margin-top:2px}
        .required{color:#c00;margin-left:3px}
        .settlement-box{background:#fafafa;border:1px solid #e3e5e7;border-radius:6px;margin-bottom:16px;padding:16px}
        .settlement-row{align-items:center;display:flex;font-size:13px;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f0f0f0}
        .settlement-row:last-child{border:0}
        .settlement-row span{color:#666}
        .settlement-row b{font-size:14px}
        .settlement-row.total{margin-top:6px;padding-top:10px}
        .settlement-row.total span{color:#171717;font-size:14px;font-weight:800}
        .settlement-row.total b{color:#f26522;font-size:18px}
        .late-alert{background:#fff3ec;border:1px solid #f4c090;border-radius:5px;color:#96461a;font-size:13px;font-weight:600;margin-bottom:14px;padding:11px 14px}

        /* Bill modal */
        .bill-modal{max-width:680px;padding:0;overflow:hidden}
        .bill-wrap{background:#fff;padding:32px 36px}
        .bill-header{display:flex;align-items:flex-start;justify-content:space-between;border-bottom:3px solid #f26522;padding-bottom:20px;margin-bottom:22px;gap:16px;flex-wrap:wrap}
        .bill-logo{display:flex;align-items:center;gap:12px}
        .bill-logo-mark{align-items:center;background:#f26522;clip-path:polygon(50% 0,100% 18%,82% 100%,18% 100%,0 18%);color:#fff;display:flex;font-size:16px;font-weight:900;height:44px;justify-content:center;width:44px;flex-shrink:0}
        .bill-brand{font-size:18px;font-weight:900;letter-spacing:.06em;color:#151718}
        .bill-brand b{color:#f26522}
        .bill-brand-sub{font-size:11px;color:#888;margin-top:2px}
        .bill-title-block{text-align:right}
        .bill-title{font-size:14px;font-weight:800;letter-spacing:.06em;color:#151718;margin:0 0 8px;text-transform:uppercase}
        .bill-meta{display:flex;flex-direction:column;gap:3px}
        .bill-meta span{font-size:12px;color:#666}
        .bill-meta b{color:#171717}
        .bill-info-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:22px}
        .bill-info-col{}
        .bill-section-label{color:#f26522;font-size:10px;font-weight:800;letter-spacing:.12em;margin:0 0 10px;text-transform:uppercase}
        .bill-info-line{display:flex;justify-content:space-between;font-size:13px;margin:0 0 6px;gap:8px}
        .bill-info-line span{color:#888;flex-shrink:0}
        .bill-info-line b{text-align:right}
        .bill-table{border-collapse:collapse;width:100%;margin-bottom:0;font-size:13px}
        .bill-table thead tr{background:#f8f8f8;border-bottom:2px solid #eee}
        .bill-table th{font-size:11px;font-weight:800;letter-spacing:.08em;padding:10px 14px;text-align:left;color:#555;text-transform:uppercase}
        .bill-table td{padding:11px 14px;border-bottom:1px solid #f0f0f0;vertical-align:top}
        .bill-amount{text-align:right;font-weight:700;white-space:nowrap}
        .bill-row-deduct td{color:#15834b}
        .bill-row-penalty td{color:#c55720;font-weight:700}
        .bill-row-reason td{color:#888;font-size:12px;padding-top:2px;padding-bottom:10px;border-bottom:1px solid #f0f0f0}
        .bill-grand{background:#f26522;color:#fff;display:flex;align-items:center;justify-content:space-between;padding:18px 24px;margin-top:0}
        .bill-grand span{font-size:12px;font-weight:800;letter-spacing:.06em;opacity:.92;text-transform:uppercase}
        .bill-grand b{font-size:26px;font-weight:900;letter-spacing:-.02em}
        .bill-grand.refund, .bill-grand.completed{background:#15834b}
        .bill-footer{text-align:center;padding:18px 0 4px;border-top:1px dashed #ddd;margin-top:18px}
        .bill-footer p{margin:0 0 4px;font-size:13px;color:#555}
        .bill-footer-sub{font-size:11px;color:#aaa !important}
        .bill-actions{display:flex;gap:10px;justify-content:flex-end;padding:16px 24px;background:#fafafa;border-top:1px solid #eee;flex-wrap:wrap}
        .bill-actions button{cursor:pointer}

        /* Print */
        @media print{
          .modal-backdrop{position:static;background:none;padding:0}
          .bill-modal{box-shadow:none;max-width:100%}
          .bill-actions{display:none}
          body *:not(.bill-modal):not(.bill-modal *){display:none}
        }
      `}</style>
    </main>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="empty"><span>○</span><div>{text}</div></div>;
}
function DocCard({ label, url }: { label: string; url?: string }) {
  return (
    <article className="document">
      <b>{label}</b>
      {url ? <img src={url} alt={label} /> : <div className="no-image">Chưa có ảnh để hiển thị</div>}
    </article>
  );
}
