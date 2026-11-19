import { useEffect, useState, FormEvent, ReactNode } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import { ShieldAlert, Info } from "lucide-react";
import { api, toWon } from "../api";
import { useAuth } from "../auth";
import { FormError, Loading } from "../ui";
import { CATEGORIES, Category, LANDLORD_CONSENT, LIFESTYLE, OPTIONS, ROOM_TYPES, FLOOR_BANDS } from "../../shared/constants";

const toMan = (w: any) => (w === null || w === undefined ? "" : String(w / 10000));
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="block text-xs text-ink-soft mt-1">{hint}</span>}
    </label>
  );
}
export function ManInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <input className="input num pr-12" inputMode="decimal" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))} />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-soft">만원</span>
    </div>
  );
}
export function MultiChips({ all, value, onChange, labels }: { all: readonly string[]; value: string[]; onChange: (v: string[]) => void; labels?: Record<string, string> }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {all.map((o) => (
        <button type="button" key={o} className="chip" aria-pressed={value.includes(o)} onClick={() => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o])}>{labels?.[o] ?? o}</button>
      ))}
    </div>
  );
}

export default function PostNew() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const { me, loading } = useAuth();
  const [cat, setCat] = useState<Category>((sp.get("category") as Category) in CATEGORIES ? (sp.get("category") as Category) : "transfer_offer");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [buildingId, setBuildingId] = useState("");
  const [a, setA] = useState<any>({ consent: "", options: [], lifestyle: {}, required_options: [], package: { enabled: false, item_ids: [] }, style_tags: [], products: [] });
  const [m, setM] = useState<Record<string, string>>({});
  const [buildings, setBuildings] = useState<any[]>([]);
  const [myItems, setMyItems] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(!id);
  const setAttr = (k: string, v: any) => setA((p: any) => ({ ...p, [k]: v }));
  const setMan = (k: string) => (v: string) => setM((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    api("/api/buildings?sort=name").then((r) => setBuildings(r.items)).catch(() => {});
    if (me.user) api("/api/market?mine=1").then((r) => setMyItems(r.items)).catch(() => {});
  }, [me.user]);
  useEffect(() => {
    if (!id) return;
    api(`/api/posts/${id}`).then((r) => {
      if (!r.post.isMine) return setErr("작성자만 수정할 수 있어요.");
      const p = r.post;
      setCat(p.category); setTitle(p.title); setBody(p.body); setBuildingId(p.building_id || "");
      setA({ options: [], lifestyle: {}, required_options: [], package: { enabled: false, item_ids: [] }, style_tags: [], products: [], ...p.attributes });
      const mm: Record<string, string> = {};
      for (const k of ["deposit", "rent", "maintenance", "budget_min", "budget_max", "deposit_max", "budget"]) if (p.attributes[k] != null) mm[k] = toMan(p.attributes[k]);
      if (p.attributes.package?.price != null) mm.pkg_price = toMan(p.attributes.package.price);
      setM(mm);
      setLoaded(true);
    }).catch((e) => setErr(e.message));
  }, [id]);

  if (loading || !loaded) return err ? <FormError msg={err} /> : <Loading />;
  if (!me.user) return (
    <div className="card p-8 text-center max-w-md mx-auto mt-6">
      <p className="font-bold text-lg mb-1">글쓰기는 로그인 후 이용할 수 있어요</p>
      <p className="text-sm text-ink-soft mb-4">체험 계정으로 바로 시작할 수 있어요.</p>
      <Link className="btn btn-primary" to={`/login?next=${encodeURIComponent("/posts/new" + (sp.toString() ? "?" + sp : ""))}`}>로그인 / 체험하기</Link>
    </div>
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const attrs: any = { ...a };
    for (const [k, v] of Object.entries(m)) if (k !== "pkg_price") attrs[k] = toWon(v);
    if (attrs.package?.enabled) attrs.package = { ...attrs.package, price: toWon(m.pkg_price || "") };
    try {
      const payload = { category: cat, title, body, building_id: buildingId || null, attributes: attrs };
      if (id) {
        await api(`/api/posts/${id}`, { method: "PATCH", body: payload });
        nav(`/posts/${id}`);
      } else {
        const r = await api("/api/posts", { body: payload });
        nav(`/posts/${r.id}`, { replace: true });
      }
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  };

  const life = (
    <fieldset className="grid sm:grid-cols-2 gap-3">
      <legend className="label">생활 선호 (선택)</legend>
      {Object.entries(LIFESTYLE).map(([k, def]) => (
        <Field key={k} label={def.label}>
          <select className="input" value={a.lifestyle?.[k] || ""} onChange={(e) => setAttr("lifestyle", { ...a.lifestyle, [k]: e.target.value || undefined })}>
            <option value="">선택 안 함</option>
            {def.options.map((o) => <option key={o}>{o}</option>)}
          </select>
        </Field>
      ))}
    </fieldset>
  );

  return (
    <form onSubmit={submit} className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-extrabold">{id ? "글 수정" : "글쓰기"}</h1>
      {!id && (
        <fieldset>
          <legend className="label">게시판</legend>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(Object.keys(CATEGORIES) as Category[]).map((c) => (
              <button type="button" key={c} className="chip justify-center" aria-pressed={cat === c} onClick={() => setCat(c)}>{CATEGORIES[c]}</button>
            ))}
          </div>
        </fieldset>
      )}

      <div className="rounded-xl bg-paper p-3 text-sm flex gap-2">
        <ShieldAlert size={18} className="text-brand shrink-0 mt-0.5" />
        <span>정확한 호수·전화번호·실명은 적지 마세요. 연락은 글 상세의 <b>문의하기(1:1 채팅)</b>로 이어져요. 서버에서 전화번호·호수 패턴을 자동으로 막아요.</span>
      </div>

      <Field label="제목"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} required /></Field>

      {(cat === "transfer_offer" || cat === "roommate_offer" || cat === "room_showcase") && (
        <Field label="건물 (선택)" hint="목록에 없으면 비워 두고 아래에 건물명만 적거나, 건물 등록을 요청해 주세요.">
          <select className="input" value={buildingId} onChange={(e) => setBuildingId(e.target.value)}>
            <option value="">선택 안 함 / 미등록 건물</option>
            {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </Field>
      )}

      {cat === "transfer_offer" && (
        <div className="space-y-4">
          {!buildingId && <Field label="미등록 건물명 (선택)"><input className="input" value={a.building_name_free || ""} onChange={(e) => setAttr("building_name_free", e.target.value)} maxLength={40} /></Field>}
          <div className="grid grid-cols-3 gap-2">
            <Field label="보증금"><ManInput value={m.deposit || ""} onChange={setMan("deposit")} /></Field>
            <Field label="월세"><ManInput value={m.rent || ""} onChange={setMan("rent")} /></Field>
            <Field label="관리비"><ManInput value={m.maintenance || ""} onChange={setMan("maintenance")} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="입주 가능일"><input type="date" className="input" value={a.available_from || ""} onChange={(e) => setAttr("available_from", e.target.value)} required /></Field>
            <Field label="계약 종료일"><input type="date" className="input" value={a.contract_end || ""} onChange={(e) => setAttr("contract_end", e.target.value)} required /></Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="방 유형"><select className="input" value={a.room_type || ""} onChange={(e) => setAttr("room_type", e.target.value || null)}><option value="">선택</option>{ROOM_TYPES.map((r) => <option key={r}>{r}</option>)}</select></Field>
            <Field label="층"><select className="input" value={a.floor_band || ""} onChange={(e) => setAttr("floor_band", e.target.value || null)}><option value="">선택</option>{Object.entries(FLOOR_BANDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          </div>
          <fieldset>
            <legend className="label">임대인 동의 상태 <span className="text-warn">*</span></legend>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(LANDLORD_CONSENT).map(([k, l]) => (
                <button type="button" key={k} className="chip justify-center" aria-pressed={a.consent === k} onClick={() => setAttr("consent", k)}>{l}</button>
              ))}
            </div>
            {a.consent === "refused" && <p className="mt-2 text-sm text-warn font-medium">임대인이 동의하지 않은 상태에서는 양도 계약을 진행하면 안 돼요. 정보 교환 목적으로만 게시돼요.</p>}
            {a.consent === "unknown" && <p className="mt-2 text-sm text-[#8A5A00]">계약 전 반드시 임대인 동의를 받아 주세요. (민법 제629조)</p>}
          </fieldset>
          <Field label="양도 조건 (선택)"><textarea className="input min-h-20" value={a.conditions || ""} onChange={(e) => setAttr("conditions", e.target.value)} maxLength={500} placeholder="예: 잔여 계약 승계, 중개보수 없음" /></Field>
          <div><span className="label">옵션</span><MultiChips all={OPTIONS} value={a.options || []} onChange={(v) => setAttr("options", v)} /></div>
          <div className="card p-4 space-y-3">
            <label className="flex items-center gap-2 font-semibold min-h-11">
              <input type="checkbox" className="w-5 h-5 accent-brand" checked={!!a.package?.enabled} onChange={(e) => setAttr("package", { ...a.package, enabled: e.target.checked })} />
              자취템 패키지 함께 양도 (선택)
            </label>
            {a.package?.enabled && (
              <>
                <p className="text-xs text-ink-soft">방 양도와 물품 판매는 별개예요. 패키지 구매를 양도 조건으로 강제하지 말아 주세요.</p>
                <Field label="패키지 설명"><input className="input" value={a.package.note || ""} onChange={(e) => setAttr("package", { ...a.package, note: e.target.value })} /></Field>
                <Field label="패키지 가격"><ManInput value={m.pkg_price || ""} onChange={setMan("pkg_price")} /></Field>
                <div>
                  <span className="label">내 장터 물품 연결</span>
                  {myItems.length === 0 ? <p className="text-sm text-ink-soft">등록한 자취템이 없어요. <Link to="/market/new" className="text-brand font-semibold">자취템 등록</Link></p> : (
                    <MultiChips all={myItems.map((i) => i.id)} labels={Object.fromEntries(myItems.map((i) => [i.id, i.title]))} value={a.package.item_ids || []} onChange={(v) => setAttr("package", { ...a.package, item_ids: v })} />
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {cat === "transfer_wanted" && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <Field label="월세 최소"><ManInput value={m.budget_min || ""} onChange={setMan("budget_min")} /></Field>
            <Field label="월세 최대"><ManInput value={m.budget_max || ""} onChange={setMan("budget_max")} /></Field>
            <Field label="보증금 상한"><ManInput value={m.deposit_max || ""} onChange={setMan("deposit_max")} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="희망 입주일"><input type="date" className="input" value={a.period_from || ""} onChange={(e) => setAttr("period_from", e.target.value)} required /></Field>
            <Field label="희망 종료일 (선택)"><input type="date" className="input" value={a.period_to || ""} onChange={(e) => setAttr("period_to", e.target.value)} /></Field>
          </div>
          <Field label="선호 위치"><input className="input" value={a.location_pref || ""} onChange={(e) => setAttr("location_pref", e.target.value)} placeholder="예: 정문 도보 10분" /></Field>
          <div><span className="label">필수 옵션</span><MultiChips all={OPTIONS} value={a.required_options || []} onChange={(v) => setAttr("required_options", v)} /></div>
        </div>
      )}

      {(cat === "roommate_offer" || cat === "roommate_wanted") && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Field label="1인 월 부담액"><ManInput value={m.budget || ""} onChange={setMan("budget")} /></Field>
            <Field label="입주 희망일"><input type="date" className="input" value={a.move_in || ""} onChange={(e) => setAttr("move_in", e.target.value)} required /></Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {cat === "roommate_offer" && <Field label="구하는 인원"><select className="input" value={a.members || ""} onChange={(e) => setAttr("members", Number(e.target.value) || null)} required><option value="">선택</option>{[1, 2, 3].map((n) => <option key={n} value={n}>{n}명</option>)}</select></Field>}
            <Field label="거주 형태"><input className="input" value={a.housing_type || ""} onChange={(e) => setAttr("housing_type", e.target.value)} placeholder="예: 투룸 (각자 방)" /></Field>
          </div>
          {life}
          <div className="grid grid-cols-2 gap-2">
            <Field label="본인 성별 표기 (선택)" hint="원하지 않으면 비워 두세요"><select className="input" value={a.gender_self || ""} onChange={(e) => setAttr("gender_self", e.target.value || null)}><option value="">선택 안 함</option><option>여성</option><option>남성</option><option>밝히지 않음</option></select></Field>
            <Field label="선호 (선택)"><select className="input" value={a.gender_pref || ""} onChange={(e) => setAttr("gender_pref", e.target.value || null)}><option value="">선택 안 함</option><option>여성</option><option>남성</option><option>무관</option></select></Field>
          </div>
        </div>
      )}

      {cat === "room_showcase" && (
        <div className="space-y-4">
          <Field label="꾸미기 비용"><ManInput value={m.budget || ""} onChange={setMan("budget")} /></Field>
          <div><span className="label">스타일 태그</span><MultiChips all={["화이트", "우드", "미니멀", "식물", "빈티지", "가성비", "수납", "반려동물"]} value={a.style_tags || []} onChange={(v) => setAttr("style_tags", v)} /></div>
          <div className="space-y-2">
            <span className="label">제품 정보 (선택)</span>
            {(a.products || []).map((p: any, i: number) => (
              <div key={i} className="flex gap-2">
                <input className="input" placeholder="제품명" value={p.name} onChange={(e) => setAttr("products", a.products.map((x: any, j: number) => j === i ? { ...x, name: e.target.value } : x))} />
                <input className="input !w-32 num" placeholder="가격(원)" inputMode="numeric" value={p.price ?? ""} onChange={(e) => setAttr("products", a.products.map((x: any, j: number) => j === i ? { ...x, price: e.target.value ? Number(e.target.value.replace(/\D/g, "")) : null } : x))} />
              </div>
            ))}
            <button type="button" className="btn btn-line text-sm" onClick={() => setAttr("products", [...(a.products || []), { name: "", price: null }])}>+ 제품 추가</button>
          </div>
          <p className="text-xs text-ink-soft flex gap-1"><Info size={14} />사진 업로드는 추후 지원 예정이에요. 업로드 시 집 주소·호수가 보이지 않게, 위치정보(EXIF)를 지운 사진을 사용해 주세요.</p>
        </div>
      )}

      <Field label="내용"><textarea className="input min-h-40" value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} required /></Field>
      <FormError msg={err} />
      <div className="flex gap-2">
        <button type="button" className="btn btn-line" onClick={() => nav(-1)}>취소</button>
        <button className="btn btn-primary flex-1" disabled={busy}>{busy ? "저장 중…" : id ? "수정 저장" : "등록하기"}</button>
      </div>
    </form>
  );
}
