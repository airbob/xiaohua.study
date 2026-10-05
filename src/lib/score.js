import { getLang, tIn } from './i18n.js'
// Per-character result from Practice:
//   { char, status: 'ok'|'order'|'wrong'|'blank'|'unavailable', hinted, skipped, grade, strokes }
// where grade is the gradeChar() output. Scoring:
//   ok = 1 · right shape, wrong order/direction = 0.6 · wrong = half credit for the
//   strokes that matched · blank / gave up = 0 · peeking caps it at 0.5.
// Characters without stroke data are left out of the score.
export function charScore(r) {
  if (r.status === 'unavailable') return null
  if (r.skipped || r.status === 'blank') return 0
  let s = 1
  if (r.status === 'order') s = 0.6
  if (r.status === 'wrong') {
    const g = r.grade
    s = (0.5 * Math.max(0, g.matched - g.extra.length)) / g.refCount
  }
  if (r.hinted) s = Math.min(s, 0.5)
  return s
}

export function wordScore(chars) {
  const s = chars.map(charScore).filter((x) => x !== null)
  return s.length ? s.reduce((a, b) => a + b, 0) / s.length : 1
}

export const isPerfect = (chars) => chars.every((c) => c.status === 'unavailable' || (c.status === 'ok' && !c.hinted && !c.skipped))

export function setScore(words) {
  if (!words.length) return 0
  return Math.round((words.reduce((a, w) => a + wordScore(w.chars), 0) / words.length) * 100)
}

const list = (a, l) => a.map((j) => j + 1).join(l === 'en' ? ', ' : '、')

/**
 * Notes on what went wrong in one character, most important first. lang defaults to the
 * interface language; the 复习营地 note is always stored in Chinese (see noteText).
 */
export function charNotes(r, l = getLang()) {
  const T = (zh, vars) => tIn(l, zh, vars)
  if (r.status === 'unavailable') return [T('这个字暂时不能批改')]
  if (r.skipped) return [T('不会写，看看正确写法')]
  if (r.status === 'blank') return [T('没有写')]
  const g = r.grade
  const notes = []
  // a missing stroke paired with an unrecognised one is really "this stroke is written wrong"
  const bad = Math.min(g.missing.length, g.extra.length)
  if (bad) notes.push(T('第 {n} 笔写得不对', { n: list(g.missing.slice(0, bad), l) }))
  if (g.missing.length > bad) notes.push(T('漏了第 {n} 笔', { n: list(g.missing.slice(bad), l) }))
  if (g.extra.length > bad) notes.push(T('多写了 {n} 笔', { n: g.extra.length - bad }))
  for (const o of g.outOfOrder.slice(0, 3)) notes.push(T('第 {n} 笔笔顺不对（你第 {m} 下写的）', { n: o.ref + 1, m: o.user + 1 }))
  if (g.backwards.length) notes.push(T('第 {n} 笔方向反了', { n: list(g.backwards, l) }))
  if (r.hinted) notes.push(T('偷看了答案'))
  return notes.length ? notes : [T('全对')]
}

// Chinese note templates, so a stored note can be shown in the interface language.
const NOTE_PATTERNS = [
  [/^第 ([\d、]+) 笔写得不对$/, '第 {n} 笔写得不对', ['n']],
  [/^漏了第 ([\d、]+) 笔$/, '漏了第 {n} 笔', ['n']],
  [/^多写了 (\d+) 笔$/, '多写了 {n} 笔', ['n']],
  [/^第 (\d+) 笔笔顺不对（你第 (\d+) 下写的）$/, '第 {n} 笔笔顺不对（你第 {m} 下写的）', ['n', 'm']],
  [/^第 ([\d、]+) 笔方向反了$/, '第 {n} 笔方向反了', ['n']],
]

/** A stored (Chinese) 复习营地 note, e.g. 「成」第 4 笔方向反了, in the interface language. */
export function noteText(zh) {
  const l = getLang()
  if (l === 'zh' || !zh) return zh
  const m = zh.match(/^「(.+?)」(.*)$/)
  const head = m ? `「${m[1]}」` : ''
  const body = m ? m[2] : zh
  for (const [re, tpl, keys] of NOTE_PATTERNS) {
    const mm = body.match(re)
    if (mm) {
      const vars = Object.fromEntries(keys.map((k, i) => [k, mm[i + 1].replace(/、/g, ', ')]))
      return head + tIn(l, tpl, vars)
    }
  }
  return head + tIn(l, body)
}

export const STATUS_LABEL = { ok: '对', order: '笔顺错', wrong: '写错', blank: '没写', unavailable: '—' }

export function verdict(score) {
  // text is a Chinese key — show it with t()
  if (score >= 95) return { stars: 3, text: '太棒了！' }
  if (score >= 80) return { stars: 3, text: '写得很好！' }
  if (score >= 60) return { stars: 2, text: '不错，继续加油！' }
  if (score >= 40) return { stars: 1, text: '多练几次就会了' }
  return { stars: 0, text: '别灰心，再来一次' }
}
