import WORDS from '../data/words.json'
import { loadSeen, loadMistakes } from './storage.js'
import { LEVEL_SIZE } from './levels.js'

export const LEVELS = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6']
// 随机探险 is as long as an island level
export const SET_SIZE = LEVEL_SIZE

const byWord = new Map(WORDS.map((w) => [w.word, w]))

export function countByLevel() {
  const c = {}
  for (const w of WORDS) c[w.grade] = (c[w.grade] || 0) + 1
  return c
}

function shuffle(a) {
  const arr = [...a]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// Prefer words practised least often, so repeated sets keep covering new ground.
function pickFresh(pool, n) {
  const seen = loadSeen()
  return shuffle(pool)
    .sort((a, b) => (seen[a.word] || 0) - (seen[b.word] || 0))
    .slice(0, n)
}

/** source: 'P1'..'P6' | 'mix' | 'upto:P4' | 'review' */
export function buildSet(source, size = SET_SIZE) {
  if (source === 'review') {
    const m = loadMistakes()
    const list = Object.keys(m)
      .sort((a, b) => m[b].count - m[a].count)
      .map((w) => byWord.get(w))
      .filter(Boolean)
    return shuffle(list.slice(0, size))
  }
  if (source === 'mix') return pickFresh(WORDS, size)
  if (source.startsWith('upto:')) {
    const max = LEVELS.indexOf(source.slice(5))
    return pickFresh(WORDS.filter((w) => LEVELS.indexOf(w.grade) <= max), size)
  }
  return pickFresh(WORDS.filter((w) => w.grade === source), size)
}

export function wordsFor(list) {
  return list.map((w) => byWord.get(w)).filter(Boolean)
}
