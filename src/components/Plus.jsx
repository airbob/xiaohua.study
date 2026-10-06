import { useEffect, useState } from 'react'
import { useAccount, startCheckout } from '../lib/account.js'
import { t, useT, getLang } from '../lib/i18n.js'
import { track } from '../lib/analytics.js'
import Mascot from './Mascot.jsx'

// Shown prices — the charge itself comes from the Stripe Price ids (wrangler.jsonc).
// Keep these in sync with Stripe.
// Terms / privacy pages are drafts in docs/legal/; link them once they are published.
const LEGAL_READY = false
export const PRICES = { month: 6.98, year: 68.98 }
const sgd = (n) => `S$${n.toFixed(2)}`

const FEATURES = [
  ['最多 6 个孩子', '兄弟姐妹各有各的地图、星星和复习营地'],
  ['练习记录存在云端', '换电脑、换平板都能接着练，记录随时可以查看'],
  ['家长报告', '每周写了多少词、正确率、哪些字常写错'],
  ['自定义词组', '输入学校这周的听写词，孩子马上就能练'],
  ['孩子用 PIN 自己登录', '在孩子自己的平板上也能练，进度同步'],
  ['更多新功能', '定制页面、定制吉祥物等，开发好就解锁'],
]

/** What to tell a parent when a 订阅管理 action fails. */
export function portalError(e) {
  return (
    {
      stripe_customer_missing: t('找不到这个订阅的付款记录。请发邮件给我们，我们帮你处理。'),
      portal_not_configured: t('订阅管理暂时打不开，我们正在处理，请稍后再试。'),
      no_subscription: t('这个账号还没有订阅。'),
      not_active: t('这个订阅已经结束了。'),
      cancelling: t('订阅已取消，先恢复订阅才能换方案。'),
    }[e.code] || t('出错了，请再试一次')
  )
}

/** Small "Pro" tag next to a locked feature. */
export function PlusTag() {
  return <span className="plus-tag">Pro</span>
}

/**
 * The upgrade sheet. Guests are asked to log in first (onLogin); children are told to ask a
 * parent; a parent who is already on Pro sees their plan and can manage it.
 */
export function PlusModal({ onClose, onLogin, onPlan, reason }) {
  const t = useT()
  const a = useAccount()
  const [interval, setInterval_] = useState('year')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    track('view_promotion', { promotion_name: 'plus', reason: reason || 'menu' })
  }, [reason])

  const go = async () => {
    setBusy(true)
    setError('')
    try {
      await startCheckout(interval)
    } catch (e) {
      setError(e.code === 'billing_not_configured' ? t('付费功能即将开放，敬请期待！') : t('出错了，请再试一次'))
      setBusy(false)
    }
  }

  const saving = Math.round((1 - PRICES.year / (PRICES.month * 12)) * 100)
  const signedIn = a.status === 'signed-in'
  const until = a.plan?.until ? new Date(a.plan.until).toLocaleDateString(getLang() === 'en' ? 'en-SG' : 'zh-CN') : ''

  return (
    <div className="modal" onClick={onClose} role="dialog" aria-modal="true" aria-label={t('小华听写 Pro')}>
      <div className="modal-card sheet plus-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div className="modal-title">
            {t('小华听写')} <span className="plus-word">Pro</span>
          </div>
          <button className="btn ghost close" onClick={onClose} aria-label={t('关闭')}>✕</button>
        </div>

        {reason && <p className="plus-reason">{t(reason)}</p>}

        <ul className="plus-features">
          {FEATURES.map(([title, desc]) => (
            <li key={title}>
              <span className="perk-check" aria-hidden="true">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1B1B26" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10" /></svg>
              </span>
              <span>
                <b>{t(title)}</b>
                <span>{t(desc)}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="muted tiny">{t('免费版可以练所有年级和关卡（1 个孩子，记录保存在这台设备上）。')}</p>

        {a.plan?.plus && !a.child ? (
          <div className="plus-current">
            <p>
              <b>{t('你已经是 Pro 会员')}</b>
              <br />
              <span className="muted small">
                {a.plan.cancelAtPeriodEnd ? t('订阅会在 {d} 结束', { d: until }) : t('下次续费：{d}', { d: until })}
              </span>
            </p>
            {a.plan.canManage && (
              <button className="btn" onClick={onPlan}>{t('管理订阅')}</button>
            )}
          </div>
        ) : a.child ? (
          <MascotSaysPlain>{t('请爸爸妈妈在他们的账号里升级 Pro。')}</MascotSaysPlain>
        ) : (
          <>
            <div className="plan-pick" role="radiogroup" aria-label={t('选择方案')}>
              <button role="radio" aria-checked={interval === 'year'} className={interval === 'year' ? 'on' : ''} onClick={() => setInterval_('year')}>
                <span className="plan-badge">{t('省 {n}%', { n: saving })}</span>
                <b>{t('年付')}</b>
                <span className="plan-price">{sgd(PRICES.year)}<small>{t(' / 年')}</small></span>
                <span className="muted tiny">{t('约 {p} / 月', { p: sgd(PRICES.year / 12) })}</span>
              </button>
              <button role="radio" aria-checked={interval === 'month'} className={interval === 'month' ? 'on' : ''} onClick={() => setInterval_('month')}>
                <b>{t('月付')}</b>
                <span className="plan-price">{sgd(PRICES.month)}<small>{t(' / 月')}</small></span>
                <span className="muted tiny">{t('随时可以取消')}</span>
              </button>
            </div>
            {signedIn ? (
              <button className="btn primary big-btn" onClick={go} disabled={busy}>
                {busy ? t('正在跳转…') : t('升级 Pro')}
              </button>
            ) : (
              <button className="btn primary big-btn" onClick={onLogin}>{t('先登录，再升级')}</button>
            )}
            <p className="muted tiny">
              {t('由 Stripe 安全付款，可用信用卡、Apple Pay 或 Google Pay。自动续费，随时可以在「管理订阅」里取消。')}
              {LEGAL_READY && (
                <>
                  {' '}
                  <a href="/terms/" target="_blank" rel="noopener">{t('服务条款')}</a> · <a href="/privacy/" target="_blank" rel="noopener">{t('隐私政策')}</a>
                </>
              )}
            </p>
          </>
        )}
        {error && <p className="form-error">{error}</p>}
      </div>
    </div>
  )
}

function MascotSaysPlain({ children }) {
  return (
    <div className="says says-cream">
      <Mascot size={48} />
      <div className="bubble">{children}</div>
    </div>
  )
}

/** A feature card shown to free accounts in place of a Pro feature. */
export function PlusLocked({ title, desc, onUpgrade }) {
  const t = useT()
  return (
    <div className="card plus-locked">
      <div>
        <b>{t(title)}</b> <PlusTag />
        <p className="muted small">{t(desc)}</p>
      </div>
      <button className="btn primary" onClick={onUpgrade}>{t('了解 Pro')}</button>
    </div>
  )
}
