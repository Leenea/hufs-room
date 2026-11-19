import { useEffect, useRef, useState, FormEvent } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ChevronLeft, Send, Ban, ShieldAlert } from "lucide-react";
import { api, ApiError, fmtTime } from "../api";
import { Loading, ErrorState, FormError, ReportButton, Modal, DemoTag } from "../ui";

export default function ChatRoom() {
  const { id } = useParams();
  const nav = useNavigate();
  const [conv, setConv] = useState<any>(null);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [blockOpen, setBlockOpen] = useState(false);
  const last = useRef("");
  const endRef = useRef<HTMLDivElement>(null);

  const poll = async () => {
    try {
      const r = await api(`/api/conversations/${id}/messages?after=${encodeURIComponent(last.current)}`);
      setConv(r.conversation);
      setBlocked(r.blocked);
      if (r.messages.length) {
        last.current = r.messages[r.messages.length - 1].created_at;
        setMsgs((p) => [...p, ...r.messages.filter((m: any) => !p.some((x) => x.id === m.id))]);
      }
    } catch (e: any) {
      setError(e);
    }
  };
  useEffect(() => {
    last.current = "";
    setMsgs([]);
    poll();
    const t = setInterval(poll, 3000); // 서버 저장 + 3초 폴링 (Realtime 은 추후)
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);

  if (error) return <ErrorState error={error} />;
  if (!conv) return <Loading />;
  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setErr(null);
    try {
      await api(`/api/conversations/${id}/messages`, { body: { body: text } });
      setText("");
      poll();
    } catch (e: any) { setErr(e.message); }
  };
  const toggleBlock = async () => {
    setBlockOpen(false);
    await api("/api/blocks", { body: { user_id: conv.other.id, unblock: blocked } }).catch((e) => setErr(e.message));
    poll();
  };
  const ctxLink = conv.context.type === "post" ? `/posts/${conv.context.id}` : conv.context.type === "market" ? `/market/${conv.context.id}` : `/buildings/${conv.context.id}`;
  return (
    <div className="max-w-2xl mx-auto flex flex-col h-[calc(100dvh-190px)] lg:h-[calc(100vh-170px)]">
      <div className="flex items-center gap-2 pb-2 border-b border-line">
        <button className="grid place-items-center w-11 h-11 -ml-2" onClick={() => nav("/chat")} aria-label="채팅 목록"><ChevronLeft /></button>
        <div className="flex-1 min-w-0">
          <div className="font-bold flex items-center gap-1.5">{conv.other.nickname}{conv.other.is_demo ? <DemoTag /> : null}</div>
          <Link to={ctxLink} className="text-xs text-brand truncate block">{conv.context.title}{conv.context.status === "closed" && " · 모집종료"}</Link>
        </div>
        <ReportButton small type="user" id={conv.other.id} />
        <button className="text-xs text-ink-soft inline-flex items-center gap-1 min-h-11 px-2" onClick={() => setBlockOpen(true)}><Ban size={13} />{blocked ? "차단 해제" : "차단"}</button>
      </div>
      <div className="flex-1 overflow-y-auto py-3 space-y-2" aria-live="polite">
        <p className="mx-auto w-fit max-w-full text-center text-xs text-ink-soft bg-paper rounded-lg px-3 py-2 flex gap-1.5 items-start"><ShieldAlert size={14} className="shrink-0" />계약금 선입금 요구, 외부 메신저 유도에 주의하세요. 양도 계약은 임대인 동의 확인 후 진행하세요.</p>
        {msgs.map((m) => (
          <div key={m.id} className={`flex items-end gap-1.5 ${m.mine ? "justify-end" : ""}`}>
            {m.mine && <span className="text-[10px] text-ink-soft">{fmtTime(m.created_at)}</span>}
            <p className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-[15px] whitespace-pre-wrap ${m.mine ? "bg-brand text-white rounded-br-md" : "bg-paper rounded-bl-md"}`}>{m.body}</p>
            {!m.mine && <span className="text-[10px] text-ink-soft">{fmtTime(m.created_at)}</span>}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <FormError msg={err} />
      <form onSubmit={send} className="flex gap-2 pt-2 border-t border-line">
        <label className="flex-1"><span className="sr-only">메시지</span><input className="input" value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} disabled={blocked} placeholder={blocked ? "차단한 사용자예요" : "메시지 입력"} /></label>
        <button className="btn btn-primary !px-3" disabled={blocked || !text.trim()} aria-label="보내기"><Send size={18} /></button>
      </form>
      <Modal open={blockOpen} onClose={() => setBlockOpen(false)} title={blocked ? "차단을 해제할까요?" : `${conv.other.nickname}님을 차단할까요?`}>
        <p className="text-sm text-ink-soft mb-4">{blocked ? "다시 메시지를 주고받을 수 있어요." : "서로 메시지를 보낼 수 없고 새 대화도 시작할 수 없어요."}</p>
        <div className="flex gap-2"><button className="btn btn-line flex-1" onClick={() => setBlockOpen(false)}>취소</button><button className="btn btn-primary flex-1" onClick={toggleBlock}>확인</button></div>
      </Modal>
    </div>
  );
}
