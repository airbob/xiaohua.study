// Grades a freely handwritten character against its reference strokes — the way a
// teacher would: right number of strokes, written in the right order, each stroke
// roughly the right shape and direction and roughly in the right place. Exact
// proportions don't matter (mouse and finger writing is never textbook-neat).
//
// Coordinates: the student's cell (0..1) maps onto hanzi-writer-data's 1024 box,
// y pointing down. Each character is read three ways — as written, scaled to the
// reference's box, and stretched to it separately in x and y — and the kindest
// reading is kept.

const N = 24 // resample points per stroke

// shape: mean distance between strokes after each is normalised to its own size
// pos:   max distance between stroke centres, as a share of the box
// dot:   reference strokes shorter than this (1024 units) are dots — shape is noisy, so loosen
export const TOL = { shape: 0.3, pos: 0.26, lenMin: 0.35, lenMax: 2.8, dot: 170 }
export const setTolerance = (t) => Object.assign(TOL, t)

function resample(pts, n = N) {
  if (pts.length === 1) return Array(n).fill(pts[0])
  const seg = []
  let total = 0
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
    seg.push(d)
    total += d
  }
  if (total === 0) return Array(n).fill(pts[0])
  const out = [pts[0]]
  const step = total / (n - 1)
  let acc = 0
  let i = 0
  for (let k = 1; k < n - 1; k++) {
    const target = k * step
    while (i < seg.length - 1 && acc + seg[i] < target) acc += seg[i++]
    const t = seg[i] ? (target - acc) / seg[i] : 0
    out.push([pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t])
  }
  out.push(pts[pts.length - 1])
  return out
}

function length(s) {
  let l = 0
  for (let i = 1; i < s.length; i++) l += Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1])
  return l
}

function meanDist(a, b) {
  let s = 0
  for (let i = 0; i < a.length; i++) s += Math.hypot(a[i][0] - b[i][0], a[i][1] - b[i][1])
  return s / a.length
}

function bbox(strokes) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const s of strokes)
    for (const [x, y] of s) {
      if (x < x0) x0 = x
      if (y < y0) y0 = y
      if (x > x1) x1 = x
      if (y > y1) y1 = y
    }
  return { w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 }
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

function fit(user, ref, stretch) {
  const u = bbox(user)
  const r = bbox(ref)
  const k = clamp(Math.max(r.w, r.h, 1) / Math.max(u.w, u.h, 1), 0.5, 2)
  let kx = k, ky = k
  if (stretch) {
    // stretch each axis separately, unless the character is basically one line (一, 丨)
    if (u.w > 80 && r.w > 80) kx = clamp(r.w / u.w, 0.5, 2)
    if (u.h > 80 && r.h > 80) ky = clamp(r.h / u.h, 0.5, 2)
    const ratio = kx / ky
    if (ratio > 1.7) kx = ky * 1.7
    if (ratio < 1 / 1.7) ky = kx * 1.7
  }
  return user.map((s) => s.map(([x, y]) => [r.cx + (x - u.cx) * kx, r.cy + (y - u.cy) * ky]))
}

function features(stroke) {
  const p = resample(stroke)
  let cx = 0, cy = 0
  for (const [x, y] of p) {
    cx += x / N
    cy += y / N
  }
  const b = bbox([p])
  const scale = Math.max(b.w, b.h, 60)
  return { c: [cx, cy], len: length(p), norm: p.map(([x, y]) => [(x - cx) / scale, (y - cy) / scale]) }
}

// Is user stroke u a fair attempt at reference stroke r?
function compare(u, r) {
  const dot = r.len < TOL.dot
  const fwd = meanDist(u.norm, r.norm)
  const bwd = meanDist([...u.norm].reverse(), r.norm)
  const backwards = !dot && bwd < fwd * 0.6
  const shape = backwards ? bwd : fwd
  const shapeLimit = dot ? TOL.shape * 1.8 : TOL.shape
  const pos = Math.hypot(u.c[0] - r.c[0], u.c[1] - r.c[1]) / 1024
  const ratio = (u.len + 40) / (r.len + 40)
  const ok = shape <= shapeLimit && pos <= TOL.pos && ratio >= TOL.lenMin && ratio <= TOL.lenMax
  return { ok, backwards, cost: shape / shapeLimit + pos / TOL.pos }
}

// Longest increasing subsequence of ref indices → the strokes written in a consistent order.
function inOrderSet(seq) {
  const idx = seq.map((_, i) => i).filter((i) => seq[i] !== null)
  const best = new Array(idx.length).fill(1)
  const prev = new Array(idx.length).fill(-1)
  for (let a = 0; a < idx.length; a++)
    for (let b = 0; b < a; b++)
      if (seq[idx[b]] < seq[idx[a]] && best[b] + 1 > best[a]) {
        best[a] = best[b] + 1
        prev[a] = b
      }
  let end = best.indexOf(Math.max(0, ...best))
  const keep = new Set()
  while (end >= 0) {
    keep.add(idx[end])
    end = prev[end]
  }
  return keep
}

function evaluate(user, ref) {
  const U = user.map(features)
  const R = ref.map(features)
  let userMatch = null

  // 1. Read it in the order written: stroke i against reference stroke i.
  if (U.length === R.length) {
    const c = U.map((u, i) => compare(u, R[i]))
    if (c.every((x) => x.ok)) userMatch = c.map((x, i) => ({ j: i, backwards: x.backwards, cost: x.cost }))
  }

  // 2. Otherwise find the best stroke-to-stroke pairing, preferring same-position pairs,
  //    and work out what's missing, extra or out of order.
  if (!userMatch) {
    const pairs = []
    for (let i = 0; i < U.length; i++)
      for (let j = 0; j < R.length; j++) {
        const c = compare(U[i], R[j])
        if (c.ok) pairs.push({ i, j, backwards: c.backwards, cost: c.cost - (i === j ? 0.35 : 0) })
      }
    pairs.sort((a, b) => a.cost - b.cost)
    userMatch = new Array(U.length).fill(null)
    const used = new Array(R.length).fill(false)
    for (const p of pairs) {
      if (userMatch[p.i] || used[p.j]) continue
      userMatch[p.i] = p
      used[p.j] = true
    }
  }

  const refUsed = new Array(R.length).fill(false)
  for (const m of userMatch) if (m) refUsed[m.j] = true
  const missing = refUsed.map((u, j) => (u ? null : j)).filter((j) => j !== null)
  const extra = userMatch.map((m, i) => (m ? null : i)).filter((i) => i !== null)
  const ordered = inOrderSet(userMatch.map((m) => (m ? m.j : null)))
  const outOfOrder = userMatch.map((m, i) => (m && !ordered.has(i) ? { user: i, ref: m.j } : null)).filter(Boolean)
  const backwards = userMatch.filter((m) => m && m.backwards).map((m) => m.j)
  const avgCost = userMatch.reduce((s, m) => s + (m ? m.cost : 0), 0) / Math.max(1, U.length)
  const badness = 3 * (missing.length + extra.length) + outOfOrder.length + 0.5 * backwards.length + avgCost * 0.1
  return { userMatch, missing, extra, outOfOrder, backwards, badness }
}

/**
 * data: hanzi-writer-data JSON. strokes: [[ [x,y] in 0..1 ], ...] in writing order.
 * Returns { status: 'ok'|'order'|'wrong'|'blank', refCount, userCount, strokeStatus, refStatus,
 *           missing, extra, outOfOrder, backwards, matched }
 */
export function gradeChar(data, strokes) {
  const ref = data.medians.map((m) => m.map(([x, y]) => [x, 900 - y]))
  const base = { refCount: ref.length, userCount: strokes.length }
  if (!strokes.length)
    return { ...base, status: 'blank', missing: ref.map((_, j) => j), extra: [], outOfOrder: [], backwards: [], matched: 0, strokeStatus: [], refStatus: ref.map(() => 'missing') }
  const raw = strokes.map((s) => s.map(([x, y]) => [x * 1024, y * 1024]))
  const r = [raw, fit(raw, ref, false), fit(raw, ref, true)]
    .map((u) => evaluate(u, ref))
    .reduce((a, b) => (b.badness < a.badness ? b : a))

  const late = new Set(r.outOfOrder.map((o) => o.ref))
  const back = new Set(r.backwards)
  const strokeStatus = r.userMatch.map((m) => (!m ? 'extra' : late.has(m.j) ? 'order' : back.has(m.j) ? 'backwards' : 'ok'))
  const refStatus = ref.map((_, j) => (r.missing.includes(j) ? 'missing' : late.has(j) ? 'order' : back.has(j) ? 'backwards' : 'ok'))
  const status = r.missing.length || r.extra.length ? 'wrong' : late.size || back.size ? 'order' : 'ok'
  return {
    ...base,
    status,
    missing: r.missing,
    extra: r.extra,
    outOfOrder: r.outOfOrder,
    backwards: r.backwards,
    matched: ref.length - r.missing.length,
    strokeStatus,
    refStatus,
  }
}
