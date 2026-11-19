import { useSearchParams, Link } from "react-router-dom";
import { Building2 } from "lucide-react";
import { api, man } from "../api";
import { useLoad, Loading, ErrorState, PostCard, Empty } from "../ui";

export default function SearchPage() {
  const [sp] = useSearchParams();
  const q = sp.get("q") || "";
  const r = useLoad(() => api(`/api/search?q=${encodeURIComponent(q)}`), [q]);
  if (r.loading) return <Loading />;
  if (r.error) return <ErrorState error={r.error} retry={r.reload} />;
  const { buildings, posts, market } = r.data;
  const none = !buildings.length && !posts.length && !market.length;
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-extrabold">'{q}' 검색 결과</h1>
      {none && <Empty title="검색 결과가 없어요" desc="건물이 없다면 등록을 요청해 주세요." action={<Link to="/buildings/new" className="btn btn-primary">건물 등록 요청</Link>} />}
      {buildings.length > 0 && <section><h2 className="font-bold mb-2">건물 {buildings.length}</h2><div className="grid sm:grid-cols-2 gap-2">{buildings.map((b: any) => <Link key={b.id} to={`/buildings/${b.id}`} className="card p-4 flex gap-3 items-center hover:border-brand/40"><Building2 className="text-brand" /><span><b>{b.name}</b><br /><span className="text-xs text-ink-soft">{b.address}</span></span></Link>)}</div></section>}
      {posts.length > 0 && <section><h2 className="font-bold mb-2">게시글 {posts.length}</h2><div className="grid md:grid-cols-2 gap-3">{posts.map((p: any) => <PostCard key={p.id} p={p} />)}</div></section>}
      {market.length > 0 && <section><h2 className="font-bold mb-2">자취템 {market.length}</h2><ul className="card divide-y divide-line">{market.map((m: any) => <li key={m.id}><Link to={`/market/${m.id}`} className="flex p-3 text-sm min-h-12"><span className="flex-1">{m.title}</span><b className="num">{m.price === 0 ? "무료" : `${man(m.price)}만`}</b></Link></li>)}</ul></section>}
    </div>
  );
}
