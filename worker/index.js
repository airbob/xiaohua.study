// API Worker for xiaohua.study. Static files (dist/) are served by Workers Assets;
// only /api/* reaches this code (see run_worker_first in wrangler.jsonc).
import { json, fail, HttpError } from './util.js'
import * as auth from './auth.js'
import * as api from './api.js'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request)
    try {
      const res = await route(request, env, url)
      return res
    } catch (e) {
      if (e instanceof HttpError) return fail(e.status, e.message)
      console.error('api error', url.pathname, e?.stack || e)
      return fail(500, 'server_error')
    }
  },
}

async function route(request, env, url) {
  const { pathname: p } = url
  const m = request.method

  // Cross-site form/JSON posts can't carry the session (SameSite=Lax), but also refuse
  // state-changing requests from other origins outright.
  if (m !== 'GET' && m !== 'HEAD') {
    const origin = request.headers.get('Origin')
    if (origin && origin !== url.origin) return fail(403, 'bad_origin')
  }

  // ---- sign-in (no session needed) ----
  // which sign-in methods are switched on (Google appears once its client id + secret are set)
  if (p === '/api/auth/providers' && m === 'GET')
    return json({ google: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET), email: !!env.RESEND_API_KEY || env.DEV_LOGIN_LINKS === '1' })
  if (p === '/api/auth/google/start' && m === 'GET') return auth.googleStart(request, env)
  if (p === '/api/auth/google/callback' && m === 'GET') return auth.googleCallback(request, env)
  if (p === '/api/auth/email/start' && m === 'POST') return auth.emailStart(request, env)
  if (p === '/api/auth/email/verify' && m === 'GET') return auth.emailVerifyPage(request)
  if (p === '/api/auth/email/verify' && m === 'POST') return auth.emailVerifyLink(request, env)
  if (p === '/api/auth/email/code' && m === 'POST') return auth.emailVerifyCode(request, env)
  if (p === '/api/auth/logout' && m === 'POST') return auth.logout(request, env)

  // ---- everything else needs a parent session ----
  const user = await auth.currentUser(request, env)
  if (!user) return fail(401, 'signed_out')
  const res = await authed(request, env, user, p, m)
  if (user.renewCookie) res.headers.append('Set-Cookie', user.renewCookie)
  return res
}

async function authed(request, env, user, p, m) {
  if (p === '/api/me' && m === 'GET') return api.me(env, user)
  if (p === '/api/account' && m === 'DELETE') return api.deleteAccount(env, user)
  if (p === '/api/profiles' && m === 'POST') return api.createProfile(request, env, user)

  const pm = p.match(/^\/api\/profiles\/([0-9a-f-]{36})(\/[a-z]+)?$/)
  if (pm) {
    const [, id, sub = ''] = pm
    if (sub === '' && m === 'PATCH') return api.updateProfile(request, env, user, id)
    if (sub === '' && m === 'DELETE') return api.deleteProfile(env, user, id)
    if (sub === '/progress' && m === 'GET') return api.getProgress(env, user, id)
    if (sub === '/sets' && m === 'POST') return api.saveSet(request, env, user, id)
    if (sub === '/import' && m === 'POST') return api.importLocal(request, env, user, id)
  }
  return fail(404, 'not_found')
}
