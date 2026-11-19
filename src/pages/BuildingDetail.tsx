import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ChevronLeft, PenLine, Unlock, KeyRound, Wrench, MessageSquareReply, BadgeCheck, Footprints, MessageCircle, Store, Info } from "lucide-react";
import { api, man, fmtDate, ago } from "../api";
import { useAuth } from "../auth";
import { useLoad, Loading, ErrorState, Score, Stars, DemoTag, LockBox, RoomArt, FormError, ReportButton, Modal, useRequireLogin } from "../ui";
import { RATING_ITEMS, CONTRACT_METHODS, FLOOR_BANDS } from "../../shared/constants";

const monthLabel = (m: string) => `${m.slice(2, 4)}.${m.slice(5)}`;

export default function BuildingDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { me, refresh } = useAuth();
  const requireLogin = useRequireLogin();
  const r = useLoad(() => api(`/api/buildings/${id}`), [id, me.user?.id]);
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  if (r.loading && !r.data) return <Loading />;
  if (r.error) return <ErrorState error={r.error} retry={r.reload} />;
  const { building: b, stats, vacancies, repairs, reviews, hiddenReviewCount, contract, access } = r.data;

  const useFree = async () => {
    setConfirm(false);
    setErr(null);
    try {
      await api("/api/review-views", { body: { building_id: id } });
      await refresh();
      r.reload();
    } catch (e: any) {
      setErr(e.message);
    }
  };
  const inquire = async () => {
    if (!requireLogin()) return;
    try {
      const c = await api("/api/conversations", { body: { building_id: id } });
      nav(`/chat/${c.id}`);
    } catch (e: any) {
      setErr(e.message);
    }
  };
  const apply = async () => {
    setApplyOpen(false);
    try {
      await api("/api/landlord/apply", { body: { building_id: id } });
      setErr("임대인 신청이 접수됐어요. 관리자 승인 후 대시보드를 쓸 수 있어요.");
    } catch (e: any) {
      setErr(e.message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <button className="inline-flex items-center text-sm text-ink-soft min-h-11 -ml-1" onClick={() => nav(-1)}><ChevronLeft size={18} />뒤로</button>
      {b.status !== "approved" && <p className="rounded-lg bg-[#FFF4DE] text-[#7A4F00] p-3 text-sm mb-3">승인 대기 중인 건물이에요. 승인 전에는 지도와 목록에 보이지 않아요.</p>}

      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-5">
        <RoomArt seed={b.id} className="aspect-[16/10] rounded-2xl" label="가상 일러스트 · 실제 건물 사진 아님" />
        <div>
          <div className="flex items-center gap-1.5 mb-1">{b.is_demo ? <DemoTag /> : null}{b.hasLandlord && <span className="text-[11px] font-bold text-brand bg-brand-light rounded px-1.5 py-0.5">임대인 참여 건물</span>}</div>
          <h1 className="text-[26px] font-extrabold tracking-tight">{b.name}</h1>
          <p className="text-sm text-ink-soft">{b.address}</p>
          {b.walk_minutes != null && <p className="text-sm mt-1 inline-flex items-center gap-1"><Footprints size={14} className="text-brand" />정문까지 도보 {b.walk_minutes}분 (확인값)</p>}
          <div className="mt-4 flex items-center gap-4">
            <div>
              <Score value={stats.avg} big />
              <div className="text-xs text-ink-soft mt-1">후기 {stats.reviewCount} · 실거주 인증 {stats.verifiedCount}</div>
            </div>
            {stats.reviewCount === 0 && <Link to={`/reviews/new?building=${b.id}`} className="btn btn-primary">첫 후기 남기기</Link>}
          </div>
          <p className="text-[11px] text-ink-soft mt-2 flex gap-1"><Info size={12} className="shrink-0 mt-0.5" />종합 = 공개 후기별 평균(평가 항목 산술평균)의 산술평균, 소수 1자리. 관리자·임대인은 평점을 바꿀 수 없어요.</p>
          {b.description && <p className="text-sm mt-3">{b.description}</p>}
          {b.amenities?.length > 0 && <div className="flex flex-wrap gap-1 mt-2">{b.amenities.map((x: string) => <span key={x} className="text-xs bg-paper rounded-md px-2 py-1">{x}</span>)}</div>}
        </div>
      </div>

      <FormError msg={err} />

      {/* 공개 매물 가격 */}
      <section className="mt-7">
        <h2 className="text-lg font-extrabold mb-2 flex items-center gap-1.5"><Store size={19} className="text-brand" />공개 공실 정보</h2>
        {vacancies.length === 0 ? <p className="text-sm text-ink-soft">등록된 공실이 없어요.</p> : (
          <div className="grid sm:grid-cols-2 gap-2">
            {vacancies.map((v: any) => (
              <div key={v.id} className="card p-3.5">
                <div className="flex justify-between text-sm mb-2"><b>{v.room_type}</b><span className="text-ink-soft num">{fmtDate(v.available_from)}부터</span></div>
                <div className="flex gap-4 num"><span>보증 <b>{man(v.deposit)}</b>만</span><span>월세 <b className="text-brand-dark text-lg">{man(v.rent)}</b>만</span><span>관리 <b>{man(v.maintenance)}</b>만</span></div>
                <p className="text-[11px] text-ink-soft mt-1">임대인 등록 정보 · {fmtDate(v.updated_at)} 갱신</p>
              </div>
            ))}
          </div>
        )}
        {b.hasLandlord && !access.isLandlord && <button className="btn btn-ghost mt-3 text-sm" onClick={inquire}><MessageCircle size={16} />임대인에게 입주 문의</button>}
      </section>

      {/* 항목별 평점 */}
      <section className="mt-7">
        <h2 className="text-lg font-extrabold mb-3">항목별 평점</h2>
        <div className="grid sm:grid-cols-3 gap-2">
          {Object.entries(stats.items).map(([k, v]: any) => (
            <div key={k} className="rounded-xl bg-paper px-3.5 py-3 flex items-center justify-between">
              <span className="text-sm font-medium">{(RATING_ITEMS as any)[k]}</span>
              <span className="flex items-center gap-1.5">
                <Stars value={v.avg} size={13} />
                <b className="num text-sm w-7 text-right">{v.avg === null ? "N/A" : v.avg.toFixed(1)}</b>
              </span>
            </div>
          ))}
        </div>
        {!access.full && <p className="text-xs text-ink-soft mt-2">9개 중 3개 항목만 미리보기 중이에요.</p>}
      </section>

      {/* 잠금 영역 */}
      {!access.full && (
        <section className="mt-7">
          <LockBox title="실제 계약금액 · 중개보수 · 상세 후기 전체">
            <p className="text-sm text-ink mb-3">살아본 방의 후기를 1건 남기면 모든 건물의 상세 정보가 열려요. 잠긴 정보는 서버에서 아예 보내지 않아요.</p>
            {!access.loggedIn ? (
              <div className="flex flex-wrap gap-2">
                <Link to={`/login?next=/buildings/${id}`} className="btn btn-primary">로그인하고 무료 열람권 받기</Link>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 items-center">
                <Link to={`/reviews/new?building=${id}`} className="btn btn-primary"><PenLine size={16} />후기 쓰고 전체 열기</Link>
                {stats.reviewCount > 0 ? (
                  <button className="btn btn-line" disabled={access.freeLeft <= 0} onClick={() => setConfirm(true)}>
                    <Unlock size={16} />무료 열람권 사용 <span className="num text-brand font-bold">({access.freeLeft}/3)</span>
                  </button>
                ) : <span className="text-xs text-ink-soft">후기가 없는 건물엔 열람권이 차감되지 않아요.</span>}
              </div>
            )}
          </LockBox>
        </section>
      )}
      {access.full && contract && (
        <section className="mt-7">
          <h2 className="text-lg font-extrabold mb-1 flex items-center gap-1.5"><KeyRound size={19} className="text-brand" />과거 실제 계약금액 (후기 {contract.n}건 평균)</h2>
          <p className="text-xs text-ink-soft mb-3">작성자들이 실제로 계약한 금액이에요. 최근 계약 종료 {contract.latestMonth ?? "-"} 기준이라 현재 시세와 다를 수 있어요.{access.unlockedByFree && " · 무료 열람권으로 열람 중"}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[["보증금", contract.deposit], ["월세", contract.rent], ["관리비", contract.maintenance], ["중개보수", contract.broker]].map(([l, v]: any) => (
              <div key={l} className="rounded-xl border border-line p-3"><div className="text-xs text-ink-soft">{l}</div><div className="num font-extrabold text-lg">{v == null ? "-" : man(Math.round(v))}<span className="text-xs font-medium text-ink-soft">만</span></div></div>
            ))}
          </div>
        </section>
      )}

      {/* 후기 목록 */}
      <section className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-extrabold">거주 후기 {stats.reviewCount}</h2>
          <Link to={`/reviews/new?building=${b.id}`} className="btn btn-ghost !min-h-10 text-sm"><PenLine size={15} />후기 쓰기</Link>
        </div>
        {reviews.length === 0 ? <div className="rounded-2xl border border-dashed border-line p-6 text-center"><p className="font-bold">- / 첫 후기 남기기</p><p className="text-sm text-ink-soft">이 건물에 살았다면 첫 후기를 남겨 주세요.</p></div> : (
          <ul className="space-y-3">
            {reviews.map((rv: any) => (
              <li key={rv.id} className="card p-4">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <Score value={rv.avg} />
                  {(rv.verification_status === "verified_demo" || rv.verification_status === "verified") && <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-ok bg-[#E5F4EB] rounded px-1.5 py-0.5"><BadgeCheck size={12} />실거주 인증{rv.verification_status === "verified_demo" ? "(DEMO)" : ""}</span>}
                  {rv.verification_status === "requested" && <span className="text-[11px] font-bold text-ink-soft bg-paper rounded px-1.5 py-0.5">인증 검토 대기</span>}
                  {rv.is_demo && <DemoTag />}
                  <span className="ml-auto text-xs text-ink-soft">{ago(rv.created_at)} 작성</span>
                </div>
                <p className="text-xs text-ink-soft mb-2 num">
                  {monthLabel(rv.start_month)}~{monthLabel(rv.end_month)} 거주 · {rv.room_type ?? "유형 미기재"} · {rv.floor_band ? (FLOOR_BANDS as any)[rv.floor_band] : "층 미기재"}{rv.orientation ? ` · ${rv.orientation}` : ""}
                </p>
                <p className="text-[15px] leading-7 whitespace-pre-wrap">{rv.body}</p>
                {!rv.locked && (
                  <>
                    <div className="mt-3 grid grid-cols-3 sm:grid-cols-5 gap-1.5 text-xs">
                      {Object.entries(rv.ratings).map(([k, v]: any) => <span key={k} className="rounded-md bg-paper px-2 py-1 flex justify-between"><span className="text-ink-soft">{(RATING_ITEMS as any)[k]}</span><b className="num">{v ?? "N/A"}</b></span>)}
                    </div>
                    {rv.monthly_rent != null && (
                      <p className="mt-2 text-sm num">
                        <span className="text-ink-soft">계약 당시({rv.end_month > "2026-11" ? "거주 중" : monthLabel(rv.start_month)}) </span>
                        보증 <b>{man(rv.deposit)}</b>만 · 월세 <b className="text-brand-dark">{man(rv.monthly_rent)}</b>만 · 관리 <b>{man(rv.maintenance_fee)}</b>만{rv.broker_fee != null && <> · 중개보수 <b>{man(rv.broker_fee)}</b>만</>}
                        {rv.contract_method && <span className="text-ink-soft"> · {(CONTRACT_METHODS as any)[rv.contract_method]}</span>}
                      </p>
                    )}
                    {rv.renewal_intent && <p className="text-xs mt-1">재계약 의향: <b>{{ yes: "있음", no: "없음", unsure: "고민 중" }[rv.renewal_intent as "yes"]}</b></p>}
                    {rv.reply && (
                      <div className="mt-3 rounded-xl bg-brand-light/70 p-3 text-sm">
                        <div className="font-bold text-brand-dark text-xs mb-1 flex items-center gap-1"><MessageSquareReply size={13} />임대인 답변 · 출처: 승인된 임대인 계정</div>
                        {rv.reply.body}
                      </div>
                    )}
                  </>
                )}
                <div className="flex items-center justify-between mt-1">
                  {rv.mine ? <Link to={`/reviews/${rv.id}/edit`} className="text-sm text-brand font-semibold min-h-11 inline-flex items-center">내 후기 수정</Link> : <span />}
                  <ReportButton small type="review" id={rv.id} />
                </div>
              </li>
            ))}
            {hiddenReviewCount > 0 && <li className="rounded-2xl bg-paper p-4 text-center text-sm text-ink-soft">잠긴 후기 {hiddenReviewCount}건이 더 있어요</li>}
          </ul>
        )}
      </section>

      {repairs.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-extrabold mb-2 flex items-center gap-1.5"><Wrench size={18} className="text-brand" />수리 완료 내역</h2>
          <p className="text-xs text-ink-soft mb-2">출처: 임대인 등록 정보 (외대원룸이 검증하지 않음)</p>
          <ul className="card divide-y divide-line">{repairs.map((x: any) => <li key={x.id} className="flex p-3 text-sm"><span className="flex-1">{x.summary}</span><span className="num text-ink-soft">{fmtDate(x.completed_at)}</span></li>)}</ul>
        </section>
      )}

      <div className="mt-8 flex items-center justify-between text-sm">
        {me.user && !access.isLandlord && <button className="text-ink-soft underline min-h-11" onClick={() => setApplyOpen(true)}>이 건물의 임대인이신가요?</button>}
        {access.isLandlord && <Link to="/landlord" className="btn btn-ghost">임대인 대시보드</Link>}
        <ReportButton type="building" id={b.id} />
      </div>

      <Modal open={confirm} onClose={() => setConfirm(false)} title="무료 열람권을 사용할까요?">
        <p className="text-sm mb-1">{b.name}의 상세 후기와 실제 계약금액을 볼 수 있어요.</p>
        <p className="text-sm text-ink-soft mb-4">남은 열람권 {access.freeLeft}회 → {access.freeLeft - 1}회. 같은 건물은 다시 차감되지 않아요.</p>
        <div className="flex gap-2"><button className="btn btn-line flex-1" onClick={() => setConfirm(false)}>취소</button><button className="btn btn-primary flex-1" onClick={useFree}>사용하기</button></div>
      </Modal>
      <Modal open={applyOpen} onClose={() => setApplyOpen(false)} title="임대인 신청">
        <p className="text-sm text-ink-soft mb-4">관리자 승인 후 본인 건물의 공실·시설 정보를 수정하고 후기에 답변할 수 있어요. 평점은 변경할 수 없어요. (MVP: 실제 소유 증빙 검증은 추후)</p>
        <div className="flex gap-2"><button className="btn btn-line flex-1" onClick={() => setApplyOpen(false)}>취소</button><button className="btn btn-primary flex-1" onClick={apply}>신청하기</button></div>
      </Modal>
    </div>
  );
}
