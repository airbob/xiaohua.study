# Changelog

## 0.4.0 — 2026-10-04
- Parent accounts: sign in with an emailed link / 6-digit code (Google sign-in built in, shown once configured); add up to 6 children (nickname, grade, avatar) and switch between them.
- Each child's 错词本, seen-counts and history are saved to the cloud and follow them across devices; practice still works offline and syncs later.
- Guest progress on a device is merged into the first child on sign-in; guests see a sign-in prompt on the results page when they have mistakes.
- Delete a child or the whole account (all data removed).

## 0.3.0 — 2026-10-04
- SEO for xiaohua.study: title/description/keywords, canonical, Open Graph card (og.png), JSON-LD (WebSite + WebApplication/LearningResource), static fallback content for crawlers.
- Static word-list pages /words/ and /words/p1/ … /p6/ (词语 · 拼音 · English · 例句, printable), generated after build by scripts/build-seo.mjs, plus sitemap.xml and robots.txt.
- /?start=P3 deep link starts a set directly; home page links to the word lists.
- Apple touch icon; pinch-zoom allowed again outside the writing pad.

## 0.2.1 — 2026-10-04
- Grading is much more forgiving of messy handwriting: each stroke is judged on its own shape and direction with only a loose position check, after stretching the character to fit; strokes are first read in the order written. Stroke order, reversed and missing strokes are still caught.
- "判得不对？复制笔迹" link on the feedback card copies the raw strokes for tuning.
- Phones: no more text-selection / Copy-Look Up callout while writing; no double-tap zoom on buttons.
- Bigger writing pad on phones: the pad picks whichever arrangement gives the largest cells (2 characters stack vertically in portrait, 2×2 for 3–4); landscape puts prompt and buttons in a left column so the pad gets the full height.

## 0.2.0 — 2026-10-04
- Free writing: write the whole word in one pad (one 田字格 per character, 2×2 on small screens); no correction while writing; undo / clear / 偷看 / 不会写.
- Graded on submit, per character: 对 / 笔顺错 / 写错, with notes on wrong, missing, extra, out-of-order and reversed strokes, and a side-by-side of the child's ink and the model answer with problem strokes numbered.
- Azure neural voice clips for words and example sentences (pre-generated; falls back to browser TTS).

## 0.1.0 — 2026-10-04
- First version: P1–P6 / mix / 错词本 dictation practice, 10 words per set.
- Pinyin with tone marks and read-aloud for each word and its example sentence.
- 田字格 handwriting pad with stroke-by-stroke checking, hint, give-up with stroke animation.
- 听写 (no outline) and 描红 (trace) modes.
- Results page: score, stars, which strokes were wrong, stroke-order replay for any character.
- Wrong words go into a local 错词本 and leave after two perfect writes in a row.
