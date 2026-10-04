// Practice progress lives in localStorage, scoped to whoever is practising: the guest
// (signed out) or a child profile. For a profile it is a cache of the server copy;
// finished sets are queued in an outbox and posted to the API, retried until they land.
// Every access is guarded: storage can be unavailable (private mode, blocked site data).
import { api } from './api.js'

const KEY_PREFS = 'xhw.prefs.v1'
const KEY_OUTBOX = 'xhw.outbox.v1'
let scope = null // null = guest, otherwise a profile id

const GUEST_KEYS = { mistakes: 'xhw.mistakes.v1', seen: 'xhw.seen.v1', history: 'xhw.history.v1', levels: 'xhw.levels.v1', cleared: 'xhw.cleared.v1' }
const key = (name) => (scope ? `xhw.p.${scope}.${name}` : GUEST_KEYS[name])

function read(k, fallback) {
  try {
    const v = localStorage.getItem(k)
    return v ? JSON.parse(v) : fallback
  } catch {
    return fallback
  }
}
function write(k, value) {
  try {
    localStorage.setItem(k, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

export const setScope = (profileId) => {
  scope = profileId || null
}
export const getScope = () => scope

export const loadMistakes = () => read(key('mistakes'), {})
export const loadSeen = () => read(key('seen'), {})
export const loadHistory = () => read(key('history'), [])
/** { P3: { 4: { stars, correct, n } } } */
export const loadLevels = () => read(key('levels'), {})
/** Words that left the 错词本 recently: [{ word, t }] */
export const loadCleared = () => read(key('cleared'), [])
export const loadPrefs = () => read(KEY_PREFS, {})
export const savePrefs = (p) => write(KEY_PREFS, p)

/** The guest's data on this device, for merging into a profile on first sign-in. */
export const guestData = () => ({ mistakes: read(GUEST_KEYS.mistakes, {}), seen: read(GUEST_KEYS.seen, {}), levels: read(GUEST_KEYS.levels, {}) })
export const hasGuestData = () => Object.keys(read(GUEST_KEYS.seen, {})).length > 0

/** Replace a profile's local cache with the server copy. */
export function cacheProfile(profileId, { mistakes, seen, history, levels = {}, cleared = [] }) {
  const pending = read(KEY_OUTBOX, []).filter((s) => s.profileId === profileId)
  write(`xhw.p.${profileId}.mistakes`, mistakes)
  write(`xhw.p.${profileId}.seen`, seen)
  write(`xhw.p.${profileId}.history`, history)
  write(`xhw.p.${profileId}.levels`, levels)
  write(`xhw.p.${profileId}.cleared`, cleared)
  // sets not yet on the server still count locally
  const prev = scope
  scope = profileId
  for (const s of pending) applyLocally(s.results, s.score, s.source, s.at, s.level)
  scope = prev
}

function applyLocally(results, score, source, t, level) {
  const m = loadMistakes()
  const seen = loadSeen()
  const cleared = loadCleared().filter((c) => c.t > t - 8 * 86400_000)
  for (const r of results) {
    seen[r.word] = (seen[r.word] || 0) + 1
    if (!r.perfect) {
      const prev = m[r.word] || { count: 0 }
      m[r.word] = { count: prev.count + 1, streak: 0, last: t, bad: r.bad || '', note: r.note || '' }
    } else if (m[r.word]) {
      const streak = (m[r.word].streak || 0) + 1
      if (streak >= 2) {
        delete m[r.word]
        cleared.push({ word: r.word, t })
      } else m[r.word] = { ...m[r.word], streak, last: t }
    }
  }
  write(key('mistakes'), m)
  write(key('seen'), seen)
  write(key('cleared'), cleared)
  const h = loadHistory()
  h.unshift({ t, score, source, n: results.length })
  write(key('history'), h.slice(0, 50))
  if (level) {
    const lv = loadLevels()
    const prev = lv[level.grade]?.[level.level]
    if (!prev || level.stars > prev.stars || (level.stars === prev.stars && level.correct > prev.correct))
      (lv[level.grade] ||= {})[level.level] = { stars: level.stars, correct: level.correct, n: results.length }
    write(key('levels'), lv)
  }
}

/**
 * results: [{ word, perfect, score, detail, bad, note }]; level: { grade, level, stars, correct } for
 * an island level. A wrong word enters the 错词本; it leaves after being written perfectly twice
 * in a row (the server applies the same rule).
 */
export function recordSet(results, score, source, level = null) {
  const t = Date.now()
  applyLocally(results, score, source, t, level)
  if (!scope) return
  const outbox = read(KEY_OUTBOX, [])
  outbox.push({ id: crypto.randomUUID(), profileId: scope, results, score, source, at: t, level })
  write(KEY_OUTBOX, outbox.slice(-200))
  flushOutbox()
}

let flushing = false
export async function flushOutbox() {
  if (flushing) return
  flushing = true
  try {
    for (;;) {
      const outbox = read(KEY_OUTBOX, [])
      if (!outbox.length) break
      const s = outbox[0]
      try {
        await api(`/api/profiles/${s.profileId}/sets`, { method: 'POST', body: s })
      } catch (e) {
        // offline / signed out / server down: keep it and try again later;
        // a profile that no longer exists (or bad data) can never succeed, so drop it
        if (e.status !== 404 && e.status !== 400) break
      }
      write(KEY_OUTBOX, read(KEY_OUTBOX, []).filter((x) => x.id !== s.id))
    }
  } finally {
    flushing = false
  }
}

if (typeof window !== 'undefined') window.addEventListener('online', () => flushOutbox())

/** Words written today across all sets (drives 今日任务). */
export function wordsToday() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return loadHistory().filter((h) => h.t >= start.getTime()).reduce((n, h) => n + (h.n || 0), 0)
}
