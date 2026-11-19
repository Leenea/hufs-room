import { useEffect, useState, FormEvent } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { api, toWon } from "../api";
import { useAuth } from "../auth";
import { FormError, Loading } from "../ui";
import { Field, ManInput } from "./PostNew";
import { MARKET_CATEGORIES, CONDITIONS } from "../../shared/constants";

export default function MarketNew() {
  const { id } = useParams();
  const nav = useNavigate();
  const { me, loading } = useAuth();
  const [f, setF] = useState<any>({ title: "", body: "", category: "furniture", condition: "good", handover_date: "", area: "" });
  const [price, setPrice] = useState("");
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return;
    api(`/api/market/${id}`).then(({ item }) => { setF({ ...item, handover_date: item.handover_date || "", area: item.area || "" }); setPrice(String(item.price / 10000)); }).catch((e) => setErr(e.message));
  }, [id]);
  if (loading) return <Loading />;
  if (!me.user) return <div className="card p-8 text-center max-w-md mx-auto"><p className="font-bold mb-3">로그인 후 물건을 올릴 수 있어요</p><Link className="btn btn-primary" to="/login?next=/market/new">로그인</Link></div>;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    const body = { title: f.title, body: f.body, category: f.category, condition: f.condition, handover_date: f.handover_date || null, area: f.area, price: toWon(price) ?? 0 };
    try {
      if (id) { await api(`/api/market/${id}`, { method: "PATCH", body }); nav(`/market/${id}`); }
      else { const r = await api("/api/market", { body }); nav(`/market/${r.id}`, { replace: true }); }
    } catch (e: any) { setErr(e.message); }
  };
  return (
    <form onSubmit={submit} className="max-w-xl mx-auto space-y-5">
      <h1 className="text-2xl font-extrabold">{id ? "물건 수정" : "자취템 올리기"}</h1>
      <Field label="제목"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required maxLength={50} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="카테고리"><select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{Object.entries(MARKET_CATEGORIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="사용 상태"><select className="input" value={f.condition} onChange={(e) => setF({ ...f, condition: e.target.value })}>{Object.entries(CONDITIONS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
      </div>
      <Field label="가격" hint="무료 나눔은 0"><ManInput value={price} onChange={setPrice} placeholder="0" /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="인계 희망일"><input type="date" className="input" value={f.handover_date} onChange={(e) => setF({ ...f, handover_date: e.target.value })} /></Field>
        <Field label="대략 지역"><input className="input" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} placeholder="예: 정문 앞" maxLength={30} /></Field>
      </div>
      <Field label="설명"><textarea className="input min-h-28" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} maxLength={1500} /></Field>
      <p className="text-xs text-ink-soft">방 양도 글에 패키지로 연결하려면 이 물건을 먼저 올린 뒤 '양도해요' 글쓰기에서 선택하세요. 사진 업로드는 추후 지원.</p>
      <FormError msg={err} />
      <button className="btn btn-primary w-full">{id ? "수정 저장" : "올리기"}</button>
    </form>
  );
}
