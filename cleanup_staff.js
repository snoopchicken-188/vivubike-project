const fs = require("fs");

let content = fs.readFileSync("app/admin/page.tsx", "utf-8");
content = content.replace(/\r\n/g, "\n");

let idx1 = content.indexOf("function Staff() {\n");
let idx2 = content.indexOf("function Staff({ notify }");

if (idx1 !== -1 && idx2 !== -1 && idx1 < idx2) {
  content = content.substring(0, idx1) + content.substring(idx2);
  fs.writeFileSync("app/admin/page.tsx", content);
  console.log("Cleanup successful");
} else {
  console.log("Cleanup failed, indices:", idx1, idx2);
}
