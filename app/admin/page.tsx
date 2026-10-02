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

  setDoc,

} from "firebase/firestore";

import { onAuthStateChanged, signOut } from "firebase/auth";

import { auth, db } from "../../lib/firebase";



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

          {view === "overview" && <Overview onChangeView={changeView} />}

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



function Overview({

  onChangeView,

}: {

  onChangeView: (view: View) => void;

}) {

  return (

    <>

      <section className="section-grid">

        <div className="panel admin-review">

          <span className="review-label">QUẢN TRỊ TÀI KHOẢN</span>

          <h3>Quản lý người dùng và nhân sự</h3>

          <p>

            Admin cấp tài khoản, khóa/mở khóa và phân quyền. Staff là người duyệt

            hồ sơ xác minh cuối cùng; Admin không duyệt giấy tờ thuê xe.

          </p>

          <div className="review-actions">

            <button

              className="button secondary"

              onClick={() => onChangeView("staff")}

            >

              Quản lý nhân sự

            </button>

          </div>

        </div>

      </section>

    </>

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

      await updateDoc(doc(db, "users", blockingUser.id), {

        isBlocked: !blockingUser.isBlocked,

      });

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

    { id: string; fullName: string; email: string; phone: string; role: string; isBlocked: boolean }[]

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

                isBlocked: Boolean(data.isBlocked),

              };

            })

            .filter((item) => ["staff", "business_manager"].includes(item.role)),

        );

      },

      () =>

        setLoadError(

          "Admin chưa có quyền đọc danh sách nhân sự trong Firestore.",

        ),

    );

  }, []);



  const visible = items.filter((item) =>

    (item.fullName + " " + item.email)

      .toLowerCase()

      .includes(keyword.toLowerCase()),

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

      const token = await auth.currentUser?.getIdToken();

      if (!token) {

        throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");

      }

      const res = await fetch("/api/admin/create-user", {

        method: "POST",

        headers: {

          "Content-Type": "application/json",

          Authorization: `Bearer ${token}`,

        },

        body: JSON.stringify(createForm),

      });

      const data = await res.json();

      if (!res.ok) {

        throw new Error(data.error || "Có lỗi xảy ra");

      }

      notify("Cấp tài khoản thành công!");

      setIsCreating(false);

      setCreateForm({ fullName: "", email: "", phone: "", password: "", role: "staff" });

    } catch (err: any) {

      setCreateError(err.message);

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

                    {item.role === "business_manager"

                      ? "Quản lý kinh doanh"

                      : "Nhân viên vận hành"}

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

            {createError && <div style={{ color: "red", marginBottom: 10 }}>{createError}</div>}

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



  const [slides, setSlides] = useState<any[]>([]);

  const [about, setAbout] = useState({ introText: "", fullDescription: "", policies: [] as string[] });

  const [contact, setContact] = useState({ hotline: "", email: "", address: "", workingHours: "", socialLinks: { facebook: "", zalo: "" } });



  useEffect(() => {

    async function loadData() {

      try {

        const docSnap = await getDoc(doc(db, "site_settings", "homepage"));

        if (docSnap.exists()) {

          const data = docSnap.data();

          if (data.slides) setSlides(data.slides);

          if (data.about) {

            setAbout({

              introText: data.about.introText || "",

              fullDescription: data.about.fullDescription || "",

              policies: data.about.policies || []

            });

          }

          if (data.contact) {

            setContact({

              hotline: data.contact.hotline || "",

              email: data.contact.email || "",

              address: data.contact.address || "",

              workingHours: data.contact.workingHours || "",

              socialLinks: data.contact.socialLinks || { facebook: "", zalo: "" }

            });

          }

        }

      } catch (err) {

        notify("Lỗi tải dữ liệu trang chủ.");

      } finally {

        setLoadingData(false);

      }

    }

    loadData();

  }, [notify]);



  const handleSave = async (section: "slides" | "about" | "contact", data: any) => {

    setSaving(true);

    try {

      await setDoc(doc(db, "site_settings", "homepage"), {

        [section]: data

      }, { merge: true });

      notify("Đã lưu nội dung thành công!");

      setModalType(null);

    } catch (err) {

      notify("Có lỗi khi lưu dữ liệu.");

    } finally {

      setSaving(false);

    }

  };



  if (loadingData) return <div className="p-8 text-center text-gray-500">Đang tải cấu hình...</div>;



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

            <button className="link-button" onClick={() => setModalType("slides")}>Chỉnh sửa</button>

          </li>

          <li>

            <span>Giới thiệu và chính sách hỗ trợ</span>

            <button className="link-button" onClick={() => setModalType("about")}>Chỉnh sửa</button>

          </li>

          <li>

            <span>Thông tin liên hệ, hotline, địa chỉ</span>

            <button className="link-button" onClick={() => setModalType("contact")}>Chỉnh sửa</button>

          </li>

        </ul>

      </section>



      {/* MODAL: SLIDES */}

      {modalType === "slides" && (

        <div className="modal-overlay">

          <div className="modal-content panel form-card" style={{ maxWidth: 800 }}>

            <h3>Chỉnh sửa Slide</h3>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">

              {slides.map((s, i) => (

                <div key={s.id || i} className="p-4 border border-gray-200 rounded-md space-y-3 relative">

                  <button type="button" className="absolute top-2 right-2 text-red-500" onClick={() => setSlides(slides.filter((_, idx) => idx !== i))}>Xóa</button>

                  <div>

                    <label>Tiêu đề (Title)</label>

                    <input className="input" value={s.title || ""} onChange={(e) => { const newS = [...slides]; newS[i].title = e.target.value; setSlides(newS); }} />

                  </div>

                  <div>

                    <label>Mô tả (Subtitle)</label>

                    <input className="input" value={s.subtitle || ""} onChange={(e) => { const newS = [...slides]; newS[i].subtitle = e.target.value; setSlides(newS); }} />

                  </div>

                  <div>

                    <label>URL Ảnh</label>

                    <input className="input" value={s.imageUrl || ""} onChange={(e) => { const newS = [...slides]; newS[i].imageUrl = e.target.value; setSlides(newS); }} />

                  </div>

                  <div>

                    <label>Đường dẫn nút (Link CTA)</label>

                    <input className="input" value={s.link || ""} onChange={(e) => { const newS = [...slides]; newS[i].link = e.target.value; setSlides(newS); }} />

                  </div>

                </div>

              ))}

              <button type="button" className="button outline" onClick={() => setSlides([...slides, { id: Date.now().toString(), title: "", subtitle: "", imageUrl: "", link: "" }])}>+ Thêm Slide</button>

            </div>

            <div className="form-actions mt-6">

              <button className="button secondary" onClick={() => setModalType(null)} disabled={saving}>Hủy</button>

              <button className="button primary" onClick={() => handleSave("slides", slides)} disabled={saving}>{saving ? "Đang lưu..." : "Lưu thay đổi"}</button>

            </div>

          </div>

        </div>

      )}



      {/* MODAL: ABOUT & POLICIES */}

      {modalType === "about" && (

        <div className="modal-overlay">

          <div className="modal-content panel form-card" style={{ maxWidth: 800 }}>

            <h3>Giới thiệu & Chính sách hỗ trợ</h3>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">

              <div>

                <label>Văn bản giới thiệu (Intro)</label>

                <textarea className="input" rows={3} value={about.introText} onChange={(e) => setAbout({ ...about, introText: e.target.value })} />

              </div>

              <div>

                <label>Mô tả đầy đủ (Description)</label>

                <textarea className="input" rows={5} value={about.fullDescription} onChange={(e) => setAbout({ ...about, fullDescription: e.target.value })} />

              </div>

              <div>

                <label className="font-bold block mb-2">Chính sách / Cam kết</label>

                {about.policies.map((p, i) => (

                  <div key={i} className="flex gap-2 mb-2">

                    <input className="input flex-1" value={p} onChange={(e) => { const newP = [...about.policies]; newP[i] = e.target.value; setAbout({ ...about, policies: newP }); }} />

                    <button type="button" className="button secondary text-red-500" onClick={() => setAbout({ ...about, policies: about.policies.filter((_, idx) => idx !== i) })}>X</button>

                  </div>

                ))}

                <button type="button" className="button outline text-sm mt-2" onClick={() => setAbout({ ...about, policies: [...about.policies, ""] })}>+ Thêm chính sách</button>

              </div>

            </div>

            <div className="form-actions mt-6">

              <button className="button secondary" onClick={() => setModalType(null)} disabled={saving}>Hủy</button>

              <button className="button primary" onClick={() => handleSave("about", about)} disabled={saving}>{saving ? "Đang lưu..." : "Lưu thay đổi"}</button>

            </div>

          </div>

        </div>

      )}



      {/* MODAL: CONTACT */}

      {modalType === "contact" && (

        <div className="modal-overlay">

          <div className="modal-content panel form-card" style={{ maxWidth: 600 }}>

            <h3>Thông tin liên hệ</h3>

            <div className="space-y-4">

              <div>

                <label>Hotline</label>

                <input className="input" value={contact.hotline} onChange={(e) => setContact({ ...contact, hotline: e.target.value })} />

              </div>

              <div>

                <label>Email</label>

                <input className="input" type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />

              </div>

              <div>

                <label>Địa chỉ</label>

                <input className="input" value={contact.address} onChange={(e) => setContact({ ...contact, address: e.target.value })} />

              </div>

              <div>

                <label>Thời gian làm việc</label>

                <input className="input" value={contact.workingHours} onChange={(e) => setContact({ ...contact, workingHours: e.target.value })} />

              </div>

              <div className="grid grid-cols-2 gap-4">

                <div>

                  <label>Link Facebook</label>

                  <input className="input" value={contact.socialLinks.facebook} onChange={(e) => setContact({ ...contact, socialLinks: { ...contact.socialLinks, facebook: e.target.value } })} />

                </div>

                <div>

                  <label>Link Zalo</label>

                  <input className="input" value={contact.socialLinks.zalo} onChange={(e) => setContact({ ...contact, socialLinks: { ...contact.socialLinks, zalo: e.target.value } })} />

                </div>

              </div>

            </div>

            <div className="form-actions mt-6">

              <button className="button secondary" onClick={() => setModalType(null)} disabled={saving}>Hủy</button>

              <button className="button primary" onClick={() => handleSave("contact", contact)} disabled={saving}>{saving ? "Đang lưu..." : "Lưu thay đổi"}</button>

            </div>

          </div>

        </div>

      )}

    </>

  );

}
