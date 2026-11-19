// API 권한·정책 테스트. 사용법: BASE=http://localhost:5180 node scripts/api-test.mjs
const BASE = process.env.BASE || "http://localhost:5180";
let pass = 0, fail = 0;
const results = [];
function session() {
  let cookie = "";
  return async (path, { method, body } = {}) => {
    const res = await fetch(BASE + path, {
      method: method || (body ? "POST" : "GET"),
      headers: { ...(body ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}), origin: BASE },
      body: body ? JSON.stringify(body) : undefined,
    });
    const sc = res.headers.get("set-cookie");
    if (sc) cookie = sc.split(";")[0];
    return { status: res.status, data: await res.json().catch(() => ({})) };
  };
}
function check(name, cond, extra = "") {
  cond ? pass++ : fail++;
  results.push(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`);
}

const anon = session();
const fresh = session();
const fresh2 = session();
const reviewer = session();
const landlord = session();

const bl = await anon("/api/buildings");
check("공개 건물 목록 조회", bl.status === 200 && bl.data.items.length >= 3, `${bl.data.items?.length}개`);
check("미승인 건물은 목록에서 숨김", !bl.data.items.some((b) => b.name.includes("승인대기")));
const pendingId = "10000000-0000-4000-8000-000000000006";
check("미승인 건물 상세 404 (비회원)", (await anon(`/api/buildings/${pendingId}`)).status === 404);
const A = bl.data.items.find((b) => b.name.startsWith("A빌라")).id;
const C = bl.data.items.find((b) => b.name.startsWith("C빌")).id;
const D = bl.data.items.find((b) => b.name.startsWith("D캐슬")).id;
const B2 = bl.data.items.find((b) => b.name.startsWith("B하우스")).id;
const E = bl.data.items.find((b) => b.name.startsWith("E스테이")).id;

const ad = await anon(`/api/buildings/${A}`);
check("비회원: 계약금액 응답에서 제외", ad.data.contract === null && ad.data.reviews.every((r) => r.monthly_rent === undefined && r.locked));
check("비회원: 항목별 평점 3개만 미리보기", Object.keys(ad.data.stats.items).length === 3);
check("비회원 글쓰기 401", (await anon("/api/posts", { body: { category: "free", title: "테스트", body: "내용입니다" } })).status === 401);

await fresh("/api/auth/demo", { body: { persona: "freshman" } });
const me = await fresh("/api/me");
check("새내기 체험 계정 생성·무료 열람권 3", me.data.access?.freeLeft === 3 && me.data.access.level === "limited");
const e1 = await fresh("/api/review-views", { body: { building_id: E } });
check("후기 없는 건물은 열람권 차감 안 함", e1.status === 400 && (await fresh("/api/me")).data.access.freeLeft === 3);
const v1 = await fresh("/api/review-views", { body: { building_id: A } });
const v1b = await fresh("/api/review-views", { body: { building_id: A } });
check("무료 열람권 사용 + 같은 건물 중복 차감 방지", v1.status === 200 && v1b.data.already === true && (await fresh("/api/me")).data.access.freeLeft === 2);
const full = await fresh(`/api/buildings/${A}`);
check("열람권 사용 후 계약금액 노출", full.data.access.full && full.data.contract?.n > 0);
await fresh("/api/review-views", { body: { building_id: B2 } });
await fresh("/api/review-views", { body: { building_id: C } });
const v4 = await fresh("/api/review-views", { body: { building_id: D } });
check("무료 열람권 3회 초과 시 403", v4.status === 403, v4.data.error);
// 동시 요청 원자성
await fresh2("/api/auth/demo", { body: { persona: "freshman" } });
const ids = [A, B2, C, D];
const conc = await Promise.all(ids.map((b) => fresh2("/api/review-views", { body: { building_id: b } })));
const m2 = await fresh2("/api/me");
check("동시 4건 요청에도 최대 3건만 차감", conc.filter((r) => r.status === 200).length === 3 && m2.data.access.viewed.length === 3);

const reviewBody = { building_id: E, start_month: "2025-03", end_month: "2025-12", ratings: { soundproof: 4, sunlight: 3, water: 4, hvac: null }, body: "테스트 후기입니다. 조용하고 관리가 잘 되는 편이에요.", monthly_rent: 400000 };
const rv = await fresh("/api/reviews", { body: reviewBody });
check("후기 작성 (시연 모드 자동 공개)", rv.status === 201 && rv.data.status === "published");
const dup = await fresh("/api/reviews", { body: reviewBody });
check("동일 건물·거주기간 중복 후기 409", dup.status === 409);
check("후기 작성 후 전체 열람 권한", (await fresh("/api/me")).data.access.level === "full");
check("후기 입력 검증: 평점 3개 미만 400", (await fresh("/api/reviews", { body: { ...reviewBody, start_month: "2024-01", end_month: "2024-02", ratings: { soundproof: 3 } } })).status === 400);
check("개인정보(전화번호) 차단 400", (await fresh("/api/posts", { body: { category: "free", title: "연락주세요", body: "010-1234-5678 로 문자" } })).status === 400);
const eAfter = await anon(`/api/buildings/${E}`);
check("후기 등록 즉시 건물 집계 반영", eAfter.data.stats.reviewCount === 1 && eAfter.data.stats.avg === 3.7, `avg=${eAfter.data.stats.avg}`);

const p = await fresh("/api/posts", { body: { category: "transfer_offer", title: "테스트 양도글", body: "테스트용 양도 글입니다", attributes: { deposit: 1000000, rent: 400000, maintenance: 50000, available_from: "2027-01-01", contract_end: "2027-06-30", consent: "agreed" } } });
check("양도 글 작성", p.status === 201);
check("양도 글 기간 역전 400", (await fresh("/api/posts", { body: { category: "transfer_offer", title: "잘못된 기간", body: "기간 테스트입니다", attributes: { deposit: 0, rent: 1, maintenance: 0, available_from: "2027-06-01", contract_end: "2027-01-01", consent: "agreed" } } })).status === 400);
check("양도 글 임대인 동의 상태 필수 400", (await fresh("/api/posts", { body: { category: "transfer_offer", title: "동의 없음", body: "동의 테스트입니다", attributes: { deposit: 0, rent: 1, maintenance: 0, available_from: "2027-01-01", contract_end: "2027-02-01" } } })).status === 400);
await reviewer("/api/auth/demo", { body: { persona: "reviewer" } });
check("타인 글 수정 403", (await reviewer(`/api/posts/${p.data.id}`, { method: "PATCH", body: { status: "closed" } })).status === 403);
const conv = await reviewer("/api/conversations", { body: { post_id: p.data.id } });
check("채팅 시작", conv.status === 201 || conv.status === 200);
await reviewer(`/api/conversations/${conv.data.id}/messages`, { body: { body: "안녕하세요 테스트" } });
const msgs = await fresh(`/api/conversations/${conv.data.id}/messages`);
check("상대방도 메시지 수신 (서버 저장)", msgs.data.messages?.some((m) => m.body === "안녕하세요 테스트"));
check("대화 비참여자 열람 403", (await fresh2(`/api/conversations/${conv.data.id}/messages`)).status === 403);
check("작성자 모집 종료", (await fresh(`/api/posts/${p.data.id}`, { method: "PATCH", body: { status: "closed" } })).status === 200);
check("마감 후 기존 대화는 유지", (await reviewer("/api/conversations", { body: { post_id: p.data.id } })).data.id === conv.data.id);
check("마감 후 신규 문의 409", (await fresh2("/api/conversations", { body: { post_id: p.data.id } })).status === 409);
const meR = (await reviewer("/api/me")).data.user.id;
await fresh("/api/blocks", { body: { user_id: meR } });
check("차단 후 메시지 전송 403", (await reviewer(`/api/conversations/${conv.data.id}/messages`, { body: { body: "차단 테스트" } })).status === 403);

await landlord("/api/auth/demo", { body: { persona: "landlord" } });
check("임대인 대시보드 (승인 건물)", (await landlord("/api/landlord")).status === 200);
check("임대인: 본인 건물 아닌 곳 공실 등록 403", (await landlord("/api/landlord/vacancies", { body: { building_id: C, available_from: "2027-03-01", deposit: 1, rent: 1, maintenance: 0, room_type: "투룸" } })).status === 403);
check("일반 사용자 임대인 대시보드 403", (await fresh("/api/landlord")).status === 403);
check("일반 사용자 관리자 API 403", (await fresh("/api/admin/queue")).status === 403);
check("가입 시 role 주입 무시", await (async () => {
  const s = session();
  const email = `t${Date.now()}@example.com`;
  await s("/api/auth/signup", { body: { email, password: "password123", nickname: "테스트" + String(Date.now()).slice(-6), role: "admin" } });
  return (await s("/api/me")).data.user?.role === "user";
})());
check("관리자 승격 토큰 없이 403", (await fresh("/api/admin/bootstrap", { body: { email: "x@y.z" } })).status === 403);
check("신고 접수", (await fresh2("/api/reports", { body: { target_type: "post", target_id: p.data.id, reason: "테스트 신고" } })).status === 201);
check("중복 신고 409", (await fresh2("/api/reports", { body: { target_type: "post", target_id: p.data.id, reason: "테스트 신고" } })).status === 409);
check("검색", (await anon(`/api/search?q=${encodeURIComponent("양도")}`)).data.posts.length > 0);

console.log(results.join("\n"));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
