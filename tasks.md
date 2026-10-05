# Tasks

## This Week
- [ ] Pro launch: Stripe account → product "小华听写 Pro" with SGD prices S$6.98/month and S$68.98/year → price ids in wrangler.jsonc; `wrangler secret put STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`; webhook https://xiaohua.study/api/billing/webhook; enable Customer Portal.
- [ ] Fill in and publish docs/legal (terms, privacy: company, UEN, contact, refunds, GST), then LEGAL_READY = true.
- [ ] Decide on a comp for existing accounts (e.g. 3 months of Pro).
- [ ] (Later, optional) Google OAuth client — the button appears by itself once configured (redirect https://xiaohua.study/api/auth/google/callback) → GOOGLE_CLIENT_ID in wrangler.jsonc, GOOGLE_CLIENT_SECRET secret.
- [x] Resend: xiaohua.study verified, RESEND_API_KEY set; real login email received 2026-10-04.
- [ ] Try free writing on a real iPad with a student; tune grading thresholds (`TOL` in src/lib/grade.js).
- [ ] Listen through a sample of clips; add mispronounced 多音字 to data/tts-overrides.json and redo with ONLY=… FORCE=1.
- [ ] Review the P1 list against 欢乐伙伴 1A/1B.
- [ ] Deploy to Cloudflare Pages.

## Backlog
- [ ] Weekly parent report email (Pro).
- [ ] Pro extras: custom pages, custom mascot.
- [ ] After launch: verify xiaohua.study in Google Search Console, submit sitemap.xml.
- [ ] Spot-check example sentences, add a manual override file.
- [ ] Bundle stroke data locally / offline support (PWA).

## Done
- [x] 小华听写 Pro: Stripe billing, free = 1 child local-only, 学习报告, 我的词组 (2026-10-05, not yet deployed).
- [x] Parent accounts + child profiles + cloud 错词本 sync (D1, Worker API).
- [x] Free-writing pad + whole-word grading (stroke shape, order, direction).
- [x] Azure TTS pre-generation script + static clip playback with browser fallback.
- [x] Generated all 2,328 clips (1,182 words + 1,146 sentences) via the xiaohua worker, 2026-10-04.
- [x] Extract word bank from sgexamhub CL papers (P2–P6) + P1 core list → `data/words.json`.
- [x] Practice app: level pick, pinyin + audio, handwriting pad, per-stroke grading, results, 错词本 (local).
