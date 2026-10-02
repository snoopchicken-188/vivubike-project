"use client";



import { FormEvent, useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut, updateProfile } from "firebase/auth";

import { collection, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";

import { auth, db } from "../lib/firebase";



type Bike = { id: string; name: string; type: string; price: number; image: string; description: string; specs: string; perks: string[]; status?: string; isVisible?: boolean };



type Rate = [string, number, number, number, number];

const slides = [

  { image: "https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=2200&q=90", eyebrow: "THUÊ XE MÁY TẠI HÀ NỘI", title: "Chọn xe tốt.", accent: "Đi thật xa.", text: "Xe mới, giao nhận rõ ràng và thủ tục đơn giản cho hành trình của bạn." },

  { image: "https://images.unsplash.com/photo-1750900142272-b2c6f4867c79?auto=format&fit=crop&w=2200&q=90", eyebrow: "KHÁM PHÁ PHỐ PHƯỜNG", title: "Đi chậm lại.", accent: "Cảm nhận nhiều hơn.", text: "Chủ động lịch trình và khám phá Hà Nội theo cách của riêng bạn." },

  { image: "https://cdn.prod.website-files.com/65ecc09cac93eb01ba966de4/6927547dcc39a0b47b022b26_Backroads%20Vietnam%20mit%20Erik%20Peters%20HEADER.jpg", eyebrow: "SẴN SÀNG LÊN ĐƯỜNG", title: "Vững tay lái.", accent: "An tâm hành trình.", text: "Xe được bảo dưỡng định kỳ và đội ngũ luôn sẵn sàng hỗ trợ bạn." },

];



const money = (value: number) => `${new Intl.NumberFormat("vi-VN").format(value)}đ`;



export default function HomePage() {

  const router = useRouter();

  const [slide, setSlide] = useState(0);

  const [paused, setPaused] = useState(false);

  const [filter, setFilter] = useState("Tất cả xe");

  const [menuOpen, setMenuOpen] = useState(false);

  const [authMode, setAuthMode] = useState<"login" | "register" | "forgot" | null>(null);

  const [notice, setNotice] = useState("");

  const [account, setAccount] = useState<{ fullName: string; role: string } | null>(null);

  const [bikes, setBikes] = useState<Bike[]>([]);

  const [locations, setLocations] = useState<string[]>([]);

  const [rates, setRates] = useState<Rate[]>([]);



  useEffect(() => {

    if (paused) return;

    const id = window.setInterval(() => setSlide((current) => (current + 1) % slides.length), 5500);

    return () => window.clearInterval(id);

  }, [paused]);



  useEffect(() => {

    return onAuthStateChanged(auth, async (user) => {

      if (!user) {

        setAccount(null);

        return;

      }

      try {

        const profile = await getDoc(doc(db, "users", user.uid));

        setAccount({

          fullName: String(profile.data()?.fullName || user.displayName || user.email || "Khách hàng"),

          role: String(profile.data()?.role || "customer"),

        });

      } catch {

        setAccount({ fullName: user.displayName || user.email || "Khách hàng", role: "customer" });

      }

    });

  }, []);



  useEffect(() => {

    return onSnapshot(collection(db, "locations"), (snapshot) => {

      const items = snapshot.docs

        .filter((item) => item.data().isActive)

        .map((item) => String(item.data().name || ""))

        .filter(Boolean);

      setLocations(items);

    });

  }, []);



  useEffect(() => {

    return onSnapshot(collection(db, "pricing"), (snapshot) => {

      const items = snapshot.docs.map((item) => {

        const data = item.data();

        return [String(data.name || ""), Number(data.oneToFive || 0), Number(data.sixToTen || 0), Number(data.elevenToTwenty || 0), Number(data.overTwenty || 0)] as Rate;

      }).filter((item) => item[0]);

      setRates(items);

    });

  }, []);



  useEffect(() => {

    return onSnapshot(collection(db, "vehicles"), (snapshot) => {

      const items = snapshot.docs.map((item) => {

        const data = item.data();

        return {

          id: item.id,

          name: String(data.name || "Xe chưa đặt tên"),

          type: String(data.type || "Khác"),

          price: Number(data.dailyPrice || 0),

          image: String(data.image || "https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=1000&q=85"),

          description: String(data.description || ""),

          specs: String(data.specs || ""),

          perks: Array.isArray(data.amenities) ? data.amenities.map(String) : [],

          status: String(data.status || "available"),

          isVisible: Boolean(data.isVisible),

        };

      });

      setBikes(items.filter((bike) => bike.isVisible && bike.status === "available"));

    }, () => notify("Không thể tải danh sách xe từ Firestore."));

  }, []);



  const notify = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 3300); };

  const handleSearch = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); document.getElementById("xe")?.scrollIntoView({ behavior: "smooth" }); notify("Kết quả xe phù hợp đang được hiển thị bên dưới."); };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {

    event.preventDefault();

    const form = new FormData(event.currentTarget);

    const email = String(form.get("email") || "").trim();

    const password = String(form.get("password") || "");



    try {

      const credential = await signInWithEmailAndPassword(auth, email, password);

      const profile = await getDoc(doc(db, "users", credential.user.uid));

      const role = profile.exists()
        ? String(profile.data().role || "customer").toLowerCase()
        : "customer";



      setAuthMode(null);

      if (role === "customer") {

        router.replace("/customer");

        return;

      }

      if (role === "admin") {

        router.replace("/admin");

        return;

      }

      if (role === "staff") {

        router.replace("/staff");

        return;

      }

      if (role === "business_manager") {

        router.replace("/business-manager");

        return;

      }

      notify("Tài khoản chưa có vai trò hợp lệ. Hãy liên hệ quản trị viên.");

    } catch (error: unknown) {

      const code = (error as { code?: string }).code;

      if (code === "auth/user-not-found") notify("Tài khoản chưa tồn tại. Vui lòng đăng ký để sử dụng dịch vụ.");

      else if (code === "auth/wrong-password" || code === "auth/invalid-credential") notify("Email hoặc mật khẩu không đúng.");

      else if (code === "auth/invalid-email") notify("Email không hợp lệ.");

      else if (code === "auth/too-many-requests") notify("Bạn đã thử quá nhiều lần. Hãy đợi ít phút rồi thử lại.");

      else notify("Không thể đăng nhập. Hãy kiểm tra lại kết nối Firebase.");

    }

  };

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {

    event.preventDefault();

    const form = new FormData(event.currentTarget);

    const fullName = String(form.get("fullName") || "").trim();

    const phone = String(form.get("phone") || "").trim();

    const email = String(form.get("email") || "").trim();

    const password = String(form.get("password") || "");



    try {

      const credential = await createUserWithEmailAndPassword(auth, email, password);



      await updateProfile(credential.user, { displayName: fullName });

      await setDoc(doc(db, "users", credential.user.uid), {

        uid: credential.user.uid,

        fullName,

        phone,

        email,

        role: "customer",

        verificationStatus: "not_submitted",

        createdAt: serverTimestamp(),

      });



      setAuthMode(null);

      router.replace("/customer");

    } catch (error: unknown) {

      const code = (error as { code?: string }).code;

      if (code === "auth/email-already-in-use") notify("Email này đã được đăng ký.");

      else if (code === "auth/weak-password") notify("Mật khẩu phải có ít nhất 6 ký tự.");

      else if (code === "auth/invalid-email") notify("Email không hợp lệ.");

      else if (code === "permission-denied") notify("Firestore chưa cho phép lưu hồ sơ. Hãy đặt Rules ở bước tiếp theo.");

      else notify("Không thể đăng ký. Hãy kiểm tra lại kết nối Firebase.");

    }

  };

  const handleForgotPassword = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setAuthMode(null); notify("Liên kết đặt lại mật khẩu đã được gửi đến email của bạn."); };

  const handleSignOut = async () => { await signOut(auth); notify("Bạn đã đăng xuất."); };

  const visibleBikes = bikes.filter((bike) => filter === "Tất cả xe" || bike.type === filter);

  const activeSlide = slides[slide];
  const dashboardPath = (role: string) => {
    if (role === "admin") return "/admin";
    if (role === "staff") return "/staff";
    if (role === "business_manager") return "/business-manager";
    return "/customer";
  };



  return (

    <main>

      {notice && <div className="toast">✓ {notice}</div>}



      <header className="header">

        <a className="brand" href="#trang-chu"><span className="brand-mark">V</span><span>VI VU <b>BIKE</b></span></a>

        <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Mở menu">{menuOpen ? "✕" : "☰"}</button>

        <nav className={menuOpen ? "nav nav-open" : "nav"}>

          <a href="#gioi-thieu" onClick={() => setMenuOpen(false)}>Giới thiệu</a><a href="#xe" onClick={() => setMenuOpen(false)}>Xe cho thuê</a><a href="#bang-gia" onClick={() => setMenuOpen(false)}>Bảng giá</a><a href="/policies" onClick={() => setMenuOpen(false)}>Chính sách</a><a href="#danh-gia" onClick={() => setMenuOpen(false)}>Đánh giá</a><a href="#lien-he" onClick={() => setMenuOpen(false)}>Liên hệ</a>

          {account ? <div className="account-nav"><a href={dashboardPath(account.role)}>Tài khoản: {account.fullName}</a><button className="logout-button" onClick={handleSignOut}>Đăng xuất</button></div> : <button className="login" onClick={() => { setAuthMode("login"); setMenuOpen(false); }}>Đăng nhập</button>}

        </nav>

      </header>



      <section className="hero" id="trang-chu">

        <div className="hero-media" key={slide} style={{ backgroundImage: `url(${activeSlide.image})` }} />

        <div className="hero-overlay" />

        <div className="hero-content" key={`content-${slide}`}><p className="eyebrow">{activeSlide.eyebrow}</p><h1>{activeSlide.title}<br /><em>{activeSlide.accent}</em></h1><p>{activeSlide.text}</p><div className="hero-tags"><span>✓ Xe bảo dưỡng định kỳ</span><span>✓ Hỗ trợ 24/7</span></div></div>

        <form className="search-card" onSubmit={handleSearch}><h2><span>⌖</span> Tìm xe trống</h2><label>Điểm nhận xe<select required defaultValue=""><option value="" disabled>{locations.length ? "Chọn địa điểm" : "Chưa có địa điểm"}</option>{locations.map((location) => <option key={location}>{location}</option>)}</select></label><div className="search-grid"><label>Ngày nhận<input type="date" required defaultValue="2026-09-12" /></label><label>Ngày trả<input type="date" required defaultValue="2026-09-14" /></label></div><button className="primary-button">Tìm xe ngay <span>→</span></button></form>

        <div className="hero-controls"><button onClick={() => setSlide((slide + slides.length - 1) % slides.length)} aria-label="Ảnh trước">←</button><div>{slides.map((_, index) => <button key={index} onClick={() => setSlide(index)} className={index === slide ? "dot active" : "dot"} aria-label={`Ảnh ${index + 1}`} />)}</div><button onClick={() => setPaused(!paused)} aria-label="Tạm dừng ảnh">{paused ? "▶" : "Ⅱ"}</button><button onClick={() => setSlide((slide + 1) % slides.length)} aria-label="Ảnh tiếp">→</button></div>

      </section>



      <section className="section intro" id="gioi-thieu"><div><p className="eyebrow orange">GIỚI THIỆU</p><h2>Thuê xe chủ động cho mọi chuyến đi.</h2></div><div><p>Vi Vu Bike mang đến dịch vụ thuê xe máy rõ ràng, giá công khai và xe được chăm sóc kỹ trước mỗi hành trình. Bạn chỉ cần chọn lịch phù hợp, hoàn tất xác minh và nhận xe.</p><a href="/policies">Xem chính sách hỗ trợ →</a></div></section>



      <section className="section" id="xe"><div className="section-heading"><div><p className="eyebrow orange">XE ĐƯỢC YÊU THÍCH</p><h2>Chọn chiếc xe của bạn</h2></div><a href="#bang-gia">Xem bảng giá đầy đủ →</a></div><div className="filters">{["Tất cả xe", "Tay ga", "Xe số", "Côn tay"].map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div>{visibleBikes.length ? <div className="bike-grid">{visibleBikes.map((bike, index) => <article className="bike-card" key={bike.id}><div className="bike-image"><img src={bike.image} alt={bike.name} /><span>{bike.type}</span><strong>0{index + 1}</strong></div><div className="bike-info"><small>{bike.specs}</small><h3>{bike.name}</h3><p>{bike.description}</p><ul>{bike.perks.map((perk) => <li key={perk}>✓ {perk}</li>)}</ul><div><b>{money(bike.price)}<i>/ngày</i></b><button onClick={() => account?.role === "customer" ? router.push(`/customer?view=rent&vehicleId=${bike.id}`) : setAuthMode("login")}>Đặt xe →</button></div></div></article>)}</div> : <div className="bike-empty"><b>Chưa có xe đang sẵn sàng</b><p>Danh sách xe sẽ hiển thị sau khi Admin thêm xe vào hệ thống.</p></div>}</section>



      <section className="support" id="chinh-sach"><div className="section support-grid"><div><p className="eyebrow orange">CHÍNH SÁCH HỖ TRỢ</p><h2>Rõ ràng trước khi bạn bắt đầu chuyến đi.</h2><p>Hỗ trợ 24/7 qua hotline, tư vấn lịch trình miễn phí và đổi xe khi gặp lỗi kỹ thuật trong phạm vi hỗ trợ.</p><button className="outline" onClick={() => router.push("/policies")}>Đọc chính sách đầy đủ →</button></div><div className="policy-grid"><article><b>01</b><h3>Thủ tục nhanh</h3><p>Đăng ký, gửi giấy tờ và chờ xác minh hồ sơ.</p></article><article><b>02</b><h3>Phụ kiện đi kèm</h3><p>02 mũ bảo hiểm và 01 áo mưa trong mỗi lượt thuê.</p></article><article><b>03</b><h3>Hỗ trợ sự cố</h3><p>Liên hệ hotline nếu xe có dấu hiệu bất thường.</p></article><article><b>04</b><h3>Giao nhận minh bạch</h3><p>Biên bản có tình trạng xe, phụ kiện và thời gian nhận trả.</p></article></div></div></section>



      <section className="section pricing" id="bang-gia"><p className="eyebrow orange">BẢNG GIÁ THAM KHẢO</p><h2>Thuê lâu hơn, giá tốt hơn</h2><p>Đơn giá theo ngày, chưa gồm các khoản phát sinh đã được thỏa thuận.</p><div className="rate-table"><div className="rate-row rate-head"><span>Loại xe</span><span>1–5 ngày</span><span>6–10 ngày</span><span>11–20 ngày</span><span>Từ 21 ngày</span></div>{rates.map((rate) => <div className="rate-row" key={rate[0]}><b>{rate[0]}</b>{rate.slice(1).map((price) => <span key={price}>{money(price as number)}</span>)}</div>)}</div></section>



      <section className="reviews" id="danh-gia"><div className="section"><p className="eyebrow orange">PHẢN HỒI KHÁCH HÀNG</p><div className="section-heading"><h2>Những chuyến đi được nhớ lại.</h2><div className="score"><b>4.9</b><span>★★★★★<small>Từ 1.240 lượt thuê</small></span></div></div><div className="review-grid"><article><strong>“</strong><p>Xe sạch, nhận nhanh và nhân viên hướng dẫn rất kỹ. Tôi đã thuê Vision ba ngày để đi quanh Hà Nội.</p><footer><span>NT</span><div><b>Ngọc Trâm</b><small>Đã thuê Vision 110cc</small></div></footer></article><article><strong>“</strong><p>Giá được báo ngay từ đầu, xe chạy ổn định. Phần 2 mũ và áo mưa rất tiện vì tôi đi cùng bạn.</p><footer><span>MH</span><div><b>Minh Hoàng</b><small>Đã thuê Air Blade 125cc</small></div></footer></article><article><strong>“</strong><p>Lịch trả xe linh hoạt, đội ngũ hỗ trợ nhanh khi tôi cần hỏi đường và kiểm tra xe trước chuyến đi xa.</p><footer><span>AL</span><div><b>Anh Linh</b><small>Đã thuê Winner X 150cc</small></div></footer></article></div></div></section>



      <section className="steps"><div className="section"><p className="eyebrow orange">QUY TRÌNH THUÊ XE</p><h2>Chỉ 3 bước để bắt đầu chuyến đi</h2><div>{[["01", "Chọn xe & thời gian", "Chọn mẫu xe, nơi nhận và lịch phù hợp với bạn."], ["02", "Xác minh tài khoản", "Đăng ký và gửi giấy tờ để nhân viên kiểm tra."], ["03", "Nhận xe & xuất phát", "Kiểm tra xe, ký biên bản và bắt đầu hành trình."]].map(([number, title, text]) => <article key={number}><b>{number}</b><h3>{title}</h3><p>{text}</p></article>)}</div></div></section>



      <footer className="site-footer" id="lien-he"><div><a className="brand" href="#trang-chu"><span className="brand-mark">V</span><span>VI VU <b>BIKE</b></span></a><p>Thuê xe máy rõ ràng, tiện lợi cho mọi chuyến đi.</p></div><button className="primary-button" onClick={() => document.getElementById("trang-chu")?.scrollIntoView({ behavior: "smooth" })}>Tìm xe ngay ↑</button><small>© 2026 Vi Vu Bike · Hotline: 0900 123 456 · Hà Nội, Việt Nam</small></footer>



      {authMode === "login" && <div className="auth-overlay"><form className="auth-modal" onSubmit={handleLogin}><button type="button" className="close" onClick={() => setAuthMode(null)}>✕</button><p className="eyebrow orange">ĐĂNG NHẬP</p><h2>Chào mừng bạn trở lại</h2><label>Email<input name="email" type="email" required placeholder="email@example.com" /></label><label>Mật khẩu<input name="password" type="password" required placeholder="Mật khẩu" /></label><button className="primary-button">Đăng nhập →</button><div className="auth-actions"><button type="button" onClick={() => setAuthMode("register")}>Chưa có tài khoản? Đăng ký</button><button type="button" onClick={() => setAuthMode("forgot")}>Quên mật khẩu?</button></div></form></div>}



      {authMode === "register" && <div className="auth-overlay"><form className="auth-modal register-modal" onSubmit={handleRegister}><button type="button" className="close" onClick={() => setAuthMode(null)}>✕</button><p className="eyebrow orange">ĐĂNG KÝ</p><h2>Tạo tài khoản thuê xe</h2><p className="auth-desc">Đăng ký công khai chỉ tạo tài khoản Customer.</p><label>Họ và tên<input name="fullName" required placeholder="Nguyễn Văn A" /></label><label>Số điện thoại<input name="phone" type="tel" required placeholder="0900 123 456" /></label><label>Email<input name="email" type="email" required placeholder="email@example.com" /></label><label>Mật khẩu<input name="password" type="password" minLength={6} required placeholder="Tối thiểu 6 ký tự" /></label><label className="terms"><input type="checkbox" required /> Tôi đồng ý với điều khoản thuê xe và chính sách xử lý dữ liệu.</label><button className="primary-button">Đăng ký →</button><div className="auth-actions"><button type="button" onClick={() => setAuthMode("login")}>Đã có tài khoản? Đăng nhập</button></div></form></div>}



      {authMode === "forgot" && <div className="auth-overlay"><form className="auth-modal" onSubmit={handleForgotPassword}><button type="button" className="close" onClick={() => setAuthMode(null)}>✕</button><p className="eyebrow orange">QUÊN MẬT KHẨU</p><h2>Đặt lại mật khẩu</h2><p className="auth-desc">Nhập email đã dùng khi đăng ký. Chúng tôi sẽ gửi liên kết đặt lại mật khẩu.</p><label>Email<input type="email" required placeholder="email@example.com" /></label><button className="primary-button">Gửi liên kết →</button><div className="auth-actions"><button type="button" onClick={() => setAuthMode("login")}>Quay lại đăng nhập</button></div></form></div>}



      <style jsx global>{`

        @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;color:#161616;background:#fff;font-family:"Be Vietnam Pro",Arial,sans-serif;font-size:16px}button,input,select{font:inherit}button{cursor:pointer}.header{height:76px;padding:0 clamp(22px,5vw,76px);display:flex;align-items:center;justify-content:space-between;background:#fff;position:relative;z-index:4}.brand{display:inline-flex;gap:10px;align-items:center;text-decoration:none;color:#151515;font-size:15px;font-weight:800;letter-spacing:.05em}.brand b,.orange{color:#f26522}.brand-mark{width:31px;height:31px;display:grid;place-items:center;background:#f26522;color:#fff;clip-path:polygon(50% 0,100% 18%,82% 100%,18% 100%,0 18%)}.nav{display:flex;align-items:center;gap:25px}.nav a{font-size:13px;color:#383838;text-decoration:none;font-weight:700}.nav a:hover{color:#f26522}.login{background:#fff;border:1px solid #171717;padding:10px 16px;font-size:13px;font-weight:700}.account-nav{align-items:center;display:flex;gap:10px}.account-nav a{border:1px solid #171717!important;padding:10px 13px;color:#171717!important}.logout-button{background:#171717;border:1px solid #171717;color:#fff;font-size:13px;font-weight:700;padding:10px 13px}.menu-button{display:none;border:0;background:none;font-size:26px}.hero{height:650px;position:relative;isolation:isolate;background-position:center;background-size:cover;transition:background-image .6s ease}.hero-overlay{position:absolute;inset:0;z-index:-1;background:linear-gradient(90deg,rgba(12,15,18,.9),rgba(12,15,18,.59) 40%,rgba(12,15,18,.1) 78%)}.hero-content{position:absolute;top:110px;left:clamp(22px,9vw,145px);color:#fff;max-width:550px;animation:rise .45s ease}.eyebrow{font-size:12px;letter-spacing:.15em;font-weight:800;margin:0 0 15px}.hero h1{font-size:clamp(48px,6vw,80px);line-height:1.02;letter-spacing:-.045em;margin:0 0 23px}.hero h1 em{color:#ff7838;font-style:normal}.hero-content>p:not(.eyebrow){font-size:17px;line-height:1.6;max-width:430px;color:#e8e8e8}.hero-tags{display:flex;gap:22px;margin-top:25px;font-size:13px;font-weight:700}.search-card{position:absolute;top:97px;right:clamp(22px,8vw,125px);width:340px;background:#fff;padding:25px;box-shadow:0 24px 50px rgba(0,0,0,.24)}.search-card h2{font-size:19px;margin:0 0 22px}.search-card h2 span{color:#f26522}.search-card label,.auth-modal label{display:grid;gap:7px;font-size:12px;font-weight:700;color:#555;margin-bottom:15px}.search-card input,.search-card select,.auth-modal input{border:0;border-bottom:1px solid #d8d8d8;padding:9px 0 10px;background:#fff;outline-color:#f26522;color:#171717}.search-card select{width:100%}.search-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.primary-button{border:0;background:#f26522;color:#fff;padding:14px 18px;font-size:14px;font-weight:800;transition:.2s}.primary-button:hover{background:#d94c0f;transform:translateY(-2px)}.search-card .primary-button{width:100%;margin-top:3px}.hero-controls{position:absolute;bottom:24px;left:clamp(22px,5vw,76px);display:flex;gap:12px;align-items:center}.hero-controls>button,.hero-controls div{border:0;background:none;color:#fff}.hero-controls>button{font-size:18px}.hero-controls div{display:flex;gap:7px}.dot{width:7px;height:7px;border-radius:50%;padding:0;border:0;background:#fff;opacity:.55}.dot.active{background:#f26522;opacity:1}.section{max-width:1200px;margin:auto;padding:95px 24px}.intro{display:grid;grid-template-columns:1.25fr .75fr;gap:90px;align-items:end}.section h2{font-size:clamp(31px,4vw,50px);line-height:1.12;letter-spacing:-.035em;margin:0;font-weight:800}.intro p{line-height:1.7;color:#666;margin:0 0 18px}.intro a,.section-heading>a{color:#161616;font-size:14px;font-weight:800;text-decoration:none}.section-heading{display:flex;justify-content:space-between;align-items:end;margin-bottom:26px}.filters{display:flex;gap:8px;margin-bottom:28px}.filters button{border:1px solid #ddd;background:#fff;padding:10px 15px;font-size:13px;font-weight:700}.filters button.active,.filters button:hover{background:#171717;color:#fff;border-color:#171717}.bike-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:20px}.bike-card{border:1px solid #e5e5e5;display:grid;grid-template-columns:45% 55%;transition:.25s}.bike-card:hover{transform:translateY(-5px);box-shadow:0 15px 32px rgba(0,0,0,.09)}.bike-image{position:relative;overflow:hidden;min-height:285px;background:#ddd}.bike-image img{width:100%;height:100%;position:absolute;object-fit:cover;transition:.4s}.bike-card:hover img{transform:scale(1.05)}.bike-image span{position:absolute;top:14px;left:14px;padding:7px 10px;background:#fff;font-size:11px;font-weight:800}.bike-image strong{position:absolute;right:14px;bottom:10px;color:#fff;font-size:40px}.bike-info{padding:21px}.bike-info>small{color:#f26522;text-transform:uppercase;letter-spacing:.08em;font-weight:800;font-size:11px}.bike-info h3{font-size:21px;margin:8px 0}.bike-info p{font-size:14px;color:#666;line-height:1.55;margin:0 0 15px}.bike-info ul{border-top:1px solid #eee;padding:12px 0 0;margin:0 0 18px;list-style:none}.bike-info li{font-size:12px;color:#4c4c4c;margin:6px 0}.bike-info>div{display:flex;align-items:center;justify-content:space-between}.bike-info b{color:#f26522;font-size:16px}.bike-info i{font-style:normal;font-size:11px;color:#777;font-weight:500}.bike-info>div button{border:0;background:none;font-size:13px;font-weight:800}.support{background:#171717;color:#fff}.support-grid{display:grid;grid-template-columns:.9fr 1.1fr;gap:90px}.support-grid h2{margin-bottom:24px}.support-grid>div>p:not(.eyebrow){color:#c3c3c3;line-height:1.7;margin-bottom:25px}.outline{border:1px solid #888;background:transparent;color:#fff;padding:13px 16px;font-size:13px;font-weight:800}.policy-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 30px}.policy-grid article{border-top:1px solid #454545;padding:18px 0}.policy-grid b{color:#ff7838;font-size:12px}.policy-grid h3{font-size:17px;margin:18px 0 8px}.policy-grid p{margin:0;color:#b4b4b4;font-size:13px;line-height:1.55}.pricing{text-align:center}.pricing h2{margin:0 auto 13px}.pricing>p:not(.eyebrow){color:#666;font-size:14px;margin-bottom:35px}.rate-table{text-align:left;border-top:2px solid #171717}.rate-row{display:grid;grid-template-columns:2fr repeat(4,1fr);gap:10px;align-items:center;padding:20px;border-bottom:1px solid #ddd}.rate-row span{color:#555}.rate-head{font-size:12px;color:#666;font-weight:800;padding:14px 20px}.reviews{background:#f5f2ee}.score{display:flex;align-items:center;gap:11px}.score>b{font-size:34px;letter-spacing:-.06em}.score span{color:#f26522;font-size:13px;letter-spacing:2px}.score small{display:block;color:#777;letter-spacing:0;font-size:11px;margin-top:3px}.review-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}.review-grid article{background:#fff;padding:28px}.review-grid strong{font-size:48px;line-height:.45;color:#f26522}.review-grid article>p{font-size:15px;line-height:1.7;margin:20px 0 27px}.review-grid footer{display:flex;gap:11px;align-items:center}.review-grid footer>span{width:37px;height:37px;background:#171717;color:#fff;display:grid;place-items:center;border-radius:50%;font-size:11px;font-weight:800}.review-grid footer b,.review-grid footer small{display:block}.review-grid footer b{font-size:13px}.review-grid footer small{font-size:11px;color:#777;margin-top:3px}.steps>div{display:grid;grid-template-columns:repeat(3,1fr);gap:30px;margin-top:52px}.steps article{border-top:2px solid #171717;padding-top:18px}.steps article>b{font-size:14px;color:#f26522}.steps h3{font-size:20px;margin:34px 0 10px}.steps article p{font-size:14px;line-height:1.65;color:#666}.site-footer{background:#171717;color:#fff;padding:52px clamp(22px,5vw,76px) 20px;display:grid;grid-template-columns:1.3fr auto;gap:25px}.site-footer .brand{color:#fff}.site-footer p{color:#aaa;font-size:14px}.site-footer>small{grid-column:1/-1;border-top:1px solid #3f3f3f;padding-top:20px;color:#8f8f8f;font-size:12px}.toast{position:fixed;z-index:100;top:20px;left:50%;transform:translateX(-50%);background:#171717;color:#fff;padding:14px 20px;box-shadow:0 10px 26px rgba(0,0,0,.2);font-size:14px}.auth-overlay{position:fixed;z-index:30;inset:0;display:grid;place-items:center;padding:20px;background:rgba(0,0,0,.56)}.auth-modal{width:min(420px,100%);background:#fff;padding:32px;position:relative;display:grid;gap:15px}.auth-modal h2{font-size:30px;line-height:1.15;letter-spacing:-.04em;margin:0}.auth-desc{margin:0;color:#666;font-size:14px;line-height:1.55}.terms{display:flex!important;grid-template-columns:auto 1fr;align-items:center;line-height:1.45}.terms input{width:auto!important;padding:0!important}.register-modal{max-height:92vh;overflow-y:auto}.auth-modal label{margin:0}.auth-modal input{border:1px solid #ddd;padding:12px}.auth-actions{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}.auth-actions button{border:0;background:none;padding:0;color:#e95c20;font-size:12px;font-weight:800;text-align:left}.close{position:absolute;right:13px;top:13px;border:0;background:#eee;width:30px;height:30px;border-radius:50%}@keyframes rise{from{opacity:0;transform:translateY(15px)}to{opacity:1;transform:translateY(0)}}@media(max-width:800px){.header{height:68px}.menu-button{display:block}.nav{display:none;position:absolute;top:68px;left:0;right:0;background:#fff;border-top:1px solid #eee;padding:18px 24px;flex-direction:column;align-items:stretch;gap:16px}.nav-open{display:flex}.nav .login,.account-nav{display:block;text-align:left}.account-nav a,.logout-button{display:block;width:100%;margin-bottom:8px}.hero{height:750px;background-position:55% center}.hero-content{top:72px}.hero h1{font-size:55px}.hero-content>p:not(.eyebrow){font-size:15px}.hero-tags{display:block;line-height:2}.hero-tags span{display:block}.search-card{top:auto;bottom:70px;left:22px;right:22px;width:auto}.hero-controls{bottom:23px}.section{padding:68px 22px}.intro,.support-grid{grid-template-columns:1fr;gap:27px}.section-heading{align-items:start;flex-direction:column;gap:16px}.filters{overflow-x:auto}.filters button{white-space:nowrap}.bike-grid,.review-grid{grid-template-columns:1fr}.bike-card{grid-template-columns:1fr}.bike-image{min-height:230px}.policy-grid{grid-template-columns:1fr}.rate-row{grid-template-columns:1.55fr repeat(4,1fr);padding:16px 4px;font-size:11px}.rate-row b{font-size:11px}.steps>div{grid-template-columns:1fr;gap:20px;margin-top:35px}.steps h3{margin-top:20px}.site-footer{grid-template-columns:1fr}.site-footer .primary-button{justify-self:start}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.hero-content{animation:none}.primary-button,.bike-card,.bike-image img{transition:none}}

      `}</style>

      <style jsx global>{`

        .hero{overflow:hidden;background:#151515}

        .hero-media{position:absolute;inset:0;z-index:-2;background-position:center;background-size:cover;animation:heroReveal 1s ease both,heroZoom 6.2s ease-out both}

        .hero-content{animation:rise .55s ease}

        @keyframes heroReveal{from{opacity:.15}to{opacity:1}}

        @keyframes heroZoom{from{transform:scale(1.035)}to{transform:scale(1)}}

        @media(prefers-reduced-motion:reduce){.hero-media{animation:none}}

      `}</style>

      <style jsx global>{`

        :root{--ink:#16191d;--muted:#697078;--line:#e8e9eb;--orange:#f26522;--surface:#f6f7f8}

        body{background:var(--surface)}

        .header{height:82px;background:rgba(255,255,255,.94);border-bottom:1px solid rgba(20,24,28,.06);backdrop-filter:blur(14px)}

        .brand{font-size:16px}.brand-mark{width:34px;height:34px;box-shadow:0 6px 14px rgba(242,101,34,.24)}

        .nav{gap:28px}.nav a{font-size:13px;letter-spacing:.01em}.login,.account-nav a,.logout-button{border-radius:10px!important;transition:transform .2s ease,box-shadow .2s ease}

        .login:hover,.account-nav a:hover,.logout-button:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(0,0,0,.12)}

        .hero{height:670px}.hero-overlay{background:linear-gradient(90deg,rgba(10,13,17,.92) 0%,rgba(10,13,17,.67) 44%,rgba(10,13,17,.08) 84%)}

        .hero-content{top:126px;max-width:590px}.hero h1{font-size:clamp(52px,6vw,84px);text-shadow:0 3px 18px rgba(0,0,0,.22)}.hero-content>p:not(.eyebrow){font-size:17px;max-width:470px}.hero-tags{gap:12px}.hero-tags span{border:1px solid rgba(255,255,255,.28);border-radius:999px;background:rgba(0,0,0,.16);padding:8px 11px}

        .search-card{top:104px;width:365px;border:1px solid rgba(255,255,255,.72);border-radius:18px;padding:28px;box-shadow:0 28px 70px rgba(0,0,0,.25)}.search-card h2{font-size:22px}.search-card label{font-size:12px}.search-card input,.search-card select{padding:11px 0}.primary-button{border-radius:10px;box-shadow:0 10px 18px rgba(242,101,34,.2)}.search-card .primary-button{margin-top:10px;padding:15px 18px}.hero-controls{bottom:29px}.hero-controls>button{border:1px solid rgba(255,255,255,.4);border-radius:50%;height:35px;width:35px}.hero-controls>button:last-child{border:0;width:auto}.dot{height:8px;width:8px}

        .section{max-width:1240px;padding:104px 30px}.intro{gap:110px}.intro>div:first-child{padding-left:18px;border-left:4px solid var(--orange)}.section h2{color:var(--ink)}.intro p{font-size:16px;line-height:1.8}.section-heading>a{color:var(--orange)}

        .filters{gap:10px}.filters button{border-radius:999px;padding:10px 18px}.bike-grid{gap:24px}.bike-card{overflow:hidden;border:1px solid var(--line);border-radius:18px;background:#fff;box-shadow:0 10px 30px rgba(20,25,30,.04)}.bike-card:hover{box-shadow:0 22px 46px rgba(20,25,30,.12);transform:translateY(-7px)}.bike-image{min-height:305px}.bike-image span{border-radius:999px;box-shadow:0 4px 14px rgba(0,0,0,.1)}.bike-image strong{font-size:46px;text-shadow:0 2px 12px rgba(0,0,0,.28)}.bike-info{padding:25px}.bike-info h3{font-size:23px}.bike-info p{font-size:14px}.bike-info>div button{color:var(--orange);border:1px solid #ffd7c5;border-radius:9px;padding:9px 12px;background:#fff}.bike-info>div button:hover{background:#fff4ee}

        .support{background:radial-gradient(circle at 88% 10%,#3e2d26 0%,#181b1e 38%,#111315 100%)}.support-grid{gap:100px}.support-grid h2{font-size:clamp(34px,4vw,52px)}.outline{border-radius:9px;border-color:#777}.policy-grid{gap:14px 30px}.policy-grid article{padding:22px 0}.policy-grid h3{font-size:18px}

        .pricing{background:#fff;border-radius:28px;margin:70px auto;box-shadow:0 12px 35px rgba(20,25,30,.05)}.rate-table{border:1px solid var(--line);border-radius:14px;overflow:hidden}.rate-row{padding:20px 24px}.rate-row:not(.rate-head):hover{background:#fff8f4}.rate-head{background:#202428;color:#fff}.rate-head span{color:#fff}

        .reviews{background:linear-gradient(135deg,#fff8f4 0%,#f3f5f7 100%)}.review-grid{gap:22px}.review-grid article{border:1px solid rgba(30,34,38,.06);border-radius:16px;box-shadow:0 12px 28px rgba(20,25,30,.05)}.review-grid article>p{font-size:15px}.score{background:#fff;border-radius:12px;padding:11px 15px;box-shadow:0 8px 18px rgba(20,25,30,.06)}

        .steps{background:#fff}.steps article{border-color:#dadde0}.steps article>b{display:inline-grid;place-items:center;background:#fff1e9;border-radius:50%;height:34px;width:34px}.site-footer{padding-top:58px;background:#111315}.site-footer .primary-button{align-self:start}.auth-modal{border-radius:18px;box-shadow:0 28px 80px rgba(0,0,0,.35)}.auth-modal input{border-radius:8px}.close{transition:transform .2s ease}.close:hover{transform:rotate(90deg)}

        @media(max-width:800px){.header{height:70px}.hero{height:770px}.hero-content{top:88px}.hero h1{font-size:54px}.hero-tags span{display:table;margin-bottom:8px}.search-card{bottom:75px;top:auto;border-radius:16px}.section{padding:72px 22px}.pricing{border-radius:0;margin:0}.bike-card{border-radius:16px}.nav{top:70px}.support-grid{gap:42px}}

        @media(prefers-reduced-motion:reduce){.bike-card,.primary-button,.login,.account-nav a,.logout-button,.close{transition:none}}

      `}</style>

      <style jsx global>{`

        /* Thanh tìm xe: ưu tiên thao tác nhanh, hiển thị đủ thông tin trong một khối */

        .hero{height:720px}

        .hero-content{top:118px;max-width:620px}

        .hero-content>p:not(.eyebrow){max-width:500px}

        .search-card{

          top:auto;right:auto;bottom:42px;left:50%;transform:translateX(-50%);

          width:min(1160px,calc(100% - 48px));min-height:104px;padding:14px 16px;

          display:grid;grid-template-columns:1.05fr 1.5fr 1.05fr 1.05fr .92fr;

          align-items:stretch;gap:0;border-radius:18px;

          background:rgba(255,255,255,.98);box-shadow:0 24px 70px rgba(0,0,0,.28);

        }

        .search-card h2{

          display:flex;align-items:center;gap:10px;margin:0;padding:0 20px 0 6px;

          font-size:18px;line-height:1.25;border-right:1px solid #eceef0;

        }

        .search-card h2 span{display:grid;place-items:center;width:30px;height:30px;border-radius:9px;background:#fff1e9;color:var(--orange)}

        .search-card>label,.search-card .search-grid label{position:relative;display:grid;align-content:center;gap:7px;margin:0;padding:0 19px;color:#687078;border-right:1px solid #eceef0}

        .search-card>label::before,.search-card .search-grid label::before{content:"";position:absolute;left:20px;top:19px;width:5px;height:5px;border-radius:50%;background:var(--orange)}

        .search-card>label,.search-card .search-grid label{padding-top:11px}

        .search-card>label,.search-card .search-grid label{font-size:11px;letter-spacing:.02em}

        .search-card select,.search-card input{border:0;background:transparent;padding:0;color:var(--ink);font-size:14px;font-weight:700;outline:0;min-width:0}

        .search-card select{appearance:auto;cursor:pointer}

        .search-grid{display:contents}

        .search-card .primary-button{align-self:center;width:auto;min-height:58px;margin:0 0 0 15px;padding:0 20px;white-space:nowrap;border-radius:12px;box-shadow:none}

        .search-card .primary-button span{font-size:18px;margin-left:5px}

        .hero-controls{bottom:14px;z-index:1}

        @media(max-width:800px){

          .hero{height:810px}.hero-content{top:78px}.hero h1{font-size:52px}

          .search-card{bottom:56px;width:calc(100% - 36px);padding:16px;display:grid;grid-template-columns:1fr 1fr;gap:0;border-radius:16px}

          .search-card h2{grid-column:1/-1;border:0;padding:0 0 13px;font-size:17px}

          .search-card>label{grid-column:1/-1;border-top:1px solid #eceef0;border-right:0;padding:18px 0 9px}

          .search-card .search-grid label{border-top:1px solid #eceef0;padding:18px 8px 9px 0}

          .search-card .search-grid label:nth-child(2){padding-left:10px;padding-right:0;border-right:0}

          .search-card>label::before,.search-card .search-grid label::before{left:0;top:20px}

          .search-card .search-grid label:nth-child(2)::before{left:10px}

          .search-card .primary-button{grid-column:1/-1;width:100%;min-height:52px;margin:14px 0 0}

          .hero-controls{bottom:12px}

        }

      `}</style>

      <style jsx global>{`

        .bike-empty{padding:34px;border:1px dashed #d8dde1;border-radius:16px;background:#fff;text-align:center;color:#64707a}.bike-empty b{color:#1d252d;font-size:17px}.bike-empty p{margin:8px 0 0;font-size:14px}

        /* Khôi phục form tìm xe dạng thẻ dọc như bố cục ban đầu */

        .hero{height:670px}.hero-content{top:126px;max-width:590px}.search-card{top:104px;right:clamp(22px,8vw,125px);bottom:auto;left:auto;transform:none;width:365px;min-height:0;padding:28px;display:block;border-radius:18px}.search-card h2{display:block;margin:0 0 22px;padding:0;border:0;font-size:22px}.search-card h2 span{display:inline;background:transparent;width:auto;height:auto;border-radius:0}.search-card>label,.search-card .search-grid label{display:grid;align-content:normal;gap:7px;margin:0 0 15px;padding:0;border:0;font-size:12px;letter-spacing:0}.search-card>label::before,.search-card .search-grid label::before{display:none}.search-card>label{padding-top:0}.search-card select,.search-card input{border:0;border-bottom:1px solid #d8d8d8;padding:11px 0;color:#171717;font-size:14px;font-weight:500}.search-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.search-card .primary-button{display:block;width:100%;min-height:0;margin:10px 0 0;padding:15px 18px;border-radius:10px}.hero-controls{bottom:29px}

        @media(max-width:800px){.hero{height:750px}.search-card{top:auto;right:22px;bottom:70px;left:22px;transform:none;width:auto;padding:25px;display:block}.search-card h2{grid-column:auto;padding:0}.search-card>label{padding:0}.search-card .search-grid label{padding:0}.search-card .primary-button{width:100%;margin-top:10px}.hero-controls{bottom:23px}}

      `}</style>

    </main>

  );

}
