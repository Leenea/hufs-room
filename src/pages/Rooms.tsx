import { useState } from "react";
import { Link } from "react-router-dom";
import { Heart, MessageCircle, Plus, Trophy } from "lucide-react";
import { api, won } from "../api";
import { useLoad, Loading, ErrorState, Empty, Seg, RoomArt, DemoTag } from "../ui";

export default function Rooms() {
  const [sort, setSort] = useState<"popular" | "latest">("popular");
  const r = useLoad(() => api(`/api/posts?category=room_showcase&sort=${sort}&size=30`), [sort]);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-extrabold tracking-tight">내 방 자랑</h1>
        <Link to="/posts/new?category=room_showcase" className="btn btn-primary !min-h-10 text-sm"><Plus size={16} />자랑하기</Link>
      </div>
      <p className="text-sm text-ink-soft mb-4">꾸미기 비용과 제품 정보까지. 주소·호수가 보이는 사진은 올리지 마세요.</p>
      <div className="mb-4"><Seg value={sort} onChange={setSort} options={[["popular", "인기 순위"], ["latest", "최신"]]} /></div>
      {r.loading ? <Loading /> : r.error ? <ErrorState error={r.error} retry={r.reload} /> : r.data.items.length === 0 ? <Empty title="아직 자랑한 방이 없어요" /> : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {r.data.items.map((p: any, i: number) => (
            <Link key={p.id} to={`/posts/${p.id}`} className="block group">
              <div className="relative">
                <RoomArt seed={p.id} className="aspect-[4/3] rounded-2xl group-hover:brightness-95 transition" />
                {sort === "popular" && i < 3 && <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-xs font-extrabold"><Trophy size={13} className="text-star" />{i + 1}위</span>}
              </div>
              <p className="font-bold mt-2 line-clamp-1">{p.title}</p>
              <p className="text-xs text-ink-soft flex items-center gap-2 mt-0.5">
                {p.attributes?.budget != null && <span className="num">비용 {won(p.attributes.budget)}</span>}
                <span className="inline-flex items-center gap-0.5"><Heart size={12} />{p.like_count}</span>
                <span className="inline-flex items-center gap-0.5"><MessageCircle size={12} />{p.comment_count}</span>
                {p.is_demo ? <DemoTag /> : null}
              </p>
              <p className="text-xs text-brand mt-0.5">{(p.attributes?.style_tags || []).map((t: string) => `#${t}`).join(" ")}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
