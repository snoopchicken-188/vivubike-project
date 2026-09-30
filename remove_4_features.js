const fs = require("fs");

let content = fs.readFileSync("app/admin/page.tsx", "utf-8");

// 1. Remove types Vehicle, LocationItem, PriceItem
content = content.replace(/type Vehicle = \{[\s\S]*?\};\n/g, "");
content = content.replace(/type LocationItem = \{[\s\S]*?\};\n/g, "");
content = content.replace(/type PriceItem = \{[\s\S]*?\};\n/g, "");

// 2. Update type View
const targetView = `type View =
  | "overview"
  | "vehicles"
  | "pricing"
  | "locations"
  | "bookings"
  | "customers"
  | "staff"
  | "content"
  | "settings";`;

const replaceView = `type View =
  | "overview"
  | "customers"
  | "staff"
  | "content"
  | "settings";`;

content = content.replace(targetView, replaceView);

// 3. Update menu
const targetMenu = `const menu: { id: View; label: string; icon: string; group?: string }[] = [
  { id: "overview", label: "Tổng quan", icon: "▦" },
  { id: "vehicles", label: "Quản lý xe", icon: "◈", group: "Vận hành" },
  { id: "pricing", label: "Bảng giá", icon: "₫" },
  { id: "locations", label: "Địa điểm nhận xe", icon: "⌖" },
  { id: "bookings", label: "Đơn thuê", icon: "▤", group: "Hệ thống" },
  { id: "customers", label: "Khách hàng", icon: "♙" },
  { id: "staff", label: "Nhân viên", icon: "♧" },
  { id: "content", label: "Nội dung trang chủ", icon: "✦", group: "Cấu hình" },
  { id: "settings", label: "Cài đặt", icon: "⚙" },
];`;

const replaceMenu = `const menu: { id: View; label: string; icon: string; group?: string }[] = [
  { id: "overview", label: "Tổng quan", icon: "▦" },
  { id: "customers", label: "Khách hàng", icon: "♙", group: "Người dùng" },
  { id: "staff", label: "Nhân viên", icon: "♧" },
  { id: "content", label: "Nội dung trang chủ", icon: "✦", group: "Cấu hình" },
  { id: "settings", label: "Cài đặt", icon: "⚙" },
];`;

content = content.replace(targetMenu, replaceMenu);

// 4. Update titles map (remove vehicles, pricing, locations, bookings)
content = content.replace(/  vehicles: \{[\s\S]*?  \},\n/g, "");
content = content.replace(/  pricing: \{[\s\S]*?  \},\n/g, "");
content = content.replace(/  locations: \{[\s\S]*?  \},\n/g, "");
content = content.replace(/  bookings: \{[\s\S]*?  \},\n/g, "");

// 5. Remove states and effects in AdminPage
content = content.replace(/  const \[vehicles, setVehicles\] = useState<Vehicle\[\]>\(\[\]\);\n/g, "");

const useEffectVehiclesRegex = /  useEffect\(\(\) => \{\n    return onSnapshot\(collection\(db, "vehicles"\)[\s\S]*?\}\);\n  \}, \[\]\);\n/;
content = content.replace(useEffectVehiclesRegex, "");


// 6. Remove view rendering
const targetRendering = `          {view === "overview" && <Overview onChangeView={changeView} />}
          {view === "vehicles" && (
            <Vehicles
              items={vehicles}
              notify={notify}
              onUpdate={() => {}}
            />
          )}
          {view === "pricing" && <Pricing notify={notify} />}
          {view === "locations" && <Locations notify={notify} />}
          {view === "bookings" && <Bookings notify={notify} />}
          {view === "customers" && <Customers />}`;

const replaceRendering = `          {view === "overview" && <Overview onChangeView={changeView} />}
          {view === "customers" && <Customers />}`;

content = content.replace(targetRendering, replaceRendering);

fs.writeFileSync("app/admin/page.tsx", content);
console.log("Successfully removed 4 features references from AdminPage");
