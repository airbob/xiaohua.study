import { useMemo } from 'react'
import { LEVELS, SET_SIZE, countByLevel } from '../lib/bank.js'
import { loadHistory, loadMistakes } from '../lib/storage.js'

const LEVEL_NOTE = {
  P1: '一年级基础词',
  P2: '二年级',
  P3: '三年级',
  P4: '四年级',
  P5: '五年级',
  P6: '六年级',
}

export default function Home({ prefs, onPrefs, onStart }) {
  const counts = useMemo(countByLevel, [])
  const mistakes = useMemo(() => Object.keys(loadMistakes()).length, [])
  const last = useMemo(() => loadHistory()[0], [])

  return (
    <main className="home">
      <header className="brand">
        <div className="brand-mark">写</div>
        <div>
          <h1>写华文</h1>
          <p className="muted">新加坡小学华文听写 · 听一听，写一写</p>
        </div>
      </header>

      <section className="panel">
        <h2>选年级</h2>
        <div className="level-grid">
          {LEVELS.map((l) => (
            <button key={l} className="level" onClick={() => onStart(l)}>
              <span className="level-name">{l}</span>
              <span className="level-sub">{LEVEL_NOTE[l]}</span>
              <span className="level-count">{counts[l] || 0} 词</span>
            </button>
          ))}
        </div>
        <div className="level-row">
          <button className="level wide mix" onClick={() => onStart('mix')}>
            <span className="level-name">混合</span>
            <span className="level-sub">P1–P6 随机</span>
          </button>
          <button
            className="level wide review"
            onClick={() => onStart('review')}
            disabled={!mistakes}
            title={mistakes ? '' : '还没有错词'}
          >
            <span className="level-name">错词本</span>
            <span className="level-sub">{mistakes ? `${mistakes} 个词要复习` : '还没有错词'}</span>
          </button>
        </div>
        <p className="muted small">每组 {SET_SIZE} 个词。词语来自新加坡小学华文考卷里最常出现的词。</p>
      </section>

      <section className="panel">
        <h2>练习方式</h2>
        <div className="seg">
          <button className={prefs.mode === 'dictation' ? 'on' : ''} onClick={() => onPrefs({ mode: 'dictation' })}>
            <strong>听写</strong>
            <span>不显示字形</span>
          </button>
          <button className={prefs.mode === 'trace' ? 'on' : ''} onClick={() => onPrefs({ mode: 'trace' })}>
            <strong>描红</strong>
            <span>照着浅色字写</span>
          </button>
        </div>
        <div className="toggles">
          <Toggle label="自动读出词语" on={prefs.autoSpeak} set={(v) => onPrefs({ autoSpeak: v })} />
          <Toggle label="显示例句" on={prefs.showExample} set={(v) => onPrefs({ showExample: v })} />
          <Toggle label="显示英文意思" on={prefs.showEnglish} set={(v) => onPrefs({ showEnglish: v })} />
        </div>
      </section>

      <section className="about">
        <h2>词语表</h2>
        <ul className="wordlist-links">
          {LEVELS.map((l) => (
            <li key={l}>
              <a href={`/words/${l.toLowerCase()}/`}>{l} 华文听写词语表</a>
            </li>
          ))}
        </ul>
        <p className="muted small">
          写华文是给新加坡小学生的华文听写练习：听读音、看拼音，在田字格里把整个词写出来，写完逐个字检查笔画、笔顺和方向。词语整理自 P1–P6 华文考卷里最常出现的词。
        </p>
        <p className="muted small" lang="en">
          Free Chinese spelling (听写) practice for Singapore primary school students — handwrite each word and get stroke-by-stroke feedback.
        </p>
      </section>

      {last && (
        <p className="muted small center">
          上次练习：{last.score} 分 · {new Date(last.t).toLocaleDateString('zh-CN')}
        </p>
      )}
    </main>
  )
}

function Toggle({ label, on, set }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={!!on} onChange={(e) => set(e.target.checked)} />
      <span className="switch" aria-hidden="true" />
      {label}
    </label>
  )
}
