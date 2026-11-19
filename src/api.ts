export class ApiError extends Error {
  constructor(public status: number, message: string, public data: any = {}) {
    super(message);
  }
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: opts.method || (opts.body ? "POST" : "GET"),
      headers: opts.body ? { "content-type": "application/json" } : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError(0, "네트워크 연결을 확인해 주세요.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || "요청을 처리하지 못했어요.", data);
  return data as T;
}

// 금액: 원 단위 저장, 만원 단위 표시
export const man = (won: number | null | undefined) => {
  if (won === null || won === undefined) return "-";
  if (won === 0) return "0";
  const m = won / 10000;
  return Number.isInteger(m) ? m.toLocaleString("ko-KR") : m.toFixed(1);
};
export const won = (n: number | null | undefined) => (n === null || n === undefined ? "-" : n === 0 ? "무료" : `${n.toLocaleString("ko-KR")}원`);
export const toWon = (manStr: string) => (manStr === "" ? null : Math.round(Number(manStr) * 10000));

const KST = "Asia/Seoul";
export const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso.length === 10 ? iso + "T00:00:00+09:00" : iso).toLocaleDateString("ko-KR", { timeZone: KST, year: "2-digit", month: "numeric", day: "numeric" }) : "-";
export const ago = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "방금";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}일 전`;
  return fmtDate(iso);
};
export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("ko-KR", { timeZone: KST, hour: "numeric", minute: "2-digit" });
