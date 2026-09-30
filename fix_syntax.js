const fs = require("fs");

let content = fs.readFileSync("app/admin/page.tsx", "utf-8");
content = content.replace(/\r\n/g, "\n");

const modals = `
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
                <button type="submit" className="button" style={{ background: "#4f46e5" }} disabled={isChangingRole}>
                  {isChangingRole ? "Đang xử lý..." : "Cập nhật vai trò"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}`;

// We know function Staff starts around line 1180, and ends before function Content.
// So we find "function Staff", then find the next "</section>" which belongs to Staff table,
// and replace everything from that "</section>" up to "function Content("
const staffIdx = content.indexOf("function Staff(");
if (staffIdx !== -1) {
  const sectionIdx = content.indexOf("      </section>", staffIdx);
  const contentIdx = content.indexOf("function Content(", sectionIdx);
  
  if (sectionIdx !== -1 && contentIdx !== -1) {
    const newEnd = `      </section>${modals}\n    </>\n  );\n}\n`;
    content = content.substring(0, sectionIdx) + newEnd + content.substring(contentIdx);
    fs.writeFileSync("app/admin/page.tsx", content);
    console.log("Fixed syntax error");
  } else {
    console.log("Failed to find section or Content");
  }
} else {
  console.log("Failed to find Staff");
}
