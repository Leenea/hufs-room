import { Link } from "react-router-dom";
import { api, ago } from "../api";
import { useAuth } from "../auth";
import { useLoad, Loading, ErrorState, Empty, DemoTag } from "../ui";
import { CATEGORIES } from "../../shared/constants";

export default function Chat() {
  const { me, loading } = useAuth();
  const r = useLoad(() => (me.user ? api("/api/conversations") : Promise.resolve({ items: [] })), [me.user?.id]);
  if (loading) return <Loading />;
  if (!me.user) return <div className="card p-8 text-center max-w-md mx-auto mt-6"><p className="font-bold mb-3">로그인하면 내 대화를 볼 수 있어요</p><Link className="btn btn-primary" to="/login?next=/chat">로그인 / 체험하기</Link></div>;
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-extrabold mb-1">채팅</h1>
      <p className="text-sm text-ink-soft mb-4">내가 참여한 1:1 대화만 보여요. 전화번호 없이 대화하고, 불편하면 차단·신고할 수 있어요.</p>
      {r.loading ? <Loading /> : r.error ? <ErrorState error={r.error} retry={r.reload} /> : r.data.items.length === 0 ? (
        <Empty title="아직 대화가 없어요" desc="양도·룸메 글이나 자취템에서 '문의하기'를 눌러 대화를 시작해 보세요." action={<Link to="/community" className="btn btn-primary">커뮤니티 보기</Link>} />
      ) : (
        <ul className="card divide-y divide-line">
          {r.data.items.map((c: any) => (
            <li key={c.id}>
              <Link to={`/chat/${c.id}`} className="flex gap-3 p-4 hover:bg-paper">
                <span className="grid place-items-center w-11 h-11 rounded-full bg-brand-light text-brand-dark font-bold shrink-0">{c.other?.nickname?.slice(0, 1)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5"><b className="truncate">{c.other?.nickname}</b>{c.other?.is_demo ? <DemoTag /> : null}<span className="ml-auto text-xs text-ink-soft shrink-0">{c.last_message_at ? ago(c.last_message_at) : ""}</span></div>
                  <p className="text-xs text-brand truncate">{c.context.type === "post" ? (CATEGORIES as any)[c.context.category] : c.context.type === "market" ? "자취템" : "입주 문의"} · {c.context.title}</p>
                  <p className="text-sm text-ink-soft truncate">{c.last_body || "대화를 시작해 보세요"}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
