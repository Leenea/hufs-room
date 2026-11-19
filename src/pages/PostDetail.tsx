import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Heart, Bookmark, MessageCircle, Pencil, Lock, Unlock, ShieldAlert, Package, Building2, ChevronLeft } from "lucide-react";
import { api, man, ago, fmtDate, won } from "../api";
import { useAuth } from "../auth";
import { useLoad, Loading, ErrorState, CatTag, StatusPill, ConsentPill, DemoTag, Price, PeriodBar, ReportButton, FormError, Modal, RoomArt, useRequireLogin } from "../ui";
import { FLOOR_BANDS, LIFESTYLE, AVAILABILITY } from "../../shared/constants";

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  if (v === null || v === undefined || v === "") return null;
  return (
    <div className="flex py-2.5 border-b border-line last:border-0 text-sm">
      <dt className="w-28 shrink-0 text-ink-soft">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
}

export default function PostDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { me } = useAuth();
  const requireLogin = useRequireLogin();
  const r = useLoad(() => api(`/api/posts/${id}`), [id]);
  const [comment, setComment] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  if (r.loading && !r.data) return <Loading />;
  if (r.error) return <ErrorState error={r.error} retry={r.reload} />;
  const { post: p, author, comments, packageItems, mine } = r.data;
  const a = p.attributes || {};
  const housing = ["transfer_offer", "transfer_wanted", "roommate_offer", "roommate_wanted"].includes(p.category);

  const react = async (type: "like" | "save") => {
    if (!requireLogin()) return;
    await api(`/api/posts/${id}/react`, { body: { type } }).catch((e) => setErr(e.message));
    r.reload();
  };
  const startChat = async () => {
    if (!requireLogin()) return;
    setErr(null);
    try {
      const c = await api("/api/conversations", { body: { post_id: id } });
      nav(`/chat/${c.id}`);
    } catch (e: any) {
      setErr(e.message);
    }
  };
  const toggleStatus = async () => {
    setConfirmClose(false);
    await api(`/api/posts/${id}`, { method: "PATCH", body: { status: p.status === "open" ? "closed" : "open" } }).catch((e) => setErr(e.message));
    r.reload();
  };
  const addComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireLogin()) return;
    setErr(null);
    try {
      await api(`/api/posts/${id}/comments`, { body: { body: comment } });
      setComment("");
      r.reload();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <button className="inline-flex items-center text-sm text-ink-soft min-h-11 -ml-1" onClick={() => nav(-1)}><ChevronLeft size={18} />뒤로</button>
      <article className="space-y-5">
        <header>
          <div className="flex items-center gap-1.5 flex-wrap mb-2">
            <CatTag cat={p.category} />
            {housing && <StatusPill status={p.status} />}
            {p.category === "transfer_offer" && <ConsentPill v={a.consent} />}
            {p.is_demo ? <DemoTag /> : null}
          </div>
          <h1 className="text-[22px] lg:text-[26px] font-extrabold leading-snug">{p.title}</h1>
          <div className="mt-3 flex items-center gap-2.5">
            <span className="grid place-items-center w-9 h-9 rounded-full bg-brand-light text-brand-dark font-bold">{author.nickname.slice(0, 1)}</span>
            <div className="text-sm leading-tight">
              <div className="font-semibold flex items-center gap-1">{author.nickname}{author.verification_status === "verified" && <span className="text-[11px] text-brand font-bold">{author.is_demo ? "재학 인증(DEMO)" : "재학 인증"}</span>}</div>
              <div className="text-xs text-ink-soft">{ago(p.created_at)} · 조회 {p.view_count} · 작성글 {author.post_count}</div>
            </div>
            <div className="ml-auto"><ReportButton type="post" id={p.id} /></div>
          </div>
        </header>

        {p.category === "room_showcase" && <RoomArt seed={p.id} className="aspect-[16/9] rounded-2xl" label="가상 일러스트 · 사진 업로드 추후 지원" />}

        {p.category === "transfer_offer" && (
          <section className="card p-4 space-y-3">
            <Price deposit={a.deposit} rent={a.rent} maintenance={a.maintenance} />
            <PeriodBar from={a.available_from} to={a.contract_end} />
            {a.consent !== "agreed" && (
              <div className={`flex gap-2 rounded-xl p-3 text-sm ${a.consent === "refused" ? "bg-[#FDECE4] text-warn" : "bg-[#FFF4DE] text-[#7A4F00]"}`}>
                <ShieldAlert size={18} className="shrink-0" />
                {a.consent === "refused" ? "임대인이 동의하지 않은 양도예요. 계약을 진행하지 말고 정보 교환 용도로만 참고해 주세요." : "임대인 동의가 아직 확인되지 않았어요. 계약 전 반드시 임대인 동의를 받으세요(민법 제629조)."}
              </div>
            )}
            <dl>
              <Row k="건물" v={p.building_id ? <Link className="text-brand font-semibold inline-flex items-center gap-1" to={`/buildings/${p.building_id}`}><Building2 size={14} />{p.building_name} 후기 보기</Link> : a.building_name_free ? `${a.building_name_free} (미등록)` : null} />
              <Row k="방 유형" v={a.room_type} />
              <Row k="층" v={a.floor_band ? (FLOOR_BANDS as any)[a.floor_band] : null} />
              <Row k="옵션" v={a.options?.length ? a.options.join(", ") : null} />
              <Row k="양도 조건" v={a.conditions} />
            </dl>
          </section>
        )}
        {p.category === "transfer_wanted" && (
          <section className="card p-4"><dl>
            <Row k="월세 예산" v={<span className="num font-bold text-brand-dark">{man(a.budget_min)}~{man(a.budget_max)}만원</span>} />
            <Row k="보증금 상한" v={a.deposit_max != null ? `${man(a.deposit_max)}만원` : null} />
            <Row k="희망 기간" v={<PeriodBar from={a.period_from} to={a.period_to} />} />
            <Row k="선호 위치" v={a.location_pref} />
            <Row k="필수 옵션" v={a.required_options?.join(", ")} />
          </dl></section>
        )}
        {(p.category === "roommate_offer" || p.category === "roommate_wanted") && (
          <section className="card p-4"><dl>
            <Row k="1인 월 부담" v={<span className="num font-bold text-brand-dark">{man(a.budget)}만원</span>} />
            <Row k="입주 희망일" v={fmtDate(a.move_in)} />
            <Row k="구하는 인원" v={a.members ? `${a.members}명` : null} />
            <Row k="거주 형태" v={a.housing_type} />
            {Object.entries(LIFESTYLE).map(([k, d]) => <Row key={k} k={d.label} v={a.lifestyle?.[k]} />)}
            <Row k="성별(자기표기)" v={a.gender_self} />
            <Row k="선호" v={a.gender_pref} />
            <Row k="건물" v={p.building_id ? <Link className="text-brand font-semibold" to={`/buildings/${p.building_id}`}>{p.building_name}</Link> : null} />
          </dl></section>
        )}
        {p.category === "room_showcase" && (
          <section className="card p-4"><dl>
            <Row k="꾸미기 비용" v={a.budget != null ? <span className="num font-bold">{won(a.budget)}</span> : null} />
            <Row k="스타일" v={a.style_tags?.map((t: string) => `#${t}`).join(" ")} />
            <Row k="제품" v={a.products?.length ? <ul>{a.products.map((x: any, i: number) => <li key={i}>{x.name} <span className="text-ink-soft num">{x.price != null ? won(x.price) : ""}</span></li>)}</ul> : null} />
          </dl></section>
        )}

        <div className="whitespace-pre-wrap text-[16px] leading-7">{p.body}</div>

        {(packageItems.length > 0 || a.package?.enabled) && (
          <section className="card p-4">
            <h2 className="font-bold flex items-center gap-1.5 mb-1"><Package size={18} className="text-brand" />자취템 패키지 (선택)</h2>
            <p className="text-xs text-ink-soft mb-2">방 양도와 물품 구매는 별개예요. 패키지 구매가 양도 조건이 될 수 없어요.</p>
            {a.package?.note && <p className="text-sm">{a.package.note} {a.package.price != null && <b className="num text-brand-dark">· 일괄 {man(a.package.price)}만원</b>}</p>}
            <ul className="mt-2 divide-y divide-line">
              {packageItems.map((m: any) => (
                <li key={m.id}><Link to={`/market/${m.id}`} className="flex items-center py-2 text-sm min-h-11"><span className="flex-1">{m.title}</span><span className="text-xs text-ink-soft mr-2">{(AVAILABILITY as any)[m.availability]}</span><b className="num">{won(m.price)}</b></Link></li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex items-center gap-2 border-y border-line py-2">
          <button className={`btn ${mine.like ? "btn-ghost" : "btn-line"} !min-h-10 text-sm`} onClick={() => react("like")} aria-pressed={mine.like}><Heart size={16} fill={mine.like ? "currentColor" : "none"} />{p.like_count}</button>
          <button className={`btn ${mine.save ? "btn-ghost" : "btn-line"} !min-h-10 text-sm`} onClick={() => react("save")} aria-pressed={mine.save}><Bookmark size={16} fill={mine.save ? "currentColor" : "none"} />저장</button>
          {p.isMine && (
            <div className="ml-auto flex gap-2">
              <Link to={`/posts/${p.id}/edit`} className="btn btn-line !min-h-10 text-sm"><Pencil size={15} />수정</Link>
              {housing && <button className="btn btn-line !min-h-10 text-sm" onClick={() => setConfirmClose(true)}>{p.status === "open" ? <><Lock size={15} />모집종료</> : <><Unlock size={15} />다시 열기</>}</button>}
            </div>
          )}
        </div>
        <FormError msg={err} />

        {!p.isMine && housing && (
          <div className="sticky bottom-[72px] lg:bottom-4 z-30">
            <button className="btn btn-primary w-full !min-h-[52px] text-[16px] shadow-lg" onClick={startChat} disabled={p.status === "closed"}>
              <MessageCircle size={19} />{p.status === "closed" ? "모집이 마감된 글이에요" : "문의하기 · 1:1 채팅"}
            </button>
            <p className="text-center text-xs text-ink-soft mt-1 bg-white/80">전화번호 공개 없이 앱 안에서 대화해요</p>
          </div>
        )}

        <section>
          <h2 className="font-bold mb-2">댓글 {comments.length}</h2>
          <ul className="space-y-3 mb-3">
            {comments.map((c: any) => (
              <li key={c.id} className="rounded-xl bg-paper p-3">
                <div className="flex items-center text-xs text-ink-soft mb-1"><b className="text-ink mr-2">{c.nickname}</b>{ago(c.created_at)}<span className="ml-auto"><ReportButton small type="comment" id={c.id} /></span></div>
                <p className="text-sm whitespace-pre-wrap">{c.body}</p>
              </li>
            ))}
          </ul>
          <form onSubmit={addComment} className="flex gap-2">
            <label className="flex-1"><span className="sr-only">댓글</span>
              <input className="input" placeholder={me.user ? "댓글을 남겨 주세요" : "로그인 후 댓글을 쓸 수 있어요"} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} onFocus={() => !me.user && requireLogin()} />
            </label>
            <button className="btn btn-primary" disabled={!comment.trim()}>등록</button>
          </form>
        </section>
      </article>
      <Modal open={confirmClose} onClose={() => setConfirmClose(false)} title={p.status === "open" ? "모집을 종료할까요?" : "다시 모집할까요?"}>
        <p className="text-sm text-ink-soft mb-4">{p.status === "open" ? "종료하면 새 문의를 받을 수 없어요. 기존 대화는 그대로 유지돼요." : "다시 새 문의를 받을 수 있어요."}</p>
        <div className="flex gap-2"><button className="btn btn-line flex-1" onClick={() => setConfirmClose(false)}>취소</button><button className="btn btn-primary flex-1" onClick={toggleStatus}>확인</button></div>
      </Modal>
    </div>
  );
}
