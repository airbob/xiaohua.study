// 汉字岛 levels: each grade's word list (most frequent first) is cut into levels of ~10
// words. A finished level earns 1–3 stars from how many words were written perfectly.
import WORDS from '../data/words.json'

export const GRADES = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6']
const byGrade = Object.fromEntries(GRADES.map((g) => [g, WORDS.filter((w) => w.grade === g)]))

/** Even split into levels of 9–10 words (P1's 101 words → 11 levels, no 1-word leftover). */
function split(list) {
  const count = Math.ceil(list.length / 10)
  const out = []
  let start = 0
  for (let i = 0; i < count; i++) {
    const size = Math.floor(list.length / count) + (i < list.length % count ? 1 : 0)
    out.push(list.slice(start, start + size))
    start += size
  }
  return out
}
const levelsOf = Object.fromEntries(GRADES.map((g) => [g, split(byGrade[g])]))

export const levelCount = (grade) => levelsOf[grade].length
export const levelWords = (grade, level) => levelsOf[grade][level - 1] || []
export const gradeWordCount = (grade) => byGrade[grade].length

/** 3 stars: at most one word wrong · 2 stars: 70% right · otherwise 1 star for finishing. */
export function starsFor(correct, n) {
  if (correct >= n - 1) return 3
  if (correct >= Math.ceil(n * 0.7)) return 2
  return 1
}

/** How many more perfect words would have earned the next star (null at 3 stars). */
export function toNextStar(correct, n) {
  const s = starsFor(correct, n)
  if (s === 3) return null
  return (s === 2 ? n - 1 : Math.ceil(n * 0.7)) - correct
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
