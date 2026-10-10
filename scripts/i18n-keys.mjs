#!/usr/bin/env node
// Lists every Chinese UI string that goes through t() and checks src/i18n/en.js covers it.
//   node scripts/i18n-keys.mjs          → report missing / unused English entries (exit 1 if missing)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const files = []
const walk = (d) => {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f)
    if (fs.statSync(p).isDirectory()) walk(p)
    else if (/\.(jsx?|mjs)$/.test(f) && !p.includes('/i18n/') && !p.endsWith('lib/i18n.js')) files.push(p)
  }
}
walk(path.join(ROOT, 'src'))

const keys = new Set()
const has = (s) => /[一-鿿]/.test(s)
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8')
  // t('…'), T('…'), tIn(x, '…')
  for (const m of src.matchAll(/\b(?:t|T|tIn\([^,]+,)\s*\(?\s*'([^']+)'/g)) if (has(m[1])) keys.add(m[1])
  // strings that reach t() indirectly: tables of labels, tips, errors, notices, device names
  for (const block of src.matchAll(/(?:CHAR_LABEL|TIPS|LINKS|PERKS|ERRORS|LOGIN_ERRORS|STATUS_LABEL|FEATURES|REASONS|PRAISE)\s*=\s*([\[{][\s\S]*?\n[\]}])/g))
    for (const m of block[1].matchAll(/'([^']+)'/g)) if (has(m[1])) keys.add(m[1])
  for (const m of src.matchAll(/(?:showNotice|notice:)\s*\(?\s*'([^']+)'/g)) if (has(m[1])) keys.add(m[1])
  for (const m of src.matchAll(/LOGIN_ERRORS\[err\] \|\| '([^']+)'/g)) keys.add(m[1])
  // upgrade reasons passed to the Plus sheet, and notices chosen with a ternary
  for (const m of src.matchAll(/(?:onPlus\??\.?\(|plus: )'([^']+)'/g)) if (has(m[1])) keys.add(m[1])
  for (const line of src.split('\n')) if (/showNotice\(/.test(line)) for (const m of line.matchAll(/'([^']+)'/g)) if (has(m[1])) keys.add(m[1])
}
// reached indirectly: device labels from the Worker (worker/auth.js deviceLabel), the stored
// 复习营地 note '听写时没写出来' (noteText), the list joiner and the generic API error
for (const d of ['Android 手机', 'Android 平板', 'Windows 电脑', '浏览器', '听写时没写出来', '，', '出错了，请再试一次']) keys.add(d)

const EN = (await import(path.join(ROOT, 'src/i18n/en.js'))).default
const missing = [...keys].filter((k) => !(k in EN))
const unused = Object.keys(EN).filter((k) => !keys.has(k))
if (process.argv.includes('--list')) for (const k of keys) console.log(k)
console.log(`${keys.size} keys · ${missing.length} missing · ${unused.length} unused in en.js`)
for (const k of missing) console.log('  MISSING', k)
for (const k of unused) console.log('  unused ', k)
process.exit(missing.length ? 1 : 0)
