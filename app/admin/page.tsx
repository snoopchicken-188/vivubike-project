"use client";



import { FormEvent, useEffect, useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import {

  addDoc,

  collection,

  deleteDoc,

  doc,
  getDoc,
  getDocs,
  query,
  where,
  getCountFromServer,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  setDoc,
} from "firebase/firestore";

import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "../../lib/firebase";
import {
  DEFAULT_HOME_CONTENT,
  normalizeHomeContent,
  fileToBase64,
  HomeSlideItem,
  HomeAboutContent,
  HomePolicyItem,
  HomePoliciesContent,
  HomeContactContent,
} from "@/lib/home-content";



type AdminUser = { fullName: string; email: string };

type View =

  | "overview"

  | "customers"

  | "staff"

  | "content"

;

type CustomerItem = {

  id: string;

  fullName: string;

  email: string;

  phone: string;

  verificationStatus: string;

  isBlocked: boolean;

  role: string;

};



const menu: { id: View; label: string; icon: string; group?: string }[] = [

  { id: "overview", label: "Tổng quan", icon: "▦" },

  { id: "customers", label: "Khách hàng", icon: "♙", group: "Quản lý tài khoản" },

  { id: "staff", label: "Nhân sự", icon: "♧" },

  { id: "content", label: "Nội dung trang chủ", icon: "✦", group: "Cấu hình" },

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

  customers: {

    eyebrow: "QUẢN LÝ TÀI KHOẢN",

    title: "Khách hàng",

    description: "Xem hồ sơ và lịch sử thuê xe của khách hàng.",

  },

  staff: {

    eyebrow: "QUẢN LÝ TÀI KHOẢN",

    title: "Nhân sự",

    description: "Tạo và quản lý tài khoản nhân viên vận hành và quản lý kinh doanh.",

  },

  content: {

    eyebrow: "CẤU HÌNH",

    title: "Nội dung trang chủ",

    description: "Chỉnh sửa ảnh động, thông tin giới thiệu và liên hệ.",

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get("view") as View | null;
    if (viewParam && ["overview", "customers", "staff", "content"].includes(viewParam)) {
      setView(viewParam);
    }
  }, []);

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

      <aside className={menuOpen ? "sidebar open px-4 py-6" : "sidebar px-4 py-6"}>

        <a className="brand px-3" href="/">

          <span className="brand-mark">V</span>

          <span>

            VI VU <b>BIKE</b>

          </span>

        </a>

        <div className="admin-profile px-3">

          <span className="avatar">{initials}</span>

          <div>

            <b>{admin.fullName}</b>

            <small>Administrator</small>

          </div>

        </div>

        <a className="home-link" href="/">

          ⌂ <span>Trang chủ</span>

        </a>

        <nav className="space-y-1">

          {menu.map((item, index) => (

            <div key={item.id}>

              {item.group && (

                <p className="menu-group mt-6 mb-2">

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

          {view === "overview" && <Overview onChangeView={changeView} adminName={admin.fullName} />}

          {view === "customers" && <Customers notify={notify} />}

          {view === "staff" && <Staff notify={notify} />}

          {view === "content" && <Content notify={notify} />}

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



function Overview({ onChangeView, adminName }: { onChangeView: (view: View) => void; adminName?: string }) {
  const [customerCount, setCustomerCount] = useState<number | null>(null);
  const [staffCount, setStaffCount] = useState<number | null>(null);

  useEffect(() => {
    async function fetchCounts() {
      try {
        const usersRef = collection(db, "users");
        
        // Fetch customers
        const qCust = query(usersRef, where("role", "==", "customer"));
        const snapCust = await getCountFromServer(qCust);
        setCustomerCount(snapCust.data().count);
        
        // Fetch staff — đếm cả "staff" lẫn "business_manager" (khớp với trang Quản lý Nhân sự)
        const [snapStaff, snapBM] = await Promise.all([
          getCountFromServer(query(usersRef, where("role", "==", "staff"))),
          getCountFromServer(query(usersRef, where("role", "==", "business_manager"))),
        ]);
        setStaffCount(snapStaff.data().count + snapBM.data().count);
      } catch (error) {
        console.error("Lỗi lấy thống kê:", error);
        setCustomerCount(0);
        setStaffCount(0);
      }
    }
    fetchCounts();
  }, []);

  return (
    <div className="overview-page">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 font-sans">Xin chào, {adminName || "Admin"}</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Customer Card */}
        <div 
          onClick={() => onChangeView("customers")}
          className="bg-white rounded-xl p-6 border border-gray-200 cursor-pointer hover:border-orange-500 hover:shadow-md transition-all flex flex-col justify-between"
          style={{ minHeight: "140px" }}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-4xl font-extrabold text-gray-900 mb-1">
                {customerCount === null ? "..." : customerCount}
              </div>
              <h3 className="font-bold text-gray-800 text-lg">Khách hàng</h3>
              <p className="text-sm text-gray-500 mt-1">Tổng số tài khoản khách hàng trên hệ thống</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-orange-100 text-orange-500 flex items-center justify-center text-2xl">
              👤
            </div>
          </div>
          <div className="mt-4 text-orange-500 text-sm font-semibold flex items-center">
            Xem chi tiết →
          </div>
        </div>

        {/* Staff Card */}
        <div 
          onClick={() => onChangeView("staff")}
          className="bg-white rounded-xl p-6 border border-gray-200 cursor-pointer hover:border-orange-500 hover:shadow-md transition-all flex flex-col justify-between"
          style={{ minHeight: "140px" }}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-4xl font-extrabold text-gray-900 mb-1">
                {staffCount === null ? "..." : staffCount}
              </div>
              <h3 className="font-bold text-gray-800 text-lg">Nhân sự</h3>
              <p className="text-sm text-gray-500 mt-1">Đội ngũ nhân viên vận hành hệ thống</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-500 flex items-center justify-center text-2xl">
              💼
            </div>
          </div>
          <div className="mt-4 text-orange-500 text-sm font-semibold flex items-center">
            Xem chi tiết →
          </div>
        </div>
      </div>
    </div>
  );
}



function Customers({ notify }: { notify: (message: string) => void }) {

  const [customers, setCustomers] = useState<CustomerItem[]>([]);

  const [keyword, setKeyword] = useState("");

  const [loadError, setLoadError] = useState("");



  // Modals state

  const [blockingUser, setBlockingUser] = useState<CustomerItem | null>(null);

  const [roleUser, setRoleUser] = useState<CustomerItem | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);



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

            isBlocked: Boolean(data.isBlocked),

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

      staff_approved: "Đã xác minh bởi Staff",

      approved: "Đã xác minh",

      rejected: "Bị từ chối",

    })[value] || value;



  const visible = customers.filter((item) =>

    (item.fullName + " " + item.email)

      .toLowerCase()

      .includes(keyword.toLowerCase()),

  );



  const handleToggleBlock = async () => {

    if (!blockingUser) return;

    setIsProcessing(true);

    try {

      const willLock = !blockingUser.isBlocked;

      await updateDoc(doc(db, "users", blockingUser.id), willLock
        ? { isBlocked: true, status: "locked", lockedAt: serverTimestamp() }
        : { isBlocked: false, status: "active", lockedAt: null }
      );

      notify(blockingUser.isBlocked ? "Đã mở khóa tài khoản." : "Đã khóa tài khoản.");

      setBlockingUser(null);

    } catch (err) {

      notify("Lỗi khi thay đổi trạng thái tài khoản.");

    } finally {

      setIsProcessing(false);

    }

  };



  const handleRoleChange = async (e: React.FormEvent) => {

    e.preventDefault();

    if (!roleUser) return;

    setIsProcessing(true);

    try {

      await updateDoc(doc(db, "users", roleUser.id), {

        role: roleUser.role,

      });

      notify("Đổi vai trò thành công.");

      setRoleUser(null);

    } catch (err) {

      notify("Lỗi khi cập nhật vai trò.");

    } finally {

      setIsProcessing(false);

    }

  };



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

              <th style={{ textAlign: "right" }}>Thao tác</th>

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

                  <td style={{ textAlign: "right" }}>

                    <button

                      className="link-button"

                      style={{ marginRight: 10, color: "#4f46e5", fontWeight: 500 }}

                      onClick={() => setRoleUser(item)}

                    >

                      Đổi vai trò

                    </button>

                    <button

                      className="link-button"

                      style={{ color: item.isBlocked ? "#059669" : "#dc2626", fontWeight: 500 }}

                      onClick={() => setBlockingUser(item)}

                    >

                      {item.isBlocked ? "Mở khóa" : "Khóa"}

                    </button>

                  </td>

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



      {blockingUser && (

        <div className="modal-overlay">

          <div className="modal-content panel form-card">

            <h3>{blockingUser.isBlocked ? "Mở khóa tài khoản" : "Khóa tài khoản"}</h3>

            <p className="page-lead" style={{ margin: "10px 0 20px" }}>

              Bạn có chắc chắn muốn {blockingUser.isBlocked ? "mở khóa" : "khóa"} tài khoản <b>{blockingUser.fullName}</b> không?

            </p>

            <div className="form-actions">

              <button

                className="button secondary"

                onClick={() => setBlockingUser(null)}

                disabled={isProcessing}

              >

                Hủy

              </button>

              <button

                className="button"

                style={{ background: blockingUser.isBlocked ? "#059669" : "#c73a22", color: "#fff" }}

                onClick={handleToggleBlock}

                disabled={isProcessing}

              >

                {isProcessing ? "Đang xử lý..." : blockingUser.isBlocked ? "Mở khóa" : "Khóa tài khoản"}

              </button>

            </div>

          </div>

        </div>

      )}



      {roleUser && (

        <div className="modal-overlay">

          <div className="modal-content panel form-card">

            <h3 style={{ marginBottom: "5px" }}>Thay đổi vai trò người dùng</h3>

            <p style={{ margin: "0 0 15px", color: "#6d7780", fontSize: "14px", lineHeight: 1.5 }}>

              Khách hàng: <b>{roleUser.fullName}</b><br/>

              Email: {roleUser.email}<br/>

            </p>

            <form onSubmit={handleRoleChange}>

              <div className="form-grid">

                <label className="field full">

                  <span>Chọn vai trò mới</span>

                  <select

                    value={roleUser.role}

                    onChange={(e) =>

                      setRoleUser({ ...roleUser, role: e.target.value })

                    }

                  >

                    <option value="customer">Khách hàng (customer)</option>

                    <option value="staff">Nhân viên vận hành (staff)</option>

                    <option value="business_manager">Quản lý kinh doanh (business_manager)</option>

                    <option value="admin">Quản trị viên (admin)</option>

                  </select>

                </label>

              </div>

              <div className="form-actions" style={{ marginTop: 20 }}>

                <button

                  type="button"

                  className="button secondary"

                  onClick={() => setRoleUser(null)}

                  disabled={isProcessing}

                >

                  Hủy

                </button>

                <button type="submit" className="button" style={{ background: "#4f46e5", color: "#fff" }} disabled={isProcessing}>

                  {isProcessing ? "Đang xử lý..." : "Cập nhật vai trò"}

                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </>

  );

}

function Staff({ notify }: { notify: (message: string) => void }) {
  const [items, setItems] = useState<
    { id: string; fullName: string; email: string; phone: string; role: string; roleTitle?: string; isBlocked: boolean }[]
  >([]);
  const [keyword, setKeyword] = useState("");
  const [loadError, setLoadError] = useState("");
  const [editingStaff, setEditingStaff] = useState<{ id: string; fullName: string; phone: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingStaff, setDeletingStaff] = useState<{ id: string; fullName: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [roleStaff, setRoleStaff] = useState<{ id: string; fullName: string; email: string; role: string } | null>(null);
  const [isChangingRole, setIsChangingRole] = useState(false);

  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ fullName: "", email: "", phone: "", password: "", role: "staff" });
  const [showPassword, setShowPassword] = useState(false);
  const [createError, setCreateError] = useState("");

  const refreshStaffList = async () => {
    try {
      const snap = await getDocs(collection(db, "users"));
      setLoadError("");
      setItems(
        snap.docs
          .map((item) => {
            const data = item.data();
            return {
              id: item.id,
              role: String(data.role || "").toLowerCase(),
              roleTitle: String(data.roleTitle || ""),
              fullName: String(data.fullName || "Chưa cập nhật tên"),
              email: String(data.email || ""),
              phone: String(data.phone || data.phoneNumber || "Chưa cập nhật"),
              isBlocked: Boolean(data.isBlocked),
            };
          })
          .filter((item) => ["staff", "business_manager"].includes(item.role))
      );
    } catch (err) {
      console.error("Lỗi khi tải lại danh sách nhân sự:", err);
    }
  };

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
                roleTitle: String(data.roleTitle || ""),
                fullName: String(data.fullName || "Chưa cập nhật tên"),
                email: String(data.email || ""),
                phone: String(data.phone || data.phoneNumber || "Chưa cập nhật"),
                isBlocked: Boolean(data.isBlocked),
              };
            })
            .filter((item) => ["staff", "business_manager"].includes(item.role))
        );
      },
      () =>
        setLoadError(
          "Admin chưa có quyền đọc danh sách nhân sự trong Firestore."
        )
    );
  }, []);

  const visible = items.filter((item) =>
    (item.fullName + " " + item.email)
      .toLowerCase()
      .includes(keyword.toLowerCase())
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "users", editingStaff.id), {
        fullName: editingStaff.fullName,
        phone: editingStaff.phone,
      });
      notify("Cập nhật thông tin nhân viên thành công.");
      setEditingStaff(null);
    } catch (err) {
      notify("Lỗi khi cập nhật thông tin.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingStaff) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "users", deletingStaff.id));
      notify("Đã xóa nhân viên.");
      setDeletingStaff(null);
    } catch (err) {
      notify("Lỗi khi xóa nhân viên.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRoleChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleStaff) return;
    setIsChangingRole(true);
    try {
      await updateDoc(doc(db, "users", roleStaff.id), {
        role: roleStaff.role,
      });
      notify("Đổi vai trò thành công.");
      setRoleStaff(null);
    } catch (err) {
      notify("Lỗi khi cập nhật vai trò.");
    } finally {
      setIsChangingRole(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    setIsSaving(true);

    try {
      const token = await auth.currentUser?.getIdToken(true);
      if (!token) {
        throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      }

      const roleTitle =
        createForm.role === "business_manager"
          ? "Quản lý kinh doanh"
          : "Nhân viên vận hành";

      const payload = {
        fullName: createForm.fullName.trim(),
        email: createForm.email.trim(),
        phoneNumber: createForm.phone.trim(),
        phone: createForm.phone.trim(),
        password: createForm.password,
        role: createForm.role,
        roleTitle,
      };

      const res = await fetch("/api/admin/create-staff", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        console.error("Lỗi phản hồi từ API cấp tài khoản nhân sự:", data);
        let errorMsg = data.error || data.message || "Không thể cấp tài khoản. Vui lòng thử lại.";
        if (data.code === "auth/email-already-exists" || errorMsg.includes("email-already-exists")) {
          errorMsg = "Email này đã được sử dụng trên hệ thống.";
        } else if (data.code === "auth/weak-password" || errorMsg.includes("weak-password")) {
          errorMsg = "Mật khẩu khởi tạo phải có ít nhất 6 ký tự.";
        }
        throw new Error(errorMsg);
      }

      notify("Cấp tài khoản nhân sự thành công!");
      setIsCreating(false);
      setCreateForm({ fullName: "", email: "", phone: "", password: "", role: "staff" });
      await refreshStaffList();
    } catch (err: any) {
      console.error("Không thể cấp tài khoản nhân sự:", err);
      let msg = err.message || "Có lỗi xảy ra khi cấp tài khoản.";
      if (msg.includes("auth/email-already-exists") || msg.includes("email đã được sử dụng")) {
        msg = "Email này đã được sử dụng trên hệ thống.";
      } else if (msg.includes("auth/weak-password") || msg.includes("ít nhất 6 ký tự")) {
        msg = "Mật khẩu khởi tạo phải có ít nhất 6 ký tự.";
      }
      setCreateError(msg);
    } finally {
      setIsSaving(false);
    }
  };







  return (

    <>

      <div className="view-head">

        <div>

          <h2>Nhân sự hệ thống</h2>

        </div>

        <div className="toolbar" style={{ display: "flex", gap: "10px" }}>

          <input

            value={keyword}

            onChange={(event) => setKeyword(event.target.value)}

            placeholder="Tìm tên hoặc email"

          />

          <button className="button" style={{ background: "#f86522", color: "white", padding: "0 16px" }} onClick={() => setIsCreating(true)}>

            + Cấp tài khoản

          </button>

        </div>

      </div>

      {loadError && (

        <section className="panel empty-state">

          <span className="empty-icon">!</span>

          <div>

            <h3>Không thể tải danh sách nhân sự</h3>

            <p>{loadError}</p>

          </div>

        </section>

      )}

      <section className="panel table-wrap">

        <table className="data-table">

          <thead>

            <tr>

              <th>Nhân sự</th>

              <th>Email</th>

              <th>Số điện thoại</th>

              <th>Vai trò</th>

              <th style={{ textAlign: "right" }}>Thao tác</th>

            </tr>

          </thead>

          <tbody>

            {visible.length ? (

              visible.map((item) => (

                <tr key={item.id}>

                  <td>

                    <b>{item.fullName}</b>

                  </td>

                  <td>{item.email || "Chưa cập nhật"}</td>

                  <td>{item.phone}</td>

                  <td>
                    {item.roleTitle ||
                      (item.role === "business_manager"
                        ? "Quản lý kinh doanh"
                        : "Nhân viên vận hành")}
                  </td>

                  <td style={{ textAlign: "right" }}>

                    <button

                      className="link-button"

                      style={{ marginRight: 10, color: "#4f46e5", fontWeight: 500 }}

                      onClick={() => setRoleStaff(item as any)}

                    >

                      Đổi vai trò

                    </button>

                    <button

                      className="link-button"

                      style={{ marginRight: 10, color: "#2b78e4" }}

                      onClick={() => setEditingStaff(item)}

                    >

                      Sửa

                    </button>

                    <button

                      className="danger-button"

                      onClick={() => setDeletingStaff(item)}

                    >

                      Xóa

                    </button>

                  </td>

                </tr>

              ))

            ) : (

              !loadError && (

                <tr>

                  <td colSpan={5}>

                    <div className="empty-state">

                      <span className="empty-icon">♧</span>

                      <div>

                        <h3>

                          {items.length

                            ? "Không tìm thấy nhân sự"

                            : "Chưa có nhân sự"}

                        </h3>

                        <p>

                          {items.length

                            ? "Thử lại với tên hoặc email khác."

                            : "Chưa tìm thấy tài khoản Staff hoặc Quản lý kinh doanh trong Firestore."}

                        </p>

                      </div>

                    </div>

                  </td>

                </tr>

              )

            )}

          </tbody>

        </table>

      </section>



      {editingStaff && (

        <div className="modal-overlay">

          <div className="modal-content panel form-card">

            <h3>Sửa thông tin nhân viên</h3>

            <form onSubmit={handleSave}>

              <div className="form-grid">

                <label className="field full">

                  <span>Họ và tên</span>

                  <input

                    required

                    value={editingStaff.fullName}

                    onChange={(e) =>

                      setEditingStaff({ ...editingStaff, fullName: e.target.value })

                    }

                  />

                </label>

                <label className="field full">

                  <span>Số điện thoại</span>

                  <input

                    required

                    value={editingStaff.phone}

                    onChange={(e) =>

                      setEditingStaff({ ...editingStaff, phone: e.target.value })

                    }

                  />

                </label>

              </div>

              <div className="form-actions" style={{ marginTop: 20 }}>

                <button

                  type="button"

                  className="button secondary"

                  onClick={() => setEditingStaff(null)}

                  disabled={isSaving}

                >

                  Hủy

                </button>

                <button type="submit" className="button" disabled={isSaving}>

                  {isSaving ? "Đang lưu..." : "Lưu thay đổi"}

                </button>

              </div>

            </form>

          </div>

        </div>

      )}



      {isCreating && (

        <div className="modal-overlay">

          <div className="modal-content panel form-card" style={{ maxWidth: 500 }}>

            <h3>Cấp tài khoản nhân sự mới</h3>

            {createError && (
              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#dc2626",
                  padding: "10px 14px",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 14,
                }}
              >
                ⚠️ {createError}
              </div>
            )}

            <form onSubmit={handleCreate}>

              <div className="form-grid">

                <label className="field full">

                  <span>Họ và tên *</span>

                  <input

                    required

                    placeholder="Ví dụ: Nguyễn Văn A"

                    value={createForm.fullName}

                    onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}

                  />

                </label>

                <label className="field full">

                  <span>Email *</span>

                  <input

                    required

                    type="email"

                    placeholder="Ví dụ: nhanvien@vivubike.com"

                    value={createForm.email}

                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}

                  />

                </label>

                <label className="field full">

                  <span>Số điện thoại *</span>

                  <input

                    required

                    type="tel"

                    placeholder="Ví dụ: 0912345678"

                    pattern="[0-9]{9,11}"

                    title="Số điện thoại phải từ 9-11 chữ số"

                    value={createForm.phone}

                    onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}

                  />

                </label>

                <label className="field full">

                  <span>Mật khẩu khởi tạo *</span>

                  <div style={{ display: "flex", gap: 10 }}>

                    <input

                      required

                      type={showPassword ? "text" : "password"}

                      minLength={6}

                      placeholder="Ít nhất 6 ký tự"

                      value={createForm.password}

                      onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}

                      style={{ flex: 1 }}

                    />

                    <button

                      type="button"

                      className="button secondary"

                      onClick={() => setShowPassword(!showPassword)}

                    >

                      {showPassword ? "Ẩn" : "Hiện"}

                    </button>

                  </div>

                </label>

                <label className="field full">

                  <span>Vai trò *</span>

                  <select

                    className="input"

                    value={createForm.role}

                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}

                  >

                    <option value="staff">Nhân viên vận hành (staff)</option>

                    <option value="business_manager">Quản lý kinh doanh (business_manager)</option>

                  </select>

                </label>

              </div>

              <div className="form-actions" style={{ marginTop: 20 }}>

                <button

                  type="button"

                  className="button secondary"

                  onClick={() => setIsCreating(false)}

                  disabled={isSaving}

                >

                  Hủy

                </button>

                <button type="submit" className="button" disabled={isSaving}>

                  {isSaving ? "Đang tạo..." : "Tạo tài khoản"}

                </button>

              </div>

            </form>

          </div>

        </div>

      )}





      {deletingStaff && (

        <div className="modal-overlay">

          <div className="modal-content panel form-card">

            <h3>Xóa nhân viên</h3>

            <p className="page-lead" style={{ margin: "10px 0 20px" }}>

              Bạn có chắc chắn muốn xóa nhân viên <b>{deletingStaff.fullName}</b> không? Hành động này không thể hoàn tác.

            </p>

            <div className="form-actions">

              <button

                className="button secondary"

                onClick={() => setDeletingStaff(null)}

                disabled={isDeleting}

              >

                Hủy

              </button>

              <button

                className="button"

                style={{ background: "#c73a22", color: "#fff" }}

                onClick={handleDelete}

                disabled={isDeleting}

              >

                {isDeleting ? "Đang xóa..." : "Xóa nhân viên"}

              </button>

            </div>

          </div>

        </div>

      )}



      {roleStaff && (

        <div className="modal-overlay">

          <div className="modal-content panel form-card">

            <h3 style={{ marginBottom: "5px" }}>Thay đổi vai trò người dùng</h3>

            <p style={{ margin: "0 0 15px", color: "#6d7780", fontSize: "14px", lineHeight: 1.5 }}>

              Nhân viên: <b>{roleStaff.fullName}</b><br/>

              Email: {roleStaff.email}<br/>

            </p>

            <form onSubmit={handleRoleChange}>

              <div className="form-grid">

                <label className="field full">

                  <span>Chọn vai trò mới</span>

                  <select

                    value={roleStaff.role}

                    onChange={(e) =>

                      setRoleStaff({ ...roleStaff, role: e.target.value })

                    }

                  >

                    <option value="customer">Khách hàng (customer)</option>

                    <option value="staff">Nhân viên vận hành (staff)</option>

                    <option value="business_manager">Quản lý kinh doanh (business_manager)</option>

                    <option value="admin">Quản trị viên (admin)</option>

                  </select>

                </label>

              </div>

              <div className="form-actions" style={{ marginTop: 20 }}>

                <button

                  type="button"

                  className="button secondary"

                  onClick={() => setRoleStaff(null)}

                  disabled={isChangingRole}

                >

                  Hủy

                </button>

                <button type="submit" className="button" style={{ background: "#4f46e5", color: "#fff" }} disabled={isChangingRole}>

                  {isChangingRole ? "Đang xử lý..." : "Cập nhật vai trò"}

                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </>

  );

}

function Content({ notify }: { notify: (message: string) => void }) {
  const [modalType, setModalType] = useState<"slides" | "about" | "contact" | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dữ liệu nội dung trang chủ (được tải từ Firestore site_settings/home_content)
  const [slides, setSlides] = useState<HomeSlideItem[]>(DEFAULT_HOME_CONTENT.slides);
  const [about, setAbout] = useState<HomeAboutContent>(DEFAULT_HOME_CONTENT.about);
  const [policies, setPolicies] = useState<HomePoliciesContent>(DEFAULT_HOME_CONTENT.policies);
  const [contact, setContact] = useState<HomeContactContent>(DEFAULT_HOME_CONTENT.contact);

  // State nháp dùng trong các Modal
  const [editingSlides, setEditingSlides] = useState<HomeSlideItem[]>([]);
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const [editingAbout, setEditingAbout] = useState<HomeAboutContent>(DEFAULT_HOME_CONTENT.about);
  const [editingPolicies, setEditingPolicies] = useState<HomePoliciesContent>(DEFAULT_HOME_CONTENT.policies);
  const [editingContact, setEditingContact] = useState<HomeContactContent>(DEFAULT_HOME_CONTENT.contact);

  // Tải dữ liệu từ Firestore document: site_settings/home_content
  useEffect(() => {
    async function loadData() {
      setLoadingData(true);
      try {
        const docRef = doc(db, "site_settings", "home_content");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const normalized = normalizeHomeContent(docSnap.data());
          setSlides(normalized.slides);
          setAbout(normalized.about);
          setPolicies(normalized.policies);
          setContact(normalized.contact);
        } else {
          // Kiểm tra xem có dữ liệu cũ ở "homepage" không
          const oldSnap = await getDoc(doc(db, "site_settings", "homepage"));
          if (oldSnap.exists()) {
            const normalized = normalizeHomeContent(oldSnap.data());
            setSlides(normalized.slides);
            setAbout(normalized.about);
            setPolicies(normalized.policies);
            setContact(normalized.contact);
          } else {
            // Document chưa có: Thiết lập mặc định
            setSlides(DEFAULT_HOME_CONTENT.slides);
            setAbout(DEFAULT_HOME_CONTENT.about);
            setPolicies(DEFAULT_HOME_CONTENT.policies);
            setContact(DEFAULT_HOME_CONTENT.contact);
          }
        }
      } catch (err) {
        console.error("Lỗi khi tải dữ liệu home_content:", err);
        notify("Lỗi kết nối Firestore, đang sử dụng dữ liệu mặc định.");
      } finally {
        setLoadingData(false);
      }
    }
    loadData();
  }, [notify]);

  // Mở các modal với dữ liệu clone, đảm bảo luôn có danh sách đầy đủ các slide (>= 3)
  const handleOpenSlides = () => {
    const effectiveSlides = (slides && slides.length >= 3)
      ? slides
      : (slides && slides.length > 0)
      ? [...slides, ...DEFAULT_HOME_CONTENT.slides.slice(slides.length)]
      : DEFAULT_HOME_CONTENT.slides;
    setEditingSlides(JSON.parse(JSON.stringify(effectiveSlides)));
    setActiveSlideIdx(0);
    setModalType("slides");
  };

  const handleOpenAbout = () => {
    setEditingAbout(JSON.parse(JSON.stringify(about)));
    setEditingPolicies(JSON.parse(JSON.stringify(policies)));
    setModalType("about");
  };

  const handleOpenContact = () => {
    setEditingContact(JSON.parse(JSON.stringify(contact)));
    setModalType("contact");
  };

  // Xử lý upload ảnh chuyển Base64
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>, slideIdx: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      notify("Dung lượng file lớn hơn 8MB. Vui lòng chọn ảnh nhỏ hơn.");
      return;
    }

    setIsUploadingImage(true);
    try {
      const base64 = await fileToBase64(file);
      const updated = [...editingSlides];
      updated[slideIdx] = {
        ...updated[slideIdx],
        imageUrl: base64,
      };
      setEditingSlides(updated);
      notify("Đã tải ảnh lên và chuyển đổi Base64 thành công!");
    } catch (err) {
      console.error("Lỗi fileToBase64:", err);
      notify("Không thể đọc file ảnh. Vui lòng thử lại.");
    } finally {
      setIsUploadingImage(false);
      e.target.value = "";
    }
  };

  // Lưu Slide
  const handleSaveSlides = async () => {
    if (editingSlides.length === 0) {
      notify("Vui lòng giữ lại ít nhất 1 slide!");
      return;
    }
    setSaving(true);
    try {
      await setDoc(doc(db, "site_settings", "home_content"), {
        slides: editingSlides,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setSlides(editingSlides);
      notify("Đã lưu nội dung slide đầu trang thành công!");
      setModalType(null);
    } catch (err: unknown) {
      console.error("Lỗi lưu slide:", err);
      notify("Lỗi khi lưu slide: " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // Lưu Giới thiệu & Chính sách hỗ trợ
  const handleSaveAboutAndPolicies = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "site_settings", "home_content"), {
        about: editingAbout,
        policies: editingPolicies,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setAbout(editingAbout);
      setPolicies(editingPolicies);
      notify("Đã lưu giới thiệu và chính sách hỗ trợ thành công!");
      setModalType(null);
    } catch (err: unknown) {
      console.error("Lỗi lưu about & policies:", err);
      notify("Lỗi khi lưu: " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // Lưu Thông tin liên hệ
  const handleSaveContact = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "site_settings", "home_content"), {
        contact: editingContact,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setContact(editingContact);
      notify("Đã lưu thông tin liên hệ thành công!");
      setModalType(null);
    } catch (err: unknown) {
      console.error("Lỗi lưu liên hệ:", err);
      notify("Lỗi khi lưu liên hệ: " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loadingData) {
    return (
      <div style={{ padding: "60px 20px", textAlign: "center", color: "#64748b" }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
        <div>Đang tải cấu hình nội dung trang chủ...</div>
      </div>
    );
  }

  const currentSlide = editingSlides[activeSlideIdx] || editingSlides[0];

  return (
    <>
      <div className="view-head">
        <div>
          <h2>Nội dung trang chủ</h2>
          <p>Quản lý các banner slider, thông tin giới thiệu, chính sách và liên hệ hiển thị ra trang chủ.</p>
        </div>
      </div>

      <section className="panel form-card" style={{ maxWidth: 840 }}>
        <h3>Các mục nội dung</h3>
        <ul className="info-list">
          {/* Mục 1: Hero Slideshow */}
          <li style={{ alignItems: "center", padding: "18px 0" }}>
            <div>
              <div style={{ fontWeight: 700, color: "#1e293b", fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
                <span>🖼️ Ảnh và nội dung slide đầu trang</span>
                <span style={{ fontSize: 11, background: "#fff7ed", color: "#c2410c", padding: "2px 8px", borderRadius: 999, fontWeight: 700 }}>
                  {slides.length} slide
                </span>
              </div>
              <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>
                Ảnh nền, tiêu đề lớn nhỏ, mô tả ngắn và các tag nổi bật trên banner chính.
              </p>
            </div>
            <button
              className="button"
              style={{ background: "#f86522", color: "#fff", padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700 }}
              onClick={handleOpenSlides}
            >
              Chỉnh sửa
            </button>
          </li>

          {/* Mục 2: Giới thiệu & Chính sách hỗ trợ */}
          <li style={{ alignItems: "center", padding: "18px 0" }}>
            <div>
              <div style={{ fontWeight: 700, color: "#1e293b", fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
                <span>🛡️ Giới thiệu và chính sách hỗ trợ</span>
                <span style={{ fontSize: 11, background: "#ecfdf5", color: "#047857", padding: "2px 8px", borderRadius: 999, fontWeight: 700 }}>
                  {policies.items.length} chính sách
                </span>
              </div>
              <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>
                Văn bản giới thiệu về Vi Vu Bike và danh sách các thẻ chính sách hỗ trợ khách hàng.
              </p>
            </div>
            <button
              className="button"
              style={{ background: "#f86522", color: "#fff", padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700 }}
              onClick={handleOpenAbout}
            >
              Chỉnh sửa
            </button>
          </li>

          {/* Mục 3: Thông tin liên hệ */}
          <li style={{ alignItems: "center", padding: "18px 0" }}>
            <div>
              <div style={{ fontWeight: 700, color: "#1e293b", fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
                <span>📞 Thông tin liên hệ, hotline, địa chỉ</span>
              </div>
              <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>
                Hotline ({contact.hotline || "0900 123 456"}), cơ sở ({contact.address || "Hà Nội"}), email, giờ làm việc và MXH.
              </p>
            </div>
            <button
              className="button"
              style={{ background: "#f86522", color: "#fff", padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700 }}
              onClick={handleOpenContact}
            >
              Chỉnh sửa
            </button>
          </li>
        </ul>
      </section>

      {/* ========================================================================= */}
      {/* MODAL 1: ẢNH VÀ NỘI DUNG SLIDE ĐẦU TRANG (HERO SLIDESHOW) */}
      {/* ========================================================================= */}
      {modalType === "slides" && (
        <div
          className="modal-overlay"
          onClick={() => setModalType(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.7)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            className="modal-content panel form-card"
            style={{
              maxWidth: 900,
              width: "100%",
              maxHeight: "92vh",
              overflowY: "auto",
              background: "#fff",
              borderRadius: 16,
              boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
              padding: 28,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, borderBottom: "1px solid #f1f5f9", paddingBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#0f172a" }}>Ảnh và nội dung slide đầu trang (Hero Slideshow)</h3>
                <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>
                  Chỉnh sửa tiêu đề, mô tả, tag cam kết và ảnh nền (nhập URL hoặc tải file ảnh Base64).
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Khôi phục lại toàn bộ 4 slide mẫu gốc của Vi Vu Bike? Các thay đổi chưa lưu sẽ được thay thế.")) {
                      setEditingSlides(JSON.parse(JSON.stringify(DEFAULT_HOME_CONTENT.slides)));
                      setActiveSlideIdx(0);
                      notify("Đã tải lại toàn bộ 4 slide mẫu mặc định!");
                    }
                  }}
                  style={{
                    border: "1px solid #cbd5e1",
                    background: "#f8fafc",
                    borderRadius: 8,
                    padding: "7px 12px",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#475569",
                  }}
                  title="Tải lại toàn bộ 4 slide mẫu gốc"
                >
                  ↺ Khôi phục slide mặc định
                </button>
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  style={{ border: 0, background: "#f1f5f9", borderRadius: "50%", width: 34, height: 34, cursor: "pointer", fontSize: 16, fontWeight: 700, color: "#64748b" }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Danh sách tabs các Slide */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, overflowX: "auto", paddingBottom: 12, borderBottom: "1px solid #e2e8f0", marginBottom: 20 }}>
              {editingSlides.map((s, idx) => (
                <button
                  key={s.id || idx}
                  type="button"
                  onClick={() => setActiveSlideIdx(idx)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    border: activeSlideIdx === idx ? "2px solid #f86522" : "1px solid #cbd5e1",
                    background: activeSlideIdx === idx ? "#fff7ed" : "#fff",
                    color: activeSlideIdx === idx ? "#ea580c" : "#475569",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    whiteSpace: "nowrap",
                  }}
                >
                  <span>Slide {idx + 1}</span>
                  {editingSlides.length > 1 && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Bạn có chắc muốn xóa Slide ${idx + 1}?`)) {
                          const nextSlides = editingSlides.filter((_, i) => i !== idx);
                          setEditingSlides(nextSlides);
                          setActiveSlideIdx(Math.max(0, idx - 1));
                        }
                      }}
                      style={{ color: "#ef4444", marginLeft: 4, cursor: "pointer", fontWeight: 800 }}
                      title="Xóa slide này"
                    >
                      ✕
                    </span>
                  )}
                </button>
              ))}

              <button
                type="button"
                onClick={() => {
                  const newSlide: HomeSlideItem = {
                    id: `slide-${Date.now()}`,
                    subtitle: "KHÁM PHÁ TIẾP",
                    heading1: "Hành trình mới",
                    heading2: "Trải nghiệm vui",
                    description: "Thêm những cung đường đẹp và địa điểm thú vị cùng Vi Vu Bike.",
                    tags: ["Xe bảo dưỡng định kỳ", "Hỗ trợ 24/7"],
                    imageUrl: "https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=2200&q=90",
                  };
                  const updated = [...editingSlides, newSlide];
                  setEditingSlides(updated);
                  setActiveSlideIdx(updated.length - 1);
                }}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  border: "1px dashed #f86522",
                  background: "#fff",
                  color: "#ea580c",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                + Thêm slide mới
              </button>
            </div>

            {/* Chi tiết slide đang chọn */}
            {currentSlide && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                {/* Cột trái: Form nhập liệu */}
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 5 }}>
                      Tiêu đề nhỏ (Badge / Subtitle)
                    </label>
                    <input
                      className="input"
                      style={{ width: "100%", padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13 }}
                      placeholder="Ví dụ: KHÁM PHÁ PHỐ PHƯỜNG"
                      value={currentSlide.subtitle}
                      onChange={(e) => {
                        const next = [...editingSlides];
                        next[activeSlideIdx].subtitle = e.target.value;
                        setEditingSlides(next);
                      }}
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 5 }}>
                        Tiêu đề lớn dòng 1 (Heading 1)
                      </label>
                      <input
                        className="input"
                        style={{ width: "100%", padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13 }}
                        placeholder="Ví dụ: Đi chậm lại"
                        value={currentSlide.heading1}
                        onChange={(e) => {
                          const next = [...editingSlides];
                          next[activeSlideIdx].heading1 = e.target.value;
                          setEditingSlides(next);
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#ea580c", marginBottom: 5 }}>
                        Tiêu đề lớn dòng 2 (Màu cam)
                      </label>
                      <input
                        className="input"
                        style={{ width: "100%", padding: "9px 12px", border: "1px solid #f97316", borderRadius: 8, fontSize: 13 }}
                        placeholder="Ví dụ: Cảm nhận nhiều hơn"
                        value={currentSlide.heading2}
                        onChange={(e) => {
                          const next = [...editingSlides];
                          next[activeSlideIdx].heading2 = e.target.value;
                          setEditingSlides(next);
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 5 }}>
                      Mô tả ngắn (Description)
                    </label>
                    <textarea
                      className="input"
                      rows={3}
                      style={{ width: "100%", padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13, resize: "vertical" }}
                      placeholder="Ví dụ: Chủ động lịch trình và khám phá Hà Nội theo cách của riêng bạn."
                      value={currentSlide.description}
                      onChange={(e) => {
                        const next = [...editingSlides];
                        next[activeSlideIdx].description = e.target.value;
                        setEditingSlides(next);
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 5 }}>
                      Tag nổi bật (Cách nhau bằng dấu phẩy)
                    </label>
                    <input
                      className="input"
                      style={{ width: "100%", padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13 }}
                      placeholder="Ví dụ: Xe bảo dưỡng định kỳ, Hỗ trợ 24/7"
                      value={currentSlide.tags.join(", ")}
                      onChange={(e) => {
                        const parsed = e.target.value.split(",").map((t) => t.trim()).filter(Boolean);
                        const next = [...editingSlides];
                        next[activeSlideIdx].tags = parsed;
                        setEditingSlides(next);
                      }}
                    />
                    <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                      {currentSlide.tags.map((tag, tIdx) => (
                        <span key={tIdx} style={{ fontSize: 11, background: "#f1f5f9", color: "#334155", padding: "2px 8px", borderRadius: 6, fontWeight: 600 }}>
                          ✓ {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 5 }}>
                      Ảnh nền (Background Image)
                    </label>
                    <input
                      className="input"
                      style={{ width: "100%", padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13, marginBottom: 8 }}
                      placeholder="Dán link ảnh URL (https://...)"
                      value={currentSlide.imageUrl}
                      onChange={(e) => {
                        const next = [...editingSlides];
                        next[activeSlideIdx].imageUrl = e.target.value;
                        setEditingSlides(next);
                      }}
                    />

                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <label
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "8px 14px",
                          background: "#f1f5f9",
                          border: "1px solid #cbd5e1",
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#334155",
                          cursor: isUploadingImage ? "not-allowed" : "pointer",
                        }}
                      >
                        <span>{isUploadingImage ? "⏳ Đang chuyển Base64..." : "📁 Tải ảnh từ máy (Base64)"}</span>
                        <input
                          type="file"
                          accept="image/*"
                          disabled={isUploadingImage}
                          style={{ display: "none" }}
                          onChange={(e) => handleImageFileChange(e, activeSlideIdx)}
                        />
                      </label>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>
                        Hỗ trợ URL hoặc Base64 (tự động tối ưu dung lượng)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Cột phải: Xem trước (Live Preview) mô phỏng Hero slide */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>
                    Xem trước hiển thị thực tế (Live Preview)
                  </label>
                  <div
                    style={{
                      width: "100%",
                      minHeight: 280,
                      borderRadius: 12,
                      overflow: "hidden",
                      position: "relative",
                      background: currentSlide.imageUrl
                        ? `url("${currentSlide.imageUrl}") center/cover no-repeat`
                        : "#1e293b",
                      border: "1px solid #cbd5e1",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      padding: "24px 22px",
                      boxShadow: "inset 0 0 100px rgba(0,0,0,0.5)",
                    }}
                  >
                    {/* Dark gradient overlay */}
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: "linear-gradient(90deg, rgba(10,13,17,0.92) 0%, rgba(10,13,17,0.6) 65%, rgba(10,13,17,0.2) 100%)",
                        zIndex: 1,
                      }}
                    />

                    {/* Content over image */}
                    <div style={{ position: "relative", zIndex: 2, color: "#fff", maxWidth: "90%" }}>
                      <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 800, letterSpacing: ".15em", color: "#ff8d55" }}>
                        {currentSlide.subtitle || "BADGE SUBTITLE"}
                      </p>
                      <h4 style={{ margin: "0 0 10px", fontSize: 24, fontWeight: 800, lineHeight: 1.15 }}>
                        {currentSlide.heading1 || "Tiêu đề dòng 1"}<br />
                        <span style={{ color: "#ff7838" }}>{currentSlide.heading2 || "Tiêu đề dòng 2"}</span>
                      </h4>
                      <p style={{ margin: "0 0 14px", fontSize: 12, color: "#e2e8f0", lineHeight: 1.5 }}>
                        {currentSlide.description || "Mô tả ngắn của slide sẽ hiển thị tại đây."}
                      </p>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {(currentSlide.tags.length > 0 ? currentSlide.tags : ["Xe bảo dưỡng định kỳ", "Hỗ trợ 24/7"]).map((tag, idx) => (
                          <span
                            key={idx}
                            style={{
                              fontSize: 10,
                              background: "rgba(0,0,0,0.35)",
                              border: "1px solid rgba(255,255,255,0.3)",
                              padding: "3px 8px",
                              borderRadius: 999,
                              color: "#fff",
                              fontWeight: 600,
                            }}
                          >
                            ✓ {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "#64748b" }}>
                      Đang sửa <b>Slide {activeSlideIdx + 1} / {editingSlides.length}</b>
                    </span>
                    {editingSlides.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Bạn có chắc muốn xóa Slide ${activeSlideIdx + 1}?`)) {
                            const nextSlides = editingSlides.filter((_, i) => i !== activeSlideIdx);
                            setEditingSlides(nextSlides);
                            setActiveSlideIdx(Math.max(0, activeSlideIdx - 1));
                          }
                        }}
                        style={{ border: 0, background: "transparent", color: "#ef4444", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                      >
                        🗑️ Xóa slide này
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Actions Footer */}
            <div className="form-actions mt-6" style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24, paddingTop: 16, borderTop: "1px solid #f1f5f9" }}>
              <button
                type="button"
                className="button secondary"
                onClick={() => setModalType(null)}
                disabled={saving}
                style={{ padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                Hủy
              </button>
              <button
                type="button"
                className="button"
                onClick={handleSaveSlides}
                disabled={saving || isUploadingImage}
                style={{ background: "#f86522", color: "#fff", padding: "10px 22px", borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: "pointer" }}
              >
                {saving ? "Đang lưu Firestore..." : "Lưu thay đổi"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: GIỚI THIỆU VÀ CHÍNH SÁCH HỖ TRỢ */}
      {/* ========================================================================= */}
      {modalType === "about" && (
        <div
          className="modal-overlay"
          onClick={() => setModalType(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.7)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            className="modal-content panel form-card"
            style={{
              maxWidth: 840,
              width: "100%",
              maxHeight: "92vh",
              overflowY: "auto",
              background: "#fff",
              borderRadius: 16,
              boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
              padding: 28,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, borderBottom: "1px solid #f1f5f9", paddingBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#0f172a" }}>Giới thiệu và chính sách hỗ trợ</h3>
                <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>
                  Chỉnh sửa văn bản giới thiệu thương hiệu và các thẻ chính sách hỗ trợ hiển thị trên trang chủ.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalType(null)}
                style={{ border: 0, background: "#f1f5f9", borderRadius: "50%", width: 34, height: 34, cursor: "pointer", fontSize: 16, fontWeight: 700, color: "#64748b" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {/* PHẦN 1: GIỚI THIỆU */}
              <div style={{ background: "#f8fafc", padding: 18, borderRadius: 12, border: "1px solid #e2e8f0" }}>
                <h4 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 800, color: "#1e293b", display: "flex", alignItems: "center", gap: 8 }}>
                  <span>📌 1. Phần Giới thiệu (Intro Section)</span>
                </h4>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                      Tiêu đề giới thiệu
                    </label>
                    <input
                      className="input"
                      style={{ width: "100%", padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13 }}
                      placeholder="Ví dụ: Thuê xe chủ động cho mọi chuyến đi"
                      value={editingAbout.title}
                      onChange={(e) => setEditingAbout({ ...editingAbout, title: e.target.value })}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                      Đoạn văn bản giới thiệu về Vi Vu Bike
                    </label>
                    <textarea
                      className="input"
                      rows={3}
                      style={{ width: "100%", padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13, resize: "vertical" }}
                      placeholder="Nhập nội dung giới thiệu chi tiết..."
                      value={editingAbout.introText}
                      onChange={(e) => setEditingAbout({ ...editingAbout, introText: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* PHẦN 2: CHÍNH SÁCH HỖ TRỢ */}
              <div style={{ background: "#f8fafc", padding: 18, borderRadius: 12, border: "1px solid #e2e8f0" }}>
                <h4 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 800, color: "#1e293b", display: "flex", alignItems: "center", gap: 8 }}>
                  <span>🛡️ 2. Khối Chính sách hỗ trợ (Policy Section)</span>
                </h4>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                      Tiêu đề phần chính sách
                    </label>
                    <input
                      className="input"
                      style={{ width: "100%", padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13 }}
                      placeholder="Ví dụ: Rõ ràng trước khi bạn bắt đầu chuyến đi"
                      value={editingPolicies.heading}
                      onChange={(e) => setEditingPolicies({ ...editingPolicies, heading: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                      Mô tả ngắn phần chính sách
                    </label>
                    <input
                      className="input"
                      style={{ width: "100%", padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13 }}
                      placeholder="Ví dụ: Hỗ trợ 24/7 qua hotline, tư vấn lịch trình..."
                      value={editingPolicies.subheading}
                      onChange={(e) => setEditingPolicies({ ...editingPolicies, subheading: e.target.value })}
                    />
                  </div>
                </div>

                {/* Danh sách thẻ chính sách */}
                <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: "#334155", marginBottom: 8 }}>
                  Danh sách các thẻ chính sách hỗ trợ ({editingPolicies.items.length})
                </label>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {editingPolicies.items.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      style={{
                        background: "#fff",
                        border: "1px solid #e2e8f0",
                        borderRadius: 10,
                        padding: "14px 16px",
                        position: "relative",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ fontWeight: 800, fontSize: 12, color: "#ea580c" }}>
                          THẺ CHÍNH SÁCH #{idx < 9 ? `0${idx + 1}` : idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const updatedItems = editingPolicies.items.filter((_, i) => i !== idx);
                            setEditingPolicies({ ...editingPolicies, items: updatedItems });
                          }}
                          style={{ border: 0, background: "transparent", color: "#ef4444", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                        >
                          ✕ Xóa
                        </button>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 2fr", gap: 10 }}>
                        <div>
                          <input
                            className="input"
                            style={{ width: "100%", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13, fontWeight: 700 }}
                            placeholder="Tiêu đề (VD: Thủ tục nhanh)"
                            value={item.title}
                            onChange={(e) => {
                              const newItems = [...editingPolicies.items];
                              newItems[idx].title = e.target.value;
                              setEditingPolicies({ ...editingPolicies, items: newItems });
                            }}
                          />
                        </div>
                        <div>
                          <input
                            className="input"
                            style={{ width: "100%", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13 }}
                            placeholder="Nội dung chi tiết chính sách..."
                            value={item.description}
                            onChange={(e) => {
                              const newItems = [...editingPolicies.items];
                              newItems[idx].description = e.target.value;
                              setEditingPolicies({ ...editingPolicies, items: newItems });
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => {
                      const newItem: HomePolicyItem = {
                        id: `p-${Date.now()}`,
                        title: "Chính sách mới",
                        description: "Nội dung chi tiết về chính sách hỗ trợ khách hàng.",
                      };
                      setEditingPolicies({
                        ...editingPolicies,
                        items: [...editingPolicies.items, newItem],
                      });
                    }}
                    style={{
                      padding: "10px",
                      background: "#fff",
                      border: "1px dashed #f86522",
                      color: "#ea580c",
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      marginTop: 4,
                    }}
                  >
                    + Thêm thẻ chính sách hỗ trợ
                  </button>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="form-actions mt-6" style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24, paddingTop: 16, borderTop: "1px solid #f1f5f9" }}>
              <button
                type="button"
                className="button secondary"
                onClick={() => setModalType(null)}
                disabled={saving}
                style={{ padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                Hủy
              </button>
              <button
                type="button"
                className="button"
                onClick={handleSaveAboutAndPolicies}
                disabled={saving}
                style={{ background: "#f86522", color: "#fff", padding: "10px 22px", borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: "pointer" }}
              >
                {saving ? "Đang lưu Firestore..." : "Lưu thay đổi"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: THÔNG TIN LIÊN HỆ, HOTLINE, ĐỊA CHỈ */}
      {/* ========================================================================= */}
      {modalType === "contact" && (
        <div
          className="modal-overlay"
          onClick={() => setModalType(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.7)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            className="modal-content panel form-card"
            style={{
              maxWidth: 640,
              width: "100%",
              maxHeight: "92vh",
              overflowY: "auto",
              background: "#fff",
              borderRadius: 16,
              boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
              padding: 28,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, borderBottom: "1px solid #f1f5f9", paddingBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#0f172a" }}>Thông tin liên hệ, hotline, địa chỉ</h3>
                <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>
                  Dữ liệu này hiển thị ở chân trang (Footer), hỗ trợ khách hàng và thông báo liên hệ.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalType(null)}
                style={{ border: 0, background: "#f1f5f9", borderRadius: "50%", width: 34, height: 34, cursor: "pointer", fontSize: 16, fontWeight: 700, color: "#64748b" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 5 }}>
                    Số điện thoại Hotline
                  </label>
                  <input
                    className="input"
                    style={{ width: "100%", padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13 }}
                    placeholder="Ví dụ: 0900 123 456"
                    value={editingContact.hotline}
                    onChange={(e) => setEditingContact({ ...editingContact, hotline: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 5 }}>
                    Email hỗ trợ
                  </label>
                  <input
                    className="input"
                    type="email"
                    style={{ width: "100%", padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13 }}
                    placeholder="Ví dụ: support@vivubike.vn"
                    value={editingContact.email}
                    onChange={(e) => setEditingContact({ ...editingContact, email: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 5 }}>
                  Địa chỉ cơ sở chính
                </label>
                <input
                  className="input"
                  style={{ width: "100%", padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13 }}
                  placeholder="Ví dụ: 96A Trần Phú, Hà Đông, Hà Nội"
                  value={editingContact.address}
                  onChange={(e) => setEditingContact({ ...editingContact, address: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 5 }}>
                  Giờ làm việc / Thời gian mở cửa hỗ trợ
                </label>
                <input
                  className="input"
                  style={{ width: "100%", padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13 }}
                  placeholder="Ví dụ: 07:00 - 21:00 hàng ngày"
                  value={editingContact.workingHours}
                  onChange={(e) => setEditingContact({ ...editingContact, workingHours: e.target.value })}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 5 }}>
                    Link Facebook
                  </label>
                  <input
                    className="input"
                    style={{ width: "100%", padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13 }}
                    placeholder="Ví dụ: https://facebook.com/vivubike"
                    value={editingContact.socialLinks.facebook}
                    onChange={(e) => setEditingContact({
                      ...editingContact,
                      socialLinks: { ...editingContact.socialLinks, facebook: e.target.value }
                    })}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 5 }}>
                    Link Zalo
                  </label>
                  <input
                    className="input"
                    style={{ width: "100%", padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13 }}
                    placeholder="Ví dụ: https://zalo.me/0900123456"
                    value={editingContact.socialLinks.zalo}
                    onChange={(e) => setEditingContact({
                      ...editingContact,
                      socialLinks: { ...editingContact.socialLinks, zalo: e.target.value }
                    })}
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="form-actions mt-6" style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24, paddingTop: 16, borderTop: "1px solid #f1f5f9" }}>
              <button
                type="button"
                className="button secondary"
                onClick={() => setModalType(null)}
                disabled={saving}
                style={{ padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                Hủy
              </button>
              <button
                type="button"
                className="button"
                onClick={handleSaveContact}
                disabled={saving}
                style={{ background: "#f86522", color: "#fff", padding: "10px 22px", borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: "pointer" }}
              >
                {saving ? "Đang lưu Firestore..." : "Lưu thay đổi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
