# Tasks

## This Week
- [ ] Try free writing on a real iPad with a student; tune grading thresholds (`TOL` in src/lib/grade.js).
- [ ] Listen through a sample of clips; add mispronounced 多音字 to data/tts-overrides.json and redo with ONLY=… FORCE=1.
- [ ] Review the P1 list against 欢乐伙伴 1A/1B.
- [ ] Deploy to Cloudflare Pages.

## Backlog
- [ ] After launch: verify xiaohua.study in Google Search Console, submit sitemap.xml.
- [ ] Accounts + cloud-saved 错词本.
- [ ] Spot-check example sentences, add a manual override file.
- [ ] Bundle stroke data locally / offline support (PWA).

## Done
- [x] Free-writing pad + whole-word grading (stroke shape, order, direction).
- [x] Azure TTS pre-generation script + static clip playback with browser fallback.
- [x] Generated all 2,328 clips (1,182 words + 1,146 sentences) via the xiaohua worker, 2026-10-04.
- [x] Extract word bank from sgexamhub CL papers (P2–P6) + P1 core list → `data/words.json`.
- [x] Practice app: level pick, pinyin + audio, handwriting pad, per-stroke grading, results, 错词本 (local).
