// Child profiles and their practice progress. Every handler gets the signed-in parent.
import { now, json, readJson, HttpError } from './util.js'
import { pinHash, startSession, endCurrentSession } from './auth.js'

const GRADES = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6']
const AVATARS = ['🐼', '🐯', '🐰', '🐨', '🦊', '🐸', '🐧', '🦁', '🐳', '🦄']
const MAX_PROFILES = 6
const isWord = (w) => typeof w === 'string' && w.length >= 1 && w.length <= 8

function cleanProfile(body, partial = false) {
  const out = {}
  if (!partial || 'name' in body) {
    const name = String(body.name || '').trim().slice(0, 20)
    if (!name) throw new HttpError(400, 'name_required')
    out.name = name
  }
  if (!partial || 'grade' in body) {
    if (!GRADES.includes(body.grade)) throw new HttpError(400, 'bad_grade')
    out.grade = body.grade
  }
  if (!partial || 'avatar' in body) out.avatar = AVATARS.includes(body.avatar) ? body.avatar : AVATARS[0]
  return out
}

// A child session may only reach its own profile; parents reach all of theirs.
async function ownProfile(env, user, id) {
  if (user.childId && user.childId !== id) throw new HttpError(404, 'profile_not_found')
  const p = await env.DB.prepare('SELECT * FROM profiles WHERE id = ? AND user_id = ?').bind(id, user.id).first()
  if (!p) throw new HttpError(404, 'profile_not_found')
  return p
}

function parentOnly(user) {
  if (user.childId) throw new HttpError(403, 'parent_only')
}

const publicProfile = (p) => ({ id: p.id, name: p.name, grade: p.grade, avatar: p.avatar })

export async function me(env, user) {
  if (user.childId) {
    const p = await ownProfile(env, user, user.childId)
    return json({ child: true, user: { email: user.email }, profiles: [publicProfile(p)] })
  }
  const { results } = await env.DB.prepare(
    `SELECT p.*, (SELECT COUNT(*) FROM sessions s WHERE s.profile_id = p.id AND s.expires_at > ?) AS devices
       FROM profiles p WHERE p.user_id = ? ORDER BY p.created_at`,
  )
    .bind(now(), user.id)
    .all()
  return json({
    child: false,
    user: { email: user.email, name: user.name, plan: user.plan },
    profiles: results.map((p) => ({ ...publicProfile(p), hasPin: !!p.pin_hash, devices: p.devices })),
  })
}

const WEAK_PINS = new Set(['123456', '654321', '012345', '123123', '112233', '121212'])

/** Parent sets (or resets) a child's 6-digit PIN. PINs must differ between siblings. */
export async function setPin(request, env, user, id) {
  parentOnly(user)
  await ownProfile(env, user, id)
  const pin = String((await readJson(request, 500)).pin || '').trim()
  if (!/^\d{6}$/.test(pin)) throw new HttpError(400, 'bad_pin_format')
  if (/^(\d)\1{5}$/.test(pin) || WEAK_PINS.has(pin)) throw new HttpError(400, 'pin_too_simple')
  const { results: siblings } = await env.DB.prepare('SELECT id, pin_hash FROM profiles WHERE user_id = ? AND id != ? AND pin_hash IS NOT NULL')
    .bind(user.id, id)
    .all()
  for (const sib of siblings) if ((await pinHash(env, sib.id, pin)) === sib.pin_hash) throw new HttpError(400, 'pin_taken')
  await env.DB.prepare('UPDATE profiles SET pin_hash = ?, pin_set_at = ? WHERE id = ?').bind(await pinHash(env, id, pin), now(), id).run()
  return json({ ok: true })
}

/** Devices where this child is signed in. */
export async function listDevices(env, user, id) {
  parentOnly(user)
  await ownProfile(env, user, id)
  const { results } = await env.DB.prepare(
    'SELECT device, created_at, last_seen FROM sessions WHERE profile_id = ? AND expires_at > ? ORDER BY last_seen DESC',
  )
    .bind(id, now())
    .all()
  return json({ devices: results })
}

export async function revokeDevices(env, user, id) {
  parentOnly(user)
  await ownProfile(env, user, id)
  const { meta } = await env.DB.prepare('DELETE FROM sessions WHERE profile_id = ?').bind(id).run()
  return json({ ok: true, revoked: meta.changes })
}

/** Parent hands this device to a child: the parent session ends, a child session starts. */
export async function handover(request, env, user, id) {
  parentOnly(user)
  const p = await ownProfile(env, user, id)
  await endCurrentSession(request, env)
  const setCookie = await startSession(request, env, user.id, id)
  return json({ ok: true, profile: publicProfile(p) }, 200, { 'Set-Cookie': setCookie })
}

export async function createProfile(request, env, user) {
  parentOnly(user)
  const body = cleanProfile(await readJson(request, 2000))
  const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM profiles WHERE user_id = ?').bind(user.id).first()
  if (n >= MAX_PROFILES) throw new HttpError(400, 'too_many_profiles')
  const p = { id: crypto.randomUUID(), ...body }
  await env.DB.prepare('INSERT INTO profiles (id, user_id, name, grade, avatar, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(p.id, user.id, p.name, p.grade, p.avatar, now())
    .run()
  return json({ profile: p }, 201)
}

export async function updateProfile(request, env, user, id) {
  parentOnly(user)
  await ownProfile(env, user, id)
  const body = cleanProfile(await readJson(request, 2000), true)
  const keys = Object.keys(body)
  if (keys.length)
    await env.DB.prepare(`UPDATE profiles SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).bind(...keys.map((k) => body[k]), id).run()
  return json({ profile: publicProfile(await ownProfile(env, user, id)) })
}

export async function deleteProfile(env, user, id) {
  parentOnly(user)
  await ownProfile(env, user, id)
  await env.DB.batch(['attempts', 'sets', 'progress', 'sessions'].map((t) => env.DB.prepare(`DELETE FROM ${t} WHERE profile_id = ?`).bind(id)).concat(
    env.DB.prepare('DELETE FROM profiles WHERE id = ?').bind(id),
  ))
  return json({ ok: true })
}

/** 错词本 + how often each word has been seen (the app uses it to pick fresh words). */
export async function getProgress(env, user, id) {
  await ownProfile(env, user, id)
  const { results } = await env.DB.prepare('SELECT word, seen, wrong, streak, in_book, last_at FROM progress WHERE profile_id = ?').bind(id).all()
  const mistakes = {}
  const seen = {}
  for (const r of results) {
    seen[r.word] = r.seen
    if (r.in_book) mistakes[r.word] = { count: r.wrong, streak: r.streak, last: r.last_at }
  }
  const history = (
    await env.DB.prepare('SELECT created_at AS t, score, source, n FROM sets WHERE profile_id = ? ORDER BY created_at DESC LIMIT 50').bind(id).all()
  ).results
  return json({ mistakes, seen, history })
}

// A word enters the 错词本 when written imperfectly and leaves after two perfect writes in a row.
const UPSERT_PROGRESS = `
INSERT INTO progress (profile_id, word, seen, wrong, streak, in_book, last_at, due_at)
VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)
ON CONFLICT (profile_id, word) DO UPDATE SET
  seen    = seen + excluded.seen,
  wrong   = wrong + excluded.wrong,
  in_book = CASE WHEN excluded.wrong > 0 THEN 1
                 WHEN in_book = 1 AND streak + excluded.streak >= 2 THEN 0
                 ELSE in_book END,
  streak  = CASE WHEN excluded.wrong > 0 THEN 0 ELSE streak + excluded.streak END,
  last_at = excluded.last_at,
  due_at  = excluded.due_at`

/** One finished set of 10. Idempotent on the client-generated set id (the app retries when offline). */
export async function saveSet(request, env, user, id) {
  await ownProfile(env, user, id)
  const body = await readJson(request, 50_000)
  const setId = String(body.id || '')
  if (!/^[0-9a-f-]{36}$/.test(setId)) throw new HttpError(400, 'bad_set_id')
  const results = Array.isArray(body.results) ? body.results.filter((r) => isWord(r?.word)).slice(0, 20) : []
  if (!results.length) throw new HttpError(400, 'no_results')
  if (await env.DB.prepare('SELECT 1 FROM sets WHERE id = ?').bind(setId).first()) return json({ ok: true, duplicate: true })

  const t = Number.isFinite(body.at) ? Math.min(body.at, now()) : now()
  const score = Math.max(0, Math.min(100, Math.round(Number(body.score) || 0)))
  const stmts = [
    env.DB.prepare('INSERT INTO sets (id, profile_id, source, score, n, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(
      setId, id, String(body.source || '').slice(0, 20), score, results.length, t,
    ),
  ]
  for (const r of results) {
    const perfect = r.perfect ? 1 : 0
    stmts.push(
      env.DB.prepare('INSERT INTO attempts (set_id, profile_id, word, score, perfect, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(
        setId, id, r.word, Math.max(0, Math.min(100, Math.round(Number(r.score) || 0))), perfect,
        r.detail ? JSON.stringify(r.detail).slice(0, 2000) : null, t,
      ),
      env.DB.prepare(UPSERT_PROGRESS).bind(id, r.word, 1, perfect ? 0 : 1, perfect, perfect ? 0 : 1, t),
    )
  }
  await env.DB.batch(stmts)
  return json({ ok: true })
}

/** First sign-in on a device: fold that device's local 错词本 and seen-counts into the profile. */
export async function importLocal(request, env, user, id) {
  await ownProfile(env, user, id)
  const body = await readJson(request, 200_000)
  const mistakes = body.mistakes && typeof body.mistakes === 'object' ? body.mistakes : {}
  const seen = body.seen && typeof body.seen === 'object' ? body.seen : {}
  const words = [...new Set([...Object.keys(seen), ...Object.keys(mistakes)])].filter(isWord).slice(0, 3000)
  const stmts = words.map((w) => {
    const m = mistakes[w]
    const n = Math.max(0, Math.min(1000, Math.round(Number(seen[w]) || 0)))
    const last = Number.isFinite(m?.last) ? Math.min(m.last, now()) : now()
    // imported mistakes go straight into the book; plain seen-counts just add up
    return env.DB.prepare(
      `INSERT INTO progress (profile_id, word, seen, wrong, streak, in_book, last_at, due_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)
       ON CONFLICT (profile_id, word) DO UPDATE SET
         seen = seen + excluded.seen, wrong = wrong + excluded.wrong,
         in_book = MAX(in_book, excluded.in_book), last_at = MAX(COALESCE(last_at, 0), excluded.last_at)`,
    ).bind(id, w, n, m ? Math.max(1, Math.round(Number(m.count) || 1)) : 0, m ? Math.round(Number(m.streak) || 0) : 0, m ? 1 : 0, last)
  })
  for (let i = 0; i < stmts.length; i += 100) await env.DB.batch(stmts.slice(i, i + 100))
  return json({ ok: true, imported: words.length })
}

export async function deleteAccount(env, user) {
  parentOnly(user)
  const ids = (await env.DB.prepare('SELECT id FROM profiles WHERE user_id = ?').bind(user.id).all()).results.map((r) => r.id)
  const stmts = []
  for (const pid of ids) for (const t of ['attempts', 'sets', 'progress']) stmts.push(env.DB.prepare(`DELETE FROM ${t} WHERE profile_id = ?`).bind(pid))
  stmts.push(
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id),
    env.DB.prepare('DELETE FROM profiles WHERE user_id = ?').bind(user.id),
    env.DB.prepare('DELETE FROM login_tokens WHERE email = ?').bind(user.email),
    env.DB.prepare('DELETE FROM users WHERE id = ?').bind(user.id),
  )
  await env.DB.batch(stmts)
  return json({ ok: true }, 200, { 'Set-Cookie': 'sid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' })
}
