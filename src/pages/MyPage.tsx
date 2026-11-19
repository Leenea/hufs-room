import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogOut, BadgeCheck, Unlock, Building, Shield } from "lucide-react";
import { api, ago, man } from "../api";
import { useAuth } from "../auth";
import { useLoad, Loading, ErrorState, CatTag, DemoTag, FormError } from "../ui";

const VER: Record<string, string> = { none: "미인증", pending: "인증 신청 · 검토 대기", verified: "재학 인증", rejected: "인증 반려" };
const RSTAT: Record<string, string> = { published: "공개", pending: "검토 대기", hidden: "숨김", rejected: "반려" };

export default function MyPage() {
  const { me, loading, logout, refresh } = useAuth();
  const nav = useNavigate();
  const r = useLoad(() => (me.user ? api("/api/me/activity") : Promise.resolve(null)), [me.user?.id]);
  const [msg, setMsg] = useState<string | null>(null);
  if (loading) return <Loading />;
  if (!me.user) return <div className="card p-8 text-center max-w-md mx-auto mt-6"><p className="font-bold mb-3">로그인이 필요해요</p><Link className="btn btn-primary" to="/login?next=/me">로그인 / 체험하기</Link></div>;
  const u = me.user;
  const a = me.access!;
  const requestVerify = async () => {
    try { await api("/api/me/verification", { body: { type: "student" } }); setMsg("재학 인증을 신청했어요. 실제 학교 이메일 확인은 추후 지원하며, 지금은 관리자 검토 상태만 표시돼요."); refresh(); r.reload(); }
    catch (e: any) { setMsg(e.message); }
  };
  const d = r.data;
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <section className="card p-5 flex items-center gap-4">
        <span className="grid place-items-center w-14 h-14 rounded-2xl bg-brand text-white text-xl font-extrabold">{u.nickname.slice(0, 1)}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap"><b className="text-lg">{u.nickname}</b>{u.is_demo && <DemoTag />}{u.role !== "user" && <span className="text-[11px] font-bold bg-ink text-white rounded px-1.5 py-0.5">{u.role === "admin" ? "관리자" : "임대인"}</span>}</div>
          <p className="text-sm text-ink-soft flex items-center gap-1"><BadgeCheck size={14} className={u.verification_status === "verified" ? "text-ok" : ""} />{VER[u.verification_status]}{u.is_demo && u.verification_status === "verified" ? " (DEMO 가상 인증)" : ""}</p>
        </div>
        <button className="btn btn-line !min-h-10 text-sm" onClick={async () => { await logout(); nav("/"); }}><LogOut size={15} />로그아웃</button>
      </section>

      <section className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-2xl bg-brand-light p-4">
          <p className="text-sm font-bold text-brand-dark flex items-center gap-1"><Unlock size={15} />후기 열람 권한</p>
          {a.level === "full" ? <p className="mt-1 font-extrabold text-lg">전체 열람 가능</p> : <p className="mt-1"><b className="num text-2xl text-brand-dark">{a.freeLeft}</b><span className="text-sm"> / 3 무료 열람권 남음</span></p>}
          <p className="text-xs text-ink-soft mt-1">{a.hasReview ? "공개된 후기가 있어 모든 건물 상세가 열려 있어요." : "후기 1건을 남기면 모든 건물의 상세 정보가 열려요."}</p>
        </div>
        <div className="card p-4 space-y-2">
          <p className="text-sm font-bold">인증·권한</p>
          {u.verification_status === "none" || u.verification_status === "rejected" ? <button className="btn btn-ghost w-full text-sm" onClick={requestVerify}>재학 인증 신청</button> : <p className="text-sm text-ink-soft">{VER[u.verification_status]}</p>}
          {me.isLandlord && <Link to="/landlord" className="btn btn-line w-full text-sm"><Building size={15} />임대인 대시보드</Link>}
          {u.role === "admin" && <Link to="/admin" className="btn btn-line w-full text-sm"><Shield size={15} />관리자</Link>}
        </div>
      </section>
      <FormError msg={msg} />

      {r.loading ? <Loading /> : r.error ? <ErrorState error={r.error} retry={r.reload} /> : d && (
        <>
          <Block title={`내 후기 ${d.reviews.length}`}>
            {d.reviews.length === 0 ? <p className="text-sm text-ink-soft p-3">아직 후기가 없어요. <Link to="/reviews/new" className="text-brand font-semibold">후기 쓰기</Link></p> :
              d.reviews.map((x: any) => <Item key={x.id} to={`/reviews/${x.id}/edit`} left={x.building_name} right={`${RSTAT[x.status]} · ${x.start_month}~${x.end_month}`} />)}
          </Block>
          <Block title={`내 글 ${d.posts.length}`}>
            {d.posts.length === 0 ? <p className="text-sm text-ink-soft p-3">작성한 글이 없어요.</p> : d.posts.map((x: any) => <Item key={x.id} to={`/posts/${x.id}`} left={<><CatTag cat={x.category} /> {x.title}</>} right={x.status === "closed" ? "모집종료" : ago(x.created_at)} />)}
          </Block>
          <Block title={`저장한 글 ${d.saved.length}`}>
            {d.saved.length === 0 ? <p className="text-sm text-ink-soft p-3">저장한 글이 없어요.</p> : d.saved.map((x: any) => <Item key={x.id} to={`/posts/${x.id}`} left={<><CatTag cat={x.category} /> {x.title}</>} right="" />)}
          </Block>
          <Block title={`내 자취템 ${d.market.length}`}>
            {d.market.length === 0 ? <p className="text-sm text-ink-soft p-3">올린 물건이 없어요.</p> : d.market.map((x: any) => <Item key={x.id} to={`/market/${x.id}`} left={x.title} right={x.price === 0 ? "무료" : `${man(x.price)}만`} />)}
          </Block>
          <Block title={`무료 열람권 사용 내역 ${d.viewed.length}`}>
            {d.viewed.length === 0 ? <p className="text-sm text-ink-soft p-3">사용 내역이 없어요.</p> : d.viewed.map((x: any) => <Item key={x.building_id} to={`/buildings/${x.building_id}`} left={x.name} right={ago(x.created_at)} />)}
          </Block>
          {d.landlordBuildings.length > 0 && (
            <Block title="임대인 신청">{d.landlordBuildings.map((x: any) => <Item key={x.building_id} to={`/buildings/${x.building_id}`} left={x.name} right={{ pending: "검토 대기", approved: "승인", rejected: "반려" }[x.status as "pending"]} />)}</Block>
          )}
        </>
      )}
    </div>
  );
}
function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h2 className="font-bold mb-2">{title}</h2><ul className="card divide-y divide-line">{children}</ul></section>;
}
function Item({ to, left, right }: { to: string; left: React.ReactNode; right: string }) {
  return <li><Link to={to} className="flex items-center gap-2 px-4 py-3 text-sm hover:bg-paper min-h-12"><span className="flex-1 truncate">{left}</span><span className="text-xs text-ink-soft shrink-0">{right}</span></Link></li>;
}
