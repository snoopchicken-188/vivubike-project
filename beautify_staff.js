const fs = require("fs");

let content = fs.readFileSync("app/admin/page.tsx", "utf-8");
content = content.replace(/\r\n/g, "\n");

const targetStaffTable = `          <thead>
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
            ) : (`;

const replaceStaffTable = `          <thead>
            <tr>
              <th>Nhân viên</th>
              <th>Vai trò</th>
              <th>Số điện thoại</th>
              <th style={{ textAlign: "right" }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {visible.length ? (
              visible.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{
                        display: "flex", alignItems: "center", justifyContent: "center",
                        width: "36px", height: "36px", borderRadius: "50%",
                        background: "#e0e7ff", color: "#4f46e5", fontWeight: "bold", fontSize: "14px"
                      }}>
                        {item.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: "#111827" }}>{item.fullName}</div>
                        <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>{item.email || "Chưa cập nhật"}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span style={{
                      display: "inline-block", padding: "4px 10px", borderRadius: "9999px",
                      background: "#dbeafe", color: "#1e40af", fontSize: "12px", fontWeight: 600
                    }}>
                      Nhân viên
                    </span>
                  </td>
                  <td>{item.phone}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "16px" }}>
                      <button
                        className="link-button"
                        style={{ color: "#4f46e5", fontWeight: 500 }}
                        onClick={() => setRoleStaff(item as any)}
                      >
                        Đổi vai trò
                      </button>
                      <button
                        className="link-button"
                        style={{ color: "#2b78e4", fontWeight: 500 }}
                        onClick={() => setEditingStaff(item)}
                      >
                        Sửa
                      </button>
                      <button
                        className="danger-button"
                        style={{ fontWeight: 500 }}
                        onClick={() => setDeletingStaff(item)}
                      >
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (`;

content = content.replace(targetStaffTable, replaceStaffTable);

fs.writeFileSync("app/admin/page.tsx", content);
console.log("Successfully beautified Staff table.");
