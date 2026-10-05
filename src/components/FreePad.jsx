import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { RefGlyph } from './CharCompare.jsx'
import { useT } from '../lib/i18n.js'

/** Frame chrome around a writing cell (wood padding + borders), shared with the layout maths. */
export const chrome = (cell) => Math.round(Math.min(12, Math.max(6, cell * 0.035))) + 7
export const frameGap = (cell) => Math.round(Math.max(14, cell * 0.09))

/** The dashed 田字格 lines inside a cell. */
export function Grid({ size }) {
  const c = size / 2
  return (
    <g aria-hidden="true">
      <path d={`M${c} 0V${size}M0 ${c}H${size}`} stroke="#E7B9A0" strokeWidth="2" strokeDasharray="10 8" />
      <path d={`M0 0L${size} ${size}M${size} 0L0 ${size}`} stroke="#F1D5C6" strokeWidth="2" strokeDasharray="8 8" />
    </g>
  )
}

/**
 * Whole-word writing pad: one wooden-framed 田字格 per character, written freely — nothing is
 * corrected while writing. A stroke belongs to the cell it starts in.
 * getStrokes() → per cell, strokes in writing order, points normalised to 0..1 of the cell.
 */
const FreePad = forwardRef(function FreePad({ glyphs, cell, cols, traceData, peek }, ref) {
  const t = useT()
  const [strokes, setStrokes] = useState([]) // { cell, pts: [[x, y] in 0..1] }
  const wrap = useRef(null)
  const papers = useRef([])
  const drawing = useRef(null)

  // iOS starts a text selection / callout on long press unless touchstart is cancelled,
  // and React's touch listeners are passive, so attach native ones.
  useEffect(() => {
    const el = wrap.current
    const stop = (e) => e.preventDefault()
    el.addEventListener('touchstart', stop, { passive: false })
    el.addEventListener('touchmove', stop, { passive: false })
    return () => {
      el.removeEventListener('touchstart', stop)
      el.removeEventListener('touchmove', stop)
    }
  }, [])

  // the cell under the pointer, or the nearest one when starting in a gap
  const cellAt = (x, y) => {
    let best = 0
    let bestD = Infinity
    papers.current.forEach((el, i) => {
      if (!el) return
      const r = el.getBoundingClientRect()
      const dx = Math.max(r.left - x, 0, x - r.right)
      const dy = Math.max(r.top - y, 0, y - r.bottom)
      const d = dx * dx + dy * dy
      if (d < bestD) {
        bestD = d
        best = i
      }
    })
    return best
  }
  const norm = (i, e) => {
    const r = papers.current[i].getBoundingClientRect()
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]
  }

  const down = (e) => {
    e.preventDefault()
    wrap.current.setPointerCapture(e.pointerId)
    const i = cellAt(e.clientX, e.clientY)
    drawing.current = { id: e.pointerId, cell: i, pts: [norm(i, e)] }
    setStrokes((s) => [...s, drawing.current])
  }
  const move = (e) => {
    const d = drawing.current
    if (!d || d.id !== e.pointerId) return
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e]
    for (const ev of events) d.pts.push(norm(d.cell, ev))
    setStrokes((s) => [...s.slice(0, -1), { ...d }])
  }
  const up = (e) => {
    if (drawing.current?.id === e.pointerId) drawing.current = null
  }

  useImperativeHandle(ref, () => ({
    undo: () => setStrokes((s) => s.slice(0, -1)),
    clear: () => setStrokes([]),
    count: () => strokes.length,
    getStrokes: () => glyphs.map((_, i) => strokes.filter((s) => s.cell === i).map((s) => s.pts)),
  }))

  const fp = chrome(cell) - 7
  const ink = Math.max(6, Math.round(cell / 21))
  return (
    <div
      ref={wrap}
      className="freepad"
      style={{ gridTemplateColumns: `repeat(${cols}, auto)`, gap: `${frameGap(cell) + 8}px ${frameGap(cell)}px` }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onContextMenu={(e) => e.preventDefault()}
    >
      {glyphs.map((g, i) => {
        const mine = strokes.filter((s) => s.cell === i)
        const data = traceData?.[i]
        const next = data && mine.length < data.medians.length ? data.medians[mine.length] : null
        const k = cell / 1024
        return (
          <div key={i} className="frame" style={{ padding: fp }}>
            {data && (
              <div className="frame-badge">
                {mine.length < data.medians.length ? t('第 {i} / {n} 笔', { i: mine.length + 1, n: data.medians.length }) : t('写完啦')}
              </div>
            )}
            <div className="paper" ref={(el) => (papers.current[i] = el)} style={{ width: cell, height: cell }}>
              <svg width={cell} height={cell} viewBox={`0 0 ${cell} ${cell}`}>
                <Grid size={cell} />
                {(data || peek?.[i]) && (
                  <RefGlyph data={data || peek[i]} size={cell} color={peek?.[i] ? '#F2B8A8' : '#EADFCB'} />
                )}
                {next && (
                  <g aria-hidden="true">
                    <polyline
                      points={next.slice(0, Math.max(2, Math.ceil(next.length / 2))).map(([x, y]) => `${x * k},${(900 - y) * k}`).join(' ')}
                      fill="none" stroke="#F2A93B" strokeWidth={Math.max(3, cell / 70)} strokeDasharray="4 8" strokeLinecap="round"
                    />
                    <circle cx={next[0][0] * k} cy={(900 - next[0][1]) * k} r={Math.max(6, cell / 40)} fill="#F2A93B" stroke="#1B1B26" strokeWidth="3" />
                  </g>
                )}
                {mine.map((s, j) => (
                  <polyline
                    key={j}
                    points={s.pts.map(([x, y]) => `${x * cell},${y * cell}`).join(' ')}
                    fill="none" stroke="#1B1B26" strokeWidth={ink} strokeLinecap="round" strokeLinejoin="round"
                  />
                ))}
              </svg>
            </div>
          </div>
        )
      })}
    </div>
  )
})

export default FreePad
