# Tasks

## This Week
- [ ] (Later, optional) Google OAuth client — the button appears by itself once configured (redirect https://xiaohua.study/api/auth/google/callback) → GOOGLE_CLIENT_ID in wrangler.jsonc, GOOGLE_CLIENT_SECRET secret.
- [ ] Resend: verify xiaohua.study sending domain, RESEND_API_KEY secret.
- [ ] Confirm Workers Builds deploy command is `npx wrangler deploy` (so wrangler.jsonc + worker/ are used).
- [ ] Try free writing on a real iPad with a student; tune grading thresholds (`TOL` in src/lib/grade.js).
- [ ] Listen through a sample of clips; add mispronounced 多音字 to data/tts-overrides.json and redo with ONLY=… FORCE=1.
- [ ] Review the P1 list against 欢乐伙伴 1A/1B.
- [ ] Deploy to Cloudflare Pages.

## Backlog
- [ ] Phase 2: spaced review of the 错词本 (due_at), progress page per child.
- [ ] Phase 3: custom weekly 听写 lists from parents, weekly parent email.
- [ ] After launch: verify xiaohua.study in Google Search Console, submit sitemap.xml.
- [ ] Spot-check example sentences, add a manual override file.
- [ ] Bundle stroke data locally / offline support (PWA).

## Done
- [x] Parent accounts + child profiles + cloud 错词本 sync (D1, Worker API).
- [x] Free-writing pad + whole-word grading (stroke shape, order, direction).
- [x] Azure TTS pre-generation script + static clip playback with browser fallback.
- [x] Generated all 2,328 clips (1,182 words + 1,146 sentences) via the xiaohua worker, 2026-10-04.
- [x] Extract word bank from sgexamhub CL papers (P2–P6) + P1 core list → `data/words.json`.
- [x] Practice app: level pick, pinyin + audio, handwriting pad, per-stroke grading, results, 错词本 (local).
