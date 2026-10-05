import { useEffect, useMemo, useState } from 'react'
import WORDS from '../data/words.json'
import { useAccount, fetchLists, saveList, removeList } from '../lib/account.js'
import { useT } from '../lib/i18n.js'
import { track } from '../lib/analytics.js'
import { Back } from './Icons.jsx'
import Mascot from './Mascot.jsx'
import Footer from './Footer.jsx'
import { PlusTag } from './Plus.jsx'

const byWord = new Map(WORDS.map((w) => [w.word, w]))
const CJK = /^[㐀-鿿]{1,8}$/
const MAX_WORDS = 60

// pinyin for words outside our word bank; loaded only when a list is edited or played
let pinyinLib = null
const loadPinyin = () => (pinyinLib ||= import('pinyin-pro').then((m) => m.pinyin))

/** Words typed or pasted by a parent: split on spaces, commas, 、, semicolons and new lines. */
export function parseWords(text) {
  const tokens = text.split(/[\s,，、;；。.]+/).map((w) => w.trim()).filter(Boolean)
  const words = []
  const bad = []
  for (const w of tokens) {
    if (!CJK.test(w)) bad.push(w)
    else if (!words.includes(w)) words.push(w)
  }
  return { words, bad }
}

/** Word objects the practice screen understands; bank words keep their example and English. */
export async function toPracticeWords(words) {
  const pinyin = await loadPinyin()
  return words.map((w) => byWord.get(w) || { word: w, pinyin: pinyin(w, { type: 'array' }), grade: null, custom: true })
}

// words practised from lists, so 复习营地 can show pinyin for words outside the bank
const KEY_CUSTOM = 'xhw.customWords'
export function rememberCustomWords(items) {
  try {
    const m = JSON.parse(localStorage.getItem(KEY_CUSTOM) || '{}')
    for (const w of items) if (w.custom) m[w.word] = { pinyin: w.pinyin }
    localStorage.setItem(KEY_CUSTOM, JSON.stringify(m))
  } catch {
    /* ignore */
  }
}
export function customWordInfo(word) {
  try {
    const m = JSON.parse(localStorage.getItem(KEY_CUSTOM) || '{}')
    return m[word] ? { word, pinyin: m[word].pinyin, grade: null, custom: true } : null
  } catch {
    return null
  }
}

/** 我的词组: a family's own word lists (this week's school 听写). Pro. */
export default function ListsPage({ onBack, onPlay, onUpgrade }) {
  const t = useT()
  const a = useAccount()
  const plus = a.plan?.plus
  const canEdit = plus && !a.child
  const [lists, setLists] = useState(null)
  const [editing, setEditing] = useState(null) // null | {} new | list
  const [error, setError] = useState('')
  const [confirmId, setConfirmId] = useState(null)

  useEffect(() => {
    if (!plus) return
    fetchLists()
      .then(setLists)
      .catch(() => setError(t('出错了，请再试一次')))
  }, [plus]) // eslint-disable-line react-hooks/exhaustive-deps

  const play = async (list) => {
    track('list_practice', { words: list.words.length })
    const words = await toPracticeWords(list.words)
    rememberCustomWords(words)
    onPlay(words, list.name)
  }

  return (
    <>
      <div className="camp-page lists-page">
        <header className="camp-head">
          <button className="btn-chunky back" onClick={onBack} aria-label={t('回到地图')}>
            <Back /> <span className="hide-sm">{t('地图')}</span>
          </button>
          <div className="camp-title">
            <h1 className="display">{t('我的词组')} <PlusTag /></h1>
            <p>{t('把学校这周的听写词输进来，孩子就能在格子里练。')}</p>
          </div>
          <div className="grow" />
          {canEdit && !editing && (
            <button className="cta red small new-list" onClick={() => setEditing({})}>
              {t('＋ 新建词组')}
            </button>
          )}
        </header>

        {!plus ? (
          <div className="lists-empty card">
            <Mascot size={80} />
            <div>
              <b className="display">{t('自定义词组是 Pro 功能')}</b>
              <p className="muted small">{t('输入学校发的听写词表，孩子每周练的就是要考的词。')}</p>
              <button className="btn primary" onClick={onUpgrade}>{t('了解 Pro')}</button>
            </div>
          </div>
        ) : editing ? (
          <ListEditor
            list={editing}
            onCancel={() => setEditing(null)}
            onSaved={(l) => {
              setLists((ls) => [l, ...(ls || []).filter((x) => x.id !== l.id)])
              setEditing(null)
            }}
          />
        ) : lists === null ? (
          <p className="muted">{error || '…'}</p>
        ) : lists.length === 0 ? (
          <div className="lists-empty card">
            <Mascot size={80} />
            <div>
              <b className="display">{t('还没有词组')}</b>
              <p className="muted small">{canEdit ? t('点「新建词组」，把这周的听写词贴进来。') : t('请爸爸妈妈先建一个词组。')}</p>
            </div>
          </div>
        ) : (
          <section className="list-grid">
            {lists.map((l) => (
              <div key={l.id} className="camp-card list-card">
                <b className="list-name">{l.name}</b>
                <span className="list-words kai">{l.words.slice(0, 8).join('　')}{l.words.length > 8 ? ' …' : ''}</span>
                <span className="muted small">{t('{n} 个词', { n: l.words.length })}</span>
                <span className="grow" />
                <div className="list-actions">
                  <button className="btn primary" onClick={() => play(l)}>{t('开始练习')}</button>
                  {canEdit && <button className="btn" onClick={() => setEditing(l)}>{t('修改')}</button>}
                  {canEdit &&
                    (confirmId === l.id ? (
                      <span className="danger-confirm inline">
                        {t('删除「{name}」？', { name: l.name })}
                        <button
                          className="btn danger small-btn"
                          onClick={async () => {
                            await removeList(l.id)
                            setLists((ls) => ls.filter((x) => x.id !== l.id))
                            setConfirmId(null)
                          }}
                        >
                          {t('确定删除')}
                        </button>
                        <button className="btn ghost small-btn" onClick={() => setConfirmId(null)}>{t('取消')}</button>
                      </span>
                    ) : (
                      <button className="btn ghost" onClick={() => setConfirmId(l.id)}>{t('删除')}</button>
                    ))}
                </div>
              </div>
            ))}
          </section>
        )}
      </div>
      <Footer />
    </>
  )
}

function ListEditor({ list, onCancel, onSaved }) {
  const t = useT()
  const [name, setName] = useState(list.name || '')
  const [text, setText] = useState((list.words || []).join(' '))
  const [pinyin, setPinyin] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { words, bad } = useMemo(() => parseWords(text), [text])

  useEffect(() => {
    loadPinyin().then((p) => setPinyin(() => p))
  }, [])

  const save = async () => {
    setBusy(true)
    setError('')
    try {
      const saved = await saveList({ id: list.id, name: name.trim(), words })
      track(list.id ? 'list_update' : 'list_create', { words: words.length })
      onSaved(saved)
    } catch (e) {
      setError(
        {
          name_required: t('给词组起个名字'),
          no_words: t('至少输入一个词'),
          too_many_words: t('一个词组最多 {n} 个词', { n: MAX_WORDS }),
          too_many_lists: t('最多只能建 50 个词组'),
          bad_word: t('只能输入中文词语'),
        }[e.code] || t('出错了，请再试一次'),
      )
      setBusy(false)
    }
  }

  return (
    <section className="card list-editor">
      <label className="field">
        <span>{t('词组名字')}</span>
        <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder={t('比如：第 5 课听写')} />
      </label>
      <label className="field">
        <span>{t('词语（用空格、逗号或换行隔开）')}</span>
        <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('完成 勇敢 温暖 故事 节日')} />
      </label>
      {bad.length > 0 && <p className="form-error">{t('这些不是中文词语，会被忽略：{w}', { w: bad.slice(0, 6).join('、') })}</p>}
      {words.length > MAX_WORDS && <p className="form-error">{t('一个词组最多 {n} 个词', { n: MAX_WORDS })}</p>}
      {words.length > 0 && (
        <div className="list-preview">
          {words.map((w) => (
            <span key={w} className="preview-chip">
              <small>{(byWord.get(w)?.pinyin || (pinyin ? pinyin(w, { type: 'array' }) : [])).join(' ')}</small>
              <b className="kai">{w}</b>
            </span>
          ))}
        </div>
      )}
      <p className="muted tiny">{t('拼音会自动加上；词库里有的词还会带例句和英文意思。')}</p>
      <div className="list-actions">
        <button className="btn primary" onClick={save} disabled={busy || !name.trim() || !words.length || words.length > MAX_WORDS}>
          {busy ? t('保存中…') : t('保存词组（{n} 个词）', { n: words.length })}
        </button>
        <button className="btn ghost" onClick={onCancel}>{t('取消')}</button>
      </div>
      {error && <p className="form-error">{error}</p>}
    </section>
  )
}
