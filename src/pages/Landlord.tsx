import { useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import { MessageSquareReply, Wrench, DoorOpen, MessageCircle, Info } from "lucide-react";
import { api, man, fmtDate, toWon, ago } from "../api";
import { useAuth } from "../auth";
import { useLoad, Loading, ErrorState, Score, FormError } from "../ui";
import { ManInput } from "./PostNew";
import { ROOM_TYPES } from "../../shared/constants";

export default function Landlord() {
  const { me, loading } = useAuth();
  const r = useLoad(() => (me.user ? api("/api/landlord") : Promise.reject(Object.assign(new Error("로그인이 필요해요."), { status: 401 }))), [me.user?.id]);
  const [bid, setBid] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [v, setV] = useState({ available_from: "", room_type: ROOM_TYPES[0] as string, deposit: "", rent: "", maintenance: "" });
  const [rep, setRep] = useState({ summary: "", completed_at: "" });
  const [replies, setReplies] = useState<Record<string, string>>({});
  if (loading || (r.loading && !r.data)) return <Loading />;
  if (r.error) return <div className="max-w-xl mx-auto"><ErrorState error={r.error as any} /></div>;
  const d = r.data;
  const cur = bid || d.buildings[0].id;
  const b = d.buildings.find((x: any) => x.id === cur);
  const run = async (p: Promise<unknown>) => { setErr(null); try { await p; r.reload(); return true; } catch (e: any) { setErr(e.message); return false; } };
  const addVac = async (e: FormEvent) => { e.preventDefault(); if (await run(api("/api/landlord/vacancies", { body: { building_id: cur, available_from: v.available_from, room_type: v.room_type, deposit: toWon(v.deposit), rent: toWon(v.rent), maintenance: toWon(v.maintenance) ?? 0 } }))) setV({ ...v, deposit: "", rent: "", maintenance: "" }); };
  const addRepair = async (e: FormEvent) => { e.preventDefault(); if (await run(api("/api/landlord/repairs", { body: { building_id: cur, ...rep } }))) setRep({ summary: "", completed_at: "" }); };
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">임대인 대시보드</h1>
        <p className="text-sm text-ink-soft flex gap-1"><Info size={14} className="mt-0.5 shrink-0" />관리자 승인된 본인 건물만 관리할 수 있어요. 평점은 수정할 수 없고 후기에는 답변만 가능해요. 외대원룸은 중개 업무를 대신하지 않아요.</p>
      </div>
      <div className="flex gap-1.5 scroll-x">{d.buildings.map((x: any) => <button key={x.id} className="chip shrink-0" aria-pressed={cur === x.id} onClick={() => setBid(x.id)}>{x.name}</button>)}</div>
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="종합 평점" value={<Score value={b.stats.avg} />} />
        <Stat label="공개 후기" value={<b className="num text-xl">{b.stats.reviewCount}</b>} />
        <Stat label="모집 중 공실" value={<b className="num text-xl">{d.vacancies.filter((x: any) => x.building_id === cur && x.status === "open").length}</b>} />
        <Stat label="입주 문의" value={<b className="num text-xl">{d.inquiries.filter((x: any) => x.context.id === cur).length}</b>} />
      </section>
      <FormError msg={err} />
      <div className="grid lg:grid-cols-2 gap-6">
        <section className="space-y-3">
          <h2 className="font-bold flex items-center gap-1.5"><DoorOpen size={18} className="text-brand" />공실 관리</h2>
          <ul className="card divide-y divide-line">
            {d.vacancies.filter((x: any) => x.building_id === cur).map((x: any) => (
              <li key={x.id} className="flex items-center gap-2 p-3 text-sm">
                <span className="flex-1"><b>{x.room_type}</b> · <span className="num">{fmtDate(x.available_from)}~ · {man(x.deposit)}/{man(x.rent)}/{man(x.maintenance)}만</span></span>
                <button className={`chip !min-h-9 ${x.status === "open" ? "" : "on"}`} onClick={() => run(api(`/api/landlord/vacancies/${x.id}`, { method: "PATCH", body: { status: x.status === "open" ? "closed" : "open" } }))}>{x.status === "open" ? "모집중" : "마감"}</button>
              </li>
            ))}
          </ul>
          <form onSubmit={addVac} className="card p-4 space-y-2">
            <p className="text-sm font-semibold">공실 등록</p>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" className="input" aria-label="입주 가능일" value={v.available_from} onChange={(e) => setV({ ...v, available_from: e.target.value })} required />
              <select className="input" aria-label="방 유형" value={v.room_type} onChange={(e) => setV({ ...v, room_type: e.target.value })}>{ROOM_TYPES.map((x) => <option key={x}>{x}</option>)}</select>
            </div>
            <div className="grid grid-cols-3 gap-2"><ManInput value={v.deposit} onChange={(x) => setV({ ...v, deposit: x })} placeholder="보증금" /><ManInput value={v.rent} onChange={(x) => setV({ ...v, rent: x })} placeholder="월세" /><ManInput value={v.maintenance} onChange={(x) => setV({ ...v, maintenance: x })} placeholder="관리비" /></div>
            <button className="btn btn-primary w-full">등록</button>
          </form>
          <h2 className="font-bold flex items-center gap-1.5 pt-2"><Wrench size={18} className="text-brand" />시설 개선·수리 완료 등록</h2>
          <form onSubmit={addRepair} className="card p-4 space-y-2">
            <input className="input" placeholder="예: 공동현관 도어락 교체" value={rep.summary} onChange={(e) => setRep({ ...rep, summary: e.target.value })} required />
            <div className="flex gap-2"><input type="date" className="input" aria-label="완료일" value={rep.completed_at} onChange={(e) => setRep({ ...rep, completed_at: e.target.value })} required /><button className="btn btn-primary shrink-0">등록</button></div>
            <ul className="text-sm text-ink-soft">{d.repairs.filter((x: any) => x.building_id === cur).map((x: any) => <li key={x.id}>· {x.summary} ({fmtDate(x.completed_at)})</li>)}</ul>
          </form>
        </section>
        <section className="space-y-3">
          <h2 className="font-bold flex items-center gap-1.5"><MessageCircle size={18} className="text-brand" />입주 희망 문의</h2>
          <ul className="card divide-y divide-line">
            {d.inquiries.filter((x: any) => x.context.id === cur).length === 0 ? <li className="p-3 text-sm text-ink-soft">아직 문의가 없어요.</li> :
              d.inquiries.filter((x: any) => x.context.id === cur).map((c: any) => <li key={c.id}><Link to={`/chat/${c.id}`} className="flex p-3 text-sm min-h-12"><b className="mr-2">{c.other.nickname}</b><span className="flex-1 truncate text-ink-soft">{c.last_body}</span></Link></li>)}
          </ul>
          <h2 className="font-bold flex items-center gap-1.5 pt-2"><MessageSquareReply size={18} className="text-brand" />후기 답변</h2>
          <ul className="space-y-2">
            {d.reviews.filter((x: any) => x.building_id === cur).map((x: any) => (
              <li key={x.id} className="card p-3 text-sm space-y-2">
                <div className="flex items-center gap-2"><Score value={x.avg} /><span className="text-xs text-ink-soft">{ago(x.created_at)}</span></div>
                <p>{x.body}</p>
                {x.reply && <p className="rounded-lg bg-brand-light p-2 text-xs"><b>내 답변:</b> {x.reply}</p>}
                <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (await run(api("/api/landlord/replies", { body: { review_id: x.id, body: replies[x.id] } }))) setReplies({ ...replies, [x.id]: "" }); }}>
                  <input className="input !min-h-10" placeholder={x.reply ? "답변 수정" : "답변 작성 (5자 이상)"} value={replies[x.id] || ""} onChange={(e) => setReplies({ ...replies, [x.id]: e.target.value })} />
                  <button className="btn btn-ghost !min-h-10 shrink-0" disabled={!replies[x.id]}>등록</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
const Stat = ({ label, value }: { label: string; value: React.ReactNode }) => <div className="card p-4"><p className="text-xs text-ink-soft mb-1">{label}</p>{value}</div>;
