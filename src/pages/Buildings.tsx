import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { api } from "../api";
import { useLoad, Loading, ErrorState, Empty, Seg } from "../ui";
import NeighborhoodMap, { BuildingSummary, BuildingRow } from "../components/NeighborhoodMap";

export default function Buildings({ mapFirst }: { mapFirst?: boolean }) {
  const [sort, setSort] = useState<"rating" | "reviews" | "rent" | "walk">("rating");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const r = useLoad(() => api<{ items: BuildingSummary[] }>(`/api/buildings?sort=${sort}&q=${encodeURIComponent(query)}`), [sort, query]);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-extrabold tracking-tight">{mapFirst ? "동네 원룸 지도" : "원룸 후기"}</h1>
        <Link to="/buildings/new" className="btn btn-ghost !min-h-10 text-sm"><Plus size={16} />건물 등록 요청</Link>
      </div>
      <p className="text-sm text-ink-soft mb-4">살아본 사람이 남긴 9개 항목 평점과 실제 계약가. 승인된 건물만 보여요.</p>
      <form className="flex gap-2 mb-3" onSubmit={(e) => { e.preventDefault(); setQuery(q.trim()); }} role="search">
        <label className="relative flex-1"><span className="sr-only">건물 검색</span>
          <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input className="input !pl-9" placeholder="건물명·주소" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <button className="btn btn-line">검색</button>
      </form>
      <div className="mb-4"><Seg value={sort} onChange={setSort} options={[["rating", "평점순"], ["reviews", "후기 많은순"], ["rent", "월세 낮은순"], ["walk", "가까운순"]]} /></div>
      {r.loading ? <Loading rows={3} /> : r.error ? <ErrorState error={r.error} retry={r.reload} /> : r.data!.items.length === 0 ? (
        <Empty title="찾는 건물이 없어요" desc="아직 등록되지 않았다면 등록을 요청해 주세요. 관리자 승인 후 지도에 보여요." action={<Link to="/buildings/new" className="btn btn-primary">건물 등록 요청</Link>} />
      ) : (
        <div className={`grid gap-4 ${mapFirst ? "" : "lg:grid-cols-[1fr_1.1fr]"}`}>
          <div className={mapFirst ? "" : "lg:order-2"}><div className="lg:sticky lg:top-20"><NeighborhoodMap items={r.data!.items} tall={mapFirst} /></div></div>
          <div className={`space-y-2.5 ${mapFirst ? "grid lg:grid-cols-2 gap-2.5 space-y-0" : ""}`}>{r.data!.items.map((b) => <BuildingRow key={b.id} b={b} />)}</div>
        </div>
      )}
    </div>
  );
}
