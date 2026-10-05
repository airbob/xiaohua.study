import { useEffect, useRef, useState } from 'react'
import {
  useAccount, createProfile, updateProfile, deleteProfile, selectProfile, signOut, deleteAccount,
  sendEmailLink, verifyEmailCode, initAccount, childSignIn, familyEmail, handOver, setPin, listDevices, revokeDevices, isPaused, openPortal,
} from '../lib/account.js'
import { LEVELS } from '../lib/bank.js'
import { api } from '../lib/api.js'
import { t, useT, getLang } from '../lib/i18n.js'
import { PlusTag } from './Plus.jsx'

let providersCache = null
const loadProviders = () => (providersCache ||= api('/api/auth/providers').catch(() => ({ google: false, email: true })))

export const AVATARS = ['🐼', '🐯', '🐰', '🐨', '🦊', '🐸', '🐧', '🦁', '🐳', '🦄']

const ERRORS = {
  invalid_email: '邮箱格式不对',
  too_many_requests: '发送太频繁了，过 15 分钟再试',
  email_not_configured: '邮件登录暂时不可用，请用 Google 登录',
  email_send_failed: '邮件发送失败，稍后再试',
  code_wrong: '验证码不对，再看看邮件',
  code_expired: '验证码过期了，请重新发送',
  offline: '网络好像断了',
  too_many_profiles: '最多只能添加 6 个孩子',
  name_required: '写一个名字或昵称',
  bad_pin_format: 'PIN 是 6 位数字',
  pin_wrong: '邮箱或 PIN 不对，请问问爸爸妈妈',
  pin_locked: '试错太多次了，15 分钟后再试',
  pin_too_simple: '这个 PIN 太简单了，换一个',
  pin_taken: '另一个孩子已经用了这个 PIN，换一个',
  plus_required: '这是 Pro 功能，请爸爸妈妈先升级 Pro',
}
const msg = (e) => t(ERRORS[e?.code] || '出错了，请再试一次')

function Modal({ title, onClose, children }) {
  useT()
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-card sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div className="modal-title">{title}</div>
          {onClose && (
            <button className="btn ghost close" onClick={onClose} aria-label={t('关闭')}>✕</button>
          )}
        </div>
        {children}
      </div>
    </div>
  )
}

export function LoginModal({ onClose, initialTab = 'parent' }) {
  useT()
  const [tab, setTab] = useState(initialTab) // parent | child
  const [step, setStep] = useState('choose') // choose | code
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [dev, setDev] = useState(null)
  const [providers, setProviders] = useState(null)
  const codeInput = useRef(null)

  useEffect(() => {
    loadProviders().then(setProviders)
  }, [])

  const send = async (e) => {
    e?.preventDefault()
    setBusy(true)
    setError('')
    try {
      const r = await sendEmailLink(email)
      setDev(r.dev || null)
      setStep('code')
      setTimeout(() => codeInput.current?.focus(), 50)
    } catch (err) {
      setError(msg(err))
    } finally {
      setBusy(false)
    }
  }
  const verify = async (e) => {
    e?.preventDefault()
    setBusy(true)
    setError('')
    try {
      await verifyEmailCode(email, code)
      await initAccount()
      onClose('signed-in')
    } catch (err) {
      setError(msg(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={t('登录')} onClose={() => onClose()}>
      <div className="seg tabs">
        <button className={tab === 'parent' ? 'on' : ''} onClick={() => { setTab('parent'); setError('') }}>
          <strong>{t('我是家长')}</strong>
        </button>
        <button className={tab === 'child' ? 'on' : ''} onClick={() => { setTab('child'); setError('') }}>
          <strong>{t('我是孩子')}</strong>
        </button>
      </div>
      {tab === 'child' ? (
        <ChildLogin onDone={() => onClose('signed-in')} />
      ) : step === 'choose' ? (
        <>
          <p className="muted small">{t('登录后，每个孩子的错词本和练习记录会保存在云端，换设备也能继续练。输入邮箱，我们会发一个验证码给你，不需要设密码。')}</p>
          {providers?.google && (
            <>
              <a className="btn google" href="/api/auth/google/start">
                <GoogleMark /> {t('用 Google 登录')}
              </a>
              <div className="or"><span>{t('或者用邮箱')}</span></div>
            </>
          )}
          {providers && !providers.email && !providers.google && <p className="form-error">{t('登录功能还在准备中，过几天再来看看。')}</p>}
          <form onSubmit={send} className="stack">
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder={t('家长邮箱')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button className="btn primary" disabled={busy || !email}>{busy ? t('发送中…') : t('发送登录邮件')}</button>
          </form>
        </>
      ) : (
        <form onSubmit={verify} className="stack">
          <p className="small">
            {t('登录邮件已发到')} <b>{email}</b>{t('。输入邮件里的 6 位验证码，或者直接点邮件里的按钮。')}
          </p>
          {dev && <p className="small dev">{t('开发模式验证码：')}{dev.code}</p>}
          <input
            ref={codeInput}
            className="code-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
          <button className="btn primary" disabled={busy || code.length !== 6}>{busy ? t('验证中…') : t('登录')}</button>
          <button type="button" className="link-btn" onClick={() => { setStep('choose'); setCode(''); setError('') }}>
            {t('换个邮箱 / 重新发送')}
          </button>
        </form>
      )}
      {tab === 'parent' && error && <p className="form-error">{error}</p>}
      {tab === 'parent' && <p className="muted tiny">{t('只用邮箱识别你的账号，不会发广告。孩子只需要一个昵称。')}</p>}
    </Modal>
  )
}

const isStandalone = () =>
  typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true)
const isIOS = () => typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent)

function ChildLogin({ onDone }) {
  useT()
  const [email, setEmail] = useState(familyEmail())
  const [pin, setPinValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await childSignIn(email, pin)
      onDone()
    } catch (err) {
      setError(msg(err))
      setPinValue('')
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="stack">
      <p className="muted small">{t('用爸爸或妈妈的邮箱，加上你自己的 6 位 PIN。PIN 由家长在「修改孩子资料」里设置。')}</p>
      <input type="email" inputMode="email" autoComplete="username" placeholder={t('爸爸或妈妈的邮箱')} value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input
        className="code-input"
        type="password"
        inputMode="numeric"
        autoComplete="current-password"
        pattern="[0-9]{6}"
        maxLength={6}
        placeholder={t('6 位 PIN')}
        value={pin}
        onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ''))}
      />
      <button className="btn primary" disabled={busy || !email || pin.length !== 6}>{busy ? t('登录中…') : t('开始练习')}</button>
      {error && <p className="form-error">{error}</p>}
      <p className="muted tiny">{t('登录后这台设备会记住你半年，不用每次都登录。')}</p>
      {isIOS() && !isStandalone() && (
        <p className="tip small">
          {t('想从主屏幕图标打开？请先点 Safari 的「分享 → 添加到主屏幕」，从图标打开后再登录。主屏幕图标和 Safari 的登录是分开记住的。')}
        </p>
      )}
    </form>
  )
}

/** What a signed-in child sees behind their chip: who they are, and a way out. */
export function ChildSheet({ onClose }) {
  useT()
  const a = useAccount()
  const p = a.profiles[0]
  const [confirm, setConfirm] = useState(false)
  return (
    <Modal title={t('正在练习')} onClose={onClose}>
      {p && (
        <div className="child-card">
          <span className="chip-avatar big">{p.avatar}</span>
          <span>
            <b>{p.name}</b>
            <span className="muted small"> · {p.grade}</span>
          </span>
        </div>
      )}
      <p className="muted small">{t('这台设备会一直记住你。换别的孩子或者家长要用的话，可以退出登录。')}</p>
      {confirm ? (
        <div className="danger-confirm">
          <p className="small">{t('退出后，下次要用 PIN 重新登录。')}</p>
          <button className="btn danger" onClick={async () => { await signOut(); onClose() }}>{t('确定退出')}</button>
          <button className="btn ghost" onClick={() => setConfirm(false)}>{t('取消')}</button>
        </div>
      ) : (
        <button className="btn" onClick={() => setConfirm(true)}>{t('退出登录')}</button>
      )}
    </Modal>
  )
}

function PinSection({ profile }) {
  useT()
  const [pin, setPinValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const save = async () => {
    setBusy(true)
    setError('')
    try {
      await setPin(profile.id, pin)
      setSaved(true)
      setPinValue('')
    } catch (err) {
      setError(msg(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="field">
      <span>{t('孩子登录 PIN')} {profile.hasPin || saved ? <b className="ok-text">· {t('已设置')}</b> : `· ${t('未设置')}`}</span>
      <div className="pin-row">
        <input
          inputMode="numeric"
          autoComplete="off"
          maxLength={6}
          placeholder={profile.hasPin || saved ? t('新 PIN（重设）') : t('6 位数字')}
          value={pin}
          onChange={(e) => { setPinValue(e.target.value.replace(/\D/g, '')); setSaved(false) }}
        />
        <button type="button" className="btn" disabled={busy || pin.length !== 6} onClick={save}>{busy ? '…' : t('保存 PIN')}</button>
      </div>
      {saved && <span className="ok-text small">{t('PIN 已保存。孩子用你的邮箱 + 这个 PIN 就能登录。')}</span>}
      {error && <span className="form-error">{error}</span>}
    </div>
  )
}

function DevicesSection({ profile }) {
  useT()
  const [devices, setDevices] = useState(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    listDevices(profile.id).then(setDevices).catch(() => setDevices([]))
  }, [profile.id])
  const when = (t) => new Date(t).toLocaleDateString(getLang() === 'en' ? 'en-SG' : 'zh-CN', { month: 'numeric', day: 'numeric' })
  return (
    <div className="field">
      <span>{t('TA 已登录的设备')}</span>
      {devices === null ? (
        <span className="muted small">…</span>
      ) : devices.length === 0 ? (
        <span className="muted small">{t('还没有')}</span>
      ) : (
        <>
          <ul className="device-list">
            {devices.map((d, i) => (
              <li key={i}>
                {t(d.device || '浏览器')} <span className="muted">· {t('登录于')} {when(d.created_at)} · {t('最近使用')} {when(d.last_seen || d.created_at)}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn small-btn"
            disabled={busy}
            onClick={async () => { setBusy(true); await revokeDevices(profile.id); setDevices([]); setBusy(false) }}
          >
            {t('让这些设备全部退出')}
          </button>
        </>
      )}
    </div>
  )
}

export function ProfileModal({ profile, first, onClose, onPlus }) {
  const account = useAccount()
  useT()
  const [name, setName] = useState(profile?.name || '')
  const [grade, setGrade] = useState(profile?.grade || 'P1')
  const [avatar, setAvatar] = useState(profile?.avatar || AVATARS[0])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (profile) await updateProfile(profile.id, { name, grade, avatar })
      else await createProfile({ name, grade, avatar })
      onClose()
    } catch (err) {
      if (err.code === 'plus_required' && onPlus) return onPlus('免费版只能添加 1 个孩子，Pro 最多 6 个。')
      setError(msg(err))
    } finally {
      setBusy(false)
    }
  }
  const remove = async () => {
    setBusy(true)
    try {
      await deleteProfile(profile.id)
      onClose()
    } catch (err) {
      setError(msg(err))
      setBusy(false)
    }
  }

  return (
    <Modal title={profile ? t('修改孩子资料') : first ? t('添加第一个孩子') : t('添加孩子')} onClose={onClose}>
      <form onSubmit={save} className="stack">
        <label className="field">
          <span>{t('名字或昵称')}</span>
          <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder={t('比如：小明、哥哥')} required />
        </label>
        <div className="field">
          <span>{t('年级')}</span>
          <div className="grade-pick">
            {LEVELS.map((l) => (
              <button type="button" key={l} className={grade === l ? 'on' : ''} onClick={() => setGrade(l)}>{l}</button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>{t('头像')}</span>
          <div className="avatar-pick">
            {AVATARS.map((a) => (
              <button type="button" key={a} className={avatar === a ? 'on' : ''} onClick={() => setAvatar(a)} aria-label={a}>{a}</button>
            ))}
          </div>
        </div>
        <button className="btn primary" disabled={busy || !name.trim()}>{busy ? t('保存中…') : t('保存')}</button>
      </form>
      {profile && !account.plan?.plus && (
        <div className="stack section-sep">
          <div className="plus-inline">
            <span>
              <b>{t('孩子用 PIN 自己登录')}</b> <PlusTag />
              <span className="muted small">{t('设好 PIN，孩子在自己的平板上也能登录，进度同步。')}</span>
            </span>
            <button type="button" className="btn small-btn" onClick={() => onPlus?.('孩子登录和多设备同步是 Pro 功能。')}>{t('了解 Pro')}</button>
          </div>
        </div>
      )}
      {profile && account.plan?.plus && (
        <div className="stack section-sep">
          <PinSection profile={profile} />
          <DevicesSection profile={profile} />
          <div className="field">
            <span>{t('这台设备只给 TA 用？')}</span>
            <button type="button" className="btn" onClick={async () => { await handOver(profile.id); onClose('handover') }}>
              {t('切换成「{name}」的孩子模式', { name: profile.name })}
            </button>
            <span className="muted tiny">{t('切换后这台设备上的家长账号会退出，孩子只能看到和练习自己的内容。')}</span>
          </div>
        </div>
      )}
      <form className="stack" onSubmit={(e) => e.preventDefault()}>
        {profile &&
          (confirmDelete ? (
            <div className="danger-confirm">
              <p className="small">{t('删除「{name}」和 TA 的全部练习记录？删除后不能恢复。', { name: profile.name })}</p>
              <button type="button" className="btn danger" onClick={remove} disabled={busy}>{t('确定删除')}</button>
              <button type="button" className="btn ghost" onClick={() => setConfirmDelete(false)}>{t('取消')}</button>
            </div>
          ) : (
            <button type="button" className="link-btn danger-link" onClick={() => setConfirmDelete(true)}>{t('删除这个孩子')}</button>
          ))}
      </form>
      {error && <p className="form-error">{error}</p>}
    </Modal>
  )
}

export function AccountSheet({ onClose, onEdit, onAdd, onPlus, onReport, onLists }) {
  useT()
  const a = useAccount()
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const plus = a.plan?.plus
  const until = a.plan?.until ? new Date(a.plan.until).toLocaleDateString(getLang() === 'en' ? 'en-SG' : 'zh-CN') : ''
  return (
    <Modal title={t('谁在练习？')} onClose={onClose}>
      <div className={`plan-box ${plus ? 'is-plus' : ''}`}>
        {plus ? (
          <>
            <span>
              <b>{t('小华听写')} <span className="plus-word">Pro</span></b>
              <span className="muted small">{a.plan.cancelAtPeriodEnd ? t('订阅会在 {d} 结束', { d: until }) : t('下次续费：{d}', { d: until })}</span>
            </span>
            {a.plan.canManage && (
              <button className="btn small-btn" onClick={() => openPortal().catch(() => {})}>{t('管理订阅')}</button>
            )}
          </>
        ) : (
          <>
            <span>
              <b>{t('免费版')}</b>
              <span className="muted small">{t('1 个孩子 · 记录保存在这台设备上')}</span>
            </span>
            <button className="btn primary small-btn" onClick={() => onPlus()}>{t('升级 Pro')}</button>
          </>
        )}
      </div>
      <div className="sheet-links">
        <button className="btn" onClick={() => (plus ? onReport(a.activeId) : onPlus('家长报告是 Pro 功能。'))} disabled={!a.activeId}>
          {t('学习报告')} {!plus && <PlusTag />}
        </button>
        <button className="btn" onClick={() => (plus ? onLists() : onPlus('自定义词组是 Pro 功能。'))}>
          {t('我的词组')} {!plus && <PlusTag />}
        </button>
      </div>
      <ul className="profile-list">
        {a.profiles.map((p) => (
          <li key={p.id} className={`${p.id === a.activeId ? 'on' : ''} ${isPaused(p.id) ? 'paused' : ''}`}>
            <button
              className="profile-pick"
              onClick={() => {
                if (isPaused(p.id)) return onPlus('免费版只能练 1 个孩子。升级 Pro，其他孩子的记录马上恢复。')
                selectProfile(p.id)
                onClose()
              }}
            >
              <span className="chip-avatar big">{p.avatar}</span>
              <span>
                <b>{p.name}</b>
                <span className="muted small">
                  {p.grade} · {p.hasPin ? t('PIN 已设置') : t('未设 PIN')}
                  {p.devices ? ` · ${t('{n} 台设备', { n: p.devices })}` : ''}
                </span>
              </span>
              {p.id === a.activeId && <span className="tag ok">{t('正在练习')}</span>}
              {isPaused(p.id) && <span className="tag">{t('已暂停')}</span>}
            </button>
            <button className="btn ghost small-btn" onClick={() => onEdit(p)} aria-label={t('修改{name}', { name: p.name })}>{t('修改')}</button>
          </li>
        ))}
      </ul>
      {a.profiles.length < 6 && (
        <button className="btn" onClick={() => (plus || a.profiles.length === 0 ? onAdd() : onPlus('免费版只能添加 1 个孩子，Pro 最多 6 个。'))}>
          {t('＋ 添加孩子')} {!plus && a.profiles.length > 0 && <PlusTag />}
        </button>
      )}
      <div className="sheet-foot">
        <p className="muted small">{t('已登录：')}{a.user?.email}</p>
        <button className="btn ghost" onClick={async () => { await signOut(); onClose() }}>{t('退出登录')}</button>
        {confirm ? (
          <div className="danger-confirm">
            <p className="small">{t('删除账号会同时删除所有孩子的练习记录，不能恢复。')}</p>
            <button className="btn danger" disabled={busy} onClick={async () => { setBusy(true); await deleteAccount(); onClose() }}>{t('确定删除账号')}</button>
            <button className="btn ghost" onClick={() => setConfirm(false)}>{t('取消')}</button>
          </div>
        ) : (
          <button className="link-btn danger-link" onClick={() => setConfirm(true)}>{t('删除账号')}</button>
        )}
      </div>
    </Modal>
  )
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}
