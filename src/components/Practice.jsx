import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import FreePad, { chrome, frameGap } from './FreePad.jsx'
import { ResultFrame } from './CharCompare.jsx'
import StrokeReplay from './StrokeReplay.jsx'
import { MascotSays } from './Mascot.jsx'
import { Speaker, Back, Undo, Eraser, Check, Chest, Stars } from './Icons.jsx'
import { speakWord, speakSentence, canSpeak } from '../lib/speech.js'
import { loadChar, preloadWord } from '../lib/chardata.js'
import { gradeChar } from '../lib/grade.js'
import { isPerfect, charNotes, wordScore } from '../lib/score.js'
import { useT } from '../lib/i18n.js'
import { soundCorrect, confettiBurst } from '../lib/celebrate.js'

// keep in sync with the two-column media query in styles.css
const SIDE_LAYOUT = '(min-width: 900px), (orientation: landscape) and (min-width: 640px)'

/** Biggest framed cells that fit the space left for the pad, trying every arrangement. */
function usePadLayout(area, below, n, deps) {
  const [layout, setLayout] = useState({ cell: 200, cols: n })
  useLayoutEffect(() => {
    const measure = () => {
      const el = area.current
      if (!el) return
      const side = window.matchMedia(SIDE_LAYOUT).matches
      const top = el.getBoundingClientRect().top + window.scrollY
      const vh = window.visualViewport?.height || window.innerHeight
      const W = el.clientWidth
      // side layout: leave room under the cells for the hint line + 听写/描红 switch (~110px)
      const H = vh - top - (side ? 110 : (below.current?.offsetHeight || 0) + 24)
      // exact footprint of the framed cells (see FreePad: chrome, gaps, 8px shadow, 14px badge room)
      const fits = (cell, cols) => {
        const rows = Math.ceil(n / cols)
        const outer = cell + 2 * chrome(cell)
        const w = cols * outer + (cols - 1) * frameGap(cell)
        const h = 14 + rows * (outer + 8) + (rows - 1) * (frameGap(cell) + 8)
        return w <= W && h <= H
      }
      let best = { cell: 100, cols: Math.min(n, 2) }
      for (let cols = 1; cols <= n; cols++) {
        let cell = 380
        while (cell > 100 && !fits(cell, cols)) cell -= 2
        if (cell > best.cell) best = { cell, cols }
      }
      setLayout(best)
    }
    measure()
    window.addEventListener('resize', measure)
    window.visualViewport?.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('resize', measure)
      window.visualViewport?.removeEventListener('resize', measure)
    }
  }, [n, ...deps]) // eslint-disable-line react-hooks/exhaustive-deps
  return layout
}

const charStars = (c) => (c.skipped || c.status === 'blank' ? 0 : c.status === 'ok' ? (c.hinted ? 2 : 3) : c.status === 'order' ? 2 : c.status === 'unavailable' ? 3 : 1)
const wordStars = (chars) => {
  const s = wordScore(chars)
  return isPerfect(chars) ? 3 : s >= 0.6 ? 2 : s > 0 ? 1 : 0
}
const verdictOf = (c) => (c.status === 'ok' || c.status === 'unavailable' ? (c.hinted ? 'order' : 'ok') : c.status === 'order' ? 'order' : 'wrong')
const CHAR_LABEL = { ok: '写对了', order: '差一点', wrong: '要再练', blank: '没写出来' }

const TIPS = {
  dictation: ['听一听，想一想，再把整个词写在格子里。', '一格写一个字，写完按「写好了」。', '不确定的话，可以按「提示」偷看一下。'],
  trace: ['跟着浅色的字写，橙色小点是下一笔的起点。', '描红热身：一笔一笔慢慢写。'],
}

/**
 * One set of words. title: e.g. 'P3 · 第 4 关'. onFinish(results, { bestStreak, ms }).
 */
export default function Practice({ words, title, prefs, onQuit, onFinish }) {
  const t = useT()
  const [wi, setWi] = useState(0)
  const [phase, setPhase] = useState('writing') // writing | grading | feedback
  const [chars, setChars] = useState([])
  const [finished, setFinished] = useState([])
  const [retrying, setRetrying] = useState(false)
  const [charData, setCharData] = useState([])
  const [peek, setPeek] = useState(null)
  const [hinted, setHinted] = useState(false)
  const [replay, setReplay] = useState(null)
  const [nudge, setNudge] = useState(false)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [padKey, setPadKey] = useState(0)
  const startedAt = useRef(Date.now())
  const pad = useRef(null)
  const area = useRef(null)
  const below = useRef(null)
  const side = useRef(null)
  const [sideClipped, setSideClipped] = useState(false)

  const item = words[wi]
  const glyphs = [...item.word]
  // Mode is fixed for the whole session: switching 听写 → 描红 mid-word would show the
  // answer as trace strokes. Change it on the home / review screen before starting.
  const [sessionMode] = useState(prefs.mode)
  const trace = sessionMode === 'trace'
  const { cell, cols } = usePadLayout(area, below, glyphs.length, [phase === 'feedback', prefs.showExample, prefs.showEnglish])

  // While writing, the side column is a fixed-height scroll area (so 写好了 stays on
  // screen). When its content doesn't fit, fade the bottom edge instead of cutting a
  // card in half, until the child scrolls to the end.
  useLayoutEffect(() => {
    const el = side.current
    if (!el) return
    const check = () => setSideClipped(el.scrollTop + el.clientHeight < el.scrollHeight - 2)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    for (const c of el.children) ro.observe(c)
    el.addEventListener('scroll', check, { passive: true })
    return () => {
      ro.disconnect()
      el.removeEventListener('scroll', check)
    }
  }, [wi, phase])

  useEffect(() => {
    let live = true
    setCharData([])
    Promise.all(glyphs.map((g) => loadChar(g).catch(() => null))).then((d) => live && setCharData(d))
    if (words[wi + 1]) preloadWord(words[wi + 1].word)
    const t = prefs.autoSpeak ? setTimeout(() => speakWord(item.word), 300) : null
    return () => {
      live = false
      clearTimeout(t)
    }
  }, [wi]) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    const per = pad.current.getStrokes()
    if (per.every((s) => !s.length)) {
      setNudge(true)
      setTimeout(() => setNudge(false), 1800)
      return
    }
    setPhase('grading')
    const data = await Promise.all(glyphs.map((g) => loadChar(g).catch(() => null)))
    show(
      glyphs.map((g, i) => {
        if (!data[i]) return { char: g, status: 'unavailable', strokes: per[i] }
        const grade = gradeChar(data[i], per[i])
        return { char: g, status: grade.status, grade, strokes: per[i], hinted }
      }),
    )
  }

  const giveUp = () => {
    const per = pad.current?.getStrokes() || glyphs.map(() => [])
    show(glyphs.map((g, i) => ({ char: g, status: 'blank', skipped: true, strokes: per[i] })))
  }

  // a retry is practice only: the first attempt is what counts
  const show = (results) => {
    setChars(results)
    setPhase('feedback')
    const perfect = isPerfect(results)
    if (!retrying) {
      setFinished((f) => [...f, { ...item, chars: results }])
      const s = perfect ? streak + 1 : 0
      setStreak(s)
      setBestStreak((b) => Math.max(b, s))
    }
    if (perfect) {
      // after the frames render, burst from them; the voice follows the chime
      requestAnimationFrame(() => confettiBurst(area.current))
      if (prefs.sound !== false) {
        soundCorrect()
        setTimeout(() => speakWord('对了'), 450)
      }
    }
  }

  const doPeek = () => {
    if (!charData.length) return
    setHinted(true)
    setPeek(charData)
    setTimeout(() => setPeek(null), 1500)
  }

  const next = () => {
    if (wi + 1 >= words.length) return onFinish(finished, { bestStreak, ms: Date.now() - startedAt.current })
    setWi(wi + 1)
    setChars([])
    setHinted(false)
    setRetrying(false)
    setPadKey((k) => k + 1)
    setPhase('writing')
  }

  const retry = () => {
    setRetrying(true)
    setHinted(false)
    setChars([])
    setPadKey((k) => k + 1)
    setPhase('writing')
  }

  const feedback = phase === 'feedback'
  const perfect = feedback && isPerfect(chars)
  const sentence = item.example
    ? feedback
      ? item.example.replace(/（[　 ]+）/, item.word)
      : item.example
    : null
  const firstBad = chars.find((c) => !(c.status === 'ok' && !c.hinted) && c.status !== 'unavailable')
  const results = finished // first attempts so far
  const tip = TIPS[trace ? 'trace' : 'dictation'][wi % TIPS[trace ? 'trace' : 'dictation'].length]

  return (
    <div className={`play-page ${feedback ? 'is-feedback' : ''}`}>
      <header className="play-head">
        <button className="btn-chunky back" onClick={onQuit} aria-label={t('回到地图')}>
          <Back /> <span className="hide-sm">{t('地图')}</span>
        </button>
        <div className="level-badge display">{title}</div>
        <ol className="track" aria-label={t('第 {i} 个词，共 {n} 个', { i: wi + 1, n: words.length })}>
          {words.map((w, i) => {
            const r = results[i]
            const cls = r ? (isPerfect(r.chars) ? 'done' : 'miss') : i === wi ? 'now' : ''
            return <li key={i} className={cls} />
          })}
          <li className="track-chest" aria-hidden="true"><Chest size={34} /></li>
        </ol>
        <div className="streak">{t('连对')} ×{streak}</div>
      </header>

      <div className="play-body">
        <section className={`play-side ${sideClipped ? 'clipped' : ''}`} ref={side}>
          <div className="word-card">
            <div className="word-card-inner">
              <div className="pinyin">{item.pinyin.join(' ')}</div>
              {feedback && <div className="answer kai">{item.word}</div>}
              {canSpeak() && (
                <div className="listen">
                  <button className="btn-chunky orange" onClick={() => speakWord(item.word)}><Speaker /> {feedback ? t('词语') : t('再听词语')}</button>
                  {item.example && (
                    <button className="btn-chunky" onClick={() => speakSentence(item)}><Speaker /> {feedback ? t('句子') : t('听句子')}</button>
                  )}
                </div>
              )}
            </div>
          </div>

          {!feedback && (prefs.showExample || prefs.showEnglish) && (sentence || item.en) && (
            <div className="card example-card">
              {prefs.showExample && sentence && (
                <>
                  <div className="label">{t('例句')}</div>
                  <p className="sentence">
                    {sentence.split(/（[　 ]+）/).map((part, i, arr) => (
                      <span key={i}>
                        {part}
                        {i < arr.length - 1 && <span className="blank" style={{ width: `${glyphs.length * 1.6}em` }} />}
                      </span>
                    ))}
                  </p>
                </>
              )}
              {prefs.showEnglish && item.en && <p className="en">{item.en}</p>}
            </div>
          )}

          {feedback && (
            <div className="card word-score">
              <h2 className="display">{t('这个词的成绩')}</h2>
              {chars.map((c, i) => {
                const v = c.skipped || c.status === 'blank' ? 'blank' : verdictOf(c)
                const notes = charNotes(c).filter((n) => n !== t('全对'))
                return (
                  <div key={i} className={`score-row ${v}`}>
                    <span className="score-char kai">{c.char}</span>
                    <span className="score-text">
                      <b>{t(CHAR_LABEL[v])}</b>
                      <span>{v === 'ok' ? t('笔顺正确') : notes.join(t('，'))}</span>
                    </span>
                    <Stars n={charStars(c)} />
                  </div>
                )
              })}
            </div>
          )}

          <div className="grow" />

          <div className="hide-sm">
            {feedback ? (
              <MascotSays mood={perfect ? 'happy' : 'worried'} tone="cream">
                {retrying
                  ? perfect ? t('这次写对啦！') : t('再看看动画，多练几次就会了。')
                  : perfect
                    ? `${t('全对！')}${streak >= 2 ? t('已经连对 {n} 个了！', { n: streak }) : t('继续加油！')}`
                    : t('「{w}」我帮你放进复习营地了，明天再来救它！', { w: item.word })}
              </MascotSays>
            ) : (
              <MascotSays mood="look">{nudge ? t('先在格子里写字哦！') : t(tip)}</MascotSays>
            )}
          </div>
        </section>

        <section className="play-main" ref={area}>
          {!feedback ? (
            <>
              <FreePad
                key={`${wi}-${padKey}`}
                ref={pad}
                glyphs={glyphs}
                cell={cell}
                cols={cols}
                traceData={trace && charData.length ? charData : null}
                peek={peek}
              />
              <p className={`pad-hint ${nudge ? 'nudge' : 'hide-sm'}`}>
                {nudge ? t('先在格子里写字哦！') : trace ? t('橙色小点是下一笔的起点 · 写完按「写好了」') : glyphs.length > 1 ? t('一格一个字 · 写完{n}个字按「写好了」', { n: glyphs.length }) : t('一格一个字 · 写完按「写好了」')}
              </p>
              <span className="mode-tag hide-sm">{trace ? t('描红热身') : t('听写挑战')}</span>
            </>
          ) : (
            <>
              <div className="result-frames" style={{ gridTemplateColumns: `repeat(${cols}, auto)`, gap: `${frameGap(cell) + 30}px ${frameGap(cell)}px` }}>
                {chars.map((c, i) => (
                  <ResultFrame
                    key={i}
                    char={c.char}
                    data={charData[i]}
                    strokes={c.strokes}
                    result={c.grade}
                    verdict={c.skipped || c.status === 'blank' ? 'wrong' : verdictOf(c)}
                    size={Math.max(100, cell - chrome(cell) + 7)}
                    onReplay={() => setReplay(c.char)}
                  />
                ))}
              </div>
              <div className="card word-stars">
                <span className="display">{t('本词得分')}</span>
                <Stars n={wordStars(chars)} className="big" />
                {!perfect && firstBad && (
                  <button className="btn-chunky soft" onClick={retry}>{t('再写一次')}</button>
                )}
              </div>
              {retrying && <p className="pad-hint">{t('再写一次是练习，不会改变这一关的成绩。')}</p>}
            </>
          )}
        </section>
      </div>

      <div className="play-actions" ref={below}>
        {!feedback ? (
          <>
            <div className="tools">
              <button className="btn-chunky" onClick={() => pad.current?.undo()}><Undo /> {t('撤销')}</button>
              <button className="btn-chunky" onClick={() => pad.current?.clear()}><Eraser /> {t('擦掉')}</button>
              {!trace && (
                <button className="btn-chunky cream hint-btn" onClick={doPeek}>
                  {t('提示')}<span>{t('扣 1 颗星')}</span>
                </button>
              )}
              <button className={`btn-chunky cream ${trace ? '' : 'show-sm'}`} onClick={giveUp}>{t('不会写')}</button>
            </div>
            <button className="cta green" onClick={submit} disabled={phase === 'grading'}>
              <Check /> {phase === 'grading' ? t('批改中…') : t('写好了')}
            </button>
            {!trace && <button className="link-btn give-up hide-sm" onClick={giveUp}>{t('不会写，看答案')}</button>}
          </>
        ) : (
          <button className="cta red" onClick={next}>{wi + 1 >= words.length ? t('看成绩') : t('下一个词')}</button>
        )}
      </div>

      {replay && <StrokeReplay char={replay} onClose={() => setReplay(null)} />}
    </div>
  )
}

