export default function TianGrid({ size, x = 0, y = 0, asGroup = false }) {
  const lines = (
    <>
      <rect x="0.5" y="0.5" width="99" height="99" fill="none" strokeWidth="0.8" />
      <line x1="50" y1="0" x2="50" y2="100" strokeDasharray="3 3" />
      <line x1="0" y1="50" x2="100" y2="50" strokeDasharray="3 3" />
      <line x1="0" y1="0" x2="100" y2="100" strokeDasharray="2 4" className="diag" />
      <line x1="100" y1="0" x2="0" y2="100" strokeDasharray="2 4" className="diag" />
    </>
  )
  if (asGroup)
    return (
      <g className="tian" transform={`translate(${x} ${y}) scale(${size / 100})`} vectorEffect="non-scaling-stroke">
        {lines}
      </g>
    )
  return (
    <svg className="tian abs" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      {lines}
    </svg>
  )
}
