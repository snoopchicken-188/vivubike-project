const fs = require("fs");

let content = fs.readFileSync("app/admin/page.tsx", "utf-8");

// Convert to LF
content = content.replace(/\r\n/g, "\n");

// 1. Bring back notify prop in Staff render
content = content.replace(
  `{view === "staff" && <Staff />}`,
  `{view === "staff" && <Staff notify={notify} />}`
);

// 2. Change Staff definition to receive notify
content = content.replace(
  `function Staff() {
  const [items, setItems] = useState<
    { id: string; fullName: string; email: string; phone: string }[]
  >([]);
  const [keyword, setKeyword] = useState("");
  const [loadError, setLoadError] = useState("");`,
  `function Staff({ notify }: { notify: (message: string) => void }) {
  const [items, setItems] = useState<
    { id: string; fullName: string; email: string; phone: string }[]
  >([]);
  const [keyword, setKeyword] = useState("");
  const [loadError, setLoadError] = useState("");
  const [editingStaff, setEditingStaff] = useState<{ id: string; fullName: string; phone: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingStaff, setDeletingStaff] = useState<{ id: string; fullName: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
  };`
);

// 3. Update table headers
content = content.replace(
  `            <tr>
              <th>Nhân viên</th>
              <th>Email</th>
              <th>Số điện thoại</th>
            </tr>`,
  `            <tr>
              <th>Nhân viên</th>
              <th>Email</th>
              <th>Số điện thoại</th>
              <th style={{ textAlign: "right" }}>Thao tác</th>
            </tr>`
);

// 4. Update table rows
content = content.replace(
  /                <tr key=\{item\.id\}>\n                  <td>\n                    <b>\{item\.fullName\}<\/b>\n                  <\/td>\n                  <td>\{item\.email \|\| "Chưa cập nhật"\}<\/td>\n                  <td>\{item\.phone\}<\/td>\n                <\/tr>/g,
  `                <tr key={item.id}>
                  <td>
                    <b>{item.fullName}</b>
                  </td>
                  <td>{item.email || "Chưa cập nhật"}</td>
                  <td>{item.phone}</td>
                  <td style={{ textAlign: "right" }}>
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
                </tr>`
);

// 5. Update colSpan
content = content.replace(
  `                  <td colSpan={3}>`,
  `                  <td colSpan={4}>`
);

// 6. Add Modals before closing fragment
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
                style={{ background: "#c73a22" }}
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
  `          </tbody>
        </table>
      </section>
    </>`,
  `          </tbody>
        </table>
      </section>
${modals}
    </>`
);

// 7. Add modal styles if not exist
if (!content.includes(".modal-overlay")) {
  content = content.replace(
    `      <style jsx global>{\``,
    `      <style jsx global>{\`
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.4);
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .modal-content {
          width: 100%;
          max-width: 480px;
          background: #fff;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
          animation: slideIn 0.2s ease-out;
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
`
  );
}

fs.writeFileSync("app/admin/page.tsx", content);
