import { useEffect, useRef, useState } from 'react'
import {
  useAccount, createProfile, updateProfile, deleteProfile, selectProfile, signOut, deleteAccount,
  sendEmailLink, verifyEmailCode, initAccount,
} from '../lib/account.js'
import { LEVELS } from '../lib/bank.js'
import { api } from '../lib/api.js'

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
}
const msg = (e) => ERRORS[e?.code] || '出错了，请再试一次'

function Modal({ title, onClose, children }) {
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
            <button className="btn ghost close" onClick={onClose} aria-label="关闭">✕</button>
          )}
        </div>
        {children}
      </div>
    </div>
  )
}

/** Header chip: 登录 for guests, the active child for parents. */
export function AccountChip({ onOpen }) {
  const a = useAccount()
  if (a.status === 'loading') return <span className="chip ghost">…</span>
  if (a.status === 'guest') return <button className="chip" onClick={() => onOpen('login')}>登录</button>
  const p = a.profiles.find((x) => x.id === a.activeId)
  return (
    <button className="chip" onClick={() => onOpen(p ? 'account' : 'profile-new')}>
      {p ? (
        <>
          <span className="chip-avatar">{p.avatar}</span>
          {p.name}
        </>
      ) : (
        '添加孩子'
      )}
    </button>
  )
}

export function LoginModal({ onClose }) {
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
    <Modal title="家长登录" onClose={() => onClose()}>
      {step === 'choose' ? (
        <>
          <p className="muted small">登录后，每个孩子的错词本和练习记录会保存在云端，换设备也能继续练。输入邮箱，我们会发一个验证码给你，不需要设密码。</p>
          {providers?.google && (
            <>
              <a className="btn google" href="/api/auth/google/start">
                <GoogleMark /> 用 Google 登录
              </a>
              <div className="or"><span>或者用邮箱</span></div>
            </>
          )}
          {providers && !providers.email && !providers.google && <p className="form-error">登录功能还在准备中，过几天再来看看。</p>}
          <form onSubmit={send} className="stack">
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="家长邮箱"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button className="btn primary" disabled={busy || !email}>{busy ? '发送中…' : '发送登录邮件'}</button>
          </form>
        </>
      ) : (
        <form onSubmit={verify} className="stack">
          <p className="small">
            登录邮件已发到 <b>{email}</b>。输入邮件里的 6 位验证码，或者直接点邮件里的按钮。
          </p>
          {dev && <p className="small dev">开发模式验证码：{dev.code}</p>}
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
          <button className="btn primary" disabled={busy || code.length !== 6}>{busy ? '验证中…' : '登录'}</button>
          <button type="button" className="link-btn" onClick={() => { setStep('choose'); setCode(''); setError('') }}>
            换个邮箱 / 重新发送
          </button>
        </form>
      )}
      {error && <p className="form-error">{error}</p>}
      <p className="muted tiny">只用邮箱识别你的账号，不会发广告。孩子只需要一个昵称。</p>
    </Modal>
  )
}

export function ProfileModal({ profile, first, onClose }) {
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
    <Modal title={profile ? '修改孩子资料' : first ? '添加第一个孩子' : '添加孩子'} onClose={onClose}>
      <form onSubmit={save} className="stack">
        <label className="field">
          <span>名字或昵称</span>
          <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="比如：小明、哥哥" required />
        </label>
        <div className="field">
          <span>年级</span>
          <div className="grade-pick">
            {LEVELS.map((l) => (
              <button type="button" key={l} className={grade === l ? 'on' : ''} onClick={() => setGrade(l)}>{l}</button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>头像</span>
          <div className="avatar-pick">
            {AVATARS.map((a) => (
              <button type="button" key={a} className={avatar === a ? 'on' : ''} onClick={() => setAvatar(a)} aria-label={a}>{a}</button>
            ))}
          </div>
        </div>
        <button className="btn primary" disabled={busy || !name.trim()}>{busy ? '保存中…' : '保存'}</button>
        {profile &&
          (confirmDelete ? (
            <div className="danger-confirm">
              <p className="small">删除「{profile.name}」和 TA 的全部练习记录？删除后不能恢复。</p>
              <button type="button" className="btn danger" onClick={remove} disabled={busy}>确定删除</button>
              <button type="button" className="btn ghost" onClick={() => setConfirmDelete(false)}>取消</button>
            </div>
          ) : (
            <button type="button" className="link-btn danger-link" onClick={() => setConfirmDelete(true)}>删除这个孩子</button>
          ))}
      </form>
      {error && <p className="form-error">{error}</p>}
    </Modal>
  )
}

export function AccountSheet({ onClose, onEdit, onAdd }) {
  const a = useAccount()
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  return (
    <Modal title="谁在练习？" onClose={onClose}>
      <ul className="profile-list">
        {a.profiles.map((p) => (
          <li key={p.id} className={p.id === a.activeId ? 'on' : ''}>
            <button className="profile-pick" onClick={() => { selectProfile(p.id); onClose() }}>
              <span className="chip-avatar big">{p.avatar}</span>
              <span>
                <b>{p.name}</b>
                <span className="muted small">{p.grade}</span>
              </span>
              {p.id === a.activeId && <span className="tag ok">正在练习</span>}
            </button>
            <button className="btn ghost small-btn" onClick={() => onEdit(p)} aria-label={`修改${p.name}`}>修改</button>
          </li>
        ))}
      </ul>
      {a.profiles.length < 6 && <button className="btn" onClick={onAdd}>＋ 添加孩子</button>}
      <div className="sheet-foot">
        <p className="muted small">已登录：{a.user?.email}</p>
        <button className="btn ghost" onClick={async () => { await signOut(); onClose() }}>退出登录</button>
        {confirm ? (
          <div className="danger-confirm">
            <p className="small">删除账号会同时删除所有孩子的练习记录，不能恢复。</p>
            <button className="btn danger" disabled={busy} onClick={async () => { setBusy(true); await deleteAccount(); onClose() }}>确定删除账号</button>
            <button className="btn ghost" onClick={() => setConfirm(false)}>取消</button>
          </div>
        ) : (
          <button className="link-btn danger-link" onClick={() => setConfirm(true)}>删除账号</button>
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
