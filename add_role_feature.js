const fs = require("fs");

let content = fs.readFileSync("app/admin/page.tsx", "utf-8");

// Convert to LF
content = content.replace(/\r\n/g, "\n");

// 1. Update State generic to include role
content = content.replace(
  `  const [items, setItems] = useState<
    { id: string; fullName: string; email: string; phone: string }[]
  >([]);`,
  `  const [items, setItems] = useState<
    { id: string; fullName: string; email: string; phone: string; role: string }[]
  >([]);`
);

// 2. Add Role states and functions
const targetState = `  const [deletingStaff, setDeletingStaff] = useState<{ id: string; fullName: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);`;

const replaceState = `  const [deletingStaff, setDeletingStaff] = useState<{ id: string; fullName: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [roleStaff, setRoleStaff] = useState<{ id: string; fullName: string; email: string; role: string } | null>(null);
  const [isChangingRole, setIsChangingRole] = useState(false);`;

content = content.replace(targetState, replaceState);

const targetDelete = `  const handleDelete = async () => {
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
  };`;

const replaceDelete = `  const handleDelete = async () => {
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
  };`;

content = content.replace(targetDelete, replaceDelete);


// 3. Add Role Button
const targetButtons = `                    <button
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
                    </button>`;

const replaceButtons = `                    <button
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
                    </button>`;

content = content.replace(targetButtons, replaceButtons);


// 4. Add Role Modal
const roleModal = `
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
                <button type="submit" className="button" style={{ background: "#4f46e5" }} disabled={isChangingRole}>
                  {isChangingRole ? "Đang xử lý..." : "Cập nhật vai trò"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
`;

const targetModalInjection = `      {deletingStaff && (`;
content = content.replace(targetModalInjection, `${roleModal}\n      {deletingStaff && (`);


fs.writeFileSync("app/admin/page.tsx", content);
