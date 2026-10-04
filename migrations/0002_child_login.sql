-- Children sign in with the parent's email + their own 6-digit PIN.

-- HMAC-SHA256(PIN_PEPPER, profile_id + ':' + pin); the pepper is a Worker secret, so a
-- database copy alone can't be used to recover PINs
ALTER TABLE profiles ADD COLUMN pin_hash TEXT;
ALTER TABLE profiles ADD COLUMN pin_set_at INTEGER;

-- a session with profile_id set is a child session: it can only see and practise that profile
ALTER TABLE sessions ADD COLUMN profile_id TEXT REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE sessions ADD COLUMN device TEXT;      -- short label from the user agent, e.g. 'iPad'
ALTER TABLE sessions ADD COLUMN last_seen INTEGER;
CREATE INDEX sessions_profile ON sessions(profile_id);

-- failed PIN attempts, for rate limiting
CREATE TABLE pin_failures (
  email       TEXT NOT NULL,
  ip          TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX pin_failures_email ON pin_failures(email, created_at);
CREATE INDEX pin_failures_ip ON pin_failures(ip, created_at);
