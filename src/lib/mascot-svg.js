// 墨墨 — a little cuttlefish (墨鱼) holding a pencil, from the designer's cuttlefish-mascot.svg.
// One source for the app (Mascot.jsx) and the static word-list pages (scripts/seo-pages.mjs).
// Moods: happy (default), look (eyes up, while writing), worried (after a mistake),
// cheer (level complete: happy eyes, open mouth, bubbles).

// cropped to the character (the designer's water line is left out)
export const MASCOT_VIEWBOX = '32 28 354 380'
export const MASCOT_RATIO = 380 / 354

const NAVY = '#3A4566'
const INK = '#1B1B26'
const SUCKER = '#8E9BC2'

const ARMS = [
  'M164 258 Q150 300 128 316 q-10 6 -6 -6',
  'M186 264 Q180 314 160 336 q-8 8 -8 -4',
  'M208 266 Q210 320 196 346 q-4 10 -10 2',
  'M230 266 Q236 318 252 344 q6 10 10 2',
  'M252 262 Q266 306 288 324 q10 6 8 -6',
]
const WAVE = 'M270 252 C 320 256 350 228 346 186'
const HOLD = 'M152 250 C 118 262 100 280 104 300'

const tube = (d) => `<path d="${d}" fill="none" stroke-width="24"/><path d="${d}" fill="none" stroke="${NAVY}" stroke-width="13"/>`

function eyes(mood) {
  if (mood === 'cheer') {
    // ^ ^
    return `<path d="M152 212 q20 -26 40 0" fill="none" stroke-width="7"/><path d="M228 212 q20 -26 40 0" fill="none" stroke-width="7"/>`
  }
  const dy = mood === 'look' ? -7 : mood === 'worried' ? 3 : 0
  const one = (cx) =>
    `<ellipse cx="${cx}" cy="204" rx="22" ry="24" fill="#FFFFFF" stroke-width="5"/>` +
    `<ellipse cx="${cx + 3}" cy="${208 + dy}" rx="14" ry="16" fill="${INK}" stroke="none"/>` +
    `<circle cx="${cx + 8}" cy="${201 + dy}" r="5" fill="#FFFFFF" stroke="none"/>` +
    `<circle cx="${cx - 2}" cy="${214 + dy}" r="2.2" fill="#FFFFFF" stroke="none"/>`
  const brows =
    mood === 'worried' ? `<path d="M152 172 L186 164" fill="none" stroke-width="6"/><path d="M234 164 L268 172" fill="none" stroke-width="6"/>` : ''
  return one(172) + one(248) + brows
}

function mouth(mood) {
  if (mood === 'cheer') return `<path d="M192 232 Q210 264 228 232 Q210 238 192 232 Z" fill="#E4573D" stroke-width="4"/>`
  if (mood === 'worried') return `<path d="M196 244 q7 -8 14 0 q7 8 14 0" fill="none" stroke-width="4"/>`
  return `<path d="M198 236 Q210 252 222 236 Q210 241 198 236 Z" fill="#E4573D" stroke-width="4"/>`
}

/** The inner markup of the mascot's <svg> (use with MASCOT_VIEWBOX). */
export function mascotInner(mood = 'happy') {
  const bubbles =
    mood === 'cheer'
      ? `<g fill="#FFFFFF" stroke="#8ED6D0" stroke-width="4"><circle cx="352" cy="96" r="12"/><circle cx="366" cy="62" r="8"/><circle cx="350" cy="40" r="5"/></g>`
      : ''
  return `<g stroke="${INK}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round">
${bubbles}
${tube(WAVE)}<ellipse cx="346" cy="176" rx="17" ry="21" fill="${NAVY}" transform="rotate(10 346 176)"/>
<g fill="${SUCKER}" stroke="none"><circle cx="340" cy="180" r="3.4"/><circle cx="350" cy="170" r="3.4"/><circle cx="352" cy="184" r="3.4"/></g>
<g fill="none" stroke-width="24">${ARMS.map((d) => `<path d="${d}"/>`).join('')}</g>
<g fill="none" stroke="${NAVY}" stroke-width="13">${ARMS.map((d) => `<path d="${d}"/>`).join('')}</g>
<g fill="${SUCKER}" stroke="none"><circle cx="150" cy="296" r="3.2"/><circle cx="140" cy="308" r="3"/><circle cx="176" cy="308" r="3.2"/><circle cx="170" cy="322" r="3"/><circle cx="206" cy="312" r="3.2"/><circle cx="202" cy="328" r="3"/><circle cx="236" cy="310" r="3.2"/><circle cx="242" cy="326" r="3"/><circle cx="268" cy="302" r="3.2"/><circle cx="278" cy="314" r="3"/></g>
<g transform="rotate(-30 92 300)"><rect x="78" y="226" width="28" height="112" rx="4" fill="#F2A93B"/><rect x="78" y="218" width="28" height="18" rx="5" fill="#F7A3B5"/><path d="M78 338 L92 370 L106 338 Z" fill="#FFF4D6"/><path d="M87 359 L92 370 L97 359 Z" fill="${INK}" stroke-width="3"/><path d="M92 240 V 334" fill="none" stroke-width="3"/></g>
<path d="M134 366 C 134 366 122 382 122 390 a12 12 0 0 0 24 0 C 146 382 134 366 134 366 Z" fill="${INK}" stroke-width="5"/>
${tube(HOLD)}<ellipse cx="100" cy="304" rx="16" ry="13" fill="${NAVY}"/>
<g fill="#6C7BA8"><circle cx="122" cy="88" r="20"/><circle cx="106" cy="124" r="20"/><circle cx="100" cy="162" r="20"/><circle cx="104" cy="200" r="20"/><circle cx="116" cy="236" r="18"/><circle cx="298" cy="88" r="20"/><circle cx="314" cy="124" r="20"/><circle cx="320" cy="162" r="20"/><circle cx="316" cy="200" r="20"/><circle cx="304" cy="236" r="18"/></g>
<path d="M210 44 C 290 44 316 118 312 178 C 308 238 272 272 210 272 C 148 272 112 238 108 178 C 104 118 130 44 210 44 Z" fill="${NAVY}"/>
<g fill="none" stroke="#2A3150" stroke-width="7"><path d="M168 70 q-8 18 2 34"/><path d="M200 60 q-6 20 4 38"/><path d="M236 62 q8 18 -2 36"/><path d="M266 76 q8 16 0 32"/><path d="M150 104 q-6 14 0 26"/><path d="M276 112 q6 14 -2 26"/></g>
<ellipse cx="160" cy="92" rx="12" ry="22" fill="#FFFFFF" stroke="none" opacity="0.45" transform="rotate(28 160 92)"/>
<ellipse cx="210" cy="214" rx="82" ry="48" fill="#CDD6F0" stroke="none"/>
${eyes(mood)}
<ellipse cx="144" cy="236" rx="15" ry="9" fill="#F7837A" stroke="none" opacity="0.7"/><ellipse cx="276" cy="236" rx="15" ry="9" fill="#F7837A" stroke="none" opacity="0.7"/>
${mouth(mood)}
</g>`
}

/** A complete <svg> string, for static HTML. */
export function mascotSvg({ mood = 'happy', width = 64, className = '' } = {}) {
  const h = Math.round(width * MASCOT_RATIO)
  return `<svg${className ? ` class="${className}"` : ''} width="${width}" height="${h}" viewBox="${MASCOT_VIEWBOX}" aria-hidden="true">${mascotInner(mood)}</svg>`
}
