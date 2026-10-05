import { useEffect, useRef, useState } from 'react'
import Home from './components/Home.jsx'
import NavBar from './components/NavBar.jsx'
import ListsPage from './components/ListsPage.jsx'
import ReportPage from './components/ReportPage.jsx'
import { PlusModal } from './components/Plus.jsx'
import Practice from './components/Practice.jsx'
import LevelComplete from './components/LevelComplete.jsx'
import ReviewCamp from './components/ReviewCamp.jsx'
import { buildSet } from './lib/bank.js'
import { GRADES, levelWords, levelCount, gradeStatus } from './lib/levels.js'
import { loadPrefs, savePrefs, loadLevels } from './lib/storage.js'
import { useAccount, initAccount, showNotice, awaitPlus } from './lib/account.js'
import { track, trackScreen } from './lib/analytics.js'
import { useT, setLang, getLang } from './lib/i18n.js'
import { LoginModal, ProfileModal, AccountSheet, ChildSheet } from './components/AccountUI.jsx'

const LOGIN_ERRORS = {
  cancelled: '已取消 Google 登录',
  link_expired: '登录链接已经用过或过期了，请重新登录',
  google_not_configured: 'Google 登录还没开通，请先用邮箱登录',
  email_unverified: '这个 Google 账号的邮箱还没验证',
}

const DEFAULT_PREFS = { mode: 'dictation', showExample: true, showEnglish: false, autoSpeak: true, sound: true }

export default function App() {
  const [prefs, setPrefs] = useState(() => ({ ...DEFAULT_PREFS, ...loadPrefs() }))
  const [screen, setScreen] = useState({ name: 'home' })
  const [modal, setModal] = useState(null) // login | account | profile-new | { edit: profile }
  const account = useAccount()
  const t = useT()

  // switching to English also turns on the English meaning of each word (once), so a child
  // without Chinese at home still knows what they are writing
  const changeLang = (l) => {
    if (l === getLang()) return
    track('language_switch', { to: l })
    setLang(l)
    if (l === 'en' && !prefs.showEnglish) updatePrefs({ showEnglish: true })
  }

  // Load the session; handle the redirect back from Google / the emailed link.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const err = q.get('login_error')
    const loggedIn = q.get('login') === 'ok' // back from the emailed link or Google
    if (q.has('login') || err) {
      q.delete('login')
      q.delete('login_error')
      window.history.replaceState(null, '', window.location.pathname + (q.toString() ? `?${q}` : ''))
    }
    if (err) showNotice(LOGIN_ERRORS[err] || '登录没有成功，请再试一次') // shown through t() in Home
    if (loggedIn) track('login', { method: 'link_or_google' })
    // back from Stripe: Checkout (success / cancel) or the Customer Portal
    const billing = q.get('billing')
    if (billing) {
      q.delete('billing')
      window.history.replaceState(null, '', window.location.pathname + (q.toString() ? `?${q}` : ''))
    }
    if (billing === 'success') {
      awaitPlus().then((ok) => {
        showNotice(ok ? '欢迎加入 Pro！练习记录已经开始同步到云端。' : '付款成功，Pro 正在开通，稍等一下再刷新页面。')
        if (ok) track('purchase', { currency: 'SGD', items: [{ item_name: 'plus' }] })
      })
    } else initAccount()
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
  // the first screen is already counted by gtag('config') on load; report later screens only
  const firstScreen = useRef(true)
  useEffect(() => {
    if (firstScreen.current) {
      firstScreen.current = false
      return
    }
    trackScreen(screen.name)
  }, [screen.name, screen.id])

  /** kind: 'level' (with level = { grade, level }) | 'mix' | 'review' (with words) */
  const play = (kind, { level = null, words = null, from = 'app', title = null } = {}) => {
    const list = words || (kind === 'level' ? levelWords(level.grade, level.level) : buildSet('mix'))
    if (!list.length) return
    if (kind === 'level')
      track('level_start', { level_name: `${level.grade}-${level.level}`, grade: level.grade, level: level.level, mode: prefs.mode, from })
    else track('practice_start', { kind, words: list.length, mode: prefs.mode, from })
    go({ name: 'practice', kind, level, words: list, title, id: Date.now() })
  }
  const startLevel = (grade, level, from) => play('level', { level: { grade, level }, from })
  const currentLevel = (grade) => gradeStatus(grade, loadLevels()[grade]).current

  /** After level n: n+1 in the same grade, else the next grade's current level, else home. */
  const nextLevel = (lv) => {
    if (lv.level < levelCount(lv.grade)) return () => startLevel(lv.grade, lv.level + 1)
    const g = GRADES[GRADES.indexOf(lv.grade) + 1]
    return g ? () => startLevel(g, currentLevel(g)) : null
  }

  // Deep links from the word-list pages: /?start=P3 (or ?start=mix) jumps straight into a set,
  // /?start=P3&level=4 into that level (闯这一关), /?go=review opens 复习营地, /?go=login the sign-in dialog.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const q = (params.get('start') || '').toUpperCase()
    const dest = params.get('go')
    if (!q && !dest) return
    window.history.replaceState(null, '', window.location.pathname)
    if (dest === 'review') return go({ name: 'review' })
    if (dest === 'login') {
      track('login_open', { from: 'wordlist' })
      return setModal('login')
    }
    if (q === 'MIX') play('mix', { from: 'wordlist' })
    else if (GRADES.includes(q)) {
      const n = Number(params.get('level'))
      startLevel(q, Number.isInteger(n) && n >= 1 && n <= levelCount(q) ? n : currentLevel(q), 'wordlist')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const modals = (
    <>
      {modal === 'login' && <LoginModal onClose={() => setModal(null)} />}
      {modal === 'child' && <ChildSheet onClose={() => setModal(null)} />}
      {modal === 'account' && (
        <AccountSheet
          onClose={() => setModal(null)}
          onEdit={(p) => setModal({ edit: p })}
          onAdd={() => setModal('profile-new')}
          onPlus={(reason) => setModal({ plus: reason || true })}
          onReport={(id) => {
            setModal(null)
            go({ name: 'report', profileId: id })
          }}
          onLists={() => {
            setModal(null)
            go({ name: 'lists' })
          }}
        />
      )}
      {(modal === 'profile-new' || modal === 'profile-first') && (
        <ProfileModal first={modal === 'profile-first'} onClose={() => setModal(null)} onPlus={(reason) => setModal({ plus: reason || true })} />
      )}
      {modal?.plus && (
        <PlusModal
          reason={modal.plus === true ? null : modal.plus}
          onClose={() => setModal(null)}
          onLogin={() => setModal('login')}
        />
      )}
      {modal?.edit && (
        <ProfileModal
          profile={account.profiles.find((p) => p.id === modal.edit.id) || modal.edit}
          onClose={(why) => setModal(why === 'handover' ? null : 'account')}
          onPlus={(reason) => setModal({ plus: reason || true })}
        />
      )}
    </>
  )

  const home = () => go({ name: 'home' })

  const nav = (k) => (k === 'camp' ? go({ name: 'review' }) : home())
  let page
  if (screen.name === 'practice')
    page = (
      <Practice
        key={screen.id}
        words={screen.words}
        title={screen.kind === 'level' ? `${screen.level.grade} · ${t('第 {n} 关', { n: screen.level.level })}` : screen.kind === 'review' ? t('复习营地') : screen.kind === 'custom' ? screen.title : t('随机探险')}
        prefs={prefs}
        onQuit={screen.kind === 'review' ? () => go({ name: 'review' }) : screen.kind === 'custom' ? () => go({ name: 'lists' }) : home}
        onFinish={(results, stats) => go({ name: 'complete', kind: screen.kind, level: screen.level, title: screen.title, words: screen.words, results, stats })}
      />
    )
  else if (screen.name === 'complete')
    page = (
      <LevelComplete
        key={screen.results.length + screen.stats.ms}
        results={screen.results}
        kind={screen.kind}
        level={screen.level}
        stats={screen.stats}
        sound={prefs.sound}
        onHome={home}
        onNext={screen.kind === 'level' ? nextLevel(screen.level) : null}
        title={screen.title}
        onAgain={() =>
          screen.kind === 'review' ? go({ name: 'review' }) : screen.kind === 'custom' ? play('custom', { words: screen.words, title: screen.title }) : play('mix')
        }
        onReview={(wrong) => play('review', { words: wrong.map(({ chars, ...w }) => w) })}
        onLogin={() => {
          track('login_open', { from: 'complete' })
          setModal('login')
        }}
        onPlus={() => setModal({ plus: '升级 Pro，练习记录就会存到云端，换设备也能接着练。' })}
      />
    )
  else if (screen.name === 'lists')
    page = (
      <ListsPage
        onBack={home}
        onPlay={(words, title) => play('custom', { words, title })}
        onUpgrade={() => setModal({ plus: '自定义词组是 Pro 功能。' })}
      />
    )
  else if (screen.name === 'report')
    page = <ReportPage profileId={screen.profileId} onBack={home} onPick={(id) => go({ name: 'report', profileId: id })} />
  else if (screen.name === 'review')
    page = <ReviewCamp prefs={prefs} onPrefs={updatePrefs} onBack={home} onStart={(words) => play('review', { words })} />
  else
    page = (
      <Home
        prefs={prefs}
        onPrefs={updatePrefs}
        onStartLevel={startLevel}
        onMix={() => play('mix')}
        onReview={() => go({ name: 'review' })}
        onLists={() => go({ name: 'lists' })}
        onPlus={() => setModal({ plus: true })}
      />
    )

  const active = screen.name === 'home' ? 'map' : screen.name === 'review' ? 'camp' : 'none'
  return (
    <>
      <NavBar active={active} onNav={nav} onAccount={setModal} onLang={changeLang} onPlus={() => setModal({ plus: true })} />
      {page}
      {modals}
    </>
  )
}
