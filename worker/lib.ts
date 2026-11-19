export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  REVIEW_AUTO_APPROVE?: string;
  FREE_VIEW_LIMIT?: string;
  SCHOOL_EMAIL_DOMAIN?: string;
  ADMIN_BOOTSTRAP_TOKEN?: string;
}

export type User = {
  id: string;
  email: string;
  nickname: string;
  role: "user" | "landlord" | "admin";
  verification_status: string;
  is_demo: number;
  status: string;
  created_at: string;
};

export class HttpError extends Error {
  constructor(public status: number, message: string, public extra?: Record<string, unknown>) {
    super(message);
  }
}

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });

export const uuid = () => crypto.randomUUID();
export const nowIso = () => new Date().toISOString();

// ---------- 입력 검증 ----------
export function str(v: unknown, field: string, min = 1, max = 2000, required = true): string {
  if (v === undefined || v === null || v === "") {
    if (!required) return "";
    throw new HttpError(400, `${field}을(를) 입력해 주세요.`);
  }
  if (typeof v !== "string") throw new HttpError(400, `${field} 형식이 올바르지 않습니다.`);
  const s = v.trim();
  if (s.length < min) throw new HttpError(400, `${field}은(는) ${min}자 이상이어야 합니다.`);
  if (s.length > max) throw new HttpError(400, `${field}은(는) ${max}자 이하로 입력해 주세요.`);
  return s;
}
export function optStr(v: unknown, field: string, max = 500): string | null {
  const s = str(v, field, 0, max, false);
  return s === "" ? null : s;
}
export function int(v: unknown, field: string, min: number, max: number, required = true): number | null {
  if (v === undefined || v === null || v === "") {
    if (!required) return null;
    throw new HttpError(400, `${field}을(를) 입력해 주세요.`);
  }
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isInteger(n)) throw new HttpError(400, `${field}은(는) 정수여야 합니다.`);
  if (n < min || n > max) throw new HttpError(400, `${field} 범위를 확인해 주세요. (${min}~${max})`);
  return n;
}
export function oneOf<T extends string>(v: unknown, field: string, allowed: readonly T[], required = true): T | null {
  if (v === undefined || v === null || v === "") {
    if (!required) return null;
    throw new HttpError(400, `${field}을(를) 선택해 주세요.`);
  }
  if (!allowed.includes(v as T)) throw new HttpError(400, `${field} 값이 올바르지 않습니다.`);
  return v as T;
}
export function strArr(v: unknown, field: string, allowed?: readonly string[], maxLen = 20): string[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.length > maxLen) throw new HttpError(400, `${field} 형식이 올바르지 않습니다.`);
  return v.map((x) => {
    if (typeof x !== "string" || x.length > 60) throw new HttpError(400, `${field} 형식이 올바르지 않습니다.`);
    if (allowed && !allowed.includes(x)) throw new HttpError(400, `${field} 값이 올바르지 않습니다.`);
    return x.trim();
  });
}
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;
export function date(v: unknown, field: string, required = true): string | null {
  if (!v) {
    if (!required) return null;
    throw new HttpError(400, `${field}을(를) 입력해 주세요.`);
  }
  if (typeof v !== "string" || !DATE_RE.test(v) || isNaN(Date.parse(v))) throw new HttpError(400, `${field} 날짜 형식이 올바르지 않습니다.`);
  return v;
}
export function month(v: unknown, field: string): string {
  if (typeof v !== "string" || !MONTH_RE.test(v)) throw new HttpError(400, `${field}을(를) YYYY-MM 형식으로 입력해 주세요.`);
  const m = Number(v.slice(5));
  if (m < 1 || m > 12) throw new HttpError(400, `${field} 월이 올바르지 않습니다.`);
  return v;
}

// 개인정보 패턴 (전화번호, 호수) 탐지
export function guardPrivacy(text: string, field: string) {
  if (/01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/.test(text)) throw new HttpError(400, `${field}에 전화번호를 적을 수 없어요. 대화는 앱 내 채팅을 이용해 주세요.`);
  if (/\b\d{3,4}\s?호\b/.test(text)) throw new HttpError(400, `${field}에 정확한 호수를 적을 수 없어요. 층/방향 정도로만 알려 주세요.`);
}

// ---------- 인증 ----------
const enc = new TextEncoder();
const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)));
export async function sha256(s: string) {
  return b64(await crypto.subtle.digest("SHA-256", enc.encode(s)));
}
export async function hashPassword(pw: string, saltB64?: string) {
  const salt = saltB64 ? Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0)) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 100000 }, key, 256);
  return `pbkdf2$${b64(salt)}$${b64(bits)}`;
}
export async function verifyPassword(pw: string, stored: string | null) {
  if (!stored) return false;
  const [, salt] = stored.split("$");
  const h = await hashPassword(pw, salt);
  if (h.length !== stored.length) return false;
  let diff = 0;
  for (let i = 0; i < h.length; i++) diff |= h.charCodeAt(i) ^ stored.charCodeAt(i);
  return diff === 0;
}
export function getCookie(req: Request, name: string) {
  const c = req.headers.get("cookie") || "";
  const m = c.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}
export async function createSession(env: Env, userId: string, secure: boolean) {
  const raw = b64(crypto.getRandomValues(new Uint8Array(32))).replace(/[+/=]/g, "");
  const exp = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();
  await env.DB.prepare("INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)").bind(await sha256(raw), userId, exp).run();
  return `hr_sess=${raw}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 14}${secure ? "; Secure" : ""}`;
}
export async function currentUser(req: Request, env: Env): Promise<User | null> {
  const raw = getCookie(req, "hr_sess");
  if (!raw) return null;
  const u = await env.DB.prepare(
    `SELECT u.id,u.email,u.nickname,u.role,u.verification_status,u.is_demo,u.status,u.created_at
     FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?`
  )
    .bind(await sha256(raw), nowIso())
    .first<User>();
  if (!u || u.status !== "active") return null;
  return u;
}

// ---------- 요청 제한 ----------
export async function rateLimit(env: Env, key: string, limit: number) {
  const win = Math.floor(Date.now() / 60000);
  const row = await env.DB.prepare(
    `INSERT INTO rate_limits (key,count,window_start) VALUES (?,1,?)
     ON CONFLICT(key) DO UPDATE SET count = CASE WHEN window_start=excluded.window_start THEN count+1 ELSE 1 END,
       window_start = excluded.window_start
     RETURNING count`
  )
    .bind(key, win)
    .first<{ count: number }>();
  if (row && row.count > limit) throw new HttpError(429, "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.");
}

export const parseJ = <T>(s: string | null | undefined, fallback: T): T => {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
};

export function avg(nums: number[]) {
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}
export function reviewAvg(ratings: Record<string, number | null>) {
  return avg(Object.values(ratings).filter((v): v is number => typeof v === "number"));
}
