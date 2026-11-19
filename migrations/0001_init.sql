-- 외대원룸 초기 스키마 (Cloudflare D1 / SQLite)
-- 모든 시각은 UTC ISO8601 문자열로 저장, 화면에서 Asia/Seoul 로 표시

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  nickname TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','landlord','admin')),
  verification_status TEXT NOT NULL DEFAULT 'none' CHECK (verification_status IN ('none','pending','verified','rejected')),
  is_demo INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE verification_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK (type IN ('student','landlord','residence')),
  building_id TEXT REFERENCES buildings(id),
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE buildings (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  normalized_address TEXT NOT NULL UNIQUE,
  lat REAL,
  lng REAL,
  map_x REAL,           -- 가상 동네 지도용 상대 좌표 (0~100)
  map_y REAL,
  walk_minutes INTEGER, -- 확인된 값만 (NULL 이면 표시 안 함)
  description TEXT,
  amenities TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  submitted_by TEXT REFERENCES users(id),
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE landlord_buildings (
  landlord_id TEXT NOT NULL REFERENCES users(id),
  building_id TEXT NOT NULL REFERENCES buildings(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (landlord_id, building_id)
);

CREATE TABLE building_reviews (
  id TEXT PRIMARY KEY,
  building_id TEXT NOT NULL REFERENCES buildings(id),
  author_id TEXT NOT NULL REFERENCES users(id),
  start_month TEXT NOT NULL,
  end_month TEXT NOT NULL,
  floor_band TEXT CHECK (floor_band IN ('low','mid','high','basement')),
  orientation TEXT,
  room_type TEXT,
  deposit INTEGER,
  monthly_rent INTEGER,
  maintenance_fee INTEGER,
  broker_fee INTEGER,
  contract_method TEXT CHECK (contract_method IN ('broker','direct','transfer','other')),
  options TEXT NOT NULL DEFAULT '[]',
  ratings TEXT NOT NULL,
  renewal_intent TEXT CHECK (renewal_intent IN ('yes','no','unsure')),
  body TEXT NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'none' CHECK (verification_status IN ('none','requested','verified_demo','verified')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','published','hidden','rejected')),
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (author_id, building_id, start_month, end_month)
);
CREATE INDEX idx_reviews_building ON building_reviews(building_id, status);

CREATE TABLE review_media (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL REFERENCES building_reviews(id),
  url TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'locked'
);

CREATE TABLE review_views (
  user_id TEXT NOT NULL REFERENCES users(id),
  building_id TEXT NOT NULL REFERENCES buildings(id),
  source TEXT NOT NULL CHECK (source IN ('free','review')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, building_id)
);

CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES users(id),
  category TEXT NOT NULL CHECK (category IN ('transfer_offer','transfer_wanted','roommate_offer','roommate_wanted','life_question','life_tip','free','room_showcase')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  building_id TEXT REFERENCES buildings(id),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','hidden')),
  attributes TEXT NOT NULL DEFAULT '{}',
  photo_urls TEXT NOT NULL DEFAULT '[]',
  price_sort INTEGER,           -- 가격 필터/정렬용 월세(원)
  view_count INTEGER NOT NULL DEFAULT 0,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_posts_cat ON posts(category, status, created_at);

CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id),
  author_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published','hidden')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE reactions (
  user_id TEXT NOT NULL REFERENCES users(id),
  post_id TEXT NOT NULL REFERENCES posts(id),
  type TEXT NOT NULL CHECK (type IN ('like','save')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, post_id, type)
);

CREATE TABLE market_items (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES users(id),
  post_id TEXT REFERENCES posts(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL CHECK (category IN ('furniture','appliance','living','bundle','etc')),
  price INTEGER NOT NULL DEFAULT 0,
  condition TEXT NOT NULL DEFAULT 'good' CHECK (condition IN ('new','good','fair','worn')),
  handover_date TEXT,
  area TEXT,
  availability TEXT NOT NULL DEFAULT 'selling' CHECK (availability IN ('selling','reserved','done')),
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published','hidden')),
  photo_urls TEXT NOT NULL DEFAULT '[]',
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE vacancies (
  id TEXT PRIMARY KEY,
  building_id TEXT NOT NULL REFERENCES buildings(id),
  landlord_id TEXT NOT NULL REFERENCES users(id),
  available_from TEXT NOT NULL,
  deposit INTEGER NOT NULL,
  rent INTEGER NOT NULL,
  maintenance INTEGER NOT NULL DEFAULT 0,
  room_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE landlord_replies (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL UNIQUE REFERENCES building_reviews(id),
  landlord_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE repairs (
  id TEXT PRIMARY KEY,
  building_id TEXT NOT NULL REFERENCES buildings(id),
  landlord_id TEXT NOT NULL REFERENCES users(id),
  summary TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  post_id TEXT REFERENCES posts(id),
  market_item_id TEXT REFERENCES market_items(id),
  building_id TEXT REFERENCES buildings(id),
  member_low TEXT NOT NULL REFERENCES users(id),
  member_high TEXT NOT NULL REFERENCES users(id),
  context_key TEXT NOT NULL UNIQUE,
  last_message_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  sender_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_messages_conv ON messages(conversation_id, created_at);

CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL REFERENCES users(id),
  target_type TEXT NOT NULL CHECK (target_type IN ('post','comment','review','market','user','message','building')),
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','actioned','dismissed')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE blocks (
  blocker_id TEXT NOT NULL REFERENCES users(id),
  blocked_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (blocker_id, blocked_id)
);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  ref_id TEXT,
  text TEXT NOT NULL,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE admin_audit (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);
