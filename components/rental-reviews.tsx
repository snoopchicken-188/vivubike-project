"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

type Review = {
  id: string; bookingId: string; bookingCode: string; vehicleName: string;
  customerName: string; rating: number; comment: string; createdAt: string;
  reply: { content: string; staffName: string; updatedAt: string } | null;
};
type CompletedBooking = { id: string; code: string; bike: string; status: string };
async function requestReviews(method = "GET", body?: object, signal?: AbortSignal) {
  const user = auth.currentUser;
  if (!user) throw new Error("Bạn cần đăng nhập lại.");
  const token = await user.getIdToken();
  const response = await fetch("/api/reviews", {
    method, headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), cache: "no-store", signal,
  });
  let result;
  try { result = await response.json(); }
  catch { throw new Error("Máy chủ chưa xử lý được đánh giá. Hãy kiểm tra file API và cấu hình Firebase Admin."); }
  if (!response.ok) throw new Error(result.error || "Không xử lý được đánh giá.");
  return result;
}
function useReviews() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    controller.current?.abort();
    const current = new AbortController(); controller.current = current;
    try {
      const result = await requestReviews("GET", undefined, current.signal);
      if (!current.signal.aborted) { setReviews(result.reviews); setError(""); }
    } catch (error) {
      if (!current.signal.aborted) setError(error instanceof Error ? error.message : "Không tải được đánh giá.");
    } finally { if (!current.signal.aborted) setLoading(false); }
  }, []);
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, () => { setReviews([]); setLoading(true); void refresh(); });
    const timer = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 20_000);
    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    return () => { unsubscribe(); clearInterval(timer); window.removeEventListener("focus", onFocus); controller.current?.abort(); };
  }, [refresh]);
  return { reviews, loading, error, refresh };
}
const dateLabel = (value: string) => {
  const date = new Date(value);
  return value && Number.isFinite(date.getTime()) ? date.toLocaleString("vi-VN") : "";
};
function ReviewContent({ review }: { review: Review }) {
  return <>
    <p className="rv-stars" aria-label={`${review.rating} trên 5 sao`}>{"★".repeat(Math.max(0, Math.min(5, review.rating)))}{"☆".repeat(Math.max(0, 5 - Math.min(5, review.rating)))}</p>
    <p className="rv-text">{review.comment}</p>
    <small className="rv-muted">{dateLabel(review.createdAt)}</small>
    {review.reply?.content && <div className="rv-reply"><b>Phản hồi từ {review.reply.staffName}</b><p className="rv-text">{review.reply.content}</p><small>{dateLabel(review.reply.updatedAt)}</small></div>}
  </>;
}
function ReviewStyles() {
  return <style jsx global>{`
    .rv-page{padding:30px clamp(18px,3vw,48px);color:#202a32}.rv-page h2{font-size:28px;margin:0 0 10px}.rv-page h3{font-size:18px;margin:0 0 8px}.rv-page p{line-height:1.6}.rv-page .rv-subtitle,.rv-muted{color:#687684}.rv-toolbar{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:24px}.rv-card{background:#fff;border:1px solid #e2e7eb;border-radius:12px;padding:24px;margin:18px 0}.rv-card header{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;background:none;box-shadow:none;padding:0;height:auto}.rv-stars{color:#ed851b;font-size:26px;letter-spacing:3px;margin:12px 0}.rv-text{white-space:pre-wrap;overflow-wrap:anywhere}.rv-reply{margin-top:18px;padding:16px;background:#fff7f1;border-left:3px solid #f26522;border-radius:4px}.rv-page textarea{display:block;box-sizing:border-box;width:100%;min-height:110px;padding:12px;border:1px solid #d5dde3;border-radius:8px;font:inherit;resize:vertical;margin:10px 0}.rv-page button{cursor:pointer;font:inherit}.rv-page button:disabled{opacity:.55;cursor:wait}.rv-primary,.rv-secondary{border-radius:7px;padding:10px 16px;border:1px solid #d8dfe4}.rv-primary{background:#f26522;color:white;border-color:#f26522}.rv-secondary{background:white;color:#34424e}.rv-rating{display:flex;gap:6px;margin:12px 0}.rv-rating button{background:none;border:0;color:#ed851b;font-size:34px;padding:4px;line-height:1}.rv-rating button:focus-visible{outline:2px solid #34424e;border-radius:4px}.rv-page label{display:block;font-weight:600}.rv-alert{padding:14px;border:1px solid #efc2b5;border-radius:8px;background:#fff3ef;margin:16px 0}.rv-notice{padding:14px;background:#edf8ef;border-radius:8px;margin:16px 0}.rv-page select{font:inherit;padding:9px;border:1px solid #d8dfe4;border-radius:6px}.rv-form-footer{display:flex;gap:16px;justify-content:space-between;align-items:center;flex-wrap:wrap}.rv-status{color:#8b5419;font-size:13px}@media(max-width:600px){.rv-card{padding:18px}.rv-card header{flex-direction:column}}
  `}</style>;
}

export function CustomerReviews({ bookings }: { bookings: CompletedBooking[] }) {
  const { reviews, loading, error, refresh } = useReviews();
  const [drafts, setDrafts] = useState<Record<string, { rating: number; comment: string }>>({});
  const [saving, setSaving] = useState("");
  const [notice, setNotice] = useState("");
  const [submitError, setSubmitError] = useState("");
  const completed = bookings.filter(booking => booking.status === "Đã hoàn thành");
  const cards = [
    ...completed.map(booking => ({ id: booking.id, code: booking.code, bike: booking.bike, review: reviews.find(review => review.bookingId === booking.id) })),
    ...reviews.filter(review => !completed.some(booking => booking.id === review.bookingId)).map(review => ({ id: review.bookingId, code: review.bookingCode, bike: review.vehicleName, review })),
  ];
  const submit = async (bookingId: string) => {
    const draft = drafts[bookingId] || { rating: 5, comment: "" };
    setSaving(bookingId); setNotice(""); setSubmitError("");
    try {
      const result = await requestReviews("POST", { bookingId, rating: draft.rating, comment: draft.comment });
      setNotice(result.message); await refresh();
    } catch (error) { setSubmitError(error instanceof Error ? error.message : "Không gửi được đánh giá."); await refresh(); }
    finally { setSaving(""); }
  };
  return <div className="rv-page">
    <ReviewStyles />
    <div className="rv-toolbar"><div><h2>Đánh giá của tôi</h2><p className="rv-subtitle">Chia sẻ trải nghiệm sau khi hoàn thành đơn thuê và xem phản hồi từ nhân viên.</p></div><button className="rv-secondary" onClick={() => void refresh()}>Tải lại</button></div>
    {notice && <p className="rv-notice" role="status">{notice}</p>}
    {(error || submitError) && <p className="rv-alert" role="alert">{submitError || error}</p>}
    {loading ? <p role="status">Đang tải đánh giá…</p> : !error && !cards.length ? <section className="rv-card"><h3>Chưa có đơn thuê đủ điều kiện đánh giá</h3><p>Khi nhân viên hoàn tất đơn thuê của bạn, đơn sẽ xuất hiện tại đây.</p></section> : cards.map(card => {
      const draft = drafts[card.id] || { rating: 5, comment: "" };
      return <article className="rv-card" key={card.id}>
        <header><div><h3>{card.bike}</h3><small className="rv-muted">Mã phiếu: {card.code}</small></div><span className="rv-status">{card.review ? "Đã đánh giá" : "Hoàn thành · Chưa đánh giá"}</span></header>
        {card.review ? <ReviewContent review={card.review} /> : <form onSubmit={event => { event.preventDefault(); void submit(card.id); }}>
          <fieldset style={{ border: 0, padding: 0, margin: "16px 0" }} disabled={!!saving || !!error}>
            <legend>Bạn hài lòng với chuyến thuê này như thế nào?</legend>
            <div className="rv-rating" role="group" aria-label="Chọn số sao">{[1, 2, 3, 4, 5].map(star => <button key={star} type="button" aria-label={`${star} sao`} aria-pressed={draft.rating === star} onClick={() => setDrafts(current => ({ ...current, [card.id]: { ...draft, rating: star } }))}>{star <= draft.rating ? "★" : "☆"}</button>)}</div>
            <label htmlFor={`review-${card.id}`}>Nhận xét của bạn</label>
            <textarea id={`review-${card.id}`} required maxLength={2000} value={draft.comment} placeholder="Trải nghiệm về xe và dịch vụ…" onChange={event => setDrafts(current => ({ ...current, [card.id]: { ...draft, comment: event.target.value } }))} />
            <div className="rv-form-footer"><small className="rv-muted">{draft.comment.length}/2.000 ký tự · Mỗi đơn đánh giá một lần</small><button className="rv-primary" disabled={!draft.comment.trim()}>{saving === card.id ? "Đang gửi…" : "Gửi đánh giá"}</button></div>
          </fieldset>
        </form>}
      </article>;
    })}
  </div>;
}

export function StaffReviews() {
  const { reviews, loading, error, refresh } = useReviews();
  const [filter, setFilter] = useState("all");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState("");
  const [notice, setNotice] = useState("");
  const [submitError, setSubmitError] = useState("");
  const displayed = reviews.filter(review => filter === "all" || (filter === "pending" ? !review.reply?.content : !!review.reply?.content));
  const submit = async (review: Review) => {
    setSaving(review.id); setNotice(""); setSubmitError("");
    try {
      const result = await requestReviews("PATCH", { reviewId: review.id, content: drafts[review.id] ?? review.reply?.content ?? "" });
      setNotice(result.message);
      setDrafts(current => { const next = { ...current }; delete next[review.id]; return next; });
      await refresh();
    } catch (error) { setSubmitError(error instanceof Error ? error.message : "Không lưu được phản hồi."); }
    finally { setSaving(""); }
  };
  return <div className="rv-page">
    <ReviewStyles />
    <div className="rv-toolbar"><div><h2>Đánh giá khách hàng</h2><p className="rv-subtitle">Xem nhận xét và phản hồi khách hàng tại đây.</p></div><button className="rv-secondary" onClick={() => void refresh()}>Tải lại</button></div>
    <label>Lọc đánh giá <select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">Tất cả ({reviews.length})</option><option value="pending">Chưa phản hồi ({reviews.filter(review => !review.reply?.content).length})</option><option value="replied">Đã phản hồi ({reviews.filter(review => !!review.reply?.content).length})</option></select></label>
    {notice && <p className="rv-notice" role="status">{notice}</p>}
    {(error || submitError) && <p className="rv-alert" role="alert">{submitError || error}</p>}
    {loading ? <p role="status">Đang tải đánh giá…</p> : !error && !displayed.length ? <section className="rv-card">Chưa có đánh giá trong nhóm này.</section> : displayed.map(review => {
      const content = drafts[review.id] ?? review.reply?.content ?? "";
      return <article className="rv-card" key={review.id}>
        <header><div><h3>{review.vehicleName}</h3><small className="rv-muted">{review.bookingCode} · {review.customerName}</small></div><span className="rv-status">{review.reply?.content ? "Đã phản hồi" : "Chưa phản hồi"}</span></header>
        <ReviewContent review={review} />
        <form onSubmit={event => { event.preventDefault(); void submit(review); }}>
          <label htmlFor={`reply-${review.id}`} style={{ marginTop: 20 }}>{review.reply?.content ? "Cập nhật phản hồi" : "Phản hồi khách hàng"}</label>
          <textarea id={`reply-${review.id}`} required maxLength={2000} disabled={!!saving || !!error} value={content} placeholder="Nhập phản hồi của cửa hàng…" onChange={event => setDrafts(current => ({ ...current, [review.id]: event.target.value }))} />
          <div className="rv-form-footer"><small className="rv-muted">{content.length}/2.000 ký tự</small><button className="rv-primary" disabled={!!saving || !!error || !content.trim()}>{saving === review.id ? "Đang lưu…" : review.reply?.content ? "Lưu phản hồi" : "Gửi phản hồi"}</button></div>
        </form>
      </article>;
    })}
  </div>;
}
