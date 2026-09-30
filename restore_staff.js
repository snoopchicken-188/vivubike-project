const fs = require("fs");

let content = fs.readFileSync("app/admin/page.tsx", "utf-8");

const missingTable = `
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
                            : "Chưa tìm thấy document users nào có role là staff. Kiểm tra lại UID và trường role trong Firestore."}
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
`;

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
      )}
`;

const targetInsert = `    </>
  );
}
function Content({ notify }: { notify: (message: string) => void }) {`;

// We just append missingTable + modals right before the targetInsert
// Wait, currently in page.tsx there is:
//       )}
//       {editingStaff && (
//         <div className="modal-overlay">
//           ...
//       )}
//       {deletingStaff && ( ... )}
//       {roleStaff && ( ... )}
//     </>
//   );
// }
// function Content ...
// Wait! Let me just find `</section>` (the one after `</p>\n          </div>\n        </section>\n      )}`)
// and replace everything from that `</section>` to `function Content`

// Let's look for loadError section end:
const loadErrorEndRegex = /<p>\{loadError\}<\/p>\n          <\/div>\n        <\/section>\n      \)\}/;

const match = content.match(loadErrorEndRegex);
if (match) {
  const index = match.index + match[0].length;
  // everything from `index` up to `function Content` needs to be replaced with our clean block!
  const contentIdx = content.indexOf("function Content(");
  
  const cleanBlock = "\n" + missingTable + "\n" + modals + "\n    </>\n  );\n}\n";
  
  content = content.substring(0, index) + cleanBlock + content.substring(contentIdx);
  fs.writeFileSync("app/admin/page.tsx", content);
  console.log("Reconstructed Staff completely!");
} else {
  console.log("Failed to match loadError block end");
}

