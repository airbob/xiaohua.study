import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import FreePad, { chrome, frameGap, TOOLS_SIDE, TOOLS_BELOW } from './FreePad.jsx'
import { ResultFrame } from './CharCompare.jsx'
import StrokeReplay from './StrokeReplay.jsx'
import { MascotSays } from './Mascot.jsx'
import { Speaker, Back, Undo, Eraser, Bulb, Question, Check, Chest, Stars } from './Icons.jsx'
import { speakWord, speakSentence, speakPraise, canSpeak } from '../lib/speech.js'
import { pickPraise } from '../lib/praise.js'
import { loadChar, preloadWord } from '../lib/chardata.js'
import { gradeChar } from '../lib/grade.js'
import { isPerfect, charNotes, wordScore, charPoints } from '../lib/score.js'
import { useT } from '../lib/i18n.js'
import { soundCorrect, confettiBurst } from '../lib/celebrate.js'

// keep in sync with the two-column media query in styles.css
const SIDE_LAYOUT = '(min-width: 900px), (orientation: landscape) and (min-width: 640px)'
// keep in sync with the topbar.writing rule in styles.css
const PHONE_UPRIGHT = '(max-width: 760px) and (orientation: portrait)'
// keep in sync with the "phones sideways" block in styles.css
const PHONE_SIDEWAYS = '(orientation: landscape) and (max-height: 520px)'

/** Biggest framed cells that fit the space left for the pad, trying every arrangement. */
function usePadLayout(area, below, n, deps) {
  const [layout, setLayout] = useState({ cell: 200, cols: n, below: false })
  useLayoutEffect(() => {
    const measure = () => {
      const el = area.current
      if (!el) return
      const side = window.matchMedia(SIDE_LAYOUT).matches
      const top = el.getBoundingClientRect().top + window.scrollY
      const vh = window.visualViewport?.height || window.innerHeight
      const W = el.clientWidth
      // side layout: leave room under the cells for the hint line + 听写/描红 switch (~110px);
      // a phone held sideways hides those (styles.css), so only keep a small margin
      const short = window.matchMedia(PHONE_SIDEWAYS).matches
      const H = vh - top - (side ? (short ? 16 : 110) : (below.current?.offsetHeight || 0) + 24)
      // phones upright: size the cells by the width and let the page scroll down to 写好了,
      // keeping a single cell within the screen so a character is never cut off, and a
      // 28px strip where a finger can scroll the page (the cells take all touches)
      const phone = window.matchMedia(PHONE_UPRIGHT).matches
      // each cell's buttons go in a row under it or a column beside it, whichever leaves the
      // bigger cells (beside wins when height is short, e.g. a phone held sideways). Phones
      // upright: beside a single column of stacked cells, under a 2 × 2 grid.
      const placements = (cols) => (phone ? [cols > 1] : [true, false])
      // exact footprint of the framed cells (see FreePad: chrome, gaps, 8px shadow, 14px badge room)
      const fits = (cell, cols, under) => {
        const rows = Math.ceil(n / cols)
        const outer = cell + 2 * chrome(cell)
        const unitW = outer + (under ? 0 : TOOLS_SIDE)
        const unitH = outer + 8 + (under ? TOOLS_BELOW : 0)
        const w = cols * unitW + (cols - 1) * frameGap(cell)
        const h = 14 + rows * unitH + (rows - 1) * (frameGap(cell) + 8)
        return phone ? w <= W - 28 && unitH + 14 <= vh - 120 : w <= W && h <= H
      }
      const stack = phone && n <= 2
      let best = { cell: 100, cols: stack ? 1 : Math.min(n, 2), below: !stack }
      for (let cols = 1; cols <= (stack ? 1 : phone ? 2 : n); cols++) {
        for (const under of placements(cols)) {
          let cell = 560
          while (cell > 100 && !fits(cell, cols, under)) cell -= 2
          if (cell > best.cell) best = { cell, cols, below: under }
        }
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
  const [hinted, setHinted] = useState([]) // per character: peeked at the answer
  const [off, setOff] = useState([]) // per character: 不会写
  const [replay, setReplay] = useState(null)
  const [nudge, setNudge] = useState(false)
  const [streak, setStreak] = useState(0)
  const [praise, setPraise] = useState(null)
  const [bestStreak, setBestStreak] = useState(0)
  const [padKey, setPadKey] = useState(0)
  const startedAt = useRef(Date.now())
  const pad = useRef(null)
  const area = useRef(null)
  const below = useRef(null)
  const side = useRef(null)
  const [sideClipped, setSideClipped] = useState(false)
  const [lift, setLift] = useState(0)

  const item = words[wi]
  const glyphs = [...item.word]
  // Mode is fixed for the whole session: switching 听写 → 描红 mid-word would show the
  // answer as trace strokes. Change it on the home / review screen before starting.
  const [sessionMode] = useState(prefs.mode)
  const trace = sessionMode === 'trace'
  const { cell, cols, below: toolsBelow } = usePadLayout(area, below, glyphs.length, [phase === 'feedback', prefs.showExample, prefs.showEnglish])

  // Two columns: lift 写好了 so its bottom lines up with the cells' button row instead of
  // sitting at the bottom of the screen
  useLayoutEffect(() => {
    const align = () => {
      const padEl = area.current?.querySelector('.freepad')
      if (!padEl || !below.current || !window.matchMedia(SIDE_LAYOUT).matches) return setLift(0)
      const now = parseFloat(getComputedStyle(below.current).marginBottom) || 0
      const want = now + below.current.getBoundingClientRect().bottom - padEl.getBoundingClientRect().bottom
      // ...but never so far that the word card, example and tip above it stop fitting
      const col = side.current
      const room = col ? col.clientHeight - (col.scrollHeight - (col.querySelector('.grow')?.offsetHeight || 0)) + now : want
      setLift(Math.max(0, Math.round(Math.min(want, room))))
    }
    align()
    window.addEventListener('resize', align)
    return () => window.removeEventListener('resize', align)
  }, [cell, cols, phase, wi, prefs.showExample, prefs.showEnglish])

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
    if (per.every((s) => !s.length) && !off.some(Boolean)) {
      setNudge(true)
      setTimeout(() => setNudge(false), 1800)
      return
    }
    setPhase('grading')
    const data = await Promise.all(glyphs.map((g) => loadChar(g).catch(() => null)))
    show(
      glyphs.map((g, i) => {
        if (off[i]) return { char: g, status: 'blank', skipped: true, strokes: [] }
        if (!data[i]) return { char: g, status: 'unavailable', strokes: per[i] }
        const grade = gradeChar(data[i], per[i])
        return { char: g, status: grade.status, grade, strokes: per[i], hinted: !!hinted[i] }
      }),
    )
  }

  // 不会写 for one character (tap again to take it back); when every character is
  // given up there is nothing left to write, so the answers show straight away
  const giveUp = (i) => {
    const o = glyphs.map((_, j) => (j === i ? !off[j] : !!off[j]))
    if (o.every(Boolean)) return show(glyphs.map((g) => ({ char: g, status: 'blank', skipped: true, strokes: [] })))
    setOff(o)
    if (o[i]) pad.current?.clear(i)
  }

  // a retry is practice only: the first attempt is what counts
  const show = (results) => {
    setChars(results)
    setPhase('feedback')
    const perfect = isPerfect(results)
    const s = retrying ? 0 : perfect ? streak + 1 : 0
    if (!retrying) {
      setFinished((f) => [...f, { ...item, chars: results }])
      setStreak(s)
      setBestStreak((b) => Math.max(b, s))
    }
    if (perfect) {
      // the praise grows with the streak; after the frames render, burst from them; the voice follows the chime
      const p = pickPraise(s, praise)
      setPraise(p)
      requestAnimationFrame(() => confettiBurst(area.current))
      if (prefs.sound !== false) {
        soundCorrect()
        setTimeout(() => speakPraise(p), 450)
      }
    }
  }

  // 提示 shows one character for a moment; only that character loses a star
  const doPeek = (i) => {
    if (!charData[i]) return
    setHinted((h) => Object.assign([...h], { [i]: true }))
    setPeek(Object.assign([], { [i]: charData[i] }))
    setTimeout(() => setPeek(null), 1500)
  }

  const next = () => {
    if (wi + 1 >= words.length) return onFinish(finished, { bestStreak, ms: Date.now() - startedAt.current })
    setWi(wi + 1)
    setChars([])
    setHinted([])
    setOff([])
    setRetrying(false)
    setPadKey((k) => k + 1)
    setPhase('writing')
  }

  const retry = () => {
    setRetrying(true)
    setHinted([])
    setOff([])
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
  // while writing, 听句子 sits in the example card next to the sentence (else in the word card)
  const sentenceShown = !feedback && prefs.showExample && !!sentence
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
              <div className="word-text">
                <div className="pinyin">{item.pinyin.join(' ')}</div>
                {feedback && <div className="answer kai">{item.word}</div>}
              </div>
              {canSpeak() && (
                <div className="listen">
                  <button className="btn-chunky orange" onClick={() => speakWord(item.word)}><Speaker /> {feedback ? t('词语') : t('听词语')}</button>
                  {item.example && !sentenceShown && (
                    <button className="btn-chunky" onClick={() => speakSentence(item)}><Speaker /> {feedback ? t('句子') : t('听句子')}</button>
                  )}
                </div>
              )}
            </div>
          </div>

          {!feedback && (sentenceShown || (prefs.showEnglish && item.en)) && (
            <div className="card example-card">
              {sentenceShown && (
                <div className="example-row">
                  <div>
                    <div className="label">{t('例句')}</div>
                    <p className="sentence">
                      {sentence.split(/（[　 ]+）/).map((part, i, arr) => (
                        <span key={i}>
                          {part}
                          {i < arr.length - 1 && <span className="blank" style={{ width: `${glyphs.length * 1.6}em` }} />}
                        </span>
                      ))}
                    </p>
                  </div>
                  {canSpeak() && (
                    <button className="btn-chunky listen-sentence" onClick={() => speakSentence(item)} aria-label={t('听句子')}>
                      <Speaker /> <span>{t('听句子')}</span>
                    </button>
                  )}
                </div>
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
                    {charPoints(c) !== null && <span className="score-points">{t('{n} 分', { n: charPoints(c) })}</span>}
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
                {perfect && praise
                  ? t(praise.text)
                  : retrying
                    ? t('再看看动画，多练几次就会了。')
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
                off={off}
                toolsBelow={toolsBelow}
                tools={(i, cellPad) => (
                  <>
                    <button className="btn-chunky" onClick={cellPad.undo} disabled={!!off[i]} aria-label={t('撤销')}><Undo /><span>{t('撤销')}</span></button>
                    <button className="btn-chunky" onClick={cellPad.clear} disabled={!!off[i]} aria-label={t('擦掉')}><Eraser /><span>{t('擦掉')}</span></button>
                    {!trace && (
                      <button className="btn-chunky cream" onClick={() => doPeek(i)} disabled={!!off[i]} aria-label={t('提示（扣 1 颗星）')}>
                        <Bulb /><span>{t('提示')}</span>
                        <i className="tool-cost">−1★</i>
                      </button>
                    )}
                    <button className={`btn-chunky cream ${off[i] ? 'on' : ''}`} onClick={() => giveUp(i)} aria-pressed={!!off[i]} aria-label={t('不会写')}><Question /><span>{t('不会写')}</span></button>
                  </>
                )}
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

      <div className="play-actions" ref={below} style={!feedback && lift ? { marginBottom: lift } : null}>
        {!feedback ? (
          <>
            <button className="cta green" onClick={submit} disabled={phase === 'grading'}>
              <Check /> {phase === 'grading' ? t('批改中…') : t('写好了')}
            </button>
          </>
        ) : (
          <button className="cta red" onClick={next}>{wi + 1 >= words.length ? t('看成绩') : t('下一个词')}</button>
        )}
      </div>

      {replay && <StrokeReplay char={replay} onClose={() => setReplay(null)} />}
    </div>
  )
}

