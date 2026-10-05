import { useEffect, useMemo, useRef } from 'react'
import Mascot from './Mascot.jsx'
import { Chest, BigStar, Tent } from './Icons.jsx'
import { setScore, wordScore, isPerfect, charNotes } from '../lib/score.js'
import { starsFor, toNextStar } from '../lib/levels.js'
import { recordSet, wordsToday } from '../lib/storage.js'
import { track } from '../lib/analytics.js'
import { DAILY_GOAL } from './Home.jsx'
import { useAccount } from '../lib/account.js'

const mmss = (ms) => {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** What went wrong in a word, for the 复习营地 card: the wrong characters and the first reason. */
export function mistakeOf(r) {
  const bad = r.chars.map((c, i) => (isPerfect([c]) ? null : i)).filter((i) => i !== null)
  const first = r.chars[bad[0]]
  const note = first ? (first.skipped || first.status === 'blank' ? '听写时没写出来' : `「${first.char}」${charNotes(first)[0]}`) : ''
  return { bad: bad.join(','), note }
}

/**
 * End of a set. kind: 'level' | 'mix' | 'review'; level: { grade, level } for island levels.
 * Records the set (local + server) once.
 */
export default function LevelComplete({ results, kind, level, stats, onHome, onNext, onAgain, onReview, onLogin }) {
  const account = useAccount()
  const n = results.length
  const correct = results.filter((r) => isPerfect(r.chars)).length
  const stars = starsFor(correct, n)
  const more = toNextStar(correct, n)
  const wrong = results.filter((r) => !isPerfect(r.chars))
  const score = useMemo(() => setScore(results), [results])
  const saved = useRef(false)

  useEffect(() => {
    if (saved.current) return
    saved.current = true
    const before = wordsToday()
    recordSet(
      results.map((r) => ({
        word: r.word,
        perfect: isPerfect(r.chars),
        score: Math.round(wordScore(r.chars) * 100),
        detail: r.chars.map((c) => ({ char: c.char, status: c.skipped ? 'skipped' : c.status, notes: charNotes(c) })),
        ...(isPerfect(r.chars) ? {} : mistakeOf(r)),
      })),
      score,
      kind === 'level' ? `${level.grade}:${level.level}` : kind,
      kind === 'level' ? { ...level, stars, correct } : null,
    )
    const summary = {
      correct,
      total: n,
      hints: results.filter((r) => r.chars.some((c) => c.hinted)).length,
      gave_up: results.filter((r) => r.chars.some((c) => c.skipped)).length,
      best_streak: stats.bestStreak,
      duration_sec: Math.round(stats.ms / 1000),
    }
    if (kind === 'level')
      track('level_end', { level_name: `${level.grade}-${level.level}`, grade: level.grade, level: level.level, success: true, stars, ...summary })
    else track('practice_end', { kind, ...summary })
    if (before < DAILY_GOAL && wordsToday() >= DAILY_GOAL) track('daily_goal_complete', { words: wordsToday() })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const title = kind === 'level' ? `第 ${level.level} 关 通关！` : kind === 'review' ? '复习完成！' : '探险完成！'

  return (
    <div className="complete-page">
      <svg className="confetti" viewBox="0 0 1280 860" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <circle cx="640" cy="300" r="420" fill="#5E918C" />
        <circle cx="640" cy="300" r="300" fill="#6EA29C" />
        <rect x="250" y="120" width="18" height="10" rx="2" fill="#F2A93B" transform="rotate(30 259 125)" />
        <rect x="330" y="260" width="14" height="8" rx="2" fill="#E4573D" transform="rotate(-20 337 264)" />
        <rect x="980" y="140" width="18" height="10" rx="2" fill="#7CC46B" transform="rotate(-35 989 145)" />
        <rect x="900" y="300" width="14" height="8" rx="2" fill="#FFF4D6" transform="rotate(40 907 304)" />
        <circle cx="420" cy="90" r="7" fill="#FFF4D6" />
        <circle cx="860" cy="80" r="6" fill="#F2A93B" />
        <circle cx="200" cy="420" r="8" fill="#7CC46B" />
        <circle cx="1080" cy="420" r="7" fill="#E4573D" />
      </svg>

      <div className="complete-card">
        <div className="complete-chest"><Chest open size={190} /></div>
        <h1 className="display">{title}</h1>
        <div className="big-stars" aria-label={`${stars} 颗星`}>
          <BigStar size={70} on={stars >= 1} />
          <BigStar size={92} on={stars >= 2} />
          <BigStar size={70} on={stars >= 3} />
        </div>
        <p className="next-star">{more === null ? '拿满 3 颗星，太厉害了！' : `再写对 ${more} 个词就能拿到 ${stars + 1} 颗星`}</p>

        <div className="stat-row">
          <div className="stat"><b className="display green-text">{correct} / {n}</b><span>写对的词</span></div>
          <div className="stat"><b className="display">×{stats.bestStreak}</b><span>最高连对</span></div>
          <div className="stat"><b className="display">{mmss(stats.ms)}</b><span>用时</span></div>
        </div>

        {wrong.length > 0 && (
          <div className="camp-box">
            <Tent size={44} />
            <div className="camp-words">
              <b>{wrong.length} 个词去了复习营地</b>
              <span className="word-chips">
                {wrong.map((r) => {
                  const bad = new Set(mistakeOf(r).bad.split(',').map(Number))
                  return (
                    <span key={r.word} className="word-chip kai">
                      {[...r.word].map((ch, i) => (bad.has(i) ? <b key={i}>{ch}</b> : <span key={i}>{ch}</span>))}
                    </span>
                  )
                })}
              </span>
            </div>
            <button className="btn-chunky soft" onClick={() => onReview(wrong)}>马上复习</button>
          </div>
        )}

        {account.status === 'guest' && wrong.length > 0 && (
          <button className="save-nudge" onClick={onLogin}>
            想把复习营地和星星保存下来？<b>家长登录 →</b>
          </button>
        )}

        <div className="complete-actions">
          <button className="cta white" onClick={onHome}>回到地图</button>
          {kind === 'level' && onNext ? (
            <button className="cta red" onClick={onNext}>下一关 →</button>
          ) : (
            <button className="cta red" onClick={onAgain}>{kind === 'review' ? '继续复习' : '再来一组'}</button>
          )}
        </div>
      </div>
      <Mascot mood="cheer" size={140} className="complete-mascot" label="墨墨在欢呼" />
    </div>
  )
}
