import { mascotSvg } from '../src/lib/mascot-svg.js'
// Static, crawlable word-list pages (shared by the build and the dev server):
//   /words/            overview of the word lists (one island per grade)
//   /words/p1/ … /p6/  each grade's full list, cut into the same levels as the app
// The app itself is a single page; these give search engines real content and give
// parents a printable list. The HTML carries every word; a small inline script then
// reads the child's progress from localStorage (same origin as the app) to fill in
// stars, 已学会 and 在复习营地, and plays the word clips.
// scripts/build-seo.mjs writes them into dist/; vite.config.js serves them in dev.
const SITE = 'https://xiaohua.study'
const LEVELS = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6']
// Interface text in both languages; CSS shows one (html.lang-en). The study content is not
// translated. The choice is shared with the app (localStorage 'xhw.lang', or ?lang=en|zh).
const L = (zh, en) => `<span class="i-zh">${zh}</span><span class="i-en" lang="en">${en}</span>`
const GRADE_EN = { P1: 'Primary 1', P2: 'Primary 2', P3: 'Primary 3', P4: 'Primary 4', P5: 'Primary 5', P6: 'Primary 6' }
const LANG_BOOT = `<script>
(function () {
  var l = new URLSearchParams(location.search).get('lang')
  try { if (l === 'en' || l === 'zh') localStorage.setItem('xhw.lang', l); else l = localStorage.getItem('xhw.lang') } catch (e) {}
  if (l === 'en') { document.documentElement.classList.add('lang-en'); document.documentElement.lang = 'en' }
})()
function setLang(l) {
  try { localStorage.setItem('xhw.lang', l) } catch (e) {}
  location.replace(location.pathname + location.hash)
}
</script>`
const GRADE_CN = { P1: '一年级', P2: '二年级', P3: '三年级', P4: '四年级', P5: '五年级', P6: '六年级' }

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const filled = (w) => esc(w.example.replace(/（[　 ]+）/, '\u0000')).replace('\u0000', `<mark>${esc(w.word)}</mark>`)

/** Even split into levels of 4–5 words — keep in sync with levelSizes() in src/lib/levels.js. */
function split(list) {
  const count = Math.ceil(list.length / 5)
  const out = []
  let start = 0
  for (let i = 0; i < count; i++) {
    const size = Math.floor(list.length / count) + (i < list.length % count ? 1 : 0)
    out.push(list.slice(start, start + size))
    start += size
  }
  return out
}

// ---- styles (汉字岛 design: ink outlines, chunky shadows, ZCOOL KuaiLe display type) ----
const CSS = `
:root{--ink:#1b1b26;--sand:#f6e3b4;--navy:#2b2b3a;--navy-2:#3a4566;--sea:#8ed6d0;--sea-ink:#1b4a47;--red:#e4573d;--orange:#f2a93b;--yellow:#ffe08a;--green:#7cc46b;--cream:#fff4d6;--muted:#4a4a55;--pinyin:#1b5e8c;--grid:#e7b9a0;--paper:#fffdf6;--ex:#f7f3ea;--stone:#e6e1d3;--star-off:#c9b996;--pink:#fbe2dc;--pink-ink:#8e2a17;
--display:'ZCOOL KuaiLe','Noto Sans SC','PingFang SC',sans-serif;--body:'Noto Sans SC',-apple-system,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;--kai:KaiTi,STKaiti,'Kaiti SC','BiauKai','Noto Serif SC',serif}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:var(--sand);color:var(--ink);font-family:var(--body);line-height:1.5}
a{color:var(--ink)}a:hover{color:var(--red)}
button{font-family:inherit;cursor:pointer}
.wrap{max-width:1160px;margin:0 auto;padding-left:24px;padding-right:24px}
.sp{flex:1 1 20px}
.display{font-family:var(--display);font-weight:400}

.topnav{background:var(--navy);border-bottom:4px solid var(--ink)}
.topnav .wrap{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding-top:14px;padding-bottom:14px}
.brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:#fff}
.brand:hover{color:#fff}
.logo{width:44px;height:44px;border-radius:14px;background:var(--red);border:3px solid var(--ink);display:flex;align-items:center;justify-content:center;font-family:var(--display);font-size:28px;color:#fff}
.brand-name{font-family:var(--display);font-size:26px}
.navlink{color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:10px 12px;border-radius:12px}
.navlink:hover{color:var(--yellow)}
.navlink[aria-current]{color:#ffe08a;font-weight:900;padding:8px 14px;background:var(--navy-2)}
.navlinks{display:flex;gap:4px;flex-wrap:wrap}
html.lang-en .i-zh,html:not(.lang-en) .i-en,html.lang-en .zh-only{display:none!important}
html.lang-en{--display:'Fredoka','ZCOOL KuaiLe',sans-serif}
.login-short{display:none}
@media (max-width:760px){.login-full{display:none}.login-short{display:inline}.topnav .wrap{padding-left:12px;padding-right:12px}.topnav .logo{width:34px;height:34px;font-size:20px;border-radius:10px}.topnav .brand-name{font-size:20px}.acct{gap:6px}.lang-switch{padding:2px}.lang-switch button{height:26px;min-width:32px;padding:0 5px;font-size:12px}}
.lang-switch{display:flex;background:#3a4566;border:2.5px solid var(--ink);border-radius:12px;padding:3px;gap:2px}
.lang-switch button{height:30px;min-width:40px;padding:0 8px;border:none;border-radius:9px;background:transparent;color:#c9d0e3;font:inherit;font-size:13px;font-weight:900;cursor:pointer}
html:not(.lang-en) .lang-switch [data-l=zh],html.lang-en .lang-switch [data-l=en]{background:#ffe08a;color:var(--ink)}
.acct{display:flex;align-items:center;gap:10px}
.login-btn{height:44px;padding:0 18px 0 14px;border-radius:14px;background:#ffe08a;border:3px solid var(--ink);box-shadow:0 0 0 2px #ffe08a;display:flex;align-items:center;gap:8px;font-size:16px;font-weight:900;color:var(--ink);text-decoration:none;white-space:nowrap}
.login-btn:hover{background:#ffd65c;color:var(--ink)}
.me-btn{height:44px;display:flex;align-items:center;gap:8px;padding:0 14px 0 8px;border-radius:14px;background:#fff;border:3px solid var(--ink);color:var(--ink);text-decoration:none;font-family:var(--display);font-size:20px}
.me-btn small{font-family:var(--body,inherit);font-size:12px;font-weight:700;color:var(--muted)}
@media (max-width:760px){.topnav .wrap{gap:6px;padding-top:8px;padding-bottom:8px}.login-btn{height:38px;font-size:14px}.navlinks{order:3;width:100%;justify-content:space-between}.navlink{flex:1;text-align:center;padding:8px 6px;font-size:14px}}

.hero{background:var(--sea);border-bottom:4px solid var(--ink);position:relative;overflow:hidden}
.hero .waves{position:absolute;left:0;top:0;width:100%;height:100%}
.hero-in{position:relative;display:flex;flex-wrap:wrap;gap:32px;align-items:center;padding-top:28px;padding-bottom:32px}
.hero-text{flex:999 1 560px;min-width:0;display:flex;flex-direction:column;gap:14px}
.crumbs{font-size:14px;font-weight:700;color:var(--sea-ink);display:flex;gap:6px;flex-wrap:wrap}
.crumbs a{color:var(--sea-ink)}
h1{margin:0;font-family:var(--display);font-weight:400;font-size:52px;line-height:1.1}
.lead{margin:0;font-size:17px;line-height:1.75;font-weight:500;max-width:680px}
.lead-en{margin:0;font-size:14px;line-height:1.6;color:var(--sea-ink);max-width:680px}
.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:6px}
.btn{height:60px;padding:0 22px;border-radius:20px;background:#fff;border:4px solid var(--ink);font-size:17px;font-weight:900;color:var(--ink);text-decoration:none;display:inline-flex;align-items:center;gap:10px}
.btn.red{background:var(--red);color:#fff;box-shadow:0 6px 0 var(--ink);font-family:var(--display);font-weight:400;font-size:24px;padding:0 26px}
.btn.red:hover{color:#fff}
.btn.red:active{transform:translateY(3px);box-shadow:0 3px 0 var(--ink)}

.hero-side{flex:1 1 300px;display:flex;flex-direction:column;align-items:center;gap:14px}
.island{position:relative;width:280px;height:190px}
.island-body{position:absolute;left:0;top:30px;width:280px;height:150px;border-radius:48% 52% 44% 56%/55% 45% 55% 45%;background:var(--yellow);border:5px solid var(--ink);box-shadow:inset 0 -20px 0 var(--green);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px}
.island-body .display{font-size:56px;line-height:1}
.island-body small{font-size:14px;font-weight:900}
.island .flag{position:absolute;left:200px;top:-6px}
.stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;width:100%;max-width:320px}
.stat{background:#fff;border:3px solid var(--ink);border-radius:14px;padding:8px 4px;text-align:center}
.stat .display{font-size:26px;display:block}
.stat small{font-size:12px;font-weight:700}

.main{padding-top:28px;padding-bottom:56px;display:flex;flex-direction:column;gap:28px}
.switch-grade{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.switch-grade b{font-size:15px;font-weight:900;margin-right:4px}
.grade-pill{min-width:64px;height:48px;padding:0 14px;border-radius:16px;background:#fff;border:3px solid var(--ink);font-family:var(--display);font-size:22px;color:var(--ink);text-decoration:none;display:flex;align-items:center;justify-content:center}
.grade-pill[aria-current]{background:var(--yellow);border-width:4px;box-shadow:0 4px 0 var(--ink)}

h2.section-title{margin:0;font-family:var(--display);font-weight:400;font-size:30px}
.lv-index{display:flex;flex-direction:column;gap:14px}
.lv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,200px),1fr));gap:14px}
.lv-card{background:#fff;border:3px solid var(--ink);border-radius:20px;padding:14px 16px;text-decoration:none;color:var(--ink);display:flex;align-items:center;gap:12px}
.lv-card:hover{color:var(--ink);background:var(--cream)}
.lv-dot{width:42px;height:42px;flex-shrink:0;border-radius:999px;background:var(--stone);border:3px solid var(--ink);display:flex;align-items:center;justify-content:center;font-family:var(--display);font-size:20px}
.lv-dot.passed{background:var(--green)}
.lv-card-text{display:flex;flex-direction:column;flex:1 1 auto}
.lv-card-text b{font-size:17px;font-weight:900}
.lv-card-text small{font-size:13px;color:var(--muted)}

.level{background:#fff;border:4px solid var(--ink);border-radius:28px;overflow:hidden;scroll-margin-top:16px}
.level-head{background:var(--cream);border-bottom:4px solid var(--ink);padding:16px 22px;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.lv-num{width:48px;height:48px;border-radius:999px;background:var(--orange);border:3px solid var(--ink);display:flex;align-items:center;justify-content:center;font-family:var(--display);font-size:24px}
.lv-title{display:flex;flex-direction:column}
.lv-title .display{font-size:28px;line-height:1.1}
.lv-meta{font-size:13px;font-weight:700;color:var(--muted)}
.stars{font-size:22px;letter-spacing:3px;color:var(--star-off)}
.stars .on{color:var(--orange)}
.btn-sm{height:48px;padding:0 18px;border-radius:16px;background:var(--red);border:3px solid var(--ink);box-shadow:0 4px 0 var(--ink);color:#fff;font-size:16px;font-weight:900;text-decoration:none;display:flex;align-items:center}
.btn-sm:hover{color:#fff}
.word-grid{padding:20px;display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,440px),1fr));gap:16px}

.word{position:relative;border:3px solid var(--ink);border-radius:22px;padding:16px 18px;display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start}
.camp-tag{position:absolute;top:-12px;right:16px;background:var(--pink);border:2.5px solid var(--ink);border-radius:999px;padding:2px 10px;font-size:12px;font-weight:900;color:var(--pink-ink)}
.camp-tag[hidden]{display:none}
.word-l{display:flex;flex-direction:column;align-items:center;gap:6px;flex-shrink:0}
.cells{display:flex;gap:4px}
.cell{width:56px;height:56px;border:2.5px solid var(--grid);border-radius:10px;display:flex;align-items:center;justify-content:center;font-family:var(--kai);font-size:42px;background:var(--paper)}
.py{font-size:18px;font-weight:700;color:var(--pinyin)}
.word-r{flex:1 1 220px;min-width:0;display:flex;flex-direction:column;gap:6px}
.gloss-row{display:flex;align-items:center;gap:8px}
.gloss{font-size:14px;color:var(--muted);flex:1 1 auto}
.say{width:44px;height:44px;border-radius:14px;background:var(--sea);border:3px solid var(--ink);display:flex;align-items:center;justify-content:center;flex-shrink:0;padding:0}
.say:active{transform:translateY(2px)}
.ex{margin:0;font-size:17px;line-height:1.7;background:var(--ex);border-radius:12px;padding:8px 12px}
.ex mark{background:var(--yellow);color:var(--ink);font-weight:900;border-radius:4px;padding:0 2px}

.islands{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr));gap:20px}
.island-card{background:#fff;border:4px solid var(--ink);border-radius:28px;padding:20px;text-decoration:none;color:var(--ink);display:flex;flex-direction:column;gap:12px;box-shadow:0 6px 0 var(--ink)}
.island-card:hover{color:var(--ink);background:var(--cream)}
.island-card .island{width:100%;height:150px}
.island-card .island-body{width:100%;height:120px;top:20px}
.island-card .island-body .display{font-size:44px}
.island-card .flag{left:auto;right:18%}
.island-meta{font-size:15px;font-weight:900}
.island-sample{font-size:14px;color:var(--muted)}

.cta-foot{display:flex;align-items:center;gap:16px;flex-wrap:wrap;background:var(--navy-2);color:#fff;border:4px solid var(--ink);border-radius:26px;padding:20px 24px}
.cta-foot-text{flex:999 1 300px;display:flex;flex-direction:column;gap:4px}
.cta-foot-text .display{font-size:24px}
.cta-foot-text small{font-size:14px;color:#d9deec}
.btn-orange{height:56px;padding:0 22px;border-radius:18px;background:var(--orange);border:3px solid var(--ink);box-shadow:0 5px 0 var(--ink);color:var(--ink);font-size:18px;font-weight:900;text-decoration:none;display:flex;align-items:center}
.btn-orange:hover{color:var(--ink)}
.site-foot{background:#2b2b3a;color:#fff;margin-top:8px}
.site-foot a{text-decoration:none}
.foot-wrap{max-width:1224px;margin:0 auto;padding:0 28px;box-sizing:border-box}
.foot-lists{background:#3a4566;border-top:4px solid #1b1b26;border-bottom:4px solid #1b1b26}
.foot-lists .foot-wrap{padding-top:32px;padding-bottom:36px;display:flex;flex-direction:column;gap:18px}
.foot-lists-head{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap}
.foot-lists-head h2{margin:0;font-family:var(--display);font-weight:400;font-size:30px;color:#fff}
.foot-lists-head span{font-size:14px;color:#c9d0e3}
.foot-islands{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,170px),1fr));gap:14px}
.foot-island{height:96px;box-sizing:border-box;border-radius:48% 52% 46% 54%/54% 46% 54% 46%;background:#f6e3b4;border:4px solid #1b1b26;box-shadow:inset 0 -12px 0 #7cc46b;color:#1b1b26;display:flex;flex-direction:column;align-items:center;justify-content:center}
.foot-island:hover{color:#1b1b26;transform:translateY(-3px) rotate(-1deg)}
.foot-island .g{font-family:var(--display);font-size:30px;line-height:1}
.foot-island b{font-size:13px;font-weight:900}
.foot-island small{font-size:12px;font-weight:500;color:#4a4a55;margin-bottom:8px}
.foot-main{padding-top:36px;padding-bottom:28px;display:flex;flex-wrap:wrap;gap:32px}
.foot-about{flex:999 1 420px;min-width:0;display:flex;flex-direction:column;gap:14px}
.foot-brand{display:flex;align-items:center;gap:12px}
.foot-brand .logo{width:44px;height:44px;font-size:26px}
.foot-brand .n{font-family:var(--display);font-size:26px}
.foot-brand .mascot{width:52px;height:52px;padding:3px;box-sizing:border-box;background:#8ED6D0;border:3px solid #1B1B26;border-radius:50%}
.foot-about p{margin:0;font-size:15px;line-height:1.8;color:#e3e7f2}
.foot-about p.en{font-size:14px;line-height:1.7;color:#b9c0d4}
.foot-about p.credit{font-size:12px;color:#8d94aa}
.site-foot{padding-bottom:12px}
.foot-more{flex:1 1 380px;min-width:0;display:flex;flex-direction:column;gap:12px}
.foot-kicker{font-size:14px;font-weight:900;color:#ffe08a;letter-spacing:1px}
.foot-card{background:#fff;border:4px solid #1b1b26;border-radius:22px;box-shadow:0 5px 0 #11111a;padding:14px 16px;display:flex;align-items:center;gap:14px;color:#1b1b26}
.foot-card:hover{color:#1b1b26;transform:translateY(-2px)}
.foot-card-icon{width:56px;height:56px;flex:none;border-radius:16px;border:3px solid #1b1b26;box-sizing:border-box;display:flex;align-items:center;justify-content:center}
.foot-card-text{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:2px}
.foot-card-text b{font-size:18px;font-weight:900}
.foot-card-text span{font-size:13px;color:#4a4a55;line-height:1.5}
.foot-card-text i{font-style:normal;font-size:12px;font-weight:700;color:#1b5e8c}
@media (max-width:760px){.foot-wrap{padding:0 16px}.foot-islands{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.foot-island{height:84px}.foot-lists-head h2{font-size:24px}.foot-main{padding-top:28px;gap:24px}}
@media print{.site-foot{display:none}}

@media (max-width:600px){
  .wrap{padding-left:16px;padding-right:16px}
  h1{font-size:38px}
  .island{transform:scale(.8)}
  .word-grid{padding:14px}
  .level-head{padding:14px 16px}
  .cell{width:48px;height:48px;font-size:36px}
}
@media print{
  .topnav,.actions,.hero-side,.switch-grade,.lv-index,.btn-sm,.say,.cta-foot,.camp-tag{display:none!important}
  body{background:#fff}.hero{background:#fff}.hero .waves{display:none}
  .level{break-inside:auto}.word{break-inside:avoid}
}
`

const GA = `<!-- Google tag (gtag.js) — G-SDETN3W1KN. Loaded only on the live site so local dev and
     previews don't pollute the data. Keep in sync with index.html. -->
<script>
  if (/(^|\\.)xiaohua\\.study$/.test(location.hostname)) {
    var gaTag = document.createElement('script')
    gaTag.async = true
    gaTag.src = 'https://www.googletagmanager.com/gtag/js?id=G-SDETN3W1KN'
    document.head.appendChild(gaTag)
    window.dataLayer = window.dataLayer || []
    window.gtag = function () { dataLayer.push(arguments) }
    gtag('js', new Date())
    gtag('config', 'G-SDETN3W1KN')
  }
</script>`

const SPEAKER = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1B1B26" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z" fill="#1B1B26"></path><path d="M16 9a4 4 0 0 1 0 6"></path></svg>`
const ARROW = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>`
const CHEVRON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1B1B26" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg>`
const FLAG = `<svg class="flag" width="40" height="70" viewBox="0 0 40 70" aria-hidden="true"><path d="M6 66V6" stroke="#1B1B26" stroke-width="4" stroke-linecap="round"></path><path d="M8 8h26l-7 10 7 10H8z" fill="#E4573D" stroke="#1B1B26" stroke-width="3" stroke-linejoin="round"></path></svg>`
const WAVES = `<svg class="waves" aria-hidden="true"><path d="M40 80 q20 -10 40 0 t40 0" stroke="#FFFFFF" stroke-width="3" fill="none" opacity="0.6" stroke-linecap="round"></path><path d="M520 400 q20 -10 40 0 t40 0" stroke="#FFFFFF" stroke-width="3" fill="none" opacity="0.6" stroke-linecap="round"></path><path d="M180 360 q20 -10 40 0 t40 0" stroke="#FFFFFF" stroke-width="3" fill="none" opacity="0.6" stroke-linecap="round"></path><path d="M900 60 q20 -10 40 0 t40 0" stroke="#FFFFFF" stroke-width="3" fill="none" opacity="0.6" stroke-linecap="round"></path></svg>`
const MOMO = mascotSvg({ width: 64 })

// Reads the same localStorage keys as src/lib/storage.js + account.js (guest or the
// remembered child profile) and decorates the static page. Also plays word clips.
const SCRIPT = `
(function () {
  function read(k, f) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : f } catch (e) { return f } }
  var id = null
  try { id = localStorage.getItem('xhw.activeProfile') } catch (e) {}
  function key(name, guest) { return id ? 'xhw.p.' + id + '.' + name : guest }
  var levels = read(key('levels', 'xhw.levels.v1'), {})
  var mistakes = read(key('mistakes', 'xhw.mistakes.v1'), {})
  var seen = read(key('seen', 'xhw.seen.v1'), {})
  var EN = document.documentElement.classList.contains('lang-en')
  var grade = document.body.getAttribute('data-grade')
  if (grade) {
    var saved = levels[grade] || {}
    document.querySelectorAll('[data-level]').forEach(function (el) {
      var n = el.getAttribute('data-level'), s = saved[n], stars = s ? s.stars : 0
      el.querySelectorAll('[data-stars] span').forEach(function (sp, i) { if (i < stars) sp.className = 'on' })
      var st = el.querySelector('[data-stars]'); if (st) st.setAttribute('aria-label', EN ? (stars ? stars + ' stars' : 'No stars yet') : (stars ? stars + ' 颗星' : '还没有星星'))
      var meta = el.querySelector('[data-meta]')
      if (meta) meta.textContent = EN ? meta.getAttribute('data-count') + ' words · ' + (stars ? 'Cleared' : 'Not started') : meta.getAttribute('data-count') + ' 个词 · ' + (stars ? '已过关' : '还没开始')
    })
    document.querySelectorAll('[data-dot]').forEach(function (el) { if ((saved[el.getAttribute('data-dot')] || {}).stars) el.classList.add('passed') })
    var learned = 0
    document.querySelectorAll('[data-word]').forEach(function (el) {
      var w = el.getAttribute('data-word')
      if (mistakes[w]) el.querySelector('.camp-tag').hidden = false
      else if (seen[w]) learned++
    })
    var l = document.querySelector('[data-learned]'); if (l) l.textContent = learned
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-say]'); if (!b) return
    var w = b.getAttribute('data-say')
    if (window.gtag) gtag('event', 'word_listen', { grade: document.body.dataset.grade || '(all)' })
    function fallback() { try { var u = new SpeechSynthesisUtterance(w); u.lang = 'zh-CN'; u.rate = 0.8; speechSynthesis.cancel(); speechSynthesis.speak(u) } catch (_) {} }
    try { var a = new Audio('/audio/w/' + encodeURIComponent(w) + '.mp3'); a.play().catch(fallback) } catch (_) { fallback() }
  })
})()
`

// word counts for the footer's grade islands; set by renderSeoPages before rendering
let COUNTS = {}

/** Site footer — same as the app's Footer.jsx (designer's 页脚). */
function footer() {
  return `<footer class="site-foot">
<section class="foot-lists"><div class="foot-wrap">
<div class="foot-lists-head"><h2>${L('按年级看词语表', 'Word lists by grade')}</h2><span>${L('每个词附拼音、英文意思和考卷例句', 'Every word with pinyin, English meaning and an exam example sentence')}</span></div>
<div class="foot-islands">${LEVELS.map((g) => `<a class="foot-island" href="/words/${g.toLowerCase()}/"><span class="g">${g}</span><b>${L('华文听写词语表', 'Chinese spelling list')}</b><small>${L(`${COUNTS[g] || 0} 词`, `${COUNTS[g] || 0} words`)}</small></a>`).join('')}</div>
</div></section>
<div class="foot-wrap foot-main">
<div class="foot-about">
<div class="foot-brand"><span class="logo">写</span><span class="n">${L('小华听写', 'Xiaohua')}</span>${mascotSvg({ width: 50, className: "mascot" })}</div>
<p class="zh-only">小华听写是给新加坡小学生的华文听写练习：听读音、看拼音，在田字格里把整个词写出来，写完逐个字检查笔画、笔顺和方向。词语整理自 P1–P6 华文考卷里最常出现的词。</p>
<p class="en" lang="en">Xiaohua (小华听写) is free Chinese tingxie (听写, spelling) practice for Singapore primary school students — handwrite each word and get stroke-by-stroke feedback.</p>
<p class="credit">${L('词语整理自新加坡小学华文考卷（2019–2025）· 英文释义来自 CC-CEDICT（CC BY-SA 4.0）', 'Words from Singapore primary school Chinese exam papers (2019–2025) · English meanings from CC-CEDICT (CC BY-SA 4.0)')}</p>
</div>
<div class="foot-more">
<div class="foot-kicker">${L('我们的其他作品', 'More from us')}</div>
<a class="foot-card" href="https://sgexamhub.com" target="_blank" rel="noopener"><span class="foot-card-icon" style="background:#FFE08A"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#1B1B26" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h8l4 4v14H7z" fill="#FFFFFF"/><path d="M15 3v4h4"/><path d="M10 11h6M10 14h6M10 17h4"/><path d="M4 6v15h12"/></svg></span><span class="foot-card-text"><b>SGExamHub</b><span>${L('新加坡小学考卷资源平台', 'Singapore primary school exam papers')}</span><i>sgexamhub.com</i></span><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1B1B26" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-label="在新窗口打开" role="img"><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v6H4V6h6"/></svg></a>
<a class="foot-card" href="https://dreamon.im/xiaohua" target="_blank" rel="noopener"><span class="foot-card-icon" style="background:#8ED6D0"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#1B1B26" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="2.5" width="12" height="19" rx="3" fill="#FFFFFF"/><path d="M10.5 18.5h3"/><path d="M9.5 8.5l2 2 3.5-4"/></svg></span><span class="foot-card-text"><b>${L('小华 App', 'Xiaohua App')}</b><span>${L('拍照识字：扫一扫就有拼音、笔顺动画和练习', 'Snap a photo of Chinese text to get pinyin, stroke animations and practice')}</span><i>dreamon.im/xiaohua</i></span><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1B1B26" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-label="在新窗口打开" role="img"><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v6H4V6h6"/></svg></a>
</div>
</div>
</footer>`
}

function page({ url, title, description, body, jsonld, grade = '' }) {
  return `<!doctype html>
<html lang="zh-Hans">
<head>
<meta charset="UTF-8" />
${LANG_BOOT}
${GA}
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<link rel="canonical" href="${SITE}${url}" />
<meta name="theme-color" content="#2B2B3A" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="小华听写 Xiaohua" />
<meta property="og:locale" content="zh_SG" />
<meta property="og:url" content="${SITE}${url}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:image" content="${SITE}/og.png" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%23e4573d'/><text x='50' y='72' font-size='64' text-anchor='middle' fill='white'>写</text></svg>" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600&family=Noto+Sans+SC:wght@400;500;700;900&family=ZCOOL+KuaiLe&display=swap" rel="stylesheet" />
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
<style>${CSS}</style>
</head>
<body data-grade="${grade}">
<nav class="topnav" aria-label="小华听写">
<div class="wrap">
<a class="brand" href="/"><span class="logo">写</span><span class="brand-name">${L('小华听写', 'Xiaohua')}</span></a>
<span class="navlinks">
<a class="navlink" href="/">${L('汉字岛地图', 'Island map')}</a>
<a class="navlink" href="/words/"${url === '/words/' ? ' aria-current="page"' : ' aria-current="true"'}>${L('词语表', 'Word lists')}</a>
<a class="navlink" href="/?go=review">${L('复习营地', 'Review Camp')}</a>
</span>
<span class="sp"></span>
<span class="lang-switch" role="group" aria-label="Language / 语言"><button type="button" data-l="zh" onclick="setLang('zh')" lang="zh-Hans">中文</button><button type="button" data-l="en" onclick="setLang('en')" lang="en">EN</button></span>
<span class="acct" id="acct"><a class="login-btn" href="/?go=login"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1B1B26" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg><span class="login-full">${L('登录 / 注册', 'Log in / Sign up')}</span><span class="login-short">${L('登录', 'Log in')}</span></a></span>
</div>
</nav>
${body}
${footer()}
<script>${SCRIPT}</script>
<script>
fetch('/api/me', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null }).then(function (me) {
  if (!me || !me.profiles) return
  var id = null
  try { id = localStorage.getItem('xhw.activeProfile') } catch (e) {}
  var p = me.profiles.filter(function (x) { return x.id === id })[0] || me.profiles[0]
  var el = document.getElementById('acct')
  if (!el) return
  var a = document.createElement('a')
  a.className = 'me-btn'
  a.href = '/'
  a.textContent = p ? p.avatar + ' ' + p.name + ' ' : (document.documentElement.classList.contains('lang-en') ? '+ Add a child' : '＋ 添加孩子')
  if (p) { var s = document.createElement('small'); s.textContent = p.grade; a.appendChild(s) }
  el.replaceChildren(a)
}).catch(function () {})
</script>
</body>
</html>
`
}

const crumbs = (items) =>
  `<nav class="crumbs" aria-label="位置">${items
    .map(([href, label]) => {
      const text = Array.isArray(label) ? L(esc(label[0]), esc(label[1])) : esc(label)
      return href ? `<a href="${href}">${text}</a>` : `<span>${text}</span>`
    })
    .join('<span>›</span>')}</nav>`

const breadcrumbLd = (items) => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map(([href, label], i) => ({ '@type': 'ListItem', position: i + 1, name: Array.isArray(label) ? label[0] : label, ...(href ? { item: SITE + href } : {}) })),
})

const gradeSwitch = (current) =>
  `<nav class="switch-grade" aria-label="换一座岛"><b>${L('换一座岛：', 'Other islands:')}</b>${LEVELS.map(
    (l) => `<a class="grade-pill" href="/words/${l.toLowerCase()}/"${l === current ? ' aria-current="page"' : ''}>${l}</a>`,
  ).join('')}</nav>`

const wordCard = (w) => `<article class="word" data-word="${esc(w.word)}">
<span class="camp-tag" hidden>${L('在复习营地', 'In Review Camp')}</span>
<div class="word-l"><div class="cells">${[...w.word].map((c) => `<span class="cell">${esc(c)}</span>`).join('')}</div><span class="py">${esc(w.pinyin.join(' '))}</span></div>
<div class="word-r"><div class="gloss-row"><span class="gloss" lang="en">${esc(w.en || '')}</span><button class="say" type="button" data-say="${esc(w.word)}" aria-label="读「${esc(w.word)}」">${SPEAKER}</button></div>${
  w.example ? `\n<p class="ex">${filled(w)}</p>` : ''
}</div>
</article>`

/** words: the app's src/data/words.json. Returns { pages: Map<url, html>, sitemap, robots, urls }. */
export function renderSeoPages(words) {
  const today = new Date().toISOString().slice(0, 10)
  const byLevel = Object.fromEntries(LEVELS.map((l) => [l, words.filter((w) => w.grade === l)]))
  COUNTS = Object.fromEntries(LEVELS.map((l) => [l, byLevel[l].length]))
  const out = []
  const files = new Map()

  // ---- one page per grade ----------------------------------------------------
  for (const level of LEVELS) {
    const list = byLevel[level]
    const parts = split(list)
    const url = `/words/${level.toLowerCase()}/`
    const sample = list.slice(0, 8).map((w) => w.word).join('、')
    const source =
      level === 'P1'
        ? '一年级还没有考卷数据，这份词表收录了一年级最基础的常用词（家人、学校、身体、颜色、动物、天气等）。'
        : `这份词表整理自新加坡小学${GRADE_CN[level]}华文考卷：一个词在${GRADE_CN[level]}考卷里经常出现、在更低年级还不常见，就收进这个年级。`
    const crumbItems = [['/', ['小华听写', 'Xiaohua']], ['/words/', ['词语表', 'Word lists']], [null, [`${level} 华文听写词语`, `${level} spelling words`]]]
    const start = `/?start=${level}`
    const body = `<header class="hero">${WAVES}
<div class="wrap hero-in">
<div class="hero-text">
${crumbs(crumbItems)}
<h1>${L(`${level} 华文听写词语表`, `${level} Chinese Spelling List`)}</h1>
<p class="lead zh-only">${list.length} 个词，分成 ${parts.length} 关，每个词附汉语拼音、英文意思和考卷里的例句。${source}</p>
<p class="lead-en" lang="en">${level} Chinese spelling (听写) word list for Singapore primary school — ${list.length} words with hanyu pinyin, English meaning and an example sentence from past exam papers.</p>
<div class="actions"><a class="btn red" href="${start}">${L(`开始 ${level} 听写`, `Start ${level} dictation`)} ${ARROW}</a><a class="btn" href="/">${L('回到地图选关', 'Pick a level on the map')}</a></div>
</div>
<div class="hero-side" aria-hidden="true">
<div class="island"><div class="island-body"><span class="display">${level}</span><small>${L(`${GRADE_CN[level]}岛`, GRADE_EN[level])}</small></div>${FLAG}</div>
<div class="stats">
<div class="stat"><span class="display">${list.length}</span><small>${L('个词', 'words')}</small></div>
<div class="stat"><span class="display">${parts.length}</span><small>${L('关', 'levels')}</small></div>
<div class="stat"><span class="display" data-learned>0</span><small>${L('已学会', 'learned')}</small></div>
</div>
</div>
</div>
</header>
<main class="wrap main">
${gradeSwitch(level)}
<section class="lv-index" aria-label="全部关卡">
<h2 class="section-title">${L('全部关卡', 'All levels')}</h2>
<div class="lv-grid">${parts
      .map(
        (p, i) =>
          `<a class="lv-card" href="#level-${i + 1}"><span class="lv-dot" data-dot="${i + 1}">${i + 1}</span><span class="lv-card-text"><b>${L(`第 ${i + 1} 关`, `Level ${i + 1}`)}</b><small>${L(`${p.length} 个词`, `${p.length} words`)}</small></span>${CHEVRON}</a>`,
      )
      .join('')}</div>
</section>
${parts
  .map(
    (p, i) => `<section class="level" id="level-${i + 1}" data-level="${i + 1}" aria-label="第 ${i + 1} 关">
<div class="level-head">
<span class="lv-num display">${i + 1}</span>
<span class="lv-title"><span class="display">${L(`第 ${i + 1} 关`, `Level ${i + 1}`)}</span><span class="lv-meta" data-meta data-count="${p.length}">${L(`${p.length} 个词 · 还没开始`, `${p.length} words · Not started`)}</span></span>
<span class="sp"></span>
<span class="stars" data-stars aria-label="还没有星星"><span>★</span><span>★</span><span>★</span></span>
<a class="btn-sm" href="${start}&amp;level=${i + 1}">${L('闯这一关', 'Play this level')}</a>
</div>
<div class="word-grid">
${p.map(wordCard).join('\n')}
</div>
</section>`,
  )
  .join('\n')}
<aside class="cta-foot">
${MOMO}
<div class="cta-foot-text"><span class="display">${L('看完了？来写一写吧！', 'Ready? Time to write!')}</span><small>${L('在格子里手写，自动看笔顺打分，写错的词会进复习营地。', 'Write by hand in the boxes, get scored on stroke order, and mistakes go to Review Camp.')}</small></div>
<a class="btn-orange" href="${start}">${L(`开始 ${level} 听写`, `Start ${level} dictation`)}</a>
</aside>
</main>`
    const html = page({
      url,
      grade: level,
      title: `${level} 华文听写词语表（${list.length} 个）· 拼音 · 英文 | ${level} Chinese Tingxie List – 小华听写`,
      description: `新加坡小学${GRADE_CN[level]}（${level}）华文听写词语 ${list.length} 个，附拼音、英文和考卷例句：${sample}…… 可在线手写练习，逐笔检查笔顺。`,
      body,
      jsonld: {
        '@context': 'https://schema.org',
        '@graph': [
          breadcrumbLd(crumbItems),
          {
            '@type': 'LearningResource',
            name: `${level} 华文听写词语表`,
            url: SITE + url,
            inLanguage: 'zh-Hans',
            educationalLevel: `Primary ${level.slice(1)}`,
            learningResourceType: 'Vocabulary list',
            teaches: 'Chinese vocabulary and handwriting',
            isAccessibleForFree: true,
            numberOfItems: list.length,
          },
        ],
      },
    })
    files.set(url, html)
    out.push(url)
  }

  // ---- overview ----------------------------------------------------------------
  {
    const url = '/words/'
    const crumbItems = [['/', ['小华听写', 'Xiaohua']], [null, ['词语表', 'Word lists']]]
    const body = `<header class="hero">${WAVES}
<div class="wrap hero-in">
<div class="hero-text">
${crumbs(crumbItems)}
<h1>${L('华文听写词语表 P1–P6', 'Chinese Spelling Lists P1–P6')}</h1>
<p class="lead zh-only">新加坡小学 P1–P6 华文听写常用词，一共 ${words.length} 个。每个年级是一座岛，岛上的词分成一关一关，每个词都附拼音、英文意思和考卷例句，可以打印，也可以直接在线手写练习。</p>
<p class="lead-en" lang="en">Singapore primary school Chinese spelling word lists, P1 to P6 — ${words.length} words drawn from past exam papers.</p>
<div class="actions"><a class="btn red" href="/">${L('开始听写练习', 'Start practising')} ${ARROW}</a></div>
</div>
</div>
</header>
<main class="wrap main">
<section aria-label="选一座岛">
<div class="islands">${LEVELS.map(
      (l) =>
        `<a class="island-card" href="/words/${l.toLowerCase()}/"><div class="island" aria-hidden="true"><div class="island-body"><span class="display">${l}</span><small>${L(`${GRADE_CN[l]}岛`, GRADE_EN[l])}</small></div>${FLAG}</div><span class="island-meta">${GRADE_CN[l]} · ${byLevel[l].length} 个词 · ${split(byLevel[l]).length} 关</span><span class="island-sample">${esc(byLevel[l].slice(0, 6).map((w) => w.word).join('、'))}……</span></a>`,
    ).join('')}</div>
</section>
<aside class="cta-foot">
${MOMO}
<div class="cta-foot-text"><span class="display">${L('选好岛了吗？来写一写吧！', 'Picked an island? Time to write!')}</span><small>${L('在格子里手写，自动看笔顺打分，写错的词会进复习营地。', 'Write by hand in the boxes, get scored on stroke order, and mistakes go to Review Camp.')}</small></div>
<a class="btn-orange" href="/">${L('开始听写', 'Start dictation')}</a>
</aside>
</main>`
    files.set(
      url,
      page({
        url,
        title: '新加坡小学华文听写词语表 P1–P6 | Chinese Tingxie Lists – 小华听写',
        description: `新加坡小学 P1 到 P6 华文听写常用词 ${words.length} 个，按年级整理，附拼音、英文和考卷例句，可打印、可在线手写练习。`,
        body,
        jsonld: { '@context': 'https://schema.org', '@graph': [breadcrumbLd(crumbItems)] },
      }),
    )
    out.unshift(url)
  }

  // ---- sitemap + robots ------------------------------------------------------------
  const urls = ['/', ...out]
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE}${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`
  const robots = `User-agent: *\nAllow: /\nDisallow: /audio/\n\nSitemap: ${SITE}/sitemap.xml\n`
  return { pages: files, sitemap, robots, urls }
}
