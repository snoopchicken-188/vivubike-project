"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "../../lib/firebase";

type AdminUser = { fullName: string; email: string };
type View =
  | "overview"
  | "vehicles"
  | "pricing"
  | "locations"
  | "bookings"
  | "customers"
  | "staff"
  | "content"
  | "settings";
type Vehicle = {
  id: string;
  name: string;
  type: string;
  licensePlate: string;
  dailyPrice: number;
  description: string;
  specs: string;
  image: string;
  amenities: string[];
  status: string;
  isVisible: boolean;
  totalQuantity: number;
};
type LocationItem = {
  id: string;
  name: string;
  address: string;
  phone: string;
  isActive: boolean;
};
type PriceItem = {
  id: string;
  name: string;
  oneToFive: number;
  sixToTen: number;
  elevenToTwenty: number;
  overTwenty: number;
};
type CustomerItem = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  verificationStatus: string;
  staffProposal: string;
};

const menu: { id: View; label: string; icon: string; group?: string }[] = [
  { id: "overview", label: "Tổng quan", icon: "▦" },
  { id: "vehicles", label: "Quản lý xe", icon: "◈", group: "Vận hành" },
  { id: "pricing", label: "Bảng giá", icon: "₫" },
  { id: "locations", label: "Địa điểm nhận xe", icon: "⌖" },
  { id: "bookings", label: "Đơn thuê", icon: "▤", group: "Hệ thống" },
  { id: "customers", label: "Khách hàng", icon: "♙" },
  { id: "staff", label: "Nhân viên", icon: "♧" },
  { id: "content", label: "Nội dung trang chủ", icon: "✦", group: "Cấu hình" },
  { id: "settings", label: "Cài đặt", icon: "⚙" },
];

const titles: Record<
  View,
  { eyebrow: string; title: string; description: string }
> = {
  overview: {
    eyebrow: "QUẢN TRỊ HỆ THỐNG",
    title: "Tổng quan",
    description: "Theo dõi dữ liệu vận hành của Vi Vu Bike.",
  },
  vehicles: {
    eyebrow: "DANH MỤC",
    title: "Quản lý xe",
    description: "Tạo và cập nhật xe hiển thị trên trang chủ.",
  },
  pricing: {
    eyebrow: "DANH MỤC",
    title: "Bảng giá",
    description: "Thiết lập mức giá theo loại xe và thời gian thuê.",
  },
  locations: {
    eyebrow: "DANH MỤC",
    title: "Địa điểm nhận xe",
    description: "Quản lý các cơ sở cho khách chọn khi tìm xe.",
  },
  bookings: {
    eyebrow: "VẬN HÀNH",
    title: "Đơn thuê",
    description: "Theo dõi toàn bộ yêu cầu thuê xe trong hệ thống.",
  },
  customers: {
    eyebrow: "NGƯỜI DÙNG",
    title: "Khách hàng",
    description: "Xem hồ sơ và lịch sử thuê xe của khách hàng.",
  },
  staff: {
    eyebrow: "NGƯỜI DÙNG",
    title: "Nhân viên",
    description: "Tạo và quản lý tài khoản nhân viên vận hành.",
  },
  content: {
    eyebrow: "CẤU HÌNH",
    title: "Nội dung trang chủ",
    description: "Chỉnh sửa ảnh động, thông tin giới thiệu và liên hệ.",
  },
  settings: {
    eyebrow: "CẤU HÌNH",
    title: "Cài đặt",
    description: "Thiết lập chung cho hệ thống thuê xe.",
  },
};

function EmptyState({
  title,
  text,
  action,
  onAction,
}: {
  title: string;
  text: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <section className="panel empty-state">
      <span className="empty-icon">◌</span>
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
      {action && (
        <button className="button secondary" onClick={onAction}>
          {action}
        </button>
      )}
    </section>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [view, setView] = useState<View>("overview");
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/");
        return;
      }
      try {
        const profile = await getDoc(doc(db, "users", user.uid));
        const data = profile.data();
        if (!profile.exists() || data?.role !== "admin") {
          router.replace("/");
          return;
        }
        setAdmin({
          fullName: data.fullName || user.displayName || "Quản trị viên",
          email: user.email || "",
        });
      } catch {
        router.replace("/");
      } finally {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, [router]);

  useEffect(() => {
    return onSnapshot(collection(db, "vehicles"), (snapshot) => {
      setVehicles(
        snapshot.docs.map((item) => {
          const data = item.data();
          return {
            id: item.id,
            name: String(data.name || "Xe chưa đặt tên"),
            type: String(data.type || "Khác"),
            licensePlate: String(data.licensePlate || "—"),
            dailyPrice: Number(data.dailyPrice || 0),
            description: String(data.description || ""),
            specs: String(data.specs || ""),
            image: String(data.image || ""),
            amenities: Array.isArray(data.amenities)
              ? data.amenities.map(String)
              : [],
            status: String(data.status || "available"),
            isVisible: Boolean(data.isVisible),
            totalQuantity: Math.max(1, Number(data.totalQuantity || 1)),
          };
        }),
      );
    });
  }, []);

  const initials = useMemo(
    () =>
      admin?.fullName
        .split(" ")
        .filter(Boolean)
        .slice(-2)
        .map((part) => part[0])
        .join("")
        .toUpperCase() || "AD",
    [admin],
  );
  const notify = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3200);
  };
  const changeView = (next: View) => {
    setView(next);
    setMenuOpen(false);
  };
  const logOut = async () => {
    await signOut(auth);
    router.replace("/");
  };

  if (loading)
    return <main className="loading-page">Đang kiểm tra quyền truy cập…</main>;
  if (!admin) return null;

  return (
    <main className="admin-shell">
      {notice && <div className="toast">✓ {notice}</div>}
      <aside className={menuOpen ? "sidebar open" : "sidebar"}>
        <a className="brand" href="/">
          <span className="brand-mark">V</span>
          <span>
            VI VU <b>BIKE</b>
          </span>
        </a>
        <div className="admin-profile">
          <span className="avatar">{initials}</span>
          <div>
            <b>{admin.fullName}</b>
            <small>Administrator</small>
          </div>
        </div>
        <a className="home-link" href="/">
          ⌂ <span>Trang chủ</span>
        </a>
        <nav>
          {menu.map((item, index) => (
            <div key={item.id}>
              {item.group && (
                <p className={index === 1 ? "menu-group first" : "menu-group"}>
                  {item.group}
                </p>
              )}
              <button
                className={view === item.id ? "menu-item active" : "menu-item"}
                onClick={() => changeView(item.id)}
              >
                <span>{item.icon}</span>
                {item.label}
              </button>
            </div>
          ))}
        </nav>
        <button className="signout" onClick={logOut}>
          ↪ <span>Đăng xuất</span>
        </button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <button
            className="mobile-menu"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Mở menu"
          >
            ☰
          </button>
          <div>
            <p className="eyebrow">{titles[view].eyebrow}</p>
            <h1>{titles[view].title}</h1>
          </div>
          <div className="top-profile">
            <span className="role-tag">ADMIN</span>
            <span className="avatar small">{initials}</span>
            <b>{admin.fullName}</b>
          </div>
        </header>
        <div className="page-body">
          {view === "overview" && (
            <Overview
              onChangeView={changeView}
              vehicleCount={vehicles.length}
            />
          )}
          {view === "vehicles" && (
            <Vehicles notify={notify} vehicles={vehicles} />
          )}
          {view === "pricing" && <Pricing notify={notify} />}
          {view === "locations" && <Locations notify={notify} />}
          {view === "bookings" && <Bookings />}
          {view === "customers" && <Customers />}
          {view === "staff" && <Staff notify={notify} />}
          {view === "content" && <Content notify={notify} />}
          {view === "settings" && <Settings notify={notify} />}
        </div>
      </section>

      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap");
        * {
          box-sizing: border-box;
        }
        body {
          margin: 0;
          background: #f4f6f8;
          color: #17202a;
          font-family: "Be Vietnam Pro", Arial, sans-serif;
          font-size: 15px;
        }
        button,
        input,
        textarea,
        select {
          font: inherit;
        }
        button {
          cursor: pointer;
        }
        .admin-shell {
          min-height: 100vh;
          display: flex;
        }
        .sidebar {
          width: 288px;
          min-height: 100vh;
          position: fixed;
          inset: 0 auto 0 0;
          padding: 28px 20px;
          background: #15181b;
          color: #fff;
          display: flex;
          flex-direction: column;
          z-index: 10;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #fff;
          text-decoration: none;
          font-size: 17px;
          font-weight: 800;
          letter-spacing: 0.06em;
          padding: 0 10px;
        }
        .brand b {
          color: #ff6b25;
        }
        .brand-mark {
          display: grid;
          place-items: center;
          width: 34px;
          height: 34px;
          color: #fff;
          background: #ff6823;
          clip-path: polygon(50% 0, 100% 18%, 82% 100%, 18% 100%, 0 18%);
        }
        .admin-profile {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 37px 10px 24px;
          padding-bottom: 22px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.13);
        }
        .avatar {
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: #ff6823;
          color: #fff;
          font-size: 13px;
          font-weight: 800;
        }
        .admin-profile b,
        .admin-profile small {
          display: block;
        }
        .admin-profile b {
          font-size: 14px;
        }
        .admin-profile small {
          margin-top: 4px;
          color: #aeb6be;
          font-size: 12px;
        }
        .home-link,
        .menu-item,
        .signout {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 14px;
          border: 0;
          color: #c5cbd1;
          background: transparent;
          text-decoration: none;
          text-align: left;
          font-size: 14px;
          font-weight: 700;
          padding: 13px 14px;
          border-radius: 8px;
        }
        .home-link {
          margin-bottom: 19px;
        }
        .home-link:hover,
        .menu-item:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.06);
        }
        .menu-group {
          margin: 24px 14px 8px;
          color: #767e87;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.09em;
          text-transform: uppercase;
        }
        .menu-group.first {
          margin-top: 0;
        }
        .menu-item span,
        .home-link {
          font-size: 16px;
        }
        .menu-item.active {
          color: #fff;
          background: #f86522;
          box-shadow: 0 8px 20px rgba(248, 101, 34, 0.25);
        }
        .signout {
          margin-top: auto;
          border-top: 1px solid rgba(255, 255, 255, 0.13);
          border-radius: 0;
          padding-top: 20px;
        }
        .signout:hover {
          color: #fff;
        }
        .workspace {
          width: calc(100% - 288px);
          margin-left: 288px;
        }
        .topbar {
          height: 112px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 48px;
          background: #fff;
          border-bottom: 1px solid #e9ecef;
        }
        .eyebrow {
          margin: 0 0 8px;
          color: #f86522;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.15em;
        }
        .topbar h1 {
          margin: 0;
          font-size: 31px;
          letter-spacing: -0.04em;
        }
        .top-profile {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 14px;
        }
        .avatar.small {
          width: 36px;
          height: 36px;
          font-size: 11px;
        }
        .role-tag {
          padding: 6px 9px;
          border-radius: 6px;
          background: #fff0e8;
          color: #dd5215;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.08em;
        }
        .mobile-menu {
          display: none;
          border: 0;
          background: transparent;
          font-size: 22px;
        }
        .page-body {
          max-width: 1380px;
          padding: 38px 48px 54px;
        }
        .page-lead {
          margin: 0 0 28px;
          color: #66707b;
          font-size: 15px;
          line-height: 1.6;
        }
        .metric-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }
        .metric {
          min-height: 154px;
          padding: 23px;
          background: #fff;
          border: 1px solid #e6e9ed;
          border-radius: 13px;
        }
        .metric > span {
          display: grid;
          place-items: center;
          width: 34px;
          height: 34px;
          border-radius: 9px;
          background: #fff2eb;
          color: #f86522;
          font-weight: 800;
        }
        .metric p {
          margin: 17px 0 7px;
          color: #66707b;
          font-size: 13px;
        }
        .metric b {
          font-size: 30px;
          letter-spacing: -0.05em;
        }
        .metric small {
          display: block;
          margin-top: 7px;
          color: #84909b;
          font-size: 11px;
        }
        .section-grid {
          display: grid;
          grid-template-columns: 1.4fr 0.9fr;
          gap: 18px;
          margin-top: 22px;
        }
        .panel {
          background: #fff;
          border: 1px solid #e6e9ed;
          border-radius: 13px;
        }
        .panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 21px 25px;
          border-bottom: 1px solid #edf0f2;
        }
        .panel-header h2 {
          margin: 0;
          font-size: 18px;
          letter-spacing: -0.02em;
        }
        .panel-header button,
        .link-button {
          border: 0;
          background: transparent;
          color: #f86522;
          font-weight: 800;
          font-size: 13px;
        }
        .empty-state {
          min-height: 150px;
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 25px;
        }
        .empty-icon {
          display: grid;
          place-items: center;
          width: 43px;
          height: 43px;
          border-radius: 50%;
          background: #f3f5f7;
          color: #f86522;
          font-size: 23px;
        }
        .empty-state h3 {
          margin: 0 0 7px;
          font-size: 15px;
        }
        .empty-state p {
          margin: 0;
          color: #6e7882;
          font-size: 13px;
          line-height: 1.55;
        }
        .empty-state .button {
          margin-left: auto;
        }
        .admin-review {
          padding: 24px;
        }
        .admin-review .review-label {
          color: #7a858e;
          font-size: 12px;
        }
        .admin-review h3 {
          margin: 7px 0 8px;
          font-size: 20px;
          letter-spacing: -0.025em;
        }
        .admin-review p {
          margin: 0;
          color: #68727d;
          font-size: 13px;
          line-height: 1.6;
        }
        .review-actions {
          display: flex;
          gap: 9px;
          margin-top: 20px;
        }
        .button {
          border: 0;
          border-radius: 8px;
          padding: 11px 14px;
          background: #f86522;
          color: #fff;
          font-size: 13px;
          font-weight: 800;
        }
        .button:hover {
          background: #dd5012;
        }
        .button.secondary {
          border: 1px solid #dfe3e7;
          background: #fff;
          color: #26313b;
        }
        .button.secondary:hover {
          background: #f7f8f9;
        }
        .view-head {
          display: flex;
          align-items: start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 25px;
        }
        .view-head h2 {
          margin: 0;
          font-size: 28px;
          letter-spacing: -0.04em;
        }
        .view-head p {
          margin: 8px 0 0;
          color: #66707b;
        }
        .toolbar {
          display: flex;
          gap: 10px;
        }
        .toolbar input {
          min-width: 260px;
          border: 1px solid #dde2e7;
          border-radius: 8px;
          padding: 10px 12px;
          outline-color: #f86522;
        }
        .filter-select {
          border: 1px solid #dde2e7;
          border-radius: 8px;
          background: #fff;
          padding: 10px;
        }
        .table-wrap {
          overflow-x: auto;
        }
        .data-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 720px;
        }
        .data-table th,
        .data-table td {
          padding: 15px 18px;
          border-bottom: 1px solid #edf0f2;
          text-align: left;
          font-size: 13px;
        }
        .data-table th {
          color: #7a858e;
          font-size: 11px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .data-table td {
          color: #4e5a65;
        }
        .data-table tr:last-child td {
          border-bottom: 0;
        }
        .status {
          display: inline-block;
          border-radius: 999px;
          padding: 6px 9px;
          background: #eef2f5;
          color: #64707b;
          font-size: 11px;
          font-weight: 800;
        }
        .status.empty {
          background: #fff3df;
          color: #9b6500;
        }
        .form-card {
          max-width: 720px;
          padding: 26px;
        }
        .form-card h3 {
          margin: 0 0 20px;
          font-size: 19px;
        }
        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .field {
          display: grid;
          gap: 7px;
          margin-bottom: 16px;
          color: #57636e;
          font-size: 12px;
          font-weight: 700;
        }
        .field.full {
          grid-column: 1/-1;
        }
        .field input,
        .field textarea,
        .field select {
          width: 100%;
          border: 1px solid #dde2e7;
          border-radius: 8px;
          background: #fff;
          padding: 11px 12px;
          outline-color: #f86522;
          color: #17202a;
        }
        .field textarea {
          min-height: 104px;
          resize: vertical;
        }
        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 4px;
        }
        .info-list {
          margin: 0;
          padding: 0;
          list-style: none;
        }
        .info-list li {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          padding: 15px 0;
          border-bottom: 1px solid #edf0f2;
          color: #6d7780;
          font-size: 13px;
        }
        .info-list li:last-child {
          border-bottom: 0;
        }
        .info-list b {
          color: #25313b;
        }
        .toast {
          position: fixed;
          top: 20px;
          left: 50%;
          z-index: 50;
          transform: translateX(-50%);
          padding: 13px 18px;
          background: #17202a;
          color: #fff;
          border-radius: 9px;
          box-shadow: 0 12px 28px rgba(0, 0, 0, 0.18);
          font-size: 13px;
        }
        .loading-page {
          min-height: 100vh;
          display: grid;
          place-items: center;
          background: #f4f6f8;
          color: #68727d;
          font-family: "Be Vietnam Pro", Arial, sans-serif;
        }
        .mobile-only {
          display: none;
        }
        @media (max-width: 980px) {
          .sidebar {
            width: 246px;
          }
          .workspace {
            width: calc(100% - 246px);
            margin-left: 246px;
          }
          .topbar,
          .page-body {
            padding-left: 28px;
            padding-right: 28px;
          }
          .metric-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .section-grid {
            grid-template-columns: 1fr;
          }
          .top-profile b {
            display: none;
          }
        }
        @media (max-width: 720px) {
          .sidebar {
            width: 270px;
            transform: translateX(-100%);
            transition: transform 0.2s ease;
          }
          .sidebar.open {
            transform: translateX(0);
            box-shadow: 20px 0 45px rgba(0, 0, 0, 0.23);
          }
          .workspace {
            width: 100%;
            margin: 0;
          }
          .topbar {
            height: 84px;
            padding: 0 20px;
          }
          .mobile-menu {
            display: block;
          }
          .topbar h1 {
            font-size: 25px;
          }
          .top-profile {
            gap: 7px;
          }
          .role-tag {
            display: none;
          }
          .page-body {
            padding: 26px 18px 40px;
          }
          .metric-grid {
            grid-template-columns: 1fr 1fr;
            gap: 11px;
          }
          .metric {
            min-height: 135px;
            padding: 17px;
          }
          .metric p {
            font-size: 12px;
            margin-top: 13px;
          }
          .metric b {
            font-size: 26px;
          }
          .section-grid {
            gap: 13px;
            margin-top: 13px;
          }
          .view-head {
            display: block;
          }
          .view-head .button {
            margin-top: 16px;
          }
          .toolbar {
            margin-top: 14px;
          }
          .toolbar input {
            min-width: 0;
            width: 100%;
          }
          .form-grid {
            grid-template-columns: 1fr;
          }
          .panel-header,
          .empty-state,
          .form-card {
            padding: 19px;
          }
          .empty-state {
            align-items: flex-start;
            flex-wrap: wrap;
          }
          .empty-state .button {
            margin: 0 0 0 58px;
          }
          .mobile-only {
            display: block;
          }
        }
      `}</style>
      <style jsx global>{`
        .table-select {
          border: 1px solid #dde2e7;
          border-radius: 7px;
          background: #fff;
          padding: 7px;
          color: #33404b;
          font-size: 12px;
        }
        .danger-button {
          border: 0;
          background: transparent;
          color: #c73a22;
          font-size: 12px;
          font-weight: 800;
        }
        .danger-button:hover {
          text-decoration: underline;
        }
        .sidebar nav {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding-bottom: 10px;
        }
        .sidebar .signout {
          flex: 0 0 auto;
          background: #15181b;
          position: sticky;
          bottom: 0;
          z-index: 2;
        }
      `}</style>
    </main>
  );
}

function Overview({
  onChangeView,
  vehicleCount,
}: {
  onChangeView: (view: View) => void;
  vehicleCount: number;
}) {
  return (
    <>
      <p className="page-lead">
        Các số liệu sẽ tự cập nhật khi Admin thêm xe và khi Customer phát sinh
        đơn thuê thực tế.
      </p>
      <section className="metric-grid">
        <article className="metric">
          <span>◈</span>
          <p>Xe đang hoạt động</p>
          <b>{vehicleCount}</b>
          <small>
            {vehicleCount ? "Xe đã được khai báo" : "Chưa có xe được khai báo"}
          </small>
        </article>
        <article className="metric">
          <span>▣</span>
          <p>Xe đang được thuê</p>
          <b>0</b>
          <small>Chưa có đơn thuê đang diễn ra</small>
        </article>
        <article className="metric">
          <span>▤</span>
          <p>Đơn thuê mới hôm nay</p>
          <b>0</b>
          <small>Chưa có đơn thuê mới</small>
        </article>
        <article className="metric">
          <span>₫</span>
          <p>Doanh thu tháng này</p>
          <b>0đ</b>
          <small>Chưa phát sinh đơn hoàn thành</small>
        </article>
      </section>
      <section className="section-grid">
        <div className="panel">
          <div className="panel-header">
            <h2>Đơn thuê mới nhất</h2>
            <button onClick={() => onChangeView("bookings")}>
              Xem đơn thuê →
            </button>
          </div>
          <EmptyState
            title="Chưa có đơn thuê nào"
            text="Đơn thuê sẽ xuất hiện ở đây khi khách đã gửi yêu cầu thuê xe."
          />
        </div>
        <div className="panel admin-review">
          <span className="review-label">KIỂM DUYỆT CUỐI</span>
          <h3>Hồ sơ Staff đã đề xuất: 0</h3>
          <p>
            Staff là người kiểm tra giấy tờ chính. Admin chỉ xem lại hồ sơ Staff
            đã đề xuất duyệt hoặc từ chối.
          </p>
          <div className="review-actions">
            <button
              className="button secondary"
              onClick={() => onChangeView("customers")}
            >
              Xem hồ sơ
            </button>
          </div>
        </div>
      </section>
      <section className="section-grid">
        <div className="panel">
          <div className="panel-header">
            <h2>Tình trạng đội xe</h2>
            <button onClick={() => onChangeView("vehicles")}>
              Quản lý xe →
            </button>
          </div>
          <EmptyState
            title="Chưa có dữ liệu xe"
            text="Hãy thêm xe đầu tiên để hệ thống có thể theo dõi tình trạng hoạt động."
            action="Thêm xe"
          />
        </div>
        <div className="panel">
          <div className="panel-header">
            <h2>Địa điểm nhận xe</h2>
            <button onClick={() => onChangeView("locations")}>Quản lý →</button>
          </div>
          <EmptyState
            title="Chưa có địa điểm"
            text="Thêm cơ sở để khách có thể lựa chọn nơi nhận xe."
          />
        </div>
      </section>
    </>
  );
}

function Vehicles({
  notify,
  vehicles,
}: {
  notify: (message: string) => void;
  vehicles: Vehicle[];
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [rentedByVehicle, setRentedByVehicle] = useState<
    Record<string, number>
  >({});
  useEffect(
    () =>
      onSnapshot(collection(db, "bookings"), (snapshot) => {
        const counts: Record<string, number> = {};
        snapshot.docs.forEach((item) => {
          const data = item.data();
          if (
            ["Đã xác nhận", "Đang thuê"].includes(String(data.status || ""))
          ) {
            const vehicleId = String(data.vehicleId || "");
            if (vehicleId) counts[vehicleId] = (counts[vehicleId] || 0) + 1;
          }
        });
        setRentedByVehicle(counts);
      }),
    [],
  );
  const toggleVisible = async (vehicle: Vehicle) => {
    try {
      await updateDoc(doc(db, "vehicles", vehicle.id), {
        isVisible: !vehicle.isVisible,
      });
      notify(
        vehicle.isVisible
          ? "Đã ẩn xe khỏi trang chủ."
          : "Đã cho xe hiển thị ở trang chủ.",
      );
    } catch {
      notify("Không thể cập nhật trạng thái xe.");
    }
  };
  const changeStatus = async (vehicle: Vehicle, status: string) => {
    try {
      await updateDoc(doc(db, "vehicles", vehicle.id), { status });
      notify("Đã cập nhật trạng thái xe.");
    } catch {
      notify("Không thể cập nhật trạng thái xe.");
    }
  };
  const remove = async (vehicle: Vehicle) => {
    if (!window.confirm(`Xóa xe ${vehicle.name}?`)) return;
    try {
      await deleteDoc(doc(db, "vehicles", vehicle.id));
      notify("Đã xóa xe.");
    } catch {
      notify("Không thể xóa xe.");
    }
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    try {
      const values = {
        name: String(form.get("name") || "").trim(),
        type: String(form.get("type") || ""),
        licensePlate: String(form.get("licensePlate") || "").trim(),
        dailyPrice: Number(form.get("dailyPrice") || 0),
        totalQuantity: Math.max(1, Number(form.get("totalQuantity") || 1)),
        specs: String(form.get("specs") || "").trim(),
        image: String(form.get("image") || "").trim(),
        description: String(form.get("description") || "").trim(),
        amenities: String(form.get("amenities") || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        status: editing?.status || "available",
        isVisible: editing?.isVisible ?? true,
      };
      if (editing) await updateDoc(doc(db, "vehicles", editing.id), values);
      else
        await addDoc(collection(db, "vehicles"), {
          ...values,
          createdAt: serverTimestamp(),
        });
      setFormOpen(false);
      setEditing(null);
      notify(
        editing
          ? "Đã cập nhật thông tin xe."
          : "Đã thêm xe. Trang chủ sẽ tự cập nhật danh sách xe.",
      );
    } catch {
      notify(
        "Không thể lưu xe. Hãy kiểm tra lại Firestore Rules và quyền Admin.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <div className="view-head">
        <div>
          <h2>Danh sách xe</h2>
          <p>Xe được thêm tại đây sẽ là nguồn dữ liệu cho trang chủ.</p>
        </div>
        <button
          className="button"
          onClick={() => {
            setEditing(null);
            setFormOpen(!formOpen);
          }}
        >
          {formOpen ? "Đóng biểu mẫu" : "+ Thêm xe"}
        </button>
      </div>
      {formOpen && (
        <form className="panel form-card" onSubmit={submit}>
          <h3>{editing ? "Chỉnh sửa xe" : "Thông tin xe mới"}</h3>
          <div className="form-grid">
            <label className="field">
              <span>Tên xe</span>
              <input
                name="name"
                required
                defaultValue={editing?.name || ""}
                placeholder="Ví dụ: Honda Vision 110cc"
              />
            </label>
            <label className="field">
              <span>Loại xe</span>
              <select name="type" required defaultValue={editing?.type || ""}>
                <option value="" disabled>
                  Chọn loại xe
                </option>
                <option>Tay ga</option>
                <option>Xe số</option>
                <option>Côn tay</option>
              </select>
            </label>
            <label className="field">
              <span>Biển số xe</span>
              <input
                name="licensePlate"
                required
                defaultValue={editing?.licensePlate || ""}
                placeholder="29A1-123.45"
              />
            </label>
            <label className="field">
              <span>Giá thuê/ngày</span>
              <input
                name="dailyPrice"
                required
                type="number"
                min="0"
                defaultValue={editing?.dailyPrice || ""}
                placeholder="180000"
              />
            </label>
            <label className="field">
              <span>Tổng số xe cùng mẫu</span>
              <input
                name="totalQuantity"
                required
                type="number"
                min="1"
                defaultValue={editing?.totalQuantity || 1}
                placeholder="Ví dụ: 5"
              />
            </label>
            <label className="field">
              <span>Thông số xe</span>
              <input
                name="specs"
                required
                defaultValue={editing?.specs || ""}
                placeholder="110cc · Tự động"
              />
            </label>
            <label className="field">
              <span>Ảnh xe (đường dẫn ảnh)</span>
              <input
                name="image"
                required
                type="url"
                defaultValue={editing?.image || ""}
                placeholder="https://..."
              />
            </label>
            <label className="field full">
              <span>Tiện ích (ngăn cách bằng dấu phẩy)</span>
              <input
                name="amenities"
                defaultValue={
                  editing?.amenities.join(", ") || "02 mũ bảo hiểm, 01 áo mưa"
                }
              />
            </label>
            <label className="field full">
              <span>Mô tả ngắn</span>
              <textarea
                name="description"
                required
                defaultValue={editing?.description || ""}
                placeholder="Mô tả tình trạng và điểm phù hợp của xe."
              />
            </label>
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setFormOpen(false);
                setEditing(null);
              }}
            >
              Hủy
            </button>
            <button className="button" disabled={saving}>
              {saving ? "Đang lưu…" : editing ? "Lưu thay đổi" : "Lưu xe"}
            </button>
          </div>
        </form>
      )}
      {!formOpen &&
        (vehicles.length ? (
          <section className="panel table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tên xe</th>
                  <th>Loại xe</th>
                  <th>Tổng</th>
                  <th>Đang thuê</th>
                  <th>Còn trống</th>
                  <th>Giá/ngày</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((vehicle) => {
                  const rented = rentedByVehicle[vehicle.id] || 0;
                  const available = Math.max(0, vehicle.totalQuantity - rented);
                  return (
                    <tr key={vehicle.id}>
                      <td>
                        <b>{vehicle.name}</b>
                        <br />
                        <small>{vehicle.licensePlate}</small>
                      </td>
                      <td>{vehicle.type}</td>
                      <td>{vehicle.totalQuantity} chiếc</td>
                      <td>{rented} chiếc</td>
                      <td>
                        <b>{available} chiếc</b>
                      </td>
                      <td>
                        {new Intl.NumberFormat("vi-VN").format(
                          vehicle.dailyPrice,
                        )}
                        đ
                      </td>
                      <td>
                        <button
                          className="link-button"
                          onClick={() => {
                            setEditing(vehicle);
                            setFormOpen(true);
                          }}
                        >
                          Sửa
                        </button>{" "}
                        <button
                          className="danger-button"
                          onClick={() => remove(vehicle)}
                        >
                          Xóa
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        ) : (
          <EmptyState
            title="Chưa có xe để hiển thị"
            text="Thêm xe đầu tiên, sau đó xe sẽ hiện tại đây và ở trang chủ."
            action="+ Thêm xe"
            onAction={() => setFormOpen(true)}
          />
        ))}
    </>
  );
}

function Pricing({ notify }: { notify: (message: string) => void }) {
  const [items, setItems] = useState<PriceItem[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(
    () =>
      onSnapshot(collection(db, "pricing"), (snapshot) =>
        setItems(
          snapshot.docs.map((item) => ({
            id: item.id,
            name: String(item.data().name || ""),
            oneToFive: Number(item.data().oneToFive || 0),
            sixToTen: Number(item.data().sixToTen || 0),
            elevenToTwenty: Number(item.data().elevenToTwenty || 0),
            overTwenty: Number(item.data().overTwenty || 0),
          })),
        ),
      ),
    [],
  );
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await addDoc(collection(db, "pricing"), {
        name: String(form.get("name")),
        oneToFive: Number(form.get("oneToFive")),
        sixToTen: Number(form.get("sixToTen")),
        elevenToTwenty: Number(form.get("elevenToTwenty")),
        overTwenty: Number(form.get("overTwenty")),
        createdAt: serverTimestamp(),
      });
      setOpen(false);
      notify("Đã thêm mức giá.");
    } catch {
      notify("Không thể lưu bảng giá.");
    }
  };
  const remove = async (id: string) => {
    if (!window.confirm("Xóa mức giá này?")) return;
    await deleteDoc(doc(db, "pricing", id));
    notify("Đã xóa mức giá.");
  };
  return (
    <>
      <div className="view-head">
        <div>
          <h2>Thiết lập bảng giá</h2>
          <p>Giá được dùng để hiển thị tham khảo trên trang chủ.</p>
        </div>
        <button className="button" onClick={() => setOpen(!open)}>
          {open ? "Đóng biểu mẫu" : "+ Thêm mức giá"}
        </button>
      </div>
      {open && (
        <form className="panel form-card" onSubmit={save}>
          <h3>Mức giá theo thời gian thuê</h3>
          <div className="form-grid">
            <label className="field full">
              <span>Tên loại xe</span>
              <input name="name" required placeholder="Ví dụ: Tay ga 110cc" />
            </label>
            <label className="field">
              <span>1–5 ngày</span>
              <input name="oneToFive" type="number" required min="0" />
            </label>
            <label className="field">
              <span>6–10 ngày</span>
              <input name="sixToTen" type="number" required min="0" />
            </label>
            <label className="field">
              <span>11–20 ngày</span>
              <input name="elevenToTwenty" type="number" required min="0" />
            </label>
            <label className="field">
              <span>Từ 21 ngày</span>
              <input name="overTwenty" type="number" required min="0" />
            </label>
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() => setOpen(false)}
            >
              Hủy
            </button>
            <button className="button">Lưu mức giá</button>
          </div>
        </form>
      )}
      {!open &&
        (items.length ? (
          <section className="panel table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Loại xe</th>
                  <th>1–5 ngày</th>
                  <th>6–10 ngày</th>
                  <th>11–20 ngày</th>
                  <th>Từ 21 ngày</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <b>{item.name}</b>
                    </td>
                    <td>{item.oneToFive.toLocaleString("vi-VN")}đ</td>
                    <td>{item.sixToTen.toLocaleString("vi-VN")}đ</td>
                    <td>{item.elevenToTwenty.toLocaleString("vi-VN")}đ</td>
                    <td>{item.overTwenty.toLocaleString("vi-VN")}đ</td>
                    <td>
                      <button
                        className="danger-button"
                        onClick={() => remove(item.id)}
                      >
                        Xóa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : (
          <EmptyState
            title="Chưa có bảng giá"
            text="Tạo mức giá theo loại xe và số ngày thuê để hiển thị cho khách hàng."
            action="+ Thêm mức giá"
            onAction={() => setOpen(true)}
          />
        ))}
    </>
  );
}
function Locations({ notify }: { notify: (message: string) => void }) {
  const [items, setItems] = useState<LocationItem[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(
    () =>
      onSnapshot(collection(db, "locations"), (snapshot) =>
        setItems(
          snapshot.docs.map((item) => ({
            id: item.id,
            name: String(item.data().name || ""),
            address: String(item.data().address || ""),
            phone: String(item.data().phone || ""),
            isActive: Boolean(item.data().isActive),
          })),
        ),
      ),
    [],
  );
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await addDoc(collection(db, "locations"), {
        name: String(form.get("name")),
        address: String(form.get("address")),
        phone: String(form.get("phone")),
        isActive: true,
        createdAt: serverTimestamp(),
      });
      setOpen(false);
      notify("Đã thêm địa điểm nhận xe.");
    } catch {
      notify("Không thể lưu địa điểm.");
    }
  };
  const toggle = async (item: LocationItem) => {
    await updateDoc(doc(db, "locations", item.id), {
      isActive: !item.isActive,
    });
    notify("Đã cập nhật trạng thái địa điểm.");
  };
  const remove = async (id: string) => {
    if (!window.confirm("Xóa địa điểm này?")) return;
    await deleteDoc(doc(db, "locations", id));
    notify("Đã xóa địa điểm.");
  };
  return (
    <>
      <div className="view-head">
        <div>
          <h2>Các cơ sở nhận xe</h2>
          <p>Khách hàng sẽ chọn một trong các địa điểm đang hoạt động.</p>
        </div>
        <button className="button" onClick={() => setOpen(!open)}>
          {open ? "Đóng biểu mẫu" : "+ Thêm địa điểm"}
        </button>
      </div>
      {open && (
        <form className="panel form-card" onSubmit={save}>
          <h3>Địa điểm mới</h3>
          <label className="field">
            <span>Tên cơ sở</span>
            <input name="name" required placeholder="Ví dụ: Cơ sở Ba Đình" />
          </label>
          <label className="field">
            <span>Địa chỉ</span>
            <input name="address" required placeholder="Ba Đình, Hà Nội" />
          </label>
          <label className="field">
            <span>Số điện thoại</span>
            <input name="phone" required placeholder="0900 123 456" />
          </label>
          <div className="form-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() => setOpen(false)}
            >
              Hủy
            </button>
            <button className="button">Lưu địa điểm</button>
          </div>
        </form>
      )}
      {!open &&
        (items.length ? (
          <section className="panel table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tên cơ sở</th>
                  <th>Địa chỉ</th>
                  <th>Điện thoại</th>
                  <th>Trạng thái</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <b>{item.name}</b>
                    </td>
                    <td>{item.address}</td>
                    <td>{item.phone}</td>
                    <td>
                      <button
                        className="link-button"
                        onClick={() => toggle(item)}
                      >
                        {item.isActive ? "Đang hoạt động" : "Tạm ngừng"}
                      </button>
                    </td>
                    <td>
                      <button
                        className="danger-button"
                        onClick={() => remove(item.id)}
                      >
                        Xóa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : (
          <EmptyState
            title="Chưa có địa điểm nhận xe"
            text="Thêm ít nhất một cơ sở trước khi bật chức năng tìm xe cho khách."
            action="+ Thêm địa điểm"
            onAction={() => setOpen(true)}
          />
        ))}
    </>
  );
}
function Bookings() {
  return (
    <>
      <div className="view-head">
        <div>
          <h2>Toàn bộ đơn thuê</h2>
          <p>Mỗi đơn là một yêu cầu thuê xe do khách hàng gửi.</p>
        </div>
        <div className="toolbar">
          <input placeholder="Tìm mã đơn hoặc tên khách" />
          <select className="filter-select">
            <option>Tất cả trạng thái</option>
            <option>Chờ xác nhận</option>
            <option>Đã xác nhận</option>
            <option>Đang thuê</option>
            <option>Đã hoàn thành</option>
            <option>Đã hủy</option>
          </select>
        </div>
      </div>
      <section className="panel table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Mã đơn</th>
              <th>Khách hàng</th>
              <th>Xe</th>
              <th>Thời gian thuê</th>
              <th>Staff phụ trách</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={6}>
                <div className="empty-state">
                  <span className="empty-icon">▤</span>
                  <div>
                    <h3>Chưa có đơn thuê nào</h3>
                    <p>
                      Khi Customer gửi yêu cầu thuê xe, đơn sẽ xuất hiện trong
                      danh sách này.
                    </p>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </>
  );
}
function Customers() {
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [keyword, setKeyword] = useState("");
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    return onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        setLoadError("");
        const items = snapshot.docs.map((item) => {
          const data = item.data();
          return {
            id: item.id,
            role: String(data.role || "customer").toLowerCase(),
            fullName: String(data.fullName || "Chưa cập nhật tên"),
            email: String(data.email || ""),
            phone: String(data.phone || "Chưa cập nhật"),
            verificationStatus: String(
              data.verificationStatus || "not_submitted",
            ),
            staffProposal: String(data.staffProposal || "Chưa có"),
          };
        });
        setCustomers(items.filter((item) => item.role === "customer"));
      },
      () =>
        setLoadError(
          "Admin chưa có quyền đọc danh sách users trong Firestore.",
        ),
    );
  }, []);
  const label = (value: string) =>
    ({
      not_submitted: "Chưa gửi hồ sơ",
      pending: "Chờ Staff kiểm tra",
      staff_approved: "Chờ Admin duyệt",
      approved: "Đã xác minh",
      rejected: "Bị từ chối",
    })[value] || value;
  const visible = customers.filter((item) =>
    `${item.fullName} ${item.email}`
      .toLowerCase()
      .includes(keyword.toLowerCase()),
  );
  return (
    <>
      <div className="view-head">
        <div>
          <h2>Danh sách khách hàng</h2>
          <p>Thông tin được tạo khi khách đăng ký tài khoản.</p>
        </div>
        <div className="toolbar">
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Tìm tên hoặc email"
          />
        </div>
      </div>
      {loadError && (
        <section className="panel empty-state">
          <span className="empty-icon">!</span>
          <div>
            <h3>Không thể tải khách hàng</h3>
            <p>{loadError}</p>
          </div>
        </section>
      )}
      <section className="panel table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Khách hàng</th>
              <th>Email</th>
              <th>Số điện thoại</th>
              <th>Trạng thái hồ sơ</th>
              <th>Đề xuất Staff</th>
            </tr>
          </thead>
          <tbody>
            {visible.length ? (
              visible.map((item) => (
                <tr key={item.id}>
                  <td>
                    <b>{item.fullName}</b>
                  </td>
                  <td>{item.email}</td>
                  <td>{item.phone}</td>
                  <td>
                    <span className="status">
                      {label(item.verificationStatus)}
                    </span>
                  </td>
                  <td>{item.staffProposal}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>
                  <div className="empty-state">
                    <span className="empty-icon">♙</span>
                    <div>
                      <h3>
                        {customers.length
                          ? "Không tìm thấy khách hàng"
                          : "Chưa có khách hàng để hiển thị"}
                      </h3>
                      <p>
                        {customers.length
                          ? "Thử lại với tên hoặc email khác."
                          : "Danh sách sẽ hiển thị khi có tài khoản Customer được đăng ký trong hệ thống."}
                      </p>
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
function Staff({ notify }: { notify: (message: string) => void }) {
  const [items, setItems] = useState<
    { id: string; fullName: string; email: string; phone: string }[]
  >([]);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    return onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        setLoadError("");
        setItems(
          snapshot.docs
            .map((item) => {
              const data = item.data();
              return {
                id: item.id,
                role: String(data.role || "").toLowerCase(),
                fullName: String(data.fullName || "Chưa cập nhật tên"),
                email: String(data.email || ""),
                phone: String(data.phone || "Chưa cập nhật"),
              };
            })
            .filter((item) => item.role === "staff"),
        );
      },
      () =>
        setLoadError(
          "Admin chưa có quyền đọc danh sách Staff trong Firestore.",
        ),
    );
  }, []);

  return (
    <>
      <div className="view-head">
        <div>
          <h2>Nhân viên vận hành</h2>
          <p>
            Danh sách lấy trực tiếp từ các tài khoản có trường{" "}
            <b>role: "staff"</b> trong Firestore.
          </p>
        </div>
        <button
          className="button"
          onClick={() =>
            notify(
              "Tạo Staff: đăng ký tài khoản trong Authentication, sau đó đặt role là staff trong Firestore.",
            )
          }
        >
          Hướng dẫn tạo Staff
        </button>
      </div>
      {loadError && (
        <section className="panel empty-state">
          <span className="empty-icon">!</span>
          <div>
            <h3>Không thể tải danh sách Staff</h3>
            <p>{loadError}</p>
          </div>
        </section>
      )}
      {items.length ? (
        <section className="panel table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nhân viên</th>
                <th>Email</th>
                <th>Số điện thoại</th>
                <th>UID</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <b>{item.fullName}</b>
                  </td>
                  <td>{item.email || "Chưa cập nhật"}</td>
                  <td>{item.phone}</td>
                  <td>
                    <code>{item.id}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : (
        !loadError && (
          <EmptyState
            title="Chưa có nhân viên"
            text="Chưa tìm thấy document users nào có role là staff. Kiểm tra lại UID và trường role trong Firestore."
          />
        )
      )}
    </>
  );
}
function Content({ notify }: { notify: (message: string) => void }) {
  return (
    <>
      <div className="view-head">
        <div>
          <h2>Nội dung hiển thị</h2>
          <p>Quản lý các nội dung công khai của trang chủ.</p>
        </div>
      </div>
      <section className="panel form-card">
        <h3>Nội dung cần quản lý</h3>
        <ul className="info-list">
          <li>
            <span>Ảnh và nội dung slide đầu trang</span>
            <button
              className="link-button"
              onClick={() =>
                notify(
                  "Phần chỉnh sửa slide sẽ được nối với Firestore ở bước dữ liệu.",
                )
              }
            >
              Chỉnh sửa
            </button>
          </li>
          <li>
            <span>Giới thiệu và chính sách hỗ trợ</span>
            <button
              className="link-button"
              onClick={() =>
                notify(
                  "Phần nội dung sẽ được nối với Firestore ở bước dữ liệu.",
                )
              }
            >
              Chỉnh sửa
            </button>
          </li>
          <li>
            <span>Thông tin liên hệ, hotline, địa chỉ</span>
            <button
              className="link-button"
              onClick={() =>
                notify("Phần liên hệ sẽ được nối với Firestore ở bước dữ liệu.")
              }
            >
              Chỉnh sửa
            </button>
          </li>
        </ul>
      </section>
    </>
  );
}
function Settings({ notify }: { notify: (message: string) => void }) {
  return (
    <>
      <div className="view-head">
        <div>
          <h2>Cài đặt hệ thống</h2>
          <p>Các thiết lập dùng chung cho Vi Vu Bike.</p>
        </div>
      </div>
      <section className="panel form-card">
        <h3>Kiểm duyệt hồ sơ</h3>
        <label className="field">
          <span>Quy tắc xử lý</span>
          <select defaultValue="">
            <option value="">Staff kiểm tra, Admin duyệt cuối</option>
            <option>Staff kiểm tra, Admin kiểm tra ngẫu nhiên</option>
          </select>
        </label>
        <p className="page-lead">
          Dù sử dụng quy tắc nào, Staff vẫn là người xử lý giấy tờ trực tiếp.
          Admin có quyền can thiệp và xem lại toàn bộ hồ sơ.
        </p>
        <button
          className="button"
          onClick={() =>
            notify(
              "Đã lưu giao diện cài đặt. Bước tiếp theo sẽ lưu cấu hình vào Firestore.",
            )
          }
        >
          Lưu cài đặt
        </button>
      </section>
    </>
  );
}
