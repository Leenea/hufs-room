import { useState, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { FormError, Loading } from "../ui";
import { Field, MultiChips } from "./PostNew";
import { OPTIONS } from "../../shared/constants";

export default function BuildingNew() {
  const { me, loading } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ name: "", address: "", description: "", amenities: [] as string[], as_landlord: false });
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [dupId, setDupId] = useState<string | null>(null);
  if (loading) return <Loading />;
  if (!me.user) return <div className="card p-8 text-center max-w-md mx-auto"><p className="font-bold mb-3">로그인 후 건물 등록을 요청할 수 있어요</p><Link className="btn btn-primary" to="/login?next=/buildings/new">로그인</Link></div>;
  if (done) return (
    <div className="card p-8 text-center max-w-md mx-auto space-y-3">
      <p className="font-extrabold text-xl">등록 요청이 접수됐어요</p>
      <p className="text-sm text-ink-soft">관리자 승인 후 목록과 지도에 보여요. 승인 전에는 요청자와 관리자만 볼 수 있어요.</p>
      <button className="btn btn-primary w-full" onClick={() => nav(`/buildings/${done}`)}>요청한 건물 보기</button>
    </div>
  );
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setDupId(null);
    try {
      const r = await api("/api/buildings", { body: f });
      setDone(r.id);
    } catch (e: any) {
      setErr(e.message);
      setDupId(e.data?.existingId ?? null);
    }
  };
  return (
    <form onSubmit={submit} className="max-w-xl mx-auto space-y-5">
      <h1 className="text-2xl font-extrabold">건물 등록 요청</h1>
      <p className="text-sm text-ink-soft">학생·임대인 누구나 요청할 수 있어요. 같은 주소는 중복 등록되지 않아요.</p>
      <Field label="건물명"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required maxLength={40} /></Field>
      <Field label="주소 (도로명, 호수 제외)"><input className="input" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} required maxLength={120} placeholder="예: OO시 모현읍 OO로 12" /></Field>
      <Field label="특징 (선택)"><textarea className="input min-h-24" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={500} /></Field>
      <div><span className="label">편의시설</span><MultiChips all={OPTIONS} value={f.amenities} onChange={(v) => setF({ ...f, amenities: v })} /></div>
      <label className="flex items-center gap-2 min-h-11"><input type="checkbox" className="w-5 h-5 accent-brand" checked={f.as_landlord} onChange={(e) => setF({ ...f, as_landlord: e.target.checked })} />이 건물의 임대인으로 함께 신청</label>
      <p className="text-xs text-ink-soft">위치 좌표는 지도 API 연동 후 관리자가 확인해 입력해요. 좌표가 없으면 목록에만 보여요.</p>
      <FormError msg={err} />
      {dupId && <Link to={`/buildings/${dupId}`} className="btn btn-ghost w-full">이미 등록된 건물 보기</Link>}
      <button className="btn btn-primary w-full">등록 요청</button>
    </form>
  );
}
