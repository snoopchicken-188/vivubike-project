const fs = require("fs");

let content = fs.readFileSync("app/admin/page.tsx", "utf-8");

// Convert to LF to make regex and matching easier
content = content.replace(/\r\n/g, "\n");

content = content.replace(
  `function Staff({ notify }: { notify: (message: string) => void }) {
  const [items, setItems] = useState<
    { id: string; fullName: string; email: string; phone: string }[]
  >([]);
  const [loadError, setLoadError] = useState("");`,
  `function Staff({ notify }: { notify: (message: string) => void }) {
  const [items, setItems] = useState<
    { id: string; fullName: string; email: string; phone: string }[]
  >([]);
  const [keyword, setKeyword] = useState("");
  const [loadError, setLoadError] = useState("");

  const visible = items.filter((item) =>
    \`\${item.fullName} \${item.email}\`
      .toLowerCase()
      .includes(keyword.toLowerCase()),
  );`
);

content = content.replace(
  `      <div className="view-head">
        <div>
          <h2>Nhân viên vận hành</h2>
          <p>
            Danh sách lấy trực tiếp từ các tài khoản có trường{" "}
            <b>role: "staff"</b> trong Firestore.
          </p>
        </div>
        <button
          className="button"
          onClick={() =>
            notify(
              "Tạo Staff: đăng ký tài khoản trong Authentication, sau đó đặt role là staff trong Firestore.",
            )
          }
        >
          Hướng dẫn tạo Staff
        </button>
      </div>`,
  `      <div className="view-head">
        <div>
          <h2>Nhân viên vận hành</h2>
          <p>
            Danh sách lấy trực tiếp từ các tài khoản có trường{" "}
            <b>role: "staff"</b> trong Firestore.
          </p>
        </div>
        <div className="toolbar">
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Tìm tên hoặc email"
          />
          <button
            className="button"
            onClick={() =>
              notify(
                "Tạo Staff: đăng ký tài khoản trong Authentication, sau đó đặt role là staff trong Firestore.",
              )
            }
          >
            Hướng dẫn tạo Staff
          </button>
        </div>
      </div>`
);

content = content.replace(
  `      {items.length ? (
        <section className="panel table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nhân viên</th>
                <th>Email</th>
                <th>Số điện thoại</th>
                <th>UID</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <b>{item.fullName}</b>
                  </td>
                  <td>{item.email || "Chưa cập nhật"}</td>
                  <td>{item.phone}</td>
                  <td>
                    <code>{item.id}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : (
        !loadError && (
          <EmptyState
            title="Chưa có nhân viên"
            text="Chưa tìm thấy document users nào có role là staff. Kiểm tra lại UID và trường role trong Firestore."
          />
        )
      )}`,
  `      <section className="panel table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nhân viên</th>
              <th>Email</th>
              <th>Số điện thoại</th>
              <th>UID</th>
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
                  <td>
                    <code>{item.id}</code>
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
      </section>`
);

fs.writeFileSync("app/admin/page.tsx", content);
