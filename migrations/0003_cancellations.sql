-- Why families cancel Pro (also sent to Stripe as cancellation_details).
CREATE TABLE cancellations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  reason TEXT,
  comment TEXT,
  plan_interval TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX cancellations_created ON cancellations(created_at);
