import { useMemo } from 'react'
import { GRADES, gradeStatus, gradeWordCount } from '../lib/levels.js'
import { loadHistory, loadMistakes, loadLevels, wordsToday } from '../lib/storage.js'
import { useAccount, clearNotice } from '../lib/account.js'
import Mascot from './Mascot.jsx'
import Footer from './Footer.jsx'
import { Lock, Tent, Compass, Chest, Stars } from './Icons.jsx'

export const DAILY_GOAL = 10

// Island spots on the 836×796 map from the design (left, top in px; scaled with the map).
const SPOTS = { P1: [60, 580], P2: [260, 470], P3: [160, 290], P4: [400, 205], P5: [600, 330], P6: [640, 110] }
const MAP_W = 836
const MAP_H = 796
const pct = (v, of) => `${(v / of) * 100}%`

/** The grade the child is "at": their profile's grade, else the one played last, else P1. */
function homeGrade(child, history) {
  if (child?.grade) return child.grade
  const last = history.find((h) => /^P[1-6]:\d+$/.test(h.source))
  return last ? last.source.slice(0, 2) : 'P1'
}

export default function Home({ prefs, onPrefs, onStartLevel, onMix, onReview }) {
  const account = useAccount()
  const v = account.version
  const levels = useMemo(loadLevels, [v])
  const mistakes = useMemo(() => Object.keys(loadMistakes()).length, [v])
  const history = useMemo(loadHistory, [v])
  const today = useMemo(wordsToday, [v])
  const child = account.profiles.find((p) => p.id === account.activeId)
  const here = homeGrade(child, history)
  const status = Object.fromEntries(GRADES.map((g) => [g, gradeStatus(g, levels[g])]))
  // locks only mean "not your grade yet" — every island can still be opened
  const lockedFrom = child ? GRADES.indexOf(child.grade) + 1 : 99
  const cta = status[here]

  return (
    <div className="home-page">
      <main className="island-home">
        <section className="map" aria-label="汉字岛地图">
          <svg className="map-art" viewBox={`0 0 ${MAP_W} ${MAP_H}`} preserveAspectRatio="none" aria-hidden="true">
            {['M40 120', 'M520 700', 'M700 520', 'M380 620'].map((m) => (
              <path key={m} d={`${m} q20 -10 40 0 t40 0`} stroke="#FFFFFF" strokeWidth="3" fill="none" opacity="0.6" strokeLinecap="round" />
            ))}
            <path
              d="M140 640 C 220 600, 280 600, 330 540 S 260 380, 260 360 S 420 300, 470 270 S 640 380, 680 380 S 720 220, 720 180"
              stroke="#FFF4D6" strokeWidth="10" fill="none" strokeDasharray="2 22" strokeLinecap="round"
            />
          </svg>

          <div className="map-title">
            <h1>汉字岛</h1>
            <p>一座岛一个年级，打通 10 个词就过一关</p>
          </div>

          <ol className="islands">
            {GRADES.map((g, i) => {
              const s = status[g]
              const locked = i >= lockedFrom
              const isHere = g === here
              const [x, y] = SPOTS[g]
              return (
                <li key={g} className={`island-spot ${isHere ? 'here' : ''}`} style={{ '--x': pct(x, MAP_W), '--y': pct(y, MAP_H) }}>
                  {isHere && (
                    <div className="you-are-here" aria-hidden="true">
                      <span>你在这里</span>
                      <Mascot size={52} />
                    </div>
                  )}
                  <button
                    className={`island ${isHere ? 'current' : ''} ${locked ? 'locked' : ''} shape-${i}`}
                    onClick={() => onStartLevel(g, s.current)}
                    aria-label={`${g}，${gradeWordCount(g)} 个词，${s.done ? '已通关' : `第 ${s.current} 关`}`}
                  >
                    {locked && <Lock />}
                    <span className="island-name">{g}</span>
                    {!locked && <Stars n={s.stars} className="island-stars" />}
                    <span className="island-sub">
                      {gradeWordCount(g)} 词{!locked && ` · ${s.done ? '已通关' : `第 ${s.current} 关`}`}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>

          {child && lockedFrom < GRADES.length && (
            <div className="map-note">{GRADES[lockedFrom]}–P6 也可以直接点开练，锁只是提醒“还没到这里”。</div>
          )}
        </section>

        <aside className="side">
          {account.notice && (
            <div className="notice" role="status">
              <span>{account.notice}</span>
              <button className="icon-x" onClick={clearNotice} aria-label="知道了">✕</button>
            </div>
          )}

          <div className="card task">
            <div className="task-head">
              <h2 className="display">今日任务</h2>
              <span className="pill green">{Math.min(today, DAILY_GOAL)} / {DAILY_GOAL}</span>
            </div>
            <div className="bar"><div style={{ width: `${Math.min(100, (today / DAILY_GOAL) * 100)}%` }} /></div>
            <p>
              {today >= DAILY_GOAL ? (
                <><Chest size={22} /> 今天的宝箱打开啦！明天再来。</>
              ) : (
                `再写 ${DAILY_GOAL - today} 个词，就能打开今天的宝箱。`
              )}
            </p>
          </div>

          <button className="card big-link" onClick={onReview}>
            <Tent />
            <span>
              <span className="display">复习营地</span>
              <span className="sub">{mistakes ? `错词本 · ${mistakes} 个词等你救回来` : '错词本空空的，真棒！'}</span>
            </span>
          </button>

          <button className="card big-link navy" onClick={onMix}>
            <Compass />
            <span>
              <span className="display">随机探险</span>
              <span className="sub">P1–P6 混合</span>
            </span>
          </button>

          <div className="card play">
            <h2 className="small-title">玩法</h2>
            <div className="mode-pick">
              <button className={prefs.mode === 'dictation' ? 'on' : ''} onClick={() => onPrefs({ mode: 'dictation' })}>听写挑战</button>
              <button className={prefs.mode === 'trace' ? 'on' : ''} onClick={() => onPrefs({ mode: 'trace' })}>描红热身</button>
            </div>
            <div className="switch-list">
              <Toggle label="自动读词" hint="每个词自动念一遍" on={prefs.autoSpeak} set={(x) => onPrefs({ autoSpeak: x })} />
              <Toggle label="例句" hint="显示带空格的句子" on={prefs.showExample} set={(x) => onPrefs({ showExample: x })} />
              <Toggle label="英文意思" hint="显示英文解释" on={prefs.showEnglish} set={(x) => onPrefs({ showEnglish: x })} />
            </div>
          </div>

          <div className="grow" />
          <button className="cta red" onClick={() => onStartLevel(here, cta.current)}>
            出发！{here} 第 {cta.current} 关
          </button>
        </aside>
      </main>

      <Footer />
    </div>
  )
}

function Toggle({ label, hint, on, set }) {
  return (
    <button type="button" role="switch" aria-checked={!!on} className="switch-row" onClick={() => set(!on)}>
      <span className="switch-text">
        <span className="switch-label">{label}</span>
        {hint && <span className="switch-hint">{hint}</span>}
      </span>
      <span className={`switch ${on ? 'on' : ''}`} aria-hidden="true">
        <span className="switch-word">{on ? '开' : '关'}</span>
        <span className="switch-knob">
          {on && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l5 5 9-10" />
            </svg>
          )}
        </span>
      </span>
    </button>
  )
}
