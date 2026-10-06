// 小华听写 Pro via Stripe: Checkout for new subscriptions, our own 订阅管理 page for everything
// else (cancel with a reason, resume, switch plan at the next renewal, receipts), the Customer
// Portal only for changing the card, and a webhook that keeps users.plus_until in step.
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET. Vars: STRIPE_PRICE_MONTH, STRIPE_PRICE_YEAR.
import { now, DAY, json, readJson, HttpError } from './util.js'

const GRACE = 3 * DAY // keep Plus a few days past the period end while a renewal retries
const LIVE_STATUSES = new Set(['active', 'trialing', 'past_due'])

export const isPlus = (user) => !!user.plus_until && user.plus_until > now()

/**
 * Stripe REST call with form-encoded params; nested keys like 'line_items[0][price]'. Params can
 * be an object or a list of [key, value] pairs (for repeated keys such as 'expand[]').
 */
async function stripe(env, method, path, params) {
  if (!env.STRIPE_SECRET_KEY) throw new HttpError(503, 'billing_not_configured')
  const qs = params ? new URLSearchParams(params) : null
  const res = await fetch(`https://api.stripe.com/v1/${path}${method === 'GET' && qs ? `?${qs}` : ''}`, {
    method,
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: method !== 'GET' && qs ? qs : undefined,
  })
  const data = await res.json()
  if (!res.ok) {
    const err = data?.error || {}
    console.error('stripe', path, res.status, err.code, err.message)
    // a customer from the other mode (test vs live), or one deleted in the dashboard
    if (err.code === 'resource_missing' && err.param === 'customer') throw new HttpError(409, 'stripe_customer_missing')
    if (path.startsWith('billing_portal/') && /portal|configuration/i.test(err.message || '')) throw new HttpError(503, 'portal_not_configured')
    throw new HttpError(502, 'billing_error')
  }
  return data
}

async function ensureCustomer(env, user, fresh = false) {
  if (user.stripe_customer_id && !fresh) return user.stripe_customer_id
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
  const start = async (fresh) => stripe(env, 'POST', 'checkout/sessions', {
    mode: 'subscription',
    customer: await ensureCustomer(env, user, fresh),
    'line_items[0][price]': price,
    'line_items[0][quantity]': '1',
    client_reference_id: user.id,
    'subscription_data[metadata][user_id]': user.id,
    allow_promotion_codes: 'true',
    success_url: `${origin}/?billing=success`,
    cancel_url: `${origin}/?billing=cancel`,
  })
  let session
  try {
    session = await start(false)
  } catch (e) {
    // the saved customer no longer exists (e.g. made with the test key): make a new one
    if (e.message !== 'stripe_customer_missing') throw e
    session = await start(true)
  }
  return json({ url: session.url })
}

/** The full Stripe Customer Portal (kept as a fallback; the app uses its own page). */
export async function portal(request, env, user) {
  if (user.childId) throw new HttpError(403, 'parent_only')
  if (!user.stripe_customer_id) throw new HttpError(400, 'no_subscription')
  const s = await stripe(env, 'POST', 'billing_portal/sessions', {
    customer: user.stripe_customer_id,
    return_url: `${new URL(request.url).origin}/?billing=portal`,
  })
  return json({ url: s.url })
}

// ---- 订阅管理 ---------------------------------------------------------------------

const intervalOf = (env, price) => (price === env.STRIPE_PRICE_YEAR ? 'year' : price === env.STRIPE_PRICE_MONTH ? 'month' : null)
const priceOf = (env, interval) => (interval === 'year' ? env.STRIPE_PRICE_YEAR : interval === 'month' ? env.STRIPE_PRICE_MONTH : null)
const periodEnd = (sub) => sub.items?.data?.[0]?.current_period_end ?? sub.current_period_end ?? null
const scheduleId = (sub) => (typeof sub.schedule === 'string' ? sub.schedule : sub.schedule?.id) || null

/** The family's own subscription; 404 if there is none to manage. */
async function ownSubscription(env, user, expand = []) {
  if (user.childId) throw new HttpError(403, 'parent_only')
  if (!user.stripe_subscription_id) throw new HttpError(404, 'no_subscription')
  const sub = await stripe(env, 'GET', `subscriptions/${user.stripe_subscription_id}`, expand.map((e) => ['expand[]', e]))
  const customer = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id
  if (customer !== user.stripe_customer_id) throw new HttpError(404, 'no_subscription')
  return sub
}

/** A plan switch waiting for the next renewal (from the subscription schedule), if any. */
function pendingSwitch(env, sub) {
  const sched = sub.schedule && typeof sub.schedule === 'object' ? sub.schedule : null
  if (!sched || sched.status !== 'active') return null
  const end = periodEnd(sub)
  const next = (sched.phases || []).find((ph) => ph.start_date >= end)
  const price = next?.items?.[0]?.price
  const interval = intervalOf(env, typeof price === 'string' ? price : price?.id)
  const current = intervalOf(env, sub.items?.data?.[0]?.price?.id)
  return interval && interval !== current ? { interval, from: next.start_date * 1000 } : null
}

/** GET /api/billing/subscription — what the 订阅管理 page shows. */
export async function subscription(request, env, user) {
  const sub = await ownSubscription(env, user, ['default_payment_method', 'schedule', 'customer.invoice_settings.default_payment_method'])
  const item = sub.items?.data?.[0]
  const pm = sub.default_payment_method || sub.customer?.invoice_settings?.default_payment_method
  const card = pm?.card ? { brand: pm.card.brand, last4: pm.card.last4, expMonth: pm.card.exp_month, expYear: pm.card.exp_year } : null
  const inv = await stripe(env, 'GET', 'invoices', { customer: user.stripe_customer_id, limit: '12' })
  // keep our copy in step (it may have changed in Stripe since the last webhook)
  await applySubscription(env, sub)
  return json({
    status: sub.status,
    interval: item?.price?.recurring?.interval || null,
    amount: item?.price?.unit_amount ?? null,
    currency: item?.price?.currency || 'sgd',
    periodEnd: (periodEnd(sub) || 0) * 1000,
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
    pending: pendingSwitch(env, sub),
    card,
    invoices: (inv.data || [])
      .filter((i) => i.status !== 'draft')
      .map((i) => ({
        date: i.created * 1000,
        amount: i.total,
        currency: i.currency,
        status: i.status,
        number: i.number,
        url: i.hosted_invoice_url,
        pdf: i.invoice_pdf,
      })),
  })
}

/**
 * POST /api/billing/sync — read the family's latest subscription straight from Stripe. Used right
 * after Checkout so Pro switches on even if the webhook is late.
 */
export async function sync(request, env, user) {
  if (user.childId) throw new HttpError(403, 'parent_only')
  if (!user.stripe_customer_id || !env.STRIPE_SECRET_KEY) return json({ ok: true })
  const list = await stripe(env, 'GET', 'subscriptions', { customer: user.stripe_customer_id, status: 'all', limit: '1' })
  if (list.data?.[0]) await applySubscription(env, list.data[0])
  return json({ ok: true })
}

/** A switch is kept as a two-phase schedule; releasing it leaves the subscription as it is now. */
async function dropSchedule(env, sub) {
  const id = scheduleId(sub)
  if (id) await stripe(env, 'POST', `subscription_schedules/${id}/release`)
}

// Stripe's own cancellation feedback values
const REASONS = { too_expensive: 1, unused: 1, missing_features: 1, too_complex: 1, switched_service: 1, low_quality: 1, other: 1 }

/** POST /api/billing/cancel {reason?, comment?} — Pro ends when the paid period does. */
export async function cancel(request, env, user) {
  const body = await readJson(request, 4000)
  const reason = REASONS[body.reason] ? body.reason : null
  const comment = String(body.comment || '').trim().slice(0, 500)
  const sub = await ownSubscription(env, user)
  if (!LIVE_STATUSES.has(sub.status)) throw new HttpError(409, 'not_active')
  // a subscription run by a schedule can't be cancelled directly; a pending switch goes with it
  await dropSchedule(env, sub)
  const params = { cancel_at_period_end: 'true' }
  if (reason) params['cancellation_details[feedback]'] = reason
  if (comment) params['cancellation_details[comment]'] = comment
  const updated = await stripe(env, 'POST', `subscriptions/${sub.id}`, params)
  await env.DB.prepare('INSERT INTO cancellations (user_id, reason, comment, plan_interval, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(user.id, reason, comment || null, updated.items?.data?.[0]?.price?.recurring?.interval || null, now())
    .run()
  await applySubscription(env, updated)
  return json({ ok: true })
}

/** POST /api/billing/resume — undo a cancellation before the period ends. */
export async function resume(request, env, user) {
  const sub = await ownSubscription(env, user)
  if (!LIVE_STATUSES.has(sub.status)) throw new HttpError(409, 'not_active')
  const updated = await stripe(env, 'POST', `subscriptions/${sub.id}`, { cancel_at_period_end: 'false' })
  await applySubscription(env, updated)
  return json({ ok: true })
}

/**
 * POST /api/billing/switch {interval} — monthly ↔ yearly from the next renewal (no proration).
 * Switching back to the current plan just drops the pending change.
 */
export async function switchPlan(request, env, user) {
  const { interval } = await readJson(request, 500)
  const target = priceOf(env, interval)
  if (!target) throw new HttpError(400, 'bad_interval')
  const sub = await ownSubscription(env, user)
  if (!LIVE_STATUSES.has(sub.status)) throw new HttpError(409, 'not_active')
  if (sub.cancel_at_period_end) throw new HttpError(409, 'cancelling')
  const item = sub.items?.data?.[0]
  const current = item?.price?.id
  await dropSchedule(env, sub)
  if (current === target) return json({ ok: true, pending: null })
  const sched = await stripe(env, 'POST', 'subscription_schedules', { from_subscription: sub.id })
  const phase = sched.phases[0]
  await stripe(env, 'POST', `subscription_schedules/${sched.id}`, {
    end_behavior: 'release',
    proration_behavior: 'none',
    'phases[0][items][0][price]': current,
    'phases[0][items][0][quantity]': String(item.quantity || 1),
    'phases[0][start_date]': String(phase.start_date),
    'phases[0][end_date]': String(phase.end_date),
    'phases[1][items][0][price]': target,
    'phases[1][items][0][quantity]': '1',
    'phases[1][proration_behavior]': 'none',
  })
  return json({ ok: true, pending: { interval, from: phase.end_date * 1000 } })
}

/** POST /api/billing/card — Stripe's page for just changing the card, then back to 订阅管理. */
export async function cardUpdate(request, env, user) {
  if (user.childId) throw new HttpError(403, 'parent_only')
  if (!user.stripe_customer_id) throw new HttpError(404, 'no_subscription')
  const back = `${new URL(request.url).origin}/?billing=card`
  const s = await stripe(env, 'POST', 'billing_portal/sessions', {
    customer: user.stripe_customer_id,
    return_url: back,
    'flow_data[type]': 'payment_method_update',
    'flow_data[after_completion][type]': 'redirect',
    'flow_data[after_completion][redirect][return_url]': back,
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
  const customer = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id
  sub = { ...sub, customer }
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
