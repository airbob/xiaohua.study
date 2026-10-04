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

const list = (a) => a.map((j) => j + 1).join('、')

/** Notes on what went wrong in one character, most important first. */
export function charNotes(r) {
  if (r.status === 'unavailable') return ['这个字暂时不能批改']
  if (r.skipped) return ['不会写，看看正确写法']
  if (r.status === 'blank') return ['没有写']
  const g = r.grade
  const notes = []
  // a missing stroke paired with an unrecognised one is really "this stroke is written wrong"
  const bad = Math.min(g.missing.length, g.extra.length)
  if (bad) notes.push(`第 ${list(g.missing.slice(0, bad))} 笔写得不对`)
  if (g.missing.length > bad) notes.push(`漏了第 ${list(g.missing.slice(bad))} 笔`)
  if (g.extra.length > bad) notes.push(`多写了 ${g.extra.length - bad} 笔`)
  for (const o of g.outOfOrder.slice(0, 3)) notes.push(`第 ${o.ref + 1} 笔笔顺不对（你第 ${o.user + 1} 下写的）`)
  if (g.backwards.length) notes.push(`第 ${list(g.backwards)} 笔方向反了`)
  if (r.hinted) notes.push('偷看了答案')
  return notes.length ? notes : ['全对']
}

export const STATUS_LABEL = { ok: '对', order: '笔顺错', wrong: '写错', blank: '没写', unavailable: '—' }

export function verdict(score) {
  if (score >= 95) return { stars: 3, text: '太棒了！' }
  if (score >= 80) return { stars: 3, text: '写得很好！' }
  if (score >= 60) return { stars: 2, text: '不错，继续加油！' }
  if (score >= 40) return { stars: 1, text: '多练几次就会了' }
  return { stars: 0, text: '别灰心，再来一次' }
}
