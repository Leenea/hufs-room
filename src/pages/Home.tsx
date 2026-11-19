import { useState, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, KeyRound, DoorOpen, Users, UserPlus, ChevronRight, Star, Armchair, Sparkles, ArrowRight } from "lucide-react";
import { api, man } from "../api";
import { useLoad, Loading, ErrorState, PostCard, Seg, RoomArt, DemoTag } from "../ui";
import NeighborhoodMap, { BuildingSummary, BuildingRow } from "../components/NeighborhoodMap";
import { CONDITIONS } from "../../shared/constants";

const MATCH = [
  { cat: "transfer_offer", label: "양도해요", desc: "학기 중 방을 넘겨요", icon: KeyRound, tone: "bg-brand text-white", sub: "text-white/80" },
  { cat: "transfer_wanted", label: "양도 구해요", desc: "남은 계약 이어 살 방", icon: DoorOpen, tone: "bg-brand-light text-brand-dark", sub: "text-brand-dark/70" },
  { cat: "roommate_offer", label: "룸메 구해요", desc: "방 있어요, 같이 살아요", icon: Users, tone: "bg-[#2E6E62] text-white", sub: "text-white/80" },
  { cat: "roommate_wanted", label: "룸메 지원해요", desc: "방 없어요, 함께 구해요", icon: UserPlus, tone: "bg-[#E2F1ED] text-[#22594F]", sub: "text-[#22594F]/70" },
] as const;

function SectionTitle({ title, to, more = "더보기" }: { title: string; to?: string; more?: string }) {
  return (
    <div className="flex items-end justify-between mb-3">
      <h2 className="text-[19px] font-extrabold tracking-tight">{title}</h2>
      {to && <Link to={to} className="text-sm font-semibold text-ink-soft hover:text-brand inline-flex items-center min-h-11">{more}<ChevronRight size={16} /></Link>}
    </div>
  );
}

export default function Home() {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"latest" | "popular">("latest");
  const home = useLoad(() => api("/api/home"), []);
  const bl = useLoad(() => api<{ items: BuildingSummary[] }>("/api/buildings?sort=rating"), []);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (q.trim()) nav(`/search?q=${encodeURIComponent(q.trim())}`);
  };
  const h: any = home.data;
  return (
    <div className="space-y-9">
      {/* 1. 검색 */}
      <section>
        <p className="text-ink-soft text-sm mb-1">모현 대학가 자취의 시작부터 끝까지</p>
        <h1 className="text-[24px] lg:text-[30px] font-extrabold tracking-tight leading-tight mb-3">
          살아본 사람의 후기로 고르고,<br className="sm:hidden" /> <span className="text-brand">학기 단위로 이어 살아요</span>
        </h1>
        <form onSubmit={submit} role="search">
          <label className="relative block">
            <span className="sr-only">원룸·건물명·게시글 검색</span>
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand" />
            <input className="input !min-h-[52px] !pl-12 !rounded-2xl !border-2 !border-brand/30 text-[16px]" placeholder="원룸·건물명·게시글 검색" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
        </form>
      </section>

      {/* 2. 주거 매칭 */}
      <section>
        <SectionTitle title="주거 매칭" to="/community?category=transfer_offer,transfer_wanted,roommate_offer,roommate_wanted" more="전체" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {MATCH.map(({ cat, label, desc, icon: Icon, tone, sub }) => (
            <Link key={cat} to={`/community?category=${cat}`} className={`relative rounded-2xl p-4 min-h-[118px] flex flex-col justify-between overflow-hidden hover:brightness-[.97] ${tone}`}>
              <Icon size={26} strokeWidth={2.2} />
              <div>
                <div className="font-extrabold text-[17px]">{label}</div>
                <div className={`text-xs ${sub}`}>{desc}</div>
              </div>
              <span className="absolute top-3.5 right-3.5 rounded-full bg-white/90 text-ink text-xs font-bold px-2 py-0.5 num">
                {h ? `${h.counts[cat] ?? 0}건` : "·"}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* 3. 실시간 커뮤니티 */}
      <section>
        <SectionTitle title="실시간 커뮤니티" to="/community" />
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Seg value={tab} onChange={setTab} options={[["latest", "최신"], ["popular", "인기"]]} />
          <span className="w-px h-5 bg-line mx-1" />
          {[["life_question", "질문"], ["life_tip", "정보"], ["free", "자유"]].map(([c, l]) => (
            <Link key={c} to={`/community?category=${c}`} className="chip">#{l}</Link>
          ))}
        </div>
        {home.loading ? <Loading rows={3} /> : home.error ? <ErrorState error={home.error} retry={home.reload} /> : (
          <div className="grid lg:grid-cols-2 gap-3">
            {(tab === "latest" ? h.latest : h.popular).map((p: any) => <PostCard key={p.id} p={p} />)}
          </div>
        )}
      </section>

      {/* 4. 자취생활 메뉴 */}
      <section>
        <SectionTitle title="자취생활" />
        <div className="grid grid-cols-3 gap-3">
          {[
            { to: "/buildings", label: "원룸 후기", desc: "항목별 평점·실제 계약가", icon: Star },
            { to: "/market", label: "자취템 장터", desc: "가구·가전 물려주기", icon: Armchair },
            { to: "/rooms", label: "내 방 자랑", desc: "꾸미기 비용·제품", icon: Sparkles },
          ].map(({ to, label, desc, icon: Icon }) => (
            <Link key={to} to={to} className="card p-3.5 lg:p-5 hover:border-brand/40 flex flex-col gap-2">
              <span className="w-10 h-10 rounded-xl bg-brand-light text-brand grid place-items-center"><Icon size={21} /></span>
              <span className="font-bold text-[15px]">{label}</span>
              <span className="text-xs text-ink-soft hidden sm:block">{desc}</span>
            </Link>
          ))}
        </div>
        {h && (
          <div className="mt-3 grid lg:grid-cols-2 gap-3">
            <div className="card p-4">
              <div className="flex items-center justify-between mb-2"><b className="text-sm">방 빼는 선배들의 자취템</b><Link to="/market" className="text-xs text-ink-soft inline-flex items-center min-h-8">전체<ArrowRight size={13} /></Link></div>
              <ul className="divide-y divide-line">
                {h.market.map((m: any) => (
                  <li key={m.id}><Link to={`/market/${m.id}`} className="flex items-center gap-2 py-2.5 text-sm">
                    <span className="flex-1 truncate">{m.title}</span>
                    <span className="text-xs text-ink-soft">{(CONDITIONS as any)[m.condition] ?? ""}</span>
                    <b className={`num ${m.price === 0 ? "text-ok" : ""}`}>{m.price === 0 ? "무료" : `${man(m.price)}만`}</b>
                  </Link></li>
                ))}
              </ul>
            </div>
            <div className="card p-4">
              <div className="flex items-center justify-between mb-2"><b className="text-sm">이번 주 인기 방</b><Link to="/rooms" className="text-xs text-ink-soft inline-flex items-center min-h-8">전체<ArrowRight size={13} /></Link></div>
              <div className="grid grid-cols-3 gap-2">
                {h.rooms.map((r: any) => (
                  <Link key={r.id} to={`/posts/${r.id}`} className="block">
                    <RoomArt seed={r.id} className="aspect-square rounded-xl" label="일러스트" />
                    <p className="text-xs mt-1 line-clamp-1 font-medium">{r.title}</p>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 5. 우리 동네 원룸 평점 */}
      <section>
        <SectionTitle title="우리 동네 원룸 평점" to="/map" more="지도 전체보기" />
        {bl.loading ? <Loading rows={2} /> : bl.error ? <ErrorState error={bl.error} retry={bl.reload} /> : (
          <div className="grid lg:grid-cols-[1.3fr_1fr] gap-4">
            <NeighborhoodMap items={bl.data!.items} />
            <div className="space-y-2.5">
              {bl.data!.items.slice(0, 4).map((b) => <BuildingRow key={b.id} b={b} />)}
              <p className="text-xs text-ink-soft flex items-center gap-1"><DemoTag /> 종합 평점 = 공개 후기별 평균의 산술평균</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
