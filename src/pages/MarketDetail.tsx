import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ChevronLeft, MessageCircle, Pencil, KeyRound } from "lucide-react";
import { api, won, fmtDate, ago } from "../api";
import { useLoad, Loading, ErrorState, DemoTag, ReportButton, FormError, useRequireLogin } from "../ui";
import { ItemThumb } from "./Market";
import { MARKET_CATEGORIES, CONDITIONS, AVAILABILITY } from "../../shared/constants";

export default function MarketDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const requireLogin = useRequireLogin();
  const r = useLoad(() => api(`/api/market/${id}`), [id]);
  const [err, setErr] = useState<string | null>(null);
  if (r.loading && !r.data) return <Loading />;
  if (r.error) return <ErrorState error={r.error} retry={r.reload} />;
  const m = r.data.item;
  const chat = async () => {
    if (!requireLogin()) return;
    try {
      const c = await api("/api/conversations", { body: { market_item_id: id } });
      nav(`/chat/${c.id}`);
    } catch (e: any) { setErr(e.message); }
  };
  const setAv = async (v: string) => {
    await api(`/api/market/${id}`, { method: "PATCH", body: { availability: v } }).catch((e) => setErr(e.message));
    r.reload();
  };
  return (
    <div className="max-w-3xl mx-auto">
      <button className="inline-flex items-center text-sm text-ink-soft min-h-11 -ml-1" onClick={() => nav(-1)}><ChevronLeft size={18} />뒤로</button>
      <div className="grid md:grid-cols-2 gap-5">
        <div>
          <ItemThumb cat={m.category} className="aspect-square" />
          <p className="text-xs text-ink-soft mt-1">사진 업로드는 추후 지원 · 카테고리 아이콘으로 대체</p>
        </div>
        <div className="space-y-3">
          <div className="flex gap-1.5 items-center"><span className="text-xs font-bold bg-paper rounded px-1.5 py-0.5">{(MARKET_CATEGORIES as any)[m.category]}</span><span className="text-xs font-bold bg-ink text-white rounded px-1.5 py-0.5">{(AVAILABILITY as any)[m.availability]}</span>{m.is_demo ? <DemoTag /> : null}</div>
          <h1 className="text-2xl font-extrabold">{m.title}</h1>
          <p className={`num text-2xl font-extrabold ${m.price === 0 ? "text-ok" : "text-brand-dark"}`}>{m.price === 0 ? "무료 나눔" : won(m.price)}</p>
          <dl className="text-sm space-y-1.5">
            <div className="flex"><dt className="w-24 text-ink-soft">사용 상태</dt><dd>{(CONDITIONS as any)[m.condition]}</dd></div>
            <div className="flex"><dt className="w-24 text-ink-soft">인계 희망일</dt><dd className="num">{fmtDate(m.handover_date)}</dd></div>
            <div className="flex"><dt className="w-24 text-ink-soft">대략 지역</dt><dd>{m.area || "-"}</dd></div>
            <div className="flex"><dt className="w-24 text-ink-soft">판매자</dt><dd>{m.author_nickname} · {ago(m.created_at)}</dd></div>
          </dl>
          {m.post_id && (
            <Link to={`/posts/${m.post_id}`} className="card p-3 flex items-center gap-2 text-sm hover:border-brand/40"><KeyRound size={16} className="text-brand" /><span className="flex-1">방 양도 글과 함께 패키지로 올라온 물건이에요<br /><b>{m.post_title}</b></span></Link>
          )}
          <p className="whitespace-pre-wrap">{m.body}</p>
          <FormError msg={err} />
          {m.isMine ? (
            <div className="space-y-2">
              <div className="flex gap-1.5">{Object.entries(AVAILABILITY).map(([k, l]) => <button key={k} className="chip flex-1 justify-center" aria-pressed={m.availability === k} onClick={() => setAv(k)}>{l}</button>)}</div>
              <Link to={`/market/${m.id}/edit`} className="btn btn-line w-full"><Pencil size={16} />수정</Link>
            </div>
          ) : (
            <button className="btn btn-primary w-full !min-h-[52px]" onClick={chat} disabled={m.availability === "done"}><MessageCircle size={18} />{m.availability === "done" ? "거래 완료된 물건" : "채팅으로 거래하기"}</button>
          )}
          <p className="text-xs text-ink-soft">외대원룸은 결제·에스크로를 제공하지 않아요. 직접 만나 확인 후 거래하세요.</p>
          <ReportButton type="market" id={m.id} />
        </div>
      </div>
    </div>
  );
}
