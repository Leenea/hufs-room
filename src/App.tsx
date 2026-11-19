import { useState, useEffect, FormEvent, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { Bell, Home as HomeIcon, Map, PenSquare, MessagesSquare, User, Search } from "lucide-react";
import { AuthProvider, useAuth } from "./auth";
import { Loading, Modal } from "./ui";
import { api, ago } from "./api";
import Home from "./pages/Home";

const Community = lazy(() => import("./pages/Community"));
const PostDetail = lazy(() => import("./pages/PostDetail"));
const PostNew = lazy(() => import("./pages/PostNew"));
const Buildings = lazy(() => import("./pages/Buildings"));
const BuildingDetail = lazy(() => import("./pages/BuildingDetail"));
const BuildingNew = lazy(() => import("./pages/BuildingNew"));
const ReviewNew = lazy(() => import("./pages/ReviewNew"));
const Market = lazy(() => import("./pages/Market"));
const MarketDetail = lazy(() => import("./pages/MarketDetail"));
const MarketNew = lazy(() => import("./pages/MarketNew"));
const Rooms = lazy(() => import("./pages/Rooms"));
const Chat = lazy(() => import("./pages/Chat"));
const ChatRoom = lazy(() => import("./pages/ChatRoom"));
const MyPage = lazy(() => import("./pages/MyPage"));
const Login = lazy(() => import("./pages/Login"));
const Landlord = lazy(() => import("./pages/Landlord"));
const Admin = lazy(() => import("./pages/Admin"));
const SearchPage = lazy(() => import("./pages/SearchPage"));

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 shrink-0" aria-label="외대원룸 홈">
      <svg width="30" height="30" viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="16" fill="#4275B9" />
        <path d="M14 32 32 17l18 15v16a3 3 0 0 1-3 3H17a3 3 0 0 1-3-3Z" fill="#fff" />
        <path d="M27 51V39h10v12" fill="#4275B9" />
        <circle cx="44" cy="20" r="5" fill="#D9A43F" />
      </svg>
      <span className="font-extrabold text-[19px] tracking-tight text-ink">외대원룸</span>
    </Link>
  );
}

function NotiButton() {
  const { me, refresh } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<any[] | null>(null);
  const nav = useNavigate();
  const show = async () => {
    if (!me.user) return nav("/login");
    setOpen(true);
    setItems(null);
    const r = await api("/api/notifications").catch(() => ({ items: [] }));
    setItems(r.items);
    await api("/api/notifications/read", { method: "POST" }).catch(() => {});
    refresh();
  };
  return (
    <>
      <button className="relative grid place-items-center w-11 h-11 rounded-xl hover:bg-paper" aria-label={`알림${me.unread ? ` ${me.unread}개` : ""}`} onClick={show}>
        <Bell size={21} />
        {!!me.unread && <span className="absolute top-2 right-2 min-w-4 h-4 px-1 rounded-full bg-warn text-white text-[10px] font-bold grid place-items-center">{me.unread}</span>}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="알림">
        {!items ? <Loading rows={2} /> : items.length === 0 ? <p className="text-ink-soft text-sm">새 알림이 없어요.</p> : (
          <ul className="divide-y divide-line">
            {items.map((n) => (
              <li key={n.id}>
                <button className="w-full text-left py-3" onClick={() => { setOpen(false); nav(n.type === "message" ? `/chat/${n.ref_id}` : n.type === "comment" ? `/posts/${n.ref_id}` : `/buildings/${n.ref_id}`); }}>
                  <p className={`text-sm ${n.read_at ? "text-ink-soft" : "font-semibold"}`}>{n.text}</p>
                  <p className="text-xs text-ink-soft">{ago(n.created_at)}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </>
  );
}

function Header() {
  const { me } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [q, setQ] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (q.trim()) nav(`/search?q=${encodeURIComponent(q.trim())}`);
  };
  const tabs = [
    ["/", "홈"], ["/community", "커뮤니티"], ["/buildings", "원룸 후기·지도"], ["/market", "자취템"], ["/rooms", "내 방 자랑"],
  ];
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-line">
      <div className="mx-auto max-w-[1180px] px-4 h-[60px] flex items-center gap-3">
        <Logo />
        <nav className="hidden lg:flex items-center gap-1 ml-4" aria-label="주 메뉴">
          {tabs.map(([to, l]) => (
            <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `px-3 py-2 rounded-lg text-[15px] font-semibold ${isActive ? "text-brand bg-brand-light" : "text-ink-soft hover:text-ink"}`}>
              {l}
            </NavLink>
          ))}
        </nav>
        <form onSubmit={submit} className={`flex-1 max-w-sm ml-auto hidden md:block ${loc.pathname === "/" ? "lg:block" : ""}`} role="search">
          <label className="relative block">
            <span className="sr-only">검색</span>
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
            <input className="input !min-h-10 !pl-9 !rounded-full !bg-paper !border-transparent" placeholder="원룸·건물명·게시글 검색" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
        </form>
        <div className="flex items-center gap-0.5 ml-auto md:ml-0">
          <NotiButton />
          {me.user ? (
            <Link to="/me" className="hidden lg:inline-flex items-center gap-1.5 h-11 px-3 rounded-xl hover:bg-paper font-semibold text-sm" aria-label="마이페이지">
              <span className="grid place-items-center w-7 h-7 rounded-full bg-brand-light text-brand-dark text-xs font-bold">{me.user.nickname.slice(0, 1)}</span>
              {me.user.nickname}
            </Link>
          ) : (
            <Link to="/login" className="btn btn-primary !min-h-10 text-sm">로그인</Link>
          )}
          <Link to="/posts/new" className="hidden lg:inline-flex btn btn-ghost !min-h-10 text-sm ml-1"><PenSquare size={16} />글쓰기</Link>
        </div>
      </div>
    </header>
  );
}

function BottomNav() {
  const items: [string, string, typeof HomeIcon][] = [["/", "홈", HomeIcon], ["/map", "지도", Map], ["/posts/new", "글쓰기", PenSquare], ["/chat", "채팅", MessagesSquare], ["/me", "마이", User]];
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-line" style={{ paddingBottom: "env(safe-area-inset-bottom)" }} aria-label="하단 메뉴">
      <div className="grid grid-cols-5">
        {items.map(([to, l, Icon]) => (
          <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `flex flex-col items-center justify-center h-[60px] text-[11px] font-semibold ${isActive ? "text-brand" : "text-ink-soft"}`}>
            {to === "/posts/new" ? (
              <span className="grid place-items-center w-9 h-9 -mt-1 rounded-full bg-brand text-white"><Icon size={18} /></span>
            ) : <Icon size={22} />}
            <span className="mt-0.5">{l}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

function DemoBanner() {
  return (
    <div className="bg-ink text-white text-[12px] leading-tight">
      <div className="mx-auto max-w-[1180px] px-4 py-1.5 flex items-center gap-2">
        <span className="rounded bg-star text-ink font-bold px-1.5 py-0.5 text-[11px] shrink-0">DEMO</span>
        <span className="opacity-90">G-앵커 창업 아이디어 경진대회 시연판 · 건물·후기·가격·인물은 모두 가상 데이터예요</span>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="hidden lg:block border-t border-line mt-16">
      <div className="mx-auto max-w-[1180px] px-4 py-8 text-xs text-ink-soft space-y-1">
        <p className="font-bold text-ink">외대원룸 · 모현 대학가 주거생활 순환 커뮤니티</p>
        <p>외대원룸은 계약을 체결하거나 중개하지 않으며 이용자 간 정보 교환을 돕습니다. 임차권 양도·전대는 원칙적으로 임대인 동의가 필요해요(민법 제629조).</p>
        <p>본 서비스는 공모전 시연판으로 모든 건물·후기·가격·인물 정보는 가상입니다.</p>
      </div>
    </footer>
  );
}

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollTop />
      <AuthProvider>
        <DemoBanner />
        <Header />
        <main className="mx-auto max-w-[1180px] px-4 pt-4 pb-safe min-h-[70vh]">
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/community" element={<Community />} />
              <Route path="/posts/new" element={<PostNew />} />
              <Route path="/posts/:id" element={<PostDetail />} />
              <Route path="/posts/:id/edit" element={<PostNew />} />
              <Route path="/buildings" element={<Buildings />} />
              <Route path="/map" element={<Buildings mapFirst />} />
              <Route path="/buildings/new" element={<BuildingNew />} />
              <Route path="/buildings/:id" element={<BuildingDetail />} />
              <Route path="/reviews/new" element={<ReviewNew />} />
              <Route path="/reviews/:id/edit" element={<ReviewNew />} />
              <Route path="/market" element={<Market />} />
              <Route path="/market/new" element={<MarketNew />} />
              <Route path="/market/:id" element={<MarketDetail />} />
              <Route path="/market/:id/edit" element={<MarketNew />} />
              <Route path="/rooms" element={<Rooms />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/chat/:id" element={<ChatRoom />} />
              <Route path="/me" element={<MyPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/landlord" element={<Landlord />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="*" element={<div className="py-20 text-center"><p className="font-bold text-lg">페이지를 찾을 수 없어요.</p><Link to="/" className="btn btn-primary mt-4">홈으로</Link></div>} />
            </Routes>
          </Suspense>
        </main>
        <Footer />
        <BottomNav />
      </AuthProvider>
    </BrowserRouter>
  );
}
