import { useSearchParams, Link } from "react-router-dom";
import { PenSquare } from "lucide-react";
import { api } from "../api";
import { useLoad, Loading, ErrorState, PostCard, Empty, Seg } from "../ui";
import { CATEGORIES, HOUSING_CATEGORIES, LIFE_CATEGORIES } from "../../shared/constants";

const GROUPS: [string, string][] = [
  ["", "전체"],
  ...HOUSING_CATEGORIES.map((c) => [c, CATEGORIES[c]] as [string, string]),
  ...LIFE_CATEGORIES.map((c) => [c, CATEGORIES[c]] as [string, string]),
];

export default function Community() {
  const [sp, setSp] = useSearchParams();
  const category = sp.get("category") || "";
  const sort = (sp.get("sort") as "latest" | "popular") || "latest";
  const open = sp.get("status") === "open";
  const maxPrice = sp.get("maxPrice") || "";
  const page = Number(sp.get("page") || 1);
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v); else n.delete(k);
    if (k !== "page") n.delete("page");
    setSp(n);
  };
  const qs = new URLSearchParams({ category, sort, page: String(page), size: "12", ...(open ? { status: "open" } : {}), ...(maxPrice ? { maxPrice } : {}) });
  const r = useLoad(() => api(`/api/posts?${qs}`), [qs.toString()]);
  const housing = category.split(",").some((c) => (HOUSING_CATEGORIES as string[]).includes(c)) || category === "";
  const multi = category.includes(",");
  const pages = r.data ? Math.max(1, Math.ceil(r.data.total / r.data.size)) : 1;
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-extrabold tracking-tight">커뮤니티</h1>
        <Link to={`/posts/new${category && !multi ? `?category=${category}` : ""}`} className="btn btn-primary !min-h-10 text-sm"><PenSquare size={16} />글쓰기</Link>
      </div>
      <div className="flex gap-1.5 scroll-x pb-1 -mx-4 px-4 mb-3" role="tablist" aria-label="게시판">
        {GROUPS.map(([c, l]) => (
          <button key={c} role="tab" aria-selected={category === c} className={`chip shrink-0 ${category === c || (multi && c === "" ) ? "" : ""}`} aria-pressed={category === c} onClick={() => set("category", c)}>
            {l}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Seg value={sort} onChange={(v) => set("sort", v === "latest" ? "" : v)} options={[["latest", "최신순"], ["popular", "인기순"]]} />
        {housing && (
          <>
            <button className="chip" aria-pressed={open} onClick={() => set("status", open ? "" : "open")}>모집중만</button>
            <label className="flex items-center gap-1.5 text-sm">
              <span className="text-ink-soft">월세 상한</span>
              <select className="input !min-h-9 !py-1 !w-auto text-sm" value={maxPrice} onChange={(e) => set("maxPrice", e.target.value)}>
                <option value="">제한 없음</option>
                {[350000, 400000, 450000, 500000, 600000].map((v) => <option key={v} value={v}>{v / 10000}만 이하</option>)}
              </select>
            </label>
          </>
        )}
      </div>
      {r.loading ? <Loading rows={4} /> : r.error ? <ErrorState error={r.error} retry={r.reload} /> : r.data.items.length === 0 ? (
        <Empty title="조건에 맞는 글이 없어요" desc="필터를 바꾸거나 첫 글을 남겨 보세요." action={<Link className="btn btn-primary" to="/posts/new">글쓰기</Link>} />
      ) : (
        <>
          <div className="grid md:grid-cols-2 gap-3">{r.data.items.map((p: any) => <PostCard key={p.id} p={p} />)}</div>
          {pages > 1 && (
            <nav className="flex justify-center gap-1.5 mt-6" aria-label="페이지">
              {Array.from({ length: pages }).map((_, i) => (
                <button key={i} className="chip w-11 justify-center" aria-pressed={page === i + 1} onClick={() => set("page", String(i + 1))}>{i + 1}</button>
              ))}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
