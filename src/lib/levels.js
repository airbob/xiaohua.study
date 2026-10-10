// 汉字岛 levels: each grade's word list (most frequent first) is cut into levels of ~5
// words. A finished level earns 1–3 stars from how many words were written perfectly.
// Until Oct 2026 levels were ~10 words; saved stars from then are moved over by upgradeLevels().
import WORDS from '../data/words.json'

export const GRADES = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6']
const byGrade = Object.fromEntries(GRADES.map((g) => [g, WORDS.filter((w) => w.grade === g)]))

export const LEVEL_SIZE = 5
const OLD_LEVEL_SIZE = 10

/** Level sizes for a list of `total` words, split evenly (P1's 101 words → 21 levels of 4–5, no 1-word leftover). */
export function levelSizes(total, per = LEVEL_SIZE) {
  const count = Math.ceil(total / per)
  return Array.from({ length: count }, (_, i) => Math.floor(total / count) + (i < total % count ? 1 : 0))
}
function split(list) {
  let start = 0
  return levelSizes(list.length).map((size) => list.slice(start, (start += size)))
}
const levelsOf = Object.fromEntries(GRADES.map((g) => [g, split(byGrade[g])]))

export const levelCount = (grade) => levelsOf[grade].length
export const levelWords = (grade, level) => levelsOf[grade][level - 1] || []
export const gradeWordCount = (grade) => byGrade[grade].length

/** 3 stars: every word right · 2 stars: 60% right (3 of 5) · otherwise 1 star for finishing. */
export function starsFor(correct, n) {
  if (correct >= n) return 3
  if (correct >= Math.ceil(n * 0.6)) return 2
  return 1
}

/** How many more perfect words would have earned the next star (null at 3 stars). */
export function toNextStar(correct, n) {
  const s = starsFor(correct, n)
  if (s === 3) return null
  return (s === 2 ? n : Math.ceil(n * 0.6)) - correct
}

/**
 * Saved stars ({ P3: { 4: { stars, correct, n } } }) from the old ~10-word levels, moved onto the
 * 5-word levels. Old entries are told apart by n (9–10 words, new levels have at most 5). A new level
 * gets stars when every old level its words came from was passed, with the fewest of their stars.
 * Returns null when nothing needed moving.
 */
export function upgradeLevels(saved) {
  let changed = false
  const out = {}
  for (const [grade, byLevel] of Object.entries(saved || {})) {
    const keep = {}
    const old = {}
    for (const [l, v] of Object.entries(byLevel || {})) {
      if ((v?.n ?? OLD_LEVEL_SIZE) > LEVEL_SIZE) old[l] = v
      else keep[l] = v
    }
    out[grade] = keep
    if (!Object.keys(old).length || !byGrade[grade]) continue
    changed = true
    // the old level number of each word in the grade
    const oldOf = levelSizes(byGrade[grade].length, OLD_LEVEL_SIZE).flatMap((size, i) => Array(size).fill(i + 1))
    let start = 0
    levelSizes(byGrade[grade].length).forEach((size, i) => {
      const from = [...new Set(oldOf.slice(start, (start += size)))].map((l) => old[l]?.stars || 0)
      const stars = Math.min(...from)
      const have = keep[i + 1]?.stars || 0
      if (stars > have) keep[i + 1] = { stars, correct: stars === 3 ? size : stars === 2 ? Math.ceil(size * 0.6) : 0, n: size }
    })
  }
  return changed ? out : null
}

/**
 * Island summary for a grade from saved level stars ({ [level]: { stars } }):
 * current = first level without stars; stars on the island grow with the share of levels passed.
 */
export function gradeStatus(grade, saved = {}) {
  const total = levelCount(grade)
  let passed = 0
  let current = null
  for (let l = 1; l <= total; l++) {
    if (saved[l]?.stars) passed++
    else if (current === null) current = l
  }
  const share = passed / total
  return {
    total,
    passed,
    current: current ?? total,
    done: passed === total,
    stars: passed === total ? 3 : share >= 2 / 3 ? 2 : share >= 1 / 3 ? 1 : 0,
    started: passed > 0,
  }
}
