// 墨墨 — the ink-drop guide of 汉字岛. Moods: happy (default), look (eyes up, while writing),
// worried (after a mistake), cheer (level complete, with arms up).
export default function Mascot({ mood = 'happy', size = 64, className = '', label }) {
  const h = Math.round((size * 130) / 120)
  return (
    <svg
      className={`mascot ${className}`}
      width={size}
      height={h}
      viewBox="0 0 120 130"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {mood === 'cheer' && (
        <>
          <path d="M22 70 L 4 44" stroke="#1B1B26" strokeWidth="6" strokeLinecap="round" />
          <path d="M98 70 L 116 44" stroke="#1B1B26" strokeWidth="6" strokeLinecap="round" />
        </>
      )}
      <path d="M60 6 C 52 26 20 56 20 84 a40 40 0 0 0 80 0 C 100 56 68 26 60 6 Z" fill="#3A4566" stroke="#1B1B26" strokeWidth="5" />
      {mood === 'cheer' ? (
        <>
          <path d="M36 80 q9 -10 18 0" stroke="#FFFFFF" strokeWidth="4.5" fill="none" strokeLinecap="round" />
          <path d="M66 80 q9 -10 18 0" stroke="#FFFFFF" strokeWidth="4.5" fill="none" strokeLinecap="round" />
          <path d="M46 96 q14 18 28 0 z" fill="#E4573D" stroke="#FFFFFF" strokeWidth="3" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <circle cx="45" cy="82" r="9" fill="#FFFFFF" />
          <circle cx="75" cy="82" r="9" fill="#FFFFFF" />
          <circle cx={mood === 'look' ? 45 : 47} cy={mood === 'look' ? 78 : 84} r="4.5" fill="#1B1B26" />
          <circle cx={mood === 'look' ? 75 : 77} cy={mood === 'look' ? 78 : 84} r="4.5" fill="#1B1B26" />
          {mood === 'worried' ? (
            <path d="M50 104 q10 -6 20 0" stroke="#FFFFFF" strokeWidth="4" fill="none" strokeLinecap="round" />
          ) : (
            <path d="M52 102 q8 7 16 0" stroke="#FFFFFF" strokeWidth="4" fill="none" strokeLinecap="round" />
          )}
        </>
      )}
    </svg>
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
