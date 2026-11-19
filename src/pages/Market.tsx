import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Sofa, Tv, Package, Boxes, ShoppingBag } from "lucide-react";
import { api, man, ago } from "../api";
import { useLoad, Loading, ErrorState, Empty, Seg, DemoTag } from "../ui";
import { MARKET_CATEGORIES, AVAILABILITY, CONDITIONS } from "../../shared/constants";

const ICON: Record<string, typeof Sofa> = { furniture: Sofa, appliance: Tv, living: ShoppingBag, bundle: Boxes, etc: Package };
const TONE: Record<string, string> = { furniture: "bg-[#F4EFE7] text-[#8A6A3F]", appliance: "bg-brand-light text-brand", living: "bg-[#EEF4EC] text-[#4E8577]", bundle: "bg-[#FFF4DE] text-[#8A5A00]", etc: "bg-paper text-ink-soft" };
export const ItemThumb = ({ cat, className = "" }: { cat: string; className?: string }) => {
  const Icon = ICON[cat] ?? Package;
  return <div className={`grid place-items-center rounded-xl ${TONE[cat] ?? TONE.etc} ${className}`}><Icon size={30} strokeWidth={1.6} /></div>;
};

export default function Market() {
  const [cat, setCat] = useState("");
  const [av, setAv] = useState("");
  const [free, setFree] = useState(false);
  const qs = new URLSearchParams({ ...(cat ? { category: cat } : {}), ...(av ? { availability: av } : {}), ...(free ? { free: "1" } : {}) });
  const r = useLoad(() => api(`/api/market?${qs}`), [qs.toString()]);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-extrabold tracking-tight">자취템 장터</h1>
        <Link to="/market/new" className="btn btn-primary !min-h-10 text-sm"><Plus size={16} />물건 올리기</Link>
      </div>
      <p className="text-sm text-ink-soft mb-4">방 빼는 선배의 가구·가전을 다음 입주자에게. 결제·배송 없이 채팅으로 직접 거래해요.</p>
      <div className="space-y-2 mb-4">
        <Seg value={cat} onChange={setCat} options={[["", "전체"], ...Object.entries(MARKET_CATEGORIES)] as [string, string][]} />
        <div className="flex gap-1.5 flex-wrap">
          <Seg value={av} onChange={setAv} options={[["", "모든 상태"], ...Object.entries(AVAILABILITY)] as [string, string][]} />
          <button className="chip" aria-pressed={free} onClick={() => setFree(!free)}>무료 나눔만</button>
        </div>
      </div>
      {r.loading ? <Loading /> : r.error ? <ErrorState error={r.error} retry={r.reload} /> : r.data.items.length === 0 ? <Empty title="조건에 맞는 물건이 없어요" /> : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {r.data.items.map((m: any) => (
            <Link key={m.id} to={`/market/${m.id}`} className={`card p-2.5 hover:border-brand/40 ${m.availability === "done" ? "opacity-60" : ""}`}>
              <div className="relative">
                <ItemThumb cat={m.category} className="aspect-[4/3]" />
                {m.availability !== "selling" && <span className="absolute top-2 left-2 rounded-md bg-ink text-white text-[11px] font-bold px-1.5 py-0.5">{(AVAILABILITY as any)[m.availability]}</span>}
                {m.post_id && <span className="absolute top-2 right-2 rounded-md bg-brand text-white text-[11px] font-bold px-1.5 py-0.5">양도 패키지</span>}
              </div>
              <div className="px-1 pt-2">
                <p className="text-sm font-semibold line-clamp-2 leading-snug min-h-[2.5em]">{m.title}</p>
                <p className={`num font-extrabold mt-1 ${m.price === 0 ? "text-ok" : ""}`}>{m.price === 0 ? "무료 나눔" : `${man(m.price)}만원`}</p>
                <p className="text-[11px] text-ink-soft mt-0.5 flex items-center gap-1">{(CONDITIONS as any)[m.condition]} · {m.area || "지역 미기재"} · {ago(m.created_at)}{m.is_demo ? <DemoTag className="ml-auto" /> : null}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
