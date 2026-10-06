const fs = require('fs');
let content = fs.readFileSync('app/customer/page.tsx', 'utf-8');
content = content.replace(/\r\n/g, '\n');

const cssOld = `        .table-filters {
          display: flex;
          gap: 8px;
        }
        .table-filters button {
          background: #fff;
          border: 1px solid #ddd;
          font-size: 12px;
          padding: 9px 12px;
        }
        .table-filters button.active {
          background: #171717;
          border-color: #171717;
          color: #fff;
        }`;

const cssNew = `        .booking-stepper-container {
          display: flex;
          align-items: center;
          gap: 24px;
          background: #fff;
          padding: 16px 24px;
          border: 1px solid #e4e7e9;
          margin-bottom: 24px;
          overflow-x: auto;
        }
        .all-btn {
          background: #f1f3f4;
          border: 1px solid #ddd;
          padding: 8px 16px;
          border-radius: 4px;
          font-weight: 600;
          font-size: 13px;
          color: #555;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.2s;
        }
        .all-btn.active, .all-btn:hover {
          background: #ea580c;
          border-color: #ea580c;
          color: #fff;
        }
        .stepper-wrapper {
          display: flex;
          align-items: flex-start;
          flex: 1;
          min-width: 500px;
        }
        .stepper-step {
          flex: 1;
          display: flex;
          flex-direction: column;
          cursor: pointer;
          position: relative;
        }
        .step-node {
          display: flex;
          align-items: center;
          margin-bottom: 8px;
        }
        .step-circle {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #f3f4f6;
          border: 2px solid #d1d5db;
          color: #6b7280;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
          z-index: 2;
          transition: all 0.2s;
        }
        .step-line {
          flex: 1;
          height: 2px;
          background: #e5e7eb;
          margin: 0 8px;
          transition: all 0.2s;
        }
        .stepper-step.active .step-circle {
          background: #ea580c;
          border-color: #ea580c;
          color: #fff;
          box-shadow: 0 0 0 4px rgba(234, 88, 12, 0.15);
        }
        .stepper-step.active .step-line {
          background: #ea580c;
        }
        .stepper-step:hover .step-circle {
          background: #fed7aa;
          color: #ea580c;
          border-color: #ea580c;
        }
        .step-label {
          font-size: 13px;
          color: #6b7280;
          font-weight: 500;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .stepper-step.active .step-label {
          color: #ea580c;
          font-weight: 800;
        }
        .step-count {
          font-size: 11px;
          color: #9ca3af;
          margin-left: 4px;
        }`;

content = content.replace(cssOld, cssNew);

content = content.replace(
`          .table-filters {
            overflow: auto;
            width: 100%;
          }`,
`          .booking-stepper-container {
            width: 100%;
          }`
);

const uiOld = `        <div className="table-filters">
          {filters.map((item) => (
            <button
              className={filter === item ? "active" : ""}
              key={item}
              onClick={() => setFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>`;
        
const uiNew = `      </div>
      <div className="booking-stepper-container">
        <button
          className={\`all-btn \${filter === "Tất cả" ? "active" : ""}\`}
          onClick={() => setFilter("Tất cả")}
        >
          Tất cả
        </button>
        <div className="stepper-wrapper">
          {["Chờ xác nhận", "Đã xác nhận", "Đang thuê", "Đã hoàn thành"].map((stepName, idx) => {
            const stepNum = idx + 1;
            const isActive = filter === stepName;
            // Get count for this step
            const count = data.filter((d) => d.status === stepName).length;
            
            return (
              <div
                key={stepName}
                className={\`stepper-step \${isActive ? "active" : ""}\`}
                onClick={() => setFilter(stepName)}
              >
                <div className="step-node">
                  <div className="step-circle">{stepNum}</div>
                  {idx < 3 && <div className="step-line" />}
                </div>
                <div className="step-label">
                  {stepName} {count > 0 && <span className="step-count">({count})</span>}
                </div>
              </div>
            );
          })}
        </div>`;
        
content = content.replace(uiOld, uiNew);

content = content.replace(
`        {view === "overview" && (
          <Overview
            onChangeView={setView}
            fullName={account.fullName}
            verificationStatus={account.verificationStatus}
          />
        )}`,
`        {view === "overview" && (
          <Overview
            onChangeView={setView}
            fullName={account.fullName}
            verificationStatus={account.verificationStatus}
            bookings={bookings}
          />
        )}`
);

const overviewOld = `function Overview({
  onChangeView,
  fullName,
  verificationStatus,
}: {
  onChangeView: (view: View) => void;
  fullName: string;
  verificationStatus: string;
}) {
  const verified = isVerified(verificationStatus);
  return (
    <div className="page">
      {!verified && (
        <div className="notice-box">
          <div className="notice-icon">!</div>
          <div>
            <h3>{verificationLabel(verificationStatus)}</h3>
            <p>Gửi CCCD/CMND và bằng lái để có thể gửi yêu cầu thuê xe.</p>
          </div>
          <button className="button" onClick={() => onChangeView("verify")}>
            Xác minh ngay
          </button>
        </div>
      )}
      <div className="overview-title">
        <h2>Chào {fullName},</h2>
        <p>
          Các số liệu dưới đây sẽ được cập nhật khi bạn có đơn thuê thực tế.
        </p>
      </div>
      <div className="stats">
        <article className="stat">
          <p>Đơn đang chờ</p>
          <b>0</b>
          <span>Chưa có dữ liệu đơn thuê</span>
        </article>
        <article className="stat">
          <p>Lượt thuê hoàn thành</p>
          <b>0</b>
          <span>Chưa có lượt thuê hoàn thành</span>
        </article>
        <article className="stat">
          <p>Trạng thái tài khoản</p>
          <b>{verificationLabel(verificationStatus)}</b>
          <span>
            {verified
              ? "Tài khoản đã đủ điều kiện thuê xe"
              : "Cập nhật từ hồ sơ xác minh"}
          </span>
        </article>
      </div>
      <section className="panel">
        <div className="panel-head">
          <h2>Đơn thuê gần nhất</h2>
          <button onClick={() => onChangeView("bookings")}>
            Xem đơn thuê →
          </button>
        </div>
        <div className="booking-preview">
          <div className="bike-round">
            <span>⌁</span>
          </div>
          <div>
            <b>Bạn chưa có đơn thuê nào</b>
            <small>Chọn xe để gửi yêu cầu thuê đầu tiên của bạn.</small>
          </div>
          <button className="button light" onClick={() => onChangeView("rent")}>
            Xem xe cho thuê
          </button>
        </div>
      </section>`;

const overviewNew = `function Overview({
  onChangeView,
  fullName,
  verificationStatus,
  bookings,
}: {
  onChangeView: (view: View) => void;
  fullName: string;
  verificationStatus: string;
  bookings: Booking[];
}) {
  const verified = isVerified(verificationStatus);

  const pendingCount = bookings.filter((b) => b.status === "Chờ xác nhận").length;
  const completedCount = bookings.filter((b) => b.status === "Đã hoàn thành").length;

  const getTimestamp = (value: unknown) => {
    const timestamp = value as { toDate?: () => Date } | undefined;
    const date = value instanceof Date ? value : typeof timestamp?.toDate === "function" ? timestamp.toDate() : null;
    return date ? date.getTime() : 0;
  };

  const sortedBookings = [...bookings].sort((a, b) => getTimestamp(b.createdAt) - getTimestamp(a.createdAt));
  const latestBooking = sortedBookings.length > 0 ? sortedBookings[0] : null;

  return (
    <div className="page">
      {!verified && (
        <div className="notice-box">
          <div className="notice-icon">!</div>
          <div>
            <h3>{verificationLabel(verificationStatus)}</h3>
            <p>Gửi CCCD/CMND và bằng lái để có thể gửi yêu cầu thuê xe.</p>
          </div>
          <button className="button" onClick={() => onChangeView("verify")}>
            Xác minh ngay
          </button>
        </div>
      )}
      <div className="overview-title">
        <h2>Chào {fullName},</h2>
        <p>
          Các số liệu dưới đây được cập nhật dựa trên đơn thuê thực tế của bạn.
        </p>
      </div>
      <div className="stats">
        <article className="stat">
          <p>Đơn chờ xác nhận</p>
          <b>{pendingCount}</b>
          <span>{pendingCount > 0 ? \`Có \${pendingCount} đơn đang chờ xác nhận\` : "Chưa có dữ liệu đơn thuê"}</span>
        </article>
        <article className="stat">
          <p>Lượt thuê hoàn thành</p>
          <b>{completedCount}</b>
          <span>{completedCount > 0 ? \`Đã hoàn thành \${completedCount} lượt thuê\` : "Chưa có lượt thuê hoàn thành"}</span>
        </article>
        <article className="stat">
          <p>Trạng thái tài khoản</p>
          <b>{verificationLabel(verificationStatus)}</b>
          <span>
            {verified
              ? "Tài khoản đã đủ điều kiện thuê xe"
              : "Cập nhật từ hồ sơ xác minh"}
          </span>
        </article>
      </div>
      <section className="panel">
        <div className="panel-head">
          <h2>Đơn thuê gần nhất</h2>
          <button onClick={() => onChangeView("bookings")}>
            Xem đơn thuê →
          </button>
        </div>
        {latestBooking ? (
          <div className="booking-preview" style={{ cursor: 'pointer' }} onClick={() => onChangeView("bookings")}>
            <div className="bike-round" style={{ overflow: 'hidden', padding: 0 }}>
              {latestBooking.vehicleImage ? (
                <img src={latestBooking.vehicleImage} alt={latestBooking.bike} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span>⌁</span>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <b>{latestBooking.bike}</b>
              <small>{latestBooking.dates}</small>
            </div>
            <span className={\`tag \${statusClass(latestBooking.status)}\`}>
              {latestBooking.status}
            </span>
          </div>
        ) : (
          <div className="booking-preview">
            <div className="bike-round">
              <span>⌁</span>
            </div>
            <div>
              <b>Bạn chưa có đơn thuê nào</b>
              <small>Chọn xe để gửi yêu cầu thuê đầu tiên của bạn.</small>
            </div>
            <button className="button light" onClick={() => onChangeView("rent")}>
              Xem xe cho thuê
            </button>
          </div>
        )}
      </section>`;

content = content.replace(overviewOld, overviewNew);

fs.writeFileSync('app/customer/page.tsx', content, 'utf-8');
console.log("Restored!");
