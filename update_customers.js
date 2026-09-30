const fs = require("fs");

let content = fs.readFileSync("app/admin/page.tsx", "utf-8");
content = content.replace(/\r\n/g, "\n");

// 1. Update CustomerItem Type
const oldType = `type CustomerItem = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  verificationStatus: string;
  staffProposal: string;
};`;
const newType = `type CustomerItem = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  verificationStatus: string;
  isBlocked: boolean;
  role: string;
};`;
content = content.replace(oldType, newType);

// 2. Pass notify to Customers in AdminPage
const oldRender = `{view === "customers" && <Customers />}`;
const newRender = `{view === "customers" && <Customers notify={notify} />}`;
content = content.replace(oldRender, newRender);

// 3. Rewrite Customers component
const newCustomers = `function Customers({ notify }: { notify: (message: string) => void }) {
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
      staff_approved: "Chờ Admin duyệt",
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
                    <option value="staff">Nhân viên (staff)</option>
                    <option value="manager">Quản lý (manager)</option>
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
}`;

const startIndex = content.indexOf("function Customers() {");
const endIndex = content.indexOf("function Staff({ notify }");

if (startIndex !== -1 && endIndex !== -1) {
  content = content.substring(0, startIndex) + newCustomers + "\n" + content.substring(endIndex);
  fs.writeFileSync("app/admin/page.tsx", content);
  console.log("Successfully updated Customers component.");
} else {
  console.log("Could not find component boundaries.");
}
