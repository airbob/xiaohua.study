// Audio: prefer pre-generated Azure neural voice clips (public/audio, built by
// scripts/gen-tts.mjs), fall back to the browser's own text-to-speech.
import AUDIO from '../data/audio-index.json'

const hasWord = new Set(AUDIO.words || [])
const hasSentence = new Set(AUDIO.sentences || [])
const hasPraise = new Set(AUDIO.praise || [])
const clipUrl = (kind, word) => `/audio/${kind}/${encodeURIComponent(word)}.mp3`

let current = null
function playClip(url, fallbackText) {
  try {
    window.speechSynthesis?.cancel()
    current?.pause()
    current = new Audio(url)
    current.play().catch(() => speak(fallbackText))
  } catch {
    speak(fallbackText)
  }
}

let cached = null
function pickVoice() {
  if (cached) return cached
  const voices = window.speechSynthesis?.getVoices() || []
  const zh = voices.filter((v) => /^zh|cmn/i.test(v.lang))
  cached =
    zh.find((v) => /zh[-_]CN/i.test(v.lang) && /Tingting|Google|Xiaoxiao|Natural/i.test(v.name)) ||
    zh.find((v) => /zh[-_]CN/i.test(v.lang)) ||
    zh.find((v) => /zh[-_](SG|TW)/i.test(v.lang)) ||
    zh[0] ||
    null
  return cached
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    cached = null
  }
}

export const canSpeak = () =>
  typeof window !== 'undefined' && (hasWord.size > 0 || !!window.speechSynthesis)

export function speak(text, { rate = 0.8 } = {}) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  const s = window.speechSynthesis
  s.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'zh-CN'
  u.rate = rate
  const v = pickVoice()
  if (v) u.voice = v
  s.speak(u)
}

export function speakWord(word) {
  if (hasWord.has(word)) playClip(clipUrl('w', word), word)
  else speak(word)
}

export function speakSentence(item) {
  const text = item.example.replace(/（[　 ]+）/, item.word)
  if (hasSentence.has(item.word)) playClip(clipUrl('s', item.word), text)
  else speak(text)
}

/** A praise line from praise.js: its cheerful recorded clip, or the browser voice. */
export function speakPraise(p) {
  if (hasPraise.has(p.id)) playClip(clipUrl('p', p.id), p.text)
  else speak(p.text, { rate: 1 })
}
