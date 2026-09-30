const fs = require("fs");

let content = fs.readFileSync("app/admin/page.tsx", "utf-8");

// Convert to LF
content = content.replace(/\r\n/g, "\n");

const targetText = `          <p>
            Danh sách lấy trực tiếp từ các tài khoản có trường{" "}
            <b>role: "staff"</b> trong Firestore.
          </p>`;

content = content.replace(targetText, "");

fs.writeFileSync("app/admin/page.tsx", content);
