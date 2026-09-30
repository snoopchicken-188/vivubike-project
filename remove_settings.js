const fs = require("fs");

let content = fs.readFileSync("app/admin/page.tsx", "utf-8");
content = content.replace(/\r\n/g, "\n");

// 1. Remove from View type
content = content.replace(/  \| "settings";/g, ";");

// 2. Remove from menu array
content = content.replace(/  \{ id: "settings", label: "Cài đặt", icon: "⚙" \},\n/g, "");

// 3. Remove from titles record
const titlesRegex = /  settings: \{\n    eyebrow: "CẤU HÌNH",\n    title: "Cài đặt",\n    description: "Thiết lập chung cho hệ thống thuê xe\.",\n  \},\n/;
content = content.replace(titlesRegex, "");

// 4. Remove from page body
content = content.replace(/          \{view === "settings" && <Settings notify=\{notify\} \/>\}\n/g, "");

// 5. Remove the Settings component
const settingsStart = content.indexOf("function Settings({ notify }");
if (settingsStart !== -1) {
  content = content.substring(0, settingsStart);
}

fs.writeFileSync("app/admin/page.tsx", content);
console.log("Successfully removed Settings feature.");
