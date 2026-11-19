import {
  Env, User, HttpError, json, uuid, nowIso, str, optStr, int, oneOf, strArr, date, month, guardPrivacy,
  hashPassword, verifyPassword, createSession, currentUser, rateLimit, parseJ, avg, reviewAvg, sha256, getCookie,
} from "./lib";
import {
  CATEGORIES, Category, HOUSING_CATEGORIES, RATING_ITEMS, RatingKey, CONTRACT_METHODS, FLOOR_BANDS, OPTIONS,
  LANDLORD_CONSENT, MARKET_CATEGORIES, CONDITIONS, AVAILABILITY, LIFESTYLE, ROOM_TYPES, ORIENTATIONS,
} from "../shared/constants";

type Ctx = { req: Request; env: Env; url: URL; params: string[]; user: User | null; body: any };
type Handler = (c: Ctx) => Promise<Response>;
const routes: [string, RegExp, Handler][] = [];
const on = (method: string, path: string, h: Handler) =>
  routes.push([method, new RegExp("^" + path.replace(/:[a-z_]+/g, "([^/]+)") + "/?$"), h]);

const need = (c: Ctx) => {
  if (!c.user) throw new HttpError(401, "로그인이 필요해요.");
  return c.user;
};
const needAdmin = (c: Ctx) => {
  const u = need(c);
  if (u.role !== "admin") throw new HttpError(403, "관리자만 접근할 수 있어요.");
  return u;
};
const ratingKeys = Object.keys(RATING_ITEMS) as RatingKey[];
const freeLimit = (env: Env) => Number(env.FREE_VIEW_LIMIT || 3);
const DEMO_PERSONAS: Record<string, string> = {
  freshman: "00000000-0000-4000-8000-000000000001",
  reviewer: "00000000-0000-4000-8000-000000000002",
  landlord: "00000000-0000-4000-8000-000000000003",
  senior: "00000000-0000-4000-8000-000000000004",
};

async function audit(env: Env, actor: string, action: string, type: string, id: string) {
  await env.DB.prepare("INSERT INTO admin_audit (id,actor_id,action,target_type,target_id) VALUES (?,?,?,?,?)").bind(uuid(), actor, action, type, id).run();
}
async function notify(env: Env, userId: string, type: string, refId: string, text: string) {
  await env.DB.prepare("INSERT INTO notifications (id,user_id,type,ref_id,text) VALUES (?,?,?,?,?)").bind(uuid(), userId, type, refId, text).run();
}
async function isBlocked(env: Env, a: string, b: string) {
  const r = await env.DB.prepare("SELECT 1 FROM blocks WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?)").bind(a, b, b, a).first();
  return !!r;
}

// ================= 인증 =================
on("POST", "/api/auth/signup", async (c) => {
  await rateLimit(c.env, "signup:" + ip(c.req), 8);
  const email = str(c.body.email, "이메일", 5, 120).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "이메일 형식을 확인해 주세요.");
  const password = str(c.body.password, "비밀번호", 8, 72);
  const nickname = str(c.body.nickname, "닉네임", 2, 16);
  const exists = await c.env.DB.prepare("SELECT 1 FROM users WHERE email=? OR nickname=?").bind(email, nickname).first();
  if (exists) throw new HttpError(409, "이미 사용 중인 이메일 또는 닉네임이에요.");
  const id = uuid();
  // 역할은 항상 user 로 시작. 클라이언트가 보낸 role 값은 무시한다.
  await c.env.DB.prepare("INSERT INTO users (id,email,password_hash,nickname,role) VALUES (?,?,?,?,'user')")
    .bind(id, email, await hashPassword(password), nickname).run();
  const cookie = await createSession(c.env, id, c.url.protocol === "https:");
  return json({ ok: true, id }, 201, { "set-cookie": cookie });
});
on("POST", "/api/auth/login", async (c) => {
  await rateLimit(c.env, "login:" + ip(c.req), 10);
  const email = str(c.body.email, "이메일", 3, 120).toLowerCase();
  const password = str(c.body.password, "비밀번호", 1, 72);
  const u = await c.env.DB.prepare("SELECT id,password_hash,status FROM users WHERE email=? AND is_demo=0").bind(email).first<any>();
  if (!u || !(await verifyPassword(password, u.password_hash))) throw new HttpError(401, "이메일 또는 비밀번호가 맞지 않아요.");
  if (u.status !== "active") throw new HttpError(403, "이용이 제한된 계정이에요.");
  const cookie = await createSession(c.env, u.id, c.url.protocol === "https:");
  return json({ ok: true }, 200, { "set-cookie": cookie });
});
on("POST", "/api/auth/demo", async (c) => {
  await rateLimit(c.env, "demo:" + ip(c.req), 20);
  if (c.body.persona === "freshman") {
    // 심사위원마다 깨끗한 상태로 체험하도록 새 DEMO 계정을 만든다 (거주 경험 없음 → 무료 열람권 3회)
    const nid = uuid();
    const tag = Math.random().toString(36).slice(2, 6).toUpperCase();
    await c.env.DB.prepare("INSERT INTO users (id,email,nickname,role,is_demo) VALUES (?,?,?,'user',1)").bind(nid, `guest-${nid}@demo.hufsroom.invalid`, `체험새내기-${tag}`).run();
    const cookie = await createSession(c.env, nid, c.url.protocol === "https:");
    return json({ ok: true }, 200, { "set-cookie": cookie });
  }
  const id = DEMO_PERSONAS[c.body.persona as string];
  if (!id) throw new HttpError(400, "체험 계정을 선택해 주세요.");
  const u = await c.env.DB.prepare("SELECT id FROM users WHERE id=? AND is_demo=1 AND role!='admin'").bind(id).first();
  if (!u) throw new HttpError(404, "체험 계정이 준비되지 않았어요. (seed 필요)");
  const cookie = await createSession(c.env, id, c.url.protocol === "https:");
  return json({ ok: true }, 200, { "set-cookie": cookie });
});
on("POST", "/api/auth/logout", async (c) => {
  const raw = getCookie(c.req, "hr_sess");
  if (raw) await c.env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await sha256(raw)).run();
  return json({ ok: true }, 200, { "set-cookie": "hr_sess=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax" });
});

async function accessSummary(env: Env, user: User | null) {
  if (!user) return { level: "anon", freeLeft: 0, hasReview: false, viewed: [] as string[] };
  const rv = await env.DB.prepare("SELECT COUNT(*) n FROM building_reviews WHERE author_id=? AND status='published'").bind(user.id).first<{ n: number }>();
  const views = await env.DB.prepare("SELECT building_id FROM review_views WHERE user_id=? AND source='free'").bind(user.id).all<{ building_id: string }>();
  const viewed = views.results.map((r) => r.building_id);
  const hasReview = (rv?.n ?? 0) > 0;
  return {
    level: hasReview || user.role === "admin" ? "full" : "limited",
    hasReview,
    freeLeft: Math.max(0, freeLimit(env) - viewed.length),
    viewed,
  };
}

on("GET", "/api/me", async (c) => {
  if (!c.user) return json({ user: null });
  const u = c.user;
  const access = await accessSummary(c.env, u);
  const unread = await c.env.DB.prepare("SELECT COUNT(*) n FROM notifications WHERE user_id=? AND read_at IS NULL").bind(u.id).first<{ n: number }>();
  const landlord = await c.env.DB.prepare("SELECT COUNT(*) n FROM landlord_buildings WHERE landlord_id=? AND status='approved'").bind(u.id).first<{ n: number }>();
  return json({
    user: { id: u.id, nickname: u.nickname, email: u.email, role: u.role, verification_status: u.verification_status, is_demo: !!u.is_demo, created_at: u.created_at },
    access,
    unread: unread?.n ?? 0,
    isLandlord: (landlord?.n ?? 0) > 0,
  });
});
on("GET", "/api/me/activity", async (c) => {
  const u = need(c);
  const db = c.env.DB;
  const [posts, reviews, saved, market, verif, lmap] = await Promise.all([
    db.prepare("SELECT id,category,title,status,created_at FROM posts WHERE author_id=? AND status!='hidden' ORDER BY created_at DESC LIMIT 50").bind(u.id).all(),
    db.prepare("SELECT r.id,r.building_id,b.name building_name,r.status,r.verification_status,r.start_month,r.end_month,r.created_at FROM building_reviews r JOIN buildings b ON b.id=r.building_id WHERE r.author_id=? ORDER BY r.created_at DESC").bind(u.id).all(),
    db.prepare("SELECT p.id,p.category,p.title,p.status FROM reactions x JOIN posts p ON p.id=x.post_id WHERE x.user_id=? AND x.type='save' AND p.status!='hidden' ORDER BY x.created_at DESC").bind(u.id).all(),
    db.prepare("SELECT id,title,price,availability,created_at FROM market_items WHERE author_id=? AND status='published' ORDER BY created_at DESC").bind(u.id).all(),
    db.prepare("SELECT type,status,created_at FROM verification_requests WHERE user_id=? ORDER BY created_at DESC").bind(u.id).all(),
    db.prepare("SELECT lb.building_id,b.name,lb.status FROM landlord_buildings lb JOIN buildings b ON b.id=lb.building_id WHERE lb.landlord_id=?").bind(u.id).all(),
  ]);
  const viewed = await db.prepare("SELECT v.building_id,b.name,v.source,v.created_at FROM review_views v JOIN buildings b ON b.id=v.building_id WHERE v.user_id=?").bind(u.id).all();
  return json({ posts: posts.results, reviews: reviews.results, saved: saved.results, market: market.results, verifications: verif.results, landlordBuildings: lmap.results, viewed: viewed.results });
});
on("POST", "/api/me/verification", async (c) => {
  const u = need(c);
  const type = oneOf(c.body.type, "인증 종류", ["student"] as const)!;
  const pending = await c.env.DB.prepare("SELECT 1 FROM verification_requests WHERE user_id=? AND type=? AND status='pending'").bind(u.id, type).first();
  if (pending) throw new HttpError(409, "이미 검토 대기 중인 신청이 있어요.");
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO verification_requests (id,user_id,type,note) VALUES (?,?,?,?)").bind(uuid(), u.id, type, optStr(c.body.note, "메모", 200)),
    c.env.DB.prepare("UPDATE users SET verification_status='pending', updated_at=? WHERE id=? AND verification_status!='verified'").bind(nowIso(), u.id),
  ]);
  return json({ ok: true }, 201);
});
on("GET", "/api/notifications", async (c) => {
  const u = need(c);
  const r = await c.env.DB.prepare("SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 30").bind(u.id).all();
  return json({ items: r.results });
});
on("POST", "/api/notifications/read", async (c) => {
  const u = need(c);
  await c.env.DB.prepare("UPDATE notifications SET read_at=? WHERE user_id=? AND read_at IS NULL").bind(nowIso(), u.id).run();
  return json({ ok: true });
});

// ================= 건물 =================
type ReviewRow = { id: string; building_id: string; ratings: string; verification_status: string };
async function buildingStats(env: Env, ids?: string[]) {
  const rows = await env.DB.prepare("SELECT id,building_id,ratings,verification_status FROM building_reviews WHERE status='published'").all<ReviewRow>();
  const map = new Map<string, { avgs: number[]; count: number; verified: number; items: Record<string, number[]> }>();
  for (const r of rows.results) {
    if (ids && !ids.includes(r.building_id)) continue;
    const ratings = parseJ<Record<string, number | null>>(r.ratings, {});
    const a = reviewAvg(ratings);
    const s = map.get(r.building_id) ?? { avgs: [], count: 0, verified: 0, items: {} };
    s.count++;
    if (r.verification_status === "verified" || r.verification_status === "verified_demo") s.verified++;
    if (a !== null) s.avgs.push(a);
    for (const k of ratingKeys) if (typeof ratings[k] === "number") (s.items[k] ??= []).push(ratings[k] as number);
    map.set(r.building_id, s);
  }
  return (id: string) => {
    const s = map.get(id);
    if (!s) return { avg: null, reviewCount: 0, verifiedCount: 0, items: {} as Record<string, { avg: number | null; n: number }> };
    const items: Record<string, { avg: number | null; n: number }> = {};
    for (const k of ratingKeys) items[k] = { avg: avg(s.items[k] ?? []), n: (s.items[k] ?? []).length };
    return { avg: avg(s.avgs), reviewCount: s.count, verifiedCount: s.verified, items };
  };
}

on("GET", "/api/buildings", async (c) => {
  const q = (c.url.searchParams.get("q") || "").trim().slice(0, 40);
  const sort = c.url.searchParams.get("sort") || "rating";
  const rows = await c.env.DB.prepare(
    `SELECT b.id,b.name,b.address,b.map_x,b.map_y,b.lat,b.lng,b.walk_minutes,b.amenities,b.is_demo,
       (SELECT MIN(rent) FROM vacancies v WHERE v.building_id=b.id AND v.status='open') min_rent,
       (SELECT MIN(deposit) FROM vacancies v WHERE v.building_id=b.id AND v.status='open') min_deposit,
       (SELECT COUNT(*) FROM vacancies v WHERE v.building_id=b.id AND v.status='open') vacancy_count
     FROM buildings b WHERE b.status='approved' ${q ? "AND (b.name LIKE ? OR b.address LIKE ?)" : ""}`
  ).bind(...(q ? [`%${q}%`, `%${q}%`] : [])).all<any>();
  const stats = await buildingStats(c.env);
  let items = rows.results.map((b) => {
    const s = stats(b.id);
    return { ...b, amenities: parseJ(b.amenities, []), avg: s.avg, reviewCount: s.reviewCount, verifiedCount: s.verifiedCount };
  });
  const by: Record<string, (a: any, b: any) => number> = {
    rating: (a, b) => (b.avg ?? -1) - (a.avg ?? -1),
    reviews: (a, b) => b.reviewCount - a.reviewCount,
    rent: (a, b) => (a.min_rent ?? 1e12) - (b.min_rent ?? 1e12),
    walk: (a, b) => (a.walk_minutes ?? 999) - (b.walk_minutes ?? 999),
    name: (a, b) => a.name.localeCompare(b.name, "ko"),
  };
  items.sort(by[sort] ?? by.rating);
  return json({ items });
});

on("GET", "/api/buildings/:id", async (c) => {
  const id = c.params[0];
  const b = await c.env.DB.prepare("SELECT * FROM buildings WHERE id=?").bind(id).first<any>();
  // 승인 전 건물은 등록 요청자와 관리자에게만 보인다
  if (!b || (b.status !== "approved" && !(c.user && (c.user.role === "admin" || c.user.id === b.submitted_by))))
    throw new HttpError(404, "건물을 찾을 수 없어요.");
  const stats = (await buildingStats(c.env, [id]))(id);
  const access = await accessSummary(c.env, c.user);
  const isLandlordHere = c.user
    ? !!(await c.env.DB.prepare("SELECT 1 FROM landlord_buildings WHERE landlord_id=? AND building_id=? AND status='approved'").bind(c.user.id, id).first())
    : false;
  const unlockedByFree = access.viewed.includes(id);
  const full = access.level === "full" || unlockedByFree || isLandlordHere;
  const db = c.env.DB;
  const [vac, rep, revs, landlord] = await Promise.all([
    db.prepare("SELECT id,available_from,deposit,rent,maintenance,room_type,updated_at FROM vacancies WHERE building_id=? AND status='open' ORDER BY available_from").bind(id).all(),
    db.prepare("SELECT id,summary,completed_at FROM repairs WHERE building_id=? ORDER BY completed_at DESC").bind(id).all(),
    db.prepare(
      `SELECT r.*, u.nickname author_nickname, lr.body reply_body, lr.created_at reply_at
       FROM building_reviews r JOIN users u ON u.id=r.author_id LEFT JOIN landlord_replies lr ON lr.review_id=r.id AND lr.status='published'
       WHERE r.building_id=? AND r.status='published' ORDER BY r.created_at DESC`
    ).bind(id).all<any>(),
    db.prepare("SELECT 1 FROM landlord_buildings WHERE building_id=? AND status='approved'").bind(id).first(),
  ]);
  const reviews = revs.results.map((r) => {
    const ratings = parseJ<Record<string, number | null>>(r.ratings, {});
    const base = {
      id: r.id, author_nickname: r.author_nickname, start_month: r.start_month, end_month: r.end_month,
      floor_band: r.floor_band, room_type: r.room_type, avg: reviewAvg(ratings), verification_status: r.verification_status,
      is_demo: !!r.is_demo, created_at: r.created_at, mine: c.user?.id === r.author_id,
    };
    if (!full) return { ...base, body: r.body.slice(0, 70) + (r.body.length > 70 ? "…" : ""), locked: true };
    return {
      ...base, locked: false, body: r.body, ratings, orientation: r.orientation, options: parseJ(r.options, []),
      deposit: r.deposit, monthly_rent: r.monthly_rent, maintenance_fee: r.maintenance_fee, broker_fee: r.broker_fee,
      contract_method: r.contract_method, renewal_intent: r.renewal_intent,
      reply: r.reply_body ? { body: r.reply_body, created_at: r.reply_at } : null,
    };
  });
  // 잠금 상태: 항목별 평점은 3개만 미리보기, 계약금액은 응답에서 제외
  const previewKeys: RatingKey[] = ["access", "sunlight", "soundproof"];
  const items = full ? stats.items : Object.fromEntries(previewKeys.map((k) => [k, stats.items[k] ?? { avg: null, n: 0 }]));
  let contract: any = null;
  if (full) {
    const priced = revs.results.filter((r) => r.monthly_rent != null);
    contract = {
      n: priced.length,
      deposit: avg(priced.map((r) => r.deposit).filter((x: any) => x != null)),
      rent: avg(priced.map((r) => r.monthly_rent)),
      maintenance: avg(priced.map((r) => r.maintenance_fee).filter((x: any) => x != null)),
      broker: avg(priced.map((r) => r.broker_fee).filter((x: any) => x != null)),
      latestMonth: priced.map((r) => r.end_month).sort().at(-1) ?? null,
    };
  }
  return json({
    building: { ...b, amenities: parseJ(b.amenities, []), submitted_by: undefined, normalized_address: undefined, hasLandlord: !!landlord },
    stats: { avg: stats.avg, reviewCount: stats.reviewCount, verifiedCount: stats.verifiedCount, items },
    vacancies: vac.results, repairs: rep.results, reviews: full ? reviews : reviews.slice(0, 2), hiddenReviewCount: full ? 0 : Math.max(0, reviews.length - 2),
    contract,
    access: { full, level: access.level, freeLeft: access.freeLeft, unlockedByFree, isLandlord: isLandlordHere, loggedIn: !!c.user },
  });
});

on("POST", "/api/review-views", async (c) => {
  const u = need(c);
  const bid = str(c.body.building_id, "건물", 1, 64);
  const access = await accessSummary(c.env, u);
  if (access.level === "full" || access.viewed.includes(bid)) return json({ ok: true, already: true });
  const has = await c.env.DB.prepare("SELECT COUNT(*) n FROM building_reviews WHERE building_id=? AND status='published'").bind(bid).first<{ n: number }>();
  if (!has?.n) throw new HttpError(400, "아직 열람할 후기가 없어 열람권을 차감하지 않았어요.");
  // 중복 차감 방지 + 한도 검사를 한 문장으로 처리 (원자적)
  const r = await c.env.DB.prepare(
    `INSERT INTO review_views (user_id,building_id,source)
     SELECT ?1,?2,'free' WHERE NOT EXISTS (SELECT 1 FROM review_views WHERE user_id=?1 AND building_id=?2)
       AND (SELECT COUNT(*) FROM review_views WHERE user_id=?1 AND source='free') < ?3`
  ).bind(u.id, bid, freeLimit(c.env)).run();
  if (!r.meta.changes) {
    const again = await c.env.DB.prepare("SELECT 1 FROM review_views WHERE user_id=? AND building_id=?").bind(u.id, bid).first();
    if (again) return json({ ok: true, already: true });
    throw new HttpError(403, "무료 열람권을 모두 사용했어요. 살았던 방의 후기를 남기면 전체 후기를 볼 수 있어요.");
  }
  return json({ ok: true, freeLeft: access.freeLeft - 1 });
});

const normAddr = (s: string) => s.replace(/[\s,.\-()]/g, "").replace(/번지/g, "").toLowerCase();
on("POST", "/api/buildings", async (c) => {
  const u = need(c);
  await rateLimit(c.env, "w:" + u.id, 30);
  const name = str(c.body.name, "건물명", 2, 40);
  const address = str(c.body.address, "주소", 5, 120);
  guardPrivacy(address, "주소");
  const norm = normAddr(address);
  const dup = await c.env.DB.prepare("SELECT id,name,status FROM buildings WHERE normalized_address=?").bind(norm).first<any>();
  if (dup) throw new HttpError(409, `이미 등록된 주소예요: ${dup.name}${dup.status === "pending" ? " (승인 대기)" : ""}`, { existingId: dup.status === "approved" ? dup.id : null });
  const id = uuid();
  await c.env.DB.prepare(
    "INSERT INTO buildings (id,name,address,normalized_address,description,amenities,status,submitted_by,walk_minutes) VALUES (?,?,?,?,?,?,'pending',?,NULL)"
  ).bind(id, name, address, norm, optStr(c.body.description, "특징", 500), JSON.stringify(strArr(c.body.amenities, "편의시설", OPTIONS)), u.id).run();
  if (c.body.as_landlord) {
    await c.env.DB.batch([
      c.env.DB.prepare("INSERT OR IGNORE INTO landlord_buildings (landlord_id,building_id,status) VALUES (?,?,'pending')").bind(u.id, id),
      c.env.DB.prepare("INSERT INTO verification_requests (id,user_id,type,building_id,note) VALUES (?,?,'landlord',?,?)").bind(uuid(), u.id, id, "건물 등록과 함께 신청"),
    ]);
  }
  return json({ ok: true, id, status: "pending" }, 201);
});

// ================= 후기 =================
function parseReview(b: any) {
  const ratings: Record<string, number | null> = {};
  let rated = 0;
  for (const k of ratingKeys) {
    const v = b.ratings?.[k];
    if (v === null || v === undefined || v === "na") ratings[k] = null;
    else {
      ratings[k] = int(v, RATING_ITEMS[k], 1, 5);
      rated++;
    }
  }
  if (rated < 3) throw new HttpError(400, "평점은 3개 항목 이상 매겨 주세요. 모르는 항목은 N/A로 두면 돼요.");
  const start = month(b.start_month, "입주 월");
  const end = month(b.end_month, "퇴거(예정) 월");
  if (start > end) throw new HttpError(400, "퇴거 월이 입주 월보다 빠를 수 없어요.");
  const body = str(b.body, "상세 후기", 20, 3000);
  guardPrivacy(body, "상세 후기");
  return {
    start, end, ratings, body,
    floor_band: oneOf(b.floor_band, "층", Object.keys(FLOOR_BANDS) as any, false),
    orientation: oneOf(b.orientation, "방향", ORIENTATIONS as any, false),
    room_type: oneOf(b.room_type, "방 유형", ROOM_TYPES as any, false),
    deposit: int(b.deposit, "보증금", 0, 500_000_000, false),
    monthly_rent: int(b.monthly_rent, "월세", 0, 10_000_000, false),
    maintenance_fee: int(b.maintenance_fee, "관리비", 0, 2_000_000, false),
    broker_fee: int(b.broker_fee, "중개보수", 0, 10_000_000, false),
    contract_method: oneOf(b.contract_method, "계약 경로", Object.keys(CONTRACT_METHODS) as any, false),
    options: strArr(b.options, "옵션", OPTIONS),
    renewal_intent: oneOf(b.renewal_intent, "재계약 의향", ["yes", "no", "unsure"] as const, false),
    verify: !!b.request_verification,
  };
}
on("POST", "/api/reviews", async (c) => {
  const u = need(c);
  await rateLimit(c.env, "w:" + u.id, 30);
  const bid = str(c.body.building_id, "건물", 1, 64);
  const b = await c.env.DB.prepare("SELECT id FROM buildings WHERE id=? AND status='approved'").bind(bid).first();
  if (!b) throw new HttpError(404, "승인된 건물에만 후기를 쓸 수 있어요.");
  const r = parseReview(c.body);
  const dup = await c.env.DB.prepare("SELECT id FROM building_reviews WHERE author_id=? AND building_id=? AND start_month=? AND end_month=?").bind(u.id, bid, r.start, r.end).first<any>();
  if (dup) throw new HttpError(409, "같은 건물·거주기간의 후기가 이미 있어요. 기존 후기를 수정해 주세요.", { existingId: dup.id });
  const id = uuid();
  const status = c.env.REVIEW_AUTO_APPROVE === "true" ? "published" : "pending";
  await c.env.DB.prepare(
    `INSERT INTO building_reviews (id,building_id,author_id,start_month,end_month,floor_band,orientation,room_type,deposit,monthly_rent,maintenance_fee,broker_fee,contract_method,options,ratings,renewal_intent,body,verification_status,status,is_demo)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(id, bid, u.id, r.start, r.end, r.floor_band, r.orientation, r.room_type, r.deposit, r.monthly_rent, r.maintenance_fee, r.broker_fee, r.contract_method,
    JSON.stringify(r.options), JSON.stringify(r.ratings), r.renewal_intent, r.body, r.verify ? "requested" : "none", status, u.is_demo).run();
  return json({ ok: true, id, status }, 201);
});
on("GET", "/api/reviews/:id", async (c) => {
  const u = need(c);
  const r = await c.env.DB.prepare("SELECT * FROM building_reviews WHERE id=?").bind(c.params[0]).first<any>();
  if (!r) throw new HttpError(404, "후기를 찾을 수 없어요.");
  if (r.author_id !== u.id) throw new HttpError(403, "본인 후기만 수정할 수 있어요.");
  return json({ review: { ...r, ratings: parseJ(r.ratings, {}), options: parseJ(r.options, []) } });
});
on("PATCH", "/api/reviews/:id", async (c) => {
  const u = need(c);
  const cur = await c.env.DB.prepare("SELECT author_id,building_id,status FROM building_reviews WHERE id=?").bind(c.params[0]).first<any>();
  if (!cur) throw new HttpError(404, "후기를 찾을 수 없어요.");
  if (cur.author_id !== u.id) throw new HttpError(403, "본인 후기만 수정할 수 있어요.");
  if (cur.status === "hidden" || cur.status === "rejected") throw new HttpError(403, "운영 정책으로 숨겨진 후기는 수정할 수 없어요.");
  const r = parseReview(c.body);
  const dup = await c.env.DB.prepare("SELECT id FROM building_reviews WHERE author_id=? AND building_id=? AND start_month=? AND end_month=? AND id!=?").bind(u.id, cur.building_id, r.start, r.end, c.params[0]).first();
  if (dup) throw new HttpError(409, "같은 거주기간의 후기가 이미 있어요.");
  await c.env.DB.prepare(
    `UPDATE building_reviews SET start_month=?,end_month=?,floor_band=?,orientation=?,room_type=?,deposit=?,monthly_rent=?,maintenance_fee=?,broker_fee=?,contract_method=?,options=?,ratings=?,renewal_intent=?,body=?,updated_at=? WHERE id=?`
  ).bind(r.start, r.end, r.floor_band, r.orientation, r.room_type, r.deposit, r.monthly_rent, r.maintenance_fee, r.broker_fee, r.contract_method,
    JSON.stringify(r.options), JSON.stringify(r.ratings), r.renewal_intent, r.body, nowIso(), c.params[0]).run();
  return json({ ok: true });
});

// ================= 게시글 =================
function parseAttributes(cat: Category, a: any): { attrs: Record<string, unknown>; price: number | null } {
  a = a || {};
  const lifestyle = () => {
    const out: Record<string, string> = {};
    for (const [k, def] of Object.entries(LIFESTYLE)) {
      const v = oneOf(a.lifestyle?.[k], def.label, def.options as readonly string[], false);
      if (v) out[k] = v;
    }
    return out;
  };
  switch (cat) {
    case "transfer_offer": {
      const deposit = int(a.deposit, "보증금", 0, 500_000_000)!;
      const rent = int(a.rent, "월세", 0, 10_000_000)!;
      const maintenance = int(a.maintenance, "관리비", 0, 2_000_000)!;
      const from = date(a.available_from, "입주 가능일")!;
      const end = date(a.contract_end, "계약 종료일")!;
      if (from > end) throw new HttpError(400, "입주 가능일이 계약 종료일보다 늦을 수 없어요.");
      const consent = oneOf(a.consent, "임대인 동의 상태", Object.keys(LANDLORD_CONSENT) as any)!;
      const conditions = optStr(a.conditions, "양도 조건", 500);
      if (conditions) guardPrivacy(conditions, "양도 조건");
      const pkg = a.package?.enabled
        ? { enabled: true, note: optStr(a.package.note, "패키지 설명", 200), price: int(a.package.price, "패키지 가격", 0, 10_000_000, false), item_ids: strArr(a.package.item_ids, "패키지 물품", undefined, 10) }
        : { enabled: false };
      return {
        attrs: { deposit, rent, maintenance, available_from: from, contract_end: end, consent, conditions, options: strArr(a.options, "옵션", OPTIONS),
          room_type: oneOf(a.room_type, "방 유형", ROOM_TYPES as any, false), floor_band: oneOf(a.floor_band, "층", Object.keys(FLOOR_BANDS) as any, false),
          building_name_free: optStr(a.building_name_free, "건물명", 40), package: pkg },
        price: rent,
      };
    }
    case "transfer_wanted": {
      const min = int(a.budget_min, "최소 예산", 0, 10_000_000)!;
      const max = int(a.budget_max, "최대 예산", 0, 10_000_000)!;
      if (min > max) throw new HttpError(400, "예산 범위를 확인해 주세요.");
      const from = date(a.period_from, "희망 입주일")!;
      const to = date(a.period_to, "희망 종료일", false);
      if (to && from > to) throw new HttpError(400, "희망 기간을 확인해 주세요.");
      return { attrs: { budget_min: min, budget_max: max, deposit_max: int(a.deposit_max, "보증금 상한", 0, 500_000_000, false), period_from: from, period_to: to, location_pref: optStr(a.location_pref, "선호 위치", 60), required_options: strArr(a.required_options, "필수 옵션", OPTIONS) }, price: max };
    }
    case "roommate_offer":
    case "roommate_wanted": {
      const budget = int(a.budget, "1인 월 부담액", 0, 5_000_000)!;
      const move_in = date(a.move_in, "입주 희망일")!;
      return {
        attrs: {
          budget, move_in, members: cat === "roommate_offer" ? int(a.members, "구하는 인원", 1, 5)! : null,
          housing_type: optStr(a.housing_type, "거주 형태", 40), lifestyle: lifestyle(),
          gender_self: oneOf(a.gender_self, "본인 성별 표기", ["여성", "남성", "밝히지 않음"] as const, false),
          gender_pref: oneOf(a.gender_pref, "선호 성별", ["여성", "남성", "무관"] as const, false),
        },
        price: budget,
      };
    }
    case "room_showcase":
      return { attrs: { style_tags: strArr(a.style_tags, "스타일 태그", undefined, 6), budget: int(a.budget, "꾸미기 비용", 0, 50_000_000, false),
        products: Array.isArray(a.products) ? a.products.slice(0, 8).map((p: any) => ({ name: str(p?.name, "제품명", 1, 60), price: int(p?.price, "제품 가격", 0, 50_000_000, false) })) : [] }, price: null };
    default:
      return { attrs: {}, price: null };
  }
}

const POST_SELECT = `SELECT p.id,p.category,p.title,substr(p.body,1,140) excerpt,p.status,p.attributes,p.building_id,p.created_at,p.view_count,p.is_demo,
  u.nickname author_nickname, b.name building_name,
  (SELECT COUNT(*) FROM comments c WHERE c.post_id=p.id AND c.status='published') comment_count,
  (SELECT COUNT(*) FROM reactions r WHERE r.post_id=p.id AND r.type='like') like_count
  FROM posts p JOIN users u ON u.id=p.author_id LEFT JOIN buildings b ON b.id=p.building_id`;

on("GET", "/api/posts", async (c) => {
  const sp = c.url.searchParams;
  const cats = (sp.get("category") || "").split(",").filter((x) => x in CATEGORIES);
  const where: string[] = ["p.status!='hidden'"];
  const binds: unknown[] = [];
  if (cats.length) { where.push(`p.category IN (${cats.map(() => "?").join(",")})`); binds.push(...cats); }
  else where.push("p.category!='room_showcase'");
  if (sp.get("status") === "open") where.push("p.status='open'");
  const q = (sp.get("q") || "").trim().slice(0, 40);
  if (q) { where.push("(p.title LIKE ? OR p.body LIKE ?)"); binds.push(`%${q}%`, `%${q}%`); }
  const maxP = Number(sp.get("maxPrice"));
  if (maxP > 0) { where.push("p.price_sort IS NOT NULL AND p.price_sort<=?"); binds.push(maxP); }
  if (sp.get("building")) { where.push("p.building_id=?"); binds.push(sp.get("building")); }
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const size = Math.min(30, Math.max(1, Number(sp.get("size")) || 12));
  const order = sp.get("sort") === "popular" ? "(like_count*3 + comment_count*2 + p.view_count/5) DESC, p.created_at DESC" : "p.created_at DESC";
  const total = await c.env.DB.prepare(`SELECT COUNT(*) n FROM posts p WHERE ${where.join(" AND ")}`).bind(...binds).first<{ n: number }>();
  const rows = await c.env.DB.prepare(`${POST_SELECT} WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT ? OFFSET ?`).bind(...binds, size, (page - 1) * size).all<any>();
  return json({ items: rows.results.map((r) => ({ ...r, attributes: parseJ(r.attributes, {}) })), total: total?.n ?? 0, page, size });
});

on("GET", "/api/posts/:id", async (c) => {
  const id = c.params[0];
  const p = await c.env.DB.prepare(`${POST_SELECT} WHERE p.id=?`).bind(id).first<any>();
  if (!p || p.status === "hidden") throw new HttpError(404, "게시글을 찾을 수 없어요.");
  const full = await c.env.DB.prepare("SELECT body,author_id,updated_at FROM posts WHERE id=?").bind(id).first<any>();
  await c.env.DB.prepare("UPDATE posts SET view_count=view_count+1 WHERE id=?").bind(id).run();
  const author = await c.env.DB.prepare("SELECT id,nickname,verification_status,is_demo,created_at,(SELECT COUNT(*) FROM posts WHERE author_id=users.id AND status!='hidden') post_count FROM users WHERE id=?").bind(full.author_id).first<any>();
  const comments = await c.env.DB.prepare("SELECT c.id,c.body,c.created_at,u.nickname,u.id author_id FROM comments c JOIN users u ON u.id=c.author_id WHERE c.post_id=? AND c.status='published' ORDER BY c.created_at").bind(id).all();
  const attrs = parseJ<any>(p.attributes, {});
  let pkgItems: any[] = [];
  const ids: string[] = attrs.package?.item_ids ?? [];
  const pk = await c.env.DB.prepare(`SELECT id,title,price,availability,category FROM market_items WHERE status='published' AND (post_id=? ${ids.length ? `OR id IN (${ids.map(() => "?").join(",")})` : ""})`).bind(id, ...ids).all();
  pkgItems = pk.results;
  let mine = { like: false, save: false };
  if (c.user) {
    const r = await c.env.DB.prepare("SELECT type FROM reactions WHERE user_id=? AND post_id=?").bind(c.user.id, id).all<{ type: string }>();
    mine = { like: r.results.some((x) => x.type === "like"), save: r.results.some((x) => x.type === "save") };
  }
  return json({ post: { ...p, body: full.body, updated_at: full.updated_at, attributes: attrs, isMine: c.user?.id === full.author_id }, author, comments: comments.results, packageItems: pkgItems, mine });
});

on("POST", "/api/posts", async (c) => {
  const u = need(c);
  await rateLimit(c.env, "w:" + u.id, 30);
  const cat = oneOf(c.body.category, "게시판", Object.keys(CATEGORIES) as Category[])!;
  const title = str(c.body.title, "제목", 2, 60);
  const body = str(c.body.body, "내용", 5, 4000);
  guardPrivacy(title + "\n" + body, "본문");
  const { attrs, price } = parseAttributes(cat, c.body.attributes);
  let bid: string | null = optStr(c.body.building_id, "건물", 64);
  if (bid) {
    const b = await c.env.DB.prepare("SELECT 1 FROM buildings WHERE id=? AND status='approved'").bind(bid).first();
    if (!b) bid = null;
  }
  const id = uuid();
  await c.env.DB.prepare("INSERT INTO posts (id,author_id,category,title,body,building_id,attributes,price_sort,is_demo) VALUES (?,?,?,?,?,?,?,?,?)")
    .bind(id, u.id, cat, title, body, bid, JSON.stringify(attrs), price, u.is_demo).run();
  // 패키지로 연결한 내 장터 물품에 post_id 연결
  const itemIds = (attrs as any).package?.item_ids as string[] | undefined;
  if (itemIds?.length) {
    for (const mid of itemIds) await c.env.DB.prepare("UPDATE market_items SET post_id=? WHERE id=? AND author_id=?").bind(id, mid, u.id).run();
  }
  return json({ ok: true, id }, 201);
});

on("PATCH", "/api/posts/:id", async (c) => {
  const u = need(c);
  const p = await c.env.DB.prepare("SELECT author_id,category,status FROM posts WHERE id=?").bind(c.params[0]).first<any>();
  if (!p || p.status === "hidden") throw new HttpError(404, "게시글을 찾을 수 없어요.");
  if (p.author_id !== u.id) throw new HttpError(403, "작성자만 수정하거나 마감할 수 있어요.");
  if (c.body.status && Object.keys(c.body).length === 1) {
    const st = oneOf(c.body.status, "상태", ["open", "closed"] as const)!;
    await c.env.DB.prepare("UPDATE posts SET status=?,updated_at=? WHERE id=?").bind(st, nowIso(), c.params[0]).run();
    return json({ ok: true });
  }
  const title = str(c.body.title, "제목", 2, 60);
  const body = str(c.body.body, "내용", 5, 4000);
  guardPrivacy(title + "\n" + body, "본문");
  const { attrs, price } = parseAttributes(p.category, c.body.attributes);
  await c.env.DB.prepare("UPDATE posts SET title=?,body=?,attributes=?,price_sort=?,updated_at=? WHERE id=?").bind(title, body, JSON.stringify(attrs), price, nowIso(), c.params[0]).run();
  return json({ ok: true });
});

on("POST", "/api/posts/:id/comments", async (c) => {
  const u = need(c);
  await rateLimit(c.env, "w:" + u.id, 30);
  const p = await c.env.DB.prepare("SELECT author_id,title,status FROM posts WHERE id=?").bind(c.params[0]).first<any>();
  if (!p || p.status === "hidden") throw new HttpError(404, "게시글을 찾을 수 없어요.");
  const body = str(c.body.body, "댓글", 1, 500);
  guardPrivacy(body, "댓글");
  const id = uuid();
  await c.env.DB.prepare("INSERT INTO comments (id,post_id,author_id,body) VALUES (?,?,?,?)").bind(id, c.params[0], u.id, body).run();
  if (p.author_id !== u.id) await notify(c.env, p.author_id, "comment", c.params[0], `'${p.title.slice(0, 20)}'에 새 댓글이 달렸어요.`);
  return json({ ok: true, id }, 201);
});
on("POST", "/api/posts/:id/react", async (c) => {
  const u = need(c);
  const type = oneOf(c.body.type, "반응", ["like", "save"] as const)!;
  const p = await c.env.DB.prepare("SELECT 1 FROM posts WHERE id=? AND status!='hidden'").bind(c.params[0]).first();
  if (!p) throw new HttpError(404, "게시글을 찾을 수 없어요.");
  const del = await c.env.DB.prepare("DELETE FROM reactions WHERE user_id=? AND post_id=? AND type=?").bind(u.id, c.params[0], type).run();
  if (!del.meta.changes) await c.env.DB.prepare("INSERT INTO reactions (user_id,post_id,type) VALUES (?,?,?)").bind(u.id, c.params[0], type).run();
  return json({ ok: true, on: !del.meta.changes });
});

// ================= 장터 =================
on("GET", "/api/market", async (c) => {
  const sp = c.url.searchParams;
  const where = ["m.status='published'"];
  const binds: unknown[] = [];
  const cat = sp.get("category");
  if (cat && cat in MARKET_CATEGORIES) { where.push("m.category=?"); binds.push(cat); }
  const av = sp.get("availability");
  if (av && av in AVAILABILITY) { where.push("m.availability=?"); binds.push(av); }
  if (sp.get("free") === "1") where.push("m.price=0");
  if (sp.get("mine") === "1" && c.user) { where.push("m.author_id=?"); binds.push(c.user.id); }
  const q = (sp.get("q") || "").trim().slice(0, 40);
  if (q) { where.push("(m.title LIKE ? OR m.body LIKE ?)"); binds.push(`%${q}%`, `%${q}%`); }
  const rows = await c.env.DB.prepare(
    `SELECT m.id,m.title,m.category,m.price,m.condition,m.availability,m.area,m.handover_date,m.post_id,m.is_demo,m.created_at,u.nickname author_nickname
     FROM market_items m JOIN users u ON u.id=m.author_id WHERE ${where.join(" AND ")} ORDER BY CASE m.availability WHEN 'done' THEN 1 ELSE 0 END, m.created_at DESC LIMIT 60`
  ).bind(...binds).all();
  return json({ items: rows.results });
});
on("GET", "/api/market/:id", async (c) => {
  const m = await c.env.DB.prepare(
    "SELECT m.*,u.nickname author_nickname,p.title post_title,p.category post_category FROM market_items m JOIN users u ON u.id=m.author_id LEFT JOIN posts p ON p.id=m.post_id WHERE m.id=? AND m.status='published'"
  ).bind(c.params[0]).first<any>();
  if (!m) throw new HttpError(404, "물품을 찾을 수 없어요.");
  return json({ item: { ...m, isMine: c.user?.id === m.author_id, author_id: undefined } });
});
function parseMarket(b: any) {
  const body = str(b.body, "설명", 0, 1500, false);
  guardPrivacy(body, "설명");
  return {
    title: str(b.title, "제목", 2, 50), body,
    category: oneOf(b.category, "카테고리", Object.keys(MARKET_CATEGORIES) as any)!,
    price: int(b.price, "가격", 0, 10_000_000)!,
    condition: oneOf(b.condition, "사용 상태", Object.keys(CONDITIONS) as any)!,
    handover_date: date(b.handover_date, "인계 희망일", false),
    area: optStr(b.area, "거래 지역", 30),
  };
}
on("POST", "/api/market", async (c) => {
  const u = need(c);
  await rateLimit(c.env, "w:" + u.id, 30);
  const m = parseMarket(c.body);
  const id = uuid();
  await c.env.DB.prepare("INSERT INTO market_items (id,author_id,title,body,category,price,condition,handover_date,area,is_demo) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .bind(id, u.id, m.title, m.body, m.category, m.price, m.condition, m.handover_date, m.area, u.is_demo).run();
  return json({ ok: true, id }, 201);
});
on("PATCH", "/api/market/:id", async (c) => {
  const u = need(c);
  const cur = await c.env.DB.prepare("SELECT author_id FROM market_items WHERE id=? AND status='published'").bind(c.params[0]).first<any>();
  if (!cur) throw new HttpError(404, "물품을 찾을 수 없어요.");
  if (cur.author_id !== u.id) throw new HttpError(403, "판매자만 수정할 수 있어요.");
  if (c.body.availability && Object.keys(c.body).length === 1) {
    await c.env.DB.prepare("UPDATE market_items SET availability=?,updated_at=? WHERE id=?").bind(oneOf(c.body.availability, "거래 상태", Object.keys(AVAILABILITY) as any), nowIso(), c.params[0]).run();
    return json({ ok: true });
  }
  const m = parseMarket(c.body);
  await c.env.DB.prepare("UPDATE market_items SET title=?,body=?,category=?,price=?,condition=?,handover_date=?,area=?,updated_at=? WHERE id=?")
    .bind(m.title, m.body, m.category, m.price, m.condition, m.handover_date, m.area, nowIso(), c.params[0]).run();
  return json({ ok: true });
});

// ================= 채팅 =================
on("POST", "/api/conversations", async (c) => {
  const u = need(c);
  await rateLimit(c.env, "w:" + u.id, 30);
  let other: string | null = null, ctxKey = "", postId = null, marketId = null, buildingId = null;
  if (c.body.post_id) {
    const p = await c.env.DB.prepare("SELECT author_id,status FROM posts WHERE id=?").bind(c.body.post_id).first<any>();
    if (!p || p.status === "hidden") throw new HttpError(404, "게시글을 찾을 수 없어요.");
    other = p.author_id; postId = c.body.post_id; ctxKey = "post:" + postId;
    if (p.status === "closed") {
      const lo = [u.id, other!].sort();
      const ex = await c.env.DB.prepare("SELECT id FROM conversations WHERE context_key=?").bind(`${ctxKey}:${lo[0]}:${lo[1]}`).first<any>();
      if (ex) return json({ id: ex.id });
      throw new HttpError(409, "모집이 마감된 글이라 새 문의를 보낼 수 없어요.");
    }
  } else if (c.body.market_item_id) {
    const m = await c.env.DB.prepare("SELECT author_id,availability FROM market_items WHERE id=? AND status='published'").bind(c.body.market_item_id).first<any>();
    if (!m) throw new HttpError(404, "물품을 찾을 수 없어요.");
    other = m.author_id; marketId = c.body.market_item_id; ctxKey = "market:" + marketId;
  } else if (c.body.building_id) {
    const l = await c.env.DB.prepare("SELECT landlord_id FROM landlord_buildings WHERE building_id=? AND status='approved' LIMIT 1").bind(c.body.building_id).first<any>();
    if (!l) throw new HttpError(404, "이 건물은 아직 임대인이 연결되지 않았어요.");
    other = l.landlord_id; buildingId = c.body.building_id; ctxKey = "building:" + buildingId;
  } else throw new HttpError(400, "대화 대상을 찾을 수 없어요.");
  if (other === u.id) throw new HttpError(400, "본인 글에는 문의할 수 없어요.");
  if (await isBlocked(c.env, u.id, other!)) throw new HttpError(403, "차단 관계인 사용자와는 대화할 수 없어요.");
  const [lo, hi] = [u.id, other!].sort();
  const key = `${ctxKey}:${lo}:${hi}`;
  const ex = await c.env.DB.prepare("SELECT id FROM conversations WHERE context_key=?").bind(key).first<any>();
  if (ex) return json({ id: ex.id });
  const id = uuid();
  await c.env.DB.prepare("INSERT INTO conversations (id,post_id,market_item_id,building_id,member_low,member_high,context_key,last_message_at) VALUES (?,?,?,?,?,?,?,?)")
    .bind(id, postId, marketId, buildingId, lo, hi, key, nowIso()).run();
  return json({ id }, 201);
});
const CONV_SELECT = `SELECT cv.*, p.title post_title, p.category post_category, p.status post_status, m.title market_title, b.name building_name,
  (SELECT body FROM messages WHERE conversation_id=cv.id ORDER BY created_at DESC LIMIT 1) last_body
  FROM conversations cv LEFT JOIN posts p ON p.id=cv.post_id LEFT JOIN market_items m ON m.id=cv.market_item_id LEFT JOIN buildings b ON b.id=cv.building_id`;
async function convView(env: Env, cv: any, me: string) {
  const otherId = cv.member_low === me ? cv.member_high : cv.member_low;
  const o = await env.DB.prepare("SELECT id,nickname,is_demo FROM users WHERE id=?").bind(otherId).first<any>();
  return {
    id: cv.id, other: o, last_body: cv.last_body, last_message_at: cv.last_message_at,
    context: cv.post_id ? { type: "post", id: cv.post_id, title: cv.post_title, category: cv.post_category, status: cv.post_status }
      : cv.market_item_id ? { type: "market", id: cv.market_item_id, title: cv.market_title }
      : { type: "building", id: cv.building_id, title: cv.building_name },
  };
}
on("GET", "/api/conversations", async (c) => {
  const u = need(c);
  const rows = await c.env.DB.prepare(`${CONV_SELECT} WHERE cv.member_low=? OR cv.member_high=? ORDER BY cv.last_message_at DESC`).bind(u.id, u.id).all<any>();
  return json({ items: await Promise.all(rows.results.map((r) => convView(c.env, r, u.id))) });
});
async function memberConv(c: Ctx) {
  const u = need(c);
  const cv = await c.env.DB.prepare(`${CONV_SELECT} WHERE cv.id=?`).bind(c.params[0]).first<any>();
  if (!cv) throw new HttpError(404, "대화를 찾을 수 없어요.");
  if (cv.member_low !== u.id && cv.member_high !== u.id) throw new HttpError(403, "참여한 대화만 볼 수 있어요.");
  return { u, cv };
}
on("GET", "/api/conversations/:id/messages", async (c) => {
  const { u, cv } = await memberConv(c);
  const after = c.url.searchParams.get("after") || "";
  const rows = await c.env.DB.prepare("SELECT id,sender_id,body,created_at FROM messages WHERE conversation_id=? AND created_at>? ORDER BY created_at LIMIT 200").bind(cv.id, after).all<any>();
  const view = await convView(c.env, cv, u.id);
  const blocked = await isBlocked(c.env, u.id, view.other.id);
  return json({ conversation: view, blocked, messages: rows.results.map((m) => ({ ...m, mine: m.sender_id === u.id })) });
});
on("POST", "/api/conversations/:id/messages", async (c) => {
  const { u, cv } = await memberConv(c);
  await rateLimit(c.env, "msg:" + u.id, 40);
  const other = cv.member_low === u.id ? cv.member_high : cv.member_low;
  if (await isBlocked(c.env, u.id, other)) throw new HttpError(403, "차단 관계라 메시지를 보낼 수 없어요.");
  const body = str(c.body.body, "메시지", 1, 1000);
  const id = uuid();
  const t = nowIso();
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO messages (id,conversation_id,sender_id,body,created_at) VALUES (?,?,?,?,?)").bind(id, cv.id, u.id, body, t),
    c.env.DB.prepare("UPDATE conversations SET last_message_at=? WHERE id=?").bind(t, cv.id),
  ]);
  await notify(c.env, other, "message", cv.id, `${u.nickname}님의 새 메시지: ${body.slice(0, 30)}`);
  return json({ ok: true, id, created_at: t }, 201);
});
on("POST", "/api/blocks", async (c) => {
  const u = need(c);
  const target = str(c.body.user_id, "대상", 1, 64);
  if (target === u.id) throw new HttpError(400, "본인은 차단할 수 없어요.");
  if (c.body.unblock) await c.env.DB.prepare("DELETE FROM blocks WHERE blocker_id=? AND blocked_id=?").bind(u.id, target).run();
  else await c.env.DB.prepare("INSERT OR IGNORE INTO blocks (blocker_id,blocked_id) VALUES (?,?)").bind(u.id, target).run();
  return json({ ok: true });
});
on("POST", "/api/reports", async (c) => {
  const u = need(c);
  await rateLimit(c.env, "rep:" + u.id, 10);
  const type = oneOf(c.body.target_type, "신고 대상", ["post", "comment", "review", "market", "user", "message", "building"] as const)!;
  const tid = str(c.body.target_id, "대상", 1, 64);
  const reason = str(c.body.reason, "신고 사유", 2, 300);
  const dup = await c.env.DB.prepare("SELECT 1 FROM reports WHERE reporter_id=? AND target_type=? AND target_id=? AND status='open'").bind(u.id, type, tid).first();
  if (dup) throw new HttpError(409, "이미 신고한 항목이에요. 운영자가 검토 중이에요.");
  await c.env.DB.prepare("INSERT INTO reports (id,reporter_id,target_type,target_id,reason) VALUES (?,?,?,?,?)").bind(uuid(), u.id, type, tid, reason).run();
  return json({ ok: true }, 201);
});

// ================= 홈/검색 =================
on("GET", "/api/home", async (c) => {
  const db = c.env.DB;
  const counts = await db.prepare(`SELECT category, COUNT(*) n FROM posts WHERE status='open' AND category IN ('transfer_offer','transfer_wanted','roommate_offer','roommate_wanted') GROUP BY category`).all<any>();
  const latest = await db.prepare(`${POST_SELECT} WHERE p.status!='hidden' AND p.category!='room_showcase' ORDER BY p.created_at DESC LIMIT 6`).all<any>();
  const popular = await db.prepare(`${POST_SELECT} WHERE p.status!='hidden' AND p.category!='room_showcase' ORDER BY (like_count*3+comment_count*2+p.view_count/5) DESC LIMIT 6`).all<any>();
  const market = await db.prepare("SELECT id,title,price,availability,category FROM market_items WHERE status='published' AND availability!='done' ORDER BY created_at DESC LIMIT 4").all();
  const rooms = await db.prepare(`${POST_SELECT} WHERE p.status!='hidden' AND p.category='room_showcase' ORDER BY like_count DESC LIMIT 3`).all<any>();
  const fix = (r: any) => ({ ...r, attributes: parseJ(r.attributes, {}) });
  return json({
    counts: Object.fromEntries(counts.results.map((r) => [r.category, r.n])),
    latest: latest.results.map(fix), popular: popular.results.map(fix), market: market.results, rooms: rooms.results.map(fix),
  });
});
on("GET", "/api/search", async (c) => {
  const q = (c.url.searchParams.get("q") || "").trim().slice(0, 40);
  if (!q) return json({ buildings: [], posts: [], market: [] });
  const like = `%${q}%`;
  const [b, p, m] = await Promise.all([
    c.env.DB.prepare("SELECT id,name,address FROM buildings WHERE status='approved' AND (name LIKE ? OR address LIKE ? OR description LIKE ?) LIMIT 10").bind(like, like, like).all(),
    c.env.DB.prepare(`${POST_SELECT} WHERE p.status!='hidden' AND (p.title LIKE ? OR p.body LIKE ?) ORDER BY p.created_at DESC LIMIT 20`).bind(like, like).all<any>(),
    c.env.DB.prepare("SELECT id,title,price,availability FROM market_items WHERE status='published' AND (title LIKE ? OR body LIKE ?) LIMIT 10").bind(like, like).all(),
  ]);
  return json({ buildings: b.results, posts: p.results.map((r) => ({ ...r, attributes: parseJ(r.attributes, {}) })), market: m.results });
});

// ================= 임대인 =================
async function needLandlordOf(c: Ctx, buildingId: string) {
  const u = need(c);
  const ok = await c.env.DB.prepare("SELECT 1 FROM landlord_buildings WHERE landlord_id=? AND building_id=? AND status='approved'").bind(u.id, buildingId).first();
  if (!ok) throw new HttpError(403, "승인된 본인 건물만 관리할 수 있어요.");
  return u;
}
on("POST", "/api/landlord/apply", async (c) => {
  const u = need(c);
  const bid = str(c.body.building_id, "건물", 1, 64);
  const b = await c.env.DB.prepare("SELECT 1 FROM buildings WHERE id=? AND status='approved'").bind(bid).first();
  if (!b) throw new HttpError(404, "건물을 찾을 수 없어요.");
  const ex = await c.env.DB.prepare("SELECT status FROM landlord_buildings WHERE landlord_id=? AND building_id=?").bind(u.id, bid).first<any>();
  if (ex) throw new HttpError(409, ex.status === "approved" ? "이미 승인된 건물이에요." : "이미 신청한 건물이에요. 관리자 검토를 기다려 주세요.");
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO landlord_buildings (landlord_id,building_id,status) VALUES (?,?,'pending')").bind(u.id, bid),
    c.env.DB.prepare("INSERT INTO verification_requests (id,user_id,type,building_id,note) VALUES (?,?,'landlord',?,?)").bind(uuid(), u.id, bid, optStr(c.body.note, "메모", 300)),
  ]);
  return json({ ok: true }, 201);
});
on("GET", "/api/landlord", async (c) => {
  const u = need(c);
  const bs = await c.env.DB.prepare("SELECT b.id,b.name,b.address,b.description,b.amenities FROM landlord_buildings lb JOIN buildings b ON b.id=lb.building_id WHERE lb.landlord_id=? AND lb.status='approved'").bind(u.id).all<any>();
  if (!bs.results.length) throw new HttpError(403, "승인된 임대인 건물이 없어요. 건물 상세에서 임대인 신청을 해 주세요.");
  const ids = bs.results.map((b) => b.id);
  const stats = await buildingStats(c.env, ids);
  const ph = ids.map(() => "?").join(",");
  const [vac, revs, rep, convs] = await Promise.all([
    c.env.DB.prepare(`SELECT * FROM vacancies WHERE building_id IN (${ph}) ORDER BY status, available_from`).bind(...ids).all(),
    c.env.DB.prepare(`SELECT r.id,r.building_id,r.body,r.ratings,r.start_month,r.end_month,r.created_at,r.verification_status,lr.body reply FROM building_reviews r LEFT JOIN landlord_replies lr ON lr.review_id=r.id WHERE r.building_id IN (${ph}) AND r.status='published' ORDER BY r.created_at DESC`).bind(...ids).all<any>(),
    c.env.DB.prepare(`SELECT * FROM repairs WHERE building_id IN (${ph}) ORDER BY completed_at DESC`).bind(...ids).all(),
    c.env.DB.prepare(`${CONV_SELECT} WHERE cv.building_id IN (${ph}) AND (cv.member_low=? OR cv.member_high=?) ORDER BY cv.last_message_at DESC`).bind(...ids, u.id, u.id).all<any>(),
  ]);
  return json({
    buildings: bs.results.map((b) => ({ ...b, amenities: parseJ(b.amenities, []), stats: stats(b.id) })),
    vacancies: vac.results,
    reviews: revs.results.map((r) => ({ ...r, avg: reviewAvg(parseJ(r.ratings, {})), ratings: undefined })),
    repairs: rep.results,
    inquiries: await Promise.all(convs.results.map((r) => convView(c.env, r, u.id))),
  });
});
on("POST", "/api/landlord/vacancies", async (c) => {
  const bid = str(c.body.building_id, "건물", 1, 64);
  const u = await needLandlordOf(c, bid);
  const id = uuid();
  await c.env.DB.prepare("INSERT INTO vacancies (id,building_id,landlord_id,available_from,deposit,rent,maintenance,room_type) VALUES (?,?,?,?,?,?,?,?)")
    .bind(id, bid, u.id, date(c.body.available_from, "입주 가능일"), int(c.body.deposit, "보증금", 0, 500_000_000), int(c.body.rent, "월세", 0, 10_000_000),
      int(c.body.maintenance, "관리비", 0, 2_000_000), oneOf(c.body.room_type, "방 유형", ROOM_TYPES as any)).run();
  return json({ ok: true, id }, 201);
});
on("PATCH", "/api/landlord/vacancies/:id", async (c) => {
  const v = await c.env.DB.prepare("SELECT building_id FROM vacancies WHERE id=?").bind(c.params[0]).first<any>();
  if (!v) throw new HttpError(404, "공실 정보를 찾을 수 없어요.");
  await needLandlordOf(c, v.building_id);
  await c.env.DB.prepare("UPDATE vacancies SET status=?,updated_at=? WHERE id=?").bind(oneOf(c.body.status, "상태", ["open", "closed"] as const), nowIso(), c.params[0]).run();
  return json({ ok: true });
});
on("POST", "/api/landlord/replies", async (c) => {
  const rid = str(c.body.review_id, "후기", 1, 64);
  const r = await c.env.DB.prepare("SELECT building_id,author_id FROM building_reviews WHERE id=? AND status='published'").bind(rid).first<any>();
  if (!r) throw new HttpError(404, "후기를 찾을 수 없어요.");
  const u = await needLandlordOf(c, r.building_id);
  const body = str(c.body.body, "답변", 5, 1000);
  await c.env.DB.prepare("INSERT INTO landlord_replies (id,review_id,landlord_id,body) VALUES (?,?,?,?) ON CONFLICT(review_id) DO UPDATE SET body=excluded.body, created_at=excluded.created_at")
    .bind(uuid(), rid, u.id, body).run();
  await notify(c.env, r.author_id, "reply", r.building_id, "내 후기에 임대인 답변이 등록됐어요.");
  return json({ ok: true }, 201);
});
on("POST", "/api/landlord/repairs", async (c) => {
  const bid = str(c.body.building_id, "건물", 1, 64);
  const u = await needLandlordOf(c, bid);
  await c.env.DB.prepare("INSERT INTO repairs (id,building_id,landlord_id,summary,completed_at) VALUES (?,?,?,?,?)")
    .bind(uuid(), bid, u.id, str(c.body.summary, "수리 내용", 3, 200), date(c.body.completed_at, "완료일")).run();
  return json({ ok: true }, 201);
});

// ================= 관리자 =================
on("GET", "/api/admin/queue", async (c) => {
  needAdmin(c);
  const db = c.env.DB;
  const [b, r, rep, ll, ver, au] = await Promise.all([
    db.prepare("SELECT b.id,b.name,b.address,b.created_at,u.nickname FROM buildings b LEFT JOIN users u ON u.id=b.submitted_by WHERE b.status='pending' ORDER BY b.created_at").all(),
    db.prepare("SELECT r.id,r.body,r.status,r.verification_status,b.name building_name,u.nickname FROM building_reviews r JOIN buildings b ON b.id=r.building_id JOIN users u ON u.id=r.author_id WHERE r.status='pending' OR r.verification_status='requested' ORDER BY r.created_at").all(),
    db.prepare("SELECT id,target_type,target_id,reason,created_at FROM reports WHERE status='open' ORDER BY created_at").all(),
    db.prepare("SELECT lb.landlord_id,lb.building_id,u.nickname,b.name FROM landlord_buildings lb JOIN users u ON u.id=lb.landlord_id JOIN buildings b ON b.id=lb.building_id WHERE lb.status='pending'").all(),
    db.prepare("SELECT v.id,v.type,v.note,u.nickname,u.id user_id FROM verification_requests v JOIN users u ON u.id=v.user_id WHERE v.status='pending' AND v.type='student'").all(),
    db.prepare("SELECT a.action,a.target_type,a.target_id,a.created_at,u.nickname FROM admin_audit a JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 30").all(),
  ]);
  return json({ buildings: b.results, reviews: r.results, reports: rep.results, landlords: ll.results, verifications: ver.results, audit: au.results });
});
on("POST", "/api/admin/buildings/:id", async (c) => {
  const a = needAdmin(c);
  const act = oneOf(c.body.action, "처리", ["approve", "reject"] as const)!;
  await c.env.DB.prepare("UPDATE buildings SET status=?,updated_at=? WHERE id=?").bind(act === "approve" ? "approved" : "rejected", nowIso(), c.params[0]).run();
  await audit(c.env, a.id, "building_" + act, "building", c.params[0]);
  return json({ ok: true });
});
on("POST", "/api/admin/reviews/:id", async (c) => {
  const a = needAdmin(c);
  const act = oneOf(c.body.action, "처리", ["publish", "hide", "reject", "verify_demo", "verify_reject"] as const)!;
  if (act === "verify_demo" || act === "verify_reject")
    await c.env.DB.prepare("UPDATE building_reviews SET verification_status=? WHERE id=?").bind(act === "verify_demo" ? "verified_demo" : "none", c.params[0]).run();
  else await c.env.DB.prepare("UPDATE building_reviews SET status=?,updated_at=? WHERE id=?").bind({ publish: "published", hide: "hidden", reject: "rejected" }[act], nowIso(), c.params[0]).run();
  await audit(c.env, a.id, "review_" + act, "review", c.params[0]);
  return json({ ok: true });
});
const HIDE_SQL: Record<string, string> = {
  post: "UPDATE posts SET status='hidden' WHERE id=?",
  comment: "UPDATE comments SET status='hidden' WHERE id=?",
  review: "UPDATE building_reviews SET status='hidden' WHERE id=?",
  market: "UPDATE market_items SET status='hidden' WHERE id=?",
  user: "UPDATE users SET status='suspended' WHERE id=? AND role!='admin'",
  building: "UPDATE buildings SET status='rejected' WHERE id=?",
  message: "UPDATE messages SET body='(운영 정책으로 가려진 메시지)' WHERE id=?",
};
on("POST", "/api/admin/reports/:id", async (c) => {
  const a = needAdmin(c);
  const act = oneOf(c.body.action, "처리", ["dismiss", "hide_target"] as const)!;
  const rep = await c.env.DB.prepare("SELECT target_type,target_id FROM reports WHERE id=?").bind(c.params[0]).first<any>();
  if (!rep) throw new HttpError(404, "신고를 찾을 수 없어요.");
  if (act === "hide_target") await c.env.DB.prepare(HIDE_SQL[rep.target_type]).bind(rep.target_id).run();
  await c.env.DB.prepare("UPDATE reports SET status=? WHERE target_type=? AND target_id=? AND status='open'").bind(act === "dismiss" ? "dismissed" : "actioned", rep.target_type, rep.target_id).run();
  await audit(c.env, a.id, "report_" + act, rep.target_type, rep.target_id);
  return json({ ok: true });
});
on("POST", "/api/admin/landlords", async (c) => {
  const a = needAdmin(c);
  const act = oneOf(c.body.action, "처리", ["approve", "reject"] as const)!;
  const lid = str(c.body.landlord_id, "임대인", 1, 64), bid = str(c.body.building_id, "건물", 1, 64);
  const st = act === "approve" ? "approved" : "rejected";
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE landlord_buildings SET status=? WHERE landlord_id=? AND building_id=?").bind(st, lid, bid),
    c.env.DB.prepare("UPDATE verification_requests SET status=?,reviewed_by=?,reviewed_at=? WHERE user_id=? AND building_id=? AND type='landlord' AND status='pending'").bind(st, a.id, nowIso(), lid, bid),
    ...(act === "approve" ? [c.env.DB.prepare("UPDATE users SET role='landlord' WHERE id=? AND role='user'").bind(lid)] : []),
  ]);
  await audit(c.env, a.id, "landlord_" + act, "building", bid);
  return json({ ok: true });
});
on("POST", "/api/admin/verifications/:id", async (c) => {
  const a = needAdmin(c);
  const act = oneOf(c.body.action, "처리", ["approve", "reject"] as const)!;
  const v = await c.env.DB.prepare("SELECT user_id FROM verification_requests WHERE id=?").bind(c.params[0]).first<any>();
  if (!v) throw new HttpError(404, "신청을 찾을 수 없어요.");
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE verification_requests SET status=?,reviewed_by=?,reviewed_at=? WHERE id=?").bind(act === "approve" ? "approved" : "rejected", a.id, nowIso(), c.params[0]),
    c.env.DB.prepare("UPDATE users SET verification_status=? WHERE id=?").bind(act === "approve" ? "verified" : "rejected", v.user_id),
  ]);
  await audit(c.env, a.id, "verification_" + act, "user", v.user_id);
  return json({ ok: true });
});
// 관리자 승격: 서버 비밀 토큰이 있을 때만 동작 (일반 사용자 선택 불가)
on("POST", "/api/admin/bootstrap", async (c) => {
  const token = c.env.ADMIN_BOOTSTRAP_TOKEN;
  if (!token || c.req.headers.get("x-bootstrap-token") !== token) throw new HttpError(403, "허용되지 않은 요청이에요.");
  const email = str(c.body.email, "이메일", 3, 120).toLowerCase();
  const r = await c.env.DB.prepare("UPDATE users SET role='admin' WHERE email=? AND is_demo=0").bind(email).run();
  if (!r.meta.changes) throw new HttpError(404, "해당 이메일의 가입자가 없어요.");
  return json({ ok: true });
});

// ================= 진입점 =================
const ip = (req: Request) => req.headers.get("cf-connecting-ip") || "local";

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(req);
    try {
      if (req.method !== "GET") {
        const origin = req.headers.get("origin");
        if (origin && new URL(origin).host !== url.host) throw new HttpError(403, "허용되지 않은 출처의 요청이에요.");
      }
      for (const [m, re, h] of routes) {
        if (m !== req.method) continue;
        const match = url.pathname.match(re);
        if (!match) continue;
        let body: any = {};
        if (req.method !== "GET") {
          const t = await req.text();
          if (t) {
            try { body = JSON.parse(t); } catch { throw new HttpError(400, "요청 형식이 올바르지 않아요."); }
          }
          if (typeof body !== "object" || body === null) body = {};
        }
        const user = await currentUser(req, env);
        return await h({ req, env, url, params: match.slice(1).map(decodeURIComponent), user, body });
      }
      throw new HttpError(404, "존재하지 않는 API예요.");
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message, ...e.extra }, e.status);
      console.error(e);
      return json({ error: "일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요." }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
