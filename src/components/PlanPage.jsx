import { useEffect, useState } from 'react'
import { useAccount, fetchSubscription, cancelSubscription, resumeSubscription, switchPlan, updateCard } from '../lib/account.js'
import { useT, getLang } from '../lib/i18n.js'
import { track } from '../lib/analytics.js'
import { Back } from './Icons.jsx'
import Mascot from './Mascot.jsx'
import Footer from './Footer.jsx'
import { PRICES, portalError } from './Plus.jsx'

// Stripe's cancellation_details.feedback values
const REASONS = [
  ['too_expensive', '太贵了'],
  ['unused', '孩子用得不多'],
  ['missing_features', '缺少需要的功能'],
  ['too_complex', '用起来太复杂'],
  ['switched_service', '改用别的产品或补习'],
  ['other', '其他原因'],
]

const BRANDS = { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', unionpay: 'UnionPay', jcb: 'JCB', discover: 'Discover', diners: 'Diners' }

/** 订阅管理: the family's Pro plan — renewal, switch monthly ↔ yearly, cancel / resume, card, receipts. */
export default function PlanPage({ onBack, onUpgrade }) {
  const t = useT()
  const a = useAccount()
  const [sub, setSub] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState('')
  const [comment, setComment] = useState('')
  const [done, setDone] = useState('')
  const en = getLang() === 'en'
  const date = (ms) => new Date(ms).toLocaleDateString(en ? 'en-SG' : 'zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
  const money = (cents, cur = 'sgd') => `${cur.toLowerCase() === 'sgd' ? 'S$' : cur.toUpperCase() + ' '}${(cents / 100).toFixed(2)}`
  const per = (interval) => (interval === 'year' ? t(' / 年') : t(' / 月'))
  const planName = (interval) => (interval === 'year' ? t('年付') : t('月付'))

  const load = () =>
    fetchSubscription()
      .then((s) => {
        setSub(s)
        setError('')
      })
      .catch((e) => setError(e.code === 'no_subscription' ? 'none' : portalError(e)))

  useEffect(() => {
    track('plan_view')
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (name, fn, after) => {
    setBusy(name)
    setDone('')
    try {
      await fn()
      await load()
      if (after) setDone(after)
    } catch (e) {
      setError(portalError(e))
    }
    setBusy('')
  }

  const other = sub?.interval === 'year' ? 'month' : 'year'
  const live = sub && ['active', 'trialing', 'past_due'].includes(sub.status)

  return (
    <>
      <div className="camp-page plan-page">
        <header className="camp-head">
          <button className="btn-chunky back" onClick={onBack} aria-label={t('回到地图')}>
            <Back /> <span className="hide-sm">{t('地图')}</span>
          </button>
          <div className="camp-title">
            <h1 className="display">{t('订阅管理')}</h1>
            <p>{a.user?.email}</p>
          </div>
        </header>

        {error === 'none' ? (
          <div className="lists-empty card">
            <Mascot size={80} />
            <div>
              <b className="display">{t('这个账号还没有订阅。')}</b>
              <p className="muted small">{t('免费版可以练所有年级和关卡（1 个孩子，记录保存在这台设备上）。')}</p>
              <button className="btn primary" onClick={onUpgrade}>{t('了解 Pro')}</button>
            </div>
          </div>
        ) : !sub ? (
          <p className={error ? 'form-error' : 'muted'}>{error || '…'}</p>
        ) : (
          <div className="plan-grid">
            <section className="card plan-main">
              <div className="plan-title">
                <b className="display">{t('小华听写')} <span className="plus-word">Pro</span></b>
                <span className="plan-chip">{planName(sub.interval)}</span>
              </div>
              <p className="plan-price-line">
                <b>{money(sub.amount, sub.currency)}</b>
                {per(sub.interval)}
              </p>

              {sub.status === 'past_due' ? (
                <p className="plan-alert">{t('上次扣款没有成功。请更新付款卡片，Stripe 会自动再试。')}</p>
              ) : sub.cancelAtPeriodEnd ? (
                <p className="plan-alert soft">{t('订阅已取消。Pro 会用到 {d}，之后不会再扣款。', { d: date(sub.periodEnd) })}</p>
              ) : (
                <p className="muted">{t('下次续费：{d}', { d: date(sub.periodEnd) })}</p>
              )}

              {sub.pending && !sub.cancelAtPeriodEnd && (
                <p className="plan-note">
                  {t('{d} 起改为{plan}（{price}）。', {
                    d: date(sub.pending.from),
                    plan: planName(sub.pending.interval),
                    price: `S$${PRICES[sub.pending.interval].toFixed(2)}${per(sub.pending.interval)}`,
                  })}{' '}
                  <button
                    className="link-btn"
                    disabled={!!busy}
                    onClick={() => run('switch', () => switchPlan(sub.interval).then(() => track('plan_switch', { interval: sub.interval, undo: true })), t('已撤销，方案保持不变。'))}
                  >
                    {t('撤销')}
                  </button>
                </p>
              )}

              {done && <p className="plan-done">{done}</p>}

              {live && !sub.cancelAtPeriodEnd && !sub.pending && (
                <div className="plan-switch">
                  <div>
                    <b>{t('改为{plan}', { plan: planName(other) })}</b>
                    <span className="muted small">
                      {other === 'year'
                        ? t('S$68.98 / 年，比月付省 {n}%。', { n: Math.round((1 - PRICES.year / (PRICES.month * 12)) * 100) })
                        : t('S$6.98 / 月，随时可以取消。')}{' '}
                      {t('从下次续费（{d}）开始，现在不会多扣钱。', { d: date(sub.periodEnd) })}
                    </span>
                  </div>
                  <button
                    className="btn"
                    disabled={!!busy}
                    onClick={() => run('switch', () => switchPlan(other).then(() => track('plan_switch', { interval: other })), t('好的，下次续费起改为{plan}。', { plan: planName(other) }))}
                  >
                    {busy === 'switch' ? t('处理中…') : t('改为{plan}', { plan: planName(other) })}
                  </button>
                </div>
              )}

              <div className="plan-actions">
                {sub.cancelAtPeriodEnd ? (
                  <button
                    className="btn primary"
                    disabled={!!busy}
                    onClick={() => run('resume', () => resumeSubscription().then(() => track('plan_resume')), t('欢迎回来！订阅会照常续费。'))}
                  >
                    {busy === 'resume' ? t('处理中…') : t('恢复订阅')}
                  </button>
                ) : (
                  live && !cancelling && (
                    <button className="btn ghost danger-link" onClick={() => setCancelling(true)}>
                      {t('取消订阅')}
                    </button>
                  )
                )}
              </div>

              {cancelling && !sub.cancelAtPeriodEnd && (
                <div className="cancel-box">
                  <p>
                    <b>{t('确定要取消吗？')}</b>
                    <br />
                    <span className="small">
                      {t('Pro 会用到 {d}，之后不会再扣款。孩子的记录会保留，以后重新订阅就能恢复。', { d: date(sub.periodEnd) })}
                    </span>
                  </p>
                  <fieldset className="reason-list">
                    <legend className="small">{t('方便告诉我们原因吗？（可以不选）')}</legend>
                    {REASONS.map(([k, label]) => (
                      <label key={k} className={reason === k ? 'on' : ''}>
                        <input type="radio" name="reason" value={k} checked={reason === k} onChange={() => setReason(k)} />
                        {t(label)}
                      </label>
                    ))}
                  </fieldset>
                  <textarea rows={3} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t('还有什么想说的？（可以不填）')} />
                  <div className="plan-actions">
                    <button
                      className="btn danger"
                      disabled={!!busy}
                      onClick={() =>
                        run(
                          'cancel',
                          () =>
                            cancelSubscription(reason || null, comment).then(() => {
                              track('plan_cancel', { reason: reason || 'none' })
                              setCancelling(false)
                            }),
                          t('订阅已取消。谢谢你告诉我们！'),
                        )
                      }
                    >
                      {busy === 'cancel' ? t('处理中…') : t('确认取消')}
                    </button>
                    <button className="btn ghost" onClick={() => setCancelling(false)}>{t('先不取消')}</button>
                  </div>
                </div>
              )}
              {error && <p className="form-error">{error}</p>}
            </section>

            <section className="card plan-card">
              <h2 className="display">{t('付款方式')}</h2>
              {sub.card ? (
                <p className="card-line">
                  <span className="card-brand">{BRANDS[sub.card.brand] || sub.card.brand}</span>
                  <b>•••• {sub.card.last4}</b>
                  <span className="muted small">{t('有效期 {m}/{y}', { m: String(sub.card.expMonth).padStart(2, '0'), y: String(sub.card.expYear).slice(-2) })}</span>
                </p>
              ) : (
                <p className="muted small">{t('还没有保存的卡片。')}</p>
              )}
              <button className="btn" disabled={!!busy} onClick={() => run('card', updateCard)}>
                {busy === 'card' ? t('正在打开…') : t('更换卡片')}
              </button>
              <p className="muted tiny">{t('换卡在 Stripe 的安全页面完成，我们不会看到或保存卡号。')}</p>
            </section>

            <section className="card plan-invoices">
              <h2 className="display">{t('付款记录')}</h2>
              {sub.invoices.length === 0 ? (
                <p className="muted small">{t('还没有付款记录。')}</p>
              ) : (
                <table className="recent-table">
                  <thead>
                    <tr>
                      <th>{t('日期')}</th>
                      <th>{t('金额')}</th>
                      <th>{t('状态')}</th>
                      <th>{t('收据')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sub.invoices.map((i) => (
                      <tr key={i.number || i.date}>
                        <td>{date(i.date)}</td>
                        <td>{money(i.amount, i.currency)}</td>
                        <td>{{ paid: t('已付款'), open: t('待付款'), void: t('已作废'), uncollectible: t('未收到') }[i.status] || i.status}</td>
                        <td>
                          {i.url ? (
                            <a href={i.url} target="_blank" rel="noopener">{t('查看')}</a>
                          ) : i.pdf ? (
                            <a href={i.pdf} target="_blank" rel="noopener">PDF</a>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>
        )}
      </div>
      <Footer />
    </>
  )
}
