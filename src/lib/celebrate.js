// Game sounds (synthesised with Web Audio — no files to download) and confetti.
// Sounds obey the 游戏音效 setting; confetti always shows unless the system asks for
// reduced motion.
import confetti from 'canvas-confetti'

const COLORS = ['#F2A93B', '#E4573D', '#7CC46B', '#8ED6D0', '#FFE08A', '#FFFFFF']

let ctx = null
let master = null

function audio() {
  if (!ctx) {
    const C = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)
    if (!C) return null
    ctx = new C()
    master = ctx.createGain()
    master.gain.value = 0.5
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

// iOS/Safari only let a page make sound after a tap: open the audio context on the first one,
// so the sound after an async check (写好了 → grading) still plays.
if (typeof window !== 'undefined') {
  const unlock = () => {
    const c = audio()
    if (c && c.state === 'running') {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
}

function tone(c, freq, at, dur, { type = 'triangle', gain = 0.22 } = {}) {
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, at)
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(gain, at + 0.015)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  o.connect(g).connect(master)
  o.start(at)
  o.stop(at + dur + 0.05)
}

// note frequencies
const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5, E6 = 1318.5, G4 = 392.0, A5 = 880.0, D6 = 1174.66

/** A word written perfectly: a quick rising do-mi-sol-do with a sparkle on top. */
export function soundCorrect() {
  const c = audio()
  if (!c) return
  const t = c.currentTime + 0.02
  ;[C5, E5, G5, C6].forEach((f, i) => tone(c, f, t + i * 0.07, 0.28))
  tone(c, E6, t + 0.3, 0.35, { type: 'sine', gain: 0.12 })
}

/** A level (10 words) finished: a longer fanfare ending on a full chord. */
export function soundLevelComplete() {
  const c = audio()
  if (!c) return
  const t = c.currentTime + 0.05
  const run = [G4, C5, E5, G5, E5, G5]
  const at = [0, 0.13, 0.26, 0.39, 0.6, 0.73]
  run.forEach((f, i) => tone(c, f, t + at[i], 0.22, { type: 'square', gain: 0.08 }))
  ;[C5, E5, G5, C6].forEach((f) => tone(c, f, t + 0.95, 1.1, { type: 'triangle', gain: 0.16 }))
  ;[A5, C6, D6, E6].forEach((f, i) => tone(c, f, t + 1.0 + i * 0.09, 0.4, { type: 'sine', gain: 0.07 }))
}

/** A small burst, from an element if given (the word's writing frames), else the screen centre. */
export function confettiBurst(el) {
  let origin = { x: 0.5, y: 0.5 }
  if (el) {
    const r = el.getBoundingClientRect()
    origin = { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 3) / window.innerHeight }
  }
  confetti({ particleCount: 70, spread: 75, startVelocity: 38, scalar: 0.9, origin, colors: COLORS, disableForReducedMotion: true, zIndex: 50 })
}

/** Level complete: bursts from both sides for about a second and a half. */
export function confettiParty() {
  const end = Date.now() + 1500
  const shoot = () => {
    confetti({ particleCount: 6, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors: COLORS, disableForReducedMotion: true, zIndex: 50 })
    confetti({ particleCount: 6, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors: COLORS, disableForReducedMotion: true, zIndex: 50 })
    if (Date.now() < end) requestAnimationFrame(shoot)
  }
  confetti({ particleCount: 120, spread: 100, startVelocity: 45, origin: { x: 0.5, y: 0.35 }, colors: COLORS, disableForReducedMotion: true, zIndex: 50 })
  shoot()
}
