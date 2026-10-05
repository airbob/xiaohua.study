// Google Analytics events. gtag only exists on xiaohua.study (see index.html), so in dev
// and previews every call here is a no-op. Never send personal data: no emails, names,
// or free text — only grades, levels, counts and fixed labels.
const gtag = (...args) => {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') window.gtag(...args)
}

export const track = (name, params = {}) => gtag('event', name, params)

/** The app switches screens without changing the URL; report each as a virtual page. */
export function trackScreen(screen) {
  const path = { home: '/map', practice: '/practice', complete: '/complete', review: '/camp' }[screen] || `/${screen}`
  gtag('event', 'page_view', {
    page_title: { home: '汉字岛地图', practice: '练习', complete: '过关', review: '复习营地' }[screen] || screen,
    page_location: `${window.location.origin}${path}`,
    page_path: path,
  })
}

/** Who is practising, without identifying them: guest / parent / child, and the child's grade. */
export function setAudience({ type, grade }) {
  gtag('set', 'user_properties', { account_type: type, grade: grade || '(none)' })
}
