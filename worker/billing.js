// 小华听写 Plus via Stripe: Checkout for new subscriptions, the Customer Portal for changes and
// cancellation, and a webhook that keeps users.plus_until in step with the subscription.
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET. Vars: STRIPE_PRICE_MONTH, STRIPE_PRICE_YEAR.
import { now, DAY, json, readJson, HttpError } from './util.js'

const GRACE = 3 * DAY // keep Plus a few days past the period end while a renewal retries
const LIVE_STATUSES = new Set(['active', 'trialing', 'past_due'])

export const isPlus = (user) => !!user.plus_until && user.plus_until > now()

/** Stripe REST call with form-encoded params; nested keys like 'line_items[0][price]'. */
async function stripe(env, method, path, params) {
  if (!env.STRIPE_SECRET_KEY) throw new HttpError(503, 'billing_not_configured')
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params ? new URLSearchParams(params) : undefined,
  })
  const data = await res.json()
  if (!res.ok) {
    console.error('stripe', path, res.status, data?.error?.message)
    throw new HttpError(502, 'billing_error')
  }
  return data
}

async function ensureCustomer(env, user) {
  if (user.stripe_customer_id) return user.stripe_customer_id
  const c = await stripe(env, 'POST', 'customers', { email: user.email, 'metadata[user_id]': user.id })
  await env.DB.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').bind(c.id, user.id).run()
  return c.id
}

/** Start a subscription: returns the Stripe Checkout URL. */
export async function checkout(request, env, user) {
  if (user.childId) throw new HttpError(403, 'parent_only')
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PRICE_MONTH || !env.STRIPE_PRICE_YEAR) throw new HttpError(503, 'billing_not_configured')
  const { interval } = await readJson(request, 500)
  const price = interval === 'year' ? env.STRIPE_PRICE_YEAR : interval === 'month' ? env.STRIPE_PRICE_MONTH : null
  if (!price) throw new HttpError(400, 'bad_interval')
  if (isPlus(user) && user.stripe_subscription_id && LIVE_STATUSES.has(user.subscription_status)) throw new HttpError(409, 'already_plus')
  const origin = new URL(request.url).origin
  const session = await stripe(env, 'POST', 'checkout/sessions', {
    mode: 'subscription',
    customer: await ensureCustomer(env, user),
    'line_items[0][price]': price,
    'line_items[0][quantity]': '1',
    client_reference_id: user.id,
    'subscription_data[metadata][user_id]': user.id,
    allow_promotion_codes: 'true',
    success_url: `${origin}/?billing=success`,
    cancel_url: `${origin}/?billing=cancel`,
  })
  return json({ url: session.url })
}

/** Manage / cancel / change card: returns a Stripe Customer Portal URL. */
export async function portal(request, env, user) {
  if (user.childId) throw new HttpError(403, 'parent_only')
  if (!user.stripe_customer_id) throw new HttpError(400, 'no_subscription')
  const s = await stripe(env, 'POST', 'billing_portal/sessions', {
    customer: user.stripe_customer_id,
    return_url: `${new URL(request.url).origin}/?billing=portal`,
  })
  return json({ url: s.url })
}

// ---- webhook ------------------------------------------------------------------------

async function hmacHex(secret, payload) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

/** Stripe-Signature: t=…,v1=… — HMAC-SHA256 of `${t}.${body}`, within 5 minutes. */
async function verify(env, header, body) {
  if (!env.STRIPE_WEBHOOK_SECRET || !header) return false
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=')).map(([k, ...v]) => [k, v.join('=')]))
  const t = Number(parts.t)
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false
  const expected = await hmacHex(env.STRIPE_WEBHOOK_SECRET, `${t}.${body}`)
  return header
    .split(',')
    .filter((p) => p.startsWith('v1='))
    .some((p) => safeEqual(p.slice(3), expected))
}

/** Copy a subscription's state onto its user. */
async function applySubscription(env, sub) {
  const userId = sub.metadata?.user_id
  const user = userId
    ? await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(userId).first()
    : await env.DB.prepare('SELECT id FROM users WHERE stripe_customer_id = ?').bind(sub.customer).first()
  if (!user) return
  const item = sub.items?.data?.[0]
  const periodEnd = (item?.current_period_end ?? sub.current_period_end ?? 0) * 1000 // newer API versions keep it on the item
  const live = LIVE_STATUSES.has(sub.status)
  const until = live ? periodEnd + GRACE : sub.status === 'canceled' ? Math.min(periodEnd || now(), now()) : now()
  await env.DB.prepare(
    `UPDATE users SET plan = ?, plus_until = ?, stripe_customer_id = ?, stripe_subscription_id = ?, subscription_status = ?,
            plan_interval = ?, cancel_at_period_end = ? WHERE id = ?`,
  )
    .bind(live ? 'plus' : 'free', until, sub.customer, sub.id, sub.status, item?.price?.recurring?.interval || null, sub.cancel_at_period_end ? 1 : 0, user.id)
    .run()
}

export async function webhook(request, env) {
  const body = await request.text()
  if (!(await verify(env, request.headers.get('Stripe-Signature'), body))) return json({ error: 'bad_signature' }, 400)
  const event = JSON.parse(body)
  // each event once (Stripe retries until it gets a 2xx)
  const { meta } = await env.DB.prepare('INSERT OR IGNORE INTO stripe_events (id, created_at) VALUES (?, ?)').bind(event.id, now()).run()
  if (!meta.changes) return json({ ok: true, duplicate: true })
  try {
    const o = event.data.object
    if (event.type === 'checkout.session.completed' && o.mode === 'subscription' && o.subscription) {
      if (o.client_reference_id && o.customer)
        await env.DB.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').bind(o.customer, o.client_reference_id).run()
      await applySubscription(env, await stripe(env, 'GET', `subscriptions/${o.subscription}`))
    } else if (event.type.startsWith('customer.subscription.')) {
      await applySubscription(env, o)
    }
  } catch (e) {
    // let Stripe retry this event later
    await env.DB.prepare('DELETE FROM stripe_events WHERE id = ?').bind(event.id).run()
    throw e
  }
  return json({ ok: true })
}

/** Account deletion: stop billing straight away. */
export async function cancelNow(env, user) {
  if (!user.stripe_subscription_id || !LIVE_STATUSES.has(user.subscription_status) || !env.STRIPE_SECRET_KEY) return
  await stripe(env, 'DELETE', `subscriptions/${user.stripe_subscription_id}`)
}
