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
`;

content = content.replace(
  `      </section>\n    </>\n  );\n}\nfunction Content(`,
  `      </section>\n${modals}\n    </>\n  );\n}\nfunction Content(`
);

fs.writeFileSync("app/admin/page.tsx", content);
