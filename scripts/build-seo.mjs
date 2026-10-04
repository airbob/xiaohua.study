#!/usr/bin/env node
// Runs after `vite build`: writes the static word-list pages (scripts/seo-pages.mjs),
// sitemap.xml and robots.txt into dist/.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderSeoPages } from './seo-pages.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')

const words = JSON.parse(await fs.readFile(path.join(ROOT, 'src/data/words.json'), 'utf8'))
const { pages, sitemap, robots, urls } = renderSeoPages(words)
for (const [url, html] of pages) {
  await fs.mkdir(path.join(DIST, url), { recursive: true })
  await fs.writeFile(path.join(DIST, url, 'index.html'), html)
}
await fs.writeFile(path.join(DIST, 'sitemap.xml'), sitemap)
await fs.writeFile(path.join(DIST, 'robots.txt'), robots)
console.log(`seo: ${pages.size} word-list pages, sitemap with ${urls.length} URLs`)
