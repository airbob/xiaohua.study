import { useEffect, useState } from 'react'
import { useAccount, fetchReport } from '../lib/account.js'
import { useT, getLang } from '../lib/i18n.js'
import { track } from '../lib/analytics.js'
import { Back } from './Icons.jsx'
import Mascot from './Mascot.jsx'
import StrokeReplay from './StrokeReplay.jsx'
import Footer from './Footer.jsx'

const BAR = '#E39B1B' // island orange; below 3:1 on white, so values are labelled and tabled

/**
 * Columns for one series. Labels only the current (last) and the highest column — the
 * tooltip and the screen-reader table carry the rest.
 */
function Columns({ data, caption, unit, height = 150 }) {
  const [hover, setHover] = useState(null)
  const W = 100 * data.length
  const max = Math.max(1, ...data.map((d) => d.value))
  const top = Math.ceil(max / 5) * 5 || 5
  const peak = data.reduce((m, d, i) => (d.value > data[m].value ? i : m), 0)
  const plotH = height - 34
  const y = (v) => 10 + plotH - (v / top) * plotH
  const barW = Math.min(24 * (W / 600), 34)
  return (
    <figure className="report-chart">
      <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" role="img" aria-label={caption} onMouseLeave={() => setHover(null)}>
        {[0, top / 2, top].map((v) => (
          <line key={v} x1="0" x2={W} y1={y(v)} y2={y(v)} stroke="#E6E1D3" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
        {data.map((d, i) => {
          const cx = i * 100 + 50
          const h = (d.value / top) * plotH
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0}>
              <rect x={i * 100} y="0" width="100" height={height} fill="transparent" />
              {d.value > 0 && (
                <path
                  d={`M${cx - barW / 2} ${y(0)} V${y(d.value) + Math.min(4, h)} q0 -4 4 -4 H${cx + barW / 2 - 4} q4 0 4 4 V${y(0)} Z`}
                  fill={BAR}
                  opacity={hover === null || hover === i ? 1 : 0.55}
                />
              )}
            </g>
          )
        })}
      </svg>
      {/* text sits in HTML so it keeps its shape however wide the chart is */}
      <div className="chart-labels" aria-hidden="true">
        {data.map((d, i) => (
          <span key={i} className="chart-col">
            <b className="chart-value" style={{ bottom: `${((d.value / top) * plotH + 24) / height * 100}%`, visibility: i === data.length - 1 || i === peak || hover === i ? 'visible' : 'hidden' }}>
              {d.value}
            </b>
            <span className="chart-x">{d.label}</span>
          </span>
        ))}
      </div>
      {hover !== null && (
        <div className="chart-tip" style={{ left: `${((hover + 0.5) / data.length) * 100}%` }}>
          <b>{data[hover].tipTitle}</b>
          <span>{data[hover].tip}</span>
        </div>
      )}
      <table className="sr-only">
        <caption>{caption}</caption>
        <tbody>
          {data.map((d, i) => (
            <tr key={i}>
              <th scope="row">{d.tipTitle}</th>
              <td>{d.value} {unit}</td>
              <td>{d.tip}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

const pct = (x) => (x === null || x === undefined ? '—' : `${Math.round(x * 100)}%`)

/** 学习报告: one child's week, the trend, and what they keep getting wrong. Pro, parents only. */
export default function ReportPage({ profileId, onBack, onPick }) {
  const t = useT()
  const a = useAccount()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [replay, setReplay] = useState(null)
  const en = getLang() === 'en'
  const date = (ms, opts = { month: 'numeric', day: 'numeric' }) => new Date(ms).toLocaleDateString(en ? 'en-SG' : 'zh-CN', opts)

  useEffect(() => {
    setData(null)
    track('report_view')
    fetchReport(profileId)
      .then(setData)
      .catch(() => setError(t('出错了，请再试一次')))
  }, [profileId]) // eslint-disable-line react-hooks/exhaustive-deps

  const source = (s) => {
    const m = /^(P[1-6]):(\d+)$/.exec(s)
    if (m) return `${m[1]} · ${t('第 {n} 关', { n: m[2] })}`
    return { mix: t('随机探险'), review: t('复习营地'), list: t('我的词组') }[s] || s
  }

  const tw = data?.thisWeek
  const lw = data?.lastWeek
  const delta = tw && lw ? tw.words - lw.words : 0

  return (
    <>
      <div className="camp-page report-page">
        <header className="camp-head">
          <button className="btn-chunky back" onClick={onBack} aria-label={t('回到地图')}>
            <Back /> <span className="hide-sm">{t('地图')}</span>
          </button>
          <div className="camp-title">
            <h1 className="display">
              {data ? t('{name} 的学习报告', { name: data.profile.name }) : t('学习报告')}
            </h1>
            <p>{t('本周从星期一开始算。数字只包括登录后在任何设备上的练习。')}</p>
          </div>
          <div className="grow" />
          {a.profiles.length > 1 && (
            <div className="filter-tabs" role="tablist" aria-label={t('选择孩子')}>
              {a.profiles.map((p) => (
                <button key={p.id} role="tab" aria-selected={p.id === profileId} className={p.id === profileId ? 'on' : ''} onClick={() => onPick(p.id)}>
                  {p.avatar} {p.name}
                </button>
              ))}
            </div>
          )}
        </header>

        {!data ? (
          <p className="muted">{error || '…'}</p>
        ) : (
          <>
            <section className="kpis">
              <div className="kpi">
                <span className="kpi-label">{t('本周写了')}</span>
                <b className="display">{tw.words}</b>
                <span className="kpi-unit">{t('个词')}</span>
                <span className={`kpi-delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}`}>
                  {delta === 0 ? t('和上周一样') : delta > 0 ? t('比上周多 {n}', { n: delta }) : t('比上周少 {n}', { n: -delta })}
                </span>
              </div>
              <div className="kpi">
                <span className="kpi-label">{t('全对率')}</span>
                <b className="display">{pct(tw.accuracy)}</b>
                <span className="kpi-delta">{t('上周 {p}', { p: pct(lw.accuracy) })}</span>
              </div>
              <div className="kpi">
                <span className="kpi-label">{t('练习天数')}</span>
                <b className="display">{tw.days}<small> / 7</small></b>
                <span className="kpi-delta">{t('共 {m} 分钟', { m: tw.minutes })}</span>
              </div>
              <div className="kpi">
                <span className="kpi-label">{t('复习营地')}</span>
                <b className="display">{data.camp}</b>
                <span className="kpi-delta">{t('本周回岛 {n} 个', { n: data.clearedThisWeek })}</span>
              </div>
              <div className="kpi">
                <span className="kpi-label">{t('已过关')}</span>
                <b className="display">{data.levelsCleared}</b>
                <span className="kpi-delta">★ {data.stars}</span>
              </div>
            </section>

            <div className="report-grid">
              <section className="card">
                <h2 className="display">{t('最近 8 周写的词')}</h2>
                <Columns
                  caption={t('最近 8 周写的词')}
                  unit={t('个词')}
                  data={data.weeks.map((w, i) => ({
                    value: w.words,
                    label: i === data.weeks.length - 1 ? t('本周') : date(w.start),
                    tipTitle: t('{d} 那周', { d: date(w.start) }),
                    tip: t('{n} 个词 · 全对 {p}', { n: w.words, p: pct(w.words ? w.correct / w.words : null) }),
                  }))}
                />
              </section>
              <section className="card">
                <h2 className="display">{t('最近 7 天')}</h2>
                <Columns
                  caption={t('最近 7 天')}
                  unit={t('个词')}
                  data={data.days.map((d, i) => ({
                    value: d.words,
                    label: i === data.days.length - 1 ? t('今天') : date(d.start, { weekday: 'short' }),
                    tipTitle: date(d.start, { month: 'numeric', day: 'numeric', weekday: 'short' }),
                    tip: t('{n} 个词 · 全对 {p}', { n: d.words, p: pct(d.words ? d.correct / d.words : null) }),
                  }))}
                />
              </section>
            </div>

            <section className="card">
              <h2 className="display">{t('常写错的字')}</h2>
              {data.missed.length === 0 ? (
                <div className="says says-cream"><Mascot size={48} /><div className="bubble">{t('最近 8 周没有常错的字，真棒！')}</div></div>
              ) : (
                <>
                  <p className="muted small">{t('最近 8 周写错次数最多的字。点一个字看正确笔顺。')}</p>
                  <div className="missed-grid">
                    {data.missed.map((m) => (
                      <button key={m.char} className="missed" onClick={() => setReplay(m.char)}>
                        <b className="kai">{m.char}</b>
                        <span className="missed-count">{t('错 {n} 次', { n: m.count })}</span>
                        <span className="muted tiny">{m.words.join('、')}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </section>

            <section className="card">
              <h2 className="display">{t('最近的练习')}</h2>
              {data.recent.length === 0 ? (
                <p className="muted small">{t('最近 8 周还没有练习记录。')}</p>
              ) : (
                <table className="recent-table">
                  <thead>
                    <tr>
                      <th>{t('时间')}</th>
                      <th>{t('练习')}</th>
                      <th>{t('词数')}</th>
                      <th>{t('得分')}</th>
                      <th>{t('用时')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent.map((r, i) => (
                      <tr key={i}>
                        <td>{date(r.t, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                        <td>{source(r.source)}</td>
                        <td>{r.n}</td>
                        <td>{r.score}</td>
                        <td>{r.minutes ? t('{m} 分钟', { m: r.minutes }) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </>
        )}
      </div>
      <Footer />
      {replay && <StrokeReplay char={replay} onClose={() => setReplay(null)} />}
    </>
  )
}
