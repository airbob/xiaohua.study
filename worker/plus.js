// Plus features: a parent's custom word lists, and the per-child learning report.
import { now, DAY, json, readJson, HttpError } from './util.js'
import { isPlus } from './billing.js'

const MAX_LISTS = 50
const MAX_WORDS = 60
const CJK = /^[㐀-鿿]{1,8}$/

function plusOnly(user) {
  if (!isPlus(user)) throw new HttpError(402, 'plus_required')
}

function cleanList(body) {
  const name = String(body.name || '').trim().slice(0, 40)
  if (!name) throw new HttpError(400, 'name_required')
  const raw = Array.isArray(body.words) ? body.words : []
  const words = [...new Set(raw.map((w) => String(w).trim()).filter(Boolean))]
  if (!words.length) throw new HttpError(400, 'no_words')
  if (words.length > MAX_WORDS) throw new HttpError(400, 'too_many_words')
  const bad = words.find((w) => !CJK.test(w))
  if (bad) throw new HttpError(400, 'bad_word')
  return { name, words }
}

const publicList = (r) => ({ id: r.id, name: r.name, words: JSON.parse(r.words), updatedAt: r.updated_at })

/** Lists of this family — children read their parent's lists. */
export async function getLists(env, user) {
  plusOnly(user)
  const { results } = await env.DB.prepare('SELECT * FROM word_lists WHERE user_id = ? ORDER BY updated_at DESC').bind(user.id).all()
  return json({ lists: results.map(publicList) })
}

export async function createList(request, env, user) {
  plusOnly(user)
  if (user.childId) throw new HttpError(403, 'parent_only')
  const body = cleanList(await readJson(request, 20_000))
  const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM word_lists WHERE user_id = ?').bind(user.id).first()
  if (n >= MAX_LISTS) throw new HttpError(400, 'too_many_lists')
  const t = now()
  const row = { id: crypto.randomUUID(), user_id: user.id, name: body.name, words: JSON.stringify(body.words), updated_at: t }
  await env.DB.prepare('INSERT INTO word_lists (id, user_id, name, words, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(row.id, user.id, row.name, row.words, t, t)
    .run()
  return json({ list: publicList(row) }, 201)
}

async function ownList(env, user, id) {
  const row = await env.DB.prepare('SELECT * FROM word_lists WHERE id = ? AND user_id = ?').bind(id, user.id).first()
  if (!row) throw new HttpError(404, 'list_not_found')
  return row
}

export async function updateList(request, env, user, id) {
  plusOnly(user)
  if (user.childId) throw new HttpError(403, 'parent_only')
  await ownList(env, user, id)
  const body = cleanList(await readJson(request, 20_000))
  const t = now()
  await env.DB.prepare('UPDATE word_lists SET name = ?, words = ?, updated_at = ? WHERE id = ?').bind(body.name, JSON.stringify(body.words), t, id).run()
  return json({ list: { id, name: body.name, words: body.words, updatedAt: t } })
}

export async function deleteList(env, user, id) {
  if (user.childId) throw new HttpError(403, 'parent_only')
  await ownList(env, user, id)
  await env.DB.prepare('DELETE FROM word_lists WHERE id = ?').bind(id).run()
  return json({ ok: true })
}

// ---- report ---------------------------------------------------------------------------

const BAD = new Set(['wrong', 'order', 'skipped', 'blank'])

/**
 * One child's learning report: this week vs last, 8 weeks of totals, the last 7 days, the
 * characters most often written wrong, and recent sets. tz = the browser's getTimezoneOffset().
 */
export async function report(request, env, user, profileId) {
  plusOnly(user)
  if (user.childId) throw new HttpError(403, 'parent_only')
  const p = await env.DB.prepare('SELECT id, name, grade, avatar FROM profiles WHERE id = ? AND user_id = ?').bind(profileId, user.id).first()
  if (!p) throw new HttpError(404, 'profile_not_found')

  const tz = Math.max(-840, Math.min(840, Number(new URL(request.url).searchParams.get('tz')) || -480)) * 60_000
  // local midnight → epoch ms helpers (weeks start on Monday)
  const local = (t) => t - tz
  const dayStart = (t) => Math.floor(local(t) / DAY) * DAY + tz
  const weekStart = (t) => {
    const d = new Date(local(t))
    const dow = (d.getUTCDay() + 6) % 7 // Monday = 0
    return dayStart(t) - dow * DAY
  }
  const t0 = now()
  const thisWeek = weekStart(t0)
  const from = thisWeek - 7 * 7 * DAY

  const [attempts, sets, book, cleared, levels] = await Promise.all([
    env.DB.prepare('SELECT word, perfect, detail, created_at FROM attempts WHERE profile_id = ? AND created_at >= ?').bind(profileId, from).all(),
    env.DB.prepare('SELECT source, score, n, ms, created_at FROM sets WHERE profile_id = ? AND created_at >= ? ORDER BY created_at DESC').bind(profileId, from).all(),
    env.DB.prepare('SELECT COUNT(*) AS n FROM progress WHERE profile_id = ? AND in_book = 1').bind(profileId).first(),
    env.DB.prepare('SELECT COUNT(*) AS n FROM progress WHERE profile_id = ? AND cleared_at >= ?').bind(profileId, thisWeek).first(),
    env.DB.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(stars), 0) AS stars FROM levels WHERE profile_id = ?').bind(profileId).first(),
  ])

  const weeks = Array.from({ length: 8 }, (_, i) => ({ start: from + i * 7 * DAY, words: 0, correct: 0 }))
  const days = Array.from({ length: 7 }, (_, i) => ({ start: dayStart(t0) - (6 - i) * DAY, words: 0, correct: 0 }))
  const summary = () => ({ words: 0, correct: 0, days: new Set(), ms: 0, sets: 0 })
  const cur = summary()
  const prev = summary()
  const missed = new Map()

  for (const a of attempts.results) {
    const w = weeks[Math.floor((a.created_at - from) / (7 * DAY))]
    if (w) {
      w.words++
      if (a.perfect) w.correct++
    }
    const d = days.find((x) => a.created_at >= x.start && a.created_at < x.start + DAY)
    if (d) {
      d.words++
      if (a.perfect) d.correct++
    }
    const bucket = a.created_at >= thisWeek ? cur : a.created_at >= thisWeek - 7 * DAY ? prev : null
    if (bucket) {
      bucket.words++
      if (a.perfect) bucket.correct++
      bucket.days.add(dayStart(a.created_at))
    }
    if (!a.perfect && a.detail) {
      try {
        for (const c of JSON.parse(a.detail)) {
          if (!BAD.has(c.status)) continue
          const m = missed.get(c.char) || { char: c.char, count: 0, words: new Set() }
          m.count++
          m.words.add(a.word)
          missed.set(c.char, m)
        }
      } catch {
        /* old rows without detail */
      }
    }
  }
  for (const s of sets.results) {
    const bucket = s.created_at >= thisWeek ? cur : s.created_at >= thisWeek - 7 * DAY ? prev : null
    if (bucket) {
      bucket.sets++
      bucket.ms += s.ms || 0
    }
  }
  const out = (b) => ({ words: b.words, correct: b.correct, accuracy: b.words ? b.correct / b.words : null, days: b.days.size, minutes: Math.round(b.ms / 60_000), sets: b.sets })

  return json({
    profile: p,
    thisWeek: out(cur),
    lastWeek: out(prev),
    weeks,
    days,
    missed: [...missed.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 12)
      .map((m) => ({ char: m.char, count: m.count, words: [...m.words].slice(0, 4) })),
    camp: book.n,
    clearedThisWeek: cleared.n,
    levelsCleared: levels.n,
    stars: levels.stars,
    recent: sets.results.slice(0, 10).map((s) => ({ t: s.created_at, source: s.source, score: s.score, n: s.n, minutes: Math.round((s.ms || 0) / 60_000) })),
  })
}
