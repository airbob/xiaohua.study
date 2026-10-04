import { useEffect, useState } from 'react'
import Home from './components/Home.jsx'
import Practice from './components/Practice.jsx'
import Results from './components/Results.jsx'
import { buildSet, LEVELS } from './lib/bank.js'
import { loadPrefs, savePrefs } from './lib/storage.js'

const DEFAULT_PREFS = { mode: 'dictation', showExample: true, showEnglish: false, autoSpeak: true }

export default function App() {
  const [prefs, setPrefs] = useState(() => ({ ...DEFAULT_PREFS, ...loadPrefs() }))
  const [screen, setScreen] = useState({ name: 'home' })

  const updatePrefs = (p) => {
    const next = { ...prefs, ...p }
    setPrefs(next)
    savePrefs(next)
  }

  const start = (source, words) => {
    const list = words || buildSet(source)
    if (!list.length) return
    setScreen({ name: 'practice', source, words: list, id: Date.now() })
  }

  // Deep link from the word-list pages: /?start=P3 (or ?start=mix) jumps straight into a set.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('start')
    const source = q && (q.toLowerCase() === 'mix' ? 'mix' : LEVELS.find((l) => l === q.toUpperCase()))
    if (source) {
      window.history.replaceState(null, '', window.location.pathname)
      start(source)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (screen.name === 'practice')
    return (
      <Practice
        key={screen.id}
        words={screen.words}
        prefs={prefs}
        onPrefs={updatePrefs}
        onQuit={() => setScreen({ name: 'home' })}
        onFinish={(results) => setScreen({ name: 'results', source: screen.source, results })}
      />
    )
  if (screen.name === 'results')
    return (
      <Results
        results={screen.results}
        source={screen.source}
        onAgain={() => start(screen.source)}
        onRetry={(words) => start(screen.source, words)}
        onHome={() => setScreen({ name: 'home' })}
      />
    )
  return <Home prefs={prefs} onPrefs={updatePrefs} onStart={start} />
}
