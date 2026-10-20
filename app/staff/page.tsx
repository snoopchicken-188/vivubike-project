"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { collection, doc, getDoc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "../../lib/firebase";
import { fileToBase64 } from "@/lib/home-content";

/* ─── Types ─────────────────────────────────────────────────────────── */
type VerifStatus = "pending" | "needs_update" | "staff_approved" | "rejected" | "approved" | "not_submitted";
type Customer = { id: string; fullName: string; email: string; phone: string; verificationStatus: VerifStatus; staffName: string; staffNote: string };
type Detail = { customer: Customer & { identityNumber: string }; documents: Record<string, string> };

export type HandoverDetails = {
  plateNumber?: string;
  odometer: number;
  fuelLevel?: string;
  checklist: {
    thanVo: string;
    phanh: string;
    denXiNhan: string;
    guong: string;
    coi: string;
  };
  accessories: {
    muBaoHiem: boolean;
    aoMua: boolean;
    giayTo: boolean;
  };
  images: {
    front: string;
    back: string;
    left: string;
    right: string;
  };
  note?: string;
  handoverAt?: string;
  staffId?: string;
  staffName?: string;
};

export type ReturnDetails = {
  odometer: number;
  fuelLevel?: string;
  checklist: {
    thanVo: string;
    phanh: string;
    denXiNhan: string;
    guong: string;
    coi: string;
  };
  accessories: {
    muBaoHiem: boolean;
    aoMua: boolean;
    giayTo: boolean;
  };
  images: {
    front: string;
    back: string;
    left: string;
    right: string;
  };
  kmDriven?: number;
  additionalFee?: number;
  feeReason?: string;
  returnedAt?: string;
  staffId?: string;
  staffName?: string;
};

type RentalStatus = "pending_approval" | "ready_for_pickup" | "in_progress" | "returning" | "completed";
type Rental = {
  id: string; code: string;
  customerId?: string;
  customerName: string; customerEmail: string; customerPhone: string;
  vehicleName: string; licensePlate: string;
  plateNumber?: string;
  startDate: string; endDate: string;
  actualPickupAt?: string; actualReturnAt?: string;
  totalAmount: number; depositAmount: number;
  additionalFee?: number; feeReason?: string;
  status: RentalStatus | string;
  staffId: string;
  isGuest?: boolean;
  customerInfo?: { fullName: string; phone: string; email: string };
  verificationDocuments?: { idCardFrontUrl: string; idCardBackUrl: string; driverLicenseFrontUrl: string; driverLicenseBackUrl: string };
  handoverDetails?: HandoverDetails;
  returnDetails?: ReturnDetails;
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
const stageOf = (r: Rental): RentalStatus => {
  if (r.status === "renting") return "in_progress";
  return (STAGES.some(s => s.key === r.status) ? r.status as RentalStatus : "pending_approval");
};

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

  // ── State Biên bản bàn giao xe ──
  const [handoverModal, setHandoverModal] = useState<Rental | null>(null);
  const [handoverPlate, setHandoverPlate] = useState("");
  const [handoverOdo, setHandoverOdo] = useState("");
  const [handoverChecklist, setHandoverChecklist] = useState({
    thanVo: "good",
    phanh: "good",
    denXiNhan: "good",
    guong: "good",
    coi: "good",
  });
  const [handoverAccessories, setHandoverAccessories] = useState({
    muBaoHiem: true,
    aoMua: true,
    giayTo: true,
  });
  const [handoverNote, setHandoverNote] = useState("");
  const [handoverImages, setHandoverImages] = useState({
    front: "",
    back: "",
    left: "",
    right: "",
  });
  const [handoverSaving, setHandoverSaving] = useState(false);

  // ── State Biên bản tiếp nhận & Đối soát trả xe ──
  const [returnCheckModal, setReturnCheckModal] = useState<Rental | null>(null);
  const [returnOdo, setReturnOdo] = useState("");
  const [returnChecklist, setReturnChecklist] = useState({
    thanVo: "good",
    phanh: "good",
    denXiNhan: "good",
    guong: "good",
    coi: "good",
  });
  const [returnAccessories, setReturnAccessories] = useState({
    muBaoHiem: true,
    aoMua: true,
    giayTo: true,
  });
  const [returnImages, setReturnImages] = useState({
    front: "",
    back: "",
    left: "",
    right: "",
  });

  // ── Xem ảnh phóng to (Lightbox) ──
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);
  
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
        licensePlate: String(data.licensePlate || data.plateNumber || data.handoverDetails?.plateNumber || ""),
        plateNumber: data.plateNumber ? String(data.plateNumber) : (data.handoverDetails?.plateNumber ? String(data.handoverDetails.plateNumber) : undefined),
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
        handoverDetails: data.handoverDetails,
        returnDetails: data.returnDetails,
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

  // ── Handover Modal Handlers ──
  const openHandoverModal = (rental: Rental) => {
    setHandoverModal(rental);
    setHandoverPlate(rental.handoverDetails?.plateNumber || rental.plateNumber || rental.licensePlate || "");
    setHandoverOdo(rental.handoverDetails?.odometer ? String(rental.handoverDetails.odometer) : "");
    setHandoverChecklist(rental.handoverDetails?.checklist || {
      thanVo: "good",
      phanh: "good",
      denXiNhan: "good",
      guong: "good",
      coi: "good",
    });
    setHandoverAccessories(rental.handoverDetails?.accessories || {
      muBaoHiem: true,
      aoMua: true,
      giayTo: true,
    });
    setHandoverNote(rental.handoverDetails?.note || "");
    setHandoverImages(rental.handoverDetails?.images || {
      front: "",
      back: "",
      left: "",
      right: "",
    });
  };

  const handleUploadHandoverImage = async (e: React.ChangeEvent<HTMLInputElement>, side: "front" | "back" | "left" | "right") => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      notify("Dung lượng file lớn hơn 10MB. Vui lòng chọn ảnh nhỏ hơn.");
      return;
    }
    try {
      const base64 = await fileToBase64(file);
      setHandoverImages(prev => ({ ...prev, [side]: base64 }));
      notify(`Đã tải ảnh ${side === "front" ? "mặt trước" : side === "back" ? "mặt sau" : side === "left" ? "sườn trái" : "sườn phải"} thành công!`);
    } catch (err) {
      console.error("Lỗi fileToBase64:", err);
      notify("Không thể đọc file ảnh. Vui lòng thử lại.");
    } finally {
      e.target.value = "";
    }
  };

  const submitHandover = async () => {
    if (!handoverModal) return;
    if (!handoverPlate.trim()) {
      notify("Vui lòng nhập biển số xe thực tế bàn giao cho khách!");
      return;
    }
    const odoNum = Number(handoverOdo);
    if (!handoverOdo.trim() || isNaN(odoNum) || odoNum < 0) {
      notify("Vui lòng nhập số Km (ODD) hiện tại của xe.");
      return;
    }
    if (!handoverImages.front || !handoverImages.back || !handoverImages.left || !handoverImages.right) {
      notify("Vui lòng tải đủ 4 ảnh chụp xe 4 phía (Mặt trước, mặt sau, sườn trái, sườn phải) trước khi bàn giao!");
      return;
    }

    const cleanPlate = handoverPlate.trim().toUpperCase();
    setHandoverSaving(true);
    try {
      const handoverData: HandoverDetails = {
        plateNumber: cleanPlate,
        odometer: odoNum,
        checklist: handoverChecklist,
        accessories: handoverAccessories,
        images: handoverImages,
        note: handoverNote.trim(),
        handoverAt: new Date().toISOString(),
        staffId: auth.currentUser?.uid || "",
        staffName: staff.fullName,
      };

      await updateDoc(doc(db, "bookings", handoverModal.id), {
        status: "in_progress",
        actualPickupAt: new Date().toISOString(),
        plateNumber: cleanPlate,
        licensePlate: cleanPlate,
        handoverDetails: handoverData,
        staffId: auth.currentUser?.uid || "",
        staffName: staff.fullName,
        updatedAt: serverTimestamp(),
      });

      notify(`Đã lập biên bản bàn giao xe (${cleanPlate})! Phiếu ${handoverModal.code} đã chuyển sang Đang thuê.`);
      setHandoverModal(null);
      setActiveStage("in_progress");
    } catch (err) {
      console.error("Lỗi khi lưu bàn giao:", err);
      notify("Không thể lưu biên bản bàn giao xe. Hãy thử lại.");
    } finally {
      setHandoverSaving(false);
    }
  };

  // ── Return Check Modal Handlers ──
  const openReturnCheckModal = (rental: Rental) => {
    setReturnCheckModal(rental);
    const initialOdo = rental.returnDetails?.odometer
      ? String(rental.returnDetails.odometer)
      : "";
    setReturnOdo(initialOdo);
    setReturnChecklist(rental.returnDetails?.checklist || {
      thanVo: "good",
      phanh: "good",
      denXiNhan: "good",
      guong: "good",
      coi: "good",
    });
    setReturnAccessories(rental.returnDetails?.accessories || {
      muBaoHiem: true,
      aoMua: true,
      giayTo: true,
    });
    setReturnImages(rental.returnDetails?.images || {
      front: "",
      back: "",
      left: "",
      right: "",
    });
    setAdditionalFee(rental.additionalFee || 0);
    setFeeReason(rental.feeReason || "");
  };

  const handleUploadReturnImage = async (e: React.ChangeEvent<HTMLInputElement>, side: "front" | "back" | "left" | "right") => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      notify("Dung lượng file lớn hơn 10MB. Vui lòng chọn ảnh nhỏ hơn.");
      return;
    }
    try {
      const base64 = await fileToBase64(file);
      setReturnImages(prev => ({ ...prev, [side]: base64 }));
      notify(`Đã tải ảnh lúc nhận xe (${side === "front" ? "mặt trước" : side === "back" ? "mặt sau" : side === "left" ? "sườn trái" : "sườn phải"})!`);
    } catch (err) {
      console.error("Lỗi fileToBase64:", err);
      notify("Không thể đọc file ảnh. Vui lòng thử lại.");
    } finally {
      e.target.value = "";
    }
  };

  const submitReturnCheck = async () => {
    if (!returnCheckModal) return;
    const odoNum = Number(returnOdo);
    if (!returnOdo.trim() || isNaN(odoNum) || odoNum < 0) {
      notify("Vui lòng nhập số Km (ODD) lúc trả xe.");
      return;
    }
    const startOdo = returnCheckModal.handoverDetails?.odometer || 0;
    if (startOdo > 0 && odoNum < startOdo) {
      notify(`Số Km lúc trả (${odoNum}) không thể nhỏ hơn số Km lúc nhận (${startOdo})!`);
      return;
    }
    if (additionalFee > 0 && !feeReason.trim()) {
      notify("Vui lòng nhập lý do phát sinh phụ phí!");
      return;
    }

    setReturnSaving(true);
    try {
      const kmDriven = startOdo > 0 ? Math.max(0, odoNum - startOdo) : 0;
      const finalAmount = returnCheckModal.totalAmount + additionalFee;

      const returnData: ReturnDetails = {
        odometer: odoNum,
        checklist: returnChecklist,
        accessories: returnAccessories,
        images: returnImages,
        kmDriven,
        additionalFee,
        feeReason: feeReason.trim(),
        returnedAt: new Date().toISOString(),
        staffId: auth.currentUser?.uid || "",
        staffName: staff.fullName,
      };

      await updateDoc(doc(db, "bookings", returnCheckModal.id), {
        status: "completed",
        actualReturnAt: new Date().toISOString(),
        returnedAt: new Date().toISOString(),
        returnDetails: returnData,
        additionalFee,
        feeReason: feeReason.trim(),
        finalAmount,
        totalBill: finalAmount,
        staffId: auth.currentUser?.uid || "",
        staffName: staff.fullName,
        updatedAt: serverTimestamp(),
      });

      notify(`Phiếu ${returnCheckModal.code} đã hoàn tất nghiệm thu đối soát trả xe.`);
      const completedRental: Rental = {
        ...returnCheckModal,
        status: "completed",
        additionalFee,
        feeReason: feeReason.trim(),
        actualReturnAt: new Date().toISOString(),
        returnDetails: returnData,
      };
      setReturnCheckModal(null);
      setReturnModal(completedRental);
      setShowBill(true);
      setActiveStage("completed");
    } catch (err) {
      console.error("Lỗi khi tiếp nhận trả xe:", err);
      notify("Không thể lưu biên bản tiếp nhận trả xe.");
    } finally {
      setReturnSaving(false);
    }
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
      const finalAmount = returnModal.totalAmount + additionalFee;
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
                        style={
                          activeStage === "pending_approval"
                            ? { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }
                            : activeStage === "completed"
                            ? { display: "flex", flexDirection: "column", alignItems: "flex-end", width: "100%" }
                            : undefined
                        }
                      >
                        {/* Stage returning: open return check modal */}
                        {activeStage === "returning" ? (
                          <button
                            className="btn-action"
                            disabled={actionLoading === r.id}
                            onClick={() => openReturnCheckModal(r)}
                            style={{ background: "#2563eb" }}
                          >
                            🔍 Đối soát & Quyết toán
                          </button>
                        ) : activeStage === "in_progress" ? (
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                            <button
                              className="btn-action"
                              disabled={actionLoading === r.id}
                              onClick={() => openReturnCheckModal(r)}
                              style={{ background: "#2563eb" }}
                            >
                              {actionLoading === r.id ? "…" : "🔍 Tiếp nhận trả xe"}
                            </button>
                            {r.handoverDetails && (
                              <button
                                className="btn-action"
                                style={{ background: "#f8fafc", border: "1px solid #cbd5e1", color: "#475569", fontSize: 11, padding: "7px 10px" }}
                                onClick={() => openHandoverModal(r)}
                                title="Xem lại biên bản bàn giao xe"
                              >
                                📋 BB giao xe
                              </button>
                            )}
                          </div>
                        ) : activeStage === "ready_for_pickup" ? (
                          <button
                            className="btn-action"
                            disabled={actionLoading === r.id}
                            onClick={() => openHandoverModal(r)}
                            style={{ background: "#f26522" }}
                          >
                            {actionLoading === r.id ? "…" : "📋 Xác nhận giao xe"}
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
                          <div
                            className="completed-action-grid"
                            style={{
                              display: "grid",
                              gridTemplateColumns: "auto auto",
                              columnGap: "10px",
                              rowGap: "5px",
                              alignItems: "center",
                              justifyContent: "end",
                              justifyItems: "start",
                            }}
                          >
                            {/* Hàng 1 - Cột 1: Hóa đơn */}
                            <button
                              className="btn-action whitespace-nowrap"
                              style={{
                                background: "transparent",
                                color: "#2563eb",
                                fontWeight: 700,
                                padding: 0,
                                border: "none",
                                cursor: "pointer",
                                fontSize: "12px",
                                whiteSpace: "nowrap",
                                textAlign: "left",
                              }}
                              onClick={() => openReturnModal(r)}
                              title="Xem hóa đơn quyết toán"
                            >
                              🧾 Hóa đơn
                            </button>

                            {/* Hàng 1 - Cột 2: Hoàn thành */}
                            <span
                              className="badge approved whitespace-nowrap"
                              style={{ whiteSpace: "nowrap", textAlign: "left" }}
                            >
                              Hoàn thành
                            </span>

                            {/* Hàng 2 (nếu có biên bản giao hoặc trả): Cột 1 là BB giao, Cột 2 là BB trả */}
                            {(r.handoverDetails || r.returnDetails) && (
                              <>
                                {r.handoverDetails ? (
                                  <button
                                    className="btn-action whitespace-nowrap"
                                    style={{
                                      background: "transparent",
                                      color: "#f26522",
                                      fontWeight: 700,
                                      padding: 0,
                                      border: "none",
                                      cursor: "pointer",
                                      fontSize: "12px",
                                      whiteSpace: "nowrap",
                                      textAlign: "left",
                                    }}
                                    onClick={() => openHandoverModal(r)}
                                    title="Xem lại biên bản bàn giao xe"
                                  >
                                    📋 BB giao
                                  </button>
                                ) : (
                                  <span />
                                )}

                                {r.returnDetails ? (
                                  <button
                                    className="btn-action whitespace-nowrap"
                                    style={{
                                      background: "transparent",
                                      color: "#16a34a",
                                      fontWeight: 700,
                                      padding: 0,
                                      border: "none",
                                      cursor: "pointer",
                                      fontSize: "12px",
                                      whiteSpace: "nowrap",
                                      textAlign: "left",
                                    }}
                                    onClick={() => openReturnCheckModal(r)}
                                    title="Xem lại biên bản đối soát trả xe"
                                  >
                                    🔍 BB trả
                                  </button>
                                ) : (
                                  <span />
                                )}
                              </>
                            )}
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
                {additionalFee > 0 && <div className="settlement-row"><span>Phụ phí phát sinh</span><b style={{ color: "#c55720" }}>+ {money(additionalFee)}</b></div>}
                <div className="settlement-row total"><span>Tổng thanh toán</span><b>{money(returnModal.totalAmount + additionalFee)}</b></div>
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
                  const grand = returnModal.totalAmount + additionalFee;
                  const isCompleted = returnModal.status === "completed";
                  return (
                    <div className={`bill-grand${isCompleted ? " completed" : ""}`}>
                      <span>{isCompleted ? "ĐÃ QUYẾT TOÁN" : "SỐ TIỀN CẦN THANH TOÁN"}</span>
                      <b>{money(grand)}</b>
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

      {/* ── Modal 1: Biên bản bàn giao xe cho khách ── */}
      {handoverModal && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget && !handoverSaving) setHandoverModal(null); }}>
          <section className="modal" style={{ maxWidth: 860, borderRadius: 12 }}>
            <div className="modal-head">
              <div>
                <p>BIÊN BẢN BÀN GIAO XE CHO KHÁCH</p>
                <h2>{handoverModal.code} — {handoverModal.vehicleName}</h2>
              </div>
              <button onClick={() => !handoverSaving && setHandoverModal(null)}>×</button>
            </div>

            {/* 1. Tóm tắt thông tin */}
            <div className="customer-info" style={{ background: "#f8fafc", padding: "14px 18px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
              <span>Mã phiếu: <b>{handoverModal.code}</b></span>
              <span>Khách hàng: <b>{handoverModal.customerInfo?.fullName || handoverModal.customerName}</b></span>
              <span>Điện thoại: <b>{handoverModal.customerInfo?.phone || handoverModal.customerPhone || "—"}</b></span>
              <span>Dòng xe: <b>{handoverModal.vehicleName}</b></span>
              <span>Lịch thuê: <b>{fmtD(handoverModal.startDate)} — {fmtD(handoverModal.endDate)}</b></span>
            </div>

            {/* 2. Checklist tình trạng xe */}
            <div className="return-section" style={{ marginTop: 18 }}>
              <p className="return-section-title">⚙️ Thông tin xe & Tình trạng kỹ thuật trước khi bàn giao</p>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <label className="return-field">
                  <span>Biển số xe bàn giao <span className="required">*</span></span>
                  <input
                    type="text"
                    placeholder="Ví dụ: 29B1-123.45"
                    value={handoverPlate}
                    onChange={(e) => setHandoverPlate(e.target.value.toUpperCase())}
                    className="fee-input"
                    style={{ textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.5px" }}
                  />
                  <small className="field-hint">Nhập biển số xe thực tế đang bàn giao cho khách.</small>
                </label>

                <label className="return-field">
                  <span>Số Km hiện tại trên đồng hồ (ODD / ODO) <span className="required">*</span></span>
                  <input
                    type="number"
                    min={0}
                    placeholder="Ví dụ: 12500"
                    value={handoverOdo}
                    onChange={(e) => setHandoverOdo(e.target.value)}
                    className="fee-input"
                  />
                  <small className="field-hint">Nhập chỉ số km thực tế hiển thị trên đồng hồ xe.</small>
                </label>
              </div>

              {/* Bảng checklist các bộ phận */}
              <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>Kiểm tra các bộ phận cốt lõi:</span>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
                  {[
                    { key: "thanVo", label: "Thân vỏ xe", good: "Tốt / Không xước", bad: "Có xước nhẹ" },
                    { key: "phanh", label: "Phanh trước & sau", good: "Ăn tốt, an toàn", bad: "Cần chú ý" },
                    { key: "denXiNhan", label: "Đèn pha & Xi nhan", good: "Sáng đủ, bình thường", bad: "Chập chờn" },
                    { key: "guong", label: "Gương chiếu hậu", good: "Đủ 02 gương chuẩn", bad: "Thiếu / nứt vỡ" },
                    { key: "coi", label: "Còi xe", good: "Kêu to rõ", bad: "Hơi nhỏ" },
                  ].map((item) => (
                    <div key={item.key} style={{ border: "1px solid #e2e8f0", padding: "10px 12px", borderRadius: 8, background: "#fff" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{item.label}</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => setHandoverChecklist({ ...handoverChecklist, [item.key]: "good" })}
                          style={{
                            flex: 1, padding: "5px 8px", fontSize: 11, fontWeight: 700, borderRadius: 6,
                            border: handoverChecklist[item.key as keyof typeof handoverChecklist] === "good" ? "1.5px solid #16a34a" : "1px solid #cbd5e1",
                            background: handoverChecklist[item.key as keyof typeof handoverChecklist] === "good" ? "#f0fdf4" : "#fff",
                            color: handoverChecklist[item.key as keyof typeof handoverChecklist] === "good" ? "#15803d" : "#64748b",
                            cursor: "pointer",
                          }}
                        >
                          ✓ {item.good}
                        </button>
                        <button
                          type="button"
                          onClick={() => setHandoverChecklist({ ...handoverChecklist, [item.key]: "warning" })}
                          style={{
                            flex: 1, padding: "5px 8px", fontSize: 11, fontWeight: 700, borderRadius: 6,
                            border: handoverChecklist[item.key as keyof typeof handoverChecklist] === "warning" ? "1.5px solid #ea580c" : "1px solid #cbd5e1",
                            background: handoverChecklist[item.key as keyof typeof handoverChecklist] === "warning" ? "#fff7ed" : "#fff",
                            color: handoverChecklist[item.key as keyof typeof handoverChecklist] === "warning" ? "#c2410c" : "#64748b",
                            cursor: "pointer",
                          }}
                        >
                          ⚠️ {item.bad}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Phụ kiện đi kèm */}
              <div style={{ marginTop: 16 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#475569", display: "block", marginBottom: 8 }}>Phụ kiện bàn giao cho khách:</span>
                <div className="check-grid">
                  <label className="check-item">
                    <input
                      type="checkbox"
                      checked={handoverAccessories.muBaoHiem}
                      onChange={(e) => setHandoverAccessories({ ...handoverAccessories, muBaoHiem: e.target.checked })}
                    />
                    02 Mũ bảo hiểm đạt chuẩn Vi Vu Bike
                  </label>
                  <label className="check-item">
                    <input
                      type="checkbox"
                      checked={handoverAccessories.aoMua}
                      onChange={(e) => setHandoverAccessories({ ...handoverAccessories, aoMua: e.target.checked })}
                    />
                    01 Áo mưa tiện dụng
                  </label>
                  <label className="check-item">
                    <input
                      type="checkbox"
                      checked={handoverAccessories.giayTo}
                      onChange={(e) => setHandoverAccessories({ ...handoverAccessories, giayTo: e.target.checked })}
                    />
                    Giấy tờ xe (Bản sao công chứng hợp lệ)
                  </label>
                </div>
              </div>

              {/* Ghi chú thêm */}
              <label className="return-field" style={{ marginTop: 14 }}>
                <span>Ghi chú mô tả thêm các vết xước có sẵn (nếu có)</span>
                <textarea
                  rows={2}
                  value={handoverNote}
                  onChange={(e) => setHandoverNote(e.target.value)}
                  placeholder="Ví dụ: Vết trầy nhẹ 2cm ở ốp pô phải; yếm trước xước dăm nhẹ..."
                  className="fee-reason"
                />
              </label>
            </div>

            {/* 3. Tải ảnh chụp xe 4 phía (Bắt buộc) */}
            <div className="return-section">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <p className="return-section-title" style={{ margin: 0 }}>📸 Ảnh chụp xe 4 phía trước khi giao <span className="required">* (Bắt buộc đủ 4 ảnh)</span></p>
                <span style={{ fontSize: 11, color: "#64748b" }}>Tự động nén ảnh Base64</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                {[
                  { side: "front", label: "Mặt trước xe" },
                  { side: "back", label: "Mặt sau xe" },
                  { side: "left", label: "Sườn trái xe" },
                  { side: "right", label: "Sườn phải xe" },
                ].map(({ side, label }) => {
                  const imgUrl = handoverImages[side as keyof typeof handoverImages];
                  return (
                    <div key={side} style={{ border: "1px dashed #cbd5e1", borderRadius: 8, padding: 8, background: "#fafafa", textAlign: "center", position: "relative" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#334155", marginBottom: 6 }}>{label}</div>
                      {imgUrl ? (
                        <div style={{ position: "relative" }}>
                          <img
                            src={imgUrl}
                            alt={label}
                            onClick={() => setPreviewImage({ url: imgUrl, title: `Ảnh ${label} lúc bàn giao` })}
                            style={{ width: "100%", height: 110, objectFit: "cover", borderRadius: 6, cursor: "zoom-in", border: "1px solid #16a34a" }}
                          />
                          <button
                            type="button"
                            onClick={() => setHandoverImages(prev => ({ ...prev, [side]: "" }))}
                            style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.6)", color: "#fff", border: 0, borderRadius: "50%", width: 22, height: 22, cursor: "pointer", fontSize: 12, display: "grid", placeItems: "center" }}
                            title="Xóa ảnh"
                          >
                            ✕
                          </button>
                          <div style={{ fontSize: 10, color: "#16a34a", fontWeight: 700, marginTop: 4 }}>✓ Đã tải ảnh</div>
                        </div>
                      ) : (
                        <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 110, cursor: "pointer", background: "#fff", borderRadius: 6, border: "1px dashed #94a3b8" }}>
                          <span style={{ fontSize: 24, marginBottom: 4 }}>📷</span>
                          <span style={{ fontSize: 11, color: "#f26522", fontWeight: 700 }}>Chọn ảnh</span>
                          <span style={{ fontSize: 9, color: "#94a3b8" }}>(hoặc chụp)</span>
                          <input
                            type="file"
                            accept="image/*"
                            style={{ display: "none" }}
                            onChange={(e) => handleUploadHandoverImage(e, side as any)}
                          />
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Thao tác */}
            <div className="decision">
              <button className="light" onClick={() => setHandoverModal(null)} disabled={handoverSaving}>
                Hủy bỏ
              </button>
              <button className="primary" onClick={submitHandover} disabled={handoverSaving} style={{ background: "#f26522", minWidth: 180 }}>
                {handoverSaving ? "Đang lưu biên bản..." : "✓ Hoàn tất bàn giao xe"}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ── Modal 2: Biên bản tiếp nhận & Đối soát trả xe (2 Cột Đối Chiếu) ── */}
      {returnCheckModal && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget && !returnSaving) setReturnCheckModal(null); }}>
          <section className="modal" style={{ maxWidth: 1040, borderRadius: 12, maxHeight: "94vh" }}>
            <div className="modal-head">
              <div>
                <p>BIÊN BẢN TIẾP NHẬN & ĐỐI SOÁT TRẢ XE</p>
                <h2>{returnCheckModal.code} — {returnCheckModal.vehicleName}</h2>
              </div>
              <button onClick={() => !returnSaving && setReturnCheckModal(null)}>×</button>
            </div>

            {/* Tóm tắt thông tin */}
            <div className="customer-info" style={{ background: "#f8fafc", padding: "12px 18px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
              <span>Mã phiếu: <b>{returnCheckModal.code}</b></span>
              <span>Khách hàng: <b>{returnCheckModal.customerInfo?.fullName || returnCheckModal.customerName}</b></span>
              <span>Điện thoại: <b>{returnCheckModal.customerInfo?.phone || returnCheckModal.customerPhone || "—"}</b></span>
              <span>
                Biển số xe:{" "}
                <b style={{
                  background: "#fff7ed",
                  color: "#ea580c",
                  border: "1px solid #fdba74",
                  padding: "2px 8px",
                  borderRadius: 6,
                  letterSpacing: "0.5px",
                  fontWeight: 800
                }}>
                  {returnCheckModal.handoverDetails?.plateNumber || returnCheckModal.plateNumber || returnCheckModal.licensePlate || "Chưa gắn biển"}
                </b>
              </span>
              <span>Nhận thực tế: <b>{fmtDT(returnCheckModal.actualPickupAt || returnCheckModal.startDate)}</b></span>
              <span>Hẹn trả: <b>{fmtDT(returnCheckModal.endDate)}</b></span>
              {(() => {
                const late = lateMinutes(returnCheckModal.endDate, new Date());
                return late > 0 ? (
                  <span style={{ color: "#b91c1c", fontWeight: 700 }}>⚠️ {lateText(late)}</span>
                ) : (
                  <span style={{ color: "#15803d", fontWeight: 700 }}>✓ Đúng giờ</span>
                );
              })()}
            </div>

            {/* GIAO DIỆN 2 CỘT ĐỐI CHIẾU TRỰC QUAN */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 16 }}>
              {/* CỘT 1: TÌNH TRẠNG LÚC GIAO XE */}
              <div style={{ background: "#f8fafc", border: "1.5px solid #cbd5e1", borderRadius: 10, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1.5px solid #cbd5e1", paddingBottom: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#1e293b", display: "flex", alignItems: "center", gap: 6 }}>
                    📋 1. LÚC BÀN GIAO CHO KHÁCH
                  </span>
                  <span style={{ fontSize: 11, background: "#e2e8f0", padding: "2px 8px", borderRadius: 999, color: "#475569", fontWeight: 600 }}>
                    Staff: {returnCheckModal.handoverDetails?.staffName || returnCheckModal.staffId || "Gốc"}
                  </span>
                </div>

                <div style={{ display: "grid", gap: 10, fontSize: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px dashed #e2e8f0", paddingBottom: 6 }}>
                    <span style={{ color: "#64748b" }}>Biển số bàn giao:</span>
                    <b style={{ color: "#ea580c", letterSpacing: "0.5px" }}>
                      {returnCheckModal.handoverDetails?.plateNumber || returnCheckModal.plateNumber || returnCheckModal.licensePlate || "Chưa gắn biển"}
                    </b>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px dashed #e2e8f0", paddingBottom: 6 }}>
                    <span style={{ color: "#64748b" }}>Số Km lúc giao:</span>
                    <b>{returnCheckModal.handoverDetails?.odometer ? `${returnCheckModal.handoverDetails.odometer.toLocaleString()} Km` : "Chưa ghi nhận"}</b>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px dashed #e2e8f0", paddingBottom: 6 }}>
                    <span style={{ color: "#64748b" }}>Thân vỏ xe:</span>
                    <span>{returnCheckModal.handoverDetails?.checklist?.thanVo === "warning" ? "⚠️ Có xước nhẹ" : "✓ Tốt / Không xước"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px dashed #e2e8f0", paddingBottom: 6 }}>
                    <span style={{ color: "#64748b" }}>Phanh / Đèn / Gương:</span>
                    <span>
                      {returnCheckModal.handoverDetails?.checklist?.phanh === "warning" ? "Phanh cần chú ý · " : "Phanh tốt · "}
                      {returnCheckModal.handoverDetails?.checklist?.denXiNhan === "warning" ? "Đèn chập chờn · " : "Đèn tốt · "}
                      {returnCheckModal.handoverDetails?.checklist?.guong === "warning" ? "Thiếu gương" : "Đủ 2 gương"}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px dashed #e2e8f0", paddingBottom: 6 }}>
                    <span style={{ color: "#64748b" }}>Phụ kiện đã giao:</span>
                    <span>
                      {returnCheckModal.handoverDetails?.accessories?.muBaoHiem !== false ? "✓ 2 Mũ BH " : ""}
                      {returnCheckModal.handoverDetails?.accessories?.aoMua !== false ? "✓ Áo mưa " : ""}
                      {returnCheckModal.handoverDetails?.accessories?.giayTo !== false ? "✓ Giấy tờ xe" : ""}
                    </span>
                  </div>
                  {returnCheckModal.handoverDetails?.note && (
                    <div style={{ background: "#fff", padding: "8px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, color: "#334155" }}>
                      <b>Ghi chú lúc giao:</b> {returnCheckModal.handoverDetails.note}
                    </div>
                  )}
                </div>

                {/* 4 ảnh chụp lúc giao */}
                <div style={{ marginTop: 14 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#475569", display: "block", marginBottom: 6 }}>
                    📸 4 ảnh xe lúc giao (Click để phóng to soi vết xước):
                  </span>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                    {[
                      { key: "front", label: "Trước" },
                      { key: "back", label: "Sau" },
                      { key: "left", label: "Sườn trái" },
                      { key: "right", label: "Sườn phải" },
                    ].map(({ key, label }) => {
                      const img = returnCheckModal.handoverDetails?.images?.[key as keyof typeof returnCheckModal.handoverDetails.images];
                      return (
                        <div key={key} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 6, padding: 4, textAlign: "center" }}>
                          <span style={{ fontSize: 10, color: "#64748b", display: "block", marginBottom: 2 }}>{label}</span>
                          {img ? (
                            <img
                              src={img}
                              alt={label}
                              onClick={() => setPreviewImage({ url: img, title: `Ảnh lúc giao — ${label}` })}
                              style={{ width: "100%", height: 80, objectFit: "cover", borderRadius: 4, cursor: "zoom-in" }}
                            />
                          ) : (
                            <div style={{ height: 80, display: "grid", placeItems: "center", fontSize: 10, color: "#94a3b8", background: "#f1f5f9" }}>
                              Chưa có ảnh
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* CỘT 2: TÌNH TRẠNG TIẾP NHẬN TRẢ XE */}
              <div style={{ background: "#fffaf5", border: "1.5px solid #f97316", borderRadius: 10, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1.5px solid #fdba74", paddingBottom: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#c2410c", display: "flex", alignItems: "center", gap: 6 }}>
                    🔍 2. TIẾP NHẬN LÚC TRẢ XE
                  </span>
                  <span style={{ fontSize: 11, background: "#ffedd5", padding: "2px 8px", borderRadius: 999, color: "#c2410c", fontWeight: 700 }}>
                    Người kiểm tra: {staff.fullName}
                  </span>
                </div>

                <div style={{ display: "grid", gap: 12 }}>
                  {/* Nhập Km lúc trả */}
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                      Số Km lúc trả (ODD / ODO) <span className="required">*</span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      placeholder="Ví dụ: 12650"
                      value={returnOdo}
                      onChange={(e) => setReturnOdo(e.target.value)}
                      className="fee-input"
                      style={{ height: 40 }}
                    />
                    {(() => {
                      const cur = Number(returnOdo);
                      const start = returnCheckModal.handoverDetails?.odometer || 0;
                      if (!returnOdo) return null;
                      if (start > 0 && cur < start) {
                        return <small style={{ color: "#b91c1c", fontWeight: 700, display: "block", marginTop: 4 }}>⚠️ Km lúc trả không thể nhỏ hơn Km lúc giao ({start})</small>;
                      }
                      if (start > 0 && cur >= start) {
                        return <small style={{ color: "#15803d", fontWeight: 700, display: "block", marginTop: 4 }}>🚀 Quãng đường đã đi: +{(cur - start).toLocaleString()} Km</small>;
                      }
                      return null;
                    })()}
                  </div>

                  {/* Checklist kiểm tra lại */}
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#334155", display: "block", marginBottom: 6 }}>Kiểm tra tình trạng thân vỏ & bộ phận:</span>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {[
                        { key: "thanVo", label: "Thân vỏ xe", good: "Bình thường", bad: "Phát hiện xước mới" },
                        { key: "phanh", label: "Phanh xe", good: "Hoạt động tốt", bad: "Kém an toàn" },
                        { key: "denXiNhan", label: "Đèn & Xi nhan", good: "Sáng đủ", bad: "Hỏng bóng / nứt" },
                        { key: "guong", label: "Gương chiếu hậu", good: "Đủ 02 gương", bad: "Vỡ / mất gương" },
                      ].map((item) => (
                        <div key={item.key} style={{ border: "1px solid #fed7aa", padding: "8px", borderRadius: 6, background: "#fff" }}>
                          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>{item.label}</div>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button
                              type="button"
                              onClick={() => setReturnChecklist({ ...returnChecklist, [item.key]: "good" })}
                              style={{
                                flex: 1, padding: "4px", fontSize: 10, fontWeight: 700, borderRadius: 4,
                                border: returnChecklist[item.key as keyof typeof returnChecklist] === "good" ? "1.5px solid #16a34a" : "1px solid #e2e8f0",
                                background: returnChecklist[item.key as keyof typeof returnChecklist] === "good" ? "#f0fdf4" : "#fff",
                                color: returnChecklist[item.key as keyof typeof returnChecklist] === "good" ? "#15803d" : "#64748b",
                                cursor: "pointer",
                              }}
                            >
                              ✓ {item.good}
                            </button>
                            <button
                              type="button"
                              onClick={() => setReturnChecklist({ ...returnChecklist, [item.key]: "warning" })}
                              style={{
                                flex: 1, padding: "4px", fontSize: 10, fontWeight: 700, borderRadius: 4,
                                border: returnChecklist[item.key as keyof typeof returnChecklist] === "warning" ? "1.5px solid #ef4444" : "1px solid #e2e8f0",
                                background: returnChecklist[item.key as keyof typeof returnChecklist] === "warning" ? "#fef2f2" : "#fff",
                                color: returnChecklist[item.key as keyof typeof returnChecklist] === "warning" ? "#dc2626" : "#64748b",
                                cursor: "pointer",
                              }}
                            >
                              ⚠️ {item.bad}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Phụ kiện thu hồi */}
                  <div style={{ background: "#fff", padding: "8px 10px", borderRadius: 6, border: "1px solid #fed7aa" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#334155", display: "block", marginBottom: 6 }}>Phụ kiện thu hồi:</span>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={returnAccessories.muBaoHiem}
                          onChange={(e) => setReturnAccessories({ ...returnAccessories, muBaoHiem: e.target.checked })}
                        />
                        Đủ 2 Mũ BH
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={returnAccessories.aoMua}
                          onChange={(e) => setReturnAccessories({ ...returnAccessories, aoMua: e.target.checked })}
                        />
                        Đủ Áo mưa
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={returnAccessories.giayTo}
                          onChange={(e) => setReturnAccessories({ ...returnAccessories, giayTo: e.target.checked })}
                        />
                        Đủ Giấy tờ xe
                      </label>
                    </div>
                  </div>

                  {/* 4 ảnh lúc nhận lại xe */}
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#334155", display: "block", marginBottom: 6 }}>
                      📸 4 ảnh chụp lúc nhận lại (Đối chiếu trực tiếp với ảnh cột 1):
                    </span>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                      {[
                        { side: "front", label: "Trước" },
                        { side: "back", label: "Sau" },
                        { side: "left", label: "Sườn trái" },
                        { side: "right", label: "Sườn phải" },
                      ].map(({ side, label }) => {
                        const imgUrl = returnImages[side as keyof typeof returnImages];
                        return (
                          <div key={side} style={{ border: "1px dashed #fdba74", borderRadius: 6, padding: 4, background: "#fff", textAlign: "center", position: "relative" }}>
                            <span style={{ fontSize: 10, color: "#64748b", display: "block", marginBottom: 2 }}>{label}</span>
                            {imgUrl ? (
                              <div style={{ position: "relative" }}>
                                <img
                                  src={imgUrl}
                                  alt={label}
                                  onClick={() => setPreviewImage({ url: imgUrl, title: `Ảnh lúc trả — ${label}` })}
                                  style={{ width: "100%", height: 80, objectFit: "cover", borderRadius: 4, cursor: "zoom-in" }}
                                />
                                <button
                                  type="button"
                                  onClick={() => setReturnImages(prev => ({ ...prev, [side]: "" }))}
                                  style={{ position: "absolute", top: 2, right: 2, background: "rgba(0,0,0,0.6)", color: "#fff", border: 0, borderRadius: "50%", width: 20, height: 20, cursor: "pointer", fontSize: 11, display: "grid", placeItems: "center" }}
                                  title="Xóa ảnh"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 80, cursor: "pointer", background: "#fffaf5", borderRadius: 4, border: "1px dashed #f97316" }}>
                                <span style={{ fontSize: 18 }}>📷</span>
                                <span style={{ fontSize: 10, color: "#ea580c", fontWeight: 700 }}>Chụp / Tải</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  style={{ display: "none" }}
                                  onChange={(e) => handleUploadReturnImage(e, side as any)}
                                />
                              </label>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Phụ phí phát sinh & Quyết toán */}
            <div className="settlement-box" style={{ marginTop: 18 }}>
              <p className="return-section-title">💰 Chi phí phát sinh & Quyết toán</p>
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 2fr", gap: 14 }}>
                <label className="return-field">
                  <span>Số tiền phụ phí phát sinh (VNĐ)</span>
                  <input
                    type="number"
                    min={0}
                    step={10000}
                    value={additionalFee}
                    onChange={(e) => setAdditionalFee(Number(e.target.value) || 0)}
                    className="fee-input"
                    placeholder="0"
                  />
                  <small className="field-hint">Phạt trễ giờ, hư hỏng linh kiện, trầy xước, mất mũ BH...</small>
                </label>
                <label className="return-field">
                  <span>Lý do phụ phí {additionalFee > 0 && <span className="required">*</span>}</span>
                  <textarea
                    rows={2}
                    value={feeReason}
                    onChange={(e) => setFeeReason(e.target.value)}
                    placeholder="Ví dụ: Trầy xước bửng phải xe (150.000đ); Trả xe muộn 1.5 giờ (50.000đ)..."
                    className="fee-reason"
                  />
                </label>
              </div>

              {/* Dòng tổng kết tiền */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr", gap: 12, marginTop: 14, paddingTop: 12, borderTop: "1px solid #e2e8f0" }}>
                <div>
                  <small style={{ color: "#64748b", display: "block" }}>Tiền thuê gốc</small>
                  <b style={{ fontSize: 15, color: "#1e293b" }}>{money(returnCheckModal.totalAmount)}</b>
                </div>
                <div>
                  <small style={{ color: "#64748b", display: "block" }}>Phụ phí phát sinh</small>
                  <b style={{ fontSize: 15, color: additionalFee > 0 ? "#ea580c" : "#64748b" }}>+ {money(additionalFee)}</b>
                </div>
                <div style={{ textAlign: "right" }}>
                  <small style={{ color: "#64748b", display: "block" }}>Tổng thanh toán</small>
                  <b style={{ fontSize: 18, color: "#f26522" }}>{money(returnCheckModal.totalAmount + additionalFee)}</b>
                </div>
              </div>
            </div>

            {/* Thao tác */}
            <div className="decision">
              <button className="light" onClick={() => setReturnCheckModal(null)} disabled={returnSaving}>
                Hủy bỏ
              </button>
              <button className="primary" onClick={submitReturnCheck} disabled={returnSaving} style={{ background: "#2563eb", minWidth: 220 }}>
                {returnSaving ? "Đang lưu quyết toán..." : "✓ Xác nhận nhận xe & Xem hóa đơn"}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ── Lightbox Preview Modal (Phóng to ảnh) ── */}
      {previewImage && (
        <div className="modal-backdrop" onClick={() => setPreviewImage(null)} style={{ zIndex: 9999 }}>
          <div style={{ background: "#fff", padding: 16, borderRadius: 12, maxWidth: "90vw", maxHeight: "90vh", display: "flex", flexDirection: "column", gap: 10 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <b style={{ fontSize: 14, color: "#1e293b" }}>{previewImage.title}</b>
              <button onClick={() => setPreviewImage(null)} style={{ border: 0, background: "#f1f5f9", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", fontWeight: 700 }}>✕</button>
            </div>
            <img src={previewImage.url} alt={previewImage.title} style={{ maxWidth: "85vw", maxHeight: "75vh", objectFit: "contain", borderRadius: 8 }} />
          </div>
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
