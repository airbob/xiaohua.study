# 小华听写 Xiaohua (repo: xiehuawen)

Brand: **小华听写** · English: **Xiaohua · Chinese Tingxie Practice** · domain xiaohua.study.
The game world (map) is **汉字岛**; the mascot is **墨墨**.

## What it is
A web app for Singapore primary school students to practise writing Chinese words
(华文听写). The student picks a level, hears the word, sees its pinyin, and writes
the whole word freely by hand (finger, stylus or mouse) in a row of 田字格 cells —
nothing is corrected while writing. On "写好了" each character is graded against
its reference strokes: right / wrong stroke order / written wrong, with notes like
"第 3 笔笔顺不对" or "漏了第 5 笔", and a side-by-side of the child's ink and the model answer.

## Target users
- P1–P6 students in Singapore taking Chinese Language (CL)
- Parents running spelling/听写 practice at home

## Goals
1. Dictation practice built from the vocabulary that actually appears in school exams.
2. Feedback down to the stroke ("「是」第 1 笔写错"), not just right/wrong.
3. Work well on an iPad / phone with a finger.

## Design
"汉字岛" (designer mock, 2026-10-04): each grade is an island, every ~10 words a level with
1–3 stars (`src/lib/levels.js`), 复习营地 for the 错词本, mascot 墨墨. Tokens and layout live in
`src/styles.css`; desktop/iPad use the mock's two columns, phones a single column with the map
as a zigzag.

## Languages
Interface in 中文 (default) and English. Code strings are Chinese wrapped in `t('…')`
(`src/lib/i18n.js`); English lives in `src/i18n/en.js`, keyed by the Chinese. After adding
or changing UI text run `node scripts/i18n-keys.mjs` — it lists any string without English.
Study content (characters, pinyin, examples) is never translated. Word-list pages render both
languages via `L(zh, en)` in `scripts/seo-pages.mjs` and show one with CSS (html.lang-en).

## Analytics
Google Analytics G-SDETN3W1KN, loaded only on xiaohua.study (index.html + scripts/seo-pages.mjs).
Events go through `src/lib/analytics.js` (`track`, `trackScreen`, `setAudience`); never put
emails, names or free text in event params.

## Word bank
`data/words.json`: 1,181 words with pinyin, an English gloss and an exam example sentence.
- P2–P6: mined from 411 CL exam papers on sgexamhub.com (OCR in
  `PrimarySchoolExamPapers/data/ocr`). A word is placed in the lowest grade where enough
  of that grade's papers use it (see `scripts/build_dataset.py`).
- P1: there are no P1 papers in the corpus, so `data/p1-core.txt` is a hand-picked list.
- Rebuild: `python scripts/extract_vocab.py && python scripts/build_dataset.py`
  (needs `jieba`, `pypinyin`; and `data/raw/cedict.txt` from CC-CEDICT for English glosses).

## Stack
Vite + React. Stroke data from hanzi-writer-data (jsDelivr); grading is our own
(`src/lib/grade.js`: per-stroke shape/direction with a loose position check after fitting
the character to the reference box; in-order reading first, then stroke matching + LIS for
stroke order). Deliberately lenient: look-alikes such as 人/入 or 己/已 can pass. Hanzi Writer is only used for the stroke-order animation. Progress is stored
in localStorage for now.

## Audio
`scripts/gen-tts.mjs` pre-generates Azure neural TTS clips (zh-CN-XiaoxiaoNeural) for every
word and example sentence into `public/audio/` (2,328 clips, ~17k characters — inside the
free tier). It goes through the xiaohua TTS worker (proxy URL + app token) or straight to
Azure; credentials live in the gitignored `scripts/tts.local.json`. Clips are re-encoded to 48 kbps mono with ffmpeg (~40 MB total). Mispronounced words can
be forced syllable-by-syllable via `data/tts-overrides.json`, then redone with `ONLY=… FORCE=1`.
The site serves them as static files and never calls Azure, so the key never leaves
the build machine and there is no endpoint to abuse. Without clips the app falls
back to the browser's speechSynthesis.

## Accounts (v0.4)
Parents sign in (Google or an emailed link / 6-digit code); each parent has up to 6 child
profiles (nickname, grade, avatar). Guests can still practise; on a parent's first child,
the device's guest progress is merged in.
- Hosting: Cloudflare Worker `xiaohua-study` (static `dist/` via Workers Assets + `worker/`
  for `/api/*`), deployed by Workers Builds on push to main. Config: `wrangler.jsonc`.
- Data: D1 `xiaohua-study` (schema in `migrations/`): users, sessions, login_tokens,
  profiles, progress (per child × word: seen / wrong / streak / in 错词本 / due), sets, attempts.
  Strokes are not stored.
- Client: `src/lib/account.js` (session + profiles), `src/lib/storage.js` (per-profile local
  cache + outbox that posts finished sets, retried when offline).
- Children sign in with the parent's email + their own 6-digit PIN (set by the parent, unique
  within a family); a child session lasts 180 days (sliding) and can only see/practise that
  child. Parents can also hand a device over ("孩子模式") and sign out all of a child's devices.
- Secrets (wrangler secret put): RESEND_API_KEY, PIN_PEPPER (HMAC key for PIN hashes — never
  change it, or every child PIN stops working), GOOGLE_CLIENT_SECRET (not set yet). Var: GOOGLE_CLIENT_ID.
- Local dev: `npx wrangler d1 migrations apply xiaohua-study --local`, then `npx wrangler dev`
  (port 8787) + `npm run dev` (proxies /api). `.dev.vars` has DEV_LOGIN_LINKS=1, which shows
  the email code on screen instead of sending mail.
