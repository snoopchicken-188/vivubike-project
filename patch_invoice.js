const fs = require('fs');
let content = fs.readFileSync('app/customer/page.tsx', 'utf-8');
content = content.replace(/\r\n/g, '\n');

// 1. Expand Booking type
const oldBookingType = `  createdAt: unknown;
};`;
const newBookingType = `  createdAt: unknown;
  actualPickupAt?: string;
  actualReturnAt?: string;
  depositAmount?: number;
  additionalFee?: number;
  feeReason?: string;
  licensePlate?: string;
  totalAmount?: number;
};`;
content = content.replace(oldBookingType, newBookingType);

// 2. Expand fetching map
const oldFetchMap = `              endDate: String(data.endDate || ""),
              createdAt: data.createdAt,
            };`;
const newFetchMap = `              endDate: String(data.endDate || ""),
              createdAt: data.createdAt,
              actualPickupAt: String(data.actualPickupAt || ""),
              actualReturnAt: String(data.actualReturnAt || ""),
              depositAmount: Number(data.depositAmount || 0),
              additionalFee: Number(data.additionalFee || 0),
              feeReason: String(data.feeReason || ""),
              licensePlate: String(data.licensePlate || ""),
              totalAmount: Number(data.totalAmount || 0),
            };`;
content = content.replace(oldFetchMap, newFetchMap);

// 3. Update BookingDetail component
const oldBookingDetail = `function BookingDetail({
  booking,
  onClose,
}: {
  booking: Booking;
  onClose: () => void;
}) {
  const money = (value: number) =>
    \`\${new Intl.NumberFormat("vi-VN").format(value)}đ\`;
  const dateText = (value: string) => {
    if (!value) return "Chưa cập nhật";
    const date = new Date(\`\${value}T00:00:00\`);
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(date);
  };
  const createdAtText = (value: unknown) => {
    const timestamp = value as { toDate?: () => Date } | undefined;
    const date =
      value instanceof Date
        ? value
        : typeof timestamp?.toDate === "function"
          ? timestamp.toDate()
          : null;
    return date
      ? new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date)
      : "Đơn vừa được tạo";
  };

  return (
    <div
      className="booking-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="booking-modal" role="dialog" aria-modal="true">
        <button className="modal-close" onClick={onClose} aria-label="Đóng">
          ✕
        </button>
        <div className="modal-title">
          <div>
            <p>CHI TIẾT ĐƠN THUÊ</p>
            <h2>{booking.code}</h2>
            <small>Tạo lúc {createdAtText(booking.createdAt)}</small>
          </div>
          <span className={\`tag \${statusClass(booking.status)}\`}>
            {booking.status}
          </span>
        </div>

        <div className="modal-bike">
          {booking.vehicleImage ? (
            <img src={booking.vehicleImage} alt={booking.bike} />
          ) : (
            <span>⌁</span>
          )}
          <div>
            <small>XE ĐÃ ĐẶT</small>
            <h3>{booking.bike}</h3>
            <p>{booking.dailyPrice ? \`\${money(booking.dailyPrice)}/ngày\` : "Giá thuê được Staff xác nhận"}</p>
          </div>
        </div>

        <div className="detail-grid">
          <article>
            <span>Thời gian thuê</span>
            <b>
              {dateText(booking.startDate)} — {dateText(booking.endDate)}
            </b>
            <small>{booking.rentalDays ? \`\${booking.rentalDays} ngày thuê\` : "Đang chờ xác nhận"}</small>
          </article>
          <article>
            <span>Điểm nhận xe</span>
            <b>{booking.location || "Đang cập nhật"}</b>
            <small>Staff sẽ xác nhận thời gian nhận xe</small>
          </article>
          <article>
            <span>Khách thuê</span>
            <b>{booking.customerName || "Khách hàng"}</b>
            <small>{booking.customerPhone || booking.customerEmail || "Thông tin trong hồ sơ"}</small>
          </article>
          <article>
            <span>Tổng tiền dự kiến</span>
            <b>{booking.total}</b>
            <small>Chưa bao gồm phát sinh (nếu có)</small>
          </article>
        </div>

        <div className="detail-note">
          <b>Ghi chú cho Staff</b>
          <p>{booking.note || "Khách hàng chưa để lại ghi chú."}</p>
        </div>

        <div className="detail-included">
          <b>Phụ kiện đi kèm</b>
          <div>
            {(booking.amenities.length
              ? booking.amenities
              : ["02 mũ bảo hiểm", "01 áo mưa"]
            ).map((amenity) => (
              <span key={amenity}>✓ {amenity}</span>
            ))}
          </div>
        </div>

        <button className="button modal-button" onClick={onClose}>
          Đã hiểu
        </button>
      </section>
    </div>
  );
}`;

const newBookingDetail = `function BookingDetail({
  booking,
  onClose,
}: {
  booking: Booking;
  onClose: () => void;
}) {
  const money = (value: number) =>
    \`\${new Intl.NumberFormat("vi-VN").format(value)}đ\`;
  const dateText = (value: string) => {
    if (!value) return "Chưa cập nhật";
    const date = new Date(\`\${value}T00:00:00\`);
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(date);
  };
  const createdAtText = (value: unknown) => {
    const timestamp = value as { toDate?: () => Date } | undefined;
    const date =
      value instanceof Date
        ? value
        : typeof timestamp?.toDate === "function"
          ? timestamp.toDate()
          : null;
    return date
      ? new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date)
      : "Đơn vừa được tạo";
  };

  const fmtDT = (d?: string | Date) => {
    if (!d) return "—";
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return String(d);
    return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
  };
  const duration = (start?: string | Date, end?: string | Date) => {
    if (!start || !end) return "";
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms <= 0) return "";
    const h = Math.floor(ms / 3600000);
    const d = Math.floor(h / 24);
    return d > 0 ? \`(\${d} ngày \${h % 24} giờ)\` : \`(\${h} giờ)\`;
  };
  const lateMinutes = (plannedReturn?: string | Date, actual?: string | Date) => {
    if (!plannedReturn) return 0;
    const a = actual ? new Date(actual) : new Date();
    const p = new Date(plannedReturn);
    return Math.floor((a.getTime() - p.getTime()) / 60000);
  };
  const lateText = (minutes: number) => {
    if (minutes <= 0) return "";
    const d = Math.floor(minutes / 1440);
    const h = Math.floor((minutes % 1440) / 60);
    const m = minutes % 60;
    let s = "Quá hạn ";
    if (d > 0) s += \`\${d} ngày \`;
    if (h > 0) s += \`\${h} giờ \`;
    if (m > 0 && d === 0) s += \`\${m} phút\`;
    return s.trim();
  };

  const isCompleted = booking.status === "Đã hoàn thành";

  return (
    <div
      className="booking-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {isCompleted ? (
        <section className="modal bill-modal" role="dialog" aria-modal="true" style={{ maxWidth: '680px', padding: 0, overflow: 'hidden', backgroundColor: '#fff', width: '100%', position: 'relative' }}>
          <div className="bill-wrap" id="bill-print-area" style={{ padding: '32px 36px' }}>
            <div className="bill-header">
              <div className="bill-logo">
                <span className="bill-logo-mark">V</span>
                <div>
                  <div className="bill-brand">VI VU <b>BIKE</b></div>
                  <div className="bill-brand-sub">Dịch vụ cho thuê xe máy</div>
                </div>
              </div>
              <div className="bill-title-block">
                <h2 className="bill-title">HÓA ĐƠN QUYẾT TOÁN THUÊ XE</h2>
                <div className="bill-meta">
                  <span>Mã phiếu: <b>{booking.code}</b></span>
                  <span>Ngày: <b>{createdAtText(new Date())}</b></span>
                </div>
              </div>
            </div>

            <div className="bill-info-grid">
              <div className="bill-info-col">
                <p className="bill-section-label">THÔNG TIN KHÁCH HÀNG</p>
                <p className="bill-info-line"><span>Họ tên:</span><b>{booking.customerName}</b></p>
                <p className="bill-info-line"><span>Liên hệ:</span><b>{booking.customerPhone || booking.customerEmail}</b></p>
              </div>
              <div className="bill-info-col">
                <p className="bill-section-label">THÔNG TIN XE THUÊ</p>
                <p className="bill-info-line"><span>Dòng xe:</span><b>{booking.bike}</b></p>
                {booking.licensePlate && <p className="bill-info-line"><span>Biển số:</span><b>{booking.licensePlate}</b></p>}
                <p className="bill-info-line"><span>Nhận xe:</span><b>{fmtDT(booking.actualPickupAt || booking.startDate)}</b></p>
                <p className="bill-info-line"><span>Hẹn trả:</span><b>{fmtDT(booking.endDate)}</b></p>
                <p className="bill-info-line"><span>Trả thực tế:</span><b style={{ color: (() => { const late = lateMinutes(booking.endDate, booking.actualReturnAt); return late > 0 ? "#c55720" : "#15834b"; })() }}>{fmtDT(booking.actualReturnAt)}</b></p>
                {(() => { const late = lateMinutes(booking.endDate, booking.actualReturnAt); return (late > 0) ? <p className="bill-info-line"><span style={{ color: "#c55720", fontWeight: 700 }}>{lateText(late)}</span><b style={{ color: "#c55720" }}>! Phụ phí</b></p> : null; })()}
                {duration(booking.actualPickupAt || booking.startDate, booking.actualReturnAt) && <p className="bill-info-line"><span>Thời lượng:</span><b>{duration(booking.actualPickupAt || booking.startDate, booking.actualReturnAt).replace(/[()]/g, "")}</b></p>}
              </div>
            </div>

            <table className="bill-table">
              <thead>
                <tr><th>Diễn giải</th><th style={{ textAlign: "right" }}>Số tiền</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td>Tiền thuê xe ({booking.bike})</td>
                  <td className="bill-amount">{money(booking.totalAmount || booking.dailyPrice * booking.rentalDays)}</td>
                </tr>
                {(booking.depositAmount || 0) > 0 && (
                  <tr className="bill-row-deduct">
                    <td>Tiền cọc ban đầu (giảm trừ)</td>
                    <td className="bill-amount">- {money(booking.depositAmount || 0)}</td>
                  </tr>
                )}
                {(booking.additionalFee || 0) > 0 && (
                  <>
                    <tr className="bill-row-penalty">
                      <td>Phụ phí phát sinh</td>
                      <td className="bill-amount">+ {money(booking.additionalFee || 0)}</td>
                    </tr>
                    {booking.feeReason && (
                      <tr className="bill-row-reason">
                        <td colSpan={2}><i>└ Lý do: {booking.feeReason}</i></td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>

            {(() => {
              const base = booking.totalAmount || (booking.dailyPrice * booking.rentalDays);
              const grand = base + (booking.additionalFee || 0) - (booking.depositAmount || 0);
              const isRefund = grand < 0;
              return (
                <div className={\`bill-grand\${isRefund ? " refund" : ""} completed\`}>
                  <span>ĐÃ QUYẾT TOÁN</span>
                  <b>{money(Math.abs(grand))}</b>
                </div>
              );
            })()}

            <div className="bill-footer">
              <p>Cảm ơn quý khách đã sử dụng dịch vụ <b>Vi Vu Bike</b>!</p>
              <p className="bill-footer-sub">Hồ sơ và chi tiết thuê xe được lưu trữ trong hệ thống.</p>
            </div>
          </div>

          <div className="bill-actions">
            <button className="button light" onClick={() => window.print()} style={{ marginRight: '10px' }}>🖨 In hóa đơn</button>
            <button className="button" onClick={onClose}>Đóng</button>
          </div>
        </section>
      ) : (
        <section className="booking-modal" role="dialog" aria-modal="true">
          <button className="modal-close" onClick={onClose} aria-label="Đóng">
            ✕
          </button>
          <div className="modal-title">
            <div>
              <p>CHI TIẾT ĐƠN THUÊ</p>
              <h2>{booking.code}</h2>
              <small>Tạo lúc {createdAtText(booking.createdAt)}</small>
            </div>
            <span className={\`tag \${statusClass(booking.status)}\`}>
              {booking.status}
            </span>
          </div>

          <div className="modal-bike">
            {booking.vehicleImage ? (
              <img src={booking.vehicleImage} alt={booking.bike} />
            ) : (
              <span>⌁</span>
            )}
            <div>
              <small>XE ĐÃ ĐẶT</small>
              <h3>{booking.bike}</h3>
              <p>{booking.dailyPrice ? \`\${money(booking.dailyPrice)}/ngày\` : "Giá thuê được Staff xác nhận"}</p>
            </div>
          </div>

          <div className="detail-grid">
            <article>
              <span>Thời gian thuê</span>
              <b>
                {dateText(booking.startDate)} — {dateText(booking.endDate)}
              </b>
              <small>{booking.rentalDays ? \`\${booking.rentalDays} ngày thuê\` : "Đang chờ xác nhận"}</small>
            </article>
            <article>
              <span>Điểm nhận xe</span>
              <b>{booking.location || "Đang cập nhật"}</b>
              <small>Staff sẽ xác nhận thời gian nhận xe</small>
            </article>
            <article>
              <span>Khách thuê</span>
              <b>{booking.customerName || "Khách hàng"}</b>
              <small>{booking.customerPhone || booking.customerEmail || "Thông tin trong hồ sơ"}</small>
            </article>
            <article>
              <span>Tổng tiền dự kiến</span>
              <b>{booking.total}</b>
              <small>Chưa bao gồm phát sinh (nếu có)</small>
            </article>
          </div>

          <div className="detail-note">
            <b>Ghi chú cho Staff</b>
            <p>{booking.note || "Khách hàng chưa để lại ghi chú."}</p>
          </div>

          <div className="detail-included">
            <b>Phụ kiện đi kèm</b>
            <div>
              {(booking.amenities.length
                ? booking.amenities
                : ["02 mũ bảo hiểm", "01 áo mưa"]
              ).map((amenity) => (
                <span key={amenity}>✓ {amenity}</span>
              ))}
            </div>
          </div>

          <button className="button modal-button" onClick={onClose}>
            Đã hiểu
          </button>
        </section>
      )}
    </div>
  );
}`;

content = content.replace(oldBookingDetail, newBookingDetail);

// 4. Add bill CSS to global styles
const oldCSS = `        .profile-form .form-grid {
          margin-bottom: 20px;
        }`;
const newCSS = `        .profile-form .form-grid {
          margin-bottom: 20px;
        }
        .bill-modal { max-width: 680px; padding: 0; overflow: hidden; }
        .bill-wrap { background: #fff; padding: 32px 36px; }
        .bill-header { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 3px solid #f26522; padding-bottom: 20px; margin-bottom: 22px; gap: 16px; flex-wrap: wrap; }
        .bill-logo { display: flex; align-items: center; gap: 12px; }
        .bill-logo-mark { align-items: center; background: #f26522; clip-path: polygon(50% 0,100% 18%,82% 100%,18% 100%,0 18%); color: #fff; display: flex; font-size: 16px; font-weight: 900; height: 44px; justify-content: center; width: 44px; flex-shrink: 0; }
        .bill-brand { font-size: 18px; font-weight: 900; letter-spacing: .06em; color: #151718; }
        .bill-brand b { color: #f26522; }
        .bill-brand-sub { font-size: 11px; color: #888; margin-top: 2px; }
        .bill-title-block { text-align: right; }
        .bill-title { font-size: 14px; font-weight: 800; letter-spacing: .06em; color: #151718; margin: 0 0 8px; text-transform: uppercase; }
        .bill-meta { display: flex; flex-direction: column; gap: 3px; }
        .bill-meta span { font-size: 12px; color: #666; }
        .bill-meta b { color: #171717; }
        .bill-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 22px; }
        .bill-section-label { color: #f26522; font-size: 10px; font-weight: 800; letter-spacing: .12em; margin: 0 0 10px; text-transform: uppercase; }
        .bill-info-line { display: flex; justify-content: space-between; font-size: 13px; margin: 0 0 6px; gap: 8px; }
        .bill-info-line span { color: #888; flex-shrink: 0; }
        .bill-info-line b { text-align: right; }
        .bill-table { border-collapse: collapse; width: 100%; margin-bottom: 0; font-size: 13px; }
        .bill-table thead tr { background: #f8f8f8; border-bottom: 2px solid #eee; }
        .bill-table th { font-size: 11px; font-weight: 800; letter-spacing: .08em; padding: 10px 14px; text-align: left; color: #555; text-transform: uppercase; }
        .bill-table td { padding: 11px 14px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
        .bill-amount { text-align: right; font-weight: 700; white-space: nowrap; }
        .bill-row-deduct td { color: #15834b; }
        .bill-row-penalty td { color: #c55720; font-weight: 700; }
        .bill-row-reason td { color: #888; font-size: 12px; padding-top: 2px; padding-bottom: 10px; border-bottom: 1px solid #f0f0f0; }
        .bill-grand { background: #f26522; color: #fff; display: flex; align-items: center; justify-content: space-between; padding: 18px 24px; margin-top: 0; }
        .bill-grand span { font-size: 12px; font-weight: 800; letter-spacing: .06em; opacity: .92; text-transform: uppercase; }
        .bill-grand b { font-size: 26px; font-weight: 900; letter-spacing: -.02em; }
        .bill-grand.refund, .bill-grand.completed { background: #15834b; }
        .bill-footer { text-align: center; padding: 18px 0 4px; border-top: 1px dashed #ddd; margin-top: 18px; }
        .bill-footer p { margin: 0 0 4px; font-size: 13px; color: #555; }
        .bill-footer-sub { font-size: 11px; color: #aaa !important; }
        .bill-actions { display: flex; gap: 10px; justify-content: flex-end; padding: 16px 24px; background: #fafafa; border-top: 1px solid #eee; flex-wrap: wrap; }
        @media print {
          .booking-modal-backdrop { position: static; background: none; padding: 0; }
          .bill-modal { box-shadow: none; max-width: 100%; }
          .bill-actions { display: none; }
          body *:not(.bill-modal):not(.bill-modal *) { display: none; }
        }`;
content = content.replace(oldCSS, newCSS);

fs.writeFileSync('app/customer/page.tsx', content, 'utf-8');
console.log('Invoice integrated successfully');
