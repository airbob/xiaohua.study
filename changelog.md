# Changelog

## 0.9.3 — 2026-10-10
- Each level on the islands is now 5 words instead of 10, so a level is a shorter, kid-sized round (P1 has 21 levels, P5 69). Stars: all 5 right = 3 stars, 3–4 right = 2 stars, finishing = 1 star. Stars earned on the old 10-word levels move over automatically (on the device, and on the server for Pro): each new level gets the stars of the old level its words came from. The word-list pages (/words/p1/ …) show the same 5-word levels.
- New scoring, out of 100 per character: the right shape earns 80, and stroke order the other 20 — each stroke written out of order or backwards takes 5 off (so at worst a right-shaped character still gets 80). A wrong shape gets up to 40 for the strokes that matched and nothing for order; blank or 不会写 is 0; 提示 caps the character at 50. Each character's score shows on the word's result card, and the end-of-level screen has a new 平均分 tile: all the characters' scores added up and divided by the number of characters.
- More praise when a word is all correct: instead of a flat 「对了」, 墨墨 says (in a cheerful recorded voice, and in the speech bubble) one of 17 praise lines that grow with the streak — 「好样的！」「写得很漂亮！」 for one word, 「连对两个，好棒！」 for two, 「哇，又对了！你是听写小高手！」 for three, 「连对四个，了不起！」 for four, and 「连对这么多，听写小冠军就是你！」 from five on; a 再写一次 that comes out right gets its own line. The same line never plays twice in a row.

## 0.9.2 — 2026-10-08
- While the site loads, a small dark splash with the 写 logo shows instead of the plain unstyled text and word-list links (that text stays in the page for search engines and visitors without JavaScript).

## 0.9.1 — 2026-10-08
- Phones held upright: the top bar hides while writing (the page's own ‹ button stays), and the writing cells are sized by the screen width instead of squeezed to fit the screen height — a two-character word gets two big cells (about 280px on an iPhone) stacked one above the other, and the child scrolls down to 写好了. A strip beside the cells is left free for scrolling; one cell always fits on screen. 3–4 character words keep the 2 × 2 grid, also sized by width; tablets and computers are unchanged.
- Every writing cell has its own 撤销 / 擦掉 / 提示 / 不会写: a row under the cell on computers and tablets, a column beside it on a phone's stacked cells (a row of icons for 3–4 character words on phones). On big screens the cells now grow up to 560px (was 380px). In the two-column layout 写好了 now lines up with the bottom of the cells' button row instead of sitting at the bottom of the screen. 撤销 and 擦掉 only touch that cell; 提示 shows only that character and only that character loses a star; 不会写 greys out that cell (tap again to take it back) and the rest are still graded — when every character is 不会写 the answers show straight away. The shared button row under the cells is gone; only 写好了 is left there.
- Home map on phones: the 出发 button that sticks to the bottom of the screen now sits on a soft frosted band, so the islands scrolling under it blur and fade out instead of clashing with the button.
- Word card: 再听词语 is now 听词语 and sits to the right of the pinyin; 听句子 moved into the example-sentence box, right of the sentence it reads (it stays in the word card when the sentence is hidden, and on the results screen). 写好了 only lifts as far as the side column still fits, so the mascot's tip is never cut off.
- Fixed: a word with no example sentence (e.g. P3 考试) showed an empty box under the word card when English meanings were turned off.
- Phones held sideways: the writing cells were tiny and their frames stretched sideways by the button row. The layout now tries the buttons both under and beside the cells and keeps whichever gives bigger cells (beside, on a short screen), drops the room it kept for the hidden hint line, and hides the top bar while writing — on an iPhone in Safari the cells grow from about 110px to about 200px. A button row never makes its frame wider; under a small cell it shows icons only.
- Home map on phones held sideways: the islands were scaled down with the small map until their text spilled out. Sideways phones now get the same zig-zag column of full-size islands as upright phones (with the sticky 出发 button), next to the side column.

## 0.9.0 — 2026-10-06
- **订阅管理** page of our own (account menu or Pro sheet → 管理订阅) instead of sending parents to Stripe: plan, price and renewal date; switch monthly ↔ yearly from the next renewal (nothing charged now, can be undone); cancel at the end of the paid period with an optional reason and comment (saved for us and sent to Stripe as cancellation feedback); resume before the period ends; card on file with 更换卡片 (Stripe's card-only page, then straight back); payment history with receipt links; a warning when a payment has failed. 中文 / EN, phone layout.
- After Checkout the site reads the subscription from Stripe directly, so Pro switches on even if the webhook is late.
- GA events: plan_view, plan_switch, plan_cancel (reason), plan_resume.

## 0.8.2 — 2026-10-05
- New 墨墨: a little cuttlefish (墨鱼) holding a pencil, from the designer's drawing, replacing the ink drop. Same four moods (happy, look, worried, cheer — happy eyes, open mouth and bubbles). One drawing (`src/lib/mascot-svg.js`) is shared by the app, the footer and the 词语表 pages; in the dark footer he sits on a teal badge. New share image (og.png).
- 管理订阅 shows "正在打开…" and a clear message when the Stripe portal can't open (instead of doing nothing); checkout replaces a saved Stripe customer that no longer exists.

## 0.8.1 — 2026-10-05
- The paid plan is now called **小华听写 Pro** (was Plus) everywhere on the site, in both languages. Stripe goes live with SGD prices.

## 0.8.0 — 2026-10-05
- **小华听写 Plus** (S$6.98 / month or S$68.98 / year, no trial). Free stays fully playable — all grades and levels — for **one child, with progress kept on that device**. Plus adds up to 6 children, cloud records on every device, child PIN sign-in / 孩子模式, the parent report and custom word lists, and future features (custom pages, custom mascot).
- Payments via Stripe Checkout (cards, Apple Pay, Google Pay; promo codes allowed) and the Stripe Customer Portal for changing plan, card or cancelling. A signed webhook keeps the plan in sync; access runs to the end of the paid period plus 3 days' grace. Deleting an account cancels its subscription.
- Upgrade sheet (nav Plus link, account menu, locked features): yearly/monthly choice with the saving, guests are asked to log in first, children are told to ask a parent. Plus shows a badge on the account button and the renewal date in the account menu.
- On upgrade, each child's local progress is uploaded once and sync turns on. Accounts that lapse keep their data in the cloud; extra children are shown as paused until Plus is back.
- **学习报告** (Plus, parents): per child — words this week vs last week, accuracy, days practised and minutes, 复习营地 size and words sent home, levels and stars; words per week (8 weeks) and per day (7 days) charts with tooltips and a screen-reader table; the most-missed characters (tap for stroke order); recent practice.
- **我的词组** (Plus): paste this week's school 听写 list (spaces, commas, 、 or new lines; up to 60 words, 50 lists). Pinyin is added automatically (bank words keep examples and English). Children can practise any list; missed words go to 复习营地 under a new 词组 filter.
- Sets now record their duration. GA events: view_promotion, begin_checkout, purchase, list_create / list_update / list_practice, report_view.

## 0.7.0 — 2026-10-05
- English interface: a 中文 / EN switch in the nav bar (also ?lang=en / ?lang=zh links for sharing). Menus, instructions, 墨墨's tips, grading feedback, level results, 复习营地, login / child PIN / profile dialogs and the footer are all translated; the characters, pinyin and example sentences stay Chinese. The choice is remembered and shared with the 词语表 pages.
- Switching to English turns on each word's English meaning, so a child without Chinese at home knows what they are writing.
- 词语表 pages render both languages and show one (no flash), with the same switch in their nav.
- English display type uses Fredoka (ZCOOL KuaiLe stays for Chinese).
- Sign-in email and confirmation page are bilingual.
- 复习营地 notes are stored in Chinese and translated when shown, so switching language never leaves a mix.
- Phones: the login button reads 登录 / Log in so the bar stays two rows. GA event language_switch.
- The 出发 start button moved from the bottom of the sidebar onto the map's bottom-right corner (the lock note sits above it). On phones it sticks to the bottom of the screen while the island column is in view.
- 游戏音效 setting (on by default, above 自动读词): a perfect word plays a rising chime then the 对了 voice, with a confetti burst from the writing frames; finishing a level (10 words) plays a longer fanfare with confetti from both sides. Sounds are synthesised with Web Audio (no files) and unlocked on the first tap for iOS; confetti (canvas-confetti) respects reduced motion. Turning sounds off silences the chime and 对了 but keeps the confetti.
- Home: the sidebar's natural height now sets the map's height (no more stretched gaps between the sidebar cards); the map takes the remaining width and everything on it — islands, title, start button — scales by the tighter of its width and height, so the islands shrink with a shorter map instead of crowding. Tops and bottoms line up at every screen size. The footer's 按年级看词语表 now follows right under the map (the home no longer reserves a full screen height).
- "游客模式 · 也能直接练" moved out of the nav bar (app and word-list pages) to small text under the start button, shown to guests only.

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
