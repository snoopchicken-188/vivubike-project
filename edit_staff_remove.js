const fs = require("fs");

let content = fs.readFileSync("app/admin/page.tsx", "utf-8");

// Convert to LF
content = content.replace(/\r\n/g, "\n");

// 1. Remove the button from Staff component
const targetButtonBlock = `        <div className="toolbar">
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
        </div>`;

const replaceButtonBlock = `        <div className="toolbar">
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Tìm tên hoặc email"
          />
        </div>`;

content = content.replace(targetButtonBlock, replaceButtonBlock);

// 2. Remove notify prop from Staff declaration
const targetDecl = `function Staff({ notify }: { notify: (message: string) => void }) {`;
const replaceDecl = `function Staff() {`;
content = content.replace(targetDecl, replaceDecl);

// 3. Remove notify prop from Staff rendering
const targetRender = `{view === "staff" && <Staff notify={notify} />}`;
const replaceRender = `{view === "staff" && <Staff />}`;
content = content.replace(targetRender, replaceRender);

fs.writeFileSync("app/admin/page.tsx", content);
