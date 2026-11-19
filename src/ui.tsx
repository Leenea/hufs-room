import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, Flag, Lock, MessageCircle, RefreshCw, Star, X, Heart, CalendarRange } from "lucide-react";
import { api, ApiError, man, ago, fmtDate } from "./api";
import { CATEGORIES, Category, LANDLORD_CONSENT, REPORT_REASONS } from "../shared/constants";
import { useAuth } from "./auth";

export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    fn()
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e : new ApiError(0, "오류가 발생했어요.")))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { reload(); }, [reload]);
  return { data, error, loading, reload, setData };
}

export function Stars({ value, size = 14 }: { value: number | null; size?: number }) {
  return (
    <span className="inline-flex items-center" aria-label={value === null ? "평점 없음" : `5점 만점에 ${value}점`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = value === null ? 0 : Math.max(0, Math.min(1, value - i + 1));
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star size={size} className="absolute text-[#E5DCC8]" fill="currentColor" strokeWidth={0} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star size={size} className="text-star" fill="currentColor" strokeWidth={0} />
            </span>
          </span>
        );
      })}
    </span>
  );
}
export function Score({ value, count, big }: { value: number | null; count?: number; big?: boolean }) {
  if (value === null)
    return <span className={`text-ink-soft ${big ? "text-2xl font-bold" : "text-sm"}`}>- <span className="text-xs font-normal">미평가</span></span>;
  return (
    <span className={`inline-flex items-center gap-1.5 ${big ? "" : "text-sm"}`}>
      <Star size={big ? 22 : 14} className="text-star" fill="currentColor" strokeWidth={0} />
      <b className={`num ${big ? "text-3xl" : ""}`}>{value.toFixed(1)}</b>
      {count !== undefined && <span className="text-ink-soft text-xs">후기 {count}</span>}
    </span>
  );
}

export function Price({ deposit, rent, maintenance, compact }: { deposit?: number | null; rent?: number | null; maintenance?: number | null; compact?: boolean }) {
  const cell = (label: string, v: number | null | undefined, strong?: boolean) => (
    <div className={compact ? "" : "flex-1"}>
      <div className="text-[11px] text-ink-soft leading-none mb-1">{label}</div>
      <div className={`num leading-none ${strong ? "text-brand-dark font-extrabold text-lg" : "font-bold"}`}>
        {man(v)}
        <span className="text-xs font-medium text-ink-soft ml-0.5">만</span>
      </div>
    </div>
  );
  return (
    <div className={`flex ${compact ? "gap-4" : "gap-2 rounded-xl bg-paper px-3 py-2.5"}`}>
      {cell("보증금", deposit)}
      {cell("월세", rent, true)}
      {cell("관리비", maintenance)}
    </div>
  );
}

export const DemoTag = ({ className = "" }: { className?: string }) => (
  <span className={`inline-flex items-center rounded-md bg-[#FFF4DE] text-[#8A5A00] text-[11px] font-bold px-1.5 py-0.5 ${className}`} title="공모전 시연용 가상 데이터입니다">
    시연용
  </span>
);
export function CatTag({ cat }: { cat: Category }) {
  const tone: Record<string, string> = {
    transfer_offer: "bg-brand text-white",
    transfer_wanted: "bg-brand-light text-brand-dark",
    roommate_offer: "bg-[#2E6E62] text-white",
    roommate_wanted: "bg-[#E2F1ED] text-[#22594F]",
    life_question: "bg-[#F3EAF8] text-[#6A3C86]",
    life_tip: "bg-[#FFF4DE] text-[#8A5A00]",
    free: "bg-paper text-ink-soft",
    room_showcase: "bg-[#FCEBEC] text-[#9A3540]",
  };
  return <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-bold ${tone[cat]}`}>{CATEGORIES[cat]}</span>;
}
export function StatusPill({ status }: { status: string }) {
  if (status === "closed") return <span className="rounded-md bg-[#EEF0F3] text-ink-soft text-[11px] font-bold px-1.5 py-0.5">모집종료</span>;
  return <span className="rounded-md bg-[#E5F4EB] text-ok text-[11px] font-bold px-1.5 py-0.5">모집중</span>;
}
export function ConsentPill({ v }: { v: keyof typeof LANDLORD_CONSENT }) {
  const s = { agreed: "bg-[#E5F4EB] text-ok", unknown: "bg-[#FFF4DE] text-[#8A5A00]", refused: "bg-[#FDECE4] text-warn" }[v];
  return <span className={`rounded-md text-[11px] font-bold px-1.5 py-0.5 ${s}`}>{LANDLORD_CONSENT[v]}</span>;
}

export function Loading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="불러오는 중">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton h-20" />
      ))}
    </div>
  );
}
export function ErrorState({ error, retry }: { error: ApiError; retry?: () => void }) {
  const nav = useNavigate();
  const loc = useLocation();
  return (
    <div className="card p-6 text-center" role="alert">
      <AlertTriangle className="mx-auto text-warn mb-2" />
      <p className="font-semibold mb-1">{error.message}</p>
      <div className="flex gap-2 justify-center mt-3">
        {error.status === 401 && (
          <button className="btn btn-primary" onClick={() => nav(`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`)}>
            로그인하기
          </button>
        )}
        {retry && error.status !== 401 && error.status !== 403 && error.status !== 404 && (
          <button className="btn btn-line" onClick={retry}>
            <RefreshCw size={16} /> 다시 시도
          </button>
        )}
      </div>
    </div>
  );
}
export function Empty({ title, desc, action }: { title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line p-8 text-center">
      <p className="font-semibold">{title}</p>
      {desc && <p className="text-sm text-ink-soft mt-1">{desc}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
export function FormError({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <p role="alert" className="rounded-lg bg-[#FDECE4] text-warn text-sm font-medium px-3 py-2">
      {msg}
    </p>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    ref.current?.querySelector<HTMLElement>("button, input, textarea, select")?.focus();
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 p-0 sm:p-4" onClick={onClose}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-5 max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-lg">{title}</h2>
          <button className="btn btn-line !min-h-9 !px-2" onClick={onClose} aria-label="닫기">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function useRequireLogin() {
  const { me } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  return () => {
    if (!me.user) {
      nav(`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`);
      return false;
    }
    return true;
  };
}

export function ReportButton({ type, id, small }: { type: string; id: string; small?: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]);
  const [detail, setDetail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const requireLogin = useRequireLogin();
  const submit = async () => {
    setErr(null);
    try {
      await api("/api/reports", { body: { target_type: type, target_id: id, reason: detail ? `${reason}: ${detail}` : reason } });
      setMsg("신고가 접수됐어요. 신고자 정보는 상대에게 공개되지 않아요.");
    } catch (e: any) {
      setErr(e.message);
    }
  };
  return (
    <>
      <button className={`inline-flex items-center gap-1 text-ink-soft hover:text-warn ${small ? "text-xs min-h-8" : "text-sm min-h-11 px-2"}`} onClick={() => requireLogin() && (setOpen(true), setMsg(null))}>
        <Flag size={small ? 12 : 14} /> 신고
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="신고하기">
        {msg ? (
          <div className="space-y-4">
            <p>{msg}</p>
            <button className="btn btn-primary w-full" onClick={() => setOpen(false)}>확인</button>
          </div>
        ) : (
          <div className="space-y-3">
            <fieldset className="grid grid-cols-2 gap-2">
              <legend className="label">사유</legend>
              {REPORT_REASONS.map((r) => (
                <button key={r} type="button" aria-pressed={reason === r} className="chip justify-center" onClick={() => setReason(r)}>
                  {r}
                </button>
              ))}
            </fieldset>
            <textarea className="input min-h-20" placeholder="자세한 내용 (선택)" value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={200} />
            <FormError msg={err} />
            <button className="btn btn-primary w-full" onClick={submit}>신고 접수</button>
          </div>
        )}
      </Modal>
    </>
  );
}

// 직접 만든 가상 원룸 일러스트 (외부 사진 미사용)
const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};
const WALLS = ["#EAF1FA", "#F4EFE7", "#EEF4EC", "#F7ECEC", "#ECEFF7", "#F3F1EA"];
const ACCENTS = ["#4275B9", "#D9A43F", "#5E9C8F", "#C0707A", "#7A6BB0", "#E08A4F"];
export function RoomArt({ seed, className = "", label = "가상 일러스트" }: { seed: string; className?: string; label?: string }) {
  const h = hash(seed);
  const wall = WALLS[h % WALLS.length];
  const acc = ACCENTS[(h >> 3) % ACCENTS.length];
  const acc2 = ACCENTS[(h >> 7) % ACCENTS.length];
  const winX = 20 + ((h >> 5) % 3) * 50;
  const bedLeft = (h >> 9) % 2 === 0;
  const plant = (h >> 11) % 2 === 0;
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: wall }}>
      <svg viewBox="0 0 240 160" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect y="112" width="240" height="48" fill="#E3D6C3" />
        <rect y="110" width="240" height="4" fill="#fff" opacity=".7" />
        <rect x={winX} y="22" width="64" height="54" rx="4" fill="#fff" />
        <rect x={winX + 4} y="26" width="27" height="46" fill="#CFE2F6" />
        <rect x={winX + 33} y="26" width="27" height="46" fill="#DCEBFA" />
        <circle cx={winX + 48} cy="38" r="6" fill="#FFF6D8" />
        <g transform={bedLeft ? "translate(14 0)" : "translate(132 0)"}>
          <rect x="0" y="92" width="94" height="30" rx="5" fill="#fff" />
          <rect x="0" y="86" width="26" height="14" rx="5" fill={acc2} opacity=".85" />
          <rect x="22" y="94" width="72" height="20" rx="4" fill={acc} opacity=".9" />
          <rect x="0" y="120" width="94" height="6" fill="#B79E7E" />
        </g>
        <g transform={bedLeft ? "translate(150 0)" : "translate(22 0)"}>
          <rect x="0" y="86" width="64" height="5" fill="#B79E7E" />
          <rect x="4" y="91" width="4" height="31" fill="#B79E7E" />
          <rect x="56" y="91" width="4" height="31" fill="#B79E7E" />
          <rect x="20" y="70" width="26" height="16" rx="2" fill="#263749" />
          <rect x="8" y="58" width="3" height="28" fill="#263749" />
          <path d="M2 56h16l-4 8H6Z" fill={acc2} />
        </g>
        {plant && (
          <g transform="translate(206 92)">
            <rect x="0" y="16" width="16" height="16" rx="3" fill="#C9A27A" />
            <circle cx="8" cy="10" r="9" fill="#5E9C8F" />
            <circle cx="3" cy="4" r="6" fill="#6FAE9F" />
          </g>
        )}
      </svg>
      <span className="absolute bottom-1.5 right-1.5 rounded bg-white/80 px-1 text-[10px] text-ink-soft">{label}</span>
    </div>
  );
}

export function PeriodBar({ from, to }: { from: string; to?: string | null }) {
  return (
    <div className="flex items-center gap-1.5 text-sm">
      <CalendarRange size={15} className="text-brand shrink-0" />
      <span className="num font-semibold">{fmtDate(from)}</span>
      <span className="flex-1 h-[3px] rounded bg-gradient-to-r from-brand to-brand-light min-w-6" />
      <span className="num font-semibold">{to ? fmtDate(to) : "협의"}</span>
    </div>
  );
}

export function PostCard({ p }: { p: any }) {
  const a = p.attributes || {};
  const housing = ["transfer_offer", "transfer_wanted", "roommate_offer", "roommate_wanted"].includes(p.category);
  return (
    <Link to={`/posts/${p.id}`} className={`card block p-4 hover:border-brand/40 transition ${p.status === "closed" ? "opacity-70" : ""}`}>
      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
        <CatTag cat={p.category} />
        {housing && <StatusPill status={p.status} />}
        {p.category === "transfer_offer" && a.consent && <ConsentPill v={a.consent} />}
        {p.is_demo ? <DemoTag /> : null}
      </div>
      <h3 className="font-bold leading-snug line-clamp-2">{p.title}</h3>
      {p.category === "transfer_offer" && (
        <div className="mt-2.5 space-y-2">
          <Price deposit={a.deposit} rent={a.rent} maintenance={a.maintenance} />
          <PeriodBar from={a.available_from} to={a.contract_end} />
        </div>
      )}
      {p.category === "transfer_wanted" && (
        <p className="mt-1.5 text-sm">
          월세 <b className="num text-brand-dark">{man(a.budget_min)}~{man(a.budget_max)}만</b> · {a.location_pref || "위치 무관"} · <span className="num">{fmtDate(a.period_from)}~</span>
        </p>
      )}
      {(p.category === "roommate_offer" || p.category === "roommate_wanted") && (
        <p className="mt-1.5 text-sm">
          1인 <b className="num text-brand-dark">{man(a.budget)}만</b>/월 · <span className="num">{fmtDate(a.move_in)}</span> 입주
          {a.lifestyle && Object.values(a.lifestyle).length > 0 && <span className="text-ink-soft"> · {Object.values(a.lifestyle).slice(0, 2).join(" · ")}</span>}
        </p>
      )}
      {!housing && <p className="text-sm text-ink-soft mt-1 line-clamp-2">{p.excerpt}</p>}
      <div className="flex items-center gap-3 mt-2.5 text-xs text-ink-soft">
        <span>{p.building_name || p.author_nickname}</span>
        <span>{ago(p.created_at)}</span>
        <span className="ml-auto inline-flex items-center gap-0.5"><Heart size={12} />{p.like_count}</span>
        <span className="inline-flex items-center gap-0.5"><MessageCircle size={12} />{p.comment_count}</span>
      </div>
    </Link>
  );
}

export function LockBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-brand/25 bg-brand-light/60 p-5">
      <div className="flex items-center gap-2 font-bold text-brand-dark mb-1.5">
        <Lock size={18} /> {title}
      </div>
      {children}
    </div>
  );
}

export function Seg<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="flex gap-1.5 scroll-x" role="group">
      {options.map(([v, l]) => (
        <button key={v} type="button" className="chip shrink-0" aria-pressed={value === v} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}
