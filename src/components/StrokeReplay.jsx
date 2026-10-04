import { useEffect, useRef } from 'react'
import HanziWriter from 'hanzi-writer'
import { Grid } from './FreePad.jsx'

/** Looping stroke-order animation for one character. */
export default function StrokeReplay({ char, size = 240, onClose }) {
  const host = useRef(null)
  useEffect(() => {
    host.current.innerHTML = ''
    const w = HanziWriter.create(host.current, char, {
      width: size,
      height: size,
      padding: 14,
      showOutline: true,
      strokeColor: '#E4573D',
      outlineColor: '#EADFCB',
      radicalColor: '#1B5E8C',
      strokeAnimationSpeed: 1,
      delayBetweenStrokes: 300,
    })
    w.loopCharacterAnimation()
    return () => w.pauseAnimation?.()
  }, [char, size])
  return (
    <div className="modal" onClick={onClose} role="dialog" aria-label={`${char} 的笔顺`}>
      <div className="modal-card replay-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title display">「{char}」的笔顺</div>
        <div className="frame">
          <div className="paper" style={{ width: size, height: size, position: 'relative' }}>
            <svg width={size} height={size} style={{ position: 'absolute', inset: 0 }}><Grid size={size} /></svg>
            <div ref={host} style={{ position: 'absolute', inset: 0 }} />
          </div>
        </div>
        <p className="muted-text">蓝色是部首。跟着动画，用手指在空中写一写。</p>
        <button className="cta red small" onClick={onClose}>知道了</button>
      </div>
    </div>
  )
}
