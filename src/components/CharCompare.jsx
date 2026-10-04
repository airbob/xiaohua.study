import TianGrid from './TianGrid.jsx'

const COLORS = { ok: '#2f8f5b', order: '#d4881f', backwards: '#8a5cc2', extra: '#c8402f', missing: '#c8402f' }

/** Reference character from stroke outlines, optionally colouring individual strokes. */
export function RefGlyph({ data, x = 0, y = 0, size, color = '#1f2a44', strokeColors }) {
  const k = size / 1024
  return (
    <g transform={`translate(${x} ${y + 900 * k}) scale(${k} ${-k})`} pointerEvents="none">
      {data.strokes.map((d, j) => (
        <path key={j} d={d} fill={strokeColors?.[j] || color} />
      ))}
    </g>
  )
}

/** Stroke numbers at the start of each median, for the model answer. */
function StrokeNumbers({ data, size, statuses }) {
  const k = size / 1024
  return data.medians.map((m, j) => {
    const [x, y] = m[0]
    const st = statuses?.[j]
    if (!st || st === 'ok') return null
    return (
      <g key={j}>
        <circle cx={x * k} cy={(900 - y) * k} r={size * 0.065} fill="#fff" stroke={COLORS[st]} strokeWidth="1.5" />
        <text x={x * k} y={(900 - y) * k} dy="0.35em" textAnchor="middle" fontSize={size * 0.08} fill={COLORS[st]} fontWeight="700">
          {j + 1}
        </text>
      </g>
    )
  })
}

/** Side-by-side: what the student wrote (ink coloured by verdict) and the model answer. */
export default function CharCompare({ char, data, strokes, result, size = 96, onReplay }) {
  const ink = Math.max(3, size / 22)
  const refColors = result?.refStatus?.map((s) => (s === 'ok' ? '#c9ced8' : COLORS[s]))
  return (
    <div className="compare">
      <figure>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mini">
          <rect width={size} height={size} fill="#fff" />
          <TianGrid asGroup size={size} />
          {strokes.map((s, k) => (
            <polyline
              key={k}
              points={s.map(([x, y]) => `${x * size},${y * size}`).join(' ')}
              fill="none"
              stroke={COLORS[result?.strokeStatus?.[k]] || '#1f2a44'}
              strokeWidth={ink}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </svg>
        <figcaption>你写的</figcaption>
      </figure>
      <figure>
        <button className="mini-btn" onClick={onReplay} title="看笔顺动画" aria-label={`看「${char}」的笔顺`}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mini">
            <rect width={size} height={size} fill="#fff" />
            <TianGrid asGroup size={size} />
            {data ? (
              <>
                <RefGlyph data={data} size={size} strokeColors={refColors} color="#1f2a44" />
                <StrokeNumbers data={data} size={size} statuses={result?.refStatus} />
              </>
            ) : (
              <text x="50%" y="50%" dy="0.35em" textAnchor="middle" fontSize={size * 0.7} className="kai">{char}</text>
            )}
          </svg>
        </button>
        <figcaption>正确 ▶</figcaption>
      </figure>
    </div>
  )
}

export { COLORS }
