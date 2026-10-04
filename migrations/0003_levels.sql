-- 汉字岛: every 10 words of a grade form a level with 1–3 stars; the 错词本 (复习营地)
-- remembers which characters were wrong and why, and when a word went back to the island.

ALTER TABLE progress ADD COLUMN bad TEXT;          -- indices of the wrong characters, e.g. '1' or '0,1'
ALTER TABLE progress ADD COLUMN note TEXT;         -- short reason, e.g. '「成」第 4 笔笔顺不对'
ALTER TABLE progress ADD COLUMN cleared_at INTEGER; -- when it last left the 错词本

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
