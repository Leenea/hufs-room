import { useState } from "react";
import { Link } from "react-router-dom";
import { api, ago } from "../api";
import { useLoad, Loading, ErrorState, FormError } from "../ui";

export default function Admin() {
  const r = useLoad(() => api("/api/admin/queue"), []);
  const [err, setErr] = useState<string | null>(null);
  if (r.loading && !r.data) return <Loading />;
  if (r.error) return <div className="max-w-xl mx-auto"><ErrorState error={r.error} /></div>;
  const d = r.data;
  const act = async (path: string, body: any) => { setErr(null); try { await api(path, { body }); r.reload(); } catch (e: any) { setErr(e.message); } };
  const Btn = ({ onClick, children, primary }: any) => <button className={`btn ${primary ? "btn-primary" : "btn-line"} !min-h-9 text-xs`} onClick={onClick}>{children}</button>;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold">관리자</h1>
      <FormError msg={err} />
      <Sec title={`건물 등록 승인 ${d.buildings.length}`}>{d.buildings.map((b: any) => <Row key={b.id} main={<><Link className="font-semibold text-brand" to={`/buildings/${b.id}`}>{b.name}</Link> <span className="text-ink-soft">{b.address} · {b.nickname}</span></>}><Btn primary onClick={() => act(`/api/admin/buildings/${b.id}`, { action: "approve" })}>승인</Btn><Btn onClick={() => act(`/api/admin/buildings/${b.id}`, { action: "reject" })}>반려</Btn></Row>)}</Sec>
      <Sec title={`후기 검토·인증 신청 ${d.reviews.length}`}>{d.reviews.map((x: any) => <Row key={x.id} main={<><b>{x.building_name}</b> · {x.nickname} · {x.status}/{x.verification_status}<p className="text-ink-soft line-clamp-2">{x.body}</p></>}>
        {x.status === "pending" && <Btn primary onClick={() => act(`/api/admin/reviews/${x.id}`, { action: "publish" })}>공개</Btn>}
        {x.verification_status === "requested" && <Btn onClick={() => act(`/api/admin/reviews/${x.id}`, { action: "verify_demo" })}>가상 인증</Btn>}
        <Btn onClick={() => act(`/api/admin/reviews/${x.id}`, { action: "hide" })}>숨김</Btn></Row>)}</Sec>
      <Sec title={`신고 ${d.reports.length}`}>{d.reports.map((x: any) => <Row key={x.id} main={<><b>{x.target_type}</b> <span className="text-ink-soft">{x.target_id.slice(0, 8)}</span> · {x.reason} · {ago(x.created_at)}</>}><Btn primary onClick={() => act(`/api/admin/reports/${x.id}`, { action: "hide_target" })}>대상 숨김/제재</Btn><Btn onClick={() => act(`/api/admin/reports/${x.id}`, { action: "dismiss" })}>기각</Btn></Row>)}</Sec>
      <Sec title={`임대인 신청 ${d.landlords.length}`}>{d.landlords.map((x: any) => <Row key={x.landlord_id + x.building_id} main={<>{x.nickname} → <b>{x.name}</b></>}><Btn primary onClick={() => act("/api/admin/landlords", { landlord_id: x.landlord_id, building_id: x.building_id, action: "approve" })}>승인</Btn><Btn onClick={() => act("/api/admin/landlords", { landlord_id: x.landlord_id, building_id: x.building_id, action: "reject" })}>반려</Btn></Row>)}</Sec>
      <Sec title={`재학 인증 신청 ${d.verifications.length}`}>{d.verifications.map((x: any) => <Row key={x.id} main={<>{x.nickname} <span className="text-ink-soft">{x.note}</span></>}><Btn primary onClick={() => act(`/api/admin/verifications/${x.id}`, { action: "approve" })}>승인</Btn><Btn onClick={() => act(`/api/admin/verifications/${x.id}`, { action: "reject" })}>반려</Btn></Row>)}</Sec>
      <Sec title="감사 로그">{d.audit.map((x: any, i: number) => <Row key={i} main={<span className="text-ink-soft">{ago(x.created_at)} · {x.nickname} · {x.action} · {x.target_type}:{x.target_id.slice(0, 8)}</span>} />)}</Sec>
    </div>
  );
}
const Sec = ({ title, children }: any) => <section><h2 className="font-bold mb-2">{title}</h2><ul className="card divide-y divide-line">{(Array.isArray(children) ? children.length : children) ? children : <li className="p-3 text-sm text-ink-soft">없음</li>}</ul></section>;
const Row = ({ main, children }: any) => <li className="flex items-center gap-2 p-3 text-sm flex-wrap"><div className="flex-1 min-w-48">{main}</div><div className="flex gap-1.5">{children}</div></li>;
