const fs = require("fs");

let content = fs.readFileSync("app/admin/page.tsx", "utf-8");
content = content.replace(/\r\n/g, "\n");

// 1. Remove the modals from Customers (from line 1060 up to the end of Customers which is 1181)
// It's easier to find the text to remove:
const wrongModalsBlock = `
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
                style={{ background: "#c73a22" }}
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? "Đang xóa..." : "Xóa nhân viên"}
              </button>
            </div>
          </div>
        </div>
      )}`;

const idxWrong = content.indexOf(wrongModalsBlock);
if (idxWrong !== -1) {
  content = content.replace(wrongModalsBlock, "");
} else {
  console.log("Could not find wrong modals block to remove");
}

// 2. Put the modals right before function Content
const targetInsert = `  );\n}\nfunction Content({ notify }: { notify: (message: string) => void }) {`;
const idxInsert = content.indexOf(targetInsert);
if (idxInsert !== -1) {
  content = content.substring(0, idxInsert) + wrongModalsBlock + "\n" + content.substring(idxInsert);
} else {
  console.log("Could not find function Content to insert before");
}

fs.writeFileSync("app/admin/page.tsx", content);
