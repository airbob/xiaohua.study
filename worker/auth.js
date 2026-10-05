// Parent sign-in: Google OAuth, or an emailed link + 6-digit code. Sessions are random
// tokens in an HttpOnly cookie; only their sha256 is stored.
import { now, DAY, json, fail, redirect, randomToken, randomCode, sha256, parseCookies, cookie, isSecure, readJson, HttpError, html } from './util.js'

const PARENT_DAYS = 90
const CHILD_DAYS = 180 // a child's device stays signed in for half a year, renewed whenever it's used
const LINK_MINUTES = 20
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/

const sessionDays = (s) => (s.profile_id ? CHILD_DAYS : PARENT_DAYS)

// ---- sessions ----------------------------------------------------------------

/** The signed-in parent, or a child (childId set) who may only touch their own profile. */
export async function currentUser(request, env) {
  const token = parseCookies(request).sid
  if (!token) return null
  const row = await env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.plan, s.id AS sid, s.expires_at, s.profile_id, s.last_seen
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = ? AND s.expires_at > ?`,
  )
    .bind(await sha256(token), now())
    .first()
  if (!row) return null
  row.childId = row.profile_id || null
  const days = sessionDays(row)
  const t = now()
  // sliding expiry: renew once a month's worth has been used up; note last use at most hourly
  if (row.expires_at - t < (days - 30) * DAY) {
    await env.DB.prepare('UPDATE sessions SET expires_at = ?, last_seen = ? WHERE id = ?').bind(t + days * DAY, t, row.sid).run()
    row.renewCookie = cookie('sid', token, { maxAge: days * 86400, secure: isSecure(request) })
  } else if (!row.last_seen || t - row.last_seen > 3600_000) {
    await env.DB.prepare('UPDATE sessions SET last_seen = ? WHERE id = ?').bind(t, row.sid).run()
  }
  return row
}

function deviceLabel(request) {
  const ua = request.headers.get('User-Agent') || ''
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && /Mobile/.test(ua))) return 'iPad'
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'Android 手机' : 'Android 平板'
  if (/Macintosh/.test(ua)) return 'Mac'
  if (/Windows/.test(ua)) return 'Windows 电脑'
  if (/CrOS/.test(ua)) return 'Chromebook'
  return '浏览器'
}

export async function startSession(request, env, userId, profileId = null) {
  const token = randomToken()
  const t = now()
  const days = profileId ? CHILD_DAYS : PARENT_DAYS
  await env.DB.batch([
    env.DB.prepare('INSERT INTO sessions (id, user_id, profile_id, device, created_at, last_seen, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(
      await sha256(token), userId, profileId, deviceLabel(request), t, t, t + days * DAY,
    ),
    env.DB.prepare('UPDATE users SET last_login = ? WHERE id = ?').bind(t, userId),
    env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(t),
  ])
  return cookie('sid', token, { maxAge: days * 86400, secure: isSecure(request) })
}

/** Ends the current session (if any) — used when a parent hands this device to a child. */
export async function endCurrentSession(request, env) {
  const token = parseCookies(request).sid
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(await sha256(token)).run()
}

// ---- child PINs ------------------------------------------------------------------

export async function pinHash(env, profileId, pin) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.PIN_PEPPER || 'dev-pepper'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${profileId}:${pin}`))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Child sign-in: the parent's email + the child's 6-digit PIN. */
export async function childLogin(request, env) {
  const body = await readJson(request, 2000)
  const email = String(body.email || '').trim().toLowerCase()
  const pin = String(body.pin || '').trim()
  if (!EMAIL_RE.test(email) || !/^\d{6}$/.test(pin)) throw new HttpError(400, 'bad_pin_format')
  const ip = request.headers.get('CF-Connecting-IP') || 'local'
  const t = now()
  const recent = await env.DB.prepare(
    `SELECT (SELECT COUNT(*) FROM pin_failures WHERE email = ?1 AND created_at > ?2) AS by_email,
            (SELECT COUNT(*) FROM pin_failures WHERE ip = ?3 AND created_at > ?4) AS by_ip`,
  )
    .bind(email, t - 15 * 60_000, ip, t - 60 * 60_000)
    .first()
  if (recent.by_email >= 5 || recent.by_ip >= 20) throw new HttpError(429, 'pin_locked')

  const user = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first()
  const { results: kids } = user
    ? await env.DB.prepare('SELECT id, name, grade, avatar, pin_hash FROM profiles WHERE user_id = ? AND pin_hash IS NOT NULL').bind(user.id).all()
    : { results: [] }
  let match = null
  for (const k of kids) if ((await pinHash(env, k.id, pin)) === k.pin_hash) match = k
  if (!match) {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO pin_failures (email, ip, created_at) VALUES (?, ?, ?)').bind(email, ip, t),
      env.DB.prepare('DELETE FROM pin_failures WHERE created_at < ?').bind(t - DAY),
    ])
    // same answer whether the email exists or not
    throw new HttpError(400, 'pin_wrong')
  }
  const setCookie = await startSession(request, env, user.id, match.id)
  return json({ ok: true, profile: { id: match.id, name: match.name, grade: match.grade, avatar: match.avatar } }, 200, { 'Set-Cookie': setCookie })
}

async function upsertUser(env, { email, name = null, googleSub = null }) {
  email = email.trim().toLowerCase()
  let user = googleSub ? await env.DB.prepare('SELECT * FROM users WHERE google_sub = ?').bind(googleSub).first() : null
  user ||= await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first()
  if (user) {
    if (googleSub && !user.google_sub)
      await env.DB.prepare('UPDATE users SET google_sub = ?, name = COALESCE(name, ?) WHERE id = ?').bind(googleSub, name, user.id).run()
    return user.id
  }
  const id = crypto.randomUUID()
  await env.DB.prepare('INSERT INTO users (id, email, name, google_sub, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(id, email, name, googleSub, now())
    .run()
  return id
}

export async function logout(request, env) {
  const token = parseCookies(request).sid
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(await sha256(token)).run()
  return json({ ok: true }, 200, { 'Set-Cookie': cookie('sid', '', { maxAge: 0, secure: isSecure(request) }) })
}

// ---- Google --------------------------------------------------------------------

const callbackUrl = (request) => `${new URL(request.url).origin}/api/auth/google/callback`

export function googleStart(request, env) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return redirect('/?login_error=google_not_configured')
  const state = randomToken(16)
  const q = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: callbackUrl(request),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  })
  return redirect(`https://accounts.google.com/o/oauth2/v2/auth?${q}`, {
    'Set-Cookie': cookie('g_state', state, { maxAge: 600, secure: isSecure(request) }),
  })
}

export async function googleCallback(request, env) {
  const url = new URL(request.url)
  const clear = cookie('g_state', '', { maxAge: 0, secure: isSecure(request) })
  const state = parseCookies(request).g_state
  if (url.searchParams.get('error')) return redirect('/?login_error=cancelled', { 'Set-Cookie': clear })
  if (!state || state !== url.searchParams.get('state')) return redirect('/?login_error=state', { 'Set-Cookie': clear })

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: url.searchParams.get('code') || '',
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: callbackUrl(request),
      grant_type: 'authorization_code',
    }),
  })
  if (!tokenRes.ok) return redirect('/?login_error=google', { 'Set-Cookie': clear })
  const { access_token } = await tokenRes.json()
  const infoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${access_token}` } })
  if (!infoRes.ok) return redirect('/?login_error=google', { 'Set-Cookie': clear })
  const info = await infoRes.json()
  if (!info.email || !info.email_verified) return redirect('/?login_error=email_unverified', { 'Set-Cookie': clear })

  const userId = await upsertUser(env, { email: info.email, name: info.name, googleSub: info.sub })
  const headers = new Headers({ Location: '/?login=ok', 'Cache-Control': 'no-store' })
  headers.append('Set-Cookie', clear)
  headers.append('Set-Cookie', await startSession(request, env, userId))
  return new Response(null, { status: 302, headers })
}

// ---- email link + code -------------------------------------------------------------

export async function emailStart(request, env) {
  const { email: raw } = await readJson(request, 2000)
  const email = String(raw || '').trim().toLowerCase()
  if (!EMAIL_RE.test(email)) throw new HttpError(400, 'invalid_email')
  const ip = request.headers.get('CF-Connecting-IP') || 'local'
  const t = now()
  const recent = await env.DB.prepare(
    `SELECT (SELECT COUNT(*) FROM login_tokens WHERE email = ?1 AND created_at > ?2) AS by_email,
            (SELECT COUNT(*) FROM login_tokens WHERE ip = ?3 AND created_at > ?4) AS by_ip`,
  )
    .bind(email, t - 15 * 60_000, ip, t - 60 * 60_000)
    .first()
  if (recent.by_email >= 3 || recent.by_ip >= 10) throw new HttpError(429, 'too_many_requests')

  const token = randomToken()
  const code = randomCode()
  await env.DB.batch([
    env.DB.prepare('INSERT INTO login_tokens (id, email, code_hash, ip, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)').bind(
      await sha256(token), email, await sha256(`${email}:${code}`), ip, t, t + LINK_MINUTES * 60_000,
    ),
    env.DB.prepare('DELETE FROM login_tokens WHERE expires_at < ?').bind(t - DAY),
  ])
  const link = `${new URL(request.url).origin}/api/auth/email/verify?token=${token}`

  if (!env.RESEND_API_KEY) {
    if (env.DEV_LOGIN_LINKS === '1') return json({ ok: true, dev: { link, code } }) // local development only
    throw new HttpError(503, 'email_not_configured')
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: [email],
      subject: `小华听写登录验证码 ${code}`,
      text: `你的小华听写登录验证码是 ${code}（${LINK_MINUTES} 分钟内有效）。\n\n也可以直接打开这个链接登录：\n${link}\n\n如果不是你本人操作，忽略这封邮件即可。`,
      html: loginEmailHtml(code, link),
    }),
  })
  if (!res.ok) throw new HttpError(502, 'email_send_failed')
  return json({ ok: true })
}

// The emailed link shows a confirm button rather than signing in on GET, so mail
// scanners that prefetch links can't burn the one-time token.
export async function emailVerifyPage(request) {
  const token = new URL(request.url).searchParams.get('token') || ''
  return html(`<!doctype html><html lang="zh-Hans"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>登录小华听写</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fbf6ee;color:#1f2a44;font-family:-apple-system,'PingFang SC',sans-serif}
form{background:#fff;padding:28px 24px;border-radius:16px;text-align:center;box-shadow:0 6px 20px rgba(31,42,68,.08);max-width:320px;margin:16px}
button{background:#c8402f;color:#fff;border:0;border-radius:999px;font-size:17px;font-weight:600;padding:14px 28px;cursor:pointer}</style></head>
<body><form method="post" action="/api/auth/email/verify"><h1 style="font-size:22px;margin:0 0 8px">登录小华听写</h1>
<p style="color:#6b6f7d;margin:0 0 20px">点下面的按钮完成登录。</p><input type="hidden" name="token" value="${token.replace(/[^A-Za-z0-9_-]/g, '')}">
<button type="submit">确认登录</button></form></body></html>`)
}

export async function emailVerifyLink(request, env) {
  const form = await request.formData()
  const row = await env.DB.prepare('SELECT * FROM login_tokens WHERE id = ?').bind(await sha256(String(form.get('token') || ''))).first()
  if (!row || row.used_at || row.expires_at < now()) return redirect('/?login_error=link_expired')
  return finishEmailLogin(request, env, row, (cookieHeader) => redirect('/?login=ok', { 'Set-Cookie': cookieHeader }))
}

export async function emailVerifyCode(request, env) {
  const { email: raw, code } = await readJson(request, 2000)
  const email = String(raw || '').trim().toLowerCase()
  const row = await env.DB.prepare(
    'SELECT * FROM login_tokens WHERE email = ? AND used_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 1',
  )
    .bind(email, now())
    .first()
  if (!row || row.tries >= 5) throw new HttpError(400, 'code_expired')
  if ((await sha256(`${email}:${String(code || '').trim()}`)) !== row.code_hash) {
    await env.DB.prepare('UPDATE login_tokens SET tries = tries + 1 WHERE id = ?').bind(row.id).run()
    throw new HttpError(400, 'code_wrong')
  }
  return finishEmailLogin(request, env, row, (cookieHeader) => json({ ok: true }, 200, { 'Set-Cookie': cookieHeader }))
}

async function finishEmailLogin(request, env, row, respond) {
  // single use: only the request that flips used_at wins
  const { meta } = await env.DB.prepare('UPDATE login_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL').bind(now(), row.id).run()
  if (!meta.changes) return fail(400, 'code_expired')
  const userId = await upsertUser(env, { email: row.email })
  return respond(await startSession(request, env, userId))
}

function loginEmailHtml(code, link) {
  return `<div style="font-family:-apple-system,'PingFang SC',sans-serif;color:#1f2a44;max-width:440px;margin:0 auto;padding:24px">
<h1 style="font-size:20px;margin:0 0 12px">登录小华听写</h1>
<p style="margin:0 0 8px">你的验证码：</p>
<p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:0 0 16px">${code}</p>
<p style="margin:0 0 20px;color:#6b6f7d">20 分钟内有效。在原来的页面输入验证码，或者直接点下面的按钮：</p>
<p><a href="${link}" style="display:inline-block;background:#c8402f;color:#fff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:999px">登录小华听写</a></p>
<p style="margin:24px 0 0;font-size:12px;color:#6b6f7d">如果不是你本人操作，忽略这封邮件即可。· xiaohua.study</p></div>`
}
