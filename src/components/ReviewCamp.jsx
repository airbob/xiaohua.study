import { useMemo, useState } from 'react'
import WORDS from '../data/words.json'
import { loadMistakes, loadCleared } from '../lib/storage.js'
import { useAccount } from '../lib/account.js'
import { speakWord } from '../lib/speech.js'
import { Back, Tent, Campfire, Sprout } from './Icons.jsx'
import Mascot from './Mascot.jsx'
import Footer from './Footer.jsx'
import { GRADES } from '../lib/levels.js'
import { useT } from '../lib/i18n.js'
import { noteText } from '../lib/score.js'

const byWord = new Map(WORDS.map((w) => [w.word, w]))
const ROUND = 10

/** 复习营地: every word in the 错词本 as a card; review them 10 at a time. */
export default function ReviewCamp({ prefs, onPrefs, onBack, onStart }) {
  const t = useT()
  const account = useAccount()
  const v = account.version
  const mistakes = useMemo(loadMistakes, [v])
  const clearedWeek = useMemo(() => loadCleared().filter((c) => c.t > Date.now() - 7 * 86400_000).length, [v])
  const [filter, setFilter] = useState('all')

  const items = Object.entries(mistakes)
    .map(([word, m]) => ({ ...m, word, info: byWord.get(word) }))
    .filter((x) => x.info)
    .sort((a, b) => (b.last || 0) - (a.last || 0))
  const counts = Object.fromEntries(GRADES.map((g) => [g, items.filter((x) => x.info.grade === g).length]))
  const shown = filter === 'all' ? items : items.filter((x) => x.info.grade === filter)
  const round = shown.slice(0, ROUND)

  return (
    <>
    <div className="camp-page">
      <header className="camp-head">
        <button className="btn-chunky back" onClick={onBack} aria-label={t('回到地图')}><Back /> <span className="hide-sm">{t('地图')}</span></button>
        <Tent size={56} />
        <div className="camp-title">
          <h1 className="display">{t('复习营地')}</h1>
          <p>{t('写错的词会在这里等你。连续写对 2 次，它就能回到岛上。')}</p>
        </div>
        <div className="grow" />
        {items.length > 0 && (
          <div className="filter-tabs" role="tablist">
            <button role="tab" aria-selected={filter === 'all'} className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>{t('全部')} {items.length}</button>
            {GRADES.filter((g) => counts[g]).map((g) => (
              <button key={g} role="tab" aria-selected={filter === g} className={filter === g ? 'on' : ''} onClick={() => setFilter(g)}>{g} · {counts[g]}</button>
            ))}
          </div>
        )}
      </header>

      <div className="camp-body">
        <section className="camp-grid">
          {shown.map((x) => {
            const bad = new Set(String(x.bad || '').split(',').filter(Boolean).map(Number))
            return (
              <button key={x.word} className="camp-card" onClick={() => speakWord(x.word)} aria-label={t('{w}，点一下听读音', { w: x.word })}>
                <span className="camp-py">{x.info.pinyin.join(' ')}</span>
                <span className="camp-word kai">
                  {[...x.word].map((ch, i) => (bad.has(i) ? <span key={i} className="bad">{ch}</span> : <span key={i}>{ch}</span>))}
                </span>
                <span className="camp-note">{x.note ? noteText(x.note) : t('写错了 {n} 次', { n: x.count })}</span>
                <span className="grow" />
                <span className="camp-progress">
                  <span className={`dot ${x.streak >= 1 ? 'on' : ''}`} />
                  <span className={`dot ${x.streak >= 2 ? 'on' : ''}`} />
                  {x.streak >= 1 ? t('再对 1 次就回岛') : t('刚到营地')}
                </span>
                <span className="grade-tag">{x.info.grade}</span>
              </button>
            )
          })}
          {items.length === 0 ? (
            <div className="camp-empty">
              <Mascot size={90} />
              <b className="display">{t('营地空空的！')}</b>
              <span>{t('写错的词会来这里。去岛上闯一关吧。')}</span>
            </div>
          ) : (
            <div className="camp-card back-home">
              <Sprout />
              <span className="display">{t('本周已回岛 {n} 个', { n: clearedWeek })}</span>
              <span>{t('连续写对 2 次的词，会回到你的地图上')}</span>
            </div>
          )}
        </section>

        <aside className="camp-side">
          <div className="card fire">
            <Campfire />
            <h2 className="display">{t('今晚营火任务')}</h2>
            <p>{items.length ? t('把 {n} 个词各写一次，营火会烧得更旺。', { n: Math.min(items.length, ROUND) }) : t('今天没有要救的词，营火烧得正旺！')}</p>
          </div>
          {items.length > 0 && (
            <div className="card play">
              <h2 className="small-title">{t('复习方式')}</h2>
              <div className="mode-pick">
                <button className={prefs.mode === 'trace' ? 'on' : ''} onClick={() => onPrefs({ mode: 'trace' })}>{t('描红复习')}</button>
                <button className={prefs.mode === 'dictation' ? 'on' : ''} onClick={() => onPrefs({ mode: 'dictation' })}>{t('听写复习')}</button>
              </div>
              <p className="muted-text">{t('描红跟着浅色的字写，适合刚写错的词；听写更像考试。')}</p>
            </div>
          )}
          <div className="grow" />
          {round.length > 0 && (
            <button className="cta red" onClick={() => onStart(round.map((x) => x.info))}>
              {t('开始复习 {n} 个词', { n: round.length })}
            </button>
          )}
        </aside>
      </div>
    </div>
    <Footer />
    </>
  )
}
