export const CATEGORIES = {
  transfer_offer: "양도해요",
  transfer_wanted: "양도 구해요",
  roommate_offer: "룸메 구해요",
  roommate_wanted: "룸메 지원해요",
  life_question: "생활 질문",
  life_tip: "정보·팁",
  free: "자유",
  room_showcase: "내 방 자랑",
} as const;
export type Category = keyof typeof CATEGORIES;
export const HOUSING_CATEGORIES: Category[] = ["transfer_offer", "transfer_wanted", "roommate_offer", "roommate_wanted"];
export const LIFE_CATEGORIES: Category[] = ["life_question", "life_tip", "free"];

export const RATING_ITEMS = {
  soundproof: "방음",
  sunlight: "채광",
  water: "수압·배수",
  hvac: "냉난방",
  clean: "청결·벌레",
  security: "보안",
  management: "관리·수리 응대",
  access: "학교 접근성",
  value: "가격 만족도",
} as const;
export type RatingKey = keyof typeof RATING_ITEMS;

export const CONTRACT_METHODS = { broker: "중개", direct: "직거래", transfer: "양도", other: "기타" } as const;
export const FLOOR_BANDS = { basement: "반지하", low: "저층(1~2층)", mid: "중층(3~4층)", high: "고층(5층~)" } as const;
export const ROOM_TYPES = ["원룸(분리형)", "원룸(오픈형)", "1.5룸", "투룸", "쓰리룸 이상"] as const;
export const ORIENTATIONS = ["남향", "동향", "서향", "북향", "모름"] as const;
export const OPTIONS = ["에어컨", "세탁기", "냉장고", "인덕션", "전자레인지", "침대", "책상", "옷장", "신발장", "인터넷", "엘리베이터", "주차"] as const;
export const LANDLORD_CONSENT = { agreed: "임대인 동의 완료", unknown: "동의 미확인", refused: "임대인 미동의" } as const;
export const MARKET_CATEGORIES = { furniture: "가구", appliance: "가전", living: "생활용품", bundle: "일괄 처분", etc: "기타" } as const;
export const CONDITIONS = { new: "거의 새것", good: "양호", fair: "사용감 있음", worn: "많이 낡음" } as const;
export const AVAILABILITY = { selling: "판매중", reserved: "예약중", done: "거래완료" } as const;
export const LIFESTYLE = {
  smoking: { label: "흡연", options: ["비흡연", "흡연", "상관없음"] },
  pet: { label: "반려동물", options: ["없음", "있음", "상관없음"] },
  sleep: { label: "취침시간", options: ["~24시", "24~2시", "2시 이후", "불규칙"] },
  clean: { label: "청결", options: ["매일 정리", "주 1~2회", "느슨한 편"] },
} as const;
export const REPORT_REASONS = ["개인정보 노출", "허위·과장 의심", "욕설·모욕", "광고·스팸", "부적절한 거래 유도", "기타"] as const;
