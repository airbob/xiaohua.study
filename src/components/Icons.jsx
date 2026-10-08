// Small hand-drawn style icons from the 汉字岛 design. All inherit size from props.
const line = { fill: 'none', stroke: '#1B1B26', strokeLinecap: 'round', strokeLinejoin: 'round' }

export const Speaker = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 9v6h4l5 4V5L8 9z" fill="#1B1B26" stroke="#1B1B26" strokeWidth="2.4" strokeLinejoin="round" />
    <path d="M16 9a4 4 0 0 1 0 6" {...line} strokeWidth="2.4" />
  </svg>
)
export const Back = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" {...line} strokeWidth="3" /></svg>
)
export const Undo = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M9 14L4 9l5-5" {...line} strokeWidth="2.6" />
    <path d="M4 9h11a5 5 0 0 1 0 10h-3" {...line} strokeWidth="2.6" />
  </svg>
)
export const Eraser = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19h14M7 15l8-10 4 4-8 10H7z" {...line} strokeWidth="2.6" /></svg>
)
export const Bulb = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M9 17h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" {...line} strokeWidth="2.4" />
  </svg>
)
export const Question = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M9 9a3 3 0 1 1 4.2 2.7c-.8.4-1.2 1.1-1.2 1.9V15" {...line} strokeWidth="2.6" />
    <circle cx="12" cy="19" r="1.5" fill="#1B1B26" />
  </svg>
)
export const Check = ({ size = 30, color = '#1B1B26', width = 3.4 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10" {...line} stroke={color} strokeWidth={width} /></svg>
)
export const Lock = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <rect x="5" y="11" width="14" height="10" rx="2" {...line} stroke="#4A4A55" strokeWidth="2.6" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" {...line} stroke="#4A4A55" strokeWidth="2.6" />
  </svg>
)
export const Tent = ({ size = 58 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
    <path d="M6 40L24 10l18 30z" fill="#F2A93B" stroke="#1B1B26" strokeWidth="3" strokeLinejoin="round" />
    <path d="M24 10v30M19 40l5-10 5 10" stroke="#1B1B26" strokeWidth="3" fill="#FFF4D6" strokeLinejoin="round" />
  </svg>
)
export const Compass = ({ size = 58 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
    <circle cx="24" cy="24" r="17" fill="#8ED6D0" stroke="#1B1B26" strokeWidth="3" />
    <path d="M24 11l4 13-4 13-4-13z" fill="#FFFFFF" stroke="#1B1B26" strokeWidth="2.5" strokeLinejoin="round" />
    <path d="M24 11l4 13h-8z" fill="#E4573D" />
  </svg>
)
export const Chest = ({ size = 40, open = false }) =>
  open ? (
    <svg width={size} height={(size * 170) / 220} viewBox="0 0 220 170" aria-hidden="true">
      <path d="M110 6 L 122 46 L 162 30 L 134 64 L 176 72 L 130 84 L 110 90 L 90 84 L 44 72 L 86 64 L 58 30 L 98 46 Z" fill="#FFE08A" />
      <path d="M30 70 q80 -60 160 0 l-10 26 h-140 z" fill="#E4573D" stroke="#1B1B26" strokeWidth="5" strokeLinejoin="round" />
      <rect x="28" y="92" width="164" height="70" rx="10" fill="#F2A93B" stroke="#1B1B26" strokeWidth="5" />
      <path d="M28 114h164" stroke="#1B1B26" strokeWidth="5" />
      <rect x="98" y="104" width="24" height="30" rx="5" fill="#FFF4D6" stroke="#1B1B26" strokeWidth="4" />
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="9" width="18" height="11" rx="2" fill="#F2A93B" stroke="#1B1B26" strokeWidth="2" />
      <path d="M3 12h18" stroke="#1B1B26" strokeWidth="2" />
      <path d="M5 9a7 5 0 0 1 14 0" fill="#E4573D" stroke="#1B1B26" strokeWidth="2" />
      <rect x="10.5" y="11" width="3" height="4" rx="1" fill="#FFF4D6" stroke="#1B1B26" strokeWidth="1.5" />
    </svg>
  )
export const BigStar = ({ size = 78, on = true }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2.5l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 16.9 6.3 20l1.2-6.4L2.8 9.2l6.4-.8z" fill={on ? '#F2A93B' : '#E6DCC3'} stroke="#1B1B26" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
)
export const Campfire = ({ size = 140 }) => (
  <svg width={size} height={(size * 110) / 140} viewBox="0 0 140 110" aria-hidden="true">
    <path d="M70 12 C 82 34 98 40 92 64 C 88 80 52 80 48 64 C 44 46 62 40 70 12 Z" fill="#F2A93B" stroke="#1B1B26" strokeWidth="4" strokeLinejoin="round" />
    <path d="M70 40 C 78 54 82 58 78 70 C 74 78 66 78 62 70 C 58 60 66 54 70 40 Z" fill="#FFE08A" />
    <path d="M28 96 L 112 78 M 28 78 L 112 96" stroke="#8A5A2B" strokeWidth="12" strokeLinecap="round" />
  </svg>
)
export const Sprout = ({ size = 54 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 20c3-1 5-4 9-4s6 3 9 4" {...line} stroke="#2D7A3A" strokeWidth="2.4" />
    <path d="M12 16V5M12 5l-4 4M12 5l4 4" {...line} stroke="#2D7A3A" strokeWidth="2.4" />
  </svg>
)

/** ★★☆ as text, with the unearned ones dimmed. */
export function Stars({ n, of = 3, className = '' }) {
  return (
    <span className={`stars-text ${className}`} aria-label={`${n} ★`}>
      {'★'.repeat(n)}
      <span className="off">{'★'.repeat(Math.max(0, of - n))}</span>
    </span>
  )
}
