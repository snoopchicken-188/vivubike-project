const fs = require("fs");

let content = fs.readFileSync("app/admin/page.tsx", "utf-8");

// Convert to LF
content = content.replace(/\r\n/g, "\n");

content = content.replace(
  `            <tr>
              <th>Nhân viên</th>
              <th>Email</th>
              <th>Số điện thoại</th>
              <th>UID</th>
            </tr>`,
  `            <tr>
              <th>Nhân viên</th>
              <th>Email</th>
              <th>Số điện thoại</th>
            </tr>`
);

content = content.replace(
  `                <tr key={item.id}>
                  <td>
                    <b>{item.fullName}</b>
                  </td>
                  <td>{item.email || "Chưa cập nhật"}</td>
                  <td>{item.phone}</td>
                  <td>
                    <code>{item.id}</code>
                  </td>
                </tr>`,
  `                <tr key={item.id}>
                  <td>
                    <b>{item.fullName}</b>
                  </td>
                  <td>{item.email || "Chưa cập nhật"}</td>
                  <td>{item.phone}</td>
                </tr>`
);

content = content.replace(
  `                  <td colSpan={4}>
                    <div className="empty-state">
                      <span className="empty-icon">♧</span>`,
  `                  <td colSpan={3}>
                    <div className="empty-state">
                      <span className="empty-icon">♧</span>`
);

fs.writeFileSync("app/admin/page.tsx", content);
