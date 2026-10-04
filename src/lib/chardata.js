// Stroke data (outline paths + median lines) from the hanzi-writer-data package,
// the same source Hanzi Writer itself uses. Cached per character for the session.
const URL_BASE = 'https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1/'
const cache = new Map()

export function loadChar(char) {
  if (!cache.has(char)) {
    const p = fetch(URL_BASE + encodeURIComponent(char) + '.json')
      .then((r) => {
        if (!r.ok) throw new Error(`no stroke data for ${char}`)
        return r.json()
      })
      .catch((e) => {
        cache.delete(char)
        throw e
      })
    cache.set(char, p)
  }
  return cache.get(char)
}

export const preloadWord = (word) => Promise.allSettled([...word].map(loadChar))
