const fs = require("fs");

let content = fs.readFileSync("app/admin/page.tsx", "utf-8");
content = content.replace(/\r\n/g, "\n");

// Regex to capture the entire modal block which starts with "      {editingStaff && (" and ends with the first instance of function Staff
const modalRegex = /      \{editingStaff && \([\s\S]*?\{deletingStaff && \([\s\S]*?<\/div>\n        <\/div>\n      \)\}/;

const match = content.match(modalRegex);
if (match) {
  const modalText = match[0];
  content = content.replace(modalText, "");
  
  // Insert before Content
  const insertTarget = `  );\n}\nfunction Content({ notify }: { notify: (message: string) => void }) {`;
  content = content.replace(insertTarget, modalText + "\n" + insertTarget);
  fs.writeFileSync("app/admin/page.tsx", content);
  console.log("Moved modals successfully!");
} else {
  console.log("Regex match failed");
}
