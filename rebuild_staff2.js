const fs = require("fs");

let content = fs.readFileSync("app/admin/page.tsx", "utf-8");
content = content.replace(/\r\n/g, "\n");

const newStaffComponent = `function Staff({ notify }: { notify: (message: string) => void }) {
  const [items, setItems] = useState<
    { id: string; fullName: string; email: string; phone: string; role: string }[]
  >([]);
  const [keyword, setKeyword] = useState("");
  const [loadError, setLoadError] = useState("");
  const [editingStaff, setEditingStaff] = useState<{ id: string; fullName: string; phone: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingStaff, setDeletingStaff] = useState<{ id: string; fullName: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [roleStaff, setRoleStaff] = useState<{ id: string; fullName: string; email: string; role: string } | null>(null);
  const [isChangingRole, setIsChangingRole] = useState(false);

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

  return (
    <>
      <div className="view-head">
        <div>
          <h2>Nhân viên vận hành</h2>
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
            <h3>Không thể tải danh sách Staff</h3>
            <p>{loadError}</p>
          </div>
        </section>
      )}
      <section className="panel table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nhân viên</th>
              <th>Email</th>
              <th>Số điện thoại</th>
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
                  <td style={{ textAlign: "right" }}>
                    <button
                      className="link-button"
                      style={{ marginRight: 10, color: "#4f46e5", fontWeight: 500, fontFamily: "sans-serif" }}
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
                  <td colSpan={4}>
                    <div className="empty-state">
                      <span className="empty-icon">♧</span>
                      <div>
                        <h3>
                          {items.length
                            ? "Không tìm thấy nhân viên"
                            : "Chưa có nhân viên"}
                        </h3>
                        <p>
                          {items.length
                            ? "Thử lại với tên hoặc email khác."
                            : "Chưa tìm thấy document users nào có role là staff. Kiểm tra lại role trong Firestore."}
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
                    <option value="staff">Nhân viên (staff)</option>
                    <option value="manager">Quản lý (manager)</option>
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
`;

const startIdx = content.indexOf("function Staff({ notify }: { notify: (message: string) => void }) {");
const startIdx2 = content.indexOf("function Staff() {");

const start = startIdx !== -1 ? startIdx : startIdx2;
const endIdx = content.indexOf("function Content({ notify }: { notify: (message: string) => void }) {");

if (start !== -1 && endIdx !== -1) {
  content = content.substring(0, start) + newStaffComponent + "\n" + content.substring(endIdx);
  fs.writeFileSync("app/admin/page.tsx", content);
  console.log("Successfully replaced Staff component with pristine version.");
} else {
  console.log("Could not find start or end index.");
}
