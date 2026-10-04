-- 写华文 schema. Parents sign in (Google or emailed link); each parent has one or more
-- child profiles; practice progress belongs to a profile. Children can also sign in with
-- the parent's email + their own 6-digit PIN.
-- (Squashed from 0001_accounts, 0002_child_login and 0003_levels before launch.)

CREATE TABLE users (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,          -- lower-cased
  name        TEXT,
  google_sub  TEXT UNIQUE,
  plan        TEXT NOT NULL DEFAULT 'free',  -- reserved for a paid tier later
  created_at  INTEGER NOT NULL,
  last_login  INTEGER
);

-- id = sha256(cookie token); the raw token only ever lives in the browser cookie.
-- A session with profile_id set is a child session: it can only see and practise that profile.
CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  profile_id  TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  device      TEXT,                          -- short label from the user agent, e.g. 'iPad'
  last_seen   INTEGER
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE INDEX sessions_profile ON sessions(profile_id);

-- emailed sign-in: a link (id = sha256(token)) plus a 6-digit code for when the link
-- opens in a different browser than the one the parent started in (e.g. Gmail's in-app browser)
CREATE TABLE login_tokens (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  code_hash   TEXT NOT NULL,                 -- sha256(email + ':' + code)
  tries       INTEGER NOT NULL DEFAULT 0,    -- wrong code attempts; locked after 5
  ip          TEXT,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  used_at     INTEGER
);
CREATE INDEX login_tokens_email ON login_tokens(email, created_at);
CREATE INDEX login_tokens_ip ON login_tokens(ip, created_at);

-- pin_hash = HMAC-SHA256(PIN_PEPPER, profile_id + ':' + pin); the pepper is a Worker
-- secret, so a database copy alone can't be used to recover PINs
CREATE TABLE profiles (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,                 -- nickname only
  grade       TEXT NOT NULL,                 -- 'P1'..'P6'
  avatar      TEXT NOT NULL DEFAULT '🐼',
  created_at  INTEGER NOT NULL,
  pin_hash    TEXT,
  pin_set_at  INTEGER
);
CREATE INDEX profiles_user ON profiles(user_id);

-- failed PIN attempts, for rate limiting
CREATE TABLE pin_failures (
  email       TEXT NOT NULL,
  ip          TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX pin_failures_email ON pin_failures(email, created_at);
CREATE INDEX pin_failures_ip ON pin_failures(ip, created_at);

-- one row per (child, word) ever practised; in_book = currently in the 错词本 (复习营地),
-- which remembers which characters were wrong and why, and when a word went back to the island
CREATE TABLE progress (
  profile_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  word        TEXT NOT NULL,
  seen        INTEGER NOT NULL DEFAULT 0,
  wrong       INTEGER NOT NULL DEFAULT 0,    -- times written imperfectly
  streak      INTEGER NOT NULL DEFAULT 0,    -- perfect writes in a row
  in_book     INTEGER NOT NULL DEFAULT 0,
  last_at     INTEGER,
  due_at      INTEGER,                       -- next review (used by spaced review, phase 2)
  bad         TEXT,                          -- indices of the wrong characters, e.g. '1' or '0,1'
  note        TEXT,                          -- short reason, e.g. '「成」第 4 笔笔顺不对'
  cleared_at  INTEGER,                       -- when it last left the 错词本
  PRIMARY KEY (profile_id, word)
);
CREATE INDEX progress_book ON progress(profile_id, in_book);

-- 汉字岛: each grade's words form levels of ~10 with 1–3 stars; best result per level
CREATE TABLE levels (
  profile_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  grade       TEXT NOT NULL,
  level       INTEGER NOT NULL,
  stars       INTEGER NOT NULL,     -- best so far
  correct     INTEGER NOT NULL,     -- at that best
  n           INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (profile_id, grade, level)
);

CREATE TABLE sets (
  id          TEXT PRIMARY KEY,
  profile_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source      TEXT NOT NULL,
  score       INTEGER NOT NULL,
  n           INTEGER NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX sets_profile ON sets(profile_id, created_at);

CREATE TABLE attempts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  set_id      TEXT NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
  profile_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  word        TEXT NOT NULL,
  score       INTEGER NOT NULL,              -- 0..100
  perfect     INTEGER NOT NULL,
  detail      TEXT,                          -- JSON: per-character status + notes (no strokes)
  created_at  INTEGER NOT NULL
);
CREATE INDEX attempts_profile ON attempts(profile_id, created_at);
