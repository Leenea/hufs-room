import { useState } from "react";
import { Link } from "react-router-dom";
import { Info, ChevronRight, Footprints } from "lucide-react";
import { Score, DemoTag } from "../ui";
import { man } from "../api";

export type BuildingSummary = {
  id: string; name: string; address: string; map_x: number | null; map_y: number | null; walk_minutes: number | null;
  avg: number | null; reviewCount: number; verifiedCount: number; min_rent: number | null; min_deposit: number | null; vacancy_count: number; is_demo: number;
};

// 실제 지도 SDK 키가 없을 때 쓰는 가상 동네 배치도 (실제 위치 아님)
export default function NeighborhoodMap({ items, tall }: { items: BuildingSummary[]; tall?: boolean }) {
  const [sel, setSel] = useState<string | null>(null);
  const pins = items.filter((b) => b.map_x !== null && b.map_y !== null);
  const s = items.find((b) => b.id === sel);
  return (
    <div>
      <div className={`relative rounded-2xl overflow-hidden border border-line bg-[#F2F5F0] ${tall ? "h-[420px] lg:h-[520px]" : "h-[260px] lg:h-[340px]"}`}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" aria-hidden="true">
          <rect x="0" y="0" width="100" height="100" fill="#EEF2EA" />
          <path d="M0 18 Q40 22 100 12" stroke="#fff" strokeWidth="5" fill="none" />
          <path d="M0 52 Q50 48 100 54" stroke="#fff" strokeWidth="6" fill="none" />
          <path d="M30 0 Q34 50 26 100" stroke="#fff" strokeWidth="4" fill="none" />
          <path d="M68 0 Q62 50 72 100" stroke="#fff" strokeWidth="4" fill="none" />
          <path d="M0 82 Q60 76 100 86" stroke="#fff" strokeWidth="3" fill="none" />
          <path d="M84 60 Q92 70 100 66 L100 100 L80 100 Z" fill="#DCE9D5" />
          <path d="M0 0 L18 0 Q12 10 0 12 Z" fill="#DCE9D5" />
          <rect x="40" y="2" width="22" height="12" rx="2" fill="#D6E3F3" />
        </svg>
        <div className="absolute left-[40%] top-[2%] w-[22%] h-[12%] grid place-items-center text-[10px] sm:text-xs font-bold text-brand-dark text-center leading-tight">
          캠퍼스<br className="sm:hidden" /> (가상 배치)
        </div>
        {pins.map((b) => (
          <button
            key={b.id}
            className={`absolute -translate-x-1/2 -translate-y-full flex flex-col items-center group focus:outline-none`}
            style={{ left: `${b.map_x}%`, top: `${b.map_y}%` }}
            onClick={() => setSel(b.id === sel ? null : b.id)}
            aria-label={`${b.name} 평점 ${b.avg ?? "없음"}`}
            aria-pressed={sel === b.id}
          >
            <span className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold shadow-md whitespace-nowrap transition ${sel === b.id ? "bg-ink text-white scale-110" : b.avg === null ? "bg-white text-ink-soft" : "bg-brand text-white"} group-focus-visible:ring-4 ring-brand/30`}>
              {b.avg === null ? "미평가" : <>★ <span className="num">{b.avg.toFixed(1)}</span></>}
            </span>
            <span className={`w-0 h-0 border-x-[5px] border-x-transparent border-t-[6px] ${sel === b.id ? "border-t-ink" : b.avg === null ? "border-t-white" : "border-t-brand"}`} />
            <span className="mt-0.5 text-[10px] font-semibold text-ink bg-white/85 rounded px-1 whitespace-nowrap">{b.name.replace(" (가상)", "")}</span>
          </button>
        ))}
        <div className="absolute left-2 bottom-2 flex items-center gap-1 rounded-lg bg-white/90 px-2 py-1 text-[11px] text-ink-soft">
          <Info size={12} /> 지도 API 미연결 · 가상 배치도 (실제 위치 아님)
        </div>
      </div>
      {s && (
        <Link to={`/buildings/${s.id}`} className="card mt-3 p-4 flex items-center gap-3 hover:border-brand/40">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5"><b className="truncate">{s.name}</b>{s.is_demo ? <DemoTag /> : null}</div>
            <div className="mt-1 flex items-center gap-3 text-sm">
              <Score value={s.avg} count={s.reviewCount} />
              {s.min_rent !== null && <span className="num">공실 월세 <b className="text-brand-dark">{man(s.min_rent)}만~</b></span>}
            </div>
          </div>
          <ChevronRight className="text-ink-soft" />
        </Link>
      )}
    </div>
  );
}

export function BuildingRow({ b }: { b: BuildingSummary }) {
  return (
    <Link to={`/buildings/${b.id}`} className="card p-4 flex items-center gap-4 hover:border-brand/40">
      <div className="w-14 h-14 rounded-xl bg-brand-light grid place-items-center shrink-0">
        {b.avg === null ? <span className="text-xs text-ink-soft font-semibold">미평가</span> : <span className="num font-extrabold text-xl text-brand-dark">{b.avg.toFixed(1)}</span>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5"><b className="truncate">{b.name}</b>{b.is_demo ? <DemoTag /> : null}</div>
        <div className="text-xs text-ink-soft mt-0.5 flex flex-wrap gap-x-2">
          <span>후기 {b.reviewCount}{b.verifiedCount ? ` · 인증 ${b.verifiedCount}` : ""}</span>
          {b.walk_minutes !== null && <span className="inline-flex items-center gap-0.5"><Footprints size={12} />정문 {b.walk_minutes}분(확인값)</span>}
        </div>
        {b.reviewCount === 0 && <span className="text-xs text-brand font-semibold">- / 첫 후기 남기기</span>}
      </div>
      <div className="text-right shrink-0">
        {b.min_rent !== null ? (
          <>
            <div className="text-[11px] text-ink-soft">공실 월세</div>
            <div className="num font-extrabold text-brand-dark">{man(b.min_rent)}<span className="text-xs font-medium">만~</span></div>
          </>
        ) : <span className="text-xs text-ink-soft">공실 정보 없음</span>}
      </div>
    </Link>
  );
}
