"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { onAuthStateChanged, signOut, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

type View = "overview" | "rent" | "bookings" | "verify" | "reviews" | "profile";
type BookingStatus =
  "Chờ xác nhận" | "Đã xác nhận" | "Đang thuê" | "Đã hoàn thành" | "Đã hủy";

const mapStatus = (status: string): BookingStatus => {
  const s = status.toLowerCase();
  if (s === "pending" || s === "waiting_confirmation" || s === "pending_confirmation" || s === "chờ xác nhận") return "Chờ xác nhận";
  if (s === "ready_for_pickup" || s === "confirmed" || s === "đã xác nhận") return "Đã xác nhận";
  if (s === "in_progress" || s === "renting" || s === "đang thuê") return "Đang thuê";
  if (s === "completed" || s === "đã hoàn thành") return "Đã hoàn thành";
  if (s === "cancelled" || s === "đã hủy") return "Đã hủy";
  return "Chờ xác nhận";
};
type DocumentKey = "cccdFront" | "cccdBack" | "driverLicense";

type Bike = {
  id: string;
  name: string;
  type: string;
  price: number;
  image: string;
  note: string;
  status: string;
  isVisible: boolean;
};
type Location = { id: string; name: string };
type Booking = {
  id: string;
  code: string;
  bike: string;
  dates: string;
  location: string;
  total: string;
  status: BookingStatus;
  vehicleImage: string;
  dailyPrice: number;
  rentalDays: number;
  note: string;
  amenities: string[];
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  startDate: string;
  endDate: string;
  createdAt: unknown;
  actualPickupAt?: string;
  actualReturnAt?: string;
  depositAmount?: number;
  additionalFee?: number;
  feeReason?: string;
  licensePlate?: string;
  totalAmount?: number;
};

const menu: { id: View; icon: string; label: string }[] = [
  { id: "overview", icon: "▦", label: "Tổng quan" },
  { id: "rent", icon: "⌁", label: "Thuê xe" },
  { id: "bookings", icon: "▤", label: "Đơn thuê của tôi" },
  { id: "verify", icon: "✓", label: "Xác minh tài khoản" },
  { id: "reviews", icon: "★", label: "Đánh giá của tôi" },
  { id: "profile", icon: "◉", label: "Hồ sơ cá nhân" },
];

const statusClass = (status: string) => {
  if (status === "Đã hoàn thành") return "done";
  if (status === "Đang thuê") return "active";
  if (status === "Đã xác nhận") return "confirmed";
  if (status === "Đã hủy") return "cancelled";
  return "pending";
};
const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((word) => word[0])
    .join("")
    .toUpperCase() || "KH";
const isVerified = (status: string) =>
  status === "approved" || status === "staff_approved";

const verificationLabel = (status: string) =>
  isVerified(status)
    ? "Đã xác minh"
    : status === "pending"
      ? "Đang chờ Staff kiểm tra"
      : status === "needs_update"
        ? "Cần bổ sung hồ sơ"
        : status === "rejected"
          ? "Hồ sơ bị từ chối"
          : "Chưa xác minh";

export default function CustomerPage() {
  const router = useRouter();
  const [view, setView] = useState<View>("overview");
  const [notice, setNotice] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [documentPreviews, setDocumentPreviews] = useState<
    Record<DocumentKey, string>
  >({ cccdFront: "", cccdBack: "", driverLicense: "" });
  const [bookingFilter, setBookingFilter] = useState("Tất cả");
  const [account, setAccount] = useState({
    fullName: "Khách hàng",
    email: "",
    phone: "",
    address: "",
    role: "Customer",
    verificationStatus: "not_submitted",
  });
  const [uid, setUid] = useState("");
  const [bikes, setBikes] = useState<Bike[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedBikeId, setSelectedBikeId] = useState("");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/");
        return;
      }
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
            address: "",
            role: "customer",
            verificationStatus: "not_submitted",
            createdAt: serverTimestamp(),
          });
        }

        // ── Kiểm tra bị khóa ──
        const profileData = profile.exists() ? profile.data() : {};
        if (profileData.isBlocked || profileData.status === "locked") {
          await signOut(auth);
          router.replace("/?locked=1");
          return;
        }

        const currentProfile = profile.exists()
          ? profile.data()
          : {
            fullName: user.displayName || user.email || "Khách hàng",
            email: user.email || "",
            phone: "",
            address: "",
            verificationStatus: "not_submitted",
          };
        setAccount({
          fullName: String(
            currentProfile.fullName ||
            user.displayName ||
            user.email ||
            "Khách hàng",
          ),
          email: String(currentProfile.email || user.email || ""),
          phone: String(currentProfile.phone || ""),
          address: String(currentProfile.address || ""),
          role: "Customer",
          verificationStatus: String(
            currentProfile.verificationStatus || "not_submitted",
          ),
        });
      } catch {
        setAccount({
          fullName: user.displayName || user.email || "Khách hàng",
          email: user.email || "",
          phone: "",
          address: "",
          role: "Customer",
          verificationStatus: "not_submitted",
        });
      }
    });
  }, []);

  useEffect(() => {
    return onSnapshot(
      collection(db, "vehicles"),
      (snapshot) => {
        setBikes(
          snapshot.docs
            .map((item) => {
              const data = item.data();
              return {
                id: item.id,
                name: String(data.name || "Xe chưa đặt tên"),
                type: String(data.type || "Khác"),
                price: Number(data.dailyPrice || 0),
                image: String(data.image || ""),
                note: String(data.description || ""),
                status: String(data.status || "available"),
                isVisible: data.isVisible !== false,
              };
            })
            .filter(
              (bike) =>
                bike.price > 0 && bike.isVisible && bike.status === "available",
            ),
        );
      },
      () => notify("Không thể tải danh sách xe."),
    );
  }, []);

  useEffect(() => {
    return onSnapshot(
      collection(db, "locations"),
      (snapshot) => {
        setLocations(
          snapshot.docs
            .filter((item) => item.data().isActive !== false)
            .map((item) => ({
              id: item.id,
              name: String(item.data().name || ""),
            }))
            .filter((item) => item.name),
        );
      },
      () => notify("Không thể tải địa điểm nhận xe."),
    );
  }, []);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      query(collection(db, "bookings"), where("customerId", "==", uid)),
      (snapshot) => {
        setBookings(
          snapshot.docs.map((item) => {
            const data = item.data();
            return {
              id: item.id,
              code: String(data.code || item.id),
              bike: String(data.vehicleName || "Xe thuê"),
              dates: `${String(data.startDate || "")} — ${String(data.endDate || "")}`,
              location: String(data.pickupLocationName || ""),
              total: `${new Intl.NumberFormat("vi-VN").format(Number(data.totalAmount || 0))}đ`,
              status: mapStatus(String(data.status || "Chờ xác nhận")),
              vehicleImage: String(data.vehicleImage || ""),
              dailyPrice: Number(data.dailyPrice || 0),
              rentalDays: Number(data.rentalDays || 0),
              note: String(data.note || ""),
              amenities: Array.isArray(data.amenities)
                ? data.amenities.map((value) => String(value))
                : [],
              customerName: String(data.customerName || data.guestName || ""),
              customerEmail: String(data.customerEmail || data.guestEmail || ""),
              customerPhone: String(data.customerPhone || data.guestPhone || ""),
              startDate: String(data.startDate || ""),
              endDate: String(data.endDate || ""),
              createdAt: data.createdAt,
              actualPickupAt: String(data.actualPickupAt || ""),
              actualReturnAt: String(data.actualReturnAt || ""),
              depositAmount: Number(data.depositAmount || 0),
              additionalFee: Number(data.additionalFee || 0),
              feeReason: String(data.feeReason || ""),
              licensePlate: String(data.licensePlate || ""),
              totalAmount: Number(data.totalAmount || 0),
            };
          }),
        );
      },
      () =>
        notify(
          "Không thể tải đơn thuê. Hãy kiểm tra Firestore Rules cho collection bookings.",
        ),
    );
  }, [uid]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const vehicleId = params.get("vehicleId");
    if (params.get("view") === "rent") setView("rent");
    if (vehicleId) setSelectedBikeId(vehicleId);
  }, []);

  const notify = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3300);
  };

  const previewDocument = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    const key = event.currentTarget.name as DocumentKey;
    if (!file || !key) return;
    const reader = new FileReader();
    reader.onload = () =>
      setDocumentPreviews((current) => ({
        ...current,
        [key]: String(reader.result || ""),
      }));
    reader.readAsDataURL(file);
  };

  const sendVerification = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const user = auth.currentUser;
    if (!user) {
      notify("Bạn cần đăng nhập lại trước khi gửi hồ sơ.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const fullName = String(form.get("fullName") || "").trim();
    const identityNumber = String(form.get("identityNumber") || "").trim();

    try {
      setVerificationSent(true);

      const compressToBase64 = (file: File | null, maxWidth = 800, quality = 0.7): Promise<string> =>
        new Promise((resolve, reject) => {
          if (!file || file.size === 0) return resolve("");
          const img = new Image();
          const url = URL.createObjectURL(file);
          img.onload = () => {
            URL.revokeObjectURL(url);
            const scale = maxWidth / Math.max(img.width, maxWidth);
            const w = Math.round(img.width * scale);
            const h = Math.round(img.height * scale);
            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d")!;
            ctx.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL("image/jpeg", quality));
          };
          img.onerror = () => reject(new Error("Lỗi khi đọc file ảnh."));
          img.src = url;
        });

      const paths = {
        cccdFront: await compressToBase64(form.get("cccdFront") as File),
        cccdBack: await compressToBase64(form.get("cccdBack") as File),
        driverLicense: await compressToBase64(form.get("driverLicense") as File),
      };

      if (!paths.cccdFront || !paths.cccdBack || !paths.driverLicense) {
        throw new Error("Vui lòng tải lên đầy đủ các ảnh yêu cầu.");
      }

      await updateDoc(doc(db, "users", user.uid), {
        fullName,
        identityNumber,
        verificationDocuments: paths,
        verificationStatus: "pending",
        staffProposal: "Chưa có",
      });

      setAccount((current) => ({
        ...current,
        fullName,
        verificationStatus: "pending",
      }));
      notify("Đã gửi hồ sơ thành công. Hồ sơ của bạn đang được chờ phê duyệt.");
    } catch (error) {
      console.error("Lỗi xác minh hồ sơ:", error);
      notify(error instanceof Error ? error.message : "Không thể tải hồ sơ, hãy thử lại.");
      setVerificationSent(false);
    }
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (profileSaving) return;
    const user = auth.currentUser;
    if (!user) return notify("Bạn cần đăng nhập lại để cập nhật hồ sơ.");

    const form = new FormData(event.currentTarget);
    const fullName = String(form.get("fullName") || "").trim();
    const phone = String(form.get("phone") || "").trim();
    const address = String(form.get("address") || "").trim();
    if (!fullName || !phone) return notify("Vui lòng nhập họ tên và số điện thoại.");

    setProfileSaving(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        fullName,
        phone,
        address,
        updatedAt: serverTimestamp(),
      });
      setAccount((current) => ({ ...current, fullName, phone, address }));
      notify("Thông tin hồ sơ đã được cập nhật.");
    } catch (error) {
      console.error("Lỗi cập nhật hồ sơ:", error);
      const code = (error as { code?: string } | null)?.code;
      notify(code === "permission-denied"
        ? "Không có quyền lưu hồ sơ. Hãy kiểm tra quyền cập nhật trong Firestore Rules."
        : "Không thể lưu thông tin hồ sơ. Vui lòng thử lại.");
    } finally {
      setProfileSaving(false);
    }
  };

  const changeAccountPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (passwordSaving) return;
    const user = auth.currentUser;
    if (!user || !user.email) return notify("Bạn cần đăng nhập lại để đổi mật khẩu.");
    if (!user.providerData.some((provider) => provider.providerId === "password")) {
      return notify("Tài khoản này chưa có mật khẩu đăng nhập bằng email.");
    }

    const passwordForm = event.currentTarget;
    const form = new FormData(passwordForm);
    const currentPassword = String(form.get("currentPassword") || "");
    const newPassword = String(form.get("newPassword") || "");
    const confirmPassword = String(form.get("confirmPassword") || "");
    if (!currentPassword || !newPassword || !confirmPassword) {
      return notify("Vui lòng nhập đầy đủ các ô mật khẩu.");
    }
    if (newPassword.length < 6) return notify("Mật khẩu mới phải có ít nhất 6 ký tự.");
    if (newPassword !== confirmPassword) return notify("Mật khẩu nhập lại không khớp.");
    if (newPassword === currentPassword) return notify("Mật khẩu mới phải khác mật khẩu hiện tại.");

    setPasswordSaving(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      passwordForm.reset();
      notify("Đổi mật khẩu thành công. Hãy dùng mật khẩu mới ở lần đăng nhập tiếp theo.");
    } catch (error) {
      const code = (error as { code?: string } | null)?.code || "";
      const messages: Record<string, string> = {
        "auth/wrong-password": "Mật khẩu hiện tại không đúng.",
        "auth/invalid-credential": "Mật khẩu hiện tại không đúng hoặc phiên đăng nhập không còn hợp lệ.",
        "auth/invalid-login-credentials": "Mật khẩu hiện tại không đúng.",
        "auth/weak-password": "Mật khẩu mới chưa đáp ứng yêu cầu bảo mật của tài khoản.",
        "auth/password-does-not-meet-requirements": "Mật khẩu mới chưa đáp ứng yêu cầu bảo mật của tài khoản.",
        "auth/too-many-requests": "Bạn đã thử quá nhiều lần. Vui lòng thử lại sau.",
        "auth/requires-recent-login": "Phiên đăng nhập đã hết hạn xác thực. Hãy đăng nhập lại rồi đổi mật khẩu.",
        "auth/user-token-expired": "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.",
        "auth/user-disabled": "Tài khoản hiện đang bị vô hiệu hóa.",
        "auth/network-request-failed": "Không kết nối được Firebase. Hãy kiểm tra mạng và thử lại.",
      };
      notify(messages[code] || "Không thể đổi mật khẩu. Vui lòng thử lại.");
    } finally {
      setPasswordSaving(false);
    }
  };

  const filteredBookings =
    bookingFilter === "Tất cả"
      ? bookings
      : bookings.filter((booking) => booking.status === bookingFilter);

  const createBooking = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const user = auth.currentUser;
    if (!user) return notify("Bạn cần đăng nhập lại.");
    if (account.verificationStatus !== "approved") {
      setView("verify");
      return notify("Tài khoản cần được Staff duyệt trước khi gửi đơn thuê.");
    }
    const form = new FormData(event.currentTarget);
    const vehicleId = String(form.get("vehicleId") || "");
    const startDate = String(form.get("startDate") || "");
    const endDate = String(form.get("endDate") || "");
    const bike = bikes.find((item) => item.id === vehicleId);
    // Cơ sở duy nhất: lấy location đầu tiên từ Firestore hoặc dùng mặc định
    const location = locations[0] || { id: "default", name: "Vi Vu Bike - Cơ sở chính" };
    const days = Math.ceil(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000,
    );
    if (!bike || !startDate || !endDate || days < 1)
      return notify("Hãy chọn xe và ngày trả sau ngày nhận.");
    try {
      const code = `VVB-${Date.now().toString().slice(-6)}`;
      await addDoc(collection(db, "bookings"), {
        code,
        customerId: user.uid,
        customerName: account.fullName,
        customerEmail: account.email,
        vehicleId: bike.id,
        vehicleName: bike.name,
        vehicleImage: bike.image,
        dailyPrice: bike.price,
        pickupLocationId: location.id,
        pickupLocationName: location.name,
        startDate,
        endDate,
        rentalDays: days,
        totalAmount: days * bike.price,
        note: String(form.get("note") || "").trim(),
        amenities: ["02 mũ bảo hiểm", "01 áo mưa"],
        status: "Chờ xác nhận",
        createdAt: serverTimestamp(),
      });
      setView("bookings");
      notify(`Đã tạo đơn ${code}. Staff sẽ liên hệ xác nhận.`);
    } catch {
      notify(
        "Không thể tạo đơn. Hãy kiểm tra Firestore Rules cho collection bookings.",
      );
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    window.location.assign("/");
  };

  return (
    <main className="customer-app">
      {notice && <div className="toast">✓ {notice}</div>}

      <aside className="sidebar">
        <a href="/" className="brand">
          <span>V</span> VI VU <b>BIKE</b>
        </a>
        <div className="customer-card">
          <div className="avatar">{initials(account.fullName)}</div>
          <div>
            <b>{account.fullName}</b>
            <small>{account.role}</small>
          </div>
        </div>
        <div className="verify-mini">
          <span>!</span>
          <div>
            <b>{verificationLabel(account.verificationStatus)}</b>
            <small>
              {account.verificationStatus === "approved"
                ? "Tài khoản có thể gửi yêu cầu thuê xe."
                : "Gửi CCCD và bằng lái để đặt xe."}
            </small>
          </div>
        </div>
        <nav>
          <a className="home-link" href="/">
            ⌂ <span>Trang chủ</span>
          </a>
          <p className="nav-label">HOẠT ĐỘNG THUÊ XE</p>
          {menu.slice(0, 3).map((item) => (
            <button
              key={item.id}
              className={view === item.id ? "selected" : ""}
              onClick={() => setView(item.id)}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
          <p className="nav-label">TÀI KHOẢN</p>
          {menu.slice(3).map((item) => (
            <button
              key={item.id}
              className={view === item.id ? "selected" : ""}
              onClick={() => setView(item.id)}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <button
          className="logout"
          onClick={handleLogout}
        >
          ↪ Đăng xuất
        </button>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p>KHÁCH HÀNG</p>
            <h1>{menu.find((item) => item.id === view)?.label}</h1>
          </div>
          <div className="top-user">
            <span className="bell">♧</span>
            <div className="avatar small">{initials(account.fullName)}</div>
            <span>{account.fullName}</span>
          </div>
        </header>

        {view === "overview" && (
          <Overview
            onChangeView={setView}
            fullName={account.fullName}
            verificationStatus={account.verificationStatus}
            bookings={bookings}
          />
        )}
        {view === "rent" && (
          <Rent
            bikes={bikes}
            locations={locations}
            selectedBikeId={selectedBikeId}
            setSelectedBikeId={setSelectedBikeId}
            verified={isVerified(account.verificationStatus)}
            onBooking={createBooking}
          />
        )}
        {view === "bookings" && (
          <Bookings
            filter={bookingFilter}
            setFilter={setBookingFilter}
            data={filteredBookings}
            onDetail={setSelectedBooking}
          />
        )}
        {view === "verify" && (
          <Verification
            verificationSent={verificationSent}
            onSubmit={sendVerification}
            fullName={account.fullName}
            verificationStatus={account.verificationStatus}
            previews={documentPreviews}
            onPreview={previewDocument}
          />
        )}
        {view === "reviews" && <Reviews />}
        {view === "profile" && (
          <Profile
            onSubmit={saveProfile}
            fullName={account.fullName}
            email={account.email}
            phone={account.phone}
            address={account.address}
            saving={profileSaving}
            onPasswordSubmit={changeAccountPassword}
            passwordSaving={passwordSaving}
          />
        )}
      </section>

      {selectedBooking && (
        <BookingDetail
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
        />
      )}

      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap");
        * {
          box-sizing: border-box;
        }
        .customer-app {
          min-height: 100vh;
          background: #f5f6f7;
          color: #171717;
          font-family: "Be Vietnam Pro", Arial, sans-serif;
          display: grid;
          grid-template-columns: 268px 1fr;
        }
        .sidebar {
          background: #151515;
          color: #fff;
          padding: 26px 16px;
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          position: sticky;
          top: 0;
          height: 100vh;
        }
        .brand {
          align-items: center;
          color: #fff;
          display: flex;
          font-size: 15px;
          font-weight: 800;
          gap: 8px;
          letter-spacing: 0.06em;
          text-decoration: none;
          padding: 0 8px;
        }
        .brand > span {
          background: #f26522;
          clip-path: polygon(50% 0, 100% 18%, 82% 100%, 18% 100%, 0 18%);
          display: grid;
          height: 31px;
          place-items: center;
          width: 31px;
        }
        .brand b {
          color: #f26522;
        }
        .customer-card {
          align-items: center;
          border-bottom: 1px solid #333;
          display: flex;
          gap: 11px;
          margin: 31px 8px 15px;
          padding-bottom: 17px;
        }
        .customer-card b,
        .customer-card small {
          display: block;
        }
        .customer-card small {
          color: #999;
          font-size: 12px;
          margin-top: 3px;
        }
        .avatar {
          align-items: center;
          background: #f26522;
          border-radius: 50%;
          color: #fff;
          display: flex;
          font-size: 13px;
          font-weight: 800;
          height: 42px;
          justify-content: center;
          width: 42px;
        }
        .avatar.small {
          height: 34px;
          width: 34px;
          font-size: 11px;
        }
        .verify-mini {
          background: #292725;
          display: flex;
          gap: 10px;
          margin: 0 8px 25px;
          padding: 12px;
        }
        .verify-mini > span {
          align-items: center;
          background: #f26522;
          border-radius: 50%;
          display: flex;
          font-size: 12px;
          font-weight: 800;
          height: 20px;
          justify-content: center;
          width: 20px;
        }
        .verify-mini b,
        .verify-mini small {
          display: block;
        }
        .verify-mini b {
          font-size: 12px;
        }
        .verify-mini small {
          color: #bbb;
          font-size: 11px;
          line-height: 1.5;
          margin-top: 3px;
        }
        nav {
          display: grid;
          flex: 1;
          gap: 5px;
          min-height: 0;
          overflow-y: auto;
        }
        .home-link {
          color: #fff;
          font-size: 14px;
          font-weight: 700;
          margin: 0 0 4px;
          padding: 12px;
          text-decoration: none;
        }
        .home-link span {
          margin-left: 11px;
        }
        .home-link:hover {
          background: #292929;
        }
        .nav-label {
          color: #777;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.11em;
          margin: 17px 12px 5px;
        }
        nav button,
        .logout {
          background: transparent;
          border: 0;
          color: #aaa;
          font-size: 14px;
          font-weight: 600;
          padding: 12px;
          text-align: left;
        }
        nav button span {
          display: inline-block;
          font-size: 17px;
          margin-right: 12px;
          width: 18px;
        }
        nav button:hover,
        nav button.selected {
          background: #f26522;
          color: #fff;
        }
        .logout {
          border-top: 1px solid #333;
          flex: 0 0 auto;
          margin: 10px 8px 0;
          padding: 16px 4px 0;
        }
        .content {
          min-width: 0;
        }
        .topbar {
          align-items: center;
          background: #fff;
          display: flex;
          justify-content: space-between;
          padding: 22px clamp(22px, 4vw, 56px);
        }
        .topbar p {
          color: #f26522;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.13em;
          margin: 0 0 5px;
        }
        .topbar h1 {
          font-size: 27px;
          letter-spacing: -0.04em;
          margin: 0;
        }
        .top-user {
          align-items: center;
          display: flex;
          font-size: 13px;
          font-weight: 700;
          gap: 10px;
        }
        .bell {
          font-size: 22px;
          margin-right: 10px;
        }
        .page {
          margin: auto;
          max-width: 1250px;
          padding: 32px clamp(22px, 4vw, 56px) 60px;
        }
        .notice-box {
          align-items: center;
          background: #fff4ed;
          border: 1px solid #ffd5bd;
          display: flex;
          gap: 16px;
          justify-content: space-between;
          margin-bottom: 28px;
          padding: 18px 20px;
        }
        .notice-box h3 {
          font-size: 15px;
          margin: 0 0 5px;
        }
        .notice-box p {
          color: #6c5a51;
          font-size: 13px;
          margin: 0;
        }
        .notice-icon {
          background: #f26522;
          border-radius: 50%;
          color: #fff;
          display: grid;
          font-weight: 800;
          height: 30px;
          place-items: center;
          width: 30px;
        }
        .button {
          background: #f26522;
          border: 0;
          color: #fff;
          font-size: 13px;
          font-weight: 800;
          padding: 12px 16px;
          white-space: nowrap;
        }
        .button:hover {
          background: #d94c0f;
        }
        .button.light {
          background: #fff;
          border: 1px solid #dadada;
          color: #222;
        }
        .button.light:hover {
          background: #f2f2f2;
        }
        .overview-title {
          margin: 0 0 24px;
        }
        .overview-title h2 {
          font-size: 25px;
          letter-spacing: -0.04em;
          margin: 0 0 7px;
        }
        .overview-title p {
          color: #666;
          font-size: 14px;
          margin: 0;
        }
        .stats {
          display: grid;
          gap: 18px;
          grid-template-columns: repeat(3, 1fr);
          margin-bottom: 30px;
        }
        .stat {
          background: #fff;
          border: 1px solid #e8e8e8;
          padding: 21px;
        }
        .stat p {
          color: #666;
          font-size: 13px;
          margin: 0 0 16px;
        }
        .stat b {
          font-size: 29px;
          letter-spacing: -0.05em;
        }
        .stat span {
          color: #20a66a;
          display: block;
          font-size: 11px;
          font-weight: 700;
          margin-top: 7px;
        }
        .panel {
          background: #fff;
          border: 1px solid #e5e5e5;
          margin-top: 20px;
        }
        .panel-head {
          align-items: center;
          border-bottom: 1px solid #e8e8e8;
          display: flex;
          justify-content: space-between;
          padding: 20px 23px;
        }
        .panel-head h2 {
          font-size: 17px;
          margin: 0;
        }
        .panel-head button {
          background: none;
          border: 0;
          color: #e95c20;
          font-size: 13px;
          font-weight: 800;
        }
        .booking-preview {
          align-items: center;
          display: grid;
          gap: 18px;
          grid-template-columns: auto 1.4fr 1fr 1fr auto;
          padding: 21px 23px;
        }
        .bike-round {
          align-items: center;
          background: #f3f3f3;
          border-radius: 50%;
          display: flex;
          height: 47px;
          justify-content: center;
          width: 47px;
        }
        .bike-round span {
          font-size: 22px;
        }
        .booking-preview b,
        .booking-preview small {
          display: block;
        }
        .booking-preview b {
          font-size: 14px;
        }
        .booking-preview small {
          color: #777;
          font-size: 12px;
          line-height: 1.5;
          margin-top: 5px;
        }
        .tag {
          border-radius: 50px;
          display: inline-block;
          font-size: 11px;
          font-weight: 800;
          padding: 7px 10px;
        }
        .tag.pending {
          background: #fff2dc;
          color: #a56600;
        }
        .tag.confirmed {
          background: #e8efff;
          color: #2058a6;
        }
        .tag.active {
          background: #dff6ea;
          color: #0f8a4a;
        }
        .tag.done {
          background: #edf0f2;
          color: #5b6268;
        }
        .tag.cancelled {
          background: #f1f3f5;
          color: #dc3545;
        }
        .quick-actions {
          display: grid;
          gap: 18px;
          grid-template-columns: repeat(3, 1fr);
        }
        .quick-actions button {
          background: #fff;
          border: 1px solid #e5e5e5;
          font-size: 14px;
          font-weight: 800;
          padding: 20px;
          text-align: left;
        }
        .quick-actions button:hover {
          border-color: #f26522;
          color: #e95c20;
        }
        .quick-actions span {
          color: #f26522;
          display: block;
          font-size: 20px;
          margin-bottom: 15px;
        }
        .section-title {
          align-items: end;
          display: flex;
          justify-content: space-between;
          margin-bottom: 23px;
        }
        .section-title h2 {
          font-size: 25px;
          letter-spacing: -0.04em;
          margin: 0 0 7px;
        }
        .section-title p {
          color: #666;
          font-size: 14px;
          margin: 0;
        }
        .bike-grid {
          display: grid;
          gap: 20px;
          grid-template-columns: repeat(3, 1fr);
        }
        .bike-card {
          background: #fff;
          border: 1px solid #e5e5e5;
        }
        .bike-card img {
          display: block;
          height: 175px;
          object-fit: cover;
          width: 100%;
        }
        .bike-card main {
          padding: 18px;
        }
        .bike-card small {
          color: #f26522;
          font-size: 12px;
          font-weight: 800;
        }
        .bike-card h3 {
          font-size: 18px;
          margin: 8px 0;
        }
        .bike-card p {
          color: #666;
          font-size: 12px;
          line-height: 1.5;
          margin: 0 0 17px;
        }
        .price-row {
          align-items: center;
          border-top: 1px solid #eee;
          display: flex;
          justify-content: space-between;
          padding-top: 15px;
        }
        .price-row b {
          color: #e95c20;
          font-size: 14px;
        }
        .booking-stepper-container {
          display: flex;
          align-items: center;
          gap: 24px;
          background: #fff;
          padding: 16px 24px;
          border: 1px solid #e4e7e9;
          margin-bottom: 24px;
          overflow-x: auto;
        }
        .all-btn {
          background: #f1f3f4;
          border: 1px solid #ddd;
          padding: 8px 16px;
          border-radius: 4px;
          font-weight: 600;
          font-size: 13px;
          color: #555;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.2s;
        }
        .all-btn.active, .all-btn:hover {
          background: #ea580c;
          border-color: #ea580c;
          color: #fff;
        }
        .stepper-wrapper {
          display: flex;
          align-items: flex-start;
          flex: 1;
          min-width: 500px;
        }
        .stepper-step {
          flex: 1;
          display: flex;
          flex-direction: column;
          cursor: pointer;
          position: relative;
        }
        .step-node {
          display: flex;
          align-items: center;
          margin-bottom: 8px;
        }
        .step-circle {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #f3f4f6;
          border: 2px solid #d1d5db;
          color: #6b7280;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
          z-index: 2;
          transition: all 0.2s;
        }
        .step-line {
          flex: 1;
          height: 2px;
          background: #e5e7eb;
          margin: 0 8px;
          transition: all 0.2s;
        }
        .stepper-step.active .step-circle {
          background: #ea580c;
          border-color: #ea580c;
          color: #fff;
          box-shadow: 0 0 0 4px rgba(234, 88, 12, 0.15);
        }
        .stepper-step.active .step-line {
          background: #ea580c;
        }
        .stepper-step:hover .step-circle {
          background: #fed7aa;
          color: #ea580c;
          border-color: #ea580c;
        }
        .step-label {
          font-size: 13px;
          color: #6b7280;
          font-weight: 500;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .stepper-step.active .step-label {
          color: #ea580c;
          font-weight: 800;
        }
        .step-count {
          font-size: 11px;
          color: #9ca3af;
          margin-left: 4px;
        }
        .booking-table {
          width: 100%;
          border-collapse: collapse;
        }
        .booking-table th {
          background: #f7f7f7;
          color: #777;
          font-size: 12px;
          text-align: left;
        }
        .booking-table td,
        .booking-table th {
          border-bottom: 1px solid #eee;
          padding: 16px;
        }
        .booking-table td {
          font-size: 13px;
        }
        .booking-table b {
          display: block;
        }
        .booking-table small {
          color: #777;
          display: block;
          font-size: 11px;
          margin-top: 4px;
        }
        .text-button {
          background: none;
          border: 0;
          color: #e95c20;
          font-size: 12px;
          font-weight: 800;
        }
        .verify-layout {
          display: grid;
          gap: 22px;
          grid-template-columns: 1.25fr 0.75fr;
        }
        .verify-form {
          background: #fff;
          border: 1px solid #e5e5e5;
          padding: 26px;
        }
        .verify-form h2 {
          font-size: 20px;
          margin: 0 0 8px;
        }
        .verify-form > p {
          color: #666;
          font-size: 13px;
          line-height: 1.6;
          margin: 0 0 23px;
        }
        .form-grid {
          display: grid;
          gap: 16px;
          grid-template-columns: 1fr 1fr;
        }
        .field {
          display: grid;
          gap: 7px;
          font-size: 12px;
          font-weight: 800;
          align-content: start;
        }
        .field input {
          border: 1px solid #ddd;
          font: inherit;
          padding: 11px;
        }
        .upload-grid {
          display: grid;
          gap: 14px;
          grid-template-columns: repeat(3, 1fr);
          margin: 21px 0;
        }
        .upload {
          border: 1px dashed #bdbdbd;
          cursor: pointer;
          display: grid;
          min-height: 116px;
          place-items: center;
          padding: 15px;
          text-align: center;
        }
        .upload input {
          display: none;
        }
        .upload span {
          color: #e95c20;
          display: block;
          font-size: 20px;
        }
        .upload b {
          display: block;
          font-size: 12px;
          margin-top: 8px;
        }
        .upload small {
          color: #777;
          font-size: 10px;
          margin-top: 5px;
        }
        .upload.has-preview {
          border-color: #f26522;
          padding: 5px;
          position: relative;
        }
        .upload.has-preview img {
          height: 104px;
          object-fit: cover;
          width: 100%;
        }
        .upload.has-preview em {
          background: rgba(0, 0, 0, 0.7);
          bottom: 5px;
          color: #fff;
          font-size: 10px;
          font-style: normal;
          font-weight: 700;
          left: 5px;
          padding: 5px 7px;
          position: absolute;
          right: 5px;
        }
        .verify-side {
          background: #171717;
          color: #fff;
          padding: 25px;
        }
        .verify-side h3 {
          font-size: 18px;
          margin: 0 0 20px;
        }
        .verify-step {
          border-top: 1px solid #444;
          display: flex;
          gap: 12px;
          padding: 15px 0;
        }
        .verify-step span {
          color: #f26522;
          font-size: 13px;
          font-weight: 800;
        }
        .verify-step b,
        .verify-step small {
          display: block;
        }
        .verify-step b {
          font-size: 13px;
        }
        .verify-step small {
          color: #bbb;
          font-size: 11px;
          line-height: 1.5;
          margin-top: 4px;
        }
        .review-card {
          background: #fff;
          border: 1px solid #e5e5e5;
          padding: 24px;
        }
        .review-card h3 {
          font-size: 17px;
          margin: 0 0 7px;
        }
        .review-card p {
          color: #666;
          font-size: 13px;
          margin: 0 0 20px;
        }
        .stars {
          display: flex;
          gap: 5px;
          margin-bottom: 20px;
        }
        .stars button {
          background: none;
          border: 0;
          color: #f26522;
          font-size: 26px;
          padding: 0;
        }
        .review-card textarea {
          border: 1px solid #ddd;
          font: inherit;
          min-height: 100px;
          padding: 12px;
          resize: vertical;
          width: 100%;
        }
        .review-card .button {
          margin-top: 14px;
        }
        .profile-form {
          background: #fff;
          border: 1px solid #e5e5e5;
          max-width: 720px;
          padding: 27px;
        }
        .profile-form button:disabled {
          opacity: .6;
          cursor: not-allowed;
        }
        .profile-form h2 {
          font-size: 20px;
          margin: 0 0 23px;
        }
        .profile-form .form-grid {
          margin-bottom: 20px;
        }
        .bill-modal { max-width: 680px; padding: 0; overflow: hidden; }
        .bill-wrap { background: #fff; padding: 32px 36px; }
        .bill-header { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 3px solid #f26522; padding-bottom: 20px; margin-bottom: 22px; gap: 16px; flex-wrap: wrap; }
        .bill-logo { display: flex; align-items: center; gap: 12px; }
        .bill-logo-mark { align-items: center; background: #f26522; clip-path: polygon(50% 0,100% 18%,82% 100%,18% 100%,0 18%); color: #fff; display: flex; font-size: 16px; font-weight: 900; height: 44px; justify-content: center; width: 44px; flex-shrink: 0; }
        .bill-brand { font-size: 18px; font-weight: 900; letter-spacing: .06em; color: #151718; }
        .bill-brand b { color: #f26522; }
        .bill-brand-sub { font-size: 11px; color: #888; margin-top: 2px; }
        .bill-title-block { text-align: right; }
        .bill-title { font-size: 14px; font-weight: 800; letter-spacing: .06em; color: #151718; margin: 0 0 8px; text-transform: uppercase; }
        .bill-meta { display: flex; flex-direction: column; gap: 3px; }
        .bill-meta span { font-size: 12px; color: #666; }
        .bill-meta b { color: #171717; }
        .bill-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 22px; }
        .bill-section-label { color: #f26522; font-size: 10px; font-weight: 800; letter-spacing: .12em; margin: 0 0 10px; text-transform: uppercase; }
        .bill-info-line { display: flex; justify-content: space-between; font-size: 13px; margin: 0 0 6px; gap: 8px; }
        .bill-info-line span { color: #888; flex-shrink: 0; }
        .bill-info-line b { text-align: right; }
        .bill-table { border-collapse: collapse; width: 100%; margin-bottom: 0; font-size: 13px; }
        .bill-table thead tr { background: #f8f8f8; border-bottom: 2px solid #eee; }
        .bill-table th { font-size: 11px; font-weight: 800; letter-spacing: .08em; padding: 10px 14px; text-align: left; color: #555; text-transform: uppercase; }
        .bill-table td { padding: 11px 14px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
        .bill-amount { text-align: right; font-weight: 700; white-space: nowrap; }
        .bill-row-deduct td { color: #15834b; }
        .bill-row-penalty td { color: #c55720; font-weight: 700; }
        .bill-row-reason td { color: #888; font-size: 12px; padding-top: 2px; padding-bottom: 10px; border-bottom: 1px solid #f0f0f0; }
        .bill-grand { background: #f26522; color: #fff; display: flex; align-items: center; justify-content: space-between; padding: 18px 24px; margin-top: 0; }
        .bill-grand span { font-size: 12px; font-weight: 800; letter-spacing: .06em; opacity: .92; text-transform: uppercase; }
        .bill-grand b { font-size: 26px; font-weight: 900; letter-spacing: -.02em; }
        .bill-grand.refund, .bill-grand.completed { background: #15834b; }
        .bill-footer { text-align: center; padding: 18px 0 4px; border-top: 1px dashed #ddd; margin-top: 18px; }
        .bill-footer p { margin: 0 0 4px; font-size: 13px; color: #555; }
        .bill-footer-sub { font-size: 11px; color: #aaa !important; }
        .bill-actions { display: flex; gap: 10px; justify-content: flex-end; padding: 16px 24px; background: #fafafa; border-top: 1px solid #eee; flex-wrap: wrap; }
        @media print {
          .booking-modal-backdrop { position: static; background: none; padding: 0; }
          .bill-modal { box-shadow: none; max-width: 100%; }
          .bill-actions { display: none; }
          body *:not(.bill-modal):not(.bill-modal *) { display: none; }
        }
        .toast {
          background: #171717;
          box-shadow: 0 12px 28px rgba(0, 0, 0, 0.2);
          color: #fff;
          font-size: 14px;
          left: 50%;
          padding: 14px 19px;
          position: fixed;
          top: 20px;
          transform: translateX(-50%);
          z-index: 20;
        }
        @media (max-width: 1000px) {
          .customer-app {
            grid-template-columns: 220px 1fr;
          }
          .bike-grid {
            grid-template-columns: 1fr 1fr;
          }
          .booking-preview {
            grid-template-columns: auto 1fr 1fr;
          }
          .booking-preview .button {
            grid-column: 2;
          }
          .verify-layout {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 720px) {
          .customer-app {
            display: block;
          }
          .sidebar {
            height: auto;
            min-height: auto;
            position: static;
          }
          .sidebar nav {
            display: flex;
            overflow: auto;
          }
          .sidebar nav button {
            flex: 0 0 auto;
          }
          .sidebar nav button span {
            display: none;
          }
          .customer-card,
          .verify-mini {
            display: none;
          }
          .logout {
            display: block;
            margin: 12px 8px 0;
          }
          .content {
            min-width: 0;
          }
          .topbar {
            padding: 17px 20px;
          }
          .top-user > span:not(.bell) {
            display: none;
          }
          .topbar h1 {
            font-size: 22px;
          }
          .page {
            padding: 25px 18px;
          }
          .notice-box {
            align-items: start;
            flex-wrap: wrap;
          }
          .stats,
          .quick-actions,
          .bike-grid {
            grid-template-columns: 1fr;
          }
          .booking-preview {
            grid-template-columns: auto 1fr;
          }
          .booking-preview > div:nth-of-type(2),
          .booking-preview > div:nth-of-type(3) {
            grid-column: 2;
          }
          .booking-preview .button {
            grid-column: 1/-1;
          }
          .section-title {
            align-items: start;
            flex-direction: column;
            gap: 15px;
          }
          .booking-stepper-container {
            width: 100%;
          }
          .booking-table {
            min-width: 650px;
          }
          .panel {
            overflow-x: auto;
          }
          .form-grid,
          .upload-grid {
            grid-template-columns: 1fr;
          }
          .top-user .bell {
            margin: 0;
          }
          .sidebar {
            padding: 18px 12px;
          }
          .brand {
            padding: 0;
          }
          .sidebar nav {
            margin-top: 18px;
          }
          .nav-label {
            display: none;
          }
          .home-link {
            display: none;
          }
        }
      `}</style>
      <style jsx global>{`
        .bike-card.chosen {
          border: 2px solid #f26522;
          box-shadow: 0 12px 30px rgba(242, 101, 34, 0.16);
        }
        .rental-checkout {
          background: #fff;
          border: 1px solid #e4e7e9;
          display: grid;
          gap: 0;
          grid-template-columns: minmax(0, 1.25fr) minmax(310px, 0.75fr);
          margin-top: 28px;
        }
        .rental-form {
          padding: 30px;
        }
        .rental-form-head {
          border-bottom: 1px solid #e9eaeb;
          margin-bottom: 24px;
          padding-bottom: 21px;
        }
        .rental-form-head p,
        .rental-summary > p,
        .modal-title p,
        .modal-bike small {
          color: #e95c20;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.12em;
          margin: 0 0 8px;
        }
        .rental-form-head h2 {
          font-size: 24px;
          letter-spacing: -0.04em;
          margin: 0 0 8px;
        }
        .rental-form-head > span {
          color: #687078;
          display: block;
          font-size: 13px;
          line-height: 1.6;
        }
        .rental-form-head span b {
          color: #c65019;
        }
        .rental-fields {
          display: grid;
          gap: 16px;
          grid-template-columns: 1fr 1fr;
        }
        .rental-fields .field.wide {
          grid-column: 1 / -1;
        }
        .rental-fields .field > span {
          color: #858d93;
          font-size: 11px;
          font-weight: 500;
        }
        .rental-fields input,
        .rental-fields select,
        .rental-fields textarea {
          background: #fff;
          border: 1px solid #dce1e4;
          color: #1e252a;
          font: inherit;
          font-size: 13px;
          min-height: 43px;
          padding: 10px 11px;
        }
        .rental-fields input:read-only {
          background: #f7f8f9;
          color: #566068;
        }
        .rental-fields select:focus,
        .rental-fields input:focus,
        .rental-fields textarea:focus {
          border-color: #f26522;
          outline: 2px solid rgba(242, 101, 34, 0.12);
        }
        .rental-fields textarea {
          min-height: 92px;
          resize: vertical;
        }
        .rental-actions {
          align-items: center;
          display: flex;
          gap: 18px;
          margin-top: 24px;
        }
        .rental-actions .button {
          border-radius: 7px;
          padding: 13px 17px;
        }
        .rental-actions .button:disabled {
          background: #b8bfc4;
          cursor: not-allowed;
        }
        .rental-summary {
          background: #1a1d20;
          color: #fff;
          padding: 30px;
        }
        .rental-summary > p {
          color: #ff9767;
        }
        .rental-bike {
          align-items: center;
          border-bottom: 1px solid rgba(255, 255, 255, 0.16);
          display: flex;
          gap: 13px;
          padding: 6px 0 22px;
        }
        .rental-bike img,
        .rental-bike > span {
          background: #343a40;
          display: grid;
          flex: 0 0 auto;
          height: 68px;
          object-fit: cover;
          place-items: center;
          width: 82px;
        }
        .rental-bike small,
        .rental-bike b,
        .rental-bike strong {
          display: block;
        }
        .rental-bike small {
          color: #ffaf89;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.08em;
          margin-bottom: 5px;
        }
        .rental-bike b {
          font-size: 15px;
        }
        .rental-bike strong {
          color: #fff;
          font-size: 12px;
          margin-top: 6px;
        }
        .summary-line {
          border-bottom: 1px solid rgba(255, 255, 255, 0.12);
          display: grid;
          gap: 7px;
          padding: 17px 0;
        }
        .summary-line span,
        .summary-total span {
          color: #abb5bc;
          font-size: 12px;
        }
        .summary-line b {
          font-size: 13px;
          line-height: 1.45;
        }
        .summary-total {
          border-bottom: 1px solid rgba(255, 255, 255, 0.12);
          padding: 19px 0;
        }
        .summary-total b,
        .summary-total small {
          display: block;
        }
        .summary-total b {
          color: #ff8c59;
          font-size: 24px;
          letter-spacing: -0.04em;
          margin: 7px 0;
        }
        .summary-total small {
          color: #aeb8be;
          font-size: 11px;
          line-height: 1.5;
        }
        .summary-included {
          display: grid;
          gap: 8px;
          padding-top: 19px;
        }
        .summary-included b {
          font-size: 12px;
        }
        .summary-included span {
          color: #cdd4d8;
          font-size: 12px;
        }
        .booking-modal-backdrop {
          align-items: center;
          background: rgba(15, 19, 22, 0.6);
          display: flex;
          inset: 0;
          justify-content: center;
          padding: 24px;
          position: fixed;
          z-index: 100;
        }
        .booking-modal {
          background: #fff;
          box-shadow: 0 30px 70px rgba(0, 0, 0, 0.28);
          max-height: calc(100vh - 48px);
          max-width: 760px;
          overflow: auto;
          padding: 30px;
          position: relative;
          width: 100%;
        }
        .modal-close {
          align-items: center;
          background: #f1f3f4;
          border: 0;
          border-radius: 50%;
          display: flex;
          font-size: 14px;
          height: 32px;
          justify-content: center;
          position: absolute;
          right: 22px;
          top: 22px;
          width: 32px;
        }
        .modal-title {
          align-items: flex-start;
          border-bottom: 1px solid #e9ecee;
          display: flex;
          gap: 16px;
          justify-content: space-between;
          padding-bottom: 21px;
          padding-right: 44px;
        }
        .modal-title h2 {
          font-size: 25px;
          letter-spacing: -0.04em;
          margin: 0 0 5px;
        }
        .modal-title small {
          color: #737d84;
          font-size: 11px;
        }
        .modal-bike {
          align-items: center;
          background: #f6f7f8;
          display: flex;
          gap: 15px;
          margin: 22px 0;
          padding: 15px;
        }
        .modal-bike img,
        .modal-bike > span {
          background: #e5e8eb;
          display: grid;
          height: 68px;
          object-fit: cover;
          place-items: center;
          width: 92px;
        }
        .modal-bike h3 {
          font-size: 17px;
          margin: 0 0 5px;
        }
        .modal-bike p {
          color: #e95c20;
          font-size: 13px;
          font-weight: 800;
          margin: 0;
        }
        .detail-grid {
          display: grid;
          gap: 12px;
          grid-template-columns: 1fr 1fr;
        }
        .detail-grid article,
        .detail-note,
        .detail-included {
          border: 1px solid #e4e7e9;
          padding: 16px;
        }
        .detail-grid span,
        .detail-grid b,
        .detail-grid small {
          display: block;
        }
        .detail-grid span {
          color: #737d84;
          font-size: 11px;
          margin-bottom: 7px;
        }
        .detail-grid b {
          color: #21282e;
          font-size: 13px;
          line-height: 1.45;
        }
        .detail-grid small {
          color: #7a838a;
          font-size: 11px;
          line-height: 1.45;
          margin-top: 5px;
        }
        .detail-note,
        .detail-included {
          margin-top: 12px;
        }
        .detail-note b,
        .detail-included b {
          display: block;
          font-size: 12px;
        }
        .detail-note p {
          color: #5f6a72;
          font-size: 13px;
          line-height: 1.6;
          margin: 8px 0 0;
        }
        .detail-included > div {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 11px;
        }
        .detail-included span {
          background: #fff2eb;
          color: #c7511b;
          font-size: 11px;
          font-weight: 700;
          padding: 7px 8px;
        }
        .modal-button {
          border-radius: 7px;
          margin-top: 20px;
        }
        @media (max-width: 900px) {
          .rental-checkout {
            grid-template-columns: 1fr;
          }
          .rental-summary {
            order: -1;
          }
        }
        @media (max-width: 620px) {
          .rental-form,
          .rental-summary,
          .booking-modal {
            padding: 20px;
          }
          .rental-fields,
          .detail-grid {
            grid-template-columns: 1fr;
          }
          .rental-fields .field.wide {
            grid-column: auto;
          }
          .booking-modal-backdrop {
            align-items: flex-start;
            overflow: auto;
            padding: 12px;
          }
          .booking-modal {
            max-height: none;
            margin: auto 0;
          }
          .modal-title {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>
    </main>
  );
}

function Overview({
  onChangeView,
  fullName,
  verificationStatus,
  bookings,
}: {
  onChangeView: (view: View) => void;
  fullName: string;
  verificationStatus: string;
  bookings: Booking[];
}) {
  const verified = isVerified(verificationStatus);

  const pendingCount = bookings.filter((b) => b.status === "Chờ xác nhận").length;
  const completedCount = bookings.filter((b) => b.status === "Đã hoàn thành").length;

  const getTimestamp = (value: unknown) => {
    const timestamp = value as { toDate?: () => Date } | undefined;
    const date = value instanceof Date ? value : typeof timestamp?.toDate === "function" ? timestamp.toDate() : null;
    return date ? date.getTime() : 0;
  };

  const sortedBookings = [...bookings].sort((a, b) => getTimestamp(b.createdAt) - getTimestamp(a.createdAt));
  const latestBooking = sortedBookings.length > 0 ? sortedBookings[0] : null;

  return (
    <div className="page">
      {!verified && (
        <div className="notice-box">
          <div className="notice-icon">!</div>
          <div>
            <h3>{verificationLabel(verificationStatus)}</h3>
            <p>Gửi CCCD/CMND và bằng lái để có thể gửi yêu cầu thuê xe.</p>
          </div>
          <button className="button" onClick={() => onChangeView("verify")}>
            Xác minh ngay
          </button>
        </div>
      )}
      <div className="overview-title">
        <h2>Chào {fullName},</h2>
        <p>
          Các số liệu dưới đây được cập nhật dựa trên đơn thuê thực tế của bạn.
        </p>
      </div>
      <div className="stats">
        <article className="stat">
          <p>Đơn chờ xác nhận</p>
          <b>{pendingCount}</b>
          <span>{pendingCount > 0 ? `Có ${pendingCount} đơn đang chờ xác nhận` : "Chưa có dữ liệu đơn thuê"}</span>
        </article>
        <article className="stat">
          <p>Lượt thuê hoàn thành</p>
          <b>{completedCount}</b>
          <span>{completedCount > 0 ? `Đã hoàn thành ${completedCount} lượt thuê` : "Chưa có lượt thuê hoàn thành"}</span>
        </article>
        <article className="stat">
          <p>Trạng thái tài khoản</p>
          <b>{verificationLabel(verificationStatus)}</b>
          <span>
            {verified
              ? "Tài khoản đã đủ điều kiện thuê xe"
              : "Cập nhật từ hồ sơ xác minh"}
          </span>
        </article>
      </div>
      <section className="panel">
        <div className="panel-head">
          <h2>Đơn thuê gần nhất</h2>
          <button onClick={() => onChangeView("bookings")}>
            Xem đơn thuê →
          </button>
        </div>
        {latestBooking ? (
          <div className="booking-preview" style={{ cursor: 'pointer' }} onClick={() => onChangeView("bookings")}>
            <div className="bike-round" style={{ overflow: 'hidden', padding: 0 }}>
              {latestBooking.vehicleImage ? (
                <img src={latestBooking.vehicleImage} alt={latestBooking.bike} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span>⌁</span>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <b>{latestBooking.bike}</b>
              <small>{latestBooking.dates} · {latestBooking.location}</small>
            </div>
            <span className={`tag ${statusClass(latestBooking.status)}`}>
              {latestBooking.status}
            </span>
          </div>
        ) : (
          <div className="booking-preview">
            <div className="bike-round">
              <span>⌁</span>
            </div>
            <div>
              <b>Bạn chưa có đơn thuê nào</b>
              <small>Chọn xe để gửi yêu cầu thuê đầu tiên của bạn.</small>
            </div>
            <button className="button light" onClick={() => onChangeView("rent")}>
              Xem xe cho thuê
            </button>
          </div>
        )}
      </section>
      <section className="panel">
        <div className="panel-head">
          <h2>Thao tác nhanh</h2>
        </div>
        <div className="quick-actions">
          <button onClick={() => onChangeView("rent")}>
            <span>⌁</span>Thuê xe mới
          </button>
          <button onClick={() => onChangeView("verify")}>
            <span>✓</span>Gửi hồ sơ xác minh
          </button>
          <button onClick={() => onChangeView("profile")}>
            <span>◉</span>Cập nhật hồ sơ
          </button>
        </div>
      </section>
    </div>
  );
}

function Rent({
  bikes,
  locations,
  selectedBikeId,
  setSelectedBikeId,
  verified,
  onBooking,
}: {
  bikes: Bike[];
  locations: Location[];
  selectedBikeId: string;
  setSelectedBikeId: (id: string) => void;
  verified: boolean;
  onBooking: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [note, setNote] = useState("");
  const selectedBike = bikes.find((bike) => bike.id === selectedBikeId);
  const defaultLocation = locations[0] || { id: "default", name: "Vi Vu Bike - Cơ sở chính" };
  const money = (value: number) =>
    `${new Intl.NumberFormat("vi-VN").format(value)}đ/ngày`;
  const days =
    startDate && endDate
      ? Math.max(
        0,
        Math.ceil(
          (new Date(endDate).getTime() - new Date(startDate).getTime()) /
          86400000,
        ),
      )
      : 0;
  const total = selectedBike ? days * selectedBike.price : 0;
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedBikeId) {
        setSelectedBikeId("");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedBikeId, setSelectedBikeId]);

  return (
    <div className="page">
      <div className="section-title">
        <div>
          <h2>Xe cho thuê</h2>
          <p>Chọn xe, lịch nhận/trả và gửi yêu cầu thuê trực tiếp.</p>
        </div>
      </div>
      {bikes.length === 0 ? (
        <section className="panel">
          <div className="booking-preview">
            <div className="bike-round">
              <span>⌁</span>
            </div>
            <div>
              <b>Chưa có xe để hiển thị</b>
              <small>Admin chưa thêm xe đang hoạt động.</small>
            </div>
          </div>
        </section>
      ) : (
        <div className="bike-grid">
          {bikes.map((bike) => (
            <article
              className={`bike-card ${selectedBikeId === bike.id ? "chosen" : ""}`}
              key={bike.id}
            >
              <img src={bike.image} alt={bike.name} />
              <main>
                <small>{bike.type}</small>
                <h3>{bike.name}</h3>
                <p>{bike.note || "Xe sẵn sàng phục vụ hành trình của bạn."}</p>
                <div className="price-row">
                  <b>{money(bike.price)}</b>
                  <button
                    className="button"
                    onClick={() => setSelectedBikeId(bike.id)}
                  >
                    Chọn xe
                  </button>
                </div>
              </main>
            </article>
          ))}
        </div>
      )}
      {selectedBike && (
        <div
          className="booking-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedBikeId("");
          }}
          style={{ zIndex: 1000 }}
        >
          <section
            className="rental-checkout"
            role="dialog"
            aria-modal="true"
            style={{
              position: "relative",
              maxWidth: "900px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              margin: "auto",
              borderRadius: "12px",
            }}
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => setSelectedBikeId("")}
              aria-label="Đóng"
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                zIndex: 10,
              }}
            >
              ✕
            </button>
            <form className="rental-form" onSubmit={onBooking}>
              <div className="rental-form-head">
                <p>PHIẾU YÊU CẦU THUÊ</p>
                <h2>Hoàn tất thông tin nhận xe</h2>
                <span>
                  Đơn sẽ ở trạng thái <b>Chờ xác nhận</b> cho đến khi Staff xử lý.
                </span>
              </div>
              <input type="hidden" name="vehicleId" value={selectedBike.id} />

              <div className="rental-fields">
                <label className="field wide">
                  Xe đã chọn
                  <input
                    value={`${selectedBike.name} · ${money(selectedBike.price)}`}
                    readOnly
                  />
                </label>
                <label className="field wide">
                  Địa điểm nhận xe
                  <input
                    value={defaultLocation.name}
                    readOnly
                    style={{ background: "#f5f5f5", color: "#555", cursor: "default" }}
                  />
                </label>
                <label className="field">
                  Ngày nhận xe
                  <input
                    name="startDate"
                    type="date"
                    min={today}
                    required
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                  />
                </label>
                <label className="field">
                  Ngày trả xe
                  <input
                    name="endDate"
                    type="date"
                    min={startDate || today}
                    required
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                  />
                </label>
                <label className="field wide">
                  Ghi chú cho Staff <span>(không bắt buộc)</span>
                  <textarea
                    name="note"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Ví dụ: thời gian dự kiến đến nhận xe"
                  />
                </label>
              </div>

              <div className="rental-actions">
                <button className="button" disabled={!verified}>
                  {verified ? "Gửi yêu cầu thuê xe" : "Cần xác minh tài khoản"}
                </button>
                <button
                  type="button"
                  className="text-button cancel-choice"
                  onClick={() => setSelectedBikeId("")}
                >
                  Bỏ chọn xe
                </button>
              </div>
            </form>

            <aside className="rental-summary">
              <p>TÓM TẮT ĐƠN THUÊ</p>
              <div className="rental-bike">
                {selectedBike.image ? (
                  <img src={selectedBike.image} alt={selectedBike.name} />
                ) : (
                  <span>⌁</span>
                )}
                <div>
                  <small>{selectedBike.type}</small>
                  <b>{selectedBike.name}</b>
                  <strong>{money(selectedBike.price)}</strong>
                </div>
              </div>
              <div className="summary-line">
                <span>Thời gian thuê</span>
                <b>{days ? `${days} ngày` : "Chưa chọn ngày"}</b>
              </div>
              <div className="summary-line">
                <span>Điểm nhận</span>
                <b>{defaultLocation.name}</b>
              </div>
              <div className="summary-total">
                <span>Tổng tiền tạm tính</span>
                <b>
                  {days
                    ? `${new Intl.NumberFormat("vi-VN").format(total)}đ`
                    : "—"}
                </b>
                <small>Giá chính thức được xác nhận trước khi giao xe.</small>
              </div>
              <div className="summary-included">
                <b>Đi kèm trong đơn</b>
                <span>✓ 02 mũ bảo hiểm</span>
                <span>✓ 01 áo mưa</span>
              </div>
            </aside>
          </section>
        </div>
      )}
      <section className="panel">
        <div className="panel-head">
          <h2>Lưu ý khi đặt xe</h2>
        </div>
        <div className="booking-preview">
          <div className="bike-round">
            <span>!</span>
          </div>
          <div>
            <b>
              {verified ? "Hồ sơ đã xác minh" : "Tài khoản cần được xác minh"}
            </b>
            <small>
              {verified
                ? "Bạn có thể gửi yêu cầu; Staff sẽ xác nhận lịch và tình trạng xe."
                : "Staff chỉ xác nhận đơn sau khi hồ sơ xác minh hợp lệ."}
            </small>
          </div>
        </div>
      </section>
    </div>
  );
}

function Bookings({
  filter,
  setFilter,
  data,
  onDetail,
}: {
  filter: string;
  setFilter: (value: string) => void;
  data: Booking[];
  onDetail: (booking: Booking) => void;
}) {
  const filters = [
    "Tất cả",
    "Chờ xác nhận",
    "Đã xác nhận",
    "Đang thuê",
    "Đã hoàn thành",
  ];
  return (
    <div className="page">
      <div className="section-title">
        <div>
          <h2>Đơn thuê của tôi</h2>
          <p>Theo dõi trạng thái và thông tin nhận/trả xe.</p>
        </div>
      </div>
      <div className="booking-stepper-container">
        <button
          className={`all-btn ${filter === "Tất cả" ? "active" : ""}`}
          onClick={() => setFilter("Tất cả")}
        >
          Tất cả
        </button>
        <div className="stepper-wrapper">
          {["Chờ xác nhận", "Đã xác nhận", "Đang thuê", "Đã hoàn thành"].map((stepName, idx) => {
            const stepNum = idx + 1;
            const isActive = filter === stepName;
            // Get count for this step
            const count = data.filter((d) => d.status === stepName).length;

            return (
              <div
                key={stepName}
                className={`stepper-step ${isActive ? "active" : ""}`}
                onClick={() => setFilter(stepName)}
              >
                <div className="step-node">
                  <div className="step-circle">{stepNum}</div>
                  {idx < 3 && <div className="step-line" />}
                </div>
                <div className="step-label">
                  {stepName} {count > 0 && <span className="step-count">({count})</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <section className="panel">
        <table className="booking-table">
          <thead>
            <tr>
              <th>Mã đơn / Xe</th>
              <th>Thời gian thuê</th>
              <th>Điểm nhận xe</th>
              <th>Tổng tiền</th>
              <th>Trạng thái</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.map((booking) => (
              <tr key={booking.code}>
                <td>
                  <b>{booking.code}</b>
                  <small>{booking.bike}</small>
                </td>
                <td>{booking.dates}</td>
                <td>{booking.location}</td>
                <td>{booking.total}</td>
                <td>
                  <span className={`tag ${statusClass(booking.status)}`}>
                    {booking.status}
                  </span>
                </td>
                <td>
                  <button
                    className="text-button"
                    onClick={() => onDetail(booking)}
                  >
                    Chi tiết
                  </button>
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={6}>Không có đơn thuê phù hợp.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function BookingDetail({
  booking,
  onClose,
}: {
  booking: Booking;
  onClose: () => void;
}) {
  const money = (value: number) =>
    `${new Intl.NumberFormat("vi-VN").format(value)}đ`;
  const dateText = (value: string) => {
    if (!value) return "Chưa cập nhật";
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(date);
  };
  const createdAtText = (value: unknown) => {
    const timestamp = value as { toDate?: () => Date } | undefined;
    const date =
      value instanceof Date
        ? value
        : typeof timestamp?.toDate === "function"
          ? timestamp.toDate()
          : null;
    return date
      ? new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date)
      : "Đơn vừa được tạo";
  };

  const fmtDT = (d?: string | Date) => {
    if (!d) return "—";
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return String(d);
    return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
  };
  const duration = (start?: string | Date, end?: string | Date) => {
    if (!start || !end) return "";
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms <= 0) return "";
    const h = Math.floor(ms / 3600000);
    const d = Math.floor(h / 24);
    return d > 0 ? `(${d} ngày ${h % 24} giờ)` : `(${h} giờ)`;
  };
  const lateMinutes = (plannedReturn?: string | Date, actual?: string | Date) => {
    if (!plannedReturn) return 0;
    const a = actual ? new Date(actual) : new Date();
    const p = new Date(plannedReturn);
    return Math.floor((a.getTime() - p.getTime()) / 60000);
  };
  const lateText = (minutes: number) => {
    if (minutes <= 0) return "";
    const d = Math.floor(minutes / 1440);
    const h = Math.floor((minutes % 1440) / 60);
    const m = minutes % 60;
    let s = "Quá hạn ";
    if (d > 0) s += `${d} ngày `;
    if (h > 0) s += `${h} giờ `;
    if (m > 0 && d === 0) s += `${m} phút`;
    return s.trim();
  };

  const isCompleted = booking.status === "Đã hoàn thành";

  return (
    <div
      className="booking-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {isCompleted ? (
        <section className="modal bill-modal" role="dialog" aria-modal="true" style={{ maxWidth: '680px', padding: 0, overflow: 'hidden', backgroundColor: '#fff', width: '100%', position: 'relative' }}>
          <div className="bill-wrap" id="bill-print-area" style={{ padding: '32px 36px' }}>
            <div className="bill-header">
              <div className="bill-logo">
                <span className="bill-logo-mark">V</span>
                <div>
                  <div className="bill-brand">VI VU <b>BIKE</b></div>
                  <div className="bill-brand-sub">Dịch vụ cho thuê xe máy</div>
                </div>
              </div>
              <div className="bill-title-block">
                <h2 className="bill-title">HÓA ĐƠN QUYẾT TOÁN THUÊ XE</h2>
                <div className="bill-meta">
                  <span>Mã phiếu: <b>{booking.code}</b></span>
                  <span>Ngày: <b>{createdAtText(new Date())}</b></span>
                </div>
              </div>
            </div>

            <div className="bill-info-grid">
              <div className="bill-info-col">
                <p className="bill-section-label">THÔNG TIN KHÁCH HÀNG</p>
                <p className="bill-info-line"><span>Họ tên:</span><b>{booking.customerName}</b></p>
                <p className="bill-info-line"><span>Liên hệ:</span><b>{booking.customerPhone || booking.customerEmail}</b></p>
              </div>
              <div className="bill-info-col">
                <p className="bill-section-label">THÔNG TIN XE THUÊ</p>
                <p className="bill-info-line"><span>Dòng xe:</span><b>{booking.bike}</b></p>
                {booking.licensePlate && <p className="bill-info-line"><span>Biển số:</span><b>{booking.licensePlate}</b></p>}
                <p className="bill-info-line"><span>Nhận xe:</span><b>{fmtDT(booking.actualPickupAt || booking.startDate)}</b></p>
                <p className="bill-info-line"><span>Hẹn trả:</span><b>{fmtDT(booking.endDate)}</b></p>
                <p className="bill-info-line"><span>Trả thực tế:</span><b style={{ color: (() => { const late = lateMinutes(booking.endDate, booking.actualReturnAt); return late > 0 ? "#c55720" : "#15834b"; })() }}>{fmtDT(booking.actualReturnAt)}</b></p>
                {(() => { const late = lateMinutes(booking.endDate, booking.actualReturnAt); return (late > 0) ? <p className="bill-info-line"><span style={{ color: "#c55720", fontWeight: 700 }}>{lateText(late)}</span><b style={{ color: "#c55720" }}>! Phụ phí</b></p> : null; })()}
                {duration(booking.actualPickupAt || booking.startDate, booking.actualReturnAt) && <p className="bill-info-line"><span>Thời lượng:</span><b>{duration(booking.actualPickupAt || booking.startDate, booking.actualReturnAt).replace(/[()]/g, "")}</b></p>}
              </div>
            </div>

            <table className="bill-table">
              <thead>
                <tr><th>Diễn giải</th><th style={{ textAlign: "right" }}>Số tiền</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td>Tiền thuê xe ({booking.bike})</td>
                  <td className="bill-amount">{money(booking.totalAmount || booking.dailyPrice * booking.rentalDays)}</td>
                </tr>
                {(booking.depositAmount || 0) > 0 && (
                  <tr className="bill-row-deduct">
                    <td>Tiền cọc ban đầu (giảm trừ)</td>
                    <td className="bill-amount">- {money(booking.depositAmount || 0)}</td>
                  </tr>
                )}
                {(booking.additionalFee || 0) > 0 && (
                  <>
                    <tr className="bill-row-penalty">
                      <td>Phụ phí phát sinh</td>
                      <td className="bill-amount">+ {money(booking.additionalFee || 0)}</td>
                    </tr>
                    {booking.feeReason && (
                      <tr className="bill-row-reason">
                        <td colSpan={2}><i>└ Lý do: {booking.feeReason}</i></td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>

            {(() => {
              const base = booking.totalAmount || (booking.dailyPrice * booking.rentalDays);
              const grand = base + (booking.additionalFee || 0) - (booking.depositAmount || 0);
              const isRefund = grand < 0;
              return (
                <div className={`bill-grand${isRefund ? " refund" : ""} completed`}>
                  <span>ĐÃ QUYẾT TOÁN</span>
                  <b>{money(Math.abs(grand))}</b>
                </div>
              );
            })()}

            <div className="bill-footer">
              <p>Cảm ơn quý khách đã sử dụng dịch vụ <b>Vi Vu Bike</b>!</p>
              <p className="bill-footer-sub">Hồ sơ và chi tiết thuê xe được lưu trữ trong hệ thống.</p>
            </div>
          </div>

          <div className="bill-actions">
            <button className="button light" onClick={() => window.print()} style={{ marginRight: '10px' }}>🖨 In hóa đơn</button>
            <button className="button" onClick={onClose}>Đóng</button>
          </div>
        </section>
      ) : (
        <section className="booking-modal" role="dialog" aria-modal="true">
          <button className="modal-close" onClick={onClose} aria-label="Đóng">
            ✕
          </button>
          <div className="modal-title">
            <div>
              <p>CHI TIẾT ĐƠN THUÊ</p>
              <h2>{booking.code}</h2>
              <small>Tạo lúc {createdAtText(booking.createdAt)}</small>
            </div>
            <span className={`tag ${statusClass(booking.status)}`}>
              {booking.status}
            </span>
          </div>

          <div className="modal-bike">
            {booking.vehicleImage ? (
              <img src={booking.vehicleImage} alt={booking.bike} />
            ) : (
              <span>⌁</span>
            )}
            <div>
              <small>XE ĐÃ ĐẶT</small>
              <h3>{booking.bike}</h3>
              <p>{booking.dailyPrice ? `${money(booking.dailyPrice)}/ngày` : "Giá thuê được Staff xác nhận"}</p>
            </div>
          </div>

          <div className="detail-grid">
            <article>
              <span>Thời gian thuê</span>
              <b>
                {dateText(booking.startDate)} — {dateText(booking.endDate)}
              </b>
              <small>{booking.rentalDays ? `${booking.rentalDays} ngày thuê` : "Đang chờ xác nhận"}</small>
            </article>
            <article>
              <span>Điểm nhận xe</span>
              <b>{booking.location || "Đang cập nhật"}</b>
              <small>Staff sẽ xác nhận thời gian nhận xe</small>
            </article>
            <article>
              <span>Khách thuê</span>
              <b>{booking.customerName || "Khách hàng"}</b>
              <small>{booking.customerPhone || booking.customerEmail || "Thông tin trong hồ sơ"}</small>
            </article>
            <article>
              <span>Tổng tiền dự kiến</span>
              <b>{booking.total}</b>
              <small>Chưa bao gồm phát sinh (nếu có)</small>
            </article>
          </div>

          <div className="detail-note">
            <b>Ghi chú cho Staff</b>
            <p>{booking.note || "Khách hàng chưa để lại ghi chú."}</p>
          </div>

          <div className="detail-included">
            <b>Phụ kiện đi kèm</b>
            <div>
              {(booking.amenities.length
                ? booking.amenities
                : ["02 mũ bảo hiểm", "01 áo mưa"]
              ).map((amenity) => (
                <span key={amenity}>✓ {amenity}</span>
              ))}
            </div>
          </div>

          <button className="button modal-button" onClick={onClose}>
            Đã hiểu
          </button>
        </section>
      )}
    </div>
  );
}

function Verification({
  verificationSent,
  onSubmit,
  fullName,
  verificationStatus,
  previews,
  onPreview,
}: {
  verificationSent: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  fullName: string;
  verificationStatus: string;
  previews: Record<DocumentKey, string>;
  onPreview: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const isPending = verificationSent || verificationStatus === "pending";
  return (
    <div className="page">
      <div className="section-title">
        <div>
          <h2>Xác minh tài khoản</h2>
          <p>Hồ sơ được Staff kiểm tra trước khi bạn nhận xe.</p>
        </div>
        <span className={`tag ${isPending ? "pending" : "done"}`}>
          {isPending
            ? "Đang chờ xác minh"
            : verificationLabel(verificationStatus)}
        </span>
      </div>
      <div className="verify-layout">
        <form className="verify-form" onSubmit={onSubmit}>
          <h2>Thông tin xác minh</h2>
          <p>
            Vui lòng dùng ảnh rõ nét, đủ bốn góc. Giấy tờ chỉ phục vụ cho việc
            xác minh thuê xe.
          </p>
          <div className="form-grid">
            <label className="field">
              Họ và tên
              <input
                name="fullName"
                defaultValue={fullName === "Khách hàng" ? "" : fullName}
                required
              />
            </label>
            <label className="field">
              Số CCCD/CMND
              <input
                name="identityNumber"
                required
                placeholder="Nhập số giấy tờ"
              />
            </label>
          </div>
          <div className="upload-grid">
            <label
              className={`upload ${previews.cccdFront ? "has-preview" : ""}`}
            >
              <input
                name="cccdFront"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required
                onChange={onPreview}
              />
              {previews.cccdFront ? (
                <>
                  <img
                    src={previews.cccdFront}
                    alt="Xem trước CCCD mặt trước"
                  />
                  <em>Đổi ảnh CCCD mặt trước</em>
                </>
              ) : (
                <>
                  <span>↑</span>
                  <b>CCCD/CMND mặt trước</b>
                  <small>JPG, PNG · tối đa 5MB</small>
                </>
              )}
            </label>
            <label
              className={`upload ${previews.cccdBack ? "has-preview" : ""}`}
            >
              <input
                name="cccdBack"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required
                onChange={onPreview}
              />
              {previews.cccdBack ? (
                <>
                  <img src={previews.cccdBack} alt="Xem trước CCCD mặt sau" />
                  <em>Đổi ảnh CCCD mặt sau</em>
                </>
              ) : (
                <>
                  <span>↑</span>
                  <b>CCCD/CMND mặt sau</b>
                  <small>JPG, PNG · tối đa 5MB</small>
                </>
              )}
            </label>
            <label
              className={`upload ${previews.driverLicense ? "has-preview" : ""}`}
            >
              <input
                name="driverLicense"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required
                onChange={onPreview}
              />
              {previews.driverLicense ? (
                <>
                  <img
                    src={previews.driverLicense}
                    alt="Xem trước bằng lái xe"
                  />
                  <em>Đổi ảnh bằng lái</em>
                </>
              ) : (
                <>
                  <span>↑</span>
                  <b>Bằng lái xe</b>
                  <small>JPG, PNG · tối đa 5MB</small>
                </>
              )}
            </label>
          </div>
          <button className="button" disabled={isPending}>
            {isPending ? "Hồ sơ đang chờ kiểm tra" : "Gửi hồ sơ xác minh"}
          </button>
        </form>
        <aside className="verify-side">
          <h3>Quy trình duyệt hồ sơ</h3>
          <div className="verify-step">
            <span>01</span>
            <div>
              <b>Gửi giấy tờ</b>
              <small>Điền thông tin và chọn đủ ba ảnh giấy tờ.</small>
            </div>
          </div>
          <div className="verify-step">
            <span>02</span>
            <div>
              <b>Staff kiểm tra</b>
              <small>Nhân viên đối chiếu thông tin và chất lượng ảnh.</small>
            </div>
          </div>
          <div className="verify-step">
            <span>03</span>
            <div>
              <b>Nhận kết quả</b>
              <small>Bạn có thể đặt xe khi hồ sơ được duyệt.</small>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Reviews() {
  return (
    <div className="page">
      <div className="section-title">
        <div>
          <h2>Đánh giá của tôi</h2>
          <p>Bạn có thể đánh giá sau khi hoàn thành một đơn thuê.</p>
        </div>
      </div>
      <section className="review-card">
        <h3>Chưa có đơn thuê đủ điều kiện đánh giá</h3>
        <p>
          Khi Staff hoàn tất đơn thuê, đơn đó sẽ xuất hiện tại đây để bạn gửi
          phản hồi.
        </p>
      </section>
    </div>
  );
}

function Profile({
  onSubmit,
  fullName,
  email,
  phone,
  address,
  saving,
  onPasswordSubmit,
  passwordSaving,
}: {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  saving: boolean;
  onPasswordSubmit: (event: FormEvent<HTMLFormElement>) => void;
  passwordSaving: boolean;
}) {
  const [draft, setDraft] = useState({ fullName, phone, address });
  const [showPasswords, setShowPasswords] = useState(false);
  useEffect(() => {
    setDraft({ fullName, phone, address });
  }, [fullName, phone, address]);

  return (
    <div className="page">
      <div className="section-title">
        <div>
          <h2>Hồ sơ cá nhân</h2>
          <p>Cập nhật thông tin liên hệ của bạn.</p>
        </div>
      </div>
      <form className="profile-form" onSubmit={onSubmit}>
        <h2>Thông tin cơ bản</h2>
        <div className="form-grid" style={{ alignItems: "start" }}>
          <label className="field">
            Họ và tên
            <input
              name="fullName"
              value={draft.fullName}
              onChange={(event) => setDraft((current) => ({ ...current, fullName: event.target.value }))}
              required
              disabled={saving}
              style={{ height: "43px" }}
            />
          </label>
          <label className="field">
            Số điện thoại
            <input
              name="phone"
              type="tel"
              value={draft.phone}
              onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))}
              required
              disabled={saving}
              placeholder="Nhập số điện thoại"
              style={{ height: "43px" }}
            />
          </label>
          <label className="field">
            Email
            <input 
              value={email} 
              type="email" 
              readOnly 
              name="email"
              style={{
                height: "43px",
                backgroundColor: '#f3f4f6',
                color: '#6b7280',
                borderColor: '#e5e7eb',
                cursor: 'not-allowed',
                outline: 'none'
              }}
            />
            <small style={{ color: '#6b7280', fontWeight: 500, fontSize: '11px', marginTop: '2px' }}>Email đăng ký tài khoản không thể thay đổi</small>
          </label>
          <label className="field">
            Địa chỉ
            <input
              name="address"
              value={draft.address}
              onChange={(event) => setDraft((current) => ({ ...current, address: event.target.value }))}
              disabled={saving}
              placeholder="Nhập địa chỉ của bạn"
              style={{ height: "43px" }}
            />
          </label>
        </div>
        <button className="button" type="submit" disabled={saving}>
          {saving ? "Đang lưu…" : "Lưu thay đổi"}
        </button>
      </form>
      <form className="profile-form" style={{ marginTop: 20 }} onSubmit={onPasswordSubmit}>
        <h2>Đổi mật khẩu</h2>
        <div className="form-grid" style={{ alignItems: "start" }}>
          <label className="field">
            Mật khẩu hiện tại
            <input
              name="currentPassword"
              type={showPasswords ? "text" : "password"}
              autoComplete="current-password"
              required
              disabled={passwordSaving}
              placeholder="Nhập mật khẩu hiện tại"
              style={{ height: "43px" }}
            />
          </label>
          <label className="field">
            Mật khẩu mới
            <input
              name="newPassword"
              type={showPasswords ? "text" : "password"}
              autoComplete="new-password"
              minLength={6}
              required
              disabled={passwordSaving}
              placeholder="Ít nhất 6 ký tự"
              style={{ height: "43px" }}
            />
          </label>
          <label className="field">
            Nhập lại mật khẩu mới
            <input
              name="confirmPassword"
              type={showPasswords ? "text" : "password"}
              autoComplete="new-password"
              minLength={6}
              required
              disabled={passwordSaving}
              placeholder="Nhập lại mật khẩu mới"
              style={{ height: "43px" }}
            />
          </label>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginBottom: 20, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={showPasswords}
            onChange={(event) => setShowPasswords(event.target.checked)}
            disabled={passwordSaving}
            style={{ width: 16, height: 16, accentColor: "#f26522" }}
          />
          Hiện mật khẩu
        </label>
        <button className="button" type="submit" disabled={passwordSaving}>
          {passwordSaving ? "Đang đổi mật khẩu…" : "Đổi mật khẩu"}
        </button>
      </form>
    </div>
  );
}
