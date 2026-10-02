"use client";
import Link from "next/link";

const policySections = [
  {
    number: "01",
    title: "Điều kiện và giấy tờ thuê xe",
    items: [
      "Người thuê cần cung cấp thông tin cá nhân chính xác, có giấy tờ tùy thân hợp lệ và giấy phép lái xe phù hợp với loại xe đã chọn.",
      "Khách đã đăng ký và khách vãng lai đều cần hoàn tất bước xác nhận hồ sơ trước khi nhận xe.",
      "Vi Vu Bike có thể từ chối bàn giao xe khi thông tin hồ sơ không khớp, giấy tờ hết hạn hoặc điều kiện lái xe không đáp ứng yêu cầu an toàn.",
    ],
  },
  {
    number: "02",
    title: "Đặt xe, xác nhận và nhận xe",
    items: [
      "Đơn thuê chỉ được xem là hợp lệ sau khi hệ thống hoặc nhân viên xác nhận tình trạng xe, thời gian thuê và thông tin người nhận.",
      "Khi nhận xe, khách cùng nhân viên kiểm tra tình trạng xe, phụ kiện đi kèm và thời gian nhận trong biên bản bàn giao.",
      "Khách vui lòng kiểm tra phanh, đèn, lốp, gương và mức nhiên liệu trước khi rời điểm giao nhận; các điểm bất thường cần được báo ngay trên biên bản.",
    ],
  },
  {
    number: "03",
    title: "Giá thuê và thanh toán",
    items: [
      "Giá thuê được tính theo bảng giá đang công bố hoặc mức giá đã xác nhận trong đơn thuê; thời hạn thuê dài hơn có thể áp dụng mức giá theo ngày tương ứng.",
      "Vi Vu Bike không yêu cầu đặt cọc. Các khoản phát sinh, nếu có, phải được thông báo rõ và được hai bên thống nhất trước khi thực hiện.",
      "Khách thanh toán theo hướng dẫn trong đơn thuê. Hóa đơn, xác nhận thanh toán và lịch nhận trả cần được lưu lại để đối chiếu khi cần thiết.",
    ],
  },
  {
    number: "04",
    title: "Đổi lịch, hủy đơn và không đến nhận xe",
    items: [
      "Nếu cần đổi thời gian hoặc hủy đơn, khách vui lòng thông báo sớm qua hotline để đội ngũ kiểm tra tình trạng xe và hỗ trợ phương án phù hợp.",
      "Việc đổi xe hoặc đổi lịch phụ thuộc vào số lượng xe thực tế tại thời điểm yêu cầu.",
      "Đơn chưa được nhận xe trong khoảng thời gian đã xác nhận và không có thông báo có thể được giải phóng để phục vụ khách hàng khác.",
    ],
  },
  {
    number: "05",
    title: "Sử dụng và trả xe",
    items: [
      "Xe chỉ được sử dụng đúng mục đích di chuyển hợp pháp, bởi người có đủ điều kiện lái xe; không giao xe cho người không có giấy phép phù hợp.",
      "Không tự ý tháo lắp, sửa chữa, cho thuê lại hoặc sử dụng xe vào mục đích trái pháp luật.",
      "Khi trả xe, khách và nhân viên cùng kiểm tra xe, phụ kiện, mức nhiên liệu và thời gian trả. Tình trạng phát sinh sẽ được ghi nhận minh bạch trong biên bản.",
    ],
  },
  {
    number: "06",
    title: "Sự cố, an toàn và hỗ trợ",
    items: [
      "Khi xe có dấu hiệu bất thường, va chạm hoặc xảy ra sự cố, khách dừng xe ở vị trí an toàn và liên hệ hotline ngay để được hướng dẫn.",
      "Không tiếp tục vận hành xe khi nhận thấy lỗi có thể ảnh hưởng đến an toàn. Vi Vu Bike sẽ kiểm tra và hỗ trợ đổi xe trong phạm vi có thể.",
      "Khách có trách nhiệm bảo quản xe, chìa khóa và phụ kiện trong thời gian thuê; mọi sự cố cần được thông báo trung thực, kịp thời.",
    ],
  },
  {
    number: "07",
    title: "Bảo mật thông tin",
    items: [
      "Thông tin được cung cấp khi đăng ký, đặt xe và thuê xe được dùng để xác minh hồ sơ, vận hành đơn thuê, chăm sóc khách hàng và xử lý sự cố.",
      "Khách có trách nhiệm bảo mật tài khoản của mình và thông báo ngay khi phát hiện đăng nhập hoặc giao dịch bất thường.",
      "Vi Vu Bike chỉ cập nhật thông tin đơn thuê qua các kênh liên hệ đã được khách cung cấp hoặc xác nhận trong hệ thống.",
    ],
  },
];

export default function PoliciesPage() {
  return (
    <main className="policies-page">
      <header className="policies-header">
        <Link className="policies-brand" href="/"><span className="policies-brand-mark">V</span><span>VI VU <b>BIKE</b></span></Link>
        <Link className="policies-back" href="/">← Về trang chủ</Link>
      </header>

      <section className="policies-hero"><div><p>VI VU BIKE · CHÍNH SÁCH THUÊ XE</p><h1>Rõ ràng điều khoản.<br /><em>An tâm lên đường.</em></h1><span>Vui lòng đọc kỹ chính sách trước khi tạo đơn hoặc nhận xe.</span></div></section>

      <section className="policies-summary" aria-label="Tóm tắt chính sách">
        <article><b>01</b><h2>Không đặt cọc</h2><p>Giá và các khoản phát sinh được xác nhận rõ trước khi thực hiện.</p></article>
        <article><b>02</b><h2>Biên bản minh bạch</h2><p>Tình trạng xe, phụ kiện và thời gian giao nhận đều được đối chiếu.</p></article>
        <article><b>03</b><h2>Hỗ trợ khi có sự cố</h2><p>Liên hệ ngay với đội ngũ khi xe gặp dấu hiệu bất thường.</p></article>
      </section>

      <section className="policies-content">
        <aside className="policies-toc"><p>NỘI DUNG</p>{policySections.map((section) => <a href={`#policy-${section.number}`} key={section.number}><span>{section.number}</span>{section.title}</a>)}</aside>
        <div className="policies-list">
          <div className="policies-intro"><p className="policies-eyebrow">ĐỌC TRƯỚC KHI ĐẶT XE</p><h2>Chính sách đầy đủ</h2><p>Chính sách này áp dụng cho các đơn thuê xe được tạo trên hệ thống Vi Vu Bike. Nội dung là căn cứ để khách hàng và đội ngũ phối hợp xuyên suốt quá trình đặt, nhận, sử dụng và trả xe.</p></div>
          {policySections.map((section) => <article className="policies-section" id={`policy-${section.number}`} key={section.number}><div className="policies-number">{section.number}</div><div><h3>{section.title}</h3><ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul></div></article>)}
          <article className="policies-contact"><p>VẪN CÒN CÂU HỎI?</p><h2>Liên hệ trước khi đặt xe để được tư vấn rõ hơn.</h2><div><a href="tel:0900123456">Gọi hotline 0900 123 456</a><Link href="/">Xem xe đang có →</Link></div></article>
        </div>
      </section>
      <footer className="policies-footer">© 2026 Vi Vu Bike · Hà Nội, Việt Nam</footer>

      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap");
        .policies-page{--policies-ink:#17212a;--policies-muted:#64707a;--policies-line:#e3e8eb;--policies-orange:#f26522;min-height:100vh;background:#fff;color:var(--policies-ink);font-family:"Be Vietnam Pro",Arial,sans-serif}.policies-page *{box-sizing:border-box}.policies-header{width:min(1240px,100%);height:82px;margin:0 auto;padding:0 28px;display:flex;align-items:center;justify-content:space-between;gap:18px}.policies-brand{display:inline-flex;align-items:center;gap:10px;color:var(--policies-ink);font-size:15px;font-weight:800;letter-spacing:.06em;text-decoration:none}.policies-brand b{color:var(--policies-orange)}.policies-brand-mark{display:grid;place-items:center;width:31px;height:31px;color:#fff;background:var(--policies-orange);clip-path:polygon(50% 0,100% 18%,82% 100%,18% 100%,0 18%)}.policies-back{border:1px solid var(--policies-ink);padding:10px 14px;color:var(--policies-ink);font-size:13px;font-weight:800;text-decoration:none;transition:.2s}.policies-back:hover{background:var(--policies-ink);color:#fff}.policies-hero{min-height:430px;display:grid;align-items:end;padding:70px max(28px,calc((100vw - 1184px)/2));background:linear-gradient(104deg,rgba(12,17,20,.93),rgba(21,27,31,.76)),url("https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=2200&q=90") center/cover;color:#fff}.policies-hero>div{max-width:720px}.policies-hero p,.policies-eyebrow,.policies-contact>p{margin:0 0 15px;color:#ff9868;font-size:11px;font-weight:800;letter-spacing:.15em}.policies-hero h1{margin:0;font-size:clamp(42px,6vw,76px);line-height:1.03;letter-spacing:-.055em}.policies-hero h1 em{color:#ff8d55;font-style:normal}.policies-hero span{display:block;max-width:460px;margin-top:24px;color:#dce0e2;font-size:15px;line-height:1.7}.policies-summary{width:min(1184px,calc(100% - 56px));margin:-42px auto 0;position:relative;z-index:1;display:grid;grid-template-columns:repeat(3,1fr);background:#fff;border:1px solid var(--policies-line);box-shadow:0 18px 44px rgba(15,26,32,.12)}.policies-summary article{min-height:185px;padding:29px 30px;border-right:1px solid var(--policies-line)}.policies-summary article:last-child{border-right:0}.policies-summary b{display:block;color:var(--policies-orange);font-size:12px;letter-spacing:.09em}.policies-summary h2{margin:25px 0 9px;font-size:19px;letter-spacing:-.025em}.policies-summary p{margin:0;color:var(--policies-muted);font-size:13px;line-height:1.6}.policies-content{width:min(1184px,calc(100% - 56px));margin:0 auto;display:grid;grid-template-columns:245px minmax(0,1fr);gap:76px;padding:100px 0}.policies-toc{align-self:start;position:sticky;top:24px;border-top:2px solid var(--policies-ink);padding-top:15px}.policies-toc>p{margin:0 0 12px;color:var(--policies-muted);font-size:10px;font-weight:800;letter-spacing:.13em}.policies-toc a{display:flex;gap:10px;padding:11px 0;border-bottom:1px solid var(--policies-line);color:#4e5a62;font-size:12px;line-height:1.35;text-decoration:none}.policies-toc a:hover{color:var(--policies-orange)}.policies-toc span{color:var(--policies-orange);font-size:10px;font-weight:800}.policies-intro{padding-bottom:35px;border-bottom:1px solid var(--policies-line)}.policies-intro h2{margin:0 0 15px;font-size:clamp(32px,4vw,48px);letter-spacing:-.045em}.policies-intro>p:last-child{max-width:700px;margin:0;color:var(--policies-muted);font-size:15px;line-height:1.75}.policies-section{display:grid;grid-template-columns:67px minmax(0,1fr);gap:24px;padding:42px 0;border-bottom:1px solid var(--policies-line);scroll-margin-top:22px}.policies-number{width:47px;height:47px;display:grid;place-items:center;border-radius:50%;background:#fff1e9;color:var(--policies-orange);font-size:12px;font-weight:800}.policies-section h3{margin:9px 0 17px;font-size:23px;letter-spacing:-.03em}.policies-section ul{display:grid;gap:12px;margin:0;padding:0;list-style:none}.policies-section li{position:relative;padding-left:19px;color:#536069;font-size:14px;line-height:1.7}.policies-section li:before{content:"";position:absolute;left:0;top:.72em;width:6px;height:6px;border-radius:50%;background:var(--policies-orange)}.policies-contact{margin-top:45px;padding:38px;background:linear-gradient(120deg,#162029,#26323a);color:#fff}.policies-contact h2{max-width:560px;margin:0;font-size:clamp(25px,3vw,37px);line-height:1.18;letter-spacing:-.04em}.policies-contact>div{display:flex;gap:11px;flex-wrap:wrap;margin-top:28px}.policies-contact a{padding:12px 15px;border:1px solid rgba(255,255,255,.52);color:#fff;font-size:13px;font-weight:800;text-decoration:none}.policies-contact a:first-child{background:var(--policies-orange);border-color:var(--policies-orange)}.policies-footer{padding:27px 28px;background:#111315;color:#9ca6ab;text-align:center;font-size:12px}@media(max-width:850px){.policies-header{height:72px;padding:0 22px}.policies-summary{grid-template-columns:1fr;width:min(620px,calc(100% - 44px));margin-top:-25px}.policies-summary article{min-height:auto;border-right:0;border-bottom:1px solid var(--policies-line)}.policies-summary article:last-child{border-bottom:0}.policies-content{grid-template-columns:1fr;width:min(700px,calc(100% - 44px));gap:35px;padding:70px 0}.policies-toc{position:static;display:none}.policies-section{grid-template-columns:52px minmax(0,1fr);gap:15px}.policies-section h3{font-size:20px}.policies-hero{min-height:380px;padding:58px 22px}}@media(max-width:500px){.policies-header{padding:0 16px}.policies-back{padding:9px 10px;font-size:11px}.policies-brand{font-size:13px}.policies-hero h1{font-size:42px}.policies-summary{width:calc(100% - 32px)}.policies-summary article{padding:24px}.policies-content{width:calc(100% - 32px);padding:55px 0}.policies-intro>p:last-child,.policies-section li{font-size:13px}.policies-section{grid-template-columns:1fr;gap:9px;padding:32px 0}.policies-number{width:39px;height:39px}.policies-contact{padding:28px 22px}.policies-contact>div{display:grid}.policies-contact a{text-align:center}.policies-footer{font-size:11px}}
      `}</style>
    </main>
  );
}
