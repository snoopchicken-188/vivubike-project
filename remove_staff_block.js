const fs = require("fs");

let content = fs.readFileSync("app/admin/page.tsx", "utf-8");
content = content.replace(/\r\n/g, "\n");

// 1. Remove state
const stateRegex = /  \/\/ Blocking State\n  const \[blockingStaff, setBlockingStaff\] = useState<\{ id: string; fullName: string; isBlocked: boolean \} \| null>\(null\);\n  const \[isProcessingBlock, setIsProcessingBlock\] = useState\(false\);\n/;
content = content.replace(stateRegex, "");

// 2. Remove handleToggleBlock
const toggleRegex = /  const handleToggleBlock = async \(\) => \{\n    if \(!blockingStaff\) return;\n    setIsProcessingBlock\(true\);\n    try \{\n      await updateDoc\(doc\(db, "users", blockingStaff\.id\), \{\n        isBlocked: !blockingStaff\.isBlocked,\n      \}\);\n      notify\(blockingStaff\.isBlocked \? "Đã mở khóa nhân viên\." : "Đã khóa nhân viên\."\);\n      setBlockingStaff\(null\);\n    \} catch \(err\) \{\n      notify\("Lỗi khi thay đổi trạng thái tài khoản\."\);\n    \} finally \{\n      setIsProcessingBlock\(false\);\n    \}\n  \};\n/;
content = content.replace(toggleRegex, "");

// 3. Remove button
const buttonRegex = /                    <button\n                      className="link-button"\n                      style=\{\{ marginRight: 10, color: item\.isBlocked \? "#059669" : "#dc2626", fontWeight: 500 \}\}\n                      onClick=\{\(\) => setBlockingStaff\(item\)\}\n                    >\n                      \{item\.isBlocked \? "Mở khóa" : "Khóa"\}\n                    <\/button>\n/;
content = content.replace(buttonRegex, "");

// 4. Remove modal
const modalRegex = /      \{blockingStaff && \([\s\S]*?\{isProcessingBlock \? "Đang xử lý\.\.\." : blockingStaff\.isBlocked \? "Mở khóa" : "Khóa tài khoản"\}\n              <\/button>\n            <\/div>\n          <\/div>\n        <\/div>\n      \)\}\n\n/;
content = content.replace(modalRegex, "");

fs.writeFileSync("app/admin/page.tsx", content);
console.log("Successfully removed Lock/Unlock from Staff component.");
