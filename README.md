# 외대원룸 — 모현 대학가 주거생활 순환 커뮤니티 (공모전 시연 MVP)

배포 URL: https://hufs-room.lnh-hello-world.workers.dev (Cloudflare Workers + D1, 2026-11-20 배포·검증)

제2회 G-앵커 창업 아이디어 경진대회 출품용 작동형 MVP. **모든 건물·후기·가격·인물은 가상 데이터**이며 화면에 상시 `DEMO / 시연용` 표기가 붙는다.

## 스택
- 프론트: React 19 + Vite + TypeScript + Tailwind v4 + lucide-react (모바일 우선, PC 2열)
- 서버: Cloudflare Worker (`worker/`) — JSON API, 서버 세션(HttpOnly 쿠키, PBKDF2 비밀번호), 모든 mutation 서버 인가·검증·rate limit
- DB: Cloudflare D1 (SQLite, 영속) — `migrations/0001_init.sql`
- 배포: 하나의 Worker가 정적 자산(SPA)과 `/api/*`를 함께 제공

> 인수인계서 권장 스택(Next.js+Supabase)은 Supabase 계정/키가 없어, 무료로 실제 영속 DB를 확보할 수 있는 Cloudflare Workers + D1로 대체했다. localStorage 저장은 쓰지 않는다.

## 로컬 실행
```bash
npm install
npm run db:migrate:local   # 스키마
npm run db:seed:local      # 시연 데이터 (기존 데이터 초기화)
npm run dev                # http://localhost:5173
npm test                   # API 권한·정책 테스트 (dev 서버 실행 중, BASE=http://localhost:5173)
npm run build              # 타입검사 + 빌드
```

## 배포 (Cloudflare)
```bash
npx wrangler login
npx wrangler d1 create hufs_room          # 출력된 database_id 를 wrangler.jsonc 에 기입
npm run db:migrate:remote
npm run db:seed:remote
npm run deploy                            # https://hufs-room.<계정>.workers.dev
npx wrangler secret put ADMIN_BOOTSTRAP_TOKEN   # (선택) 관리자 승격용
```
관리자 지정: 이메일 가입 후 `curl -X POST <URL>/api/admin/bootstrap -H "x-bootstrap-token: <토큰>" -H "content-type: application/json" -d '{"email":"..."}'`. 관리자 계정은 공개하지 않는다.

## 환경변수
| 이름 | 위치 | 상태 |
|---|---|---|
| `REVIEW_AUTO_APPROVE` | wrangler vars | `true` (시연 모드: 후기 자동 공개, 사후 신고·관리자 숨김) |
| `FREE_VIEW_LIMIT` | wrangler vars | `3` |
| `SCHOOL_EMAIL_DOMAIN` | wrangler vars | 비어 있음 (외대 도메인 확인 전 자동 인증 안 함) |
| `ADMIN_BOOTSTRAP_TOKEN` | secret | 미설정 시 관리자 승격 불가 |
| `VITE_KAKAO_MAP_KEY` | 빌드 env | 없음 → 가상 동네 배치도 + 건물 목록으로 대체 |

## 심사위원 체험
`/login` 의 체험 계정(비밀번호 없음, DEMO, 관리자 권한 없음)
- 새내기: 누를 때마다 새 계정 생성 → 무료 열람권 3회, 후기 작성 시 전체 열람
- 후기 작성자 / 4학년 선배 / 가상 임대인(A빌라·B하우스 승인)

시연 동선: 지도·카드 → 원룸 상세(잠금) → 체험 로그인 → 무료 열람권 또는 후기 작성 → 전체 후기·실제 계약가 → 양도 글 → 1:1 채팅 → 장터 패키지 → 임대인 대시보드

## 구현 / 미구현
| 기능 | 상태 |
|---|---|
| 홈(고정 배치), 4종 주거 매칭, 생활 질문/정보/자유, 작성·조회·수정·모집종료, 필터·정렬·페이지네이션 | 구현 |
| 원룸 후기(9항목 정수 평점·N/A, 거주기간 중복 방지, 수정), 건물 집계(즉시 재계산) | 구현 |
| 열람 권한: 잠금 데이터 서버 응답에서 제외, 무료 열람권 3회 원자적 차감·중복 방지 | 구현 |
| 건물 등록 요청·주소 중복 방지·승인 전 숨김 | 구현 |
| 자취템 장터, 양도 글 패키지 연결, 내 방 자랑·좋아요·댓글·인기 순위 | 구현 |
| 1:1 채팅(서버 저장 + 3초 폴링), 차단, 신고, 알림 | 구현 |
| 임대인 대시보드(공실·수리 이력·후기 답변·문의), 관리자(승인·신고·제재·감사 로그) | 구현 |
| 개인정보 패턴(전화번호·호수) 서버 차단, rate limit, Origin 검사 | 구현 |
| 지도 SDK(카카오/네이버) | 미연결 — 가상 배치도로 대체 |
| 이미지 업로드 / EXIF 제거 | 미구현(추후) — 직접 만든 SVG 일러스트 사용 |
| Realtime 채팅, 이메일 인증 메일, 소셜 로그인 | 미구현(추후) |
| 실거주·임대인 실제 증빙 검증, 지역 업체 광고, 도보 경로 | P2 미구현 — 신청/검토 대기 상태만 |

## 법적 고지
외대원룸은 계약을 체결·중개하지 않는다. 임차권 양도·전대에는 원칙적으로 임대인 동의가 필요(민법 제629조). 실제 출시 전 중개·광고·후기 운영의 법률 검토가 필요하다.
