const fs = require("fs");

let content = fs.readFileSync("app/admin/page.tsx", "utf-8");
content = content.replace(/\r\n/g, "\n");

const startStr = "function Vehicles({";
const endStr = "function Customers() {";

const startIdx = content.indexOf(startStr);
const endIdx = content.indexOf(endStr);

if (startIdx !== -1 && endIdx !== -1) {
  content = content.substring(0, startIdx) + content.substring(endIdx);
  fs.writeFileSync("app/admin/page.tsx", content);
  console.log("Successfully removed Vehicles, Pricing, Locations, and Bookings components.");
} else {
  console.log("Could not find boundaries.");
}
