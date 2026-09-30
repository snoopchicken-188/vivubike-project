const fs = require("fs");

let content = fs.readFileSync("app/admin/page.tsx", "utf-8");
content = content.replace(/\r\n/g, "\n");

// Fix render block in AdminPage
const renderRegex = /          \{view === "overview" && \([\s\S]*?\{view === "customers" && <Customers \/>\}/;
const replaceRender = `          {view === "overview" && <Overview onChangeView={changeView} />}
          {view === "customers" && <Customers />}`;
content = content.replace(renderRegex, replaceRender);

// Fix Overview component
const overviewRegex = /function Overview\(\{[\s\S]*?function Customers\(\) \{/m;
const replaceOverview = `function Overview({
  onChangeView,
}: {
  onChangeView: (view: View) => void;
}) {
  return (
    <>
      <section className="section-grid">
        <div className="panel admin-review">
          <span className="review-label">KIỂM DUYỆT CUỐI</span>
          <h3>Hồ sơ Staff đã đề xuất: 0</h3>
          <p>
            Staff là người kiểm tra giấy tờ chính. Admin chỉ xem lại hồ sơ Staff
            đã đề xuất duyệt hoặc từ chối.
          </p>
          <div className="review-actions">
            <button
              className="button secondary"
              onClick={() => onChangeView("customers")}
            >
              Xem hồ sơ
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

function Customers() {`;
content = content.replace(overviewRegex, replaceOverview);

fs.writeFileSync("app/admin/page.tsx", content);
console.log("Fixed rendering and Overview component");
