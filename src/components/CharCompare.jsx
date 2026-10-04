import { Grid, chrome } from './FreePad.jsx'
import { Check } from './Icons.jsx'

export const COLORS = { ok: '#2D7A3A', order: '#E39B1B', backwards: '#8A5CC2', extra: '#E4573D', missing: '#E4573D' }
// soft tints for the model answer's problem strokes
const TINT = { ok: '#EADFCB', order: '#F7D79E', backwards: '#D9C6F0', missing: '#F6B7A8' }

/** Reference character from stroke outlines, optionally colouring individual strokes. */
export function RefGlyph({ data, x = 0, y = 0, size, color = '#1B1B26', strokeColors }) {
  const k = size / 1024
  return (
    <g transform={`translate(${x} ${y + 900 * k}) scale(${k} ${-k})`} pointerEvents="none">
      {data.strokes.map((d, j) => (
        <path key={j} d={d} fill={strokeColors?.[j] || color} />
      ))}
    </g>
  )
}

/** Numbered markers at the start of each problem stroke of the model answer. */
function StrokeNumbers({ data, size, statuses }) {
  const k = size / 1024
  return data.medians.map((m, j) => {
    const st = statuses?.[j]
    if (!st || st === 'ok') return null
    const [x, y] = m[0]
    return (
      <g key={j}>
        <circle cx={x * k} cy={(900 - y) * k} r={size * 0.06} fill="#fff" stroke={COLORS[st]} strokeWidth="3" />
        <text x={x * k} y={(900 - y) * k} dy="0.35em" textAnchor="middle" fontSize={size * 0.072} fill={COLORS[st]} fontWeight="900">
          {j + 1}
        </text>
      </g>
    )
  })
}

/**
 * One graded character in a wooden frame: the model answer underneath (problem strokes tinted
 * and numbered), the child's own strokes on top coloured by verdict, and a ✓ / ! badge.
 */
export function ResultFrame({ char, data, strokes = [], result, verdict, size, onReplay }) {
  const ink = Math.max(4, size / 22)
  const fp = chrome(size) - 7
  const refColors = result?.refStatus?.map((s) => TINT[s] || TINT.ok)
  return (
    <div className="result-frame">
      <div className="frame" style={{ padding: fp }}>
        <div className="paper" style={{ width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <Grid size={size} />
            {data ? (
              <>
                <RefGlyph data={data} size={size} strokeColors={refColors} color={TINT.ok} />
                {strokes.map((s, k) => (
                  <polyline
                    key={k}
                    points={s.map(([x, y]) => `${x * size},${y * size}`).join(' ')}
                    fill="none"
                    stroke={result ? COLORS[result.strokeStatus?.[k]] || '#1B1B26' : '#1B1B26'}
                    strokeWidth={ink}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
                <StrokeNumbers data={data} size={size} statuses={result?.refStatus} />
              </>
            ) : (
              <text x="50%" y="50%" dy="0.35em" textAnchor="middle" fontSize={size * 0.8} className="kai">{char}</text>
            )}
          </svg>
        </div>
        <span className={`verdict-badge ${verdict}`} aria-label={verdict === 'ok' ? '写对了' : '要改'}>
          {verdict === 'ok' ? <Check size={size > 200 ? 40 : 26} width={3.6} /> : verdict === 'order' ? '!' : '×'}
        </span>
      </div>
      {onReplay && (
        <button className="replay-pill" onClick={onReplay}>看动画：正确笔顺</button>
      )}
    </div>
  )
}
