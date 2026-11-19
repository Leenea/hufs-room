import { useEffect, useState, FormEvent } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import { ShieldCheck, Star } from "lucide-react";
import { api, toWon } from "../api";
import { useAuth } from "../auth";
import { FormError, Loading } from "../ui";
import { Field, ManInput, MultiChips } from "./PostNew";
import { RATING_ITEMS, CONTRACT_METHODS, FLOOR_BANDS, ROOM_TYPES, ORIENTATIONS, OPTIONS } from "../../shared/constants";

function RatingInput({ value, onChange, label }: { value: number | null; onChange: (v: number | null) => void; label: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-line last:border-0">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button type="button" key={i} role="radio" aria-checked={value === i} aria-label={`${i}점`} className="w-9 h-11 grid place-items-center" onClick={() => onChange(i)}>
            <Star size={24} strokeWidth={0} fill={value !== null && i <= value ? "#D9A43F" : "#E5DCC8"} />
          </button>
        ))}
        <button type="button" className={`ml-1 chip !min-h-9 !px-2 text-xs ${value === null ? "on" : ""}`} onClick={() => onChange(null)}>N/A</button>
      </div>
    </div>
  );
}

export default function ReviewNew() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const { me, loading, refresh } = useAuth();
  const [buildings, setBuildings] = useState<any[]>([]);
  const [bid, setBid] = useState(sp.get("building") || "");
  const [f, setF] = useState<any>({ start_month: "", end_month: "", floor_band: "", orientation: "", room_type: "", contract_method: "", renewal_intent: "", body: "", options: [], request_verification: false });
  const [money, setMoney] = useState<Record<string, string>>({});
  const [ratings, setRatings] = useState<Record<string, number | null>>(Object.fromEntries(Object.keys(RATING_ITEMS).map((k) => [k, null])));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  useEffect(() => { api("/api/buildings?sort=name").then((r) => setBuildings(r.items)).catch(() => {}); }, []);
  useEffect(() => {
    if (!id || !me.user) return;
    api(`/api/reviews/${id}`).then(({ review: r }) => {
      setBid(r.building_id);
      setF({ ...r, floor_band: r.floor_band || "", orientation: r.orientation || "", room_type: r.room_type || "", contract_method: r.contract_method || "", renewal_intent: r.renewal_intent || "" });
      setRatings(r.ratings);
      setMoney(Object.fromEntries(["deposit", "monthly_rent", "maintenance_fee", "broker_fee"].map((k) => [k, r[k] == null ? "" : String(r[k] / 10000)])));
    }).catch((e) => setErr(e.message));
  }, [id, me.user]);

  if (loading) return <Loading />;
  if (!me.user) return (
    <div className="card p-8 text-center max-w-md mx-auto mt-6">
      <p className="font-bold text-lg mb-1">후기 작성은 로그인 후 가능해요</p>
      <Link className="btn btn-primary mt-3" to={`/login?next=${encodeURIComponent(`/reviews/new?building=${bid}`)}`}>로그인 / 체험하기</Link>
    </div>
  );
  if (done) return (
    <div className="card p-8 text-center max-w-md mx-auto mt-6 space-y-3">
      <ShieldCheck className="mx-auto text-ok" size={40} />
      <p className="font-extrabold text-xl">후기가 {done === "published" ? "공개됐어요" : "검토 대기 중이에요"}</p>
      <p className="text-sm text-ink-soft">{done === "published" ? "이제 모든 건물의 상세 후기와 실제 계약금액을 볼 수 있어요. (시연 모드: 자동 승인)" : "관리자 승인 후 공개되며, 그때 전체 열람 권한이 열려요."}</p>
      <button className="btn btn-primary w-full" onClick={() => nav(`/buildings/${bid}`)}>건물 상세로 가기</button>
    </div>
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const body = { ...f, building_id: bid, ratings, ...Object.fromEntries(Object.entries(money).map(([k, v]) => [k, toWon(v)])) };
    for (const k of ["floor_band", "orientation", "room_type", "contract_method", "renewal_intent"]) if (!body[k]) body[k] = null;
    try {
      if (id) {
        await api(`/api/reviews/${id}`, { method: "PATCH", body });
        nav(`/buildings/${bid}`);
      } else {
        const r = await api("/api/reviews", { body });
        await refresh();
        setDone(r.status);
      }
    } catch (e: any) {
      setErr(e.message + (e.data?.existingId ? " (마이페이지에서 기존 후기를 수정할 수 있어요)" : ""));
      setBusy(false);
    }
  };
  const rated = Object.values(ratings).filter((v) => v !== null).length;

  return (
    <form onSubmit={submit} className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">{id ? "후기 수정" : "원룸 후기 쓰기"}</h1>
        <p className="text-sm text-ink-soft">후기 1건이면 모든 건물의 상세 후기·실제 계약가가 열려요.</p>
      </div>
      <div className="rounded-xl bg-paper p-3 text-sm space-y-1">
        <p className="font-semibold">개인정보 보호 안내</p>
        <p className="text-ink-soft">정확한 호수, 이름, 연락처, 임대인 개인정보는 적지 마세요. 층은 범위(저/중/고층)로만 기록해요. 허위 후기·모욕은 신고 후 숨김 처리될 수 있어요.</p>
      </div>
      <Field label="건물">
        <select className="input" value={bid} onChange={(e) => setBid(e.target.value)} required disabled={!!id}>
          <option value="">건물 선택</option>
          {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </Field>
      <p className="text-xs -mt-4">목록에 없나요? <Link to="/buildings/new" className="text-brand font-semibold">건물 등록 요청</Link></p>

      <fieldset className="space-y-3">
        <legend className="font-bold mb-2">실제 거주 정보</legend>
        <div className="grid grid-cols-2 gap-2">
          <Field label="입주 월"><input type="month" className="input" value={f.start_month} onChange={(e) => set("start_month", e.target.value)} required /></Field>
          <Field label="퇴거(예정) 월"><input type="month" className="input" value={f.end_month} onChange={(e) => set("end_month", e.target.value)} required /></Field>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Field label="층"><select className="input" value={f.floor_band} onChange={(e) => set("floor_band", e.target.value)}><option value="">선택</option>{Object.entries(FLOOR_BANDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <Field label="방향"><select className="input" value={f.orientation} onChange={(e) => set("orientation", e.target.value)}><option value="">선택</option>{ORIENTATIONS.map((o) => <option key={o}>{o}</option>)}</select></Field>
          <Field label="방 유형"><select className="input" value={f.room_type} onChange={(e) => set("room_type", e.target.value)}><option value="">선택</option>{ROOM_TYPES.map((o) => <option key={o}>{o}</option>)}</select></Field>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-bold mb-2">실제 계약 비용 <span className="text-xs font-normal text-ink-soft">작성 시점과 함께 표시돼 현재 시세와 구분돼요</span></legend>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[["deposit", "보증금"], ["monthly_rent", "월세"], ["maintenance_fee", "관리비"], ["broker_fee", "중개보수"]].map(([k, l]) => (
            <Field key={k} label={l}><ManInput value={money[k] || ""} onChange={(v) => setMoney((p) => ({ ...p, [k]: v }))} /></Field>
          ))}
        </div>
        <Field label="계약 경로"><div className="grid grid-cols-4 gap-1.5">{Object.entries(CONTRACT_METHODS).map(([k, l]) => <button type="button" key={k} className="chip justify-center" aria-pressed={f.contract_method === k} onClick={() => set("contract_method", k)}>{l}</button>)}</div></Field>
        <div><span className="label">옵션</span><MultiChips all={OPTIONS} value={f.options} onChange={(v) => set("options", v)} /></div>
      </fieldset>

      <fieldset>
        <legend className="font-bold mb-1">세부 평가 <span className="text-xs font-normal text-ink-soft">({rated}/9 · 3개 이상, 모르면 N/A)</span></legend>
        <div className="card px-4">
          {Object.entries(RATING_ITEMS).map(([k, l]) => <RatingInput key={k} label={l} value={ratings[k]} onChange={(v) => setRatings((p) => ({ ...p, [k]: v }))} />)}
        </div>
      </fieldset>

      <Field label="재계약 의향"><div className="grid grid-cols-3 gap-1.5">{[["yes", "있음"], ["unsure", "고민 중"], ["no", "없음"]].map(([k, l]) => <button type="button" key={k} className="chip justify-center" aria-pressed={f.renewal_intent === k} onClick={() => set("renewal_intent", k)}>{l}</button>)}</div></Field>
      <Field label="상세 후기 (20자 이상)"><textarea className="input min-h-40" value={f.body} onChange={(e) => set("body", e.target.value)} maxLength={3000} required placeholder="소음, 채광, 관리 응대, 겨울 난방비 등 다음 입주자에게 도움이 될 이야기를 적어 주세요." /></Field>
      {!id && (
        <label className="card p-4 flex gap-3 items-start cursor-pointer">
          <input type="checkbox" className="w-5 h-5 mt-0.5 accent-brand" checked={f.request_verification} onChange={(e) => set("request_verification", e.target.checked)} />
          <span className="text-sm"><b>실거주 인증 신청 (선택)</b><br /><span className="text-ink-soft">MVP에서는 '검토 대기' 상태만 표시돼요. 실제 증빙 서류 검증은 추후 지원하며, 계약서·신분증을 업로드하지 않아요.</span></span>
        </label>
      )}
      <FormError msg={err} />
      <div className="flex gap-2">
        <button type="button" className="btn btn-line" onClick={() => nav(-1)}>취소</button>
        <button className="btn btn-primary flex-1" disabled={busy}>{busy ? "저장 중…" : id ? "수정 저장" : "후기 등록"}</button>
      </div>
    </form>
  );
}
