import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import FreePad from './FreePad.jsx'
import CharCompare from './CharCompare.jsx'
import StrokeReplay from './StrokeReplay.jsx'
import { speakWord, speakSentence, canSpeak } from '../lib/speech.js'
import { loadChar, preloadWord } from '../lib/chardata.js'
import { gradeChar } from '../lib/grade.js'
import { isPerfect, charNotes, STATUS_LABEL } from '../lib/score.js'

const GAP = 0.06
// keep in sync with the side-by-side layout media query in styles.css
const SIDE_LAYOUT = '(orientation: landscape) and (min-width: 640px)'

// Biggest square cell that fits the space left for the pad: try every arrangement
// (one row, one column, 2×2 …) and keep the one with the largest cells. On a phone in
// portrait that stacks the characters vertically; in landscape it lays them out in a row.
function usePadLayout(area, tools, footer, n, deps) {
  const [layout, setLayout] = useState({ cell: 200, cols: n })
  useLayoutEffect(() => {
    const measure = () => {
      const el = area.current
      if (!el) return
      const side = window.matchMedia(SIDE_LAYOUT).matches // landscape: pad has its own column
      const top = el.getBoundingClientRect().top + window.scrollY
      const vh = window.visualViewport?.height || window.innerHeight
      const below = side ? 12 : (tools.current?.offsetHeight || 0) + (footer.current?.offsetHeight || 0) + 28
      const W = el.clientWidth
      const H = vh - top - below
      let best = { cell: 0, cols: n }
      for (let cols = 1; cols <= n; cols++) {
        const rows = Math.ceil(n / cols)
        const cell = Math.min(W / (cols + (cols - 1) * GAP), H / (rows + (rows - 1) * GAP))
        if (cell > best.cell + 2) best = { cell, cols }
      }
      setLayout({ cols: best.cols, cell: Math.floor(Math.max(110, Math.min(440, best.cell))) })
    }
    measure()
    window.addEventListener('resize', measure)
    window.visualViewport?.addEventListener('resize', measure)
    window.addEventListener('orientationchange', measure)
    return () => {
      window.removeEventListener('resize', measure)
      window.visualViewport?.removeEventListener('resize', measure)
      window.removeEventListener('orientationchange', measure)
    }
  }, [n, ...deps]) // eslint-disable-line react-hooks/exhaustive-deps
  return layout
}

export default function Practice({ words, prefs, onPrefs, onQuit, onFinish }) {
  const [wi, setWi] = useState(0)
  const [phase, setPhase] = useState('writing') // writing | grading | feedback
  const [chars, setChars] = useState([])
  const [finished, setFinished] = useState([])
  const [charData, setCharData] = useState([])
  const [peek, setPeek] = useState(null)
  const [hinted, setHinted] = useState(false)
  const [replay, setReplay] = useState(null)
  const [nudge, setNudge] = useState(false)
  const [copied, setCopied] = useState(false)
  const pad = useRef(null)
  const area = useRef(null)
  const tools = useRef(null)
  const footer = useRef(null)

  const item = words[wi]
  const glyphs = [...item.word]
  const trace = prefs.mode === 'trace'
  const { cell, cols } = usePadLayout(area, tools, footer, glyphs.length, [phase === 'feedback', prefs.showExample, prefs.showEnglish])

  useEffect(() => {
    let live = true
    setCharData([])
    Promise.all(glyphs.map((g) => loadChar(g).catch(() => null))).then((d) => live && setCharData(d))
    if (words[wi + 1]) preloadWord(words[wi + 1].word)
    const t = prefs.autoSpeak ? setTimeout(() => speakWord(item.word), 250) : null
    return () => {
      live = false
      clearTimeout(t)
    }
  }, [wi]) // eslint-disable-line react-hooks/exhaustive-deps

  const finishWord = (results) => {
    setChars(results)
    setFinished((f) => [...f, { ...item, chars: results }])
    setPhase('feedback')
    setCopied(false)
    if (isPerfect(results)) speakWord('对了')
  }

  const submit = async () => {
    const per = pad.current.getStrokes()
    if (per.every((s) => !s.length)) {
      setNudge(true)
      setTimeout(() => setNudge(false), 1500)
      return
    }
    setPhase('grading')
    const data = await Promise.all(glyphs.map((g) => loadChar(g).catch(() => null)))
    finishWord(
      glyphs.map((g, i) => {
        if (!data[i]) return { char: g, status: 'unavailable', strokes: per[i] }
        const grade = gradeChar(data[i], per[i])
        return { char: g, status: grade.status, grade, strokes: per[i], hinted }
      }),
    )
  }

  const giveUp = () => {
    const per = pad.current?.getStrokes() || glyphs.map(() => [])
    finishWord(glyphs.map((g, i) => ({ char: g, status: 'blank', skipped: true, strokes: per[i] })))
  }

  const doPeek = () => {
    if (!charData.length) return
    setHinted(true)
    setPeek(charData)
    setTimeout(() => setPeek(null), 1500)
  }

  const advance = () => {
    if (wi + 1 >= words.length) return onFinish(finished)
    setWi(wi + 1)
    setChars([])
    setHinted(false)
    setPhase('writing')
  }

  const perfect = phase === 'feedback' && isPerfect(chars)
  const sentence = item.example
    ? phase === 'feedback'
      ? item.example.replace(/（[　 ]+）/, item.word)
      : item.example
    : null

  return (
    <main className="practice" onContextMenu={(e) => e.preventDefault()}>
      <header className="topbar">
        <button className="btn ghost" onClick={onQuit} aria-label="退出">✕</button>
        <div className="progress" aria-label={`第 ${wi + 1} 个，共 ${words.length} 个`}>
          <div className="progress-fill" style={{ width: `${((wi + (phase === 'feedback' ? 1 : 0)) / words.length) * 100}%` }} />
        </div>
        <span className="count">{wi + 1}/{words.length}</span>
      </header>

      <div className={`stage ${phase === 'feedback' ? 'is-feedback' : ''}`}>
      <section className="prompt">
        <div className="pinyin-line">
          {item.pinyin.map((p, i) => (
            <span key={i} className="py">{p}</span>
          ))}
        </div>
        {phase === 'feedback' && <div className="answer-word">{item.word}</div>}
        <div className="prompt-tools">
          {canSpeak() ? (
            <>
              <button className="btn sound" onClick={() => speakWord(item.word)}>🔊 读词语</button>
              {item.example && (
                <button className="btn sound soft" onClick={() => speakSentence(item)}>🔊 读句子</button>
              )}
            </>
          ) : (
            <span className="muted small">这个浏览器不支持朗读</span>
          )}
        </div>
        {prefs.showExample && sentence && <p className="example">{sentence}</p>}
        {prefs.showEnglish && item.en && <p className="english">{item.en}</p>}
      </section>

      <section className="write" ref={area}>
        {phase !== 'feedback' ? (
          <>
            <FreePad
              key={wi}
              ref={pad}
              glyphs={glyphs}
              cell={cell}
              cols={cols}
              traceData={trace && charData.length ? charData : null}
              peek={peek}
            />
          </>
        ) : (
          <div className={`feedback ${perfect ? 'good' : 'needs'}`}>
            {perfect ? (
              <p className="feedback-msg">✓ 全对！</p>
            ) : (
              <p className="feedback-msg warn">看看哪里要改</p>
            )}
            <div className="feedback-chars">
              {chars.map((c, i) => (
                <div key={i} className={`fchar ${c.status}`}>
                  <div className="fchar-head">
                    <b className="kai">{c.char}</b>
                    <span className={`tag ${c.skipped ? 'blank' : c.status}`}>
                      {c.skipped ? '不会' : STATUS_LABEL[c.status]}
                    </span>
                  </div>
                  <CharCompare
                    char={c.char}
                    data={charData[i]}
                    strokes={c.strokes}
                    result={c.grade}
                    size={compareSize(area.current?.clientWidth || 320, chars.length)}
                    onReplay={() => setReplay(c.char)}
                  />
                  {!(c.status === 'ok' && !c.hinted) && (
                    <ul className="notes">
                      {charNotes(c).map((n, k) => (
                        <li key={k}>{n}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
            <Legend />
            <button className="link-btn" onClick={() => copySample(item.word, chars).then(() => setCopied(true))}>
              {copied ? '已复制笔迹，发给我们就能改进批改' : '判得不对？复制笔迹'}
            </button>
            <button className="btn primary big" onClick={advance}>
              {wi + 1 >= words.length ? '看成绩' : '下一个 →'}
            </button>
          </div>
        )}
      </section>

      {phase !== 'feedback' && (
        <section className="tools" ref={tools}>
            <div className="pad-tools">
            <button className="btn" onClick={() => pad.current?.undo()}>↶ 撤销</button>
            <button className="btn" onClick={() => pad.current?.clear()}>清除</button>
            {!trace && <button className="btn" onClick={doPeek}>💡 偷看</button>}
            <button className="btn" onClick={giveUp}>🙈 不会写</button>
          </div>
          <button className="btn primary big submit" onClick={submit} disabled={phase === 'grading'}>
            {phase === 'grading' ? '批改中…' : '✓ 写好了'}
          </button>
          <p className={`muted small center write-hint ${nudge ? 'nudge' : ''}`}>
            {nudge ? '先在格子里写字哦' : `把整个词写在格子里，一格一个字，写完按「写好了」。`}
          </p>
        </section>
      )}
      </div>

      <footer className="mode-switch" ref={footer}>
        <button className={!trace ? 'on' : ''} onClick={() => onPrefs({ mode: 'dictation' })}>听写</button>
        <button className={trace ? 'on' : ''} onClick={() => onPrefs({ mode: 'trace' })}>描红</button>
      </footer>

      {replay && <StrokeReplay char={replay} onClose={() => setReplay(null)} />}
    </main>
  )
}

// Thumbnail size on the feedback card: two characters side by side when there's room.
function compareSize(width, n) {
  const perRow = width >= 480 ? Math.min(n, 2) : 1
  return Math.max(64, Math.min(110, Math.floor((width - 40) / perRow / 2.5)))
}

// Raw strokes of a graded word, so a misjudged answer can be sent back and used to tune grading.
function copySample(word, chars) {
  const round = (v) => Math.round(v * 1000) / 1000
  const sample = {
    word,
    at: new Date().toISOString(),
    chars: chars.map((c) => ({ char: c.char, status: c.status, strokes: (c.strokes || []).map((s) => s.map(([x, y]) => [round(x), round(y)])) })),
  }
  const text = JSON.stringify(sample)
  console.log('[xhw sample]', text)
  return navigator.clipboard?.writeText(text).catch(() => {}) ?? Promise.resolve()
}

export function Legend() {
  return (
    <p className="legend">
      <span className="dot ok" />对 <span className="dot order" />笔顺错 <span className="dot backwards" />方向反
      <span className="dot extra" />写错/漏写
    </p>
  )
}
