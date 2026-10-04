#!/usr/bin/env node
// Runs after `vite build`: writes static, crawlable pages into dist/ —
//   /words/            overview of the word lists
//   /words/p1/ … /p6/  each level's full list (词语 · 拼音 · English · 例句)
//   /sitemap.xml, /robots.txt
// The app itself is a single page; these give search engines real content and
// give parents a printable list. Each page links into the app with /?start=P3.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')
const SITE = 'https://xiaohua.study'
const LEVELS = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6']
const GRADE_CN = { P1: '一年级', P2: '二年级', P3: '三年级', P4: '四年级', P5: '五年级', P6: '六年级' }
const today = new Date().toISOString().slice(0, 10)

const words = JSON.parse(await fs.readFile(path.join(ROOT, 'src/data/words.json'), 'utf8'))
const byLevel = Object.fromEntries(LEVELS.map((l) => [l, words.filter((w) => w.grade === l)]))

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const filled = (w) => esc(w.example.replace(/（[　 ]+）/, '\u0000')).replace('\u0000', `<b>${esc(w.word)}</b>`)

const CSS = `
:root{--paper:#fbf6ee;--card:#fff;--ink:#1f2a44;--muted:#6b6f7d;--line:#eadfd2;--red:#c8402f;--blue:#2c6e8f;--kai:'Kaiti SC','STKaiti','KaiTi','BiauKai','Noto Serif SC',serif}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:-apple-system,'PingFang SC','Hiragino Sans GB','Noto Sans SC','Microsoft YaHei',sans-serif;line-height:1.6}
main{max-width:860px;margin:0 auto;padding:16px 16px 48px}a{color:var(--blue)}
.crumbs{font-size:13px;color:var(--muted);margin:8px 0 16px}.crumbs a{color:var(--muted)}
h1{font-size:28px;margin:0 0 8px;font-family:var(--kai)}h2{font-size:18px;margin:28px 0 10px}
.lead{margin:0 0 16px}.en{color:var(--muted);font-size:14px}
.cta{display:inline-block;background:var(--red);color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px;margin:4px 8px 4px 0}
.cta.soft{background:var(--card);color:var(--ink);border:1px solid var(--line)}
.levels{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 4px;padding:0;list-style:none}
.levels a{display:block;padding:6px 14px;border-radius:999px;background:var(--card);border:1px solid var(--line);text-decoration:none;color:var(--ink)}
.levels a[aria-current]{background:var(--ink);color:#fff;border-color:var(--ink)}
.group{background:var(--card);border-radius:14px;padding:4px 14px;margin:12px 0;box-shadow:0 1px 2px rgba(31,42,68,.06)}
.group h2{font-size:14px;color:var(--muted);margin:10px 0 2px;font-weight:600}
table{width:100%;border-collapse:collapse}td{padding:8px 6px;border-top:1px solid var(--line);vertical-align:top}
tr:first-child td{border-top:none}.w{font-family:var(--kai);font-size:24px;white-space:nowrap;width:1%}
.py{color:var(--blue);white-space:nowrap;width:1%}.gl{color:var(--muted);font-size:13px}.ex{font-size:14px}.ex b{color:var(--red);font-weight:600}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;padding:0;list-style:none}
.cards a{display:block;background:var(--card);border-radius:14px;padding:14px 16px;text-decoration:none;color:var(--ink);box-shadow:0 1px 2px rgba(31,42,68,.06)}
.cards strong{font-size:22px}.cards span{display:block;color:var(--muted);font-size:13px}
footer{margin-top:32px;font-size:12px;color:var(--muted)}
@media (max-width:600px){.gl{display:none}.ex{display:none}td{padding:7px 4px}}
@media print{.cta,.levels,.crumbs,footer{display:none}body{background:#fff}.group{box-shadow:none;break-inside:avoid}}
`

function page({ url, title, description, body, jsonld }) {
  return `<!doctype html>
<html lang="zh-Hans">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<link rel="canonical" href="${SITE}${url}" />
<meta name="theme-color" content="#c8402f" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="写华文 xiaohua.study" />
<meta property="og:locale" content="zh_SG" />
<meta property="og:url" content="${SITE}${url}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:image" content="${SITE}/og.png" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%23c8402f'/><text x='50' y='72' font-size='64' text-anchor='middle' fill='white'>写</text></svg>" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
<style>${CSS}</style>
</head>
<body>
<main>
${body}
<footer>词语整理自新加坡小学华文考卷（2019–2025）。英文释义来自 CC-CEDICT（CC BY-SA 4.0）。 · <a href="/">xiaohua.study 写华文</a></footer>
</main>
</body>
</html>
`
}

const levelNav = (current) =>
  `<ul class="levels">${LEVELS.map((l) => `<li><a href="/words/${l.toLowerCase()}/"${l === current ? ' aria-current="page"' : ''}>${l}</a></li>`).join('')}</ul>`

const crumbs = (items) =>
  `<nav class="crumbs">${items.map(([href, label]) => (href ? `<a href="${href}">${esc(label)}</a>` : esc(label))).join(' › ')}</nav>`

const breadcrumbLd = (items) => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map(([href, label], i) => ({ '@type': 'ListItem', position: i + 1, name: label, ...(href ? { item: SITE + href } : {}) })),
})

const out = []

// ---- one page per level ----------------------------------------------------
for (const level of LEVELS) {
  const list = byLevel[level]
  const url = `/words/${level.toLowerCase()}/`
  const sample = list.slice(0, 8).map((w) => w.word).join('、')
  const source =
    level === 'P1'
      ? '一年级还没有考卷数据，这份词表收录了一年级最基础的常用词（家人、学校、身体、颜色、动物、天气等）。'
      : `这份词表整理自新加坡小学${GRADE_CN[level]}华文考卷：一个词在${GRADE_CN[level]}考卷里经常出现、在更低年级还不常见，就收进这个年级。`
  const groups = []
  for (let i = 0; i < list.length; i += 10) groups.push(list.slice(i, i + 10))
  const crumbItems = [['/', '写华文'], ['/words/', '词语表'], [null, `${level} 华文听写词语`]]
  const body = `${crumbs(crumbItems)}
<h1>${level} 华文听写词语表</h1>
<p class="lead">${list.length} 个词，每个词附汉语拼音、英文意思和考卷里的例句。${source}</p>
<p class="en">${level} Chinese spelling (听写) word list for Singapore primary school — ${list.length} words with hanyu pinyin, English meaning and an example sentence from past exam papers.</p>
<p><a class="cta" href="/?start=${level}">开始 ${level} 听写练习 →</a><a class="cta soft" href="/">选其他练习</a></p>
${levelNav(level)}
${groups
  .map(
    (g, gi) => `<section class="group"><h2>第 ${gi + 1} 组</h2><table>${g
      .map(
        (w) =>
          `<tr><td class="w">${esc(w.word)}</td><td class="py">${esc(w.pinyin.join(' '))}</td><td><div class="gl">${esc(w.en || '')}</div>${w.example ? `<div class="ex">${filled(w)}</div>` : ''}</td></tr>`,
      )
      .join('')}</table></section>`,
  )
  .join('\n')}
<p><a class="cta" href="/?start=${level}">开始 ${level} 听写练习 →</a></p>`
  const html = page({
    url,
    title: `${level} 华文听写词语表（${list.length} 个）· 拼音 · 英文 | ${level} Chinese Spelling List – 写华文`,
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
  await fs.mkdir(path.join(DIST, url), { recursive: true })
  await fs.writeFile(path.join(DIST, url, 'index.html'), html)
  out.push(url)
}

// ---- overview ----------------------------------------------------------------
{
  const url = '/words/'
  const crumbItems = [['/', '写华文'], [null, '词语表']]
  const body = `${crumbs(crumbItems)}
<h1>华文听写词语表 P1–P6</h1>
<p class="lead">新加坡小学 P1–P6 华文听写常用词，一共 ${words.length} 个。每个年级的词语都附拼音、英文意思和考卷例句，可以打印，也可以直接在线手写练习。</p>
<p class="en">Singapore primary school Chinese spelling word lists, P1 to P6 — ${words.length} words drawn from past exam papers.</p>
<ul class="cards">${LEVELS.map(
    (l) =>
      `<li><a href="/words/${l.toLowerCase()}/"><strong>${l}</strong><span>${GRADE_CN[l]} · ${byLevel[l].length} 个词</span><span>${esc(byLevel[l].slice(0, 6).map((w) => w.word).join('、'))}……</span></a></li>`,
  ).join('')}</ul>
<p><a class="cta" href="/">开始听写练习 →</a></p>`
  await fs.mkdir(path.join(DIST, url), { recursive: true })
  await fs.writeFile(
    path.join(DIST, url, 'index.html'),
    page({
      url,
      title: '新加坡小学华文听写词语表 P1–P6 | Chinese Spelling Lists – 写华文',
      description: `新加坡小学 P1 到 P6 华文听写常用词 ${words.length} 个，按年级整理，附拼音、英文和考卷例句，可打印、可在线手写练习。`,
      body,
      jsonld: { '@context': 'https://schema.org', '@graph': [breadcrumbLd(crumbItems)] },
    }),
  )
  out.unshift(url)
}

// ---- sitemap + robots ------------------------------------------------------------
const urls = ['/', ...out]
await fs.writeFile(
  path.join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE}${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`,
)
await fs.writeFile(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /audio/\n\nSitemap: ${SITE}/sitemap.xml\n`)
console.log(`seo: ${out.length} word-list pages, sitemap with ${urls.length} URLs`)
