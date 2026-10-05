-- 小华听写 Plus: subscriptions (Stripe), custom word lists, and set durations for parent reports.
-- Free accounts: 1 child, progress kept on the device. Plus: up to 6 children, cloud sync, reports, word lists.

ALTER TABLE users ADD COLUMN plus_until INTEGER;            -- Plus is on while now < plus_until (ms)
ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT;
ALTER TABLE users ADD COLUMN subscription_status TEXT;      -- Stripe status: active, past_due, canceled, …
ALTER TABLE users ADD COLUMN plan_interval TEXT;            -- 'month' | 'year'
ALTER TABLE users ADD COLUMN cancel_at_period_end INTEGER NOT NULL DEFAULT 0;
CREATE INDEX users_stripe_customer ON users(stripe_customer_id);

-- Stripe webhook events already handled (Stripe retries; handle each once)
CREATE TABLE stripe_events (
  id          TEXT PRIMARY KEY,
  created_at  INTEGER NOT NULL
);

-- a parent's own word lists (e.g. this week's school 听写), shared by their children
CREATE TABLE word_lists (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  words       TEXT NOT NULL,                   -- JSON: ["完成", "勇敢", …]
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX word_lists_user ON word_lists(user_id, updated_at);

-- how long a set took (ms), for the parent report
ALTER TABLE sets ADD COLUMN ms INTEGER;
