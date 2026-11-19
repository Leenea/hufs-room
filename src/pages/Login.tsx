import { useState, FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { GraduationCap, PenLine, Building, Sparkles } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import { FormError } from "../ui";

const PERSONAS = [
  { key: "freshman", icon: GraduationCap, title: "새내기로 체험", desc: "거주 경험 없음 · 무료 열람권 3회 · 매번 새 계정" },
  { key: "reviewer", icon: PenLine, title: "후기 작성자로 체험", desc: "후기 보유 → 모든 상세 후기·계약가 열람" },
  { key: "senior", icon: Sparkles, title: "4학년 선배로 체험", desc: "양도·장터 글 작성자 시점" },
  { key: "landlord", icon: Building, title: "임대인으로 체험", desc: "A빌라·B하우스 승인된 가상 임대인" },
];

export default function Login() {
  const [sp] = useSearchParams();
  const next = sp.get("next") || "/";
  const nav = useNavigate();
  const { refresh } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [f, setF] = useState({ email: "", password: "", nickname: "" });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const go = async (p: Promise<unknown>) => {
    setErr(null);
    setBusy(true);
    try {
      await p;
      await refresh();
      nav(next.startsWith("/") ? next : "/", { replace: true });
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    go(api(mode === "login" ? "/api/auth/login" : "/api/auth/signup", { body: f }));
  };
  return (
    <div className="max-w-md mx-auto space-y-6 py-2">
      <section>
        <h1 className="text-2xl font-extrabold mb-1">심사위원 체험 계정</h1>
        <p className="text-sm text-ink-soft mb-3">비밀번호 없이 바로 시작해요. 체험 계정 데이터는 모두 시연용(DEMO)이고 관리자 권한은 없어요.</p>
        <div className="grid gap-2">
          {PERSONAS.map(({ key, icon: Icon, title, desc }) => (
            <button key={key} disabled={busy} className="card p-4 flex items-center gap-3 text-left hover:border-brand/50 min-h-16" onClick={() => go(api("/api/auth/demo", { body: { persona: key } }))}>
              <span className="grid place-items-center w-11 h-11 rounded-xl bg-brand-light text-brand shrink-0"><Icon size={21} /></span>
              <span><b className="block">{title}</b><span className="text-xs text-ink-soft">{desc}</span></span>
            </button>
          ))}
        </div>
      </section>
      <div className="flex items-center gap-3 text-xs text-ink-soft"><span className="flex-1 h-px bg-line" />또는 이메일로<span className="flex-1 h-px bg-line" /></div>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-paper">
          {(["login", "signup"] as const).map((m) => <button type="button" key={m} className={`min-h-10 rounded-lg font-semibold text-sm ${mode === m ? "bg-white shadow-sm" : "text-ink-soft"}`} onClick={() => setMode(m)}>{m === "login" ? "로그인" : "회원가입"}</button>)}
        </div>
        <label className="block"><span className="label">이메일</span><input className="input" type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></label>
        <label className="block"><span className="label">비밀번호 {mode === "signup" && <span className="font-normal text-ink-soft">(8자 이상)</span>}</span><input className="input" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required minLength={mode === "signup" ? 8 : 1} /></label>
        {mode === "signup" && <label className="block"><span className="label">닉네임 (공개)</span><input className="input" value={f.nickname} onChange={(e) => setF({ ...f, nickname: e.target.value })} required minLength={2} maxLength={16} /></label>}
        <FormError msg={err} />
        <button className="btn btn-primary w-full" disabled={busy}>{mode === "login" ? "로그인" : "가입하고 시작하기"}</button>
        {mode === "signup" && <p className="text-xs text-ink-soft">가입 시 일반 회원으로 시작해요. 재학 인증·임대인 권한은 별도 신청 후 관리자 검토로 부여돼요. 이메일 인증 메일 발송은 추후 지원.</p>}
      </form>
    </div>
  );
}
