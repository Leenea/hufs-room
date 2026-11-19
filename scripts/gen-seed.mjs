// 시연용 가상 데이터 생성기. 모든 건물·사람·가격은 가상이며 실제 정보가 아니다.
import { writeFileSync, mkdirSync } from "node:fs";

const U = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const B = (n) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let seq = 100;
const id = () => `20000000-0000-4000-8000-${String(seq++).padStart(12, "0")}`;
const q = (v) => (v === null || v === undefined ? "NULL" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const daysAgo = (d, h = 0) => new Date(Date.now() - d * 864e5 - h * 36e5).toISOString();
const out = [];
const ins = (table, row) => out.push(`INSERT INTO ${table} (${Object.keys(row).join(",")}) VALUES (${Object.values(row).map(q).join(",")});`);

out.push("PRAGMA defer_foreign_keys = true;");
for (const t of ["messages", "conversations", "notifications", "reports", "blocks", "admin_audit", "reactions", "comments", "landlord_replies", "repairs", "vacancies", "review_media", "review_views", "building_reviews", "market_items", "posts", "landlord_buildings", "verification_requests", "sessions", "buildings", "rate_limits"])
  out.push(`DELETE FROM ${t};`);
out.push("DELETE FROM users WHERE is_demo=1;");

// ---- 사용자 (DEMO) ----
const users = [
  [1, "새내기 체험", "user", "none"],
  [2, "후기 작성자 체험", "user", "verified"],
  [3, "가상 임대인", "landlord", "verified"],
  [4, "4학년 선배", "user", "verified"],
  [5, "모현동 고양이", "user", "none"],
  [6, "자취 3년차", "user", "verified"],
  [7, "통학러탈출", "user", "none"],
  [8, "글캠 새내기", "user", "none"],
  [9, "교환학생 준비중", "user", "pending"],
];
for (const [n, nick, role, ver] of users)
  ins("users", { id: U(n), email: `demo${n}@demo.hufsroom.invalid`, password_hash: null, nickname: nick, role, verification_status: ver, is_demo: 1, created_at: daysAgo(60 - n) });

// ---- 건물 (가상 위치) ----
const amen = (...a) => JSON.stringify(a);
const buildings = [
  [1, "A빌라 (가상)", "가상시 모현읍 외대로 1길 10 (시연용)", 38, 42, 6, "정문 가까운 4층 원룸 건물. 1층 편의점(가상).", amen("에어컨", "세탁기", "냉장고", "인터넷")],
  [2, "B하우스 (가상)", "가상시 모현읍 외대로 2길 22 (시연용)", 62, 30, 9, "신축 느낌 분리형 원룸. 엘리베이터 있음.", amen("에어컨", "세탁기", "냉장고", "엘리베이터", "인덕션")],
  [3, "C빌 (가상)", "가상시 모현읍 왕산로 3길 7 (시연용)", 24, 66, 12, "조용한 주택가. 월세 부담이 낮은 편.", amen("에어컨", "냉장고", "책상")],
  [4, "D캐슬 (가상)", "가상시 모현읍 외대로 5길 15 (시연용)", 74, 58, 14, "투룸 비중이 높아 룸메이트 거주가 많음.", amen("에어컨", "세탁기", "냉장고", "주차")],
  [5, "E스테이 (가상)", "가상시 모현읍 왕산로 8길 3 (시연용)", 48, 78, null, "후기가 아직 없는 건물 (미평가 예시).", amen("에어컨", "세탁기")],
];
for (const [n, name, addr, x, y, walk, desc, a] of buildings)
  ins("buildings", { id: B(n), name, address: addr, normalized_address: addr.replace(/[\s,.\-()]/g, "").toLowerCase(), map_x: x, map_y: y, walk_minutes: walk, description: desc, amenities: a, status: "approved", submitted_by: U(4), is_demo: 1, created_at: daysAgo(90) });
// 승인 대기 건물 (지도 미노출 예시)
ins("buildings", { id: B(6), name: "F원룸 (가상·승인대기)", address: "가상시 모현읍 외대로 9길 9 (시연용)", normalized_address: "가상시모현읍외대로9길9시연용", map_x: 85, map_y: 20, description: "관리자 승인 전이라 지도에 보이지 않아요.", amenities: "[]", status: "pending", submitted_by: U(5), is_demo: 1 });

ins("landlord_buildings", { landlord_id: U(3), building_id: B(1), status: "approved" });
ins("landlord_buildings", { landlord_id: U(3), building_id: B(2), status: "approved" });

// ---- 후기 ----
const R = (s, l, w, h, c, sec, m, a, v) => JSON.stringify({ soundproof: s, sunlight: l, water: w, hvac: h, clean: c, security: sec, management: m, access: a, value: v });
const reviews = [
  [1, 2, "2025-03", "2026-02", "mid", "남향", "원룸(분리형)", 3000000, 450000, 70000, 200000, "broker", R(3, 5, 4, 4, 4, 3, 5, null, 4), "yes", "verified_demo", "정문까지 걸어서 금방이라 1교시 수업에 정말 편했어요. 남향이라 낮에는 불을 안 켜도 될 정도로 밝아요. 다만 옆방 통화 소리가 가끔 들려요. 관리인분이 보일러 고장 때 하루 만에 와 주셨어요."],
  [1, 4, "2024-03", "2025-02", "low", "동향", "원룸(오픈형)", 2000000, 430000, 60000, 180000, "broker", R(2, 3, 4, 3, 3, 3, 4, 5, 3), "unsure", "none", "저층이라 여름에 벌레가 조금 있었고 방음은 아쉬웠어요. 그래도 학교 접근성은 최고. 관리비에 인터넷 포함이었어요."],
  [1, 6, "2025-09", "2026-08", "high", "남향", "원룸(분리형)", 5000000, 420000, 70000, null, "transfer", R(4, 5, 3, 4, 4, 4, 4, 5, 4), "yes", "verified_demo", "학기 중간에 양도로 들어왔어요. 임대인 동의 확인하고 계약서 새로 썼습니다. 고층이라 조용하고 전망 좋아요. 수압이 저녁엔 약간 약해요."],
  [2, 6, "2023-09", "2025-08", "mid", "서향", "원룸(분리형)", 5000000, 520000, 80000, 250000, "broker", R(4, 3, 5, 5, 5, 5, 4, 3, 3), "yes", "verified_demo", "건물이 깔끔하고 엘리베이터, 공동현관 보안이 확실해요. 서향이라 여름 오후는 더운데 에어컨이 잘 나와요. 월세가 주변보다 조금 높은 편."],
  [2, 7, "2025-03", "2025-12", "low", "북향", "원룸(분리형)", 3000000, 500000, 80000, 220000, "broker", R(4, 2, 5, 4, 5, 5, 3, 3, 2), "no", "none", "시설은 좋은데 북향 저층이라 햇빛이 거의 안 들어요. 빨래 건조가 힘들었어요. 가격 대비 만족도는 보통 이하."],
  [3, 4, "2023-03", "2024-02", "mid", "남향", "원룸(오픈형)", 1000000, 330000, 30000, 150000, "direct", R(3, 4, 3, 2, 3, 2, 3, 2, 5), "unsure", "none", "월세가 확실히 저렴해요. 언덕이 있어서 통학은 마을버스 이용했어요. 겨울에 외풍이 좀 있어서 뽁뽁이 붙였습니다."],
  [3, 5, "2025-03", "2026-02", "low", "동향", "원룸(오픈형)", 1000000, 350000, 30000, 150000, "broker", R(3, 3, 2, 3, 3, 2, 2, 2, 4), "no", "none", "주택가라 밤에 조용하지만 골목이 어두워요. 수리 요청하면 답이 느린 편이었어요. 싼 맛에 1년 살기엔 괜찮음."],
  [4, 6, "2024-03", "2025-02", "mid", "남향", "투룸", 5000000, 600000, 90000, 300000, "broker", R(3, 4, 4, 4, 4, 4, 4, 2, 4), "yes", "verified_demo", "룸메와 둘이 살았는데 방이 분리돼 있어서 생활 리듬이 달라도 괜찮았어요. 1인당 부담이 원룸보다 적어요."],
  [4, 8, "2025-09", "2026-02", "high", "모름", "투룸", 5000000, 620000, 90000, null, "transfer", R(4, 4, 4, null, 4, 4, null, 2, 4), "unsure", "requested", "한 학기만 양도받아 살고 있어요. 냉난방은 아직 겨울을 안 겪어봐서 N/A로 남겨요. 버스 정류장이 가까워요."],
  [2, 9, "2024-09", "2025-08", "high", "남향", "1.5룸", 7000000, 550000, 80000, 300000, "broker", R(5, 5, 5, 4, 5, 5, 5, 3, 3), "yes", "requested", "1.5룸이라 침대와 책상 공간이 분리돼서 공부할 때 좋아요. 관리 응대도 빠르고 청결해요. 가격은 조금 부담."],
];
const reviewIds = [];
reviews.forEach(([b, u, s, e, fl, ori, rt, dep, rent, mt, bf, cm, ratings, ri, vs, body], i) => {
  const rid = id();
  reviewIds.push([rid, b]);
  ins("building_reviews", { id: rid, building_id: B(b), author_id: U(u), start_month: s, end_month: e, floor_band: fl, orientation: ori, room_type: rt, deposit: dep, monthly_rent: rent, maintenance_fee: mt, broker_fee: bf, contract_method: cm, options: amen("에어컨", "냉장고"), ratings, renewal_intent: ri, body, verification_status: vs, status: "published", is_demo: 1, created_at: daysAgo(40 - i * 3) });
});
ins("landlord_replies", { id: id(), review_id: reviewIds[1][0], landlord_id: U(3), body: "소중한 후기 감사합니다. 2025년 여름에 저층 방충망을 전부 교체했어요. 방음은 벽면 보강 일정을 검토 중입니다. (가상 임대인 답변)" });
ins("repairs", { id: id(), building_id: B(1), landlord_id: U(3), summary: "저층 전 세대 방충망 교체", completed_at: "2025-07-15" });
ins("repairs", { id: id(), building_id: B(1), landlord_id: U(3), summary: "공동현관 도어락 교체", completed_at: "2026-02-10" });
ins("vacancies", { id: id(), building_id: B(1), landlord_id: U(3), available_from: "2027-02-20", deposit: 3000000, rent: 450000, maintenance: 70000, room_type: "원룸(분리형)" });
ins("vacancies", { id: id(), building_id: B(2), landlord_id: U(3), available_from: "2027-02-25", deposit: 5000000, rent: 520000, maintenance: 80000, room_type: "원룸(분리형)" });
ins("vacancies", { id: id(), building_id: B(3), landlord_id: U(3), available_from: "2027-03-01", deposit: 1000000, rent: 340000, maintenance: 30000, room_type: "원룸(오픈형)" });

// ---- 장터 ----
const market = [
  [6, "원룸 3종 일괄 (냉장고·전자레인지·행거)", "bundle", 60000, "good", "2027-02-20", "외대로 1길 근처", "양도 들어오시는 분께 우선 드려요. 따로도 가능."],
  [6, "소형 냉장고 120L", "appliance", 40000, "good", "2027-02-20", "외대로 1길 근처", "2년 사용, 소음 적어요."],
  [4, "접이식 책상 + 의자", "furniture", 0, "fair", "2027-01-10", "왕산로", "무료 나눔! 직접 가져가셔야 해요."],
  [5, "1인용 전기밥솥", "appliance", 15000, "new", "2026-12-20", "정문 앞", "선물 받고 거의 안 썼어요."],
  [7, "암막 커튼 2장 + 압축봉", "living", 10000, "good", "2026-12-28", "외대로 2길", "북향방 탈출하며 정리합니다."],
  [8, "빨래건조대 (대형)", "living", 5000, "worn", "2026-12-15", "기숙사 앞", "사용감 있지만 튼튼해요."],
];
const marketIds = market.map(([u, t, cat, price, cond, hd, area, body], i) => {
  const mid = id();
  ins("market_items", { id: mid, author_id: U(u), title: t, category: cat, price, condition: cond, handover_date: hd, area, body, availability: i === 3 ? "reserved" : "selling", is_demo: 1, created_at: daysAgo(10 - i) });
  return mid;
});

// ---- 게시글 ----
const posts = [];
const P = (u, cat, title, body, attrs, opt = {}) => {
  const pid = id();
  posts.push(pid);
  const price = attrs.rent ?? attrs.budget_max ?? attrs.budget ?? null;
  ins("posts", { id: pid, author_id: U(u), category: cat, title, body, building_id: opt.b ? B(opt.b) : null, status: opt.status ?? "open", attributes: JSON.stringify(attrs), price_sort: cat === "room_showcase" ? null : price, view_count: opt.views ?? 20, is_demo: 1, created_at: daysAgo(opt.d ?? 3, opt.h ?? 0) });
  return pid;
};
const life = (s, p, sl, c) => ({ smoking: s, pet: p, sleep: sl, clean: c });
const t1 = P(6, "transfer_offer", "[A빌라] 2027-1학기 양도해요 · 남향 고층 분리형", "교환학생 합격으로 2월 말부터 계약 종료일까지 양도합니다. 남향이라 밝고 조용해요. 냉장고·전자레인지·행거 패키지로 함께 넘길 수 있어요(선택).", {
  deposit: 5000000, rent: 420000, maintenance: 70000, available_from: "2027-02-20", contract_end: "2027-08-31", consent: "agreed", conditions: "잔여 계약 승계, 중개보수 없음", options: ["에어컨", "세탁기", "냉장고", "인터넷"], room_type: "원룸(분리형)", floor_band: "high",
  package: { enabled: true, note: "냉장고·전자레인지·행거 일괄", price: 60000, item_ids: [marketIds[0], marketIds[1]] } }, { b: 1, d: 1, views: 88 });
P(7, "transfer_offer", "[B하우스] 12월부터 양도 (임대인 동의 확인 중)", "개인 사정으로 12월 중순부터 양도 원해요. 임대인께 동의 여부를 아직 확인 중이라 확정되면 상태 바꿀게요.", {
  deposit: 3000000, rent: 500000, maintenance: 80000, available_from: "2026-12-15", contract_end: "2027-02-28", consent: "unknown", conditions: "짧은 기간 가능하신 분", options: ["에어컨", "엘리베이터"], room_type: "원룸(분리형)", floor_band: "low", package: { enabled: false } }, { b: 2, d: 2, views: 40 });
P(8, "transfer_wanted", "2027-1학기 정문 도보 10분 이내 양도 구해요", "새내기라 기숙사 떨어지면 바로 들어갈 방 찾아요. 분리형이면 좋겠어요.", { budget_min: 350000, budget_max: 480000, deposit_max: 5000000, period_from: "2027-02-20", period_to: "2027-06-30", location_pref: "정문 도보 10분", required_options: ["에어컨", "세탁기"] }, { d: 1, h: 5, views: 35 });
P(9, "transfer_wanted", "한 학기(2027-2) 단기 양도 구합니다", "교환학생 다녀오기 전 한 학기만 살 방 찾아요. 가구 있는 방 선호합니다.", { budget_min: 300000, budget_max: 450000, deposit_max: 3000000, period_from: "2027-08-25", period_to: "2027-12-20", location_pref: "외대로 일대", required_options: ["침대", "책상"] }, { d: 4, views: 22 });
P(4, "roommate_offer", "[D캐슬 투룸] 룸메 1명 구해요 · 비흡연 조용한 분", "투룸 계약 예정이라 방 하나 같이 쓰실 분 구해요. 각자 방 있고 거실·주방 공유. 생활 패턴 맞춰서 정해요.", { budget: 360000, move_in: "2027-02-25", members: 1, housing_type: "투룸 (각자 방)", lifestyle: life("비흡연", "없음", "24~2시", "주 1~2회"), gender_self: "밝히지 않음", gender_pref: "무관" }, { b: 4, d: 0, h: 6, views: 51 });
P(5, "roommate_offer", "고양이 키우는 집 · 룸메 구해요", "고양이 한 마리 있어요(중성화). 동물 괜찮으신 분이면 좋겠어요.", { budget: 300000, move_in: "2027-03-01", members: 1, housing_type: "투룸", lifestyle: life("비흡연", "있음", "2시 이후", "느슨한 편"), gender_self: "여성", gender_pref: "여성" }, { d: 5, views: 30, status: "closed" });
P(8, "roommate_wanted", "새내기 룸메 지원해요 · 아침형 인간", "주거지 아직 없어요. 같이 방 구하실 분 찾아요. 아침 수업 많고 일찍 자요.", { budget: 330000, move_in: "2027-02-20", housing_type: "투룸 또는 1.5룸", lifestyle: life("비흡연", "상관없음", "~24시", "매일 정리"), gender_self: "밝히지 않음", gender_pref: "무관" }, { d: 2, h: 3, views: 18 });
P(9, "roommate_wanted", "2027-1 룸메 지원 · 교환학생 준비 중", "외국어 공부 같이 할 룸메 환영해요. 깔끔한 편입니다.", { budget: 350000, move_in: "2027-03-01", housing_type: "무관", lifestyle: life("비흡연", "없음", "24~2시", "매일 정리") }, { d: 6, views: 12 });
const lq = P(8, "life_question", "모현 쪽 원룸 계약할 때 꼭 확인해야 할 거 있나요?", "처음 자취해요. 등기부등본 말고도 체크할 거 알려주세요!", {}, { d: 0, h: 2, views: 64 });
P(6, "life_tip", "겨울 외풍 막는 3천원 팁 (뽁뽁이+문풍지)", "창문에 분무기로 물 뿌리고 뽁뽁이 붙이면 체감 2도는 올라가요. 현관 문풍지도 필수.", {}, { d: 1, h: 8, views: 120 });
P(7, "free", "정문 앞 새로 생긴 국밥집 가보신 분?", "시험기간 야식 후보 찾는 중입니다.", {}, { d: 0, h: 9, views: 41 });
P(4, "life_tip", "학기 끝나고 이사할 때 용달 반값으로 쓰는 법", "같은 날 이사하는 사람 2~3명 모아서 동선 묶으면 1인당 비용이 확 줄어요. 커뮤니티에서 모아봐요.", {}, { d: 3, views: 77 });
const rm1 = P(6, "room_showcase", "6평 원룸 화이트 우드톤 정리 완료", "책상 위치 바꾸고 조명 2개 추가했더니 완전히 다른 방이 됐어요.", { style_tags: ["화이트", "우드", "미니멀"], budget: 180000, products: [{ name: "무드등 (가상 제품)", price: 25000 }, { name: "원목 선반", price: 39000 }] }, { d: 2, views: 140 });
P(5, "room_showcase", "고양이와 사는 그린 테마 방", "식물 6개, 캣타워는 창가에. 벽 손상 없는 꾸미기만 했어요.", { style_tags: ["식물", "그린", "반려동물"], budget: 95000, products: [{ name: "압축봉 선반", price: 18000 }] }, { d: 4, views: 98 });
P(9, "room_showcase", "5만원으로 끝낸 첫 자취방", "다이소 위주로 수납만 정리. 비포/애프터 차이 커요.", { style_tags: ["가성비", "수납"], budget: 50000, products: [] }, { d: 6, views: 60 });

ins("market_items", { id: id(), author_id: U(4), post_id: null, title: "전신거울 (무료)", category: "living", price: 0, condition: "good", handover_date: "2026-12-30", area: "외대로", body: "이사 정리 나눔", availability: "selling", is_demo: 1 });

// 댓글·반응
const cm = (p, u, body, h) => ins("comments", { id: id(), post_id: p, author_id: U(u), body, created_at: daysAgo(0, h) });
cm(lq, 6, "수압이랑 곰팡이 꼭 보세요! 샤워기 틀어보고 싱크대 밑도 열어보기.", 1);
cm(lq, 4, "관리비에 뭐가 포함인지(인터넷, 수도) 문서로 받아두세요.", 1);
cm(t1, 8, "패키지 포함이면 총 얼마인지 채팅으로 여쭤봐도 될까요?", 3);
for (const [p, u] of [[t1, 4], [t1, 5], [lq, 6], [rm1, 4], [rm1, 7], [rm1, 8]]) ins("reactions", { user_id: U(u), post_id: p, type: "like" });

// 대화 예시: 새내기 ↔ 양도 작성자
const [lo, hi] = [U(1), U(6)].sort();
const conv = id();
ins("conversations", { id: conv, post_id: t1, member_low: lo, member_high: hi, context_key: `post:${t1}:${lo}:${hi}`, last_message_at: daysAgo(0, 1) });
ins("messages", { id: id(), conversation_id: conv, sender_id: U(1), body: "안녕하세요! A빌라 양도 글 보고 연락드려요. 방 보러 갈 수 있을까요?", created_at: daysAgo(0, 2) });
ins("messages", { id: id(), conversation_id: conv, sender_id: U(6), body: "네! 임대인 동의는 받아뒀어요. 이번 주 목요일 오후 괜찮으세요? (시연용 대화)", created_at: daysAgo(0, 1) });

mkdirSync("seed", { recursive: true });
writeFileSync("seed/seed.sql", out.join("\n") + "\n");
console.log(`seed/seed.sql written (${out.length} statements)`);
