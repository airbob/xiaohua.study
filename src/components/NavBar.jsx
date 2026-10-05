import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useAccount } from '../lib/account.js'
import { track } from '../lib/analytics.js'

const LINKS = [
  { key: 'map', label: '汉字岛地图' },
  { key: 'words', label: '词语表', href: '/words/' },
  { key: 'camp', label: '复习营地' },
]

const PERKS = [
  { title: '进度和星星不会丢', desc: '换电脑、换平板，打开就接着上次的关卡' },
  { title: '错词本跟着走', desc: '复习营地里的词在每台设备上都看得到' },
  { title: '一个账号，几个孩子', desc: '兄弟姐妹各有各的地图和进度' },
  { title: '孩子用 PIN 自己登录', desc: '家长设好 6 位 PIN，孩子在自己的平板上也能登录' },
]

const UserIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1B1B26" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
)

/**
 * Site-wide top bar: brand, the three places (map / word lists / review camp), and the account
 * corner — a loud 登录 / 注册 for guests (with an ⓘ explaining why), the child's name once signed in.
 * active: 'map' | 'words' | 'camp' | 'none'. onNav(key) for in-app places; 词语表 is a real page.
 */
export default function NavBar({ active = 'none', onNav, onAccount }) {
  const account = useAccount()
  const [info, setInfo] = useState(false)
  const bar = useRef(null)

  // pages size themselves to the space under the bar (it wraps to two rows on phones)
  useLayoutEffect(() => {
    const el = bar.current
    const set = () => document.documentElement.style.setProperty('--nav-h', `${el.offsetHeight}px`)
    set()
    const ro = new ResizeObserver(set)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!info) return
    const close = (e) => e.key === 'Escape' && setInfo(false)
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [info])

  const guest = account.status === 'guest' || account.status === 'offline'
  const child = account.profiles.find((p) => p.id === account.activeId)
  const login = (from) => {
    track('login_open', { from })
    setInfo(false)
    onAccount('login')
  }

  return (
    <nav className={`topbar ${active === 'none' ? 'in-task' : ''}`} ref={bar} aria-label="小华听写">
      <div className="topbar-inner">
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault()
            onNav('map')
          }}
        >
          <span className="brand-logo">写</span>
          <span className="brand-name">小华听写</span>
        </a>

        <div className="nav-links">
          {LINKS.map((l) => (
            <a
              key={l.key}
              href={l.href || (l.key === 'camp' ? '/?go=review' : '/')}
              className={`nav-link ${active === l.key ? 'on' : ''}`}
              aria-current={active === l.key ? 'page' : undefined}
              onClick={(e) => {
                if (l.href) return // a real page
                e.preventDefault()
                onNav(l.key)
              }}
            >
              {l.label}
            </a>
          ))}
        </div>

        <span className="nav-spacer" />

        {account.status === 'loading' ? null : guest ? (
          <>
            <span className="guest-note">游客模式 · 也能直接练</span>
            <span className="login-wrap">
              <button className="login-btn" onClick={() => login('nav')}>
                <UserIcon /> 登录 / 注册
              </button>
              <button className="info-dot" aria-label="登录有什么好处" aria-expanded={info} onClick={() => {
                  if (!info) track('login_info_open')
                  setInfo(!info)
                }}>
                <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="5.5" r="2.6" fill="#1B1B26" />
                  <rect x="9.6" y="10" width="4.8" height="11" rx="2.2" fill="#1B1B26" />
                </svg>
              </button>
              {info && (
                <div className="perks" role="dialog" aria-label="登录的好处">
                  <span className="perks-arrow" aria-hidden="true" />
                  <div className="perks-head">
                    <span className="display">登录有什么好处？</span>
                    <button className="perks-close" aria-label="关闭" onClick={() => setInfo(false)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1B1B26" strokeWidth="3.4" strokeLinecap="round" aria-hidden="true">
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  </div>
                  {PERKS.map((p) => (
                    <div key={p.title} className="perk">
                      <span className="perk-check" aria-hidden="true">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1B1B26" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10" /></svg>
                      </span>
                      <span>
                        <b>{p.title}</b>
                        <span>{p.desc}</span>
                      </span>
                    </div>
                  ))}
                  <div className="perks-note">
                    <b>不登录也可以练！</b>所有年级和关卡都能直接玩，只是进度和错词本只保存在这台设备上。
                  </div>
                  <div className="perks-actions">
                    <button className="btn" onClick={() => setInfo(false)}>先直接练</button>
                    <button className="btn primary" onClick={() => login('nav_info')}>登录 / 注册</button>
                  </div>
                </div>
              )}
            </span>
          </>
        ) : (
          <button className="me-btn" onClick={() => onAccount(account.child ? 'child' : child ? 'account' : 'profile-new')}>
            {child ? (
              <>
                <span className="me-avatar">{child.avatar}</span>
                <span className="me-name">{child.name}</span>
                <span className="me-sub">{child.grade}{account.child ? '' : ' · 切换'}</span>
              </>
            ) : (
              <span className="me-name">＋ 添加孩子</span>
            )}
          </button>
        )}
      </div>
    </nav>
  )
}
