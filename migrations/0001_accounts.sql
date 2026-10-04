-- Parents sign in (Google or emailed link); each parent has one or more child profiles;
-- practice progress belongs to a profile.

CREATE TABLE users (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,          -- lower-cased
  name        TEXT,
  google_sub  TEXT UNIQUE,
  plan        TEXT NOT NULL DEFAULT 'free',  -- reserved for a paid tier later
  created_at  INTEGER NOT NULL,
  last_login  INTEGER
);

-- id = sha256(cookie token); the raw token only ever lives in the browser cookie
CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

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

CREATE TABLE profiles (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,                 -- nickname only
  grade       TEXT NOT NULL,                 -- 'P1'..'P6'
  avatar      TEXT NOT NULL DEFAULT '🐼',
  created_at  INTEGER NOT NULL
);
CREATE INDEX profiles_user ON profiles(user_id);

-- one row per (child, word) ever practised; in_book = currently in the 错词本
CREATE TABLE progress (
  profile_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  word        TEXT NOT NULL,
  seen        INTEGER NOT NULL DEFAULT 0,
  wrong       INTEGER NOT NULL DEFAULT 0,    -- times written imperfectly
  streak      INTEGER NOT NULL DEFAULT 0,    -- perfect writes in a row
  in_book     INTEGER NOT NULL DEFAULT 0,
  last_at     INTEGER,
  due_at      INTEGER,                       -- next review (used by spaced review, phase 2)
  PRIMARY KEY (profile_id, word)
);
CREATE INDEX progress_book ON progress(profile_id, in_book);

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
