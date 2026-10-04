import { useEffect, useRef, useState } from 'react'
import Home from './components/Home.jsx'
import Practice from './components/Practice.jsx'
import LevelComplete from './components/LevelComplete.jsx'
import ReviewCamp from './components/ReviewCamp.jsx'
import { buildSet } from './lib/bank.js'
import { GRADES, levelWords, levelCount, gradeStatus } from './lib/levels.js'
import { loadPrefs, savePrefs, loadLevels } from './lib/storage.js'
import { useAccount, initAccount, showNotice } from './lib/account.js'
import { LoginModal, ProfileModal, AccountSheet, ChildSheet } from './components/AccountUI.jsx'

const LOGIN_ERRORS = {
  cancelled: '已取消 Google 登录',
  link_expired: '登录链接已经用过或过期了，请重新登录',
  google_not_configured: 'Google 登录还没开通，请先用邮箱登录',
  email_unverified: '这个 Google 账号的邮箱还没验证',
}

const DEFAULT_PREFS = { mode: 'dictation', showExample: true, showEnglish: false, autoSpeak: true }

export default function App() {
  const [prefs, setPrefs] = useState(() => ({ ...DEFAULT_PREFS, ...loadPrefs() }))
  const [screen, setScreen] = useState({ name: 'home' })
  const [modal, setModal] = useState(null) // login | account | profile-new | { edit: profile }
  const account = useAccount()

  // Load the session; handle the redirect back from Google / the emailed link.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const err = q.get('login_error')
    if (q.has('login') || err) {
      q.delete('login')
      q.delete('login_error')
      window.history.replaceState(null, '', window.location.pathname + (q.toString() ? `?${q}` : ''))
    }
    if (err) showNotice(LOGIN_ERRORS[err] || '登录没有成功，请再试一次')
    initAccount()
  }, [])

  // a parent with no child yet is asked (once per visit) to add one
  const askedFirst = useRef(false)
  useEffect(() => {
    if (account.status === 'signed-in' && account.profiles.length === 0 && !modal && !askedFirst.current) {
      askedFirst.current = true
      setModal('profile-first')
    }
  }, [account.status, account.profiles.length, modal])

  const updatePrefs = (p) => {
    const next = { ...prefs, ...p }
    setPrefs(next)
    savePrefs(next)
  }

  const go = (next) => {
    setScreen(next)
    window.scrollTo(0, 0)
  }

  /** kind: 'level' (with level = { grade, level }) | 'mix' | 'review' (with words) */
  const play = (kind, { level = null, words = null } = {}) => {
    const list = words || (kind === 'level' ? levelWords(level.grade, level.level) : buildSet('mix'))
    if (!list.length) return
    go({ name: 'practice', kind, level, words: list, id: Date.now() })
  }
  const startLevel = (grade, level) => play('level', { level: { grade, level } })
  const currentLevel = (grade) => gradeStatus(grade, loadLevels()[grade]).current

  /** After level n: n+1 in the same grade, else the next grade's current level, else home. */
  const nextLevel = (lv) => {
    if (lv.level < levelCount(lv.grade)) return () => startLevel(lv.grade, lv.level + 1)
    const g = GRADES[GRADES.indexOf(lv.grade) + 1]
    return g ? () => startLevel(g, currentLevel(g)) : null
  }

  // Deep link from the word-list pages: /?start=P3 (or ?start=mix) jumps straight into a set.
  useEffect(() => {
    const q = (new URLSearchParams(window.location.search).get('start') || '').toUpperCase()
    if (!q) return
    window.history.replaceState(null, '', window.location.pathname)
    if (q === 'MIX') play('mix')
    else if (GRADES.includes(q)) startLevel(q, currentLevel(q))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const modals = (
    <>
      {modal === 'login' && <LoginModal onClose={() => setModal(null)} />}
      {modal === 'child' && <ChildSheet onClose={() => setModal(null)} />}
      {modal === 'account' && (
        <AccountSheet onClose={() => setModal(null)} onEdit={(p) => setModal({ edit: p })} onAdd={() => setModal('profile-new')} />
      )}
      {(modal === 'profile-new' || modal === 'profile-first') && (
        <ProfileModal first={modal === 'profile-first'} onClose={() => setModal(null)} />
      )}
      {modal?.edit && (
        <ProfileModal
          profile={account.profiles.find((p) => p.id === modal.edit.id) || modal.edit}
          onClose={(why) => setModal(why === 'handover' ? null : 'account')}
        />
      )}
    </>
  )

  const home = () => go({ name: 'home' })

  if (screen.name === 'practice')
    return (
      <Practice
        key={screen.id}
        words={screen.words}
        title={screen.kind === 'level' ? `${screen.level.grade} · 第 ${screen.level.level} 关` : screen.kind === 'review' ? '复习营地' : '随机探险'}
        prefs={prefs}
        onQuit={screen.kind === 'review' ? () => go({ name: 'review' }) : home}
        onFinish={(results, stats) => go({ name: 'complete', kind: screen.kind, level: screen.level, words: screen.words, results, stats })}
      />
    )
  if (screen.name === 'complete')
    return (
      <LevelComplete
        key={screen.results.length + screen.stats.ms}
        results={screen.results}
        kind={screen.kind}
        level={screen.level}
        stats={screen.stats}
        onHome={home}
        onNext={screen.kind === 'level' ? nextLevel(screen.level) : null}
        onAgain={() => (screen.kind === 'review' ? go({ name: 'review' }) : play('mix'))}
        onReview={(wrong) => play('review', { words: wrong.map(({ chars, ...w }) => w) })}
        onLogin={() => {
          home()
          setModal('login')
        }}
      />
    )
  if (screen.name === 'review')
    return (
      <ReviewCamp prefs={prefs} onPrefs={updatePrefs} onBack={home} onStart={(words) => play('review', { words })} />
    )
  return (
    <>
      <Home
        prefs={prefs}
        onPrefs={updatePrefs}
        onStartLevel={startLevel}
        onMix={() => play('mix')}
        onReview={() => go({ name: 'review' })}
        onAccount={setModal}
      />
      {modals}
    </>
  )
}
