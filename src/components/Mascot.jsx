import { mascotInner, MASCOT_VIEWBOX, MASCOT_RATIO } from '../lib/mascot-svg.js'

// 墨墨 — the little cuttlefish (墨鱼) who guides 汉字岛. Drawing in src/lib/mascot-svg.js.
// Moods: happy (default), look (eyes up, while writing), worried (after a mistake),
// cheer (level complete).
export default function Mascot({ mood = 'happy', size = 64, className = '', label }) {
  return (
    <svg
      className={`mascot ${className}`}
      width={size}
      height={Math.round(size * MASCOT_RATIO)}
      viewBox={MASCOT_VIEWBOX}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      dangerouslySetInnerHTML={{ __html: mascotInner(mood) }}
    />
  )
}

/** 墨墨 with a speech bubble. */
export function MascotSays({ mood, children, size = 60, tone = 'white' }) {
  return (
    <div className={`says says-${tone}`}>
      <Mascot mood={mood} size={size} />
      <div className="bubble">{children}</div>
    </div>
  )
}
