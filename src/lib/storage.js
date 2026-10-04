// Local-only progress until accounts exist. Every access is guarded: storage can
// be unavailable (private mode, blocked site data) and the app must still work.
const KEY_MISTAKES = 'xhw.mistakes.v1'
const KEY_SEEN = 'xhw.seen.v1'
const KEY_PREFS = 'xhw.prefs.v1'
const KEY_HISTORY = 'xhw.history.v1'

function read(key, fallback) {
  try {
    const v = localStorage.getItem(key)
    return v ? JSON.parse(v) : fallback
  } catch {
    return fallback
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

export const loadMistakes = () => read(KEY_MISTAKES, {})
export const loadSeen = () => read(KEY_SEEN, {})
export const loadPrefs = () => read(KEY_PREFS, {})
export const savePrefs = (p) => write(KEY_PREFS, p)
export const loadHistory = () => read(KEY_HISTORY, [])

/**
 * results: [{ word, perfect }]. A wrong word enters the 错词本; it leaves after
 * being written perfectly twice in a row.
 */
export function recordSet(results, score, source) {
  const m = loadMistakes()
  const seen = loadSeen()
  const now = Date.now()
  for (const r of results) {
    seen[r.word] = (seen[r.word] || 0) + 1
    if (!r.perfect) {
      const prev = m[r.word] || { count: 0 }
      m[r.word] = { count: prev.count + 1, streak: 0, last: now }
    } else if (m[r.word]) {
      const streak = (m[r.word].streak || 0) + 1
      if (streak >= 2) delete m[r.word]
      else m[r.word] = { ...m[r.word], streak, last: now }
    }
  }
  write(KEY_MISTAKES, m)
  write(KEY_SEEN, seen)
  const h = loadHistory()
  h.unshift({ t: now, score, source, n: results.length })
  write(KEY_HISTORY, h.slice(0, 50))
}
