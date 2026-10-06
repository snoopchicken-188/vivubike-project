const fs = require('fs');
let content = fs.readFileSync('app/customer/page.tsx', 'utf-8');
content = content.replace(/\r\n/g, '\n');

// 1. Update BookingStatus and add mapStatus
const oldStatusType = `type BookingStatus =
  "Chờ xác nhận" | "Đã xác nhận" | "Đang thuê" | "Đã hoàn thành";`;

const newStatusType = `type BookingStatus =
  "Chờ xác nhận" | "Đã xác nhận" | "Đang thuê" | "Đã hoàn thành" | "Đã hủy";

const mapStatus = (status: string): BookingStatus => {
  const s = status.toLowerCase();
  if (s === "pending" || s === "waiting_confirmation" || s === "pending_confirmation" || s === "chờ xác nhận") return "Chờ xác nhận";
  if (s === "ready_for_pickup" || s === "confirmed" || s === "đã xác nhận") return "Đã xác nhận";
  if (s === "in_progress" || s === "renting" || s === "đang thuê") return "Đang thuê";
  if (s === "completed" || s === "đã hoàn thành") return "Đã hoàn thành";
  if (s === "cancelled" || s === "đã hủy") return "Đã hủy";
  return "Chờ xác nhận";
};`;

content = content.replace(oldStatusType, newStatusType);

// 2. Update statusClass
const oldStatusClass = `const statusClass = (status: string) =>
  status === "Đã hoàn thành"
    ? "done"
    : status === "Đang thuê"
      ? "active"
      : status === "Đã xác nhận"
        ? "confirmed"
        : "pending";`;

const newStatusClass = `const statusClass = (status: string) => {
  if (status === "Đã hoàn thành") return "done";
  if (status === "Đang thuê") return "active";
  if (status === "Đã xác nhận") return "confirmed";
  if (status === "Đã hủy") return "cancelled";
  return "pending";
};`;

content = content.replace(oldStatusClass, newStatusClass);

// 3. Update the mapping in useEffect
const oldMapping = `status: String(data.status || "Chờ xác nhận") as BookingStatus,`;
const newMapping = `status: mapStatus(String(data.status || "Chờ xác nhận")),`;
content = content.replace(oldMapping, newMapping);

// 4. Add CSS for .tag.cancelled
const oldCSS = `.tag.done {
          background: #edf0f2;
          color: #5b6268;
        }`;
const newCSS = `.tag.done {
          background: #edf0f2;
          color: #5b6268;
        }
        .tag.cancelled {
          background: #f1f3f5;
          color: #dc3545;
        }`;
content = content.replace(oldCSS, newCSS);

// Write changes
fs.writeFileSync('app/customer/page.tsx', content, 'utf-8');
console.log('Status mapped successfully');
