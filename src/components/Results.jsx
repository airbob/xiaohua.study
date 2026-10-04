import { useEffect, useMemo, useRef, useState } from 'react'
import StrokeReplay from './StrokeReplay.jsx'
import CharCompare from './CharCompare.jsx'
import { Legend } from './Practice.jsx'
import { setScore, wordScore, isPerfect, charNotes, verdict } from '../lib/score.js'
import { recordSet } from '../lib/storage.js'
import { loadChar } from '../lib/chardata.js'

export default function Results({ results, source, onAgain, onRetry, onHome }) {
  const score = useMemo(() => setScore(results), [results])
  const v = verdict(score)
  const [replay, setReplay] = useState(null)
  const saved = useRef(false)
  const wrong = results.filter((r) => !isPerfect(r.chars))

  useEffect(() => {
    if (saved.current) return
    saved.current = true
    recordSet(results.map((r) => ({ word: r.word, perfect: isPerfect(r.chars) })), score, source)
  }, [results, score, source])

  return (
    <main className="results">
      <section className="score-card">
        <div className="stars" aria-label={`${v.stars} 颗星`}>
          {[0, 1, 2].map((i) => (
            <span key={i} className={i < v.stars ? 'star on' : 'star'}>★</span>
          ))}
        </div>
        <div className="score">{score}<small>分</small></div>
        <p className="verdict">{v.text}</p>
        <p className="muted small">
          {results.length - wrong.length} / {results.length} 个词全对
          {wrong.length > 0 && ' · 写错的词已放进错词本'}
        </p>
      </section>

      <section className="panel">
        <h2>每个词</h2>
        <ul className="result-list">
          {results.map((r, i) => (
            <ResultRow key={i} r={r} onReplay={setReplay} />
          ))}
        </ul>
        {wrong.length > 0 && <Legend />}
        <p className="muted small">点「正确」的字，可以看笔顺动画。</p>
      </section>

      <div className="actions">
        {wrong.length > 0 && (
          <button className="btn primary big" onClick={() => onRetry(wrong)}>
            再写一次错的（{wrong.length}）
          </button>
        )}
        <button className={`btn big ${wrong.length ? '' : 'primary'}`} onClick={onAgain}>
          {source === 'review' ? '再练错词本' : '换一组新词'}
        </button>
        <button className="btn ghost" onClick={onHome}>回首页</button>
      </div>

      {replay && <StrokeReplay char={replay} onClose={() => setReplay(null)} />}
    </main>
  )
}

function ResultRow({ r, onReplay }) {
  const ok = isPerfect(r.chars)
  const [data, setData] = useState([])
  useEffect(() => {
    if (!ok) Promise.all(r.chars.map((c) => loadChar(c.char).catch(() => null))).then(setData)
  }, [ok, r])
  return (
    <li className={ok ? 'ok' : 'warn'}>
      <div className="result-main">
        <span className="result-word">
          {r.chars.map((c, j) => (
            <button key={j} className={`glyph ${c.status === 'ok' && !c.hinted ? 'ok' : c.status === 'order' ? 'warn' : 'bad'}`} onClick={() => onReplay(c.char)} title="看笔顺">
              {c.char}
            </button>
          ))}
        </span>
        <span className="result-py">{r.pinyin.join(' ')}</span>
        <span className="result-score">{Math.round(wordScore(r.chars) * 100)}</span>
      </div>
      {!ok && (
        <div className="result-detail">
          {r.chars.map((c, j) =>
            c.status === 'ok' && !c.hinted ? null : (
              <div key={j} className="result-char">
                <CharCompare char={c.char} data={data[j]} strokes={c.strokes} result={c.grade} size={64} onReplay={() => onReplay(c.char)} />
                <ul className="notes">
                  {charNotes(c).map((n, k) => (
                    <li key={k}>{n}</li>
                  ))}
                </ul>
              </div>
            ),
          )}
        </div>
      )}
    </li>
  )
}
