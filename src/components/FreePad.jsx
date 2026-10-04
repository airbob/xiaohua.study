import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import TianGrid from './TianGrid.jsx'
import { RefGlyph } from './CharCompare.jsx'

/**
 * A row (or 2×2 block) of 田字格 cells for writing a whole word freely — no
 * correction while writing. Each stroke belongs to the cell its centre falls in.
 * getStrokes() → per cell, strokes in writing order, points normalised to 0..1.
 */
const FreePad = forwardRef(function FreePad({ glyphs, cell, cols, traceData, peek }, ref) {
  const n = glyphs.length
  const rows = Math.ceil(n / cols)
  const gap = Math.round(cell * 0.06)
  const W = cols * cell + (cols - 1) * gap
  const H = rows * cell + (rows - 1) * gap
  const [strokes, setStrokes] = useState([]) // { pts: [[x,y]] } in pad px
  const drawing = useRef(null)
  const svg = useRef(null)

  // iOS starts a text selection / callout on long press unless touchstart is cancelled,
  // and React's touch listeners are passive, so attach a native one.
  useEffect(() => {
    const el = svg.current
    const stop = (e) => e.preventDefault()
    el.addEventListener('touchstart', stop, { passive: false })
    el.addEventListener('touchmove', stop, { passive: false })
    return () => {
      el.removeEventListener('touchstart', stop)
      el.removeEventListener('touchmove', stop)
    }
  }, [])

  const origin = (i) => [(i % cols) * (cell + gap), Math.floor(i / cols) * (cell + gap)]

  const toLocal = (e) => {
    const r = svg.current.getBoundingClientRect()
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H]
  }

  const down = (e) => {
    e.preventDefault()
    svg.current.setPointerCapture(e.pointerId)
    drawing.current = { id: e.pointerId, pts: [toLocal(e)] }
    setStrokes((s) => [...s, drawing.current])
  }
  const move = (e) => {
    const d = drawing.current
    if (!d || d.id !== e.pointerId) return
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e]
    for (const ev of events) d.pts.push(toLocal(ev))
    setStrokes((s) => [...s.slice(0, -1), { ...d }])
  }
  const up = (e) => {
    if (drawing.current?.id === e.pointerId) drawing.current = null
  }

  useImperativeHandle(ref, () => ({
    undo: () => setStrokes((s) => s.slice(0, -1)),
    clear: () => setStrokes([]),
    isEmpty: () => strokes.length === 0,
    getStrokes() {
      const per = glyphs.map(() => [])
      for (const s of strokes) {
        const xs = s.pts.map((p) => p[0]), ys = s.pts.map((p) => p[1])
        const cx = (Math.min(...xs) + Math.max(...xs)) / 2
        const cy = (Math.min(...ys) + Math.max(...ys)) / 2
        const col = Math.min(cols - 1, Math.max(0, Math.floor(cx / (cell + gap))))
        const row = Math.min(rows - 1, Math.max(0, Math.floor(cy / (cell + gap))))
        const i = row * cols + col
        if (i >= n) continue
        const [ox, oy] = origin(i)
        per[i].push(s.pts.map(([x, y]) => [(x - ox) / cell, (y - oy) / cell]))
      }
      return per
    },
  }))

  const ink = Math.max(6, Math.round(cell / 22))
  return (
    <svg
      ref={svg}
      className="freepad"
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onContextMenu={(e) => e.preventDefault()}
    >
      {glyphs.map((g, i) => {
        const [x, y] = origin(i)
        return (
          <g key={i}>
            <rect x={x} y={y} width={cell} height={cell} fill="#fff" className="cell-bg" />
            <TianGrid asGroup size={cell} x={x} y={y} />
            {(traceData?.[i] || peek?.[i]) && (
              <RefGlyph data={traceData?.[i] || peek[i]} x={x} y={y} size={cell} color={peek?.[i] ? '#f2b8a8' : '#ece3d8'} />
            )}
          </g>
        )
      })}
      {strokes.map((s, k) => (
        <polyline
          key={k}
          points={s.pts.map((p) => p.join(',')).join(' ')}
          fill="none"
          stroke="#1f2a44"
          strokeWidth={ink}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  )
})

export default FreePad
