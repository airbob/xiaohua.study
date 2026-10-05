# Changelog

## 0.6.1 — 2026-10-05
- GA events: a virtual page view per screen (/map, /practice, /complete, /camp — the app doesn't change the URL), level_start / level_end (grade, level, stars, correct, hints, gave_up, best_streak, duration), practice_start / practice_end for 随机探险 and 复习营地, login (method), login_open (where from) and login_info_open, child_profile_create, daily_goal_complete, and word_listen on the 词语表 pages. User property account_type (guest / parent / child) + grade. No emails, names or other personal data are sent.
- Google Analytics (G-SDETN3W1KN) on the app (`index.html`) and every generated 词语表 page (`scripts/seo-pages.mjs`). The tag only loads on xiaohua.study (and subdomains), so `npm run dev` / localhost visits aren't counted.
- Renamed 写华文 → **小华听写** (English: Xiaohua · Chinese Tingxie Practice), matching xiaohua.study. 汉字岛 stays the name of the map/game world, 墨墨 the mascot. Updated page titles, share card (new og.png), structured data, word-list pages, sign-in email and sender name.
- Top nav bar on every page (designer's update): 小华听写 brand, 汉字岛地图 / 词语表 / 复习营地, and a prominent yellow 登录 / 注册 with an ⓘ popover explaining what signing in gives (guests can still play everything). Signed in, it shows the child's avatar, name and grade. The account pill left the home sidebar. Word-list pages share the same bar; their login button opens the app's sign-in (/?go=login). On phones the links take a second row, hidden while writing so the cells keep their size.
- Site footer (designer's 页脚) on the home page, 复习营地 and the word-list pages: 按年级看词语表 (one island per grade), about 小华听写, 我们的其他作品 (SGExamHub, 小华 App), about text with the CC-CEDICT credit (no copyright row). Not shown while writing or on the level-complete screen.

## 0.6.0 — 2026-10-04
- New 汉字岛 design (from the designer's mock): island map home, wooden 田字格 frames, 墨墨 the ink-drop guide, ZCOOL KuaiLe display type.
- Levels: each grade is cut into levels of ~10 words (most frequent first); finishing a level earns 1–3 stars (3 = at most one word wrong). Islands show progress, "你在这里", and locks above the child's grade (still playable).
- 今日任务 (10 words a day opens the chest), 随机探险 (mixed P1–P6).
- Writing: 10-dot level track, 连对 streak, trace mode shows "第 n / N 笔" and an orange dot where the next stroke starts; hint costs a star.
- Per-word result: ✓ / ! / × on each character, problem strokes tinted and numbered on the model answer, word stars, "再写一次" (practice only).
- Level complete screen: stars, words right, best streak, time, words sent to the camp.
- 复习营地 replaces the 错词本 list: cards with the wrong character marked and why, 2-dot progress back to the island, grade filter, "本周已回岛", review 10 at a time in trace or dictation.
- Server: level stars, mistake reasons and cleared-at are stored per child (migration 0003).
- Home 玩法 card: the 自动读词 / 例句 / 英文意思 chips are now full-width rows with a one-line hint and a large 开/关 pill switch (green with ✓ when on), per the designer's revision. Whole row is tappable; `role="switch"` + `aria-checked`.
- Practice page fix (two-column layout on tablets/laptops/landscape): the page is now exactly one screen tall, 撤销 / 写好了 stay pinned at the bottom of the left column, and the word card / 例句 / tip scroll inside that column when they don't fit. Previously a long left column (e.g. with 英文意思 on) pushed the buttons off-screen, and swiping on the writing cells couldn't scroll the page. Writing cells now reserve ~110px for the hint and 听写/描红 switch so they don't push it off-screen.
- Example sentences proofread: the auto-picked 例句 come from OCR'd exam papers and many had wrong characters (e.g. 想起妈妈就只了起来 → 就哭了起来, 肚子狗了 → 饱了, 几关牛奶 → 几盒牛奶). 130 corrected, 104 dropped (fragments / exam instructions / word used in the wrong sense); 1042 words keep an example. Fixes live in `data/example-fixes.json` and are applied by `scripts/build_dataset.py`, so a rebuild keeps them.
- Sentence audio regenerated for the proofread examples (130 new clips, 104 removed with their examples); `audio-index.json` updated.
- Bug fix: the 听写挑战 / 描红热身 switch on the practice page let a child flip to 描红 mid-dictation and see the answer as trace strokes. The mode is now fixed when a session starts (shown as a read-only tag); change it on the home / review screen before starting.
- Results screen fix: after 写好了 / 不会写, the left column (answer card + 这个词的成绩 + 墨墨) was cut off above 下一个词 because the column was a fixed-height scroll area. The results view now scrolls as a normal page; while writing, a clipped left column fades out at the bottom (until scrolled to the end) instead of cutting a card in half.
- Dev fix: the 词语表 pages (/words/, /words/p1/ …) only existed after `npm run build`, so under `npm run dev` the home page links fell back to the app. Page rendering moved to `scripts/seo-pages.mjs`; the build writes it to dist/ as before (output unchanged) and a dev-only Vite middleware serves the same pages live.
- 词语表 pages redesigned to match the 汉字岛 app (designer's mock "⑥ 词语表页"): dark top nav (汉字岛地图 / 词语表 / 复习营地), sea-green hero with the grade's island and 个词 / 关 / 已学会 stats, 换一座岛 grade switcher, a 全部关卡 index, and one card per level (same 9–10-word split as the app, was fixed groups of 10) with word cards: 田字格 楷体 characters, pinyin, English, a speaker button (plays the word clip), and the example with the word highlighted. An inline script reads the child's progress from localStorage to show level stars / 已过关, 已学会, and 在复习营地 tags. Overview page uses the same style with one island card per grade. App deep links added: `/?start=P6&level=3` (闯这一关) and `/?go=review`.
- DB migrations squashed into `migrations/0001_init.sql` before launch (replaces 0001_accounts, 0002_child_login, 0003_levels). Verified column-by-column (columns, defaults, keys, foreign keys, indexes) that the old three and the new file produce the same schema, and that the production D1 schema matches it; only the `d1_migrations` bookkeeping was rewritten (remote and local), no tables or rows touched.

## 0.5.0 — 2026-10-04
- Child sign-in: parents set a 6-digit PIN per child; a child signs in with the parent's email + their PIN and stays signed in on that device for 6 months (renewed with use). Wrong PINs are rate-limited.
- Child sessions only see and practise their own profile — no switching, editing or deleting.
- Parents see each child's signed-in devices and can sign them all out; "孩子模式" hands the current device to a child.

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
