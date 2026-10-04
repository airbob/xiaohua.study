import { useEffect, useRef } from 'react'
import HanziWriter from 'hanzi-writer'
import TianGrid from './TianGrid.jsx'

/** Looping stroke-order animation, used on the results page for missed characters. */
export default function StrokeReplay({ char, size = 220, onClose }) {
  const host = useRef(null)
  useEffect(() => {
    host.current.innerHTML = ''
    const w = HanziWriter.create(host.current, char, {
      width: size,
      height: size,
      padding: 14,
      showOutline: true,
      strokeColor: '#c8402f',
      outlineColor: '#eadfd2',
      strokeAnimationSpeed: 1,
      delayBetweenStrokes: 300,
      radicalColor: '#2c6e8f',
    })
    w.loopCharacterAnimation()
    return () => w.pauseAnimation?.()
  }, [char, size])
  return (
    <div className="modal" onClick={onClose} role="dialog" aria-label={`${char} 的笔顺`}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">「{char}」的笔顺</div>
        <div className="pad" style={{ width: size, height: size }}>
          <TianGrid size={size} />
          <div ref={host} className="pad-writer" />
        </div>
        <p className="muted small">蓝色是部首。跟着动画，用手指在空中写一写。</p>
        <button className="btn primary" onClick={onClose}>知道了</button>
      </div>
    </div>
  )
}
