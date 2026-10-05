// Interface language (中文 / English). Strings are written in Chinese in the code and wrapped in
// t('…'); src/i18n/en.js maps each one to English. A missing entry falls back to the Chinese.
// The study content — characters, pinyin, example sentences — is never translated.
// Language: ?lang=en|zh (shareable links) > saved choice > 中文.
import { useSyncExternalStore } from 'react'
import EN from '../i18n/en.js'

const KEY = 'xhw.lang'
const subs = new Set()

function save(l) {
  try {
    localStorage.setItem(KEY, l)
  } catch {
    /* ignore */
  }
}

function initial() {
  if (typeof window === 'undefined') return 'zh'
  const q = new URLSearchParams(window.location.search).get('lang')
  if (q === 'en' || q === 'zh') {
    save(q)
    return q
  }
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'en' || v === 'zh') return v
  } catch {
    /* ignore */
  }
  return 'zh'
}

let lang = initial()
if (typeof document !== 'undefined') document.documentElement.lang = lang === 'en' ? 'en' : 'zh-Hans'

export const getLang = () => lang

export function setLang(l) {
  if (l === lang) return
  lang = l
  save(l)
  document.documentElement.lang = l === 'en' ? 'en' : 'zh-Hans'
  subs.forEach((f) => f())
}

export const useLang = () =>
  useSyncExternalStore(
    (f) => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => lang,
  )

/** A string in a given language, regardless of the current one (e.g. notes stored in Chinese). */
export function tIn(l, zh, vars) {
  let s = l === 'en' ? (EN[zh] ?? zh) : zh
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''))
  return s
}

/** t('再写 {n} 个词', { n: 3 }) */
export const t = (zh, vars) => tIn(lang, zh, vars)

/** Use in components: subscribes to language changes so the component re-renders. */
export function useT() {
  useLang()
  return t
}
